/* ============================================================
   utils.js — 공통 유틸리티 함수
   ============================================================ */

// UUID 생성
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 토스트 알림
let toastTimer = null;
function showToast(msg, type = '', duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (type ? ` ${type}` : '');
  toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.display = 'none'; }, duration);
}

// 로딩 오버레이
function showLoading(text = '처리 중...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').style.display = 'flex';
}
function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

// 날짜 포맷
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(Number(ts));
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yy}.${mm}.${dd} ${hh}:${min}`;
}

// 파일 크기 포맷
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 책 썸네일 색상 팔레트
const COVER_COLORS = [
  'linear-gradient(135deg, #6c63ff 0%, #9b8dff 100%)',
  'linear-gradient(135deg, #ff6584 0%, #ff8fab 100%)',
  'linear-gradient(135deg, #43d9ad 0%, #0abf8d 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
  'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
  'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
  'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
];

function getCoverColor(colorCode) {
  if (!colorCode && colorCode !== 0) return COVER_COLORS[0];
  return COVER_COLORS[Number(colorCode) % COVER_COLORS.length];
}

function getRandomColorIndex() {
  return Math.floor(Math.random() * COVER_COLORS.length);
}

// 간단한 비밀번호 해시 (Base64 인코딩 - 실제 서비스에서는 서버측 bcrypt 사용)
function hashPassword(pw) {
  return btoa(unescape(encodeURIComponent(pw + '_bookswap_salt')));
}

// 이메일 유효성 검사
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 6자리 인증코드 생성
function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// API 헬퍼
const LOCAL_TABLE_PREFIX = 'bookswap_local_table_';
const USE_FIRESTORE = true;

function getLocalTableKey(table) {
  return `${LOCAL_TABLE_PREFIX}${table}`;
}

function readLocalTable(table) {
  try {
    const raw = localStorage.getItem(getLocalTableKey(table));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalTable(table, payload) {
  localStorage.setItem(getLocalTableKey(table), JSON.stringify(payload));
}

async function loadTableFromFile(table) {
  const res = await fetch(`tables/${table}`);
  if (!res.ok) return { data: [] };
  return res.json();
}

async function ensureLocalTable(table) {
  let data = readLocalTable(table);
  if (!data) {
    data = await loadTableFromFile(table);
    if (!data || !Array.isArray(data.data)) {
      data = { data: [] };
    }
    saveLocalTable(table, data);
  }
  return data;
}

function matchesParams(item, params) {
  return Object.keys(params).every(key => {
    if (key === 'limit') return true;
    return String(item[key]) === String(params[key]);
  });
}

function getFirestoreCollection(table) {
  if (!window.firebase || !firebase.firestore) {
    throw new Error('Firebase Firestore is not available.');
  }
  return firebase.firestore().collection(table);
}

async function apiGet(table, params = {}) {
  if (USE_FIRESTORE) {
    try {
      let collection = getFirestoreCollection(table);
      let query = collection;
      Object.keys(params).forEach(key => {
        if (key === 'limit') return;
        query = query.where(key, '==', params[key]);
      });
      if (params.limit) query = query.limit(Number(params.limit));
      const snapshot = await query.get();
      const rows = snapshot.docs.map(doc => doc.data());
      return { data: rows };
    } catch (e) {
      console.warn('Firestore GET failed, falling back to local storage:', e);
    }
  }

  const db = await ensureLocalTable(table);
  let rows = (db.data || []).slice();
  rows = rows.filter(item => matchesParams(item, params));
  const limit = Number(params.limit || rows.length);
  return { data: rows.slice(0, limit) };
}

async function apiPost(table, data) {
  if (USE_FIRESTORE) {
    try {
      const collection = getFirestoreCollection(table);
      const docId = data.id || firebase.firestore().collection(table).doc().id;
      await collection.doc(docId).set({ ...data, id: docId });
      return { ...data, id: docId };
    } catch (e) {
      console.warn('Firestore POST failed, falling back to local storage:', e);
    }
  }

  const db = await ensureLocalTable(table);
  const rows = db.data || [];
  rows.push(data);
  saveLocalTable(table, { data: rows });
  return data;
}

async function apiPatch(table, id, data) {
  if (USE_FIRESTORE) {
    try {
      const docRef = getFirestoreCollection(table).doc(id);
      await docRef.update(data);
      const doc = await docRef.get();
      return doc.data();
    } catch (e) {
      console.warn('Firestore PATCH failed, falling back to local storage:', e);
    }
  }

  const db = await ensureLocalTable(table);
  const rows = db.data || [];
  const index = rows.findIndex(item => item.id === id);
  if (index < 0) throw new Error(`Record not found: ${table}/${id}`);
  rows[index] = { ...rows[index], ...data };
  saveLocalTable(table, { data: rows });
  return rows[index];
}

async function apiDelete(table, id) {
  if (USE_FIRESTORE) {
    try {
      await getFirestoreCollection(table).doc(id).delete();
      return { success: true };
    } catch (e) {
      console.warn('Firestore DELETE failed, falling back to local storage:', e);
    }
  }

  const db = await ensureLocalTable(table);
  const rows = db.data || [];
  const filtered = rows.filter(item => item.id !== id);
  saveLocalTable(table, { data: filtered });
  return { success: true };
}

// 모달 오버레이 클릭 핸들러
function handleModalOverlayClick(event, modalId) {
  if (event.target.id === modalId) {
    if (modalId === 'bookModal') closeBookModal();
    else if (modalId === 'exchangePickModal') closeExchangePickModal();
  }
}

// 모바일 메뉴 토글
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('open');
}
function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.remove('open');
}
