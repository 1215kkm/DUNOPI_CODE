// 전역 오염 방지를 위한 IIFE
(function () {
  const root = document.querySelector('.dp-header-1');
  if (!root) return;

  const btn  = root.querySelector('.dp-menu-toggle');
  const gnb  = root.querySelector('.dp-gnb');

  // 모바일 메뉴 토글
  btn.addEventListener('click', function () {
    const open = gnb.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // 디버그용: 컴포넌트가 실제로 로드되었는지 확인
  if (window.console && console.log) {
    console.log('[dp-header-1] loaded');
  }
})();
