'use client';

import type { ReactNode } from 'react';

interface Layout3ColumnProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

/**
 * 3분할 레이아웃 래퍼 컴포넌트
 * - 왼쪽 (15~20%): LeftNavTree
 * - 중앙 (50~55%): SREditor
 * - 오른쪽 (25~30%): RightChecklist
 */
export function Layout3Column({ left, center, right }: Layout3ColumnProps) {
  return (
    /* 1. 부모 컨테이너: max-w-7xl 등이 있다면 지우고 w-full로 화면을 가득 채웁니다. */
    <div className="w-full px-4 lg:px-6"> 
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 2. 왼쪽 목차: 2에서 3으로 늘려 가독성 확보 (약 25%) */}
        <div className="lg:col-span-3 xl:col-span-3">
          {left}
        </div>

        {/* 3. 중앙 에디터: 6에서 6 유지 (약 50%) */}
        <div className="lg:col-span-6 xl:col-span-6">
          {center}
        </div>

        {/* 4. 오른쪽 체크리스트: 나머지 공간 (약 25%) */}
        <div className="lg:col-span-3 xl:col-span-3">
          {right}
        </div>

      </div>
    </div>
  );
}