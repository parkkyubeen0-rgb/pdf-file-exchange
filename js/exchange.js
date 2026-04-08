/* ============================================================
   exchange.js — 교환 요청 / 수락 / 거절 / 취소
   ============================================================ */

let _targetBookId = null;         // 교환 대상 책 ID
let _selectedOfferedBookId = null; // 내가 제안할 책 ID

// ============================================================
// 교환 Pick 모달 (교환 요청 전 내 책 선택)
// ============================================================
async function openExchangePickModal(targetBookId) {
  if (!isLoggedIn()) {
    showToast('로그인이 필요합니다.', 'warning');
    showPage('auth');
    return;
  }

  _targetBookId = targetBookId;
  _selectedOfferedBookId = null;
  document.getElementById('confirmExchangeBtn').disabled = true;
  document.getElementById('exchangePickModal').style.display = 'flex';

  const listEl = document.getElementById('myBooksForExchange');
  const emptyEl = document.getElementById('noMyBooksForExchange');
  listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> 내 책 불러오는 중...</div>';
  emptyEl.style.display = 'none';

  try {
    const res = await apiGet('books', { limit: 200 });
    const myBooks = (res.data || []).filter(b =>
      b.owner_email === currentUser.email && b.status === 'ACTIVE'
    );

    if (myBooks.length === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    listEl.innerHTML = myBooks.map(b => `
      <div class="exchange-pick-item" id="pick-${b.id}" onclick="selectOfferedBook('${b.id}', this)">
        <div class="pick-thumb" style="background:${getCoverColor(b.thumbnail_color)};">
          <i class="fas fa-file-pdf"></i>
        </div>
        <div class="pick-info">
          <h4>${escHtml(b.title)}</h4>
          <p>${formatFileSize(b.file_size)}</p>
        </div>
        <input type="radio" class="pick-radio" name="pickBook" value="${b.id}" />
      </div>
    `).join('');
  } catch (e) {
    listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--danger);">불러오기 실패</div>';
  }
}

function closeExchangePickModal() {
  document.getElementById('exchangePickModal').style.display = 'none';
  _targetBookId = null;
  _selectedOfferedBookId = null;
}

function selectOfferedBook(bookId, el) {
  // UI 업데이트
  document.querySelectorAll('.exchange-pick-item').forEach(item => item.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input[type=radio]').checked = true;

  _selectedOfferedBookId = bookId;
  document.getElementById('confirmExchangeBtn').disabled = false;
}

// ============================================================
// 교환 요청 확정
// ============================================================
async function confirmExchangeRequest() {
  if (!_targetBookId || !_selectedOfferedBookId) {
    showToast('교환할 책을 선택해주세요.', 'warning');
    return;
  }

  showLoading('교환 요청 중...');
  try {
    // 책 정보 가져오기
    const allRes = await apiGet('books', { limit: 200 });
    const allBooks = allRes.data || [];

    const targetBook = allBooks.find(b => b.id === _targetBookId);
    const offeredBook = allBooks.find(b => b.id === _selectedOfferedBookId);

    if (!targetBook || !offeredBook) {
      showToast('책 정보를 찾을 수 없습니다.', 'error');
      return;
    }

    // 중복 요청 체크 (동일 책 쌍 + PENDING 상태)
    const existingRes = await apiGet('exchange_requests', { limit: 200 });
    const existing = (existingRes.data || []).find(r =>
      r.requester_email === currentUser.email &&
      r.requested_book_id === _targetBookId &&
      r.offered_book_id === _selectedOfferedBookId &&
      r.status === 'PENDING'
    );
    if (existing) {
      showToast('이미 같은 교환 요청이 진행 중입니다.', 'warning');
      closeExchangePickModal();
      return;
    }

    // 요청 생성
    const request = {
      id: generateUUID(),
      requester_email: currentUser.email,
      requester_nickname: currentUser.nickname,
      target_owner_email: targetBook.owner_email,
      target_owner_nickname: targetBook.owner_nickname,
      requested_book_id: targetBook.id,
      requested_book_title: targetBook.title,
      offered_book_id: offeredBook.id,
      offered_book_title: offeredBook.title,
      status: 'PENDING',
      responded_at: '',
    };

    await apiPost('exchange_requests', request);
    closeExchangePickModal();
    showToast(`"${targetBook.title}"에 교환 요청을 보냈습니다! 📨`, 'success');
  } catch (e) {
    showToast('요청 중 오류가 발생했습니다.', 'error');
  } finally {
    hideLoading();
  }
}

// ============================================================
// 교환 현황 페이지
// ============================================================
async function loadExchangePage() {
  await Promise.all([loadReceivedRequests(), loadSentRequests()]);
}

async function loadReceivedRequests() {
  const listEl = document.getElementById('receivedList');
  const emptyEl = document.getElementById('noReceived');
  const badgeEl = document.getElementById('receivedBadge');
  listEl.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</div>';
  emptyEl.style.display = 'none';

  try {
    const res = await apiGet('exchange_requests', { limit: 200 });
    const received = (res.data || []).filter(r =>
      r.target_owner_email === currentUser.email
    ).sort((a, b) => b.created_at - a.created_at);

    // PENDING 개수 뱃지
    const pendingCount = received.filter(r => r.status === 'PENDING').length;
    if (pendingCount > 0) {
      badgeEl.textContent = pendingCount;
      badgeEl.style.display = 'inline-block';
    } else {
      badgeEl.style.display = 'none';
    }

    if (received.length === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    listEl.innerHTML = received.map(r => renderExchangeCard(r, 'received')).join('');
  } catch (e) {
    listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--danger);">불러오기 실패</div>';
  }
}

async function loadSentRequests() {
  const listEl = document.getElementById('sentList');
  const emptyEl = document.getElementById('noSent');
  listEl.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</div>';
  emptyEl.style.display = 'none';

  try {
    const res = await apiGet('exchange_requests', { limit: 200 });
    const sent = (res.data || []).filter(r =>
      r.requester_email === currentUser.email
    ).sort((a, b) => b.created_at - a.created_at);

    if (sent.length === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    listEl.innerHTML = sent.map(r => renderExchangeCard(r, 'sent')).join('');
  } catch (e) {
    listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--danger);">불러오기 실패</div>';
  }
}

// ============================================================
// 교환 카드 렌더링
// ============================================================
function renderExchangeCard(req, type) {
  const statusInfo = getStatusInfo(req.status);

  // 요청 방향에 따라 표시 변경
  const myBook = type === 'sent'
    ? { title: req.offered_book_title, color: 3 }
    : { title: req.requested_book_title, color: 1 };
  const theirBook = type === 'sent'
    ? { title: req.requested_book_title, color: 1 }
    : { title: req.offered_book_title, color: 3 };

  const partnerName = type === 'sent' ? req.target_owner_nickname : req.requester_nickname;

  const actions = getExchangeActions(req, type);

  return `
    <div class="exchange-card" id="exc-${req.id}">
      <div class="exchange-books">
        <div>
          <div class="exchange-book-thumb" style="background:${getCoverColor(myBook.color)};">
            <i class="fas fa-file-pdf"></i>
          </div>
        </div>
        <div class="exchange-book-info">
          <h4>${escHtml(myBook.title)}</h4>
          <p>${type === 'sent' ? '내가 제안' : '상대가 원하는 내 책'}</p>
        </div>
        <div class="exchange-arrow">
          <i class="fas fa-exchange-alt"></i>
        </div>
        <div>
          <div class="exchange-book-thumb" style="background:${getCoverColor(theirBook.color)};">
            <i class="fas fa-file-pdf"></i>
          </div>
        </div>
        <div class="exchange-book-info">
          <h4>${escHtml(theirBook.title)}</h4>
          <p>${type === 'sent' ? '상대 책' : '상대가 제안'} · ${escHtml(partnerName)}</p>
        </div>
      </div>
      <div class="exchange-meta">
        <span class="exchange-status ${statusInfo.cls}">
          <i class="${statusInfo.icon}"></i> ${statusInfo.label}
        </span>
        <span class="exchange-date">${formatDate(req.created_at)}</span>
        ${actions ? `<div class="exchange-actions">${actions}</div>` : ''}
      </div>
    </div>
  `;
}

function getStatusInfo(status) {
  const map = {
    PENDING:   { label: '대기 중', cls: 'status-pending',   icon: 'fas fa-clock' },
    ACCEPTED:  { label: '교환 완료', cls: 'status-accepted', icon: 'fas fa-check-circle' },
    REJECTED:  { label: '거절됨',   cls: 'status-rejected',  icon: 'fas fa-times-circle' },
    CANCELLED: { label: '취소됨',   cls: 'status-cancelled', icon: 'fas fa-ban' },
  };
  return map[status] || map['PENDING'];
}

function getExchangeActions(req, type) {
  if (req.status !== 'PENDING') return '';
  if (type === 'received') {
    return `
      <button class="btn btn-success btn-sm" onclick="acceptRequest('${req.id}')">
        <i class="fas fa-check"></i> 수락
      </button>
      <button class="btn btn-danger btn-sm" onclick="rejectRequest('${req.id}')">
        <i class="fas fa-times"></i> 거절
      </button>
    `;
  }
  if (type === 'sent') {
    return `
      <button class="btn btn-ghost btn-sm" onclick="cancelRequest('${req.id}')">
        <i class="fas fa-ban"></i> 취소
      </button>
    `;
  }
  return '';
}

// ============================================================
// 수락
// ============================================================
async function acceptRequest(requestId) {
  if (!confirm('교환을 수락하시겠습니까? 양측이 서로의 PDF 접근 권한을 획득합니다.')) return;

  showLoading('교환 수락 중...');
  try {
    // 요청 정보 가져오기
    const reqRes = await fetch(`tables/exchange_requests/${requestId}`);
    const req = await reqRes.json();

    if (req.status !== 'PENDING') {
      showToast('이미 처리된 요청입니다.', 'warning');
      return;
    }

    const now = String(Date.now());

    // 1. 요청 상태 ACCEPTED 변경
    await apiPatch('exchange_requests', requestId, {
      status: 'ACCEPTED',
      responded_at: now,
    });

    // 2. 요청자에게 상대 책 (requested_book) 접근 권한 부여
    await apiPost('book_access_permissions', {
      id: generateUUID(),
      user_email: req.requester_email,
      book_id: req.requested_book_id,
      book_title: req.requested_book_title,
      book_owner_email: req.target_owner_email,
      book_owner_nickname: req.target_owner_nickname,
      exchange_request_id: requestId,
      granted_at: now,
    });

    // 3. 수락자(나)에게 제안된 책 (offered_book) 접근 권한 부여
    await apiPost('book_access_permissions', {
      id: generateUUID(),
      user_email: req.target_owner_email,
      book_id: req.offered_book_id,
      book_title: req.offered_book_title,
      book_owner_email: req.requester_email,
      book_owner_nickname: req.requester_nickname,
      exchange_request_id: requestId,
      granted_at: now,
    });

    showToast('🎉 교환이 완료되었습니다! 상대방의 책에 접근할 수 있습니다.', 'success', 5000);
    await loadReceivedRequests();
  } catch (e) {
    showToast('수락 중 오류가 발생했습니다.', 'error');
    console.error(e);
  } finally {
    hideLoading();
  }
}

// ============================================================
// 거절
// ============================================================
async function rejectRequest(requestId) {
  if (!confirm('교환 요청을 거절하시겠습니까?')) return;

  showLoading('처리 중...');
  try {
    await apiPatch('exchange_requests', requestId, {
      status: 'REJECTED',
      responded_at: String(Date.now()),
    });
    showToast('교환 요청을 거절했습니다.', '');
    await loadReceivedRequests();
  } catch (e) {
    showToast('처리 중 오류가 발생했습니다.', 'error');
  } finally {
    hideLoading();
  }
}

// ============================================================
// 취소
// ============================================================
async function cancelRequest(requestId) {
  if (!confirm('교환 요청을 취소하시겠습니까?')) return;

  showLoading('처리 중...');
  try {
    await apiPatch('exchange_requests', requestId, {
      status: 'CANCELLED',
      responded_at: String(Date.now()),
    });
    showToast('교환 요청이 취소되었습니다.', '');
    await loadSentRequests();
  } catch (e) {
    showToast('처리 중 오류가 발생했습니다.', 'error');
  } finally {
    hideLoading();
  }
}

// ============================================================
// 탭 전환
// ============================================================
function switchTab(tab, btn) {
  // 탭 버튼
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  // 탭 콘텐츠
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
}
