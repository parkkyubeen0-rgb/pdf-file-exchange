# 📚 BookSwap — PDF 전자책 1:1 교환 서비스

## 서비스 소개
회원가입한 사용자가 **실제 PDF 파일을 등록**하고, 다른 사용자의 책과 **1:1 교환 요청** → 수락 시 **진짜 PDF 다운로드 권한 획득**하는 전자책 교환 플랫폼.

---

## ✅ 완성된 기능

### 인증 (실사용자 기반)
- [x] 회원가입 (이메일 인증 코드 발급 → 화면 표시 → 검증)
- [x] 로그인 / 로그아웃
- [x] 세션 유지 (localStorage)
- [x] 이메일 중복 체크, 비밀번호 최소 6자 검증

### 도서 탐색 (Explore)
- [x] 전체 공개 PDF 책 목록 그리드
- [x] 실시간 제목 검색
- [x] 필터 (전체 / 교환 가능)
- [x] 내 책 "내 책" 배지

### 도서 상세 (Book Detail)
- [x] 책 정보 + 권한별 버튼 분기
  - 본인 소유 → 비활성 표시
  - 권한 있고 파일 있음 → **실제 PDF 다운로드**
  - 권한 있고 파일 없음 → 안내 메시지
  - 미로그인 → 로그인 유도
  - 일반 → 교환 요청하기

### 내 책장 (My Library)
- [x] 내가 등록한 PDF 목록 + **저장됨/파일없음** 배지
- [x] **실제 PDF 등록**: 파일 선택/드래그→IndexedDB 저장→메타데이터 DB 저장
- [x] 업로드 진행률 바 (%)
- [x] 내 책 직접 다운로드 (내 PDF도 재다운로드 가능)
- [x] 책 삭제 (DB + IndexedDB 동시 삭제)
- [x] 교환으로 획득한 책 섹션 (파일 존재 시 다운로드 버튼 활성)

### 교환 현황 (Exchange Management)
- [x] 받은 요청 탭 (수락 / 거절)
- [x] 보낸 요청 탭 (취소)
- [x] 수락 시 양측에 즉시 book_access_permissions 부여
- [x] 상태별 색상 배지 (대기/완료/거절/취소)
- [x] PENDING 요청 수 뱃지

---

## 🗄️ PDF 파일 저장 방식

| 저장소 | 무엇을 저장? | 특징 |
|---|---|---|
| **Firebase Storage** (클라우드) | 실제 PDF Blob | 모든 기기에서 접근 가능 |
| **IndexedDB** (브라우저) | Firebase URL + 메타데이터 | 로컬 캐시 |
| **RESTful Table API** (서버) | 메타데이터 (제목, 설명, 파일명, 크기, 소유자, pdf_url 등) | 모든 사용자가 목록 조회 가능 |

> **중요**: PDF 파일은 Firebase Storage에 업로드되며, URL이 DB에 저장됩니다.  
> 교환이 완료돼도 모든 기기에서 다운로드할 수 있습니다.  
> Firebase 프로젝트가 설정되었습니다.

---

## 📁 파일 구조

```
index.html          — SPA 전체 HTML 구조
css/
  style.css         — 디자인 시스템 (반응형)
js/
  utils.js          — UUID, Toast, API helper, 색상, 날짜
  storage.js        — IndexedDB 래퍼 (savePdfBlob / getPdfBlob / triggerDownload)
  auth.js           — 회원가입 / 로그인 / 세션
  books.js          — 탐색 / 상세 / 내 책장 / PDF 등록·다운로드
  exchange.js       — 교환 요청 / 수락 / 거절 / 취소
  app.js            — 라우팅 / 초기화
```

---

## 🔑 핵심 비즈니스 규칙

1. **이메일 = 고유 식별자** (다른 이메일 = 다른 계정)
2. **PDF 전용** (.pdf 확장자 + MIME 검사, 50MB 제한)
3. **1:1 교환**: 요청→수락→양측 권한 동시 부여
4. **본인 책 교환 불가**: 자신의 책에 교환 요청 버튼 비활성화
5. **소유권 유지**: 교환 후 원본 소유자는 유지, 상대방은 접근 권한만 획득

---

## 🚀 사용 흐름

1. **회원가입**: 이메일 입력 → 인증번호 발송(화면 표시) → 인증 → 닉네임·비밀번호 설정
2. **PDF 등록**: 내 책장 → 새 전자책 등록 → 제목/소개/PDF 파일 첨부 → 등록 완료 (브라우저 저장)
3. **교환 요청**: 탐색 → 원하는 책 클릭 → 교환 요청 → 내 책 선택 → 요청 발송
4. **수락**: 상대방 교환 현황 → 받은 요청 → 수락 (양측 권한 부여)
5. **다운로드**: 내 책장 → 교환으로 얻은 책 → PDF 다운로드 (상대 브라우저에서 가능)

---

## 🗄️ 데이터 모델

### users
| 필드 | 설명 |
|---|---|
| id | UUID |
| email | 이메일 (고유 식별자) |
| password_hash | Base64 해시 비밀번호 |
| nickname | 닉네임 |
| email_verified | 인증 여부 |

### books
| 필드 | 설명 |
|---|---|
| id | UUID |
| owner_email | 소유자 이메일 |
| owner_nickname | 소유자 닉네임 |
| title | 책 제목 |
| description | 책 소개 |
| pdf_filename | 원본 파일명 |
| file_size | 파일 크기(bytes) |
| thumbnail_color | 썸네일 색상 인덱스 (0~9) |
| status | ACTIVE / DELETED |

### exchange_requests
| 필드 | 설명 |
|---|---|
| id | UUID |
| requester_email | 요청자 이메일 |
| target_owner_email | 대상자 이메일 |
| requested_book_id | 원하는 책 ID |
| offered_book_id | 제안하는 책 ID |
| status | PENDING / ACCEPTED / REJECTED / CANCELLED |

### book_access_permissions
| 필드 | 설명 |
|---|---|
| id | UUID |
| user_email | 권한 보유자 이메일 |
| book_id | 접근 가능 책 ID |
| exchange_request_id | 교환 요청 ID |
| granted_at | 권한 부여 일시 |

---

## � Firebase 설정 (다른 기기 다운로드용)

다른 기기에서도 교환한 PDF를 다운로드하려면 Firebase Storage를 사용합니다.

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트 생성
2. Storage 활성화
3. 프로젝트 설정 > 일반 > 앱 추가 (웹 앱)
4. Firebase SDK 스니펫에서 config 복사
5. `js/storage.js`의 `firebaseConfig`에 붙여넣기

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

---

## �🔜 다음 단계 (미구현)

- [ ] 실제 파일 서버 업로드 (S3, Cloudflare R2 등) — 다른 기기서도 다운로드 가능하게
- [ ] 이메일 실제 발송 (SendGrid, SES 등)
- [ ] 알림 시스템 (교환 요청 수신 시)
- [ ] 책 수정 기능
- [ ] 리뷰/평점, 소셜 로그인
