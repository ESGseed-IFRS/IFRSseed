'use client';

import { HoldingPageByPageEditor } from './HoldingPageByPageEditor';

interface HoldingWriteProps {
  /** 예: 공시데이터 작성에서 '보고서에 삽입' 시 해당 키워드로 페이지 자동 선택 */
  initialToc?: string | null;
  onInitialTocConsumed?: () => void;
}

export function HoldingWrite({ initialToc, onInitialTocConsumed }: HoldingWriteProps) {
  return (
    <HoldingPageByPageEditor
      initialKeyword={initialToc ?? undefined}
      onInitialKeywordConsumed={onInitialTocConsumed}
    />
  );
}
