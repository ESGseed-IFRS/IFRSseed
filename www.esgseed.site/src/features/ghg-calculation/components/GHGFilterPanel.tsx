'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Filter, X, Calendar } from 'lucide-react';
import { FilterState } from '../types/ghg.types';

interface GHGFilterPanelProps {
  /** 초기 필터 상태 */
  initialFilters?: Partial<FilterState>;
  /** 필터 변경 콜백 */
  onFilterChange: (filters: FilterState) => void;
  /** 사업장 목록 */
  facilities: string[];
  /** 사업장 목록 업데이트(옵션) */
  onFacilitiesUpdate?: (facilities: string[]) => void;
  /** 에너지원 목록 */
  energySources: string[];
  /** Scope 타입 */
  scope: 'scope1' | 'scope2' | 'scope3';
}

/**
 * GHG 산정 필터 패널 컴포넌트
 * 년/월 선택, 사업장, 에너지원 필터링 기능 제공
 */
export function GHGFilterPanel({
  initialFilters,
  onFilterChange,
  facilities,
  onFacilitiesUpdate,
  energySources,
  scope,
}: GHGFilterPanelProps) {
  const [filters, setFilters] = useState<FilterState>({
    facilities: initialFilters?.facilities || [],
    energySources: initialFilters?.energySources || [],
    scope,
    ...initialFilters,
  });

  const [yearMode, setYearMode] = useState<'single' | 'range'>('single');
  const [monthMode, setMonthMode] = useState<'single' | 'range'>('single');

  const [facilityDraft, setFacilityDraft] = useState<string[]>(facilities);
  const [newFacility, setNewFacility] = useState('');

  useEffect(() => {
    setFacilityDraft(facilities);
  }, [facilities]);

  const draftValid = useMemo(() => {
    const cleaned = facilityDraft.map((x) => String(x ?? '').trim()).filter((x) => x.length > 0);
    const unique = cleaned.filter((x, i) => cleaned.indexOf(x) === i);
    return { cleaned, unique, hasDuplicates: unique.length !== cleaned.length };
  }, [facilityDraft]);

  // 현재 년도와 월 가져오기
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 년도 목록 생성 (최근 5년)
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // 월 목록 생성
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // 필터 적용
  const handleApplyFilters = () => {
    onFilterChange(filters);
  };

  // 필터 초기화
  const handleResetFilters = () => {
    const resetFilters: FilterState = {
      facilities: [],
      energySources: [],
      scope,
    };
    setFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  // 사업장 선택 토글
  const toggleFacility = (facility: string) => {
    setFilters((prev) => ({
      ...prev,
      facilities: prev.facilities.includes(facility)
        ? prev.facilities.filter((f) => f !== facility)
        : [...prev.facilities, facility],
    }));
  };

  // 에너지원 선택 토글
  const toggleEnergySource = (source: string) => {
    setFilters((prev) => ({
      ...prev,
      energySources: prev.energySources.includes(source)
        ? prev.energySources.filter((s) => s !== source)
        : [...prev.energySources, source],
    }));
  };

  // 모든 사업장 선택/해제
  const toggleAllFacilities = () => {
    if (filters.facilities.length === facilities.length) {
      setFilters((prev) => ({ ...prev, facilities: [] }));
    } else {
      setFilters((prev) => ({ ...prev, facilities: [...facilities] }));
    }
  };

  // 모든 에너지원 선택/해제
  const toggleAllEnergySources = () => {
    if (filters.energySources.length === energySources.length) {
      setFilters((prev) => ({ ...prev, energySources: [] }));
    } else {
      setFilters((prev) => ({ ...prev, energySources: [...energySources] }));
    }
  };

  return (
    <Card className="w-full sticky top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">필터</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="h-7 px-2 text-muted-foreground"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* 년도 선택 */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">년도</Label>
          <div className="flex items-center gap-2">
            <Select
              value={yearMode}
              onValueChange={(value: 'single' | 'range') => {
                setYearMode(value);
                if (value === 'single') {
                  setFilters((prev) => ({ ...prev, yearRange: undefined }));
                } else {
                  setFilters((prev) => ({ ...prev, year: undefined }));
                }
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">단일</SelectItem>
                <SelectItem value="range">범위</SelectItem>
              </SelectContent>
            </Select>
            {yearMode === 'single' ? (
              <Select
                value={filters.year?.toString() || ''}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, year: parseInt(value) }))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="년도 선택" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <Select
                  value={filters.yearRange?.start?.toString() || ''}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      yearRange: {
                        start: parseInt(value),
                        end: prev.yearRange?.end || parseInt(value),
                      },
                    }))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="시작년도" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}년
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">~</span>
                <Select
                  value={filters.yearRange?.end?.toString() || ''}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      yearRange: {
                        start: prev.yearRange?.start || parseInt(value),
                        end: parseInt(value),
                      },
                    }))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="종료년도" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}년
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* 월 선택 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">월</Label>
          <div className="flex items-center gap-2">
            <Select
              value={monthMode}
              onValueChange={(value: 'single' | 'range') => {
                setMonthMode(value);
                if (value === 'single') {
                  setFilters((prev) => ({ ...prev, monthRange: undefined }));
                } else {
                  setFilters((prev) => ({ ...prev, month: undefined }));
                }
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">단일</SelectItem>
                <SelectItem value="range">범위</SelectItem>
              </SelectContent>
            </Select>
            {monthMode === 'single' ? (
              <Select
                value={filters.month?.toString() || ''}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, month: parseInt(value) }))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="월 선택" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month} value={month.toString()}>
                      {month}월
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <Select
                  value={filters.monthRange?.start?.toString() || ''}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      monthRange: {
                        start: parseInt(value),
                        end: prev.monthRange?.end || parseInt(value),
                      },
                    }))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="시작월" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {month}월
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">~</span>
                <Select
                  value={filters.monthRange?.end?.toString() || ''}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      monthRange: {
                        start: prev.monthRange?.start || parseInt(value),
                        end: parseInt(value),
                      },
                    }))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="종료월" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {month}월
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* 사업장/지점 관리 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">사업장 관리</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setFacilityDraft(facilities)}
                disabled={!onFacilitiesUpdate}
              >
                되돌리기
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  if (!onFacilitiesUpdate) return;
                  onFacilitiesUpdate(draftValid.unique);
                  // 필터에서 선택된 사업장도 현재 목록에 맞춰 정리
                  setFilters((prev) => ({
                    ...prev,
                    facilities: prev.facilities.filter((f) => draftValid.unique.includes(f)),
                  }));
                }}
                disabled={!onFacilitiesUpdate || draftValid.unique.length === 0}
              >
                저장
              </Button>
            </div>
          </div>

          <div className="space-y-2 border border-slate-200 bg-white p-3">
            {facilityDraft.length === 0 ? (
              <div className="text-xs text-slate-600">사업장을 추가해 주세요.</div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {facilityDraft.map((name, idx) => (
                  <div key={`${idx}`} className="flex items-center gap-2">
                    <input
                      value={name}
                      onChange={(e) =>
                        setFacilityDraft((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                      }
                      className="flex-1 border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                      placeholder="예: 본사, 공장1, 지점A"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 text-xs text-red-600 hover:text-red-700"
                      onClick={() => setFacilityDraft((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={!onFacilitiesUpdate}
                    >
                      삭제
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input
                value={newFacility}
                onChange={(e) => setNewFacility(e.target.value)}
                className="flex-1 border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="새 사업장/지점 추가"
                disabled={!onFacilitiesUpdate}
              />
              <Button
                type="button"
                size="sm"
                className="h-9 px-3 text-xs"
                onClick={() => {
                  const v = String(newFacility ?? '').trim();
                  if (!v) return;
                  setFacilityDraft((prev) => [...prev, v]);
                  setNewFacility('');
                }}
                disabled={!onFacilitiesUpdate}
              >
                추가
              </Button>
            </div>

            {draftValid.hasDuplicates && (
              <div className="text-xs text-amber-700">
                동일한 이름이 중복되어 있어요. 저장 시 중복은 자동으로 제거됩니다.
              </div>
            )}
            <div className="text-xs text-slate-600">
              저장하면 Scope 1/2의 사업장 선택/테이블에 즉시 반영됩니다.
            </div>
          </div>
        </div>

        <Separator />

        {/* 사업장 선택 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">사업장</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllFacilities}
              className="text-xs h-6 px-2"
            >
              {filters.facilities.length === facilities.length ? '전체 해제' : '전체 선택'}
            </Button>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {facilities.map((facility) => (
              <div key={facility} className="flex items-center space-x-2">
                <Checkbox
                  id={`facility-${facility}`}
                  checked={filters.facilities.includes(facility)}
                  onCheckedChange={() => toggleFacility(facility)}
                />
                <Label
                  htmlFor={`facility-${facility}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {facility}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* 에너지원 선택 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">에너지원</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllEnergySources}
              className="text-xs h-6 px-2"
            >
              {filters.energySources.length === energySources.length ? '전체 해제' : '전체 선택'}
            </Button>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {energySources.map((source) => (
              <div key={source} className="flex items-center space-x-2">
                <Checkbox
                  id={`source-${source}`}
                  checked={filters.energySources.includes(source)}
                  onCheckedChange={() => toggleEnergySource(source)}
                />
                <Label
                  htmlFor={`source-${source}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {source}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* 적용 버튼 */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleApplyFilters} size="sm" className="flex-1 h-8 text-xs">
            적용
          </Button>
          <Button variant="outline" onClick={handleResetFilters} size="sm" className="flex-1 h-8 text-xs">
            초기화
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
