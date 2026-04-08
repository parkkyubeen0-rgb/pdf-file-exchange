/* ============================================================
   storage.js — Firebase Storage를 이용한 PDF 파일 저장소
   실제 PDF 바이너리(Blob)를 Firebase에 업로드하고 URL을 저장합니다.
   ============================================================ */

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBUdzULtKJAOedA-xNO-EsXlRyku6tvKUw",
  authDomain: "pdf-exchange-e348c.firebaseapp.com",
  projectId: "pdf-exchange-e348c",
  storageBucket: "pdf-exchange-e348c.firebasestorage.app",
  messagingSenderId: "1076188670149",
  appId: "1:1076188670149:web:e6c86c7c83c377828d68ac",
  measurementId: "G-ZH3765ZGJ6"
};

firebase.initializeApp(firebaseConfig);
const storage = firebase.storage();

const DB_NAME    = 'BookSwapFiles';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';   // key: bookId, value: { url, filename, size, type }

let _db = null;

/** IndexedDB 초기화 (앱 시작 시 1회 호출) */
function initStorage() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'bookId' });
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

/** PDF Blob 저장 (Firebase에 업로드)
 *  @param {string} bookId
 *  @param {File|Blob} blob
 *  @param {string} filename
 */
async function savePdfBlob(bookId, blob, filename) {
  const storageRef = storage.ref();
  const pdfRef = storageRef.child(`pdfs/${bookId}/${filename}`);
  await pdfRef.put(blob);
  const url = await pdfRef.getDownloadURL();

  // IndexedDB에 URL 저장 (로컬 캐시)
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      bookId,
      url,
      filename,
      size: blob.size,
      type: blob.type || 'application/pdf',
      savedAt: Date.now(),
    };
    const req = store.put(record);
    req.onsuccess = () => resolve(url);
    req.onerror   = () => reject(req.error);
  });
}

/** PDF Blob 읽기
 *  @param {string} bookId
 *  @returns {{ blob, filename, size } | null}
 */
async function getPdfBlob(bookId) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.get(bookId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

/** PDF 존재 여부 확인 */
async function hasPdfBlob(bookId) {
  const rec = await getPdfBlob(bookId);
  return !!rec;
}

/** PDF 삭제 */
async function deletePdfBlob(bookId) {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(bookId);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/** 브라우저에 저장된 모든 bookId 목록 */
async function listStoredBookIds() {
  const db = await initStorage();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

/** 실제 파일 다운로드 트리거 */
function triggerDownload(data, filename) {
  if (data.url) {
    // Firebase URL로 다운로드
    const a = document.createElement('a');
    a.href = data.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else if (data.blob) {
    // IndexedDB blob으로 다운로드 (하위 호환)
    const url = URL.createObjectURL(data.blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
