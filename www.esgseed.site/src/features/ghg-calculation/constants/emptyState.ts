/**
 * GHG_UI_SCOPE.md §2-6 3단계: 빈 상태·로딩 메시지 통일
 * GHG 페이지 내 일관된 톤의 문구.
 */

/** 저장된 히스토리 없을 때 안내 문구 (Dialog / 카드 공통) */
export const EMPTY_HISTORY_MESSAGE =
  "저장된 히스토리가 없습니다. 각 Scope에서 '결과 저장'을 눌러 기록을 남겨보세요.";

/** 데이터 없음 공통 설명 (필터·사업장 등 확인 유도) */
export const EMPTY_DATA_HINT =
  "필터에서 사업장·연도를 선택했을 경우, 해당 조건에 맞는 데이터가 있는지 확인하세요.";

/** §2-6 3단계: 로딩 중 공통 문구 */
export const LOADING_MESSAGE = '로딩 중입니다. 잠시만 기다려 주세요.';

/** §2-6 3단계: 조건 불일치 등 데이터 없음 시 안내 */
export const LOADING_NO_DATA_MESSAGE = '조건에 맞는 데이터가 없습니다.';

/** §2-6 3단계: 로딩 UI — GHG 페이지는 @/components/ui/skeleton(Skeleton) 사용, 로딩 시 2~3줄 스켈레톤 블록 권장 */
