# 온실가스 배출량 산정 플랫폼  
## 감사대응(Audit Response) 기능 – 최종 통합 설계 문서 v2.0  
### (Audit Automation Level)

## 탭 명칭 변경: IFRS 감사대응 → 감사·검증 대응 (Audit & Verification)

### 변경 배경
기존 **「IFRS 감사대응」** 탭 명칭은 특정 공시 기준(IFRS)에 한정된 인상을 주어,  
플랫폼이 실제로 지원하는 **외부 감사·제3자 검증·내부 검토** 범위를 충분히 설명하지 못하는 한계가 있다.

GHG 산정 및 ESG 공시는 IFRS S2 외에도 GRI, CDP, ESRS, K-ETS, K-ESG 등  
다양한 공시 프레임워크와 **외부 검증(Verification)**, **내부 감사(Audit)** 요구에 동시에 대응해야 하므로,  
보다 포괄적이고 중립적인 명칭이 필요하다.

### 변경 내용
- 기존 탭 명칭  
  - **IFRS 감사대응**
- 변경 탭 명칭  
  - **감사·검증 대응 (Audit & Verification)**

---

## 1. 설계 목적 및 포지셔닝

본 플랫폼의 감사대응(Audit Response) 기능은  
**“기술적으로 로그가 남는 시스템”을 넘어,  
외부 감사인이 실제로 검증 업무를 효율적으로 수행할 수 있도록 설계된  
Audit Automation 수준의 검증 대응 체계**를 목표로 한다.

이는 다음 기준 및 실무 요구를 동시에 충족한다.

- :contentReference[oaicite:0]{index=0} : 투명성, 일관성, 재현성
- :contentReference[oaicite:1]{index=1} (IFRS S2) : 방법론 변경 이력, 가정·판단 근거 문서화
- Big4 회계법인 및 제3자 검증기관 : 데이터 고정, 증빙 무결성, 샘플링 검증 효율

---

## 2. 감사대응 성숙도 정의

| 레벨 | 정의 |
|---|---|
| Level 1 | 로그가 남는 시스템 (단순 추적) |
| Level 2 | 감사 대응이 가능한 시스템 (Traceability) |
| **Level 3** | **감사 효율을 극대화한 시스템 (Audit Automation)** |

본 설계 문서는 **Level 3**를 기준으로 한다.

---

## 3. 감사대응 메뉴 정보 구조 (IA)

[감사대응]
├─ 내부통제 요약 대시보드
├─ 데이터 마감/확정 관리 (Lock & Snapshot)
├─ 배출량별 감사 추적
│ ├─ 활동자료(Activity Data)
│ ├─ 배출계수(Emission Factor)
│ └─ 산정결과(Calculated Emissions)
│
├─ 변경 이력(Audit Trail)
├─ 증빙자료(Evidence & Integrity)
├─ 산정 방법론 및 로직 계보(Lineage)
├─ 감사인 전용 뷰(Auditor View)
└─ 감사 대응 패키지(Export)


---

## 4. 데이터 확정 및 마감 절차 (Data Freeze / Lock)

### 4.1 Period Lock (기간 잠금)

- 월별 또는 연도별 산정 완료 시 “마감(Lock)” 처리
- Lock 상태의 데이터는 **Read-only**
- 감사인은 “검증 개시 이후 데이터가 변경되지 않음”을 즉시 확인 가능

### 4.2 Unlock Workflow

- 마감 데이터 수정 시:
  - 관리자 승인 필수
  - 수정 사유 입력 필수
  - Unlock / Re-lock 이력은 audit_log에 기록

### 4.3 Snapshot 기능

- 마감 시점의 전체 데이터셋을 스냅샷으로 저장
  - DB 스냅샷 또는 파일 기반
- 이후 데이터 변경 여부와 무관하게  
  **“마감 당시 기준 값”을 즉시 재현 가능**

## 4.4 Approval Workflow & e-Signature (필수)

본 플랫폼은 단순한 변경 이력 기록을 넘어,  
**승인 기반 데이터 변경 + 전자서명(e-Sign)을 통한 책임 명확화**를 통해  
외부 감사 및 정부 제출 보고에 적합한 내부통제 수준을 확보한다.

본 기능은 K-ETS 검증, 외부 제3자 검증, Big4 감사 실무를 기준으로  
**Phase 1 필수 도입 기능**으로 정의한다.

---

### 4.4.1 승인 기반 데이터 변경 원칙

- Lock 상태의 데이터는 승인 없이는 수정 및 Unlock 불가
- 모든 데이터 변경은 반드시 **사전 승인 → 수정 → 재마감(Re-lock)** 절차를 따른다
- 승인 없는 변경은 시스템 구조상 불가능하도록 설계한다

---

### 4.4.2 다단계 승인 프로세스 (Approval Workflow)

기본 승인 흐름:
입력자 → 검토자 → 승인자(관리자)


- 승인 단계 및 역할은 조직별로 설정 가능
- 각 단계에서 다음 기능 제공:
  - 승인 / 반려
  - 승인 의견(Comment) 입력
- 승인 상태:
  - Pending / Approved / Rejected
- 모든 승인·반려 행위는 audit_log에 기록된다

---

### 4.4.3 전자서명(e-Sign) 기반 최종 승인

최종 승인 단계에서는 **전자서명(e-Signature)**을 필수로 요구한다.

- 지원 방식:
  - 공인 전자서명
  - 간편 전자서명 (법적 효력 보유)
- 전자서명 메타데이터 저장 항목:
  - 서명자 ID
  - 서명 시각 (UTC)
  - 서명 해시값
  - 승인 대상 데이터 Snapshot ID

👉 승인 행위는 단순 클릭이 아닌  
**법적 책임을 수반하는 공식 승인 기록**으로 관리된다.

---

### 4.4.4 Unlock Workflow와의 연계

- Lock된 데이터 수정 시:
  - “Unlock 승인 요청” 버튼 활성화
- 승인 프로세스 완료 시:
  - 자동 Unlock
  - 수정 허용
- 수정 완료 후:
  - Re-lock 필수
  - 신규 Snapshot 생성

Unlock → 수정 → Re-lock 전 과정은 단일 Audit Trail로 연결된다.

---

### 4.4.5 감사 대응 관점 효과

본 기능 도입을 통해 다음이 가능해진다.

- 승인 없는 사후 수정 리스크 제거
- 변경 책임자 및 승인자 명확화
- 승인 로그 + 전자서명만으로 내부통제 검증 가능
- Big4 감사 시 추가 설명 없이 화면 캡처로 검증 종료 가능

---

### 4.4.6 구현 가이드 (개발 관점)

- 기존 RBAC(Role-Based Access Control) 구조와 연계
- Workflow Engine 활용:
  - Camunda / Activiti
  - 또는 Django / Laravel 내장 Workflow
- e-Sign 연동:
  - 전자서명 API
  - 사내 인증 시스템 연계 가능

구현 난이도: **중**
감사 효율 개선 효과: **매우 높음**


---

## 5. Audit Trail (변경 이력 관리)

### 5.1 Audit Log 테이블 (요약)

- CREATE / UPDATE / DELETE / RESTORE 전부 기록
- 필드 단위 변경 이력(JSONB)
- 변경자, 변경 시각(UTC), 변경 사유 필수

### 5.2 UI – Audit Trail Viewer

- 타임라인 기반 시각화
- 변경 전/후 값 색상 구분
- 증빙 파일 즉시 접근

---

## 6. 증빙자료 무결성 검증 (Evidence Integrity)

### 6.1 저장 구조

- 파일: Object Storage(S3 등)
- DB:
  - 파일 URL
  - SHA-256 해시
  - 업로드 메타데이터

### 6.2 Hash Verification UI (핵심 차별 기능)

- 증빙 파일 옆 **“Integrity Check” 버튼**
- 기능:
  - 현재 파일 해시 vs 업로드 당시 해시 비교
  - 결과 표시:
    - ✅ Verified (변조 없음)
    - ❌ Mismatch (경고 표시)

👉 감사인이 직접 신뢰를 확인할 수 있는 UX 제공

---

## 7. 산정 로직 계보 관리 (Calculation Lineage)

### 7.1 배출계수 버전 관리 (Factor Versioning)

- 배출계수 테이블에:
  - version
  - valid_from / valid_to
- 신규 고시 계수는 **신규 데이터부터 적용**
- 과거 데이터는 기존 계수 유지

### 7.2 방법론 변경 이력 (Logic Change Log)

별도 메뉴로 관리:

2026-01-01

대상: A사업장 폐기물

변경: 소각 → 매립

사유: 공정 변경

승인자: ESG팀장


👉 숫자 변경이 아닌 **“산정 논리 변경”을 설명 가능**

---

## 8. 감사인 전용 뷰 (Auditor View)

### 8.1 Auditor Account

- Read-only 권한
- 감사 전용 UI 제공
- 실무자 화면과 분리

### 8.2 Sampling Export

- 감사인이 조건 지정:
  - 상위 10% 배출 항목
  - 특정 Scope / 사업장
- 선택 항목에 대해:
  - 입력값
  - 증빙
  - 변경 이력
  → **단일 Audit Package 생성**

### 8.3 Comment & Response 기능

- 감사인이 데이터에 코멘트(소명 요청) 남김
- 실무자가:
  - 답변 작성
  - 추가 증빙 업로드
- 모든 커뮤니케이션 이력은 시스템에 기록

---

## 9. 내부통제 자가진단 대시보드 (첫 화면)

감사대응 메뉴 진입 시 가장 먼저 노출

### 9.1 주요 지표

- **증빙 구비율 (%)**
- **주요 변경 요약**
  - 직전 검증 대비 ±10% 이상 변동 항목
  - 변경 사유 자동 요약
- **결재 완료율 (%)**
- Lock / Unlock 현황

👉 감사 질문을 사전에 방어하는 역할

---

## 10. 감사 대응 패키지 (Export)

### 10.1 Export 구성

- Emission Summary
- Activity Data
- Methodology & Lineage
- Audit Trail
- Evidence Files (ZIP)

### 10.2 활용 시나리오

- 감사 샘플링 요청 → 즉시 패키지 생성 → 전달

---

## 11. 권한 및 내부통제 체계

| 역할 | 권한 |
|---|---|
| 입력자 | 데이터 생성/수정 |
| 관리자 | 승인 / Lock / Unlock |
| 감사 대응자 | 전체 열람 및 Export |
| 외부 감사인 | Read-only + Comment |

---

## 12. 구현 우선순위 (현실적 로드맵)

### Phase 1
- Audit Log + Evidence
- Period Lock

### Phase 2
- Snapshot
- Hash Verification UI
- Factor Versioning

### Phase 3
- Auditor View
- Sampling Export
- Internal Control Dashboard

---

## 13. 최종 요약 (기획/세일즈 문구)

본 플랫폼은 단순한 온실가스 산정 도구를 넘어,  
**데이터 확정–무결성 검증–산정 논리 계보–감사인 인터랙션까지 자동화한  
Audit Automation 기반 검증 대응 솔루션**을 제공한다.

