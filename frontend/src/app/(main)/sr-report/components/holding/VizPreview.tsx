'use client';

import { Shield, Target, GraduationCap, ChevronRight } from 'lucide-react';
import type { VizItem } from '../../lib/platformTypes';

interface VizPreviewProps {
  viz: VizItem;
}

export function VizPreview({ viz }: VizPreviewProps) {
  const colors = ['#185FA5', '#B5D4F4', '#EAF3DE', '#FAEEDA'];

  // 인포그래픽 레이아웃별 렌더링
  if (viz.type === 'infographic' && viz.infographicLayout) {
    const data = viz.infographicData ?? {};
    switch (viz.infographicLayout) {
      case 'process': {
        const steps = (data.steps as string[]) ?? ['1단계', '2단계', '3단계', '4단계'];
        return (
          <div className="p-2.5 bg-[#f8f8f6] rounded-md border border-[#e8e8e4]">
            <div className="flex items-center gap-0 overflow-x-auto">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center shrink-0">
                  <div className="px-2 py-1.5 rounded-md bg-[#185FA5] text-white text-[10px] font-medium text-center min-w-[60px]">
                    {s}
                  </div>
                  {i < steps.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-[#aaa] mx-0.5 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      }
      case 'roadmap': {
        const milestones = (data.milestones as { year: number; label: string }[]) ?? [
          { year: 2025, label: '30%' },
          { year: 2030, label: '50%' },
          { year: 2050, label: 'Net Zero' },
        ];
        return (
          <div className="p-2.5 bg-[#f8f8f6] rounded-md border border-[#e8e8e4]">
            <div className="flex items-center justify-between gap-1">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center shrink-0">
                  <div className="flex flex-col items-center px-2 py-1 rounded bg-[#EFF5FC] border border-[#B5D4F4]">
                    <span className="text-[11px] font-bold text-[#185FA5]">{m.year}</span>
                    <span className="text-[9px] text-[#555]">{m.label}</span>
                  </div>
                  {i < milestones.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-[#aaa] mx-0.5 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      }
      case 'kpi-cards': {
        const cards = (data.cards as { icon: string; value: string; label: string }[]) ?? [
          { icon: 'ltir', value: '0.51', label: 'LTIR' },
          { icon: 'safety', value: '0건', label: '사망' },
          { icon: 'edu', value: '97%', label: '교육' },
        ];
        const IconMap: Record<string, React.ReactNode> = {
          ltir: <Shield className="w-4 h-4" />,
          safety: <Target className="w-4 h-4" />,
          edu: <GraduationCap className="w-4 h-4" />,
        };
        return (
          <div className="p-2.5 bg-[#f8f8f6] rounded-md border border-[#e8e8e4]">
            <div className="grid grid-cols-3 gap-1.5">
              {cards.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5 p-2 rounded bg-white border border-[#e8e8e4]">
                  <span className="text-[#185FA5]">{IconMap[c.icon] ?? <Shield className="w-4 h-4" />}</span>
                  <span className="text-xs font-bold text-[#333]">{c.value}</span>
                  <span className="text-[9px] text-[#888]">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }
      case 'gauge': {
        const value = (data.value as number) ?? 32;
        const max = (data.max as number) ?? 100;
        const unit = (data.unit as string) ?? '%';
        const label = (data.label as string) ?? '진행률';
        const pct = Math.min(100, Math.round((value / max) * 100));
        return (
          <div className="p-2.5 bg-[#f8f8f6] rounded-md border border-[#e8e8e4]">
            <div className="text-[10px] text-[#888] mb-1.5 text-center">{label}</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-3 bg-[#e5e7eb] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#185FA5] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-bold text-[#185FA5] shrink-0" style={{ minWidth: 36 }}>
                {value}{unit}
              </span>
            </div>
          </div>
        );
      }
      case 'pyramid': {
        const levels = (data.levels as { label: string; pct: number }[]) ?? [
          { label: '관리직', pct: 18 },
          { label: '실무자', pct: 45 },
          { label: '전체', pct: 100 },
        ];
        return (
          <div className="p-2.5 bg-[#f8f8f6] rounded-md border border-[#e8e8e4]">
            <div className="flex flex-col gap-0.5">
              {levels.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="h-5 rounded bg-[#185FA5] opacity-80"
                    style={{ width: `${l.pct}%`, minWidth: 24 }}
                  />
                  <span className="text-[9px] text-[#555] shrink-0">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }
      default:
        break;
    }
  }

  if (viz.type === 'bar' || viz.type === 'bar_grouped') {
    const vals = (viz.data ?? []).map((r) => Number(r[1]) || 0);
    const max = Math.max(...vals, 1);
    return (
      <div className="p-2.5 bg-[#f8f8f6] rounded-md border border-[#e8e8e4]">
        <div className="text-[10px] text-[#888] mb-2">{viz.cols?.[0]} 기준</div>
        <div className="flex items-end gap-1.5 h-14">
          {(viz.data ?? []).slice(0, 5).map((row, i) => {
            const v = Number(row[1]) || 0;
            const h = max > 0 ? Math.round((v / max) * 50) : 4;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className="w-full rounded-t min-h-[4px] transition-all duration-300"
                  style={{ height: Math.max(h, 4), background: colors[i % colors.length] }}
                />
                <span className="text-[9px] text-[#aaa] truncate w-full text-center">
                  {String(row[0])}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  if (viz.type === 'line') {
    const vals = (viz.data ?? []).map((r) => Number(r[1]) || 0);
    const min = Math.min(...vals);
    const max = Math.max(...vals, min + 1);
    const pts = vals
      .map((v, i) => {
        const x = 10 + i * (80 / (vals.length - 1 || 1));
        const y = 50 - Math.round(((v - min) / (max - min)) * 40);
        return `${x},${y}`;
      })
      .join(' ');
    return (
      <div className="p-2.5 bg-[#f8f8f6] rounded-md border border-[#e8e8e4]">
        <div className="text-[10px] text-[#888] mb-1.5">{viz.cols?.[1]}</div>
        <svg viewBox="0 0 100 60" className="w-full h-14">
          <polyline
            points={pts}
            fill="none"
            stroke="#185FA5"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {vals.map((v, i) => {
            const x = 10 + i * (80 / (vals.length - 1 || 1));
            const y = 50 - Math.round(((v - min) / (max - min)) * 40);
            return <circle key={i} cx={x} cy={y} r={2} fill="#185FA5" />;
          })}
        </svg>
      </div>
    );
  }
  if (viz.type === 'donut' || viz.type === 'pie') {
    const total = (viz.data ?? []).reduce((a, r) => a + Number(r[1]), 0) || 1;
    let angle = -90;
    return (
      <div className="p-2.5 bg-[#f8f8f6] rounded-md border border-[#e8e8e4] flex items-center gap-2.5">
        <svg viewBox="0 0 40 40" className="w-[52px] h-[52px] shrink-0">
          {(viz.data ?? []).map((row, i) => {
            const pct = Number(row[1]) / total;
            const start = angle;
            const end = angle + pct * 360;
            const r = 16;
            const cx = 20;
            const cy = 20;
            const x1 = cx + r * Math.cos((start * Math.PI) / 180);
            const y1 = cy + r * Math.sin((start * Math.PI) / 180);
            const x2 = cx + r * Math.cos((end * Math.PI) / 180);
            const y2 = cy + r * Math.sin((end * Math.PI) / 180);
            const large = pct > 0.5 ? 1 : 0;
            const d = `M${cx},${cy} L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} Z`;
            angle = end;
            return <path key={i} d={d} fill={colors[i % colors.length]} />;
          })}
          {viz.type === 'donut' && <circle cx="20" cy="20" r="9" fill="#f8f8f6" />}
        </svg>
        <div className="flex-1">
          {(viz.data ?? []).map((row, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-0.5 text-[10px] text-[#555]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: colors[i % colors.length] }}
              />
              {String(row[0])} {Number(row[1])}%
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (viz.type === 'table') {
    return (
      <div className="p-2 bg-[#f8f8f6] rounded-md border border-[#e8e8e4] overflow-x-auto">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              {(viz.cols ?? []).map((c) => (
                <th
                  key={c}
                  className="px-1.5 py-1 bg-[#eee] font-medium text-[#555] text-left whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(viz.data ?? []).map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-1.5 py-1 border-b border-[#e8e8e4] text-[#333] whitespace-nowrap"
                  >
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="p-4 bg-[#f8f8f6] rounded-md border border-[#e8e8e4] text-center text-[11px] text-[#bbb]">
      인포그래픽 미리보기
    </div>
  );
}
