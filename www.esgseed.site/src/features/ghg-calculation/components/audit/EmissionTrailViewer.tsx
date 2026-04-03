'use client';

import { useState } from 'react';
import {
  Check,
  AlertTriangle,
  XCircle,
  Minus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useGHGStore } from '../../store/ghg.store';
import { SCOPE1_METHODOLOGY, SCOPE2_ELECTRICITY_METHODOLOGY } from '../MethodologyDetailPanel';
import type { Scope1FormData, Scope2FormData, Scope3FormData } from '../../types/ghg.types';

type RequirementStatus = 'ok' | 'partial' | 'fail' | 'na';
type TrackingType = 'activity' | 'factor' | 'emission';

type RequirementRow = {
  id: string;
  category: string;
  trackingType: TrackingType;
  title: string;
  description: string;
  status: RequirementStatus;
  detail: string;
};

function useRequirements(
  scope1: Scope1FormData,
  scope2: Scope2FormData,
  scope3: Scope3FormData,
  boundaryPolicy: { operationalBoundary?: { scope1Included?: unknown; scope2Included?: string }; efDbVersion?: string; organizationBoundary?: string; reportingYear?: number } | null
): RequirementRow[] {
  const ob = boundaryPolicy?.operationalBoundary;
  const scope2Included = ob?.scope2Included ?? '';
  const totalRows = scope1.stationary.length + scope1.mobile.length + scope2.electricity.length;
  const withDq =
    scope1.stationary.filter((r) => r.dataQuality?.dataType).length +
    scope1.mobile.filter((r) => r.dataQuality?.dataType).length +
    scope2.electricity.filter((r) => r.dataQuality?.dataType).length;
  const hasDataQuality = () => {
    if (totalRows === 0) return { status: 'na' as const, detail: '활동자료 없음' };
    if (withDq === totalRows) return { status: 'ok' as const, detail: `전수 입력 (${withDq}건)` };
    if (withDq > 0) return { status: 'partial' as const, detail: `${withDq}/${totalRows}건 데이터 품질 입력` };
    return { status: 'fail' as const, detail: '데이터 품질(실측/추정) 미입력' };
  };
  const hasEstimated = [...scope1.stationary, ...scope1.mobile, ...scope2.electricity].some((r) => r.dataQuality?.dataType === 'estimated');
  const confidenceLevel = hasEstimated ? 'Medium (Level 2)' : 'High (Level 1)';
  const receiptCount = scope3.categories.reduce((s, c) => s + (c.receipts?.length ?? 0), 0);
  const hasReceipts = receiptCount > 0;
  const s2Dual = scope2Included.includes('시장') || scope2Included.includes('동시');
  const hasScope2Data = scope2.electricity.length > 0;

  return [
    { id: 'ef-gwp', category: '산출 근거', trackingType: 'factor', title: '배출계수(EF)·GWP·산식 명시', description: '', status: boundaryPolicy?.efDbVersion ? 'ok' : 'fail', detail: boundaryPolicy?.efDbVersion ? `적용 배출계수: ${boundaryPolicy.efDbVersion}, GWP: ${SCOPE1_METHODOLOGY.gwp} 100년` : '산정 설정에서 EF DB 버전을 확인하세요.' },
    { id: 'scope-formula', category: '산출 근거', trackingType: 'factor', title: 'Scope별 산식 적용', description: '', status: totalRows > 0 ? 'ok' : 'na', detail: `Scope 1: ${SCOPE1_METHODOLOGY.formula}. Scope 2 전력: ${SCOPE2_ELECTRICITY_METHODOLOGY.formula}` },
    { id: 'ncv', category: '산출 근거', trackingType: 'factor', title: '순발열량(NCV) 적용 기준', description: '', status: 'ok', detail: '순발열량(NCV): 에너지원별 국가 표준값(Tier 2) 적용.' },
    { id: 'data-quality', category: '데이터 품질', trackingType: 'activity', title: '활동자료 실측/추정 구분', description: '', ...hasDataQuality() },
    { id: 'evidence-link', category: '증빙·계보', trackingType: 'activity', title: '증빙 파일 연결', description: '', status: hasReceipts ? 'partial' : 'fail', detail: hasReceipts ? `Scope 3 영수증 ${receiptCount}건 연결됨.` : '고지서·영수증을 첨부하세요.' },
    { id: 'uncertainty', category: '데이터 품질', trackingType: 'emission', title: '불확실성 등급', description: '', status: 'ok', detail: `데이터 신뢰도: ${confidenceLevel}` },
    { id: 'org-boundary', category: '조직·운영 경계', trackingType: 'emission', title: '조직 경계 명시', description: '', status: boundaryPolicy?.organizationBoundary ? 'ok' : 'fail', detail: boundaryPolicy?.organizationBoundary ? `조직 경계: ${boundaryPolicy.organizationBoundary === 'operational_control' ? '운영통제법' : boundaryPolicy.organizationBoundary}` : '산정 설정을 확인하세요.' },
    { id: 'reporting-scope', category: '조직·운영 경계', trackingType: 'emission', title: '보고 연도·산정 범위', description: '', status: boundaryPolicy?.reportingYear && ob?.scope1Included && ob?.scope2Included ? 'ok' : 'fail', detail: boundaryPolicy?.reportingYear ? `보고 연도: ${boundaryPolicy.reportingYear}년` : '산정 설정을 확인하세요.' },
    { id: 'scope2-dual', category: 'Scope 2', trackingType: 'emission', title: '위치·시장 기반 이중 산정', description: '', status: !hasScope2Data ? 'na' : s2Dual ? 'ok' : 'partial', detail: s2Dual ? '위치 기반·시장 기반 동시 산정 적용됨.' : hasScope2Data ? '시장 기반 산정 포함 시 산정 설정을 변경하세요.' : 'Scope 2 전력 데이터 없음.' },
  ];
}

function StatusBadge({ status }: { status: RequirementStatus }) {
  if (status === 'ok') return <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-sm font-medium text-emerald-700"><Check className="h-3.5 w-3.5 stroke-[1.5]" /> 충족</span>;
  if (status === 'partial') return <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-sm font-medium text-amber-700"><AlertTriangle className="h-3.5 w-3.5 stroke-[1.5]" /> 일부</span>;
  if (status === 'fail') return <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-sm font-medium text-red-700"><XCircle className="h-3.5 w-3.5 stroke-[1.5]" /> 미충족</span>;
  return <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-600"><Minus className="h-3.5 w-3.5 stroke-[1.5]" /> 해당 없음</span>;
}

const TRACKING_LABELS: Record<TrackingType, string> = {
  activity: '활동자료(Activity Data)',
  factor: '배출계수(Emission Factor)',
  emission: '산정결과(Calculated Emissions)',
};

export type EmissionTrailSubTab = 'all' | 'activity' | 'factor' | 'emission';

export interface EmissionTrailViewerProps {
  activeSubTab?: EmissionTrailSubTab;
}

export function EmissionTrailViewer({ activeSubTab = 'all' }: EmissionTrailViewerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<EmissionTrailSubTab>(activeSubTab);
  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const scope3 = useGHGStore((s) => s.scope3);
  const ob = boundaryPolicy?.operationalBoundary;

  const requirements = useRequirements(scope1, scope2, scope3, boundaryPolicy);
  const filtered = subTab === 'all' ? requirements : requirements.filter((r) => r.trackingType === subTab);

  return (
    <div className="space-y-6 leading-relaxed">
      <h2 className="text-xl font-bold text-slate-900">배출량별 감사 추적</h2>
      <p className="text-base text-slate-600">
        활동자료, 배출계수, 산정결과별로 공시 기준 요구사항 충족 여부를 확인합니다.
      </p>
      <div className="flex gap-2 border-b border-slate-200">
        {(['all', 'activity', 'factor', 'emission'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subTab === t ? 'border-primary text-primary' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t === 'all' ? '전체' : TRACKING_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="border border-slate-200 overflow-hidden rounded-lg">
        <table className="w-full text-left text-base">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="w-8 p-3" />
              <th className="p-3 font-semibold text-slate-700 w-40">추적 유형</th>
              <th className="p-3 font-semibold text-slate-700 w-28">요건 분류</th>
              <th className="p-3 font-semibold text-slate-700">요건 항목</th>
              <th className="p-3 font-semibold text-slate-700 w-24">상태</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const isExpanded = expandedId === row.id;
              return (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="p-3">
                    <button type="button" onClick={() => setExpandedId(isExpanded ? null : row.id)} className="text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="p-3 text-slate-600">{TRACKING_LABELS[row.trackingType]}</td>
                  <td className="p-3 text-slate-600">{row.category}</td>
                  <td className="p-3 font-medium text-slate-900">{row.title}</td>
                  <td className="p-3"><StatusBadge status={row.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.filter((r) => r.id === expandedId).map((row) => (
        <div key={row.id} className="border border-slate-200 border-t-0 rounded-b-lg bg-slate-50 px-5 py-4 text-base text-slate-700">
          <p className="font-medium text-slate-900 mb-1">{row.title}</p>
          <p>{row.detail}</p>
        </div>
      ))}
    </div>
  );
}
