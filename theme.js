// Theme: color band + page title follow the active tab (no app logic here)
(function () {
  var titles = { send: "ส่งงาน", reassign: "เปลี่ยนคนขับ", history: "ประวัติวันนี้", admin: "Admin" };
  var colors = { send: "#ffe9a8", reassign: "#c5daf8", history: "#c5e8d0", admin: "#ffc4b8" };
  var meta = document.querySelector('meta[name="theme-color"]');
  function sync() {
    var t = document.querySelector(".tab.active");
    var k = (t && t.dataset.tab) || "send";
    document.body.dataset.tab = k;
    var h = document.getElementById("page-title");
    if (h) h.textContent = titles[k] || "";
    if (meta) meta.setAttribute("content", colors[k] || "#ffe9a8");
    document.querySelectorAll(".tab").forEach(function (b) { b.setAttribute("aria-selected", b.classList.contains("active") ? "true" : "false"); b.setAttribute("role", "tab"); });
  }
  var nav = document.querySelector(".tabs");
  if (nav) new MutationObserver(sync).observe(nav, { subtree: true, attributes: true, attributeFilter: ["class"] });
  sync();
})();
