'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Download,
  ChevronDown,
  Snowflake,
  ExternalLink,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useGhgSession } from '../../lib/ghgSession';
import type { GroupScopeResultRowApi, GroupScopeResultsApi, GroupScopeTrendApi } from '../../lib/ghgGroupScopeApi';
import type { ScopeRecalculateApiResponse } from '../../lib/ghgScopeCalculationData';
import type { GroupEmissionEntityRow } from '../../lib/groupEmissionEntities';
import { fetchWithAuthJson, useAuthSessionStore } from '@/store/authSessionStore';

function formatTco2eq(n: number) {
  return n.toLocaleString('ko-KR');
}

/** Scope 2는 화면에서 정수(반올림)로만 표시 */
function formatScope2Int(n: number) {
  return Math.round(n).toLocaleString('ko-KR');
}

function mapApiRowToEntity(r: GroupScopeResultRowApi): GroupEmissionEntityRow {
  const prev = r.prev_grand_total ?? 0;
  return {
    name: r.name,
    scope1: r.scope1_total,
    scope2: r.scope2_total,
    scope3: r.scope3_total,
    total: r.grand_total,
    prev,
    frozen: r.frozen,
    segment: r.role === 'holding' ? 'domestic' : 'subsidiary',
    segmentLabel: r.role === 'holding' ? '지주 본사' : undefined,
  };
}

function SubsidiaryEmissionResults() {
  const { session } = useGhgSession();
  const companyId = useAuthSessionStore((s) => s.user?.company_id?.trim() ?? '');
  const [yearRange, setYearRange] = useState('2024');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [api, setApi] = useState<ScopeRecalculateApiResponse | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:9001';

  const load = useCallback(async () => {
    if (!companyId) {
      setApi(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuthJson(
        `${apiBase.replace(/\/$/, '')}/ghg-calculation/scope/results?company_id=${encodeURIComponent(companyId)}&year=${encodeURIComponent(yearRange)}&basis=location`,
      );
      if (res.ok) {
        setApi((await res.json()) as ScopeRecalculateApiResponse);
      } else if (res.status === 404) {
        setApi(null);
        setError('해당 연도에 저장된 산정 결과가 없습니다. Scope 산정에서 재계산을 실행하세요.');
      } else {
        setApi(null);
        setError(await res.text().catch(() => res.statusText));
      }
    } catch (e) {
      setApi(null);
      setError(e instanceof Error ? e.message : '조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, companyId, yearRange]);

  useEffect(() => {
    void load();
  }, [load]);

  const row = useMemo(() => {
    if (!api) return null;
    const name = session.corpDisplayName || '본 법인';
    const prev =
      api.prev_year_totals?.grand_total != null && api.comparison_year
        ? api.prev_year_totals.grand_total
        : 0;
    return {
      name,
      scope1: api.scope1_total,
      scope2: api.scope2_total,
      scope3: api.scope3_total,
      total: api.grand_total,
      prev,
      frozen: (api.verification_status || '').toLowerCase() === 'verified',
    };
  }, [api, session.corpDisplayName]);

  const changeRate = useMemo(() => {
    if (!api?.prev_year_totals?.grand_total || api.prev_year_totals.grand_total <= 0) return null;
    const chg = ((api.grand_total - api.prev_year_totals.grand_total) / api.prev_year_totals.grand_total) * 100;
    return chg.toFixed(1);
  }, [api]);

  if (!companyId) {
    return (
      <div className="p-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
          로그인된 회사 ID가 없습니다. 산정 결과를 보려면 로그인하거나 회사를 연결해 주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-gray-900">산정 결과 조회 — {row?.name ?? session.corpDisplayName}</h1>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">계열사</span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            <span className="text-gray-600 font-medium">ghg_emission_results</span> 연간 행(위치기반)입니다. 재계산은 스테이징 DB(활동자료
            JSON)·배출계수 DB만 사용하며, Scope 3는 스테이징 EMS에 적재된 Scope3 상세 행이 있을 때만 집계됩니다. 그룹 통합은 지주 전용입니다.
          </p>
        </div>
        <div className="relative">
          <select
            value={yearRange}
            onChange={(e) => setYearRange(e.target.value)}
            className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-2 text-xs bg-white focus:outline-none focus:border-blue-400"
          >
            {['2026', '2025', '2024', '2023'].map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-6">불러오는 중…</p>
      ) : error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : row ? (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1 bg-[#0d1b36] rounded-xl p-4 text-white">
              <div className="text-white/60 text-xs mb-2">법인 총 배출량</div>
              <div
                className="text-white tabular-nums tracking-tight break-all"
                style={{ fontSize: row.total >= 100000 ? '22px' : '26px', fontWeight: 800, lineHeight: 1.1 }}
              >
                {formatTco2eq(row.total)}
              </div>
              <div className="text-white/50 text-xs mt-0.5">tCO₂eq ({yearRange}년)</div>
              {changeRate != null ? (
                <div
                  className={`flex items-center gap-1 mt-2 text-xs ${parseFloat(changeRate) > 0 ? 'text-red-300' : 'text-emerald-300'}`}
                >
                  {parseFloat(changeRate) > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  전년 대비 {parseFloat(changeRate) > 0 ? '+' : ''}
                  {changeRate}%
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-2 text-xs text-white/45">전년 대비 — (직전년 미저장)</div>
              )}
            </div>
            <div className="bg-white border border-red-100 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Scope 1
              </div>
              <div className="text-gray-900 tabular-nums break-all" style={{ fontSize: '20px', fontWeight: 800 }}>
                {formatTco2eq(row.scope1)}
              </div>
              <div className="text-gray-400 text-xs">tCO₂eq</div>
            </div>
            <div className="bg-white border border-orange-100 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                Scope 2
              </div>
              <div className="text-gray-900 tabular-nums break-all" style={{ fontSize: '20px', fontWeight: 800 }}>
                {formatScope2Int(row.scope2)}
              </div>
              <div className="text-gray-400 text-xs">tCO₂eq</div>
            </div>
            <div className="bg-white border border-purple-100 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                Scope 3
              </div>
              <div className="text-gray-900 tabular-nums break-all" style={{ fontSize: '20px', fontWeight: 800 }}>
                {formatTco2eq(row.scope3)}
              </div>
              <div className="text-gray-400 text-xs">tCO₂eq</div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-gray-800" style={{ fontSize: '13px' }}>
                {row.name} — Scope 요약
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-gray-500">법인</th>
                  <th className="px-4 py-2.5 text-right text-gray-500">Scope 1</th>
                  <th className="px-4 py-2.5 text-right text-gray-500">Scope 2</th>
                  <th className="px-4 py-2.5 text-right text-gray-500">Scope 3</th>
                  <th className="px-4 py-2.5 text-right text-gray-500 border-l border-gray-100">총합</th>
                  <th className="px-4 py-2.5 text-center text-gray-500">동결</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#fafbfc] border-b border-gray-100">
                  <td className="px-4 py-2.5 text-gray-800" style={{ fontWeight: 600 }}>
                    {row.name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{row.scope1.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{formatScope2Int(row.scope2)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{row.scope3.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-900 border-l border-gray-100" style={{ fontWeight: 700 }}>
                    {row.total.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.frozen ? (
                      <Snowflake size={14} className="inline text-blue-400" />
                    ) : (
                      <span className="text-yellow-500 text-xs">진행중</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            마지막 DB 저장:{' '}
            {api?.calculated_at
              ? new Date(api.calculated_at).toLocaleString('ko-KR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : '—'}
            {api?.verification_status != null && api.verification_status !== '' ? (
              <>
                {' '}
                · 검증상태: <span className="text-gray-500">{api.verification_status}</span>
              </>
            ) : null}
            {api?.emission_factor_version ? (
              <>
                {' '}
                · 계수번들: {api.emission_factor_version}
              </>
            ) : null}
          </p>
        </>
      ) : null}
    </div>
  );
}

function HoldingGroupResults() {
  const holdingId = useAuthSessionStore((s) => s.user?.company_id?.trim() ?? '');
  const [yearRange, setYearRange] = useState('2024');
  const [showFrozenOnly, setShowFrozenOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupPayload, setGroupPayload] = useState<GroupScopeResultsApi | null>(null);
  const [trendPayload, setTrendPayload] = useState<GroupScopeTrendApi | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:9001';

  const y = parseInt(yearRange, 10);
  const trendFrom = y - 4;
  const trendTo = y;

  const load = useCallback(async () => {
    if (!holdingId) {
      setGroupPayload(null);
      setTrendPayload(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const base = apiBase.replace(/\/$/, '');
    try {
      const [resGr, resTr] = await Promise.all([
        fetchWithAuthJson(
          `${base}/ghg-calculation/scope/group-results?holding_company_id=${encodeURIComponent(holdingId)}&year=${y}&basis=location`,
        ),
        fetchWithAuthJson(
          `${base}/ghg-calculation/scope/group-trend?holding_company_id=${encodeURIComponent(holdingId)}&year_from=${trendFrom}&year_to=${trendTo}&basis=location`,
        ),
      ]);
      if (!resGr.ok) {
        setGroupPayload(null);
        setTrendPayload(null);
        setError(await resGr.text().catch(() => resGr.statusText));
        return;
      }
      if (!resTr.ok) {
        setGroupPayload((await resGr.json()) as GroupScopeResultsApi);
        setTrendPayload(null);
        setError((await resTr.text().catch(() => resTr.statusText)) || '추세 조회 실패');
        return;
      }
      setGroupPayload((await resGr.json()) as GroupScopeResultsApi);
      setTrendPayload((await resTr.json()) as GroupScopeTrendApi);
      setError(null);
    } catch (e) {
      setGroupPayload(null);
      setTrendPayload(null);
      setError(e instanceof Error ? e.message : '조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, holdingId, y, trendFrom, trendTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const entities = useMemo(() => {
    if (!groupPayload?.rows?.length) return [];
    return groupPayload.rows.map(mapApiRowToEntity);
  }, [groupPayload]);

  const displayed = showFrozenOnly ? entities.filter((c) => c.frozen) : entities;
  const groupTotal = displayed.reduce((s, c) => s + c.total, 0);
  const sumPrev = displayed.reduce((s, c) => s + (c.prev > 0 ? c.prev : 0), 0);
  const changeRate =
    sumPrev > 0 ? (((groupTotal - sumPrev) / sumPrev) * 100).toFixed(1) : '0.0';

  const trendData = useMemo(() => {
    const pts = trendPayload?.points ?? [];
    return pts.map((p) => ({
      year: String(p.year),
      total: p.grand_total,
      scope1: p.scope1_total,
      scope2: p.scope2_total,
      scope3: p.scope3_total,
    }));
  }, [trendPayload]);

  if (!holdingId) {
    return (
      <div className="p-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
          지주 그룹 집계를 보려면 지주사 계정으로 로그인해 주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-gray-900">산정 결과 조회 — 그룹 통합</h1>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">지주사 전용</span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            지주 본사 및 parent_company_id가 지주인 법인의 ghg_emission_results(위치기반)를 합산·비교합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showFrozenOnly} onChange={(e) => setShowFrozenOnly(e.target.checked)} className="rounded" />
            <Snowflake size={12} className="text-blue-400" />
            동결 완료 조직만
          </label>
          <div className="relative">
            <select
              value={yearRange}
              onChange={(e) => setYearRange(e.target.value)}
              className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-2 text-xs bg-white focus:outline-none focus:border-blue-400"
            >
              {['2026', '2025', '2024', '2023'].map((yOpt) => (
                <option key={yOpt} value={yOpt}>
                  {yOpt}년
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={13} /> Excel/CSV
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <ExternalLink size={13} /> SR 페이지에 삽입
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-6">불러오는 중…</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1 bg-[#0d1b36] rounded-xl p-4 text-white">
              <div className="text-white/60 text-xs mb-2">그룹 전체 배출량</div>
              <div
                className="text-white tabular-nums tracking-tight break-all"
                style={{ fontSize: groupTotal >= 1_000_000 ? '20px' : '24px', fontWeight: 800, lineHeight: 1.1 }}
              >
                {formatTco2eq(groupTotal)}
              </div>
              <div className="text-white/50 text-xs mt-0.5">tCO₂eq ({yearRange}년, 표시 행)</div>
              <div className={`flex items-center gap-1 mt-2 text-xs ${parseFloat(changeRate) > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                {parseFloat(changeRate) > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                전년 대비 {parseFloat(changeRate) > 0 ? '+' : ''}
                {changeRate}%
                {sumPrev <= 0 ? <span className="text-white/50 ml-1">(직전년 합계 없음)</span> : null}
              </div>
            </div>
            <div className="bg-white border border-red-100 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Scope 1
              </div>
              <div className="text-gray-900 tabular-nums break-all" style={{ fontSize: '18px', fontWeight: 800 }}>
                {formatTco2eq(displayed.reduce((s, c) => s + c.scope1, 0))}
              </div>
              <div className="text-gray-400 text-xs">tCO₂eq</div>
            </div>
            <div className="bg-white border border-orange-100 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                Scope 2
              </div>
              <div className="text-gray-900 tabular-nums break-all" style={{ fontSize: '18px', fontWeight: 800 }}>
                {formatScope2Int(displayed.reduce((s, c) => s + c.scope2, 0))}
              </div>
              <div className="text-gray-400 text-xs">tCO₂eq</div>
            </div>
            <div className="bg-white border border-purple-100 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                Scope 3
              </div>
              <div className="text-gray-900 tabular-nums break-all" style={{ fontSize: '18px', fontWeight: 800 }}>
                {formatTco2eq(displayed.reduce((s, c) => s + c.scope3, 0))}
              </div>
              <div className="text-gray-400 text-xs">tCO₂eq</div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-gray-800 mb-3" style={{ fontSize: '13px' }}>
                연도별 그룹 배출량 추이 ({trendFrom}~{trendTo}, 합산)
              </h3>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis
                      width={72}
                      tick={{ fontSize: 9, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => v.toLocaleString('ko-KR')}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v: number, name: string) => {
                        const num = name === 'Scope 2' ? Math.round(v) : v;
                        return [`${num.toLocaleString('ko-KR')} tCO₂eq`, name];
                      }}
                    />
                    <Line type="monotone" dataKey="total" stroke="#0d1b36" strokeWidth={2.5} dot={{ r: 3, fill: '#0d1b36' }} name="전체 합계" />
                    <Line type="monotone" dataKey="scope1" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Scope 1" />
                    <Line type="monotone" dataKey="scope2" stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Scope 2" />
                    <Line type="monotone" dataKey="scope3" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Scope 3" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-gray-400 py-8 text-center">해당 구간에 저장된 그룹 산정 데이터가 없습니다.</p>
              )}
            </div>
            <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-gray-800 mb-3" style={{ fontSize: '13px' }}>
                조직별 동결 현황
              </h3>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {entities.map((corp) => (
                  <div key={`${corp.segment}-${corp.name}`} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {corp.frozen ? <Snowflake size={12} className="text-blue-400 shrink-0" /> : <div className="w-3 h-3 rounded-full border-2 border-gray-300 shrink-0" />}
                      <div className="min-w-0">
                        <span className="text-[10px] text-gray-400 block leading-tight">
                          {corp.segment === 'domestic' ? '국내 사업장' : '자회사'}
                          {corp.segmentLabel ? ` · ${corp.segmentLabel}` : ''}
                        </span>
                        <span className="text-xs text-gray-700">{corp.name}</span>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${corp.frozen ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-yellow-600 bg-yellow-50 border-yellow-200'}`}
                    >
                      {corp.frozen ? '동결완료' : '진행중'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400 text-center">
                {entities.filter((c) => c.frozen).length} / {entities.length} 조직 동결 완료 (검증 상태 verified)
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-gray-800" style={{ fontSize: '13px' }}>
                지주·자회사별 배출량 비교 (DB 산정 결과)
              </h3>
            </div>
            {displayed.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center px-4">
                표시할 행이 없습니다. 자회사에 parent_company_id가 지주로 연결되어 있고, 해당 연도에 재계산이 저장되어 있는지 확인하세요.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-gray-500 whitespace-nowrap">구분</th>
                    <th className="px-4 py-2.5 text-left text-gray-500 whitespace-nowrap">유형</th>
                    <th className="px-4 py-2.5 text-left text-gray-500">명칭</th>
                    <th className="px-4 py-2.5 text-right text-gray-500">Scope 1</th>
                    <th className="px-4 py-2.5 text-right text-gray-500">Scope 2</th>
                    <th className="px-4 py-2.5 text-right text-gray-500">Scope 3</th>
                    <th className="px-4 py-2.5 text-right text-gray-500 border-l border-gray-100">총합 (tCO₂eq)</th>
                    <th className="px-4 py-2.5 text-right text-gray-500">전년대비</th>
                    <th className="px-4 py-2.5 text-center text-gray-500">동결</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((corp, i) => {
                    const raw = groupPayload?.rows.find((r) => r.name === corp.name);
                    const chg =
                      raw?.prev_grand_total && raw.prev_grand_total > 0
                        ? ((corp.total - raw.prev_grand_total) / raw.prev_grand_total) * 100
                        : null;
                    return (
                      <tr
                        key={`${corp.segment}-${corp.name}`}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-white' : 'bg-[#fafbfc]'}`}
                      >
                        <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">
                          {corp.segment === 'domestic' ? '국내 사업장' : '자회사'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{corp.segment === 'subsidiary' ? '—' : (corp.segmentLabel ?? '—')}</td>
                        <td className="px-4 py-2.5 text-gray-800" style={{ fontWeight: 500 }}>
                          {corp.name}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{corp.scope1.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{formatScope2Int(corp.scope2)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{corp.scope3.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-gray-900 border-l border-gray-100" style={{ fontWeight: 700 }}>
                          {corp.total.toLocaleString()}
                        </td>
                        <td className={`px-4 py-2.5 text-right text-xs ${chg == null ? 'text-gray-400' : chg > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {chg == null ? (
                            '—'
                          ) : (
                            <div className="flex items-center justify-end gap-0.5">
                              {chg > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                              {chg > 0 ? '+' : ''}
                              {chg.toFixed(1)}%
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {corp.frozen ? <Snowflake size={14} className="inline text-blue-400" /> : <span className="text-yellow-500 text-xs">진행중</span>}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#0d1b36] text-white">
                    <td className="px-4 py-3 text-xs" colSpan={3} style={{ fontWeight: 700 }}>
                      그룹 합계 (표시 행 기준)
                    </td>
                    <td className="px-4 py-3 text-right text-xs">{displayed.reduce((s, c) => s + c.scope1, 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-xs">
                      {formatScope2Int(displayed.reduce((s, c) => s + c.scope2, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">{displayed.reduce((s, c) => s + c.scope3, 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right border-l border-white/10 text-sm" style={{ fontWeight: 800 }}>
                      {groupTotal.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-right text-xs ${parseFloat(changeRate) > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                      {sumPrev > 0 ? (
                        <>
                          {parseFloat(changeRate) > 0 ? '+' : ''}
                          {changeRate}%
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-white/60">
                      {entities.filter((c) => c.frozen).length}/{entities.length}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function GroupResults() {
  const { session } = useGhgSession();
  if (session.tenantType === 'subsidiary') {
    return <SubsidiaryEmissionResults />;
  }
  return <HoldingGroupResults />;
}
