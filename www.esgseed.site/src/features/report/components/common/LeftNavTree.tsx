'use client';

import type { TableOfContentsItem } from '../../types';

interface LeftNavTreeProps {
  items: TableOfContentsItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * 왼쪽 목차 트리 컴포넌트
 * 계층 구조를 표시하고 선택 가능
 */
export function LeftNavTree({ items, selectedId, onSelect }: LeftNavTreeProps) {
  const renderTocItem = (item: TableOfContentsItem) => {
    const isSelected = selectedId === item.id;
    const paddingLeft = item.level * 16; // 계층별 들여쓰기 조절
    
    return (
      <div
        key={item.id}
        className={`relative flex items-center gap-3 py-3 px-4 cursor-pointer transition-all duration-200 ${
          isSelected 
            ? 'bg-primary/5 text-primary font-bold' // 선택 시 강조
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        }`}
        style={{ paddingLeft: `${paddingLeft + 20}px` }}
        onClick={() => onSelect(item.id)}
      >
        {/* 선택 시 좌측에 나타나는 시그니처 초록색 바 */}
        {isSelected && (
          <div className="absolute left-0 top-2 bottom-2 w-[4px] bg-primary rounded-r-full" />
        )}

        <div className="flex items-center gap-2.5 overflow-hidden">
          {/* 하위 항목일 때만 꺾쇠 표시 (더 작고 연하게) */}
          {item.level > 0 && (
            <span className={`text-xs opacity-50 ${isSelected ? 'text-primary' : 'text-slate-400'}`}>›</span>
          )}
          
          {/* 페이지 번호: 박스 대신 심플한 배지 형태 */}
          {item.pageNumber && (
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
              isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {String(item.pageNumber).padStart(2, '0')}
            </span>
          )}
          
          <span className="text-[14px] tracking-tight truncate">
            {item.title}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* 헤더 부분 (이미지 주신 스타일 적용) */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-50">
        <div className="w-1 h-3.5 bg-primary/60 rounded-full" />
        <h3 className="text-[12px] font-bold text-slate-400 tracking-widest uppercase">
          Table of Contents
        </h3>
      </div>

      {/* 목차 리스트: 항목 사이 간격 제거(space-y-0)로 더 깔끔하게 */}
      <div className="py-2 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
        {items.map((item) => renderTocItem(item))}
      </div>
    </div>
  );
}