// 전역 오염 없이, 여러 인스턴스 안전
(function(){
  "use strict";
  document.querySelectorAll('.c-header1').forEach(root=>{
    const btn = root.querySelector('.c-header1__toggle');
    const nav = root.querySelector('.c-header1__nav');
    if(!btn || !nav) return;
    btn.addEventListener('click', ()=>{
      const open = root.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });
})();
