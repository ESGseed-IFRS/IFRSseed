'use client';

import { useMemo, useState } from 'react';
import { ESG_ITEMS } from '@/app/(main)/sr-report/lib/esgItems';
import { STD_STYLE } from '@/app/(main)/sr-report/lib/platformConstants';
import { GENERATE_DOWNLOAD_LOG, type GenerateDownloadRow } from '@/app/(main)/sr-report/lib/platformData';

type StandardId = 'issb' | 'gri' | 'esrs';

const STANDARDS: {
  id: StandardId;
  label: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  { id: 'issb', label: 'ISSB', subtitle: 'IFRS S1·S2', color: '#185FA5', bg: '#EFF5FC', border: '#185FA5' },
  { id: 'gri', label: 'GRI', subtitle: 'GRI Standards 2021', color: '#3B6D11', bg: '#EAF3DE', border: '#639922' },
  { id: 'esrs', label: 'ESRS', subtitle: 'CSRD·ESRS', color: '#633806', bg: '#FAEEDA', border: '#8B5A2B' },
];

/** 기준별·통합 모두 PPT / Excel만 제공 */
const FMT_BTN: { id: string; label: string; color: string }[] = [
  { id: 'PowerPoint', label: 'PowerPoint', color: '#EF9F27' },
  { id: 'Excel', label: 'Excel', color: '#639922' },
];

function countItems(std: StandardId): number {
  if (std === 'issb') return ESG_ITEMS.filter((i) => i.issb !== '–').length;
  if (std === 'gri') return ESG_ITEMS.filter((i) => i.gri !== '–').length;
  return ESG_ITEMS.filter((i) => i.esrs !== '–').length;
}

function isCovered(std: StandardId, item: (typeof ESG_ITEMS)[0]): boolean {
  if (std === 'issb') return item.issb !== '–';
  if (std === 'gri') return item.gri !== '–';
  return item.esrs !== '–';
}

export function HoldingGenerate() {
  const [selectedStd, setSelectedStd] = useState<StandardId | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloadLog, setDownloadLog] = useState<GenerateDownloadRow[]>(() => [...GENERATE_DOWNLOAD_LOG]);

  const itemsCount = useMemo(
    () =>
      ({
        issb: countItems('issb'),
        gri: countItems('gri'),
        esrs: countItems('esrs'),
      }) as Record<StandardId, number>,
    [],
  );

  const previewSlice = useMemo(() => ESG_ITEMS.slice(0, 12), []);

  const runGenerate = async (std: StandardId, format: string) => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1400));
    const label = STANDARDS.find((s) => s.id === std)?.label ?? std.toUpperCase();
    const stdKey = label as GenerateDownloadRow['std'];
    setDownloadLog((prev) => [
      {
        std: stdKey,
        format,
        user: '현재 사용자',
        date: new Date().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }),
      },
      ...prev,
    ]);
    setGenerating(false);
  };

  /** 통합 SR — PPT(슬라이드) / Excel(지표·표) */
  const runFullSrDownload = async (format: 'PowerPoint' | 'Excel') => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1800));
    setDownloadLog((prev) => [
      {
        std: '통합',
        format,
        user: '현재 사용자',
        date: new Date().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }),
      },
      ...prev,
    ]);
    setGenerating(false);
  };

  const stdLabel = selectedStd
    ? STANDARDS.find((s) => s.id === selectedStd)?.label ?? ''
    : '';

  return (
    <div className="p-5 overflow-y-auto h-full flex flex-col gap-3.5">
      <div className="bg-[#EAF3DE] border border-[#C0DD97] rounded-lg p-2.5 flex items-center gap-2.5 text-xs">
        <span className="text-[#3B6D11] font-medium">
          페이지별 작성 완료 후 보고서 생성이 활성화됩니다.
        </span>
        <span className="text-[#639922] ml-auto">전체 진행률 61%</span>
      </div>

      {/* 전체 SR 보고서 (통합본) — 일반 기업 공시 SR 형식 */}
      <div className="bg-white border border-[#e8e8e4] rounded-lg overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-[#e8e8e4] flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[#888]">전체 SR 보고서 다운로드</span>
          <span
            className="text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: '#EFF5FC', color: '#185FA5' }}
          >
            통합본
          </span>
        </div>
        <div className="p-3.5">
          <p className="text-[11px] text-[#666] leading-relaxed mb-3">
            CEO 메시지, ESG 전략·실적, 공시 지표(GRI 등), 부록을 포함한{' '}
            <span className="text-[#333] font-medium">지속가능경영보고서 전체</span>입니다. 발표·브리핑용{' '}
            <span className="text-[#333] font-medium">PowerPoint</span>와 지표·표 중심의{' '}
            <span className="text-[#333] font-medium">Excel</span>로 다운로드할 수 있습니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={generating}
              onClick={() => void runFullSrDownload('PowerPoint')}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-[12px] font-semibold border border-[#EF9F2755] bg-[#FFFBF5] text-[#B45309] hover:bg-[#FFF7ED] disabled:opacity-50 disabled:cursor-wait"
            >
              <span
                className="w-4 h-4 rounded-sm shrink-0"
                style={{ background: '#EF9F2722', border: '1px solid #EF9F2755' }}
                aria-hidden
              />
              PowerPoint
            </button>
            <button
              type="button"
              disabled={generating}
              onClick={() => void runFullSrDownload('Excel')}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-[12px] font-semibold border border-[#63992255] bg-[#F7FAF5] text-[#3B6D11] hover:bg-[#EAF3DE] disabled:opacity-50 disabled:cursor-wait"
            >
              <span
                className="w-4 h-4 rounded-sm shrink-0"
                style={{ background: '#63992222', border: '1px solid #63992255' }}
                aria-hidden
              />
              Excel
            </button>
          </div>
        </div>
      </div>

      <div className="text-[12px] font-semibold text-[#5F5E5A] tracking-tight">기준별 파일 생성 (ISSB / GRI / ESRS)</div>

      {/* 1) 기준 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STANDARDS.map((s) => {
          const sel = selectedStd === s.id;
          const n = itemsCount[s.id];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedStd(sel ? null : s.id)}
              className="bg-white border rounded-lg p-3.5 text-left transition-colors cursor-pointer"
              style={{
                borderWidth: sel ? 1.5 : 0.5,
                borderColor: sel ? s.border : '#e8e8e4',
                boxShadow: sel ? '0 1px 4px rgba(0,0,0,.06)' : 'none',
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-[15px] font-semibold" style={{ color: s.color }}>
                    {s.label}
                  </div>
                  <div className="text-[10px] text-[#888] mt-0.5">{s.subtitle}</div>
                </div>
                <div
                  className="shrink-0 rounded-md px-2 py-1 text-center min-w-[52px]"
                  style={{ background: s.bg }}
                >
                  <div className="text-[15px] font-bold leading-tight" style={{ color: s.color }}>
                    {n}
                  </div>
                  <div className="text-[9px] text-[#888]">항목</div>
                </div>
              </div>

              {sel ? (
                <div className="flex gap-1.5 mt-2 pt-2 border-t border-[#e8e8e4]">
                  {FMT_BTN.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      disabled={generating}
                      onClick={(e) => {
                        e.stopPropagation();
                        void runGenerate(s.id, f.id);
                      }}
                      className="flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-md border border-[#e8e8e4] bg-[#fafaf8] hover:bg-[#f5f5f3] disabled:opacity-50 disabled:cursor-wait text-[10px] font-medium text-[#444]"
                    >
                      <span
                        className="w-5 h-5 rounded-sm shrink-0"
                        style={{ background: `${f.color}22`, border: `1px solid ${f.color}55` }}
                        aria-hidden
                      />
                      <span style={{ color: f.color }}>{f.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-[11px] text-[#bbb] mt-1">클릭하여 선택</div>
              )}
            </button>
          );
        })}
      </div>

      {generating && (
        <div className="bg-white border border-[#e8e8e4] rounded-lg p-3.5">
          <div className="text-[12px] font-medium text-[#5F5E5A] mb-2">보고서 생성 중…</div>
          <div className="h-1 bg-[#e8e8e4] rounded-full overflow-hidden">
            <div className="h-full bg-[#185FA5] rounded-full animate-pulse" style={{ width: '55%' }} />
          </div>
        </div>
      )}

      {/* 2) 포함 항목 미리보기 */}
      {selectedStd && !generating && (
        <div className="bg-white border border-[#e8e8e4] rounded-lg overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-[#e8e8e4]">
            <span className="text-[11px] font-medium text-[#888]">{stdLabel} 포함 항목 미리보기</span>
          </div>
          <div className="p-3.5 flex gap-2">
            <div className="flex-1 max-h-[220px] overflow-y-auto space-y-1 pr-1">
              {previewSlice.map((item) => {
                const covered = isCovered(selectedStd, item);
                return (
                  <div
                    key={item.no}
                    className="flex justify-between items-center gap-2 py-1.5 px-2.5 rounded-md text-[11px]"
                    style={{
                      background: covered ? '#EAF3DE' : '#F1EFE8',
                    }}
                  >
                    <span className="text-[#333] leading-snug">{item.name}</span>
                    <span
                      className="shrink-0 text-[11px] font-bold w-5 text-center"
                      style={{ color: covered ? '#3B6D11' : '#A32D2D' }}
                    >
                      {covered ? '✓' : '—'}
                    </span>
                  </div>
                );
              })}
              <div className="text-center text-[10px] text-[#bbb] py-1">…외 {ESG_ITEMS.length - previewSlice.length}개 항목</div>
            </div>
            <div
              className="w-1 shrink-0 rounded-full self-stretch min-h-[120px]"
              style={{ background: 'linear-gradient(180deg, #639922 0%, #3B6D11 100%)' }}
              aria-hidden
            />
          </div>
        </div>
      )}

      {/* 3) 생성·다운로드 이력 */}
      <div className="bg-white border border-[#e8e8e4] rounded-lg overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-[#e8e8e4] flex items-center gap-2">
          <span className="w-3.5 h-4 rounded-sm border border-[#d3d1c7] bg-[#fafaf8] shrink-0" aria-hidden />
          <span className="text-[11px] font-medium text-[#888]">생성·다운로드 이력</span>
          <span className="text-[11px] text-[#bbb] ml-auto">최근 {Math.min(downloadLog.length, 10)}건</span>
        </div>
        <div className="overflow-x-auto px-3.5 py-2">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-[#f5f5f3]">
                {['기준', '형식', '사용자', '일시'].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-2 text-left font-semibold text-[#5F5E5A] border-b border-[#e8e8e4]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {downloadLog.slice(0, 10).map((row, i) => (
                <tr key={i} className="border-b border-[#e8e8e4] last:border-0">
                  <td className="px-2 py-2">
                    <span className="font-semibold" style={{ color: STD_STYLE[row.std]?.color ?? '#5F5E5A' }}>
                      {row.std}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-[#666]">{row.format}</td>
                  <td className="px-2 py-2 text-[#333]">{row.user}</td>
                  <td className="px-2 py-2 text-[#aaa] whitespace-nowrap font-mono text-[10px]">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
