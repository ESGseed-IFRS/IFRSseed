'use client';

import { useState } from 'react';

import type { InfographicBlockPayload } from '../../lib/holdingInfographicTypes';

export const PALETTE = [
  '#5a9e6e',
  '#2d6a4f',
  '#3d8c6e',
  '#80b192',
  '#b7d5c0',
  '#e9c46a',
  '#f4a261',
  '#e76f51',
  '#264653',
  '#457b9d',
];

export const CHART_TYPES = [
  '누적 막대 (Stacked Bar)',
  '그룹 막대 (Grouped Bar)',
  '라인 (Line)',
  '막대+라인 혼합 (Bar+Line)',
  '도넛 (Doughnut)',
  '영역 (Area)',
];

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export type ChartSeriesState = {
  id: string;
  name: string;
  type?: string;
  color: string;
  labels: string[];
  values: string[];
};

export type ChartBlockPayload = {
  type: 'chart';
  chartType: string;
  title: string;
  series: Omit<ChartSeriesState, 'id'>[];
};

export type TableBlockPayload = {
  type: 'table';
  tableTitle: string;
  rows: number;
  cols: number;
  data: Record<string, string>;
  merged: Record<string, { rowspan: number; colspan: number }>;
  headerRow: boolean;
  headerCol: boolean;
};

export type PageContentBlock = (ChartBlockPayload | TableBlockPayload | InfographicBlockPayload) & {
  id: string;
};

type ChartSVGProps = {
  chartType: string;
  series: ChartSeriesState[];
  title: string;
};

export function HoldingChartSVG({ chartType, series, title }: ChartSVGProps) {
  const W = 480;
  const H = 220;
  const PL = 48;
  const PR = 16;
  const PT = 32;
  const PB = 56;
  const cw = W - PL - PR;
  const ch = H - PT - PB;

  const labels = series[0]?.labels || [];
  const n = labels.length;
  if (!n || !series.length) {
    return <div className="text-gray-400 text-xs p-4">데이터를 입력하세요</div>;
  }

  const colors = series.map((s, i) => s.color || PALETTE[i % PALETTE.length]);

  if (chartType.includes('도넛')) {
    const vals = series[0]?.values || [];
    const total = vals.reduce((a, b) => a + (parseFloat(b) || 0), 0) || 1;
    let angle = -Math.PI / 2;
    const cx = 90;
    const cy = H / 2;
    const R = 70;
    const r = 42;
    const slices = labels.map((lbl, i) => {
      const v = parseFloat(vals[i]) || 0;
      const sweep = (v / total) * 2 * Math.PI;
      const x1 = cx + R * Math.cos(angle);
      const y1 = cy + R * Math.sin(angle);
      angle += sweep;
      const x2 = cx + R * Math.cos(angle);
      const y2 = cy + R * Math.sin(angle);
      const ix1 = cx + r * Math.cos(angle - sweep);
      const iy1 = cy + r * Math.sin(angle - sweep);
      const ix2 = cx + r * Math.cos(angle);
      const iy2 = cy + r * Math.sin(angle);
      const large = sweep > Math.PI ? 1 : 0;
      const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z`;
      return { d, color: PALETTE[i % PALETTE.length], lbl, pct: total ? Math.round((v / total) * 100) : 0, v };
    });
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[480px] block">
        {title && (
          <text x={W / 2} y={16} textAnchor="middle" fill="#333" fontSize={12} fontWeight={600}>
            {title}
          </text>
        )}
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} opacity={0.88} />
        ))}
        {slices.map((s, i) => (
          <g key={i}>
            <rect
              x={200 + Math.floor(i / 5) * 140}
              y={30 + (i % 5) * 28}
              width={12}
              height={12}
              fill={s.color}
              rx={2}
            />
            <text x={218 + Math.floor(i / 5) * 140} y={41 + (i % 5) * 28} fill="#555" fontSize={11}>
              {s.lbl} ({s.pct}%)
            </text>
          </g>
        ))}
      </svg>
    );
  }

  const allVals = series.flatMap((s) => s.values.map((v) => parseFloat(v) || 0));
  const maxVal = Math.max(...allVals, 1);
  const minVal = Math.min(0, ...allVals);
  const range = maxVal - minVal || 1;
  const ticks = 5;
  const tickStep = range / ticks;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minVal + tickStep * i);

  const toY = (v: number) => PT + ch - ((parseFloat(String(v)) || 0) - minVal) / range * ch;
  const barSeries = series.filter(
    (s) =>
      s.type === 'bar' ||
      !s.type ||
      chartType.includes('누적') ||
      chartType.includes('그룹') ||
      chartType.includes('혼합'),
  );
  const lineSeries = series.filter(
    (s) => s.type === 'line' || chartType.includes('라인') || chartType.includes('Area'),
  );
  const mixedBars = chartType.includes('혼합') ? series.filter((s) => s.type !== 'line') : barSeries;
  const mixedLines = chartType.includes('혼합') ? series.filter((s) => s.type === 'line') : lineSeries;

  const isStacked = chartType.includes('누적');
  const isGrouped = chartType.includes('그룹') || chartType.includes('혼합');
  const isLine = chartType.includes('라인') || chartType.includes('Area');
  const isArea = chartType.includes('Area');

  const groupW = cw / n;
  const barsToRender = isLine ? [] : isGrouped || chartType.includes('혼합') ? mixedBars : barSeries;
  const barW =
    barsToRender.length && !isStacked
      ? Math.min(28, groupW / (barsToRender.length + 0.6))
      : Math.min(40, groupW * 0.55);

  const stackedTops = Array.from({ length: n }, () => 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[480px] block">
      {title && (
        <text x={PL + cw / 2} y={14} textAnchor="middle" fill="#333" fontSize={11} fontWeight={600}>
          {title}
        </text>
      )}
      {yTicks.map((t, i) => {
        const y = toY(t);
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={PL + cw} y2={y} stroke="#e8e8e8" strokeWidth={1} />
            <text x={PL - 4} y={y + 4} textAnchor="end" fill="#888" fontSize={9}>
              {t % 1 === 0 ? t : t.toFixed(1)}
            </text>
          </g>
        );
      })}
      <line x1={PL} y1={PT} x2={PL} y2={PT + ch} stroke="#ccc" strokeWidth={1} />
      <line x1={PL} y1={PT + ch} x2={PL + cw} y2={PT + ch} stroke="#ccc" strokeWidth={1} />

      {!isLine &&
        barsToRender.map((s, si) => {
          const col = colors[series.indexOf(s)];
          return s.values.map((v, li) => {
            const val = parseFloat(v) || 0;
            const x0 = PL + groupW * li + groupW / 2;
            let barX: number;
            let barY: number;
            let barH: number;
            if (isStacked) {
              barY = toY(stackedTops[li] + val);
              barH = toY(stackedTops[li]) - barY;
              barX = x0 - barW / 2;
              stackedTops[li] += val;
            } else {
              barX = x0 - (barsToRender.length * barW) / 2 + si * barW;
              barH = Math.abs(toY(val) - toY(0));
              barY = val >= 0 ? toY(val) : toY(0);
            }
            return (
              <g key={`${si}-${li}`}>
                <rect x={barX} y={barY} width={barW} height={Math.max(barH, 0)} fill={col} opacity={0.85} rx={1} />
                {barH > 14 && (
                  <text x={barX + barW / 2} y={barY - 3} textAnchor="middle" fill="#555" fontSize={8}>
                    {val}
                  </text>
                )}
              </g>
            );
          });
        })}

      {(isLine ? series : mixedLines).map((s, si) => {
        const col = s.color || colors[series.indexOf(s)];
        const pts = s.values.map((v, li) => {
          const x = PL + groupW * li + groupW / 2;
          const y = toY(parseFloat(v) || 0);
          return [x, y] as const;
        });
        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
        const areaD = `${pathD} L ${pts[pts.length - 1][0]} ${toY(0)} L ${pts[0][0]} ${toY(0)} Z`;
        return (
          <g key={si}>
            {isArea && <path d={areaD} fill={col} opacity={0.15} />}
            <path d={pathD} fill="none" stroke={col} strokeWidth={2} strokeLinejoin="round" />
            {pts.map(([x, y], li) => (
              <g key={li}>
                <circle cx={x} cy={y} r={3.5} fill="#fff" stroke={col} strokeWidth={2} />
                <text x={x} y={y - 8} textAnchor="middle" fill={col} fontSize={8} fontWeight={600}>
                  {s.values[li]}
                </text>
              </g>
            ))}
          </g>
        );
      })}

      {labels.map((lbl, i) => (
        <text
          key={i}
          x={PL + groupW * i + groupW / 2}
          y={PT + ch + 14}
          textAnchor="middle"
          fill="#666"
          fontSize={10}
        >
          {lbl}
        </text>
      ))}

      {series.map((s, i) => (
        <g key={i}>
          {(s.type === 'line' || isLine) && !isArea ? (
            <line
              x1={PL + i * 110}
              y1={H - 12}
              x2={PL + i * 110 + 16}
              y2={H - 12}
              stroke={colors[i]}
              strokeWidth={2}
            />
          ) : (
            <rect x={PL + i * 110} y={H - 17} width={12} height={10} fill={colors[i]} rx={2} opacity={0.85} />
          )}
          <text x={PL + i * 110 + 18} y={H - 9} fill="#555" fontSize={9}>
            {s.name || `시리즈 ${i + 1}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

type ChartEditorProps = { onAdd: (b: Omit<ChartBlockPayload, 'type'> & { type: 'chart' }) => void };

export function HoldingChartEditor({ onAdd }: ChartEditorProps) {
  const [chartType, setChartType] = useState(CHART_TYPES[0]);
  const [title, setTitle] = useState('');
  const [series, setSeries] = useState<ChartSeriesState[]>([
    {
      id: uid(),
      name: '시리즈 1',
      type: 'bar',
      color: PALETTE[0],
      labels: ['2025', '2030', '2040', '2050'],
      values: ['', '', '', ''],
    },
  ]);

  const labelCount = series[0]?.labels?.length || 4;

  function addSeries() {
    setSeries((prev) => [
      ...prev,
      {
        id: uid(),
        name: `시리즈 ${prev.length + 1}`,
        type: chartType.includes('혼합') && prev.length > 0 ? 'line' : 'bar',
        color: PALETTE[prev.length % PALETTE.length],
        labels: Array(labelCount).fill(''),
        values: Array(labelCount).fill(''),
      },
    ]);
  }
  function removeSeries(id: string) {
    setSeries((prev) => prev.filter((s) => s.id !== id));
  }
  function updateSeries(id: string, key: keyof ChartSeriesState, val: string) {
    setSeries((prev) => prev.map((s) => (s.id === id ? { ...s, [key]: val } : s)));
  }
  function updateLabel(idx: number, val: string) {
    setSeries((prev) =>
      prev.map((s) => {
        const l = [...s.labels];
        l[idx] = val;
        return { ...s, labels: l };
      }),
    );
  }
  function updateValue(id: string, idx: number, val: string) {
    setSeries((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const v = [...s.values];
        v[idx] = val;
        return { ...s, values: v };
      }),
    );
  }
  function addColumn() {
    setSeries((prev) => prev.map((s) => ({ ...s, labels: [...s.labels, ''], values: [...s.values, ''] })));
  }
  function removeColumn(idx: number) {
    setSeries((prev) =>
      prev.map((s) => ({ ...s, labels: s.labels.filter((_, i) => i !== idx), values: s.values.filter((_, i) => i !== idx) })),
    );
  }

  const inp =
    'w-full bg-white border border-[#dde1e7] rounded-[5px] px-2 py-1.5 text-xs text-[#222] outline-none';
  const smallInp = `${inp} px-1.5 py-1 text-[11px] text-center`;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-[#666] mb-1 font-semibold">차트 유형</div>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            className={`${inp} cursor-pointer`}
          >
            {CHART_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-[2] min-w-0">
          <div className="text-[11px] text-[#666] mb-1 font-semibold">차트 제목</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 연도별 온실가스 배출량 (단위: tCO₂eq)"
            className={inp}
          />
        </div>
      </div>

      <div>
        <div className="text-[11px] text-[#666] mb-1.5 font-semibold">데이터 입력</div>
        <div className="overflow-x-auto border border-[#dde1e7] rounded-lg">
          <table className="border-collapse w-full min-w-[500px]">
            <thead>
              <tr className="bg-[#f5f6f8]">
                <th className="py-1.5 px-2.5 text-left text-[11px] text-[#555] font-semibold border-b border-[#dde1e7] w-[120px]">
                  시리즈
                </th>
                {chartType.includes('혼합') && (
                  <th className="py-1.5 px-2 text-[11px] text-[#555] font-semibold border-b border-[#dde1e7] w-[60px]">
                    유형
                  </th>
                )}
                <th className="py-1.5 px-2 text-[11px] text-[#555] font-semibold border-b border-[#dde1e7] w-9">
                  색상
                </th>
                {series[0]?.labels.map((lbl, i) => (
                  <th key={i} className="border-b border-[#dde1e7] p-1 pb-0 min-w-[72px]">
                    <input
                      value={lbl}
                      onChange={(e) => updateLabel(i, e.target.value)}
                      placeholder={`레이블${i + 1}`}
                      className={`${smallInp} w-[68px] mb-0.5`}
                    />
                    {series[0].labels.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeColumn(i)}
                        className="text-[9px] text-[#aaa] bg-transparent border-none cursor-pointer block mx-auto mb-0.5"
                      >
                        ✕
                      </button>
                    )}
                  </th>
                ))}
                <th className="border-b border-[#dde1e7] w-[30px]">
                  <button
                    type="button"
                    onClick={addColumn}
                    title="열 추가"
                    className="text-sm text-[#5a9e6e] bg-transparent border-none cursor-pointer px-1"
                  >
                    +
                  </button>
                </th>
                <th className="border-b border-[#dde1e7] w-6" />
              </tr>
            </thead>
            <tbody>
              {series.map((s, si) => (
                <tr key={s.id} className={si < series.length - 1 ? 'border-b border-[#f0f0f0]' : ''}>
                  <td className="px-2 py-1">
                    <input
                      value={s.name}
                      onChange={(e) => updateSeries(s.id, 'name', e.target.value)}
                      className={`${inp} py-1 px-1.5`}
                    />
                  </td>
                  {chartType.includes('혼합') && (
                    <td className="px-1.5 py-1">
                      <select
                        value={s.type || 'bar'}
                        onChange={(e) => updateSeries(s.id, 'type', e.target.value)}
                        className={`${smallInp} w-14`}
                      >
                        <option value="bar">막대</option>
                        <option value="line">라인</option>
                      </select>
                    </td>
                  )}
                  <td className="px-1.5 py-1 text-center">
                    <input
                      type="color"
                      value={s.color || PALETTE[si % PALETTE.length]}
                      onChange={(e) => updateSeries(s.id, 'color', e.target.value)}
                      className="w-7 h-7 border border-[#ddd] rounded cursor-pointer p-0.5"
                    />
                  </td>
                  {s.values.map((v, vi) => (
                    <td key={vi} className="px-1 py-1">
                      <input
                        type="number"
                        value={v}
                        onChange={(e) => updateValue(s.id, vi, e.target.value)}
                        placeholder="0"
                        className={`${smallInp} w-[68px]`}
                      />
                    </td>
                  ))}
                  <td />
                  <td className="px-1 text-center">
                    {series.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSeries(s.id)}
                        className="text-[13px] text-[#ccc] bg-transparent border-none cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addSeries}
          className="mt-2 py-1.5 px-3.5 rounded-md border border-dashed border-[#5a9e6e] bg-[#f8fdf9] text-[#5a9e6e] text-[11px] cursor-pointer font-semibold"
        >
          + 시리즈 추가
        </button>
      </div>

      <div className="border border-[#dde1e7] rounded-lg p-4 bg-[#fafafa]">
        <div className="text-[11px] text-[#888] mb-2.5 font-semibold">미리보기</div>
        <HoldingChartSVG chartType={chartType} series={series} title={title} />
      </div>

      <button
        type="button"
        onClick={() =>
          onAdd({
            type: 'chart',
            chartType,
            title,
            series: series.map((s) => ({
              name: s.name,
              type: s.type,
              color: s.color,
              labels: [...s.labels],
              values: [...s.values],
            })),
          })
        }
        className="py-2.5 rounded-lg border-none bg-[#2d6a4f] text-white text-[13px] font-bold cursor-pointer"
      >
        그래프를 페이지에 추가 →
      </button>
    </div>
  );
}

function cellKey(r: number, c: number) {
  return `${r}-${c}`;
}

type TableBlockProps = { block: TableBlockPayload };

export function HoldingTableBlock({ block }: TableBlockProps) {
  const { rows, cols, data, merged, headerRow, headerCol } = block;
  function getCell(r: number, c: number) {
    return data?.[cellKey(r, c)] || '';
  }
  function isCovered(r: number, c: number) {
    for (let mr = 0; mr <= r; mr++) {
      for (let mc = 0; mc <= c; mc++) {
        const m = merged?.[cellKey(mr, mc)];
        if (m && !(mr === r && mc === c)) {
          if (mr + (m.rowspan || 1) > r && mc + (m.colspan || 1) > c) return true;
        }
      }
    }
    return false;
  }
  function getMerge(r: number, c: number) {
    return merged?.[cellKey(r, c)] || { rowspan: 1, colspan: 1 };
  }
  return (
    <div className="overflow-x-auto">
      {block.tableTitle && (
        <div className="text-xs font-bold text-[#2d6a4f] mb-1.5">{block.tableTitle}</div>
      )}
      <table className="border-collapse w-full text-[11px]">
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => {
                if (isCovered(r, c)) return null;
                const m = getMerge(r, c);
                const isHdr = (headerRow && r === 0) || (headerCol && c === 0);
                return (
                  <td
                    key={c}
                    rowSpan={m.rowspan || 1}
                    colSpan={m.colspan || 1}
                    className={`border border-[#dde1e7] px-2.5 py-1.5 text-center ${
                      isHdr ? 'bg-[#edf5ef] font-bold text-[#2d6a4f]' : 'bg-white text-[#333] font-normal'
                    }`}
                  >
                    {getCell(r, c) || (isHdr ? '' : '-')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TableEditorProps = { onAdd: (b: Omit<TableBlockPayload, 'type'> & { type: 'table' }) => void };

export function HoldingTableEditor({ onAdd }: TableEditorProps) {
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [data, setData] = useState<Record<string, string>>({});
  const [merged, setMerged] = useState<Record<string, { rowspan: number; colspan: number }>>({});
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [selStart, setSelStart] = useState<{ r: number; c: number } | null>(null);
  const [selEnd, setSelEnd] = useState<{ r: number; c: number } | null>(null);
  const [headerRow, setHeaderRow] = useState(true);
  const [headerCol, setHeaderCol] = useState(true);
  const [tableTitle, setTableTitle] = useState('');

  function getCell(r: number, c: number) {
    return data[cellKey(r, c)] || '';
  }
  function setCell(r: number, c: number, v: string) {
    setData((prev) => ({ ...prev, [cellKey(r, c)]: v }));
  }

  function isCovered(r: number, c: number) {
    for (let mr = 0; mr <= r; mr++) {
      for (let mc = 0; mc <= c; mc++) {
        const m = merged[cellKey(mr, mc)];
        if (m && !(mr === r && mc === c)) {
          if (mr + (m.rowspan || 1) > r && mc + (m.colspan || 1) > c) return true;
        }
      }
    }
    return false;
  }
  function getMerge(r: number, c: number) {
    return merged[cellKey(r, c)] || { rowspan: 1, colspan: 1 };
  }

  const selRange = () => {
    if (!selStart || !selEnd) return null;
    return {
      r1: Math.min(selStart.r, selEnd.r),
      r2: Math.max(selStart.r, selEnd.r),
      c1: Math.min(selStart.c, selEnd.c),
      c2: Math.max(selStart.c, selEnd.c),
    };
  };
  const inSel = (r: number, c: number) => {
    const s = selRange();
    return s && r >= s.r1 && r <= s.r2 && c >= s.c1 && c <= s.c2;
  };

  function mergeCells() {
    const s = selRange();
    if (!s) return;
    const key = cellKey(s.r1, s.c1);
    setData((prev) => {
      const n = { ...prev };
      for (let r = s.r1; r <= s.r2; r++) {
        for (let c = s.c1; c <= s.c2; c++) {
          if (!(r === s.r1 && c === s.c1)) delete n[cellKey(r, c)];
        }
      }
      return n;
    });
    setMerged((prev) => {
      const n = { ...prev };
      for (let r = s.r1; r <= s.r2; r++) {
        for (let c = s.c1; c <= s.c2; c++) {
          if (!(r === s.r1 && c === s.c1)) delete n[cellKey(r, c)];
        }
      }
      n[key] = { rowspan: s.r2 - s.r1 + 1, colspan: s.c2 - s.c1 + 1 };
      return n;
    });
    setSelStart(null);
    setSelEnd(null);
  }
  function unmergeCells() {
    if (!selected) return;
    const key = cellKey(selected.r, selected.c);
    setMerged((prev) => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
  }
  function addRow() {
    setRows((r) => r + 1);
  }
  function addCol() {
    setCols((c) => c + 1);
  }
  function delRow() {
    if (rows > 2) setRows((r) => r - 1);
  }
  function delCol() {
    if (cols > 2) setCols((c) => c - 1);
  }

  const inp2 =
    'bg-transparent border-none outline-none w-full text-xs text-[#222] px-1.5 py-1 text-center font-inherit';

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-2.5 flex-wrap items-center">
        <div className="flex-[2] min-w-[180px]">
          <div className="text-[11px] text-[#666] mb-1 font-semibold">표 제목</div>
          <input
            value={tableTitle}
            onChange={(e) => setTableTitle(e.target.value)}
            placeholder="예: ESG 핵심 성과 지표"
            className="w-full bg-white border border-[#dde1e7] rounded-[5px] px-2 py-1.5 text-xs text-[#222] outline-none box-border"
          />
        </div>
        <div className="flex gap-1.5 items-end mt-[18px]">
          <label className="text-[11px] text-[#666] flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)} /> 첫 행 헤더
          </label>
          <label className="text-[11px] text-[#666] flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={headerCol} onChange={(e) => setHeaderCol(e.target.checked)} /> 첫 열 헤더
          </label>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[
          { label: '+ 행 추가', action: addRow },
          { label: '- 행 삭제', action: delRow },
          { label: '+ 열 추가', action: addCol },
          { label: '- 열 삭제', action: delCol },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={b.action}
            className="py-1.5 px-3 rounded-md border border-[#dde1e7] bg-[#f5f6f8] text-[#444] text-[11px] cursor-pointer font-semibold"
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          onClick={mergeCells}
          disabled={!selStart || !selEnd}
          className={`py-1.5 px-3 rounded-md border text-[11px] font-semibold ${
            selStart && selEnd
              ? 'border-[#5a9e6e] bg-[#f0faf3] text-[#2d6a4f] cursor-pointer'
              : 'border-[#dde1e7] bg-[#f5f6f8] text-[#aaa] cursor-default'
          }`}
        >
          셀 병합
        </button>
        <button
          type="button"
          onClick={unmergeCells}
          disabled={!selected || !merged[cellKey(selected.r, selected.c)]}
          className="py-1.5 px-3 rounded-md border border-[#e07b54] bg-[#fff7f4] text-[#c05030] text-[11px] cursor-pointer font-semibold"
        >
          병합 해제
        </button>
        <div className="text-[10px] text-[#999] self-center ml-1">드래그하여 셀 선택 후 병합</div>
      </div>

      <div className="overflow-x-auto border border-[#dde1e7] rounded-lg select-none">
        <table className="border-collapse w-full">
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => {
                  if (isCovered(r, c)) return null;
                  const m = getMerge(r, c);
                  const isHdr = (headerRow && r === 0) || (headerCol && c === 0);
                  const isSel = inSel(r, c);
                  const isAct = selected?.r === r && selected?.c === c;
                  return (
                    <td
                      key={c}
                      rowSpan={m.rowspan || 1}
                      colSpan={m.colspan || 1}
                      onMouseDown={() => {
                        setSelStart({ r, c });
                        setSelEnd({ r, c });
                        setSelected({ r, c });
                      }}
                      onMouseEnter={(e) => {
                        if (e.buttons === 1) setSelEnd({ r, c });
                      }}
                      className={`border min-w-[80px] p-0 relative transition-colors ${
                        isAct
                          ? 'border-[#5a9e6e] shadow-[inset_0_0_0_2px_#5a9e6e]'
                          : 'border-[#dde1e7]'
                      } ${isSel ? 'bg-[#f0faf3]' : isHdr ? 'bg-[#f5f6f8]' : 'bg-white'}`}
                    >
                      <input
                        value={getCell(r, c)}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        onFocus={() => setSelected({ r, c })}
                        className={`${inp2} ${isHdr ? 'font-bold' : 'font-normal'}`}
                        placeholder={isHdr ? (r === 0 && c === 0 ? '구분' : `열${c + 1}`) : ''}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() =>
          onAdd({
            type: 'table',
            tableTitle,
            rows,
            cols,
            data: { ...data },
            merged: { ...merged },
            headerRow,
            headerCol,
          })
        }
        className="py-2.5 rounded-lg border-none bg-[#2d6a4f] text-white text-[13px] font-bold cursor-pointer"
      >
        표를 페이지에 추가 →
      </button>
    </div>
  );
}
