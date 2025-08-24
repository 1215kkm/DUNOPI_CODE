(function(){
  "use strict";
  document.querySelectorAll('.c-header2').forEach(root=>{
    const btn = root.querySelector('.c-header2__toggle');
    const nav = root.querySelector('.c-header2__nav');
    if(!btn || !nav) return;
    btn.addEventListener('click', ()=>{
      const open = root.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });
})();
