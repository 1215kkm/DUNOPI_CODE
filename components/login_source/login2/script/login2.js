(function () {
  const form = document.querySelector('.login-form');
  const emailInput = document.getElementById('login2-email');
  const passwordInput = document.getElementById('login2-password');
  const submitBtn = document.getElementById('login2-submit');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    let valid = true;

    if (!emailInput.value.trim()) {
      alert('이메일을 입력하세요.');
      emailInput.focus();
      valid = false;
    } else if (!emailRegex.test(emailInput.value.trim())) {
      alert('올바른 이메일 형식이 아닙니다.');
      emailInput.focus();
      valid = false;
    }

    if (valid && !passwordInput.value.trim()) {
      alert('비밀번호를 입력하세요.');
      passwordInput.focus();
      valid = false;
    }

    if (valid && passwordInput.value.length < 8) {
      alert('비밀번호는 8자 이상이어야 합니다.');
      passwordInput.focus();
      valid = false;
    }

    if (valid) {
      // 전송 or 서버통신
      alert('로그인 요청이 전송되었습니다.');
      // form.submit();
    }
  });
})();
