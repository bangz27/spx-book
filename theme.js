// Theme: page title + Wallie chrome (no booking / RPC logic here)
(function () {
  var titles = { home: "หน้าหลัก", send: "ส่งงาน", reassign: "เปลี่ยนคนขับ", history: "ประวัติวันนี้", admin: "Admin" };
  var meta = document.querySelector('meta[name="theme-color"]');
  var GREEN = "#2DC86A";

  function sync() {
    var t = document.querySelector(".tab.active");
    var k = (t && t.dataset.tab) || "home";
    document.body.dataset.tab = k;
    var h = document.getElementById("page-title");
    if (h) h.textContent = titles[k] || "";
    var loginOpen = document.getElementById("view-login") && !document.getElementById("view-login").hidden;
    var deniedOpen = document.getElementById("view-denied") && !document.getElementById("view-denied").hidden;
    if (meta) meta.setAttribute("content", (loginOpen || deniedOpen) ? GREEN : "#F5F7F6");
    document.querySelectorAll(".tab").forEach(function (b) {
      b.setAttribute("aria-selected", b.classList.contains("active") ? "true" : "false");
      b.setAttribute("role", "tab");
    });
    var adminTab = document.getElementById("tab-admin");
    document.querySelectorAll(".feature-tile[data-nav='admin']").forEach(function (tile) {
      tile.hidden = !adminTab || adminTab.hidden;
    });
  }

  var nav = document.querySelector(".tabs");
  if (nav) new MutationObserver(sync).observe(nav, { subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
  ["view-login", "view-denied", "view-app", "view-loading"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ["hidden"] });
  });
  var adminTab = document.getElementById("tab-admin");
  if (adminTab) new MutationObserver(sync).observe(adminTab, { attributes: true, attributeFilter: ["hidden"] });

  document.querySelectorAll(".feature-tile[data-nav]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tab = btn.getAttribute("data-nav");
      var jump = btn.getAttribute("data-jump");
      var tabBtn = document.querySelector('.tab[data-tab="' + tab + '"]');
      if (tabBtn) tabBtn.click();
      if (jump) {
        setTimeout(function () {
          var target = document.querySelector(jump);
          if (target && target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      }
    });
  });

  var okModal = document.getElementById("ok-modal");
  if (okModal) {
    var okTitle = document.getElementById("ok-modal-title");
    var okBody = document.getElementById("ok-modal-body");
    var okClose = document.getElementById("ok-modal-ok");
    function hideOk() {
      okModal.hidden = true;
      if (document.getElementById("book-modal") && !document.getElementById("book-modal").hidden) return;
      if (document.getElementById("dis-modal") && !document.getElementById("dis-modal").hidden) return;
      if (document.getElementById("donate-modal") && !document.getElementById("donate-modal").hidden) return;
      document.body.classList.remove("modal-open");
    }
    if (okClose) okClose.addEventListener("click", hideOk);
    okModal.addEventListener("click", function (e) { if (e.target === okModal) hideOk(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !okModal.hidden) hideOk(); });
    ["send-msg", "ra-msg", "mra-msg", "dis-msg"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      new MutationObserver(function () {
        if (el.hidden || !el.classList.contains("ok")) return;
        if (okTitle) okTitle.textContent = "ส่งงานสำเร็จ";
        if (okBody) okBody.innerHTML = el.innerHTML || "";
        okModal.hidden = false;
        document.body.classList.add("modal-open");
      }).observe(el, { attributes: true, childList: true, attributeFilter: ["hidden", "class"] });
    });
  }

  sync();
})();
