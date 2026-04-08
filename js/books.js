/* ============================================================
   books.js — 도서 탐색 / 상세 / 내 책장 / PDF 등록 + 실제 다운로드
   ============================================================ */

let _allBooks          = [];   // 전체 책 캐시
let _myBooks           = [];   // 내 책 캐시
let _filterMode        = 'all';
let _currentDetailBook = null;
let _selectedPdfFile   = null; // 업로드할 File 객체

// ============================================================
// 유틸
// ============================================================
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// 카드 HTML 생성
// ============================================================
function renderBookCard(book, options = {}) {
  const isMine  = currentUser && book.owner_email === currentUser.email;
  const color   = getCoverColor(book.thumbnail_color);
  const handler = options.clickHandler || `openBookDetail('${book.id}')`;

  return `
    <div class="book-card" onclick="${handler}" style="animation-delay:${options.delay||0}ms">
      <div class="book-cover" style="background:${color};">
        <i class="fas fa-file-pdf book-cover-icon"></i>
        <span class="book-cover-title">${escHtml(book.title)}</span>
        ${isMine && options.showMine
          ? `<span class="book-badge badge-mine"><i class="fas fa-user"></i> 내 책</span>`
          : ''}
        ${options.exchangeBadge
          ? `<span class="book-badge badge-exchange"><i class="fas fa-unlock"></i> 획득</span>`
          : ''}
      </div>
      <div class="book-info">
        <p class="book-title">${escHtml(book.title)}</p>
        <p class="book-author"><i class="fas fa-user-circle"></i> ${escHtml(book.owner_nickname||'알 수 없음')}</p>
      </div>
    </div>`;
}

// ============================================================
// 탐색 페이지 (Explore)
// ============================================================
async function loadExploreBooks() {
  const grid = document.getElementById('bookGrid');
  grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</div>';
  document.getElementById('noBooks').style.display = 'none';

  try {
    const res  = await apiGet('books', { limit: 500 });
    _allBooks  = (res.data || []).filter(b => b.status === 'ACTIVE');
    renderExploreGrid();
  } catch {
    grid.innerHTML = '<div class="loading-spinner">❌ 불러오기 실패. 새로고침 해주세요.</div>';
  }
}

function renderExploreGrid() {
  const grid    = document.getElementById('bookGrid');
  const keyword = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  let books     = _allBooks;

  if (_filterMode === 'available') {
    books = books.filter(b => b.owner_email !== currentUser?.email);
  }
  if (keyword) {
    books = books.filter(b =>
      b.title.toLowerCase().includes(keyword) ||
      (b.owner_nickname||'').toLowerCase().includes(keyword)
    );
  }

  if (books.length === 0) {
    grid.innerHTML = '';
    document.getElementById('noBooks').style.display = 'block';
    return;
  }
  document.getElementById('noBooks').style.display = 'none';
  grid.innerHTML = books.map((b, i) =>
    renderBookCard(b, { showMine: true, delay: i * 40 })
  ).join('');
}

function filterBooks()             { renderExploreGrid(); }
function goBackToExplore()         { showPage('explore'); }
function setFilter(mode, btn) {
  _filterMode = mode;
  document.querySelectorAll('.badge-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderExploreGrid();
}

// ============================================================
// 책 상세 페이지
// ============================================================
async function openBookDetail(bookId) {
  showPage('detail');
  const content = document.getElementById('bookDetailContent');
  content.innerHTML = '<div class="loading-spinner" style="padding:80px 24px;"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</div>';

  try {
    let book = _allBooks.find(b => b.id === bookId);
    if (!book) {
      const r = await fetch(`tables/books/${bookId}`);
      book    = await r.json();
    }
    _currentDetailBook = book;
    await renderBookDetail(book);
  } catch {
    content.innerHTML = '<div class="empty-state"><p>책 정보를 불러올 수 없습니다.</p></div>';
  }
}

async function renderBookDetail(book) {
  const content = document.getElementById('bookDetailContent');
  const isMine  = currentUser && book.owner_email === currentUser.email;
  const color   = getCoverColor(book.thumbnail_color);

  // ── 권한 확인 ──
  let hasAccess = isMine;
  if (!hasAccess && currentUser) {
    try {
      const permRes = await apiGet('book_access_permissions', { limit: 500 });
      hasAccess = (permRes.data || []).some(
        p => p.user_email === currentUser.email && p.book_id === book.id
      );
    } catch { /* 무시 */ }
  }

  // ── 로컬 파일 존재 여부 ──
  const localExists = await hasPdfBlob(book.id).catch(() => false);

  content.innerHTML = `
    <div class="detail-layout">
      <div>
        <div class="detail-cover" style="background:${color};">
          <i class="fas fa-file-pdf" style="font-size:4rem;color:rgba(255,255,255,0.85);"></i>
          <span style="color:rgba(255,255,255,0.75);font-size:0.78rem;margin-top:8px;
                       text-align:center;padding:0 12px;line-height:1.4;">
            ${escHtml(book.title)}
          </span>
        </div>
      </div>

      <div class="detail-info">
        <h2>${escHtml(book.title)}</h2>
        <div class="detail-meta">
          <span><i class="fas fa-user-circle"></i> ${escHtml(book.owner_nickname||'알 수 없음')}</span>
          <span><i class="fas fa-file-pdf"></i> PDF</span>
          ${book.file_size ? `<span><i class="fas fa-weight"></i> ${formatFileSize(book.file_size)}</span>` : ''}
          <span><i class="fas fa-calendar"></i> ${formatDate(book.created_at)}</span>
        </div>

        <div class="detail-desc">
          ${escHtml(book.description) || '<em style="color:var(--text-muted)">소개글이 없습니다.</em>'}
        </div>

        <div class="detail-actions">
          ${buildDetailActionBtn(book, isMine, hasAccess, localExists)}
        </div>

        ${buildDetailNote(isMine, hasAccess, localExists, book)}
      </div>
    </div>`;
}

function buildDetailActionBtn(book, isMine, hasAccess, localExists) {
  if (isMine) {
    return `<button class="btn btn-ghost" disabled>
              <i class="fas fa-ban"></i> 본인 소유 책
            </button>`;
  }
  if (hasAccess) {
    if (localExists) {
      return `<button class="btn btn-success" onclick="downloadBook('${book.id}')">
                <i class="fas fa-download"></i> PDF 다운로드
              </button>`;
    } else {
      // 권한은 있지만 이 기기에 파일이 없는 경우
      return `<button class="btn btn-success" disabled>
                <i class="fas fa-info-circle"></i> 파일 없음 (등록자 기기에만 저장)
              </button>`;
    }
  }
  if (!isLoggedIn()) {
    return `<button class="btn btn-primary" onclick="showPage('auth')">
              <i class="fas fa-sign-in-alt"></i> 로그인 후 교환 요청
            </button>`;
  }
  return `<button class="btn btn-primary" onclick="openExchangePickModal('${book.id}')">
            <i class="fas fa-exchange-alt"></i> 교환 요청하기
          </button>`;
}

function buildDetailNote(isMine, hasAccess, localExists, book) {
  if (isMine) {
    const hasFile = localExists;
    return `<div class="detail-note note-mine">
              <p><i class="fas fa-user"></i> 내가 등록한 책입니다</p>
              ${hasFile
                ? `<p class="note-sub"><i class="fas fa-check-circle" style="color:var(--success)"></i>
                   이 기기에 PDF가 저장되어 있습니다.
                   <button class="btn btn-success btn-sm" style="margin-top:8px;"
                     onclick="downloadBook('${book.id}')">
                     <i class="fas fa-download"></i> 내 PDF 확인
                   </button></p>`
                : `<p class="note-sub" style="color:var(--text-muted);">
                   <i class="fas fa-exclamation-circle"></i>
                   이 기기에 PDF 파일이 없습니다. 파일은 업로드한 브라우저에 저장됩니다.</p>`}
            </div>`;
  }
  if (hasAccess && localExists) {
    return `<div class="detail-note note-success">
              <p><i class="fas fa-check-circle"></i> 교환 완료! PDF를 다운로드할 수 있습니다.</p>
              <p class="note-sub">파일명: ${escHtml(book.pdf_filename||book.title+'.pdf')}</p>
            </div>`;
  }
  if (hasAccess && !localExists) {
    return `<div class="detail-note note-warning">
              <p><i class="fas fa-exclamation-triangle"></i> 교환은 완료됐지만 파일이 이 기기에 없습니다.</p>
              <p class="note-sub">이 서비스는 파일을 업로드한 브라우저에 저장합니다.
              등록자와 같은 기기/브라우저에서 접근하면 다운로드할 수 있습니다.</p>
            </div>`;
  }
  return '';
}

/** 실제 PDF 다운로드 (Firebase URL 또는 IndexedDB → Blob URL) */
async function downloadBook(bookId) {
  try {
    let rec = await getPdfBlob(bookId);
    if (!rec || (!rec.url && !rec.blob)) {
      // IndexedDB에 없으면 books 테이블에서 pdf_url 가져와
      const booksRes = await apiGet('books', { id: bookId });
      const book = booksRes.data?.find(b => b.id === bookId);
      if (book && book.pdf_url) {
        rec = { url: book.pdf_url, filename: book.pdf_filename, size: book.file_size };
      } else {
        showToast('저장된 PDF 파일을 찾을 수 없습니다.', 'error');
        return;
      }
    }
    triggerDownload(rec, rec.filename || 'book.pdf');
    showToast(`📥 "${rec.filename}" 다운로드를 시작합니다.`, 'success');
  } catch (e) {
    showToast('다운로드 중 오류가 발생했습니다.', 'error');
    console.error(e);
  }
}

// ============================================================
// 내 책장 (Library)
// ============================================================
async function loadMyLibrary() {
  const grid = document.getElementById('myBookGrid');
  grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</div>';
  document.getElementById('noMyBooks').style.display = 'none';

  try {
    if (!currentUser) return;
    const res = await apiGet('books', { limit: 500 });
    _myBooks  = (res.data||[]).filter(b => b.owner_email === currentUser.email && b.status === 'ACTIVE');
    await renderMyBookGrid();
    await loadAccessedBooks();
  } catch {
    grid.innerHTML = '<div class="loading-spinner">❌ 불러오기 실패.</div>';
  }
}

async function renderMyBookGrid() {
  const grid     = document.getElementById('myBookGrid');
  const subtitle = document.getElementById('librarySubtitle');
  subtitle.textContent = `총 ${_myBooks.length}권 등록`;

  if (_myBooks.length === 0) {
    grid.innerHTML = '';
    document.getElementById('noMyBooks').style.display = 'block';
    return;
  }
  document.getElementById('noMyBooks').style.display = 'none';

  // 로컬에 파일이 있는지 각 책마다 확인
  const localFlags = await Promise.all(
    _myBooks.map(b => hasPdfBlob(b.id).catch(() => false))
  );

  grid.innerHTML = _myBooks.map((b, i) => {
    const hasLocal = localFlags[i];
    return `
      <div class="book-card" style="animation-delay:${i*40}ms">
        <div class="book-cover" style="background:${getCoverColor(b.thumbnail_color)};">
          <i class="fas fa-file-pdf book-cover-icon"></i>
          <span class="book-cover-title">${escHtml(b.title)}</span>
          ${hasLocal
            ? `<span class="book-badge badge-exchange" style="bottom:8px;top:auto;left:8px;right:auto;">
                 <i class="fas fa-hdd"></i> 저장됨
               </span>`
            : `<span class="book-badge" style="background:rgba(0,0,0,0.4);bottom:8px;top:auto;left:8px;right:auto;">
                 <i class="fas fa-cloud"></i> 파일없음
               </span>`}
        </div>
        <div class="book-info">
          <p class="book-title">${escHtml(b.title)}</p>
          <p class="book-author"><i class="fas fa-calendar"></i> ${formatDate(b.created_at)}</p>
        </div>
        <div style="padding:0 12px 12px;display:flex;gap:6px;">
          ${hasLocal
            ? `<button class="btn btn-success btn-sm" style="flex:1;"
                 onclick="event.stopPropagation();downloadBook('${b.id}')">
                 <i class="fas fa-download"></i> 다운로드
               </button>`
            : `<button class="btn btn-ghost btn-sm" style="flex:1;" disabled>
                 <i class="fas fa-exclamation"></i> 파일없음
               </button>`}
          <button class="btn btn-secondary btn-sm"
            onclick="event.stopPropagation();openBookDetail('${b.id}')">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-danger btn-sm"
            onclick="event.stopPropagation();deleteMyBook('${b.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>`;
  }).join('');
}

async function deleteMyBook(bookId) {
  if (!confirm('이 책을 삭제하시겠습니까?\n로컬 PDF 파일과 모든 교환 내역에도 영향을 줄 수 있습니다.')) return;
  showLoading('삭제 중...');
  try {
    await apiPatch('books', bookId, { status: 'DELETED' });
    await deletePdfBlob(bookId).catch(() => {});
    _myBooks  = _myBooks.filter(b => b.id !== bookId);
    _allBooks = _allBooks.filter(b => b.id !== bookId);
    await renderMyBookGrid();
    showToast('책이 삭제되었습니다.', 'success');
  } catch {
    showToast('삭제 중 오류가 발생했습니다.', 'error');
  } finally {
    hideLoading();
  }
}

// ============================================================
// 교환으로 얻은 책
// ============================================================
async function loadAccessedBooks() {
  const grid    = document.getElementById('accessedBookGrid');
  const emptyEl = document.getElementById('noAccessedBooks');
  grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</div>';

  try {
    if (!currentUser) return;
    const res   = await apiGet('book_access_permissions', { limit: 500 });
    const perms = (res.data||[]).filter(p => p.user_email === currentUser.email);

    if (perms.length === 0) {
      grid.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';

    // 책 정보 fetch
    const bookIds   = [...new Set(perms.map(p => p.book_id))];
    const booksData = [];
    for (const bid of bookIds) {
      try {
        let b = _allBooks.find(x => x.id === bid);
        if (!b) {
          const r = await fetch(`tables/books/${bid}`);
          if (r.ok) b = await r.json();
        }
        if (b) {
          const localExists = await hasPdfBlob(bid).catch(() => false);
          booksData.push({ ...b, localExists });
        }
      } catch { /* skip */ }
    }

    if (booksData.length === 0) {
      grid.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    grid.innerHTML = booksData.map((b, i) => `
      <div class="book-card" onclick="openBookDetail('${b.id}')" style="animation-delay:${i*40}ms">
        <div class="book-cover" style="background:${getCoverColor(b.thumbnail_color)};">
          <i class="fas fa-file-pdf book-cover-icon"></i>
          <span class="book-cover-title">${escHtml(b.title)}</span>
          <span class="book-badge badge-exchange"><i class="fas fa-unlock"></i> 획득</span>
        </div>
        <div class="book-info">
          <p class="book-title">${escHtml(b.title)}</p>
          <p class="book-author"><i class="fas fa-user-circle"></i> ${escHtml(b.owner_nickname||'')}</p>
        </div>
        <div style="padding:0 12px 12px;">
          ${b.localExists
            ? `<button class="btn btn-success btn-sm btn-full"
                 onclick="event.stopPropagation();downloadBook('${b.id}')">
                 <i class="fas fa-download"></i> PDF 다운로드
               </button>`
            : `<button class="btn btn-ghost btn-sm btn-full" disabled>
                 <i class="fas fa-exclamation-circle"></i> 파일을 등록자 기기에서 접근 필요
               </button>`}
        </div>
      </div>`).join('');
  } catch (e) {
    grid.innerHTML = '';
    emptyEl.style.display = 'block';
    console.error(e);
  }
}

// ============================================================
// PDF 등록 모달
// ============================================================
function openBookModal() {
  _selectedPdfFile = null;
  document.getElementById('bookTitle').value   = '';
  document.getElementById('bookDesc').value    = '';
  document.getElementById('pdfFile').value     = '';
  document.getElementById('filePreview').style.display     = 'none';
  document.getElementById('fileUploadArea').style.display  = 'block';
  document.getElementById('bookModalError').style.display  = 'none';
  document.getElementById('uploadProgressWrap').style.display = 'none';
  document.getElementById('bookModal').style.display = 'flex';

  // 드래그 앤 드롭
  const area = document.getElementById('fileUploadArea');
  area.ondragover  = (e) => { e.preventDefault(); area.classList.add('drag-over'); };
  area.ondragleave = ()  => area.classList.remove('drag-over');
  area.ondrop      = (e) => {
    e.preventDefault();
    area.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processFileSelection(file);
  };
}

function closeBookModal() {
  document.getElementById('bookModal').style.display = 'none';
  _selectedPdfFile = null;
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) processFileSelection(file);
}

function processFileSelection(file) {
  // PDF 검증
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) { showToast('PDF 파일만 업로드할 수 있습니다.', 'error'); return; }
  if (file.size > 50 * 1024 * 1024) { showToast('파일 크기는 50MB 이하여야 합니다.', 'error'); return; }

  _selectedPdfFile = file;
  document.getElementById('fileUploadArea').style.display = 'none';
  const preview = document.getElementById('filePreview');
  preview.style.display = 'flex';
  preview.innerHTML = `
    <i class="fas fa-file-pdf" style="color:var(--danger);font-size:1.6rem;flex-shrink:0;"></i>
    <div class="file-preview-info">
      <strong>${escHtml(file.name)}</strong>
      <span>${formatFileSize(file.size)}</span>
    </div>
    <button onclick="clearFileSelection()" title="파일 제거">
      <i class="fas fa-times"></i>
    </button>`;
}

function clearFileSelection() {
  _selectedPdfFile = null;
  document.getElementById('pdfFile').value = '';
  document.getElementById('filePreview').style.display    = 'none';
  document.getElementById('fileUploadArea').style.display = 'block';
}

async function submitBook() {
  const title  = document.getElementById('bookTitle').value.trim();
  const desc   = document.getElementById('bookDesc').value.trim();
  const errEl  = document.getElementById('bookModalError');
  errEl.style.display = 'none';

  const showErr = (m) => { errEl.textContent = m; errEl.style.display = 'block'; };

  if (!title)            { showErr('책 제목을 입력해주세요.'); return; }
  if (!desc)             { showErr('책 소개를 입력해주세요.'); return; }
  if (!_selectedPdfFile) { showErr('PDF 파일을 첨부해주세요.'); return; }

  // 진행 UI 표시
  const progWrap = document.getElementById('uploadProgressWrap');
  const progBar  = document.getElementById('uploadProgressBar');
  const progTxt  = document.getElementById('uploadProgressText');
  progWrap.style.display = 'block';
  progBar.style.width    = '0%';
  progTxt.textContent    = '파일 저장 중... 0%';

  // 버튼 비활성화
  const submitBtn = document.querySelector('#bookModal .btn-primary');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const bookId = generateUUID();

    // ── 1단계: Firebase에 PDF 저장 (진행률 시뮬레이션) ──
    const url = await savePdfWithProgress(_selectedPdfFile, bookId, (pct) => {
      progBar.style.width   = pct + '%';
      progTxt.textContent   = `파일 저장 중... ${pct}%`;
    });

    // ── 2단계: DB에 메타데이터 저장 ──
    progTxt.textContent = '등록 중...';
    progBar.style.width = '95%';

    const newBook = {
      id:              bookId,
      owner_email:     currentUser.email,
      owner_nickname:  currentUser.nickname,
      title,
      description:     desc,
      pdf_url:         url,
      pdf_filename:    _selectedPdfFile.name,
      file_size:       _selectedPdfFile.size,
      thumbnail_color: String(getRandomColorIndex()),
      status:          'ACTIVE',
    };

    const created = await apiPost('books', newBook);
    _myBooks.unshift(created);
    _allBooks.unshift(created);

    progBar.style.width = '100%';
    progTxt.textContent = '완료!';

    await new Promise(r => setTimeout(r, 400));
    closeBookModal();
    await renderMyBookGrid();
    showToast(`"${title}" 등록 완료! 🎉`, 'success');

  } catch (e) {
    showErr('등록 중 오류가 발생했습니다: ' + (e.message || ''));
    progWrap.style.display = 'none';
    console.error(e);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/** PDF를 Firebase에 저장하면서 진행률 콜백 호출 */
function savePdfWithProgress(file, bookId, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let fakeProgress = 0;

    // 진행률 시뮬레이션 (FileReader는 대용량 외엔 거의 즉시 끝남)
    const ticker = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + 10, 80);
      onProgress(fakeProgress);
    }, 80);

    reader.onload = async (e) => {
      clearInterval(ticker);
      onProgress(85);
      try {
        const blob = new Blob([e.target.result], { type: 'application/pdf' });
        const url = await savePdfBlob(bookId, blob, file.name);
        onProgress(95);
        resolve(url);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => { clearInterval(ticker); reject(reader.error); };
    reader.readAsArrayBuffer(file);
  });
}
