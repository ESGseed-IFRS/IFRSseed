'use client';

/**
 * GHG_GRID_EMPTY_STATE_SPEC: 그리드 빈 상태 안내
 * - 컬럼 헤더는 항상 표시, 빈 행 영역에 안내 문구 병행
 */
interface GridEmptyStateProps {
  /** 시스템명 (EMS, ERP, EHS 등) — "EMS 불러오기" 형태로 표시 */
  systemName?: string;
  /** 추가 힌트 (기본: EMS 불러오기 또는 엑셀 업로드, + 행 추가) */
  hint?: React.ReactNode;
}

export function GridEmptyState({ systemName = 'EMS', hint }: GridEmptyStateProps) {
  const defaultHint = (
    <>
      <strong>[{systemName} 불러오기]</strong> 또는 <strong>[엑셀 업로드]</strong>로 데이터를 가져오거나,
      <strong> [+ 행 추가]</strong>로 직접 입력하세요.
    </>
  );
  return (
    <div className="py-12 text-center text-muted-foreground text-sm">
      <p className="font-medium mb-1.5">입력된 데이터가 없습니다.</p>
      <p className="text-slate-600">{hint ?? defaultHint}</p>
    </div>
  );
}
