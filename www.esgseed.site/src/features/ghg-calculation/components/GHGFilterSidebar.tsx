'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilterState } from '../types/ghg.types';
import { Filter, RotateCcw } from 'lucide-react';

type PeriodType = 'monthly' | 'quarterly' | 'yearly';

interface GHGFilterSidebarProps {
  initialFilters?: FilterState;
  onFilterChange: (filters: FilterState) => void;
  /** STEP_DETAIL: 조회 버튼 클릭 시 호출 */
  onApplyFilters?: () => void;
  /** STEP_DETAIL: 초기화 시 호출 (적용 필터 해제) */
  onReset?: () => void;
  facilities: string[];
  energySources: string[];
  scope: 'scope1' | 'scope2' | 'scope3';
  /** FILTER_MERGE_STRATEGY: 좌측 사이드바 내 통합 필터로 삽입 시 true. aside 대신 div, 고정 너비 제거 */
  variant?: 'sidebar' | 'embedded';
}

/**
 * 멀티 필터 사이드바 — GHG_UI_Strategy_v2
 * RE:SEED 사이드바 스타일: 어두운 회색 수직 사이드바, 사업장 선택은 여기서만
 */
export function GHGFilterSidebar({
  initialFilters,
  onFilterChange,
  onApplyFilters,
  onReset,
  facilities,
  energySources,
  scope,
  variant = 'sidebar',
}: GHGFilterSidebarProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const filters: FilterState = {
    facilities: initialFilters?.facilities ?? [],
    energySources: initialFilters?.energySources ?? [],
    scope,
    year: initialFilters?.year ?? currentYear,
    month: initialFilters?.month,
    periodType: initialFilters?.periodType ?? 'monthly',
  };

  const setFilters = (patch: Partial<FilterState>) => {
    onFilterChange({ ...filters, ...patch });
  };

  const handleReset = () => {
    onFilterChange({
      facilities: [],
      energySources: [],
      scope,
      periodType: 'monthly',
      year: currentYear,
    });
    onReset?.();
  };

  /** 단일 사업장 선택: "전체" = [], 한 사업장 = [f] */
  const selectedFacilityValue = filters.facilities.length === 0 ? '__전체__' : filters.facilities[0];

  const toggleFacility = (f: string) => {
    const next = filters.facilities.includes(f)
      ? filters.facilities.filter((x) => x !== f)
      : [...filters.facilities, f];
    setFilters({ facilities: next });
  };

  /** SCOPE1,2_DETAIL §1-5: 에너지원 단일 선택. "전체" = [], 한 개 = [s] */
  const selectedEnergyValue = filters.energySources.length === 0 ? '__전체__' : filters.energySources[0];

  const content = (
    <>
      {/* 브랜딩/섹션 */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-slate-400" />
          <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Filter</span>
        </div>
      </div>

      {/* 사업장 — SCOPE1,2_DETAIL §1: 단일 선택 드롭다운 (전체 | 한 사업장) */}
      <div className="p-4 border-b border-slate-700">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">사업장</div>
        <p className="text-xs text-slate-400 mb-2">선택한 한 사업장 데이터만 테이블에 반영됩니다. 전체 합계는 하단 [전체 사업장 합계]에서 확인하세요.</p>
        <Select
          value={selectedFacilityValue}
          onValueChange={(v) => setFilters({ facilities: v === '__전체__' ? [] : [v] })}
        >
          <SelectTrigger className="h-9 w-full bg-slate-700 border-slate-600 text-slate-100">
            <SelectValue placeholder="사업장 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__전체__">전체</SelectItem>
            {facilities.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 에너지원 — SCOPE1,2_DETAIL §1-5: 단일 선택 드롭다운 (전체 | 한 에너지원) */}
      <div className="p-4 border-b border-slate-700">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">에너지원</div>
        <p className="text-xs text-slate-400 mb-2">에너지원을 선택하면 해당 에너지원만 테이블에 표시됩니다. 전체를 보려면 &quot;전체&quot;를 선택하세요.</p>
        <Select
          value={selectedEnergyValue}
          onValueChange={(v) => setFilters({ energySources: v === '__전체__' ? [] : [v] })}
        >
          <SelectTrigger className="h-9 w-full bg-slate-700 border-slate-600 text-slate-100">
            <SelectValue placeholder="에너지원 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__전체__">전체</SelectItem>
            {energySources.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 연도 */}
      <div className="p-4 border-b border-slate-700">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">연도</div>
        <Select value={String(filters.year ?? currentYear)} onValueChange={(v) => setFilters({ year: parseInt(v, 10) })}>
          <SelectTrigger className="h-9 w-full bg-slate-700 border-slate-600 text-slate-100">
            <SelectValue placeholder="연도" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 시기 단위 */}
      <div className="p-4 border-b border-slate-700">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">시기 단위</div>
        <Select value={filters.periodType ?? 'monthly'} onValueChange={(v) => setFilters({ periodType: v as PeriodType })}>
          <SelectTrigger className="h-9 w-full bg-slate-700 border-slate-600 text-slate-100">
            <SelectValue placeholder="시기 단위" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">월별</SelectItem>
            <SelectItem value="quarterly">분기별</SelectItem>
            <SelectItem value="yearly">연간</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* STEP_DETAIL: 조회(확인) 버튼 — 클릭 시에만 조건 적용 */}
      <div className="p-4 space-y-2">
        {onApplyFilters && (
          <Button
            onClick={onApplyFilters}
            className="w-full h-10 bg-[#669900] hover:bg-[#558000] text-white font-semibold"
          >
            조회
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleReset} className="w-full h-9 border-slate-600 text-slate-300 hover:bg-slate-700">
          <RotateCcw className="h-3.5 w-3 mr-2" />
          초기화
        </Button>
      </div>
    </>
  );

  if (variant === 'embedded') {
    return <div className="flex flex-col bg-slate-800 text-slate-100">{content}</div>;
  }
  return (
    <aside className="w-[260px] shrink-0 bg-slate-800 text-slate-100 flex flex-col border-r border-slate-700">
      {content}
    </aside>
  );
}
