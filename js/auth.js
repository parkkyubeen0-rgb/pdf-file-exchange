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

// ── 이메일 인증 코드 ─────────────────────────────────────
let _pendingCode    = null;   // 발송한 코드
let _verifiedEmail  = null;   // 인증 완료된 이메일

function resetSignupState() {
  _pendingCode   = null;
  _verifiedEmail = null;
  ['signupEmail','verificationCode','signupNickname','signupPassword','signupPasswordConfirm']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('verificationGroup').style.display = 'none';
  document.getElementById('verifyStatus').textContent = '';
  document.getElementById('verifyStatus').className   = 'verify-status';
}

async function sendVerificationCode() {
  const email = document.getElementById('signupEmail').value.trim();
  if (!isValidEmail(email)) { showToast('유효한 이메일을 입력해주세요.', 'error'); return; }

  showLoading('인증번호 확인 중...');
  try {
    // 중복 체크: __verify__ 레코드 제외하고 실제 회원만
    const res    = await apiGet('users', { limit: 500 });
    const exists = (res.data||[]).find(u => u.email === email);
    if (exists) { showSignupError('이미 가입된 이메일입니다.'); return; }

    _pendingCode   = generateVerificationCode();
    _verifiedEmail = null;

    document.getElementById('verificationGroup').style.display = 'block';
    document.getElementById('verifyStatus').textContent = '';
    document.getElementById('verifyStatus').className   = 'verify-status';

    // 실제 서비스라면 여기서 서버 API로 이메일 발송
    // 현재는 화면에 코드를 표시해 테스트할 수 있게 합니다.
    showToast(`📧 인증번호: ${_pendingCode}  (화면에 표시 — 실 서비스에서는 이메일 발송)`, 'success', 10000);
    console.info(`[BookSwap] 인증코드 [${email}]: ${_pendingCode}`);
  } catch {
    showToast('오류가 발생했습니다. 다시 시도해주세요.', 'error');
  } finally {
    hideLoading();
  }
}

function verifyCode() {
  const input    = document.getElementById('verificationCode').value.trim();
  const statusEl = document.getElementById('verifyStatus');
  if (!_pendingCode) { showToast('먼저 인증번호를 발송해주세요.', 'warning'); return; }

  if (input === _pendingCode) {
    _verifiedEmail = document.getElementById('signupEmail').value.trim();
    statusEl.textContent = '✓ 인증이 완료되었습니다!';
    statusEl.className   = 'verify-status success';
  } else {
    statusEl.textContent = '✗ 인증번호가 일치하지 않습니다.';
    statusEl.className   = 'verify-status error';
  }
}

// ── 회원가입 ─────────────────────────────────────────────
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
    // 최종 중복 확인
    const res    = await apiGet('users', { limit: 500 });
    const exists = (res.data||[]).find(u => u.email === email);
    if (exists) { showSignupError('이미 가입된 이메일입니다.'); return; }

    const created = await apiPost('users', {
      id:               generateUUID(),
      email,
      password_hash:    hashPassword(pw),
      nickname,
      email_verified:   true,
      verification_code:'',
    });

    saveSession({ id: created.id, email: created.email, nickname: created.nickname });
    showToast('🎉 회원가입 완료! 환영합니다.', 'success');
    onLoginSuccess();
  } catch {
    showSignupError('회원가입 중 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    hideLoading();
  }
}

// ── 로그인 ───────────────────────────────────────────────
async function handleLogin() {
  clearAuthErrors();
  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPassword').value;

  if (!isValidEmail(email)) { showLoginError('유효한 이메일을 입력해주세요.'); return; }
  if (!pw)                  { showLoginError('비밀번호를 입력해주세요.'); return; }

  showLoading('로그인 중...');
  try {
    const res  = await apiGet('users', { limit: 500 });
    const user = (res.data||[]).find(u => u.email === email);
    if (!user)                                       { showLoginError('존재하지 않는 계정입니다.'); return; }
    if (user.password_hash !== hashPassword(pw))     { showLoginError('비밀번호가 올바르지 않습니다.'); return; }

    saveSession({ id: user.id, email: user.email, nickname: user.nickname });
    showToast(`👋 환영합니다, ${user.nickname}님!`, 'success');
    onLoginSuccess();
  } catch {
    showLoginError('로그인 중 오류가 발생했습니다.');
  } finally {
    hideLoading();
  }
}

// ── 로그아웃 ──────────────────────────────────────────────
function handleLogout() {
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
  const session = getSession();
  if (session) {
    currentUser = session;
    document.getElementById('navbar').style.display = 'flex';
    showPage('explore');
  } else {
    showPage('auth');
  }
}
