(function () {
  const form = document.querySelector('.login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const submitBtn = document.getElementById('login-submit');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const formError = document.getElementById('form-error');

  // 간단한 이메일 정규식 (실무에서는 서버 검증 병행)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MIN_PW = Math.max(8, parseInt(passwordInput.getAttribute('minlength') || '0', 10));

  function setError(inputEl, msgEl, message) {
    if (message) {
      inputEl.classList.add('is-invalid');
      msgEl.textContent = message;
      inputEl.setAttribute('aria-invalid', 'true');
    } else {
      inputEl.classList.remove('is-invalid');
      msgEl.textContent = '';
      inputEl.removeAttribute('aria-invalid');
    }
  }

  function validateEmail() {
    const v = emailInput.value.trim();
    emailInput.value = v; // 공백 정리
    if (!v) return setError(emailInput, emailError, '이메일을 입력해 주세요.');
    if (!emailRegex.test(v)) return setError(emailInput, emailError, '올바른 이메일 형식이 아닙니다.');
    return setError(emailInput, emailError, '');
  }

  function validatePassword() {
    const v = passwordInput.value.trim();
    if (!v) return setError(passwordInput, passwordError, '비밀번호를 입력해 주세요.');
    if (v.length < MIN_PW) return setError(passwordInput, passwordError, `비밀번호는 ${MIN_PW}자 이상이어야 합니다.`);
    return setError(passwordInput, passwordError, '');
  }

  // 실시간 검증
  emailInput.addEventListener('input', validateEmail);
  passwordInput.addEventListener('input', validatePassword);

  // 제출 시 검증
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formError.textContent = '';

    const okEmail = !validateEmail();   // setError는 메시지 세팅만, 반환값 사용 안함
    const okPass = !validatePassword();

    // 위에서 반환값을 쓰지 않았으니 실제 에러 상태를 다시 확인
    const hasEmailError = !!emailError.textContent;
    const hasPassError = !!passwordError.textContent;

    if (hasEmailError || hasPassError) {
      // 첫 에러 필드 포커스
      if (hasEmailError) emailInput.focus();
      else passwordInput.focus();
      return;
    }

    // (선택) 중복 클릭 방지
    submitBtn.disabled = true;

    // 여기서 실제 전송을 하시려면 fetch/axios 또는 form.submit() 사용
    // 예시: 성공/실패 가짜 처리
    setTimeout(() => {
      // 성공 가정
      alert('로그인 요청이 전송되었습니다.');
      submitBtn.disabled = false;
      // form.submit(); // 실제 폼 전송이 필요할 경우 활성화
    }, 400);
  });
})();
