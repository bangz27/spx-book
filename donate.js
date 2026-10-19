// ปุ่มอุดหนุนบอต (PromptPay QR)
(function () {
  var btn = document.getElementById('donate-btn');
  var modal = document.getElementById('donate-modal');
  var close = document.getElementById('donate-close');
  if (!btn || !modal) return;
  function open() { modal.hidden = false; document.body.classList.add('modal-open'); close && close.focus(); }
  function shut() { modal.hidden = true; document.body.classList.remove('modal-open'); btn.focus(); }
  btn.addEventListener('click', open);
  close && close.addEventListener('click', shut);
  modal.addEventListener('click', function (e) { if (e.target === modal) shut(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) shut(); });
})();
