/* ============================================================
   auth.js — 회원가입 / 로그인 / 세션 관리
   ============================================================ */

const SESSION_KEY = 'bookswap_session';
let currentUser   = null;

// ── 세션 ──────────────────────────────────────────────────
function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveSession(user) {
  currentUser = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}
function clearSession() {
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
}
function isLoggedIn() { return !!currentUser; }

// ── UI 전환 ──────────────────────────────────────────────
function switchToSignup() {
  document.getElementById('loginForm').style.display  = 'none';
  document.getElementById('signupForm').style.display = 'block';
  clearAuthErrors();
  resetSignupState();
}
function switchToLogin() {
  document.getElementById('signupForm').style.display = 'none';
  document.getElementById('loginForm').style.display  = 'block';
  clearAuthErrors();
}
function clearAuthErrors() {
  document.getElementById('loginError').style.display  = 'none';
  document.getElementById('signupError').style.display = 'none';
}
function showLoginError(msg)  { const el = document.getElementById('loginError');  el.textContent = msg; el.style.display = 'block'; }
function showSignupError(msg) { const el = document.getElementById('signupError'); el.textContent = msg; el.style.display = 'block'; }

function resetSignupState() {
  ['signupEmail','signupNickname','signupPassword','signupPasswordConfirm']
    .forEach(id => { document.getElementById(id).value = ''; });
  const verifyGroup = document.getElementById('verificationGroup');
  if (verifyGroup) verifyGroup.style.display = 'none';
  const verifyStatus = document.getElementById('verifyStatus');
  if (verifyStatus) {
    verifyStatus.textContent = '';
    verifyStatus.className   = 'verify-status';
  }
}

async function handleSignup() {
  clearAuthErrors();
  const email     = document.getElementById('signupEmail').value.trim();
  const nickname  = document.getElementById('signupNickname').value.trim();
  const pw        = document.getElementById('signupPassword').value;
  const pwConfirm = document.getElementById('signupPasswordConfirm').value;

  if (!isValidEmail(email))       { showSignupError('유효한 이메일을 입력해주세요.'); return; }
  if (!nickname)                  { showSignupError('닉네임을 입력해주세요.'); return; }
  if (nickname.length < 2)        { showSignupError('닉네임은 2자 이상이어야 합니다.'); return; }
  if (pw.length < 6)              { showSignupError('비밀번호는 6자 이상이어야 합니다.'); return; }
  if (pw !== pwConfirm)           { showSignupError('비밀번호가 일치하지 않습니다.'); return; }

  showLoading('회원가입 중...');
  try {
    const auth = firebase.auth();
    const userCredential = await auth.createUserWithEmailAndPassword(email, pw);
    const fbUser = userCredential.user;
    await fbUser.sendEmailVerification();

    const created = await apiPost('users', {
      id:             fbUser.uid,
      email,
      nickname,
      email_verified: false,
      created_at:     Date.now(),
    });

    saveSession({ id: created.id, email: created.email, nickname: created.nickname, isVerified: false });
    showToast('가입이 완료되었습니다! 이메일 인증 링크를 발송했습니다. 받은 편지함을 확인해주세요.', 'success', 10000);
    onLoginSuccess();
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      showSignupError('이미 가입된 이메일입니다.');
    } else if (error.code === 'auth/invalid-email') {
      showSignupError('유효한 이메일을 입력해주세요.');
    } else if (error.code === 'auth/weak-password') {
      showSignupError('비밀번호는 6자 이상이어야 합니다.');
    } else {
      showSignupError(`회원가입 실패: ${error.message}`);
    }
  } finally {
    hideLoading();
  }
}

async function handleLogin() {
  clearAuthErrors();
  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPassword').value;

  if (!isValidEmail(email)) { showLoginError('유효한 이메일을 입력해주세요.'); return; }
  if (!pw)                  { showLoginError('비밀번호를 입력해주세요.'); return; }

  showLoading('로그인 중...');
  try {
    const auth = firebase.auth();
    const userCredential = await auth.signInWithEmailAndPassword(email, pw);
    const fbUser = userCredential.user;
    if (!fbUser.emailVerified) {
      showLoginError('이메일 인증이 필요합니다. 받은 편지함의 링크를 확인해주세요.');
      return;
    }

    const res = await apiGet('users', { limit: 500 });
    let user = (res.data||[]).find(u => u.email === email);
    if (!user) {
      user = {
        id:             fbUser.uid,
        email:          fbUser.email,
        nickname:       fbUser.displayName || '사용자',
        email_verified: true,
        created_at:     Date.now(),
      };
      await apiPost('users', user);
    } else if (!user.email_verified) {
      await apiPatch('users', user.id, { email_verified: true });
      user.email_verified = true;
    }

    saveSession({ id: user.id, email: user.email, nickname: user.nickname, isVerified: true });
    showToast(`👋 환영합니다, ${user.nickname}님!`, 'success');
    onLoginSuccess();
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      showLoginError('존재하지 않는 계정입니다.');
    } else if (error.code === 'auth/wrong-password') {
      showLoginError('비밀번호가 올바르지 않습니다.');
    } else {
      showLoginError('로그인 중 오류가 발생했습니다.');
      console.error(error);
    }
  } finally {
    hideLoading();
  }
}

// ── 로그아웃 ──────────────────────────────────────────────
async function handleLogout() {
  try {
    await firebase.auth().signOut();
  } catch (error) {
    console.warn('Firebase sign out failed:', error);
  }
  clearSession();
  document.getElementById('navbar').style.display = 'none';
  showPage('auth');
  showToast('로그아웃 되었습니다.');
}

// ── 로그인 성공 후 처리 ───────────────────────────────────
function onLoginSuccess() {
  document.getElementById('navbar').style.display = 'flex';
  showPage('explore');
}

// ── 앱 초기화 시 세션 복원 ───────────────────────────────
function initAuth() {
  firebase.auth().onAuthStateChanged(async fbUser => {
    if (fbUser) {
      const res = await apiGet('users', { limit: 500 });
      let user = (res.data||[]).find(u => u.email === fbUser.email);
      if (!user) {
        user = {
          id:             fbUser.uid,
          email:          fbUser.email,
          nickname:       fbUser.displayName || '사용자',
          email_verified: fbUser.emailVerified,
          created_at:     Date.now(),
        };
        await apiPost('users', user);
      }
      currentUser = {
        id:         user.id,
        email:      user.email,
        nickname:   user.nickname,
        isVerified: fbUser.emailVerified,
      };
      saveSession(currentUser);
      document.getElementById('navbar').style.display = 'flex';
      showPage('explore');
    } else {
      clearSession();
      showPage('auth');
    }
  });
}
