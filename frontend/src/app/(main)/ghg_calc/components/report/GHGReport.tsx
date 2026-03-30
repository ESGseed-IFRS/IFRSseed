'use client';

import { useMemo, useState } from 'react';
import { FileBarChart2, Download, ChevronDown, CheckCircle2, Package, Snowflake } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useGhgSession } from '../../lib/ghgSession';
import { GHG_SUBSIDIARY_ENTITY_ROWS, type GroupEmissionEntityRow } from '../../lib/groupEmissionEntities';
import {
  buildHoldingGrandForPeriod,
  buildHoldingMonthlyTrend,
  buildHoldingScope1Breakdown,
  buildHoldingScopeTableRowsForPeriod,
  buildScope2PieBreakdown,
  buildScope3PieBreakdown,
  buildSubsidiaryGrandForPeriod,
  buildSubsidiaryMonthlyTrend,
  buildSubsidiaryScope1Breakdown,
  buildSubsidiaryScopeTableRowsForPeriod,
  filterMonthlyByPeriod,
  formatYoy,
  getHoldingReportEntities,
  GHG_REPORT_PERIOD_LABEL,
  type GhgReportPeriodKey,
  sumMonthlyScopes,
} from '../../lib/ghgReportData';

const PIE_COLORS_S1 = ['#ef4444', '#f97316', '#f59e0b', '#22c55e'];
const PIE_COLORS_S2 = ['#ea580c', '#fb923c', '#fdba74'];
const PIE_COLORS_S3 = ['#7c3aed', '#a78bfa', '#c4b5fd', '#8b5cf6'];

function ScopeSummaryTable({
  rows,
  grandTotal,
  grandYoyLabel,
  footerNote = '위치·시장 S2 합산 기준',
}: {
  rows: { scope: string; tCO2eq: number; yoyPct: number; note: string }[];
  grandTotal: number;
  grandYoyLabel: string;
  footerNote?: string;
}) {
  return (
    <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-[#f8fafc] border-b border-gray-200">
          <th className="px-4 py-2.5 text-left text-gray-600">구분</th>
          <th className="px-4 py-2.5 text-right text-gray-600">배출량 (tCO₂eq)</th>
          <th className="px-4 py-2.5 text-right text-gray-600">전년 동기 대비</th>
          <th className="px-4 py-2.5 text-left text-gray-600">비고</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.scope} className="border-b border-gray-100 last:border-0">
            <td className="px-4 py-2.5 text-gray-700" style={{ fontWeight: 500 }}>
              {row.scope}
            </td>
            <td className="px-4 py-2.5 text-right text-gray-900" style={{ fontWeight: 700 }}>
              {row.tCO2eq.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </td>
            <td
              className={`px-4 py-2.5 text-right text-xs ${row.yoyPct > 0 ? 'text-red-500' : row.yoyPct < 0 ? 'text-emerald-600' : 'text-gray-500'}`}
            >
              {formatYoy(row.yoyPct)}
            </td>
            <td className="px-4 py-2.5 text-gray-400 text-xs">{row.note}</td>
          </tr>
        ))}
        <tr className="bg-gray-50">
          <td className="px-4 py-2.5 text-gray-800" style={{ fontWeight: 700 }}>
            총 배출량 합계 (Scope 1+2+3)
          </td>
          <td className="px-4 py-2.5 text-right text-gray-900" style={{ fontWeight: 800 }}>
            {grandTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </td>
          <td
            className={`px-4 py-2.5 text-right text-xs ${grandYoyLabel.startsWith('+') && !grandYoyLabel.startsWith('+0') ? 'text-red-500' : 'text-emerald-600'}`}
          >
            {grandYoyLabel}
          </td>
          <td className="px-4 py-2.5 text-gray-400 text-xs">{footerNote}</td>
        </tr>
      </tbody>
    </table>
  );
}

function EntityBreakdownTable({ entities }: { entities: GroupEmissionEntityRow[] }) {
  return (
    <div>
      <h3 className="text-gray-800 mb-3" style={{ fontSize: '13px' }}>
        2. 조직별 배출 (자회사·국내 사업장)
      </h3>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-gray-200">
              <th className="px-3 py-2 text-left text-gray-600">구분</th>
              <th className="px-3 py-2 text-left text-gray-600">유형</th>
              <th className="px-3 py-2 text-left text-gray-600">명칭</th>
              <th className="px-3 py-2 text-right text-gray-600">Scope 1</th>
              <th className="px-3 py-2 text-right text-gray-600">Scope 2</th>
              <th className="px-3 py-2 text-right text-gray-600">Scope 3</th>
              <th className="px-3 py-2 text-right text-gray-600">합계</th>
              <th className="px-3 py-2 text-center text-gray-600">동결</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((r, i) => (
              <tr key={`${r.segment}-${r.name}`} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                <td className="px-3 py-2 text-gray-600">{r.segment === 'domestic' ? '국내 사업장' : '자회사'}</td>
                <td className="px-3 py-2 text-gray-500">{r.segment === 'subsidiary' ? '—' : r.segmentLabel ?? '—'}</td>
                <td className="px-3 py-2 text-gray-800" style={{ fontWeight: 500 }}>
                  {r.name}
                </td>
                <td className="px-3 py-2 text-right text-gray-700">{r.scope1.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-700">{r.scope2.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-700">{r.scope3.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-900" style={{ fontWeight: 700 }}>
                  {r.total.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.frozen ? <Snowflake size={12} className="inline text-blue-500" /> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function GHGReport() {
  const { session } = useGhgSession();
  const isHolding = session.tenantType === 'holding';
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedPeriod, setSelectedPeriod] = useState<GhgReportPeriodKey>('1Q');
  const [pieScopeTab, setPieScopeTab] = useState<'scope1' | 'scope2' | 'scope3'>('scope1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);

  const holdingEntities = useMemo(() => getHoldingReportEntities(), []);
  const subsidiaryRow = useMemo(
    () => (session.legalEntityId ? GHG_SUBSIDIARY_ENTITY_ROWS.find((r) => r.legalEntityId === session.legalEntityId) : undefined),
    [session.legalEntityId],
  );

  const holdingMonthlyFull = useMemo(() => buildHoldingMonthlyTrend(holdingEntities), [holdingEntities]);
  const holdingMonthlyChart = useMemo(
    () => filterMonthlyByPeriod(holdingMonthlyFull, selectedPeriod),
    [holdingMonthlyFull, selectedPeriod],
  );
  const holdingScopeRows = useMemo(
    () => buildHoldingScopeTableRowsForPeriod(holdingEntities, holdingMonthlyFull, selectedPeriod),
    [holdingEntities, holdingMonthlyFull, selectedPeriod],
  );
  const holdingPeriodSums = useMemo(
    () => sumMonthlyScopes(holdingMonthlyFull, selectedPeriod),
    [holdingMonthlyFull, selectedPeriod],
  );
  const holdingS1Pie = useMemo(
    () => buildHoldingScope1Breakdown(holdingPeriodSums.s1),
    [holdingPeriodSums.s1],
  );
  const holdingS2Pie = useMemo(
    () => buildScope2PieBreakdown(holdingPeriodSums.s2),
    [holdingPeriodSums.s2],
  );
  const holdingS3Pie = useMemo(
    () => buildScope3PieBreakdown(holdingPeriodSums.s3),
    [holdingPeriodSums.s3],
  );
  const holdingGrand = useMemo(
    () => buildHoldingGrandForPeriod(holdingEntities, holdingMonthlyFull, selectedPeriod),
    [holdingEntities, holdingMonthlyFull, selectedPeriod],
  );

  const subMonthlyFull = useMemo(
    () => (subsidiaryRow ? buildSubsidiaryMonthlyTrend(subsidiaryRow) : []),
    [subsidiaryRow],
  );
  const subMonthlyChart = useMemo(
    () => (subMonthlyFull.length ? filterMonthlyByPeriod(subMonthlyFull, selectedPeriod) : []),
    [subMonthlyFull, selectedPeriod],
  );
  const subScopeRows = useMemo(
    () =>
      subsidiaryRow ? buildSubsidiaryScopeTableRowsForPeriod(subsidiaryRow, subMonthlyFull, selectedPeriod) : [],
    [subsidiaryRow, subMonthlyFull, selectedPeriod],
  );
  const subPeriodSums = useMemo(
    () => (subMonthlyFull.length ? sumMonthlyScopes(subMonthlyFull, selectedPeriod) : { s1: 0, s2: 0, s3: 0 }),
    [subMonthlyFull, selectedPeriod],
  );
  const subS1Pie = useMemo(() => buildHoldingScope1Breakdown(subPeriodSums.s1), [subPeriodSums.s1]);
  const subS2Pie = useMemo(() => buildScope2PieBreakdown(subPeriodSums.s2), [subPeriodSums.s2]);
  const subS3Pie = useMemo(() => buildScope3PieBreakdown(subPeriodSums.s3), [subPeriodSums.s3]);
  const subGrand = useMemo(
    () =>
      subsidiaryRow
        ? buildSubsidiaryGrandForPeriod(subsidiaryRow, subMonthlyFull, selectedPeriod)
        : { total: 0, yoyLabel: '—' },
    [subsidiaryRow, subMonthlyFull, selectedPeriod],
  );

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setReportReady(true);
    }, 1800);
  };

  const reportTitleSuffix = isHolding ? '그룹 통합' : subsidiaryRow?.name ?? session.corpDisplayName;
  const reportSubtitle = isHolding
    ? '자회사 및 국내 사업장 배출량 취합 (mock · 산정결과와 동일 출처)'
    : '본 법인 기준 (산정결과와 동일 출처)';

  if (!isHolding && !subsidiaryRow) {
    return (
      <div className="p-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
          보고서를 생성할 법인 데이터가 없습니다. 헤더에서「계열사」관점과 법인 설정(
          <code className="text-xs">NEXT_PUBLIC_GHG_LEGAL_ENTITY</code>)을 확인해 주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">3-3. GHG 보고서 출력</span>
            {isHolding ? (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200">지주</span>
            ) : (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">계열사</span>
            )}
          </div>
          <h1 className="text-gray-900">GHG 보고서 출력</h1>
          <p className="text-gray-500 text-xs mt-0.5">{reportSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-2 text-xs bg-white focus:outline-none focus:border-blue-400"
            >
              {['2026', '2025', '2024'].map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as GhgReportPeriodKey)}
              className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-2 text-xs bg-white focus:outline-none focus:border-blue-400"
            >
              {(['1Q', '2Q', '3Q', '4Q', 'FY'] as const).map((v) => (
                <option key={v} value={v}>
                  {GHG_REPORT_PERIOD_LABEL[v]}
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {reportReady ? (
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Download size={13} /> PDF 다운로드
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-[#0d1b36] rounded-lg hover:bg-[#1a3060] disabled:opacity-50 transition-colors"
            >
              {isGenerating ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FileBarChart2 size={13} />
              )}
              {isGenerating ? '생성 중...' : '보고서 생성'}
            </button>
          )}
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Package size={13} /> 증빙 패키지
          </button>
        </div>
      </div>

      {reportReady && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-700">
          <CheckCircle2 size={14} /> GHG 보고서가 생성되었습니다. PDF / Excel 형식으로 다운로드 가능합니다.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-[#0d1b36] px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-white/60 text-xs mb-1">GHG Emissions Report · GHG Protocol 기준</div>
              <div className="text-white" style={{ fontSize: '18px', fontWeight: 700 }}>
                온실가스 배출량 보고서
              </div>
              <div className="text-white/70 text-xs mt-1">
                {reportTitleSuffix} · {selectedYear}년 {GHG_REPORT_PERIOD_LABEL[selectedPeriod]}
              </div>
            </div>
            <div className="text-right">
              <div className="text-white/50 text-xs">보고일</div>
              <div className="text-white text-xs" style={{ fontWeight: 600 }}>
                2026-03-06
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <h3 className="text-gray-800 mb-3" style={{ fontSize: '13px' }}>
              1. 배출량 통계 결과 (Scope 1·2·3)
            </h3>
            {isHolding ? (
              <ScopeSummaryTable
                rows={holdingScopeRows}
                grandTotal={holdingGrand.total}
                grandYoyLabel={holdingGrand.yoyLabel}
                footerNote={`${GHG_REPORT_PERIOD_LABEL[selectedPeriod]} · 위치·시장 S2 합산`}
              />
            ) : (
              <ScopeSummaryTable
                rows={subScopeRows}
                grandTotal={subGrand.total}
                grandYoyLabel={subGrand.yoyLabel}
                footerNote={`${GHG_REPORT_PERIOD_LABEL[selectedPeriod]} · 위치·시장 S2 합산`}
              />
            )}
          </div>

          {isHolding && <EntityBreakdownTable entities={holdingEntities} />}

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <h3 className="text-gray-800 mb-3" style={{ fontSize: '13px' }}>
                {isHolding ? '3. 월별 배출량 추이 (그룹 합산)' : '2. 월별 배출량 추이 (본 법인)'}
                <span className="text-gray-400 font-normal ml-1">· {GHG_REPORT_PERIOD_LABEL[selectedPeriod]}</span>
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={isHolding ? holdingMonthlyChart : subMonthlyChart} barSize={14} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [`${v.toFixed(1)} tCO₂eq`]} />
                  <Bar dataKey="s1" stackId="a" fill="#ef4444" name="Scope 1" />
                  <Bar dataKey="s2" stackId="a" fill="#f97316" name="Scope 2" />
                  <Bar dataKey="s3" stackId="a" fill="#8b5cf6" name="Scope 3" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3 className="text-gray-800 mb-2" style={{ fontSize: '13px' }}>
                Scope별 세부 breakdown
              </h3>
              <p className="text-[10px] text-gray-400 mb-2">
                선택 구간({GHG_REPORT_PERIOD_LABEL[selectedPeriod]}) 기준 Scope 1·2·3 구성비입니다.
              </p>
              <div className="flex gap-1 mb-2">
                {(
                  [
                    { key: 'scope1' as const, label: 'Scope 1' },
                    { key: 'scope2' as const, label: 'Scope 2' },
                    { key: 'scope3' as const, label: 'Scope 3' },
                  ]
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setPieScopeTab(t.key)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] border transition-colors ${
                      pieScopeTab === t.key
                        ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={
                      pieScopeTab === 'scope1'
                        ? isHolding
                          ? holdingS1Pie
                          : subS1Pie
                        : pieScopeTab === 'scope2'
                          ? isHolding
                            ? holdingS2Pie
                            : subS2Pie
                          : isHolding
                            ? holdingS3Pie
                            : subS3Pie
                    }
                    cx="50%"
                    cy="50%"
                    outerRadius={56}
                    dataKey="value"
                    nameKey="name"
                  >
                    {(
                      pieScopeTab === 'scope1'
                        ? isHolding
                          ? holdingS1Pie
                          : subS1Pie
                        : pieScopeTab === 'scope2'
                          ? isHolding
                            ? holdingS2Pie
                            : subS2Pie
                          : isHolding
                            ? holdingS3Pie
                            : subS3Pie
                    ).map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          (pieScopeTab === 'scope1'
                            ? PIE_COLORS_S1
                            : pieScopeTab === 'scope2'
                              ? PIE_COLORS_S2
                              : PIE_COLORS_S3)[i % 8]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 10, borderRadius: 6 }}
                    formatter={(v: number) => [`${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂eq`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 space-y-1 max-h-[88px] overflow-y-auto pr-1">
                {(
                  pieScopeTab === 'scope1'
                    ? isHolding
                      ? holdingS1Pie
                      : subS1Pie
                    : pieScopeTab === 'scope2'
                      ? isHolding
                        ? holdingS2Pie
                        : subS2Pie
                      : isHolding
                        ? holdingS3Pie
                        : subS3Pie
                ).map((seg, i) => (
                  <li key={seg.name} className="flex items-center justify-between gap-2 text-[10px] text-gray-600">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          background:
                            (pieScopeTab === 'scope1'
                              ? PIE_COLORS_S1
                              : pieScopeTab === 'scope2'
                                ? PIE_COLORS_S2
                                : PIE_COLORS_S3)[i % 8],
                        }}
                      />
                      <span className="truncate">{seg.name}</span>
                    </span>
                    <span className="tabular-nums shrink-0 text-gray-800" style={{ fontWeight: 600 }}>
                      {seg.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="text-gray-800 mb-3" style={{ fontSize: '13px' }}>
              {isHolding ? '4. 기본 산정 방법 개요' : '3. 기본 산정 방법 개요'}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              {[
                ['산정 기준', 'GHG Protocol Corporate Standard'],
                ['배출계수 출처', '국가 온실가스 배출·흡수계수 고시 (2024년) / IPCC AR5'],
                ['Scope 경계', isHolding ? '그룹 운영 통제 · 자회사·국내 사업장 포함' : '본 법인 운영 통제'],
                ['GWP 기준', 'IPCC 5차 보고서 (AR5), 100년 기준'],
                ['기준연도', '2020년 (재계산 트리거 조건 검토 중)'],
                ['검증 수준', '제3자 검증 예정 (2026년 하반기)'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-gray-400 shrink-0 w-28">{k}</span>
                  <span className="text-gray-700">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
