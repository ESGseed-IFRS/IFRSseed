'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { FilterState } from '../types/ghg.types';
import { Filter, RotateCcw, ChevronDown } from 'lucide-react';

type PeriodType = 'monthly' | 'quarterly' | 'yearly';

interface GHGMultiFilterBarProps {
  initialFilters?: FilterState;
  onFilterChange: (filters: FilterState) => void;
  facilities: string[];
  energySources: string[];
  scope: 'scope1' | 'scope2' | 'scope3';
}

/**
 * 멀티 필터 바: [사업장 선택] | [에너지원] | [연도] | [월별/분기별/연간]
 * GHG_EMS_Excel_Data_Strategy - 상단 인라인 배치 (항상 노출)
 */
export function GHGMultiFilterBar({
  initialFilters,
  onFilterChange,
  facilities,
  energySources,
  scope,
}: GHGMultiFilterBarProps) {
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
    });
  };

  const toggleFacility = (f: string) => {
    const next = filters.facilities.includes(f)
      ? filters.facilities.filter((x) => x !== f)
      : [...filters.facilities, f];
    setFilters({ facilities: next });
  };

  const toggleEnergySource = (s: string) => {
    const next = filters.energySources.includes(s)
      ? filters.energySources.filter((x) => x !== s)
      : [...filters.energySources, s];
    setFilters({ energySources: next });
  };

  const facilityLabel =
    filters.facilities.length === 0
      ? '사업장 선택'
      : filters.facilities.length === facilities.length
        ? '전체'
        : `${filters.facilities.length}개 선택`;

  const energyLabel =
    filters.energySources.length === 0
      ? '에너지원'
      : filters.energySources.length === energySources.length
        ? '전체'
        : `${filters.energySources.length}개 선택`;

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
      <div className="flex items-center gap-2 text-slate-600">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-semibold">멀티 필터</span>
      </div>

      <div className="h-5 w-px bg-slate-300" />

      {/* 사업장 선택 (다중) */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 min-w-[140px] justify-between bg-white">
            {facilityLabel}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {facilities.map((f) => (
              <label key={f} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.facilities.length === 0 || filters.facilities.includes(f)}
                  onCheckedChange={() => toggleFacility(f)}
                />
                <span className="text-sm">{f}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-2 pt-2 border-t">
            <Button size="sm" variant="ghost" onClick={() => setFilters({ facilities: [] })}>
              해제
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFilters({ facilities: [...facilities] })}>
              전체
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <span className="text-slate-400">|</span>

      {/* 에너지원 (다중) */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 min-w-[120px] justify-between bg-white">
            {energyLabel}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {energySources.map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.energySources.length === 0 || filters.energySources.includes(s)}
                  onCheckedChange={() => toggleEnergySource(s)}
                />
                <span className="text-sm">{s}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-2 pt-2 border-t">
            <Button size="sm" variant="ghost" onClick={() => setFilters({ energySources: [] })}>
              해제
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFilters({ energySources: [...energySources] })}>
              전체
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <span className="text-slate-400">|</span>

      {/* 연도 */}
      <Select
        value={String(filters.year ?? currentYear)}
        onValueChange={(v) => setFilters({ year: parseInt(v, 10) })}
      >
        <SelectTrigger className="w-[100px] h-9 bg-white border-slate-200">
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

      <span className="text-slate-400">|</span>

      {/* 월별/분기별/연간 */}
      <Select
        value={filters.periodType ?? 'monthly'}
        onValueChange={(v) => setFilters({ periodType: v as PeriodType })}
      >
        <SelectTrigger className="w-[120px] h-9 bg-white border-slate-200">
          <SelectValue placeholder="시기 단위" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly">월별</SelectItem>
          <SelectItem value="quarterly">분기별</SelectItem>
          <SelectItem value="yearly">연간</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={handleReset} className="h-9 px-3">
        <RotateCcw className="h-3.5 w-3 mr-1" />
        초기화
      </Button>
    </div>
  );
}
