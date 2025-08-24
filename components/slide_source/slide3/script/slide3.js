(function () {
  // 컨테이너가 페이지에 존재할 때만 초기화
  var el = document.querySelector('.c-slide3__swiper');
  if (!el) return;

  // Swiper 인스턴스
  var slide3Swiper = new Swiper(el, {
    loop: true,
    speed: 600,
    autoplay: { delay: 4000, disableOnInteraction: false },
    pagination: {
      el: '.c-slide3__pagination',
      clickable: true
    },
    navigation: {
      nextEl: '.c-slide3__nav--next',
      prevEl: '.c-slide3__nav--prev'
    },
    // 반응형
    breakpoints: {
      0:   { spaceBetween: 12 },
      900: { spaceBetween: 24 }
    }
  });

  // 접근성: 포커스 될 때 자동재생 일시정지
  el.addEventListener('focusin', function(){ slide3Swiper.autoplay.stop(); });
  el.addEventListener('focusout', function(){ slide3Swiper.autoplay.start(); });
})();
