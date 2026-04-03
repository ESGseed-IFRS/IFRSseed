'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { BoundaryPolicy, OrganizationBoundary } from '../types/ghg.types';
import { useGHGStore } from '../store/ghg.store';

/** GHG_Strategy2.md: 조직 경계 선택 (사용자가 선택) */
const ORGANIZATION_BOUNDARY_OPTIONS: { value: OrganizationBoundary; label: string }[] = [
  { value: 'operational_control', label: '운영통제법 (Operational Control)' },
  { value: 'equity_share', label: '지분비율법 (Equity Share)' },
  { value: 'financial_control', label: '재무통제법 (Financial Control)' },
];

/** 전략서: Scope 1 포함 기준 — 멀티 선택 (연료 연소 + 공정 배출 동시 선택 가능) */
const SCOPE1_INCLUSION_OPTIONS = [
  { value: '직접 연료 연소 포함', label: '직접 연료 연소 포함' },
  { value: '공정 배출 포함', label: '공정 배출 포함' },
];
/** 전략서: Scope 2 포함 기준 — 기본값: 위치 기반 & 시장 기반 동시 산정 */
const SCOPE2_INCLUSION_OPTIONS = [
  { value: '위치 기반 & 시장 기반 동시 산정', label: '위치 기반 & 시장 기반 동시 산정' },
  { value: '위치 기반 (Location-based)', label: '위치 기반 (Location-based)' },
  { value: '시장 기반 (Market-based)', label: '시장 기반 (Market-based)' },
];

/** 산정 설정 완료 여부: 조직경계·운영경계·보고연도·기준 가이드라인 필수 (미설정 시 활동자료 입력 차단용) */
export function isBoundaryComplete(policy: BoundaryPolicy): boolean {
  const scope1 = policy.operationalBoundary.scope1Included;
  const hasScope1 = Array.isArray(scope1) ? scope1.length > 0 : (scope1 as unknown as string)?.trim?.()?.length > 0;
  const hasScope2 = policy.operationalBoundary.scope2Included?.trim().length > 0;
  const hasYear = policy.reportingYear >= 2000 && policy.reportingYear <= 2030;
  const hasGuideline = policy.guideline?.trim().length > 0;
  const hasPurpose = !policy.reportPurpose || policy.reportPurpose.kEts || policy.reportPurpose.global;
  return !!policy.organizationBoundary && hasScope1 && hasScope2 && hasYear && hasGuideline && hasPurpose;
}

/**
 * [산정 설정] - Boundary & Policy Layer
 * GHG Protocol 준수 증명: 조직경계, 운영경계, 보고연도, 기준 가이드라인 + 버전 명시
 * 설정 완료 시 녹색 + "준수 설정 완료" 표시
 */
export function GHGBoundarySettings() {
  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);
  const setBoundaryPolicy = useGHGStore((s) => s.setBoundaryPolicy);

  const isComplete = useMemo(() => isBoundaryComplete(boundaryPolicy), [boundaryPolicy]);

  const handleChange = <K extends keyof BoundaryPolicy>(key: K, value: BoundaryPolicy[K]) => {
    setBoundaryPolicy({ ...boundaryPolicy, [key]: value });
  };

  const handleOperationalChange = (field: 'scope1Included' | 'scope2Included', value: string) => {
    handleChange('operationalBoundary', {
      ...boundaryPolicy.operationalBoundary,
      [field]: value,
    });
  };

  const reportPurpose = boundaryPolicy.reportPurpose ?? { kEts: true, global: true };
  const setReportPurpose = (key: 'kEts' | 'global', checked: boolean) => {
    const next = { ...reportPurpose, [key]: checked };
    setBoundaryPolicy({
      ...boundaryPolicy,
      reportPurpose: next,
      organizationBoundary: next.kEts ? 'operational_control' : boundaryPolicy.organizationBoundary,
    });
  };
  const isKets = reportPurpose.kEts;
  const scope1Arr = Array.isArray(boundaryPolicy.operationalBoundary.scope1Included)
    ? boundaryPolicy.operationalBoundary.scope1Included
    : boundaryPolicy.operationalBoundary.scope1Included
      ? [boundaryPolicy.operationalBoundary.scope1Included as unknown as string]
      : [];
  const toggleScope1 = (value: string, checked: boolean) => {
    const next = checked ? [...scope1Arr.filter((s) => s !== value), value] : scope1Arr.filter((s) => s !== value);
    handleChange('operationalBoundary', { ...boundaryPolicy.operationalBoundary, scope1Included: next });
  };

  return (
    <Card className={isComplete ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-primary/20 bg-primary/5'}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Settings2 className={isComplete ? 'h-4 w-4 text-green-600' : 'h-4 w-4 text-primary'} />
          [1] 산정 설정
        </CardTitle>
        <CardDescription
          className={`text-xs flex items-center gap-1.5 mt-1 flex-wrap ${isComplete ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}
        >
          {isComplete ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="font-medium">준수 설정 완료!</span>
              <span className="text-muted-foreground font-normal">조직경계·운영경계·보고연도·기준 가이드라인이 설정되었습니다. 활동자료 입력을 진행하세요.</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>이 설정 없이는 GHG Protocol 준수 주장 자체가 불가능합니다.</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* 보고 목적 (K-ETS / 글로벌) — 최소 변경 UI */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
          <Label className="text-sm font-semibold text-slate-700">보고 목적</Label>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={reportPurpose.kEts}
                onCheckedChange={(c) => setReportPurpose('kEts', !!c)}
              />
              <span className="text-sm font-medium">K-ETS (국내 배출권거래제)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={reportPurpose.global}
                onCheckedChange={(c) => setReportPurpose('global', !!c)}
              />
              <span className="text-sm font-medium">글로벌 (CDP / RE100)</span>
            </label>
          </div>
          <p className="text-xs text-slate-500">둘 다 선택 시 동일 입력으로 국내·글로벌 기준을 동시 산정합니다.</p>
        </div>

        {/* GHG_Strategy2.md 순서: 조직경계 → 운영경계 → 기준 가이드라인 → 보고연도 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">조직 경계 (Organizational Boundary)</Label>
            {isKets ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-sm font-medium text-slate-700">
                  운영통제법 (Operational Control)
                </div>
                <p className="text-xs text-amber-700 font-medium">국내 법령에 따라 운영통제법이 적용됩니다.</p>
              </>
            ) : (
              <>
                <Select
                  value={boundaryPolicy.organizationBoundary}
                  onValueChange={(v) => handleChange('organizationBoundary', v as OrganizationBoundary)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="경계 선택..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ORGANIZATION_BOUNDARY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 italic">재무통제, 지분비율 등 선택 가능합니다.</p>
              </>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">보고 연도 (Reporting Year)</Label>
            <Input
              type="number"
              min={2000}
              max={2030}
              value={boundaryPolicy.reportingYear}
              onChange={(e) => handleChange('reportingYear', parseInt(e.target.value, 10) || new Date().getFullYear())}
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-semibold text-slate-700">운영 경계 (Operational Boundary)</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
              <span className="text-xs font-bold text-emerald-600 uppercase">Scope 1 (멀티 선택)</span>
              <p className="text-xs text-slate-500 mt-1 mb-2">연료 연소와 공정 배출을 동시에 포함할 수 있습니다.</p>
              <div className="space-y-2 mt-2">
                {SCOPE1_INCLUSION_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={scope1Arr.includes(opt.value)}
                      onCheckedChange={(c) => toggleScope1(opt.value, !!c)}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
              <span className="text-xs font-bold text-blue-600 uppercase">Scope 2</span>
              <Select
                value={boundaryPolicy.operationalBoundary.scope2Included || ''}
                onValueChange={(v) => handleOperationalChange('scope2Included', v)}
              >
                <SelectTrigger className="mt-2 bg-transparent border-b border-slate-300 rounded-none border-x-0 border-t-0 shadow-none">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE2_INCLUSION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>준수 경고:</strong> 설정된 경계는 이후 산정 과정에서 변경할 경우 데이터 정합성 이슈가 발생할 수 있습니다.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">기준 가이드라인 (Standard Guideline)</Label>
          <Input
            placeholder="예: GHG Protocol Corporate Standard (2004 + Scope 3 Guidance 보완)"
            value={boundaryPolicy.guideline}
            onChange={(e) => handleChange('guideline', e.target.value)}
            className="resize-none"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">적용 기준 버전 (세부)</Label>
            <Input
              placeholder="예: GHG Protocol Revised Edition (2004) + Scope 2 Guidance (2015)"
              value={boundaryPolicy.guidelineVersion ?? ''}
              onChange={(e) => handleChange('guidelineVersion', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">EF DB 버전 명시</Label>
            <Input
              placeholder="예: 환경부 국가 온실가스 배출계수 (2025 버전)"
              value={boundaryPolicy.efDbVersion ?? ''}
              onChange={(e) => handleChange('efDbVersion', e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground pt-1">
          설정은 자동으로 저장되며, 다음 방문 시 복원됩니다.
        </p>
      </CardContent>
    </Card>
  );
}
