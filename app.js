// SPX Book — หน้าเว็บ (ไม่มี secret ในไฟล์นี้)
(() => {
  "use strict";

  const cfg = window.SPX_CONFIG || {};
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const state = { email: "", isAdmin: false, shops: [], selected: [], view: "" };

  // ---------- helpers ----------
  function showView(name) {
    for (const v of ["loading", "login", "denied", "app"]) $("view-" + v).hidden = v !== name;
    state.view = name;
  }
  function showMsg(el, type, html) {
    el.className = "msg " + (type || "");
    el.innerHTML = html;
    el.hidden = !html;
  }
  function bkkTime(ts) {
    return new Date(ts).toLocaleTimeString("th-TH", {
      timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
    });
  }
  function todayStartIso() {
    const d = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    return new Date(`${d}T00:00:00+07:00`).toISOString();
  }
  const shopName = (pup) => (state.shops.find((s) => s.pup_id === pup) || {}).name || "";

  // ---------- ล็อกอิน ----------
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("login-email").value.trim().toLowerCase();
    const password = $("login-password").value;
    const msg = $("login-msg");
    if (!/^\S+@\S+\.\S+$/.test(email)) return showMsg(msg, "error", "กรุณากรอกอีเมลให้ถูกต้อง");
    if (!password) return showMsg(msg, "error", "กรุณากรอกรหัสผ่าน");

    const btn = $("login-btn");
    btn.disabled = true;
    btn.textContent = "กำลังเข้าสู่ระบบ…";
    msg.hidden = true;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    btn.textContent = "เข้าสู่ระบบ";

    if (error) {
      const m = String(error.message || "");
      if (/invalid login credentials|invalid_credentials/i.test(m) || error.code === "invalid_credentials") {
        showMsg(msg, "error", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      } else if (/not confirmed/i.test(m)) {
        showMsg(msg, "error", "บัญชียังไม่ได้ยืนยัน กรุณาติดต่อแอดมิน");
      } else if (/rate|too many/i.test(m) || error.status === 429) {
        showMsg(msg, "warn", "ลองเข้าสู่ระบบถี่เกินไป รอสักครู่แล้วลองใหม่");
      } else {
        showMsg(msg, "error", "เข้าสู่ระบบไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
      }
      return;
    }
    $("login-password").value = "";
  });

  document.querySelectorAll(".js-logout").forEach((b) =>
    b.addEventListener("click", async () => { await sb.auth.signOut(); location.hash = ""; }));

  async function onSession(session) {
    if (!session) {
      state.email = "";
      return showView("login");
    }
    const email = (session.user.email || "").toLowerCase();
    if (state.email === email && state.view === "app") return; // refresh token — ไม่ต้องโหลดใหม่
    state.email = email;

    const { data, error } = await sb.from("allowed_emails").select("email,name,is_admin").eq("email", email).maybeSingle();
    if (error || !data) {
      state.email = "";
      await sb.auth.signOut();
      showView("login");
      showMsg($("login-msg"), "error", `อีเมล <b>${esc(email)}</b> ไม่มีสิทธิ์ใช้งาน กรุณาติดต่อแอดมิน`);
      return;
    }
    state.isAdmin = !!data.is_admin;
    $("who-email").textContent = data.name ? `${data.name}` : email;
    $("tab-admin").hidden = !state.isAdmin;
    showView("app");
    await loadShops();
    loadDirectory();
    switchTab("send");
  }

  sb.auth.onAuthStateChange((_evt, session) => { setTimeout(() => onSession(session), 0); });

  // ---------- แท็บ ----------
  function switchTab(tab) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    for (const p of ["send", "reassign", "history", "admin"]) $("page-" + p).hidden = p !== tab;
    if (tab === "history") loadHistory();
    if (tab === "admin") { loadUsers(); renderShopAdmin(); }
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

  // ---------- ร้าน ----------
  async function loadShops() {
    const { data, error } = await sb.from("shops").select("pup_id,name,sort_order").order("sort_order").order("name");
    if (error) return;
    state.shops = data || [];
    const sel = $("shop-select");
    sel.innerHTML = '<option value="">— เลือกร้าน —</option>' +
      state.shops.map((s) => `<option value="${esc(s.pup_id)}">${esc(s.name)} · ${esc(s.pup_id)}</option>`).join("");
    renderChips();
  }

  function addPup(raw) {
    const p = String(raw || "").trim().toUpperCase();
    if (!p) return false;
    if (!/^[A-Z0-9]{5,40}$/.test(p)) {
      showMsg($("send-msg"), "error", "PUP ID ต้องเป็นตัวอักษรอังกฤษ/ตัวเลขเท่านั้น");
      return false;
    }
    if (!state.selected.includes(p)) state.selected.push(p);
    $("send-msg").hidden = true;
    renderChips();
    return true;
  }

  function renderChips() {
    $("pup-chips").innerHTML = state.selected.map((p) => {
      const n = shopName(p);
      return `<span class="chip">${n ? `<b>${esc(n)}</b> ` : ""}${esc(p)}
        <button type="button" data-pup="${esc(p)}" aria-label="ลบ">×</button></span>`;
    }).join("");
    $("pup-empty").hidden = state.selected.length > 0;
  }

  $("shop-select").addEventListener("change", (e) => { addPup(e.target.value); e.target.value = ""; });
  $("pup-add").addEventListener("click", () => { if (addPup($("pup-custom").value)) $("pup-custom").value = ""; });
  $("pup-custom").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); $("pup-add").click(); }
  });
  $("pup-chips").addEventListener("click", (e) => {
    const p = e.target.dataset && e.target.dataset.pup;
    if (!p || $("send-btn").disabled) return;
    state.selected = state.selected.filter((x) => x !== p);
    renderChips();
  });

  // Driver ID: ตัวเลขเท่านั้น
  $("driver-id").addEventListener("input", (e) => {
    const v = e.target.value.replace(/\D/g, "");
    if (v !== e.target.value) e.target.value = v;
  });

  // ---------- ส่งงาน ----------
  const sendBtn = $("send-btn");
  function lockForm(locked) {
    sendBtn.disabled = locked;
    for (const id of ["shop-select", "pup-custom", "pup-add", "driver-id"]) $(id).disabled = locked;
  }

  sendBtn.addEventListener("click", async () => {
    if (sendBtn.disabled) return;
    const msg = $("send-msg");
    // ถ้ากรอก PUP ค้างไว้แต่ยังไม่กดเพิ่ม ให้เพิ่มให้เลย
    if ($("pup-custom").value.trim()) { if (!addPup($("pup-custom").value)) return; $("pup-custom").value = ""; }
    const driver = $("driver-id").value.trim();
    if (!state.selected.length) return showMsg(msg, "error", "กรุณาเลือกหรือกรอก PUP อย่างน้อย 1 ร้าน");
    if (!/^\d+$/.test(driver)) return showMsg(msg, "error", "กรุณากรอก Driver ID เป็นตัวเลข");

    // ล็อกทันที กันกดซ้ำ
    lockForm(true);
    sendBtn.textContent = "กำลังส่ง…";
    msg.hidden = true;

    // บันทึกงานลง Supabase ตรงๆ (ไม่ใช้อีเมลแล้ว) — Bot Book ดึงงาน pending ไปบุ๊คใน SPX
    const { data: r, error } = await sb.rpc("submit_job", { p_pup_ids: state.selected, p_driver_id: driver });

    if (!error && r && !r.duplicate) {
      sendBtn.textContent = "ส่งแล้ว ✅";
      sendBtn.classList.add("done");
      showMsg(msg, "ok", `ส่งงานเรียบร้อย รอ Bot บุ๊คให้ · ${esc(r.sent_at || "")}`);
      $("send-new").hidden = false;
    } else if (!error && r && r.duplicate) {
      sendBtn.textContent = "งานนี้ส่งไปแล้ว";
      showMsg(msg, "warn", `<b>งานนี้ส่งไปแล้ว</b> เมื่อ ${esc(r.sent_at || "")} (ภายใน 10 นาที) ระบบไม่ส่งซ้ำ`);
      $("send-new").hidden = false;
    } else {
      lockForm(false);
      sendBtn.textContent = "ส่งงาน";
      const m = (error && error.message) || "";
      const auth = error && (error.code === "42501" || /JWT|permission/i.test(m));
      const err = error && error.code === "22023" ? m
        : auth ? "เซสชันหมดอายุหรือไม่มีสิทธิ์ กรุณาเข้าสู่ระบบใหม่"
        : "ส่งไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
      showMsg(msg, "error", esc(err));
      if (auth) setTimeout(() => sb.auth.signOut(), 1500);
    }
  });

  $("send-new").addEventListener("click", () => {
    state.selected = [];
    $("driver-id").value = "";
    $("pup-custom").value = "";
    renderChips();
    lockForm(false);
    sendBtn.textContent = "ส่งงาน";
    sendBtn.classList.remove("done");
    $("send-msg").hidden = true;
    $("send-new").hidden = true;
  });

  // ---------- Autocomplete ร้าน (ชื่อร้าน / PUP ID / ที่อยู่) ----------
  state.dir = [];
  async function loadDirectory() {
    const { data, error } = await sb.from("pup_directory").select("pup_id,shop_name,address").order("pup_id").limit(5000);
    if (error) return;
    const map = new Map((data || []).map((d) => [d.pup_id, { pup: d.pup_id, name: d.shop_name || "", addr: d.address || "", nick: "" }]));
    for (const s of state.shops) {
      const e = map.get(s.pup_id) || { pup: s.pup_id, name: "", addr: "", nick: "" };
      e.nick = s.name; map.set(s.pup_id, e);
    }
    state.dir = [...map.values()].map((e) => ({ ...e, hay: (e.pup + " " + e.nick + " " + e.name + " " + e.addr).toLowerCase() }));
  }
  const acBox = document.createElement("div");
  acBox.className = "ac-box"; acBox.hidden = true; acBox.setAttribute("role", "listbox");
  document.body.appendChild(acBox);
  let acInput = null, acItems = [], acIdx = -1;
  function acSearch(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const res = [];
    for (const e of state.dir) {
      if (!terms.every((t) => e.hay.includes(t))) continue;
      const t0 = terms[0], lp = e.pup.toLowerCase();
      const score = lp === t0 ? 0 : lp.startsWith(t0) ? 1 : (e.nick.toLowerCase().startsWith(t0) || e.name.toLowerCase().startsWith(t0)) ? 2
        : (e.nick + " " + e.name).toLowerCase().includes(t0) ? 3 : lp.includes(t0) ? 4 : 5;
      res.push([score, e]);
    }
    return res.sort((x, y) => x[0] - y[0] || (y[1].nick ? 1 : 0) - (x[1].nick ? 1 : 0)).slice(0, 8).map((x) => x[1]);
  }
  function acClose() { acBox.hidden = true; acItems = []; acIdx = -1; }
  function acPosition() {
    if (!acInput) return;
    const r = acInput.getBoundingClientRect();
    acBox.style.left = (r.left + window.scrollX) + "px";
    acBox.style.top = (r.bottom + window.scrollY + 4) + "px";
    acBox.style.width = r.width + "px";
  }
  function acRender() {
    if (!acItems.length) return acClose();
    acBox.innerHTML = acItems.map((e, i) => `
      <div class="ac-item${i === acIdx ? " active" : ""}" role="option" data-i="${i}">
        <div class="ac-name">${e.nick ? `<b>${esc(e.nick)}</b> ` : ""}${esc(e.name || (e.nick ? "" : "(ไม่มีชื่อร้าน)"))}</div>
        <div class="ac-pup">${esc(e.pup)}</div>
        ${e.addr ? `<div class="ac-addr">${esc(e.addr)}</div>` : ""}
      </div>`).join("");
    acPosition(); acBox.hidden = false;
  }
  function acPick(i) {
    const e = acItems[i], inp = acInput;
    if (!e || !inp) return;
    inp.value = e.pup;
    acClose();
    if (inp.id === "pup-custom") { if (addPup(e.pup)) inp.value = ""; }
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  }
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains("js-pup-ac")) return;
    acInput = t; acIdx = -1;
    acItems = t.value.trim().length >= 2 ? acSearch(t.value.trim()) : [];
    acRender();
  });
  document.addEventListener("keydown", (e) => {
    if (acBox.hidden || e.target !== acInput) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      acIdx = (acIdx + (e.key === "ArrowDown" ? 1 : -1) + acItems.length) % acItems.length;
      acRender();
    } else if (e.key === "Enter" && acIdx >= 0) { e.preventDefault(); e.stopImmediatePropagation(); acPick(acIdx); }
    else if (e.key === "Escape") acClose();
  }, true);
  acBox.addEventListener("pointerdown", (e) => {
    const it = e.target.closest(".ac-item");
    if (!it) return;
    e.preventDefault();
    acPick(+it.dataset.i);
  });
  document.addEventListener("focusout", (e) => { if (e.target === acInput) setTimeout(acClose, 150); });
  window.addEventListener("resize", acPosition);

  // ---------- เปลี่ยนคนขับ ----------
  const PUP_RE = /^PUP[A-Z0-9]{3,37}$/;
  document.addEventListener("input", (e) => {
    if (e.target.classList && e.target.classList.contains("js-digits")) {
      const v = e.target.value.replace(/\D/g, "");
      if (v !== e.target.value) e.target.value = v;
    }
  });

  function rpcError(error) {
    const m = (error && error.message) || "";
    const auth = error && (error.code === "42501" || /JWT|permission/i.test(m));
    if (auth) setTimeout(() => sb.auth.signOut(), 1500);
    return error && error.code === "22023" ? m
      : auth ? "เซสชันหมดอายุหรือไม่มีสิทธิ์ กรุณาเข้าสู่ระบบใหม่"
      : "ส่งไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
  }
  function resultMsg(msg, r, error) {
    if (error) return showMsg(msg, "error", esc(rpcError(error))), false;
    if (r && r.duplicate) return showMsg(msg, "warn", `<b>งานนี้ส่งไปแล้ว</b> เมื่อ ${esc(r.sent_at || "")} (ภายใน 10 นาที) ระบบไม่ส่งซ้ำ`), true;
    showMsg(msg, "ok", `ส่งงานเรียบร้อย รอ Bot ดำเนินการ · ${esc((r && r.sent_at) || "")}`);
    return true;
  }
  async function busy(btn, fn) {
    if (btn.disabled) return;
    const t = btn.textContent;
    btn.disabled = true; btn.textContent = "กำลังส่ง…";
    try { await fn(); } finally { btn.disabled = false; btn.textContent = t; }
  }

  $("ra-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = $("ra-msg");
    const pup = $("ra-pup").value.trim().toUpperCase();
    const drv = $("ra-driver").value.trim();
    if (!PUP_RE.test(pup)) return showMsg(msg, "error", "PUP ID ต้องขึ้นต้นด้วย PUP ตามด้วยตัวอักษรอังกฤษ/ตัวเลข");
    if (!/^\d+$/.test(drv)) return showMsg(msg, "error", "กรุณากรอก Driver ID ใหม่เป็นตัวเลข");
    busy($("ra-btn"), async () => {
      const { data: r, error } = await sb.rpc("submit_reassign", { p_pup_id: pup, p_new_driver_id: drv });
      if (resultMsg(msg, r, error) && !error && !r.duplicate) e.target.reset();
    });
  });

  function addPupField(value = "") {
    const row = document.createElement("div");
    row.className = "row pup-row";
    row.innerHTML = `<input type="text" class="mra-pup js-pup-ac" placeholder="PUP202610200RPM7" autocapitalize="characters" autocomplete="off" spellcheck="false">
      <button type="button" class="btn small danger mra-del" aria-label="ลบช่อง">ลบ</button>`;
    row.querySelector("input").value = value;
    $("mra-pups").appendChild(row);
    syncDel();
    return row.querySelector("input");
  }
  function syncDel() {
    const rows = $("mra-pups").querySelectorAll(".pup-row");
    rows.forEach((r) => { r.querySelector(".mra-del").hidden = rows.length <= 1; });
  }
  function resetMass() {
    $("mra-pups").innerHTML = "";
    addPupField();
  }
  resetMass();
  $("mra-add").addEventListener("click", () => {
    if ($("mra-pups").children.length >= 30) return showMsg($("mra-msg"), "error", "กรอก PUP ได้ไม่เกิน 30 ร้านต่อครั้ง");
    addPupField().focus();
  });
  $("mra-pups").addEventListener("click", (e) => {
    if (!e.target.classList.contains("mra-del")) return;
    e.target.closest(".pup-row").remove();
    syncDel();
  });
  $("mra-pups").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("mra-pup")) { e.preventDefault(); $("mra-add").click(); }
  });

  $("mra-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = $("mra-msg");
    const cur = $("mra-current").value.trim();
    const tgt = $("mra-target").value.trim();
    const pups = [...new Set([...document.querySelectorAll(".mra-pup")].map((i) => i.value.trim().toUpperCase()).filter(Boolean))];
    if (!/^\d+$/.test(cur)) return showMsg(msg, "error", "กรุณากรอก Driver ID ปัจจุบันเป็นตัวเลข");
    if (!pups.length) return showMsg(msg, "error", "กรุณากรอก PUP ID อย่างน้อย 1 ร้าน");
    const bad = pups.find((p) => !PUP_RE.test(p));
    if (bad) return showMsg(msg, "error", `PUP ID ไม่ถูกต้อง: ${esc(bad)} (ต้องขึ้นต้นด้วย PUP)`);
    if (pups.length > 30) return showMsg(msg, "error", "กรอก PUP ได้ไม่เกิน 30 ร้านต่อครั้ง");
    if (!/^\d+$/.test(tgt)) return showMsg(msg, "error", "กรุณากรอก Driver ID ปลายทางเป็นตัวเลข");
    if (cur === tgt) return showMsg(msg, "error", "Driver ID ปัจจุบันและปลายทางต้องไม่ซ้ำกัน");
    busy($("mra-btn"), async () => {
      const { data: r, error } = await sb.rpc("submit_mass_reassign", { p_current_driver_id: cur, p_pup_ids: pups, p_target_driver_id: tgt });
      if (resultMsg(msg, r, error) && !error && !r.duplicate) { e.target.reset(); resetMass(); }
    });
  });

  // ---------- Disable ----------
  const disModal = $("dis-modal"), disInput = $("dis-confirm-input"), disOk = $("dis-ok");
  let disDriver = "";
  function closeDis() { disModal.hidden = true; document.body.classList.remove("modal-open"); }
  $("dis-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const drv = $("dis-driver").value.trim();
    if (!/^\d+$/.test(drv)) return showMsg($("dis-msg"), "error", "กรุณากรอก Driver ID เป็นตัวเลข");
    $("dis-msg").hidden = true;
    disDriver = drv;
    $("dis-title").textContent = `ยืนยัน Disable งาน Accepted ทั้งหมดของ Driver ${drv}?`;
    $("dis-show").textContent = drv;
    disInput.value = "";
    disOk.disabled = true;
    disModal.hidden = false;
    document.body.classList.add("modal-open");
    disInput.focus();
  });
  disInput.addEventListener("input", () => { disOk.disabled = disInput.value.trim() !== disDriver; });
  $("dis-cancel").addEventListener("click", closeDis);
  disModal.addEventListener("click", (e) => { if (e.target === disModal) closeDis(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !disModal.hidden) closeDis(); });
  disOk.addEventListener("click", async () => {
    if (disOk.disabled || disInput.value.trim() !== disDriver) return;
    disOk.disabled = true;
    disOk.textContent = "กำลังส่ง…";
    const { data: r, error } = await sb.rpc("submit_disable", { p_driver_id: disDriver });
    disOk.textContent = "ยืนยัน Disable";
    closeDis();
    if (resultMsg($("dis-msg"), r, error) && !error && !r.duplicate) $("dis-form").reset();
  });

  // ---------- ประวัติวันนี้ ----------
  async function loadHistory() {
    const list = $("history-list");
    list.innerHTML = '<p class="muted">กำลังโหลด…</p>';
    const { data, error } = await sb.from("jobs")
      .select("id,pup_ids,shop_names,driver_id,sender_email,created_at,status,note,error,job_type,payload")
      .gte("created_at", todayStartIso())
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { list.innerHTML = '<p class="msg error">โหลดประวัติไม่สำเร็จ</p>'; return; }
    $("history-count").textContent = data.length;
    if (!data.length) { list.innerHTML = '<p class="muted">วันนี้ยังไม่มีงาน</p>'; return; }
    const typeLabel = { book: "บุ๊คงาน", reassign: "เปลี่ยนคนขับ", mass_reassign: "Mass re-assign", disable: "Disable" };
    const driverLine = (j) => {
      const p = j.payload || {};
      if (j.job_type === "mass_reassign") return `<span>Driver <b>${esc(p.current_driver_id || "?")}</b> → <b>${esc(p.target_driver_id || j.driver_id)}</b></span>`;
      if (j.job_type === "disable") return `<span>Disable Driver <b>${esc(p.driver_id || j.driver_id)}</b></span>`;
      if (j.job_type === "reassign") return `<span>Driver ใหม่ <b>${esc(p.new_driver_id || j.driver_id)}</b></span>`;
      return `<span>Driver <b>${esc(j.driver_id)}</b></span>`;
    };
    const label = { pending: "รอบุ๊ค", processing: "กำลังบุ๊ค", done: "บุ๊คแล้ว", failed: "บุ๊คไม่สำเร็จ", sent: "ส่งแล้ว", test: "ทดสอบ" };
    list.innerHTML = data.map((j) => `
      <div class="card job">
        <div class="job-top">
          <span class="time">${esc(bkkTime(j.created_at))}</span>
          <span class="type-tag ${esc(j.job_type || "book")}">${esc(typeLabel[j.job_type] || "บุ๊คงาน")}</span>
          <span class="badge ${esc(j.status)}">${esc(label[j.status] || j.status)}</span>
        </div>
        <div class="job-shops">${esc((j.shop_names || []).join(", "))}</div>
        <div class="muted small">${esc(j.pup_ids.join(", "))}</div>
        <div class="job-meta">${driverLine(j)}<span class="muted small">${esc(j.sender_email)}</span></div>
        ${(j.note || j.error) ? `<div class="muted small">${esc(j.error || j.note)}</div>` : ""}
      </div>`).join("");
  }
  $("history-refresh").addEventListener("click", loadHistory);

  // ---------- Admin: ผู้ใช้ ----------
  async function loadUsers() {
    const { data, error } = await sb.from("allowed_emails").select("email,name,is_admin").order("email");
    const list = $("user-list");
    if (error) { list.innerHTML = '<p class="msg error">โหลดรายชื่อไม่สำเร็จ</p>'; return; }
    list.innerHTML = data.map((u) => `
      <div class="list-row">
        <div class="grow">
          <div><b>${esc(u.name || "-")}</b> ${u.is_admin ? '<span class="badge sent">Admin</span>' : ""}</div>
          <div class="muted small">${esc(u.email)}</div>
        </div>
        ${u.email === state.email ? '<span class="muted small">(คุณ)</span>' : `
          <button class="btn small" data-act="toggle" data-email="${esc(u.email)}" data-admin="${u.is_admin}">${u.is_admin ? "ถอด Admin" : "ตั้ง Admin"}</button>
          <button class="btn small danger" data-act="del" data-email="${esc(u.email)}">ลบ</button>`}
      </div>`).join("");
  }

  $("user-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("user-email").value.trim().toLowerCase();
    const msg = $("user-msg");
    if (!/^\S+@\S+\.\S+$/.test(email)) return showMsg(msg, "error", "อีเมลไม่ถูกต้อง");
    const { error } = await sb.from("allowed_emails").upsert({
      email, name: $("user-name").value.trim() || null, is_admin: $("user-admin").checked,
    });
    if (error) return showMsg(msg, "error", "เพิ่มไม่สำเร็จ: " + esc(error.message));
    showMsg(msg, "ok", `เพิ่ม ${esc(email)} แล้ว — ต่อไปสร้างผู้ใช้ใน Supabase พร้อมรหัสผ่าน (ติ๊ก Auto Confirm User)`);
    e.target.reset();
    loadUsers();
  });

  $("user-list").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const email = b.dataset.email;
    const msg = $("user-msg");
    let error;
    if (b.dataset.act === "del") {
      if (!confirm(`ลบ ${email} ออกจากผู้ใช้ที่อนุญาต?`)) return;
      ({ error } = await sb.from("allowed_emails").delete().eq("email", email));
    } else {
      ({ error } = await sb.from("allowed_emails").update({ is_admin: b.dataset.admin !== "true" }).eq("email", email));
    }
    if (error) showMsg(msg, "error", esc(error.message));
    else msg.hidden = true;
    loadUsers();
  });

  // ---------- Admin: ร้าน ----------
  function renderShopAdmin() {
    $("shop-list").innerHTML = state.shops.map((s) => `
      <div class="list-row">
        <div class="grow"><b>${esc(s.name)}</b><div class="muted small">${esc(s.pup_id)}</div></div>
        <button class="btn small" data-act="edit" data-pup="${esc(s.pup_id)}">แก้</button>
        <button class="btn small danger" data-act="del" data-pup="${esc(s.pup_id)}">ลบ</button>
      </div>`).join("");
  }

  $("shop-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("shop-name").value.trim();
    const pup = $("shop-pup").value.trim().toUpperCase();
    const msg = $("shop-msg");
    if (!name || !/^[A-Z0-9]{5,40}$/.test(pup)) return showMsg(msg, "error", "กรอกชื่อร้าน และ PUP ID (อังกฤษ/ตัวเลข)");
    const existing = state.shops.find((s) => s.pup_id === pup);
    const sort = existing ? existing.sort_order : (Math.max(0, ...state.shops.map((s) => s.sort_order)) + 1);
    const { error } = await sb.from("shops").upsert({ pup_id: pup, name, sort_order: sort });
    if (error) return showMsg(msg, "error", "บันทึกไม่สำเร็จ: " + esc(error.message));
    showMsg(msg, "ok", existing ? `แก้ไข ${esc(name)} แล้ว` : `เพิ่ม ${esc(name)} แล้ว`);
    e.target.reset();
    await loadShops();
    renderShopAdmin();
  });

  $("shop-list").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const s = state.shops.find((x) => x.pup_id === b.dataset.pup);
    if (!s) return;
    if (b.dataset.act === "edit") {
      $("shop-name").value = s.name;
      $("shop-pup").value = s.pup_id;
      $("shop-name").focus();
      return;
    }
    if (!confirm(`ลบร้าน ${s.name} (${s.pup_id})?`)) return;
    const { error } = await sb.from("shops").delete().eq("pup_id", s.pup_id);
    if (error) showMsg($("shop-msg"), "error", esc(error.message));
    await loadShops();
    renderShopAdmin();
  });

  // ---------- เริ่ม ----------
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR-PROJECT")) {
    showView("login");
    showMsg($("login-msg"), "error", "ยังไม่ได้ใส่ค่า Supabase ในไฟล์ config.js");
  }
})();
