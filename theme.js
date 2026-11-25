// Theme: page title + theme-color (no booking / write-RPC logic here)
(function () {
  var titles = { send: "ส่งงาน", reassign: "เปลี่ยนคนขับ", history: "ประวัติวันนี้", admin: "Admin" };
  var meta = document.querySelector('meta[name="theme-color"]');
  var BG = "#FFF4F2";
  function sync() {
    var t = document.querySelector(".tab.active");
    var k = (t && t.dataset.tab) || "send";
    document.body.dataset.tab = k;
    var h = document.getElementById("page-title");
    if (h) h.textContent = titles[k] || "";
    if (meta) meta.setAttribute("content", BG);
    document.querySelectorAll(".tab").forEach(function (b) {
      b.setAttribute("aria-selected", b.classList.contains("active") ? "true" : "false");
      b.setAttribute("role", "tab");
    });
  }
  var nav = document.querySelector(".tabs");
  if (nav) new MutationObserver(sync).observe(nav, { subtree: true, attributes: true, attributeFilter: ["class"] });
  sync();
})();
