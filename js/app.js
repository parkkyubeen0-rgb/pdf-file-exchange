/* ============================================================
   app.js — 앱 진입점 및 페이지 라우팅
   ============================================================ */

// ============================================================
// 페이지 전환
// ============================================================
function showPage(pageName) {
  // 모든 페이지 숨기기
  document.querySelectorAll('.page').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('active');
  });

  // 네비 링크 활성화 업데이트
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-page') === pageName);
  });

  const target = document.getElementById(`page-${pageName}`);
  if (!target) return;
  target.style.display = pageName === 'auth' ? 'flex' : 'block';
  target.classList.add('active');

  // 페이지별 데이터 로드
  switch (pageName) {
    case 'explore':  loadExploreBooks(); break;
    case 'library':  loadMyLibrary();    break;
    case 'exchange': loadExchangePage(); break;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// 앱 초기화
// ============================================================
async function initApp() {
  // IndexedDB 초기화
  try { await initStorage(); } catch (e) { console.warn('IndexedDB 초기화 실패:', e); }

  // 세션 확인 후 초기 페이지 결정
  initAuth();
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();

  // ── Enter 키 지원 ──
  document.getElementById('loginEmail').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginPassword').focus();
  });
  document.getElementById('loginPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('signupEmail').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendVerificationCode();
  });
  document.getElementById('verificationCode').addEventListener('keydown', e => {
    if (e.key === 'Enter') verifyCode();
  });
  document.getElementById('signupPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('signupPasswordConfirm').focus();
  });
  document.getElementById('signupPasswordConfirm').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSignup();
  });

  // ── ESC 키로 모달 닫기 ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeBookModal();
      closeExchangePickModal();
    }
  });
});
