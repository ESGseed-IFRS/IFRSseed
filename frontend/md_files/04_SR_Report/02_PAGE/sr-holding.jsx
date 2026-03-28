import { useState, useRef, useCallback, useEffect } from "react";

// ── PAGE DATA ────────────────────────────────────────────────────────────────
const PAGE_DATA = [
  { page: 2,   title: "ABOUT THIS REPORT",       standards: ["GRI 2-1","GRI 2-2","GRI 2-3","ESRS BP-1","ESRS BP-2"], section: "보고서 개요" },
  { page: 5,   title: "ESG위원회 위원장 인사말",  standards: ["GRI 2-22"],                                            section: "인사말" },
  { page: 6,   title: "CEO 인사말",               standards: ["GRI 2-22"],                                            section: "인사말" },
  { page: 7,   title: "회사소개",                 standards: ["GRI 2-1","GRI 2-6","ESRS SBM-1"],                      section: "회사소개" },
  { page: 17,  title: "지속가능경영 거버넌스",    standards: ["GRI 2-12","GRI 2-13","ESRS GOV-1","ESRS GOV-2"],       section: "지속가능경영 전략" },
  { page: 18,  title: "지속가능경영 전략",        standards: ["IFRS 14"],                                             section: "지속가능경영 전략" },
  { page: 28,  title: "중대성 평가",              standards: ["GRI 3-1","GRI 3-2","GRI 2-14"],                        section: "지속가능경영 전략" },
  { page: 36,  title: "환경경영 전략·거버넌스",   standards: ["GRI 3-3","IFRS 6","ESRS E1, IRO-1"],                   section: "환경(E)" },
  { page: 39,  title: "온실가스 배출량 관리",     standards: ["GRI 305-1","GRI 305-2","GRI 305-3","IFRS 29","ESRS E1-6"], section: "환경(E)" },
  { page: 43,  title: "재생에너지 전환",          standards: ["GRI 302-1","SASB TC-SI-130a.1","ESRS E1-3"],           section: "환경(E)" },
  { page: 45,  title: "CLIMATE REPORT - Governance", standards: ["IFRS 6","IFRS 29","ESRS E1"],                      section: "기후 리포트" },
  { page: 46,  title: "기후 전략·비즈니스모델",  standards: ["IFRS 10","IFRS 13","IFRS 15","ESRS E1, SBM-3"],        section: "기후 리포트" },
  { page: 47,  title: "전환 리스크 재무영향",     standards: ["IFRS 10","IFRS 15","ESRS E1-9"],                       section: "기후 리포트" },
  { page: 48,  title: "물리적 리스크 재무영향",   standards: ["IFRS 10","IFRS 25","ESRS E1-9"],                       section: "기후 리포트" },
  { page: 50,  title: "수자원 관리",              standards: ["GRI 303-1","SASB TC-SI-130a.2","ESRS E3-1"],           section: "환경(E)" },
  { page: 52,  title: "폐기물 관리",              standards: ["GRI 306-1","ESRS E2-1","ESRS E3-5"],                   section: "환경(E)" },
  { page: 55,  title: "인권경영 추진체계",        standards: ["GRI 3-3","ESRS S1-1","ESRS S1-4","ESRS S2-4"],         section: "사회(S)" },
  { page: 58,  title: "DEI (다양성·형평성·포용성)", standards: ["GRI 405-1","ESRS S1-2"],                              section: "사회(S)" },
  { page: 61,  title: "임직원 채용·역량개발",     standards: ["GRI 404-1","ESRS S1-1","ESRS S1-4"],                   section: "사회(S)" },
  { page: 70,  title: "안전보건 관리체계",        standards: ["GRI 403-1","ESRS S1-5","ESRS S1-14"],                  section: "사회(S)" },
  { page: 76,  title: "협력회사 공급망 ESG",      standards: ["GRI 308-1","GRI 414-1","ESRS S2-1","ESRS S2-4"],       section: "사회(S)" },
  { page: 84,  title: "지역사회 CSR",             standards: ["ESRS S3-1","ESRS S3-4"],                               section: "사회(S)" },
  { page: 100, title: "기업 지배구조 이사회",     standards: ["GRI 2-9","GRI 2-10","ESRS GOV-1","ESRS GOV-2"],        section: "거버넌스(G)" },
  { page: 106, title: "리스크 관리",              standards: ["GRI 207-1","ESRS MDR-P"],                              section: "거버넌스(G)" },
  { page: 108, title: "윤리경영 체계",            standards: ["GRI 2-24","GRI 205-1","ESRS G1-1"],                    section: "거버넌스(G)" },
  { page: 114, title: "정보보호 관리체계",        standards: ["SASB TC-SI-230a.2","ESRS S4-4"],                       section: "거버넌스(G)" },
  { page: 123, title: "ESG DATA - 경제",          standards: ["GRI 201-1","ESRS MDR-M"],                              section: "부록" },
  { page: 127, title: "ESG DATA - 사회",          standards: ["GRI 2-7","ESRS S1-6"],                                 section: "부록" },
  { page: 133, title: "ESG DATA - 환경",          standards: ["GRI 305-1","GRI 302-1","ESRS E1-5"],                   section: "부록" },
];

const INFOGRAPHIC_SUGGEST = {
  "GRI 305": ["연도별 Scope 1/2/3 누적 막대차트", "배출원별 도넛차트", "감축 로드맵 타임라인"],
  "GRI 302": ["에너지 믹스 도넛차트", "재생에너지 비율 게이지", "연도별 에너지 절감 추이"],
  "GRI 403": ["안전사고 추이 라인차트", "사업장별 안전점검 현황", "교육 이수율 원형차트"],
  "GRI 405": ["성별 비율 도넛차트", "직급별 다양성 스택바", "채용·승진 비교 막대"],
  "GRI 404": ["교육시간 추이 라인차트", "직군별 이수율 막대", "역량개발 투자금액 추이"],
  "ESRS GOV": ["거버넌스 조직도", "이사회 구성 도넛차트", "위원회별 역할 다이어그램"],
  "GRI 303": ["수자원 사용량 추이", "재사용률 도넛차트", "사업장별 비교"],
  "IFRS":    ["시나리오별 재무영향 라인차트", "자산손실률 누적 바차트", "리스크 분류 매트릭스"],
};

function getSuggestions(standards) {
  const found = new Set();
  standards.forEach(std => {
    Object.entries(INFOGRAPHIC_SUGGEST).forEach(([key, vals]) => {
      if (std.startsWith(key)) vals.forEach(v => found.add(v));
    });
  });
  return found.size ? [...found].slice(0, 5) : ["KPI 요약 카드 인포그래픽","성과 비교 막대그래프","프로세스 플로우 다이어그램"];
}

// ── COLORS ───────────────────────────────────────────────────────────────────
const PALETTE = ["#5a9e6e","#2d6a4f","#3d8c6e","#80b192","#b7d5c0","#e9c46a","#f4a261","#e76f51","#264653","#457b9d"];
const CHART_TYPES = ["누적 막대 (Stacked Bar)","그룹 막대 (Grouped Bar)","라인 (Line)","막대+라인 혼합 (Bar+Line)","도넛 (Doughnut)","영역 (Area)"];

// ── UTILITY ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

// ── CHART RENDERER (SVG) ──────────────────────────────────────────────────────
function ChartSVG({ chartType, series, title }) {
  const W = 480, H = 220, PL = 48, PR = 16, PT = 32, PB = 56;
  const cw = W - PL - PR, ch = H - PT - PB;

  const labels = series[0]?.labels || [];
  const n = labels.length;
  if (!n || !series.length) return <div style={{ color: "#aaa", fontSize: 12, padding: 16 }}>데이터를 입력하세요</div>;

  const colors = series.map((s, i) => s.color || PALETTE[i % PALETTE.length]);

  if (chartType.includes("도넛")) {
    const vals = series[0]?.values || [];
    const total = vals.reduce((a, b) => a + (parseFloat(b) || 0), 0) || 1;
    let angle = -Math.PI / 2;
    const cx = 90, cy = H / 2, R = 70, r = 42;
    const slices = labels.map((lbl, i) => {
      const v = parseFloat(vals[i]) || 0;
      const sweep = (v / total) * 2 * Math.PI;
      const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
      angle += sweep;
      const x2 = cx + R * Math.cos(angle), y2 = cy + R * Math.sin(angle);
      const ix1 = cx + r * Math.cos(angle - sweep), iy1 = cy + r * Math.sin(angle - sweep);
      const ix2 = cx + r * Math.cos(angle), iy2 = cy + r * Math.sin(angle);
      const large = sweep > Math.PI ? 1 : 0;
      const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z`;
      return { d, color: PALETTE[i % PALETTE.length], lbl, pct: total ? Math.round(v / total * 100) : 0, v };
    });
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block" }}>
        {title && <text x={W/2} y={16} textAnchor="middle" fill="#333" fontSize={12} fontWeight={600}>{title}</text>}
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} opacity={0.88} />)}
        {slices.map((s, i) => (
          <g key={i}>
            <rect x={200 + Math.floor(i/5)*140} y={30 + (i%5)*28} width={12} height={12} fill={s.color} rx={2}/>
            <text x={218 + Math.floor(i/5)*140} y={41 + (i%5)*28} fill="#555" fontSize={11}>{s.lbl} ({s.pct}%)</text>
          </g>
        ))}
      </svg>
    );
  }

  // Compute max across all series
  const allVals = series.flatMap(s => s.values.map(v => parseFloat(v) || 0));
  const maxVal = Math.max(...allVals, 1);
  const minVal = Math.min(0, ...allVals);
  const range = maxVal - minVal || 1;

  // Y axis ticks
  const ticks = 5;
  const tickStep = range / ticks;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minVal + tickStep * i);

  const toY = v => PT + ch - ((parseFloat(v) || 0) - minVal) / range * ch;
  const barSeries = series.filter(s => s.type === "bar" || !s.type || chartType.includes("누적") || chartType.includes("그룹") || chartType.includes("혼합"));
  const lineSeries = series.filter(s => s.type === "line" || chartType.includes("라인") || chartType.includes("Area"));
  const mixedBars = chartType.includes("혼합") ? series.filter(s => s.type !== "line") : barSeries;
  const mixedLines = chartType.includes("혼합") ? series.filter(s => s.type === "line") : lineSeries;

  const isStacked = chartType.includes("누적");
  const isGrouped = chartType.includes("그룹") || chartType.includes("혼합");
  const isLine = chartType.includes("라인") || chartType.includes("Area");
  const isArea = chartType.includes("Area");

  const groupW = cw / n;
  const barsToRender = isLine ? [] : (isGrouped || chartType.includes("혼합") ? mixedBars : barSeries);
  const barW = barsToRender.length && !isStacked
    ? Math.min(28, groupW / (barsToRender.length + 0.6))
    : Math.min(40, groupW * 0.55);

  // Stacked cumulative
  const stackedTops = Array.from({ length: n }, () => 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block" }}>
      {title && <text x={PL + cw/2} y={14} textAnchor="middle" fill="#333" fontSize={11} fontWeight={600}>{title}</text>}
      {/* Grid & Y axis */}
      {yTicks.map((t, i) => {
        const y = toY(t);
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={PL + cw} y2={y} stroke="#e8e8e8" strokeWidth={1}/>
            <text x={PL - 4} y={y + 4} textAnchor="end" fill="#888" fontSize={9}>{t % 1 === 0 ? t : t.toFixed(1)}</text>
          </g>
        );
      })}
      <line x1={PL} y1={PT} x2={PL} y2={PT + ch} stroke="#ccc" strokeWidth={1}/>
      <line x1={PL} y1={PT + ch} x2={PL + cw} y2={PT + ch} stroke="#ccc" strokeWidth={1}/>

      {/* BARS */}
      {!isLine && barsToRender.map((s, si) => {
        const col = colors[series.indexOf(s)];
        return s.values.map((v, li) => {
          const val = parseFloat(v) || 0;
          const x0 = PL + groupW * li + groupW / 2;
          let barX, barY, barH;
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
              <rect x={barX} y={barY} width={barW} height={Math.max(barH, 0)} fill={col} opacity={0.85} rx={1}/>
              {barH > 14 && <text x={barX + barW/2} y={barY - 3} textAnchor="middle" fill="#555" fontSize={8}>{val}</text>}
            </g>
          );
        });
      })}

      {/* LINES / AREA */}
      {(isLine ? series : mixedLines).map((s, si) => {
        const col = s.color || colors[series.indexOf(s)];
        const pts = s.values.map((v, li) => {
          const x = PL + groupW * li + groupW / 2;
          const y = toY(parseFloat(v) || 0);
          return [x, y];
        });
        const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
        const areaD = pathD + ` L ${pts[pts.length-1][0]} ${toY(0)} L ${pts[0][0]} ${toY(0)} Z`;
        return (
          <g key={si}>
            {isArea && <path d={areaD} fill={col} opacity={0.15}/>}
            <path d={pathD} fill="none" stroke={col} strokeWidth={2} strokeLinejoin="round"/>
            {pts.map(([x, y], li) => (
              <g key={li}>
                <circle cx={x} cy={y} r={3.5} fill="#fff" stroke={col} strokeWidth={2}/>
                <text x={x} y={y - 8} textAnchor="middle" fill={col} fontSize={8} fontWeight={600}>{s.values[li]}</text>
              </g>
            ))}
          </g>
        );
      })}

      {/* X Labels */}
      {labels.map((lbl, i) => (
        <text key={i} x={PL + groupW * i + groupW/2} y={PT + ch + 14} textAnchor="middle" fill="#666" fontSize={10}>{lbl}</text>
      ))}

      {/* Legend */}
      {series.map((s, i) => (
        <g key={i}>
          {(s.type === "line" || isLine) && !isArea
            ? <line x1={PL + i * 110} y1={H - 12} x2={PL + i * 110 + 16} y2={H - 12} stroke={colors[i]} strokeWidth={2}/>
            : <rect x={PL + i * 110} y={H - 17} width={12} height={10} fill={colors[i]} rx={2} opacity={0.85}/>}
          <text x={PL + i * 110 + 18} y={H - 9} fill="#555" fontSize={9}>{s.name || `시리즈 ${i+1}`}</text>
        </g>
      ))}
    </svg>
  );
}

// ── CHART EDITOR ─────────────────────────────────────────────────────────────
function ChartEditor({ onAdd }) {
  const [chartType, setChartType] = useState("누적 막대 (Stacked Bar)");
  const [title, setTitle] = useState("");
  const [series, setSeries] = useState([
    { id: uid(), name: "시리즈 1", type: "bar", color: PALETTE[0], labels: ["2025","2030","2040","2050"], values: ["","","",""] },
  ]);

  const labelCount = series[0]?.labels?.length || 4;

  function addSeries() {
    setSeries(prev => [...prev, {
      id: uid(), name: `시리즈 ${prev.length + 1}`,
      type: chartType.includes("혼합") && prev.length > 0 ? "line" : "bar",
      color: PALETTE[prev.length % PALETTE.length],
      labels: Array(labelCount).fill(""), values: Array(labelCount).fill("")
    }]);
  }
  function removeSeries(id) { setSeries(prev => prev.filter(s => s.id !== id)); }
  function updateSeries(id, key, val) { setSeries(prev => prev.map(s => s.id === id ? { ...s, [key]: val } : s)); }
  function updateLabel(seriesId, idx, val) {
    setSeries(prev => prev.map(s => {
      if (s.id !== seriesId) { const l = [...s.labels]; l[idx] = val; return { ...s, labels: l }; }
      const l = [...s.labels]; l[idx] = val;
      return { ...s, labels: l };
    }).map(s => ({ ...s, labels: [...(prev.find(p => p.id === seriesId)?.labels || s.labels).map((lbl, i) => i === idx ? val : lbl)] })));
    // sync labels across all series
    setSeries(prev => prev.map(s => { const l = [...s.labels]; l[idx] = val; return { ...s, labels: l }; }));
  }
  function updateValue(id, idx, val) {
    setSeries(prev => prev.map(s => { if (s.id !== id) return s; const v = [...s.values]; v[idx] = val; return { ...s, values: v }; }));
  }
  function addColumn() {
    setSeries(prev => prev.map(s => ({ ...s, labels: [...s.labels, ""], values: [...s.values, ""] })));
  }
  function removeColumn(idx) {
    setSeries(prev => prev.map(s => ({ ...s, labels: s.labels.filter((_, i) => i !== idx), values: s.values.filter((_, i) => i !== idx) })));
  }

  const inp = { background: "#fff", border: "1px solid #dde1e7", borderRadius: 5, padding: "5px 8px", fontSize: 12, outline: "none", color: "#222", width: "100%" };
  const smallInp = { ...inp, padding: "4px 6px", fontSize: 11, textAlign: "center" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Type & Title */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>차트 유형</div>
          <select value={chartType} onChange={e => setChartType(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
            {CHART_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>차트 제목</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 연도별 온실가스 배출량 (단위: tCO₂eq)" style={inp} />
        </div>
      </div>

      {/* Series Table */}
      <div>
        <div style={{ fontSize: 11, color: "#666", marginBottom: 6, fontWeight: 600 }}>데이터 입력</div>
        <div style={{ overflowX: "auto", border: "1px solid #dde1e7", borderRadius: 8 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500 }}>
            <thead>
              <tr style={{ background: "#f5f6f8" }}>
                <th style={{ padding: "7px 10px", fontSize: 11, color: "#555", fontWeight: 600, textAlign: "left", borderBottom: "1px solid #dde1e7", width: 120 }}>시리즈</th>
                {chartType.includes("혼합") && <th style={{ padding: "7px 8px", fontSize: 11, color: "#555", fontWeight: 600, borderBottom: "1px solid #dde1e7", width: 60 }}>유형</th>}
                <th style={{ padding: "7px 8px", fontSize: 11, color: "#555", fontWeight: 600, borderBottom: "1px solid #dde1e7", width: 36 }}>색상</th>
                {series[0]?.labels.map((lbl, i) => (
                  <th key={i} style={{ borderBottom: "1px solid #dde1e7", padding: "4px 4px 0", minWidth: 72 }}>
                    <input value={lbl} onChange={e => updateLabel(series[0].id, i, e.target.value)} placeholder={`레이블${i+1}`} style={{ ...smallInp, width: 68, marginBottom: 2 }} />
                    {series[0].labels.length > 1 && (
                      <button onClick={() => removeColumn(i)} style={{ fontSize: 9, color: "#aaa", background: "none", border: "none", cursor: "pointer", display: "block", margin: "0 auto 2px" }}>✕</button>
                    )}
                  </th>
                ))}
                <th style={{ borderBottom: "1px solid #dde1e7", width: 30 }}>
                  <button onClick={addColumn} title="열 추가" style={{ fontSize: 14, color: "#5a9e6e", background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}>+</button>
                </th>
                <th style={{ borderBottom: "1px solid #dde1e7", width: 24 }}></th>
              </tr>
            </thead>
            <tbody>
              {series.map((s, si) => (
                <tr key={s.id} style={{ borderBottom: si < series.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                  <td style={{ padding: "5px 8px" }}>
                    <input value={s.name} onChange={e => updateSeries(s.id, "name", e.target.value)} style={{ ...inp, padding: "4px 6px" }} />
                  </td>
                  {chartType.includes("혼합") && (
                    <td style={{ padding: "5px 6px" }}>
                      <select value={s.type || "bar"} onChange={e => updateSeries(s.id, "type", e.target.value)} style={{ ...smallInp, width: 56 }}>
                        <option value="bar">막대</option>
                        <option value="line">라인</option>
                      </select>
                    </td>
                  )}
                  <td style={{ padding: "5px 6px", textAlign: "center" }}>
                    <input type="color" value={s.color || PALETTE[si % PALETTE.length]} onChange={e => updateSeries(s.id, "color", e.target.value)}
                      style={{ width: 28, height: 28, border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", padding: 2 }} />
                  </td>
                  {s.values.map((v, vi) => (
                    <td key={vi} style={{ padding: "5px 4px" }}>
                      <input type="number" value={v} onChange={e => updateValue(s.id, vi, e.target.value)} placeholder="0" style={{ ...smallInp, width: 68 }} />
                    </td>
                  ))}
                  <td></td>
                  <td style={{ padding: "0 4px", textAlign: "center" }}>
                    {series.length > 1 && (
                      <button onClick={() => removeSeries(s.id)} style={{ fontSize: 13, color: "#ccc", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addSeries} style={{ marginTop: 8, padding: "5px 14px", borderRadius: 6, border: "1px dashed #5a9e6e", background: "#f8fdf9", color: "#5a9e6e", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          + 시리즈 추가
        </button>
      </div>

      {/* Preview */}
      <div style={{ border: "1px solid #dde1e7", borderRadius: 8, padding: "16px", background: "#fafafa" }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 10, fontWeight: 600 }}>미리보기</div>
        <ChartSVG chartType={chartType} series={series} title={title} />
      </div>

      <button onClick={() => onAdd({ type: "chart", chartType, title, series: series.map(s => ({ ...s })) })}
        style={{ padding: "10px 0", borderRadius: 8, border: "none", background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        그래프를 페이지에 추가 →
      </button>
    </div>
  );
}

// ── TABLE EDITOR ──────────────────────────────────────────────────────────────
function TableEditor({ onAdd }) {
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(5);
  const [data, setData] = useState({});
  const [merged, setMerged] = useState({}); // key: "r-c" → {rowspan, colspan}
  const [selected, setSelected] = useState(null);
  const [selStart, setSelStart] = useState(null);
  const [selEnd, setSelEnd] = useState(null);
  const [headerRow, setHeaderRow] = useState(true);
  const [headerCol, setHeaderCol] = useState(true);
  const [tableTitle, setTableTitle] = useState("");

  function cellKey(r, c) { return `${r}-${c}`; }
  function getCell(r, c) { return data[cellKey(r, c)] || ""; }
  function setCell(r, c, v) { setData(prev => ({ ...prev, [cellKey(r, c)]: v })); }

  function isCovered(r, c) {
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
  function getMerge(r, c) { return merged[cellKey(r, c)] || { rowspan: 1, colspan: 1 }; }

  const selRange = () => {
    if (!selStart || !selEnd) return null;
    return {
      r1: Math.min(selStart.r, selEnd.r), r2: Math.max(selStart.r, selEnd.r),
      c1: Math.min(selStart.c, selEnd.c), c2: Math.max(selStart.c, selEnd.c),
    };
  };
  const inSel = (r, c) => { const s = selRange(); return s && r >= s.r1 && r <= s.r2 && c >= s.c1 && c <= s.c2; };

  function mergeCells() {
    const s = selRange();
    if (!s) return;
    const key = cellKey(s.r1, s.c1);
    // unmerge covered cells in selection
    for (let r = s.r1; r <= s.r2; r++) {
      for (let c = s.c1; c <= s.c2; c++) {
        if (!(r === s.r1 && c === s.c1)) {
          setMerged(prev => { const n = { ...prev }; delete n[cellKey(r, c)]; return n; });
          setData(prev => { const n = { ...prev }; delete n[cellKey(r, c)]; return n; });
        }
      }
    }
    setMerged(prev => ({ ...prev, [key]: { rowspan: s.r2 - s.r1 + 1, colspan: s.c2 - s.c1 + 1 } }));
    setSelStart(null); setSelEnd(null);
  }
  function unmergeCells() {
    if (!selected) return;
    const key = cellKey(selected.r, selected.c);
    setMerged(prev => { const n = { ...prev }; delete n[key]; return n; });
  }
  function addRow() { setRows(r => r + 1); }
  function addCol() { setCols(c => c + 1); }
  function delRow() { if (rows > 2) setRows(r => r - 1); }
  function delCol() { if (cols > 2) setCols(c => c - 1); }

  const inp2 = { background: "transparent", border: "none", outline: "none", width: "100%", fontSize: 12, color: "#222", padding: "4px 6px", textAlign: "center", fontFamily: "inherit" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 2, minWidth: 180 }}>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>표 제목</div>
          <input value={tableTitle} onChange={e => setTableTitle(e.target.value)} placeholder="예: ESG 핵심 성과 지표"
            style={{ background: "#fff", border: "1px solid #dde1e7", borderRadius: 5, padding: "5px 8px", fontSize: 12, outline: "none", color: "#222", width: "100%", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 18 }}>
          <label style={{ fontSize: 11, color: "#666", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={headerRow} onChange={e => setHeaderRow(e.target.checked)} /> 첫 행 헤더
          </label>
          <label style={{ fontSize: 11, color: "#666", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={headerCol} onChange={e => setHeaderCol(e.target.checked)} /> 첫 열 헤더
          </label>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { label: "+ 행 추가", action: addRow },
          { label: "- 행 삭제", action: delRow },
          { label: "+ 열 추가", action: addCol },
          { label: "- 열 삭제", action: delCol },
        ].map(b => (
          <button key={b.label} onClick={b.action}
            style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #dde1e7", background: "#f5f6f8", color: "#444", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
            {b.label}
          </button>
        ))}
        <button onClick={mergeCells} disabled={!selStart || !selEnd}
          style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #5a9e6e", background: selStart && selEnd ? "#f0faf3" : "#f5f6f8", color: selStart && selEnd ? "#2d6a4f" : "#aaa", fontSize: 11, cursor: selStart && selEnd ? "pointer" : "default", fontWeight: 600 }}>
          셀 병합
        </button>
        <button onClick={unmergeCells} disabled={!selected || !merged[cellKey(selected?.r, selected?.c)]}
          style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #e07b54", background: "#fff7f4", color: "#c05030", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          병합 해제
        </button>
        <div style={{ fontSize: 10, color: "#999", alignSelf: "center", marginLeft: 4 }}>드래그하여 셀 선택 후 병합</div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid #dde1e7", borderRadius: 8, userSelect: "none" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
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
                    <td key={c}
                      rowSpan={m.rowspan || 1} colSpan={m.colspan || 1}
                      onMouseDown={() => { setSelStart({ r, c }); setSelEnd({ r, c }); setSelected({ r, c }); }}
                      onMouseEnter={(e) => { if (e.buttons === 1) setSelEnd({ r, c }); }}
                      style={{
                        border: `1px solid ${isAct ? "#5a9e6e" : "#dde1e7"}`,
                        background: isSel ? "#f0faf3" : isHdr ? "#f5f6f8" : "#fff",
                        minWidth: 80, padding: 0,
                        boxShadow: isAct ? "inset 0 0 0 2px #5a9e6e" : "none",
                        position: "relative", transition: "background 0.1s"
                      }}>
                      <input
                        value={getCell(r, c)}
                        onChange={e => setCell(r, c, e.target.value)}
                        onFocus={() => setSelected({ r, c })}
                        style={{ ...inp2, fontWeight: isHdr ? 700 : 400, background: "transparent" }}
                        placeholder={isHdr ? (r === 0 && c === 0 ? "구분" : `열${c+1}`) : ""}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={() => onAdd({ type: "table", tableTitle, rows, cols, data: { ...data }, merged: { ...merged }, headerRow, headerCol })}
        style={{ padding: "10px 0", borderRadius: 8, border: "none", background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        표를 페이지에 추가 →
      </button>
    </div>
  );
}

// ── BLOCK RENDERERS ──────────────────────────────────────────────────────────
function TableBlock({ block }) {
  const { rows, cols, data, merged, headerRow, headerCol } = block;
  function cellKey(r, c) { return `${r}-${c}`; }
  function getCell(r, c) { return data?.[cellKey(r, c)] || ""; }
  function isCovered(r, c) {
    for (let mr = 0; mr <= r; mr++)
      for (let mc = 0; mc <= c; mc++) {
        const m = merged?.[cellKey(mr, mc)];
        if (m && !(mr === r && mc === c))
          if (mr + (m.rowspan || 1) > r && mc + (m.colspan || 1) > c) return true;
      }
    return false;
  }
  function getMerge(r, c) { return merged?.[cellKey(r, c)] || { rowspan: 1, colspan: 1 }; }
  return (
    <div style={{ overflowX: "auto" }}>
      {block.tableTitle && <div style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", marginBottom: 6 }}>{block.tableTitle}</div>}
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => {
                if (isCovered(r, c)) return null;
                const m = getMerge(r, c);
                const isHdr = (headerRow && r === 0) || (headerCol && c === 0);
                return (
                  <td key={c} rowSpan={m.rowspan || 1} colSpan={m.colspan || 1}
                    style={{ border: "1px solid #dde1e7", padding: "6px 10px", background: isHdr ? "#edf5ef" : "#fff", fontWeight: isHdr ? 700 : 400, color: isHdr ? "#2d6a4f" : "#333", textAlign: "center" }}>
                    {getCell(r, c) || (isHdr ? "" : "-")}
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

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedPage, setSelectedPage] = useState(null);
  const [search, setSearch] = useState("");
  const [pageTexts, setPageTexts] = useState({});
  const [blocks, setBlocks] = useState({});
  const [activeTab, setActiveTab] = useState("content");
  const [generating, setGenerating] = useState(false);

  const sections = [...new Set(PAGE_DATA.map(p => p.section))];
  const filtered = PAGE_DATA.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.standards.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  const pageKey = selectedPage ? `${selectedPage.page}` : null;
  const currentText = pageKey ? (pageTexts[pageKey] || "") : "";
  const currentBlocks = pageKey ? (blocks[pageKey] || []) : [];

  async function generateText() {
    if (!selectedPage) return;
    setGenerating(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: `당신은 지주사 SR(지속가능경영보고서) 총괄 편집 AI입니다. 그룹 전체 관점에서 전문적이고 객관적인 SR 보고서 문단을 한국어로 작성합니다. 실제 수치 자리는 [수치]로, 회사명은 [회사명]으로 표기하세요. 3문단 내외로 작성하세요.`,
          messages: [{ role: "user", content: `페이지: ${selectedPage.title} (P.${selectedPage.page})\n공시기준: ${selectedPage.standards.join(", ")}\n\n지주사 그룹 관점 SR 보고서 문단을 작성해주세요.` }]
        })
      });
      const d = await res.json();
      const text = d.content?.filter(c => c.type === "text").map(c => c.text).join("") || "";
      setPageTexts(prev => ({ ...prev, [pageKey]: text }));
    } catch { setPageTexts(prev => ({ ...prev, [pageKey]: "생성 오류. 직접 입력해주세요." })); }
    setGenerating(false);
  }

  function addBlock(b) {
    if (!pageKey) return;
    setBlocks(prev => ({ ...prev, [pageKey]: [...(prev[pageKey] || []), { ...b, id: uid() }] }));
    setActiveTab("content");
  }
  function removeBlock(id) {
    setBlocks(prev => ({ ...prev, [pageKey]: (prev[pageKey] || []).filter(b => b.id !== id) }));
  }

  const suggestions = selectedPage ? getSuggestions(selectedPage.standards) : [];

  // Styles
  const S = {
    app: { height: "100vh", display: "flex", flexDirection: "column", background: "#f7f8fa", fontFamily: "'Noto Sans KR', 'Malgun Gothic', sans-serif", color: "#222", overflow: "hidden" },
    nav: { height: 50, background: "#fff", borderBottom: "1px solid #e4e6ea", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
    navTitle: { display: "flex", alignItems: "center", gap: 10 },
    logo: { width: 30, height: 30, background: "linear-gradient(135deg, #2d6a4f, #5a9e6e)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700 },
    body: { flex: 1, display: "flex", overflow: "hidden" },
    sidebar: { width: 256, background: "#fff", borderRight: "1px solid #e4e6ea", display: "flex", flexDirection: "column", flexShrink: 0 },
    sideHead: { padding: "14px 14px 10px", borderBottom: "1px solid #f0f0f0" },
    searchInp: { width: "100%", background: "#f5f6f8", border: "1px solid #e4e6ea", borderRadius: 7, padding: "7px 10px", fontSize: 12, outline: "none", color: "#222", boxSizing: "border-box" },
    sideList: { flex: 1, overflowY: "auto" },
    sectionLabel: { fontSize: 10, fontWeight: 700, color: "#aaa", letterSpacing: 1.5, padding: "10px 14px 4px", textTransform: "uppercase" },
    pageItem: (active) => ({
      padding: "8px 14px", cursor: "pointer",
      borderLeft: active ? "3px solid #2d6a4f" : "3px solid transparent",
      background: active ? "#f0faf3" : "transparent", transition: "all 0.12s"
    }),
    main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
    pageHeader: { padding: "16px 24px 0", borderBottom: "1px solid #e4e6ea", background: "#fff", flexShrink: 0 },
    tabBar: { display: "flex", gap: 0, marginTop: 12 },
    tab: (active) => ({
      padding: "8px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer",
      border: "none", background: "none",
      color: active ? "#2d6a4f" : "#888",
      borderBottom: active ? "2px solid #2d6a4f" : "2px solid transparent",
      transition: "all 0.12s"
    }),
    content: { flex: 1, display: "flex", overflow: "hidden" },
    editor: { flex: 1, padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 },
    right: { width: 200, borderLeft: "1px solid #e4e6ea", padding: "16px 14px", overflowY: "auto", background: "#fafafa", flexShrink: 0 },
    suggestCard: { background: "#fff", border: "1px solid #e4e6ea", borderRadius: 8, padding: "10px 12px", fontSize: 11, color: "#444", marginBottom: 8, cursor: "pointer", transition: "border-color 0.15s, background 0.15s" },
    stdBadge: { fontSize: 10, background: "#edf5ef", color: "#2d6a4f", borderRadius: 10, padding: "2px 8px", display: "inline-block", margin: "2px 2px" },
    blockCard: { background: "#fff", border: "1px solid #e4e6ea", borderRadius: 10, padding: "14px 16px", marginBottom: 12 },
    aiBtn: { padding: "9px 18px", borderRadius: 8, border: "none", background: "#2d6a4f", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 },
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #f5f5f5; }
        ::-webkit-scrollbar-thumb { background: #d0d0d0; border-radius: 4px; }
        textarea { font-family: 'Noto Sans KR', sans-serif; }
      `}</style>

      {/* NAV */}
      <div style={S.nav}>
        <div style={S.navTitle}>
          <div style={S.logo}>SR</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#222" }}>SR 작성 AI 플랫폼</span>
          <span style={{ fontSize: 11, color: "#aaa", marginLeft: 6 }}>지주사 편집 모드</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#888", alignSelf: "center" }}>페이지 {PAGE_DATA.length}개 · 블록 {Object.values(blocks).flat().length}개</span>
        </div>
      </div>

      <div style={S.body}>
        {/* SIDEBAR */}
        <div style={S.sidebar}>
          <div style={S.sideHead}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f", marginBottom: 8, letterSpacing: 0.5 }}>페이지 목록</div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="페이지·공시기준 검색..." style={S.searchInp} />
          </div>
          <div style={S.sideList}>
            {sections.map(sec => {
              const pages = filtered.filter(p => p.section === sec);
              if (!pages.length) return null;
              return (
                <div key={sec}>
                  <div style={S.sectionLabel}>{sec}</div>
                  {pages.map(p => {
                    const pKey = `${p.page}`;
                    const blkCount = (blocks[pKey] || []).length;
                    const hasText = !!(pageTexts[pKey]);
                    const active = selectedPage?.page === p.page;
                    return (
                      <div key={p.page} onClick={() => { setSelectedPage(p); setActiveTab("content"); }} style={S.pageItem(active)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 10, color: active ? "#2d6a4f" : "#aaa", fontFamily: "monospace", fontWeight: 600 }}>P.{p.page}</span>
                          <div style={{ display: "flex", gap: 3 }}>
                            {hasText && <span style={{ fontSize: 9, background: "#edf5ef", color: "#2d6a4f", borderRadius: 8, padding: "1px 5px" }}>문단</span>}
                            {blkCount > 0 && <span style={{ fontSize: 9, background: "#fff3e8", color: "#c06020", borderRadius: 8, padding: "1px 5px" }}>+{blkCount}</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: active ? "#2d6a4f" : "#444", marginTop: 1, fontWeight: active ? 700 : 400, lineHeight: 1.3 }}>{p.title}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* MAIN */}
        <div style={S.main}>
          {!selectedPage ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#ccc" }}>
              <div style={{ fontSize: 48 }}>📄</div>
              <div style={{ fontSize: 14, color: "#bbb" }}>좌측에서 편집할 페이지를 선택하세요</div>
            </div>
          ) : (
            <>
              {/* Page Header */}
              <div style={S.pageHeader}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#aaa", fontFamily: "monospace", marginBottom: 2 }}>PAGE {selectedPage.page} · {selectedPage.section}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#222" }}>{selectedPage.title}</div>
                    <div style={{ marginTop: 6 }}>
                      {selectedPage.standards.map(s => <span key={s} style={S.stdBadge}>{s}</span>)}
                    </div>
                  </div>
                  {activeTab === "content" && (
                    <button onClick={generateText} disabled={generating} style={S.aiBtn}>
                      {generating ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> : "✦"}
                      {generating ? "AI 생성 중..." : "AI 문단 생성"}
                    </button>
                  )}
                </div>
                <div style={S.tabBar}>
                  {["content","chart","table","infographic"].map(t => (
                    <button key={t} style={S.tab(activeTab === t)} onClick={() => setActiveTab(t)}>
                      {{"content":"📝 본문 편집","chart":"📊 그래프","table":"📋 표","infographic":"🎨 인포그래픽 추천"}[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Area */}
              <div style={S.content}>
                <div style={S.editor}>

                  {/* ── CONTENT TAB ── */}
                  {activeTab === "content" && (
                    <>
                      <textarea
                        value={currentText}
                        onChange={e => setPageTexts(prev => ({ ...prev, [pageKey]: e.target.value }))}
                        placeholder={`${selectedPage.title} 페이지의 내용을 작성하거나 AI 생성을 활용하세요.\n\n계열사로부터 받은 DP 내용이 여기에 취합됩니다.`}
                        style={{ width: "100%", minHeight: 200, border: "1px solid #dde1e7", borderRadius: 10, padding: "14px 16px", fontSize: 13, lineHeight: 1.9, resize: "vertical", outline: "none", color: "#333", background: "#fff", boxSizing: "border-box" }}
                      />

                      {/* Saved Blocks Preview */}
                      {currentBlocks.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f", letterSpacing: 0.5, marginBottom: 10 }}>추가된 콘텐츠</div>
                          {currentBlocks.map(block => (
                            <div key={block.id} style={S.blockCard}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                                <span style={{ fontSize: 11, background: "#edf5ef", color: "#2d6a4f", borderRadius: 8, padding: "2px 10px", fontWeight: 600 }}>
                                  {block.type === "chart" ? `📊 ${block.chartType?.split(" ")[0]} 차트` : "📋 표"}
                                  {block.title && ` · ${block.title}`}
                                  {block.tableTitle && ` · ${block.tableTitle}`}
                                </span>
                                <button onClick={() => removeBlock(block.id)} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 16 }}>✕</button>
                              </div>
                              {block.type === "chart" && <ChartSVG chartType={block.chartType} series={block.series} title={block.title} />}
                              {block.type === "table" && <TableBlock block={block} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* ── CHART TAB ── */}
                  {activeTab === "chart" && <ChartEditor onAdd={addBlock} />}

                  {/* ── TABLE TAB ── */}
                  {activeTab === "table" && <TableEditor onAdd={addBlock} />}

                  {/* ── INFOGRAPHIC TAB ── */}
                  {activeTab === "infographic" && (
                    <div>
                      <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>이 페이지 공시기준을 분석한 추천 시각화입니다. 클릭하면 그래프 편집기로 이동합니다.</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {suggestions.map((s, i) => (
                          <div key={i} onClick={() => setActiveTab("chart")}
                            style={{ background: "#fff", border: "1px solid #dde1e7", borderRadius: 10, padding: "16px", cursor: "pointer", transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "#5a9e6e"; e.currentTarget.style.background = "#f8fdf9"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "#dde1e7"; e.currentTarget.style.background = "#fff"; }}>
                            <div style={{ fontSize: 22, marginBottom: 8 }}>{"📊📈🗂️🎯📉🔵".split("")[i * 2] || "📊"}</div>
                            <div style={{ fontSize: 13, color: "#222", fontWeight: 600, marginBottom: 4 }}>{s}</div>
                            <div style={{ fontSize: 10, color: "#aaa" }}>클릭 → 그래프 생성기</div>
                          </div>
                        ))}
                      </div>

                      {/* Image references */}
                      <div style={{ marginTop: 20, padding: "14px 16px", background: "#fff", border: "1px solid #dde1e7", borderRadius: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#2d6a4f", marginBottom: 8 }}>참고: SR 보고서 차트 유형 예시</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {["물리적 리스크 누적 바차트","시나리오별 라인차트","자산유형별 그룹바","BAU vs Net-Zero 혼합차트","리스크 요인 테이블"].map(ex => (
                            <span key={ex} style={{ fontSize: 10, background: "#f5f6f8", border: "1px solid #e4e6ea", borderRadius: 12, padding: "3px 10px", color: "#666" }}>{ex}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT PANEL */}
                <div style={S.right}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#2d6a4f", letterSpacing: 1, marginBottom: 10 }}>콘텐츠 추천</div>
                  {suggestions.map((s, i) => (
                    <div key={i} style={S.suggestCard}
                      onClick={() => setActiveTab("chart")}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#5a9e6e"; e.currentTarget.style.background = "#f8fdf9"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e4e6ea"; e.currentTarget.style.background = "#fff"; }}>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>{"📊📈🗂️🎯📉"[i] || "📊"}</div>
                      <div style={{ fontSize: 11, color: "#333", lineHeight: 1.4 }}>{s}</div>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, padding: "10px", background: "#f5f6f8", borderRadius: 8, fontSize: 10, color: "#aaa", lineHeight: 1.6 }}>
                    공시기준 기반 자동 추천<br />{selectedPage.standards.slice(0, 3).join(", ")}
                  </div>
                  <div style={{ marginTop: 16, padding: "10px", background: "#fff", border: "1px solid #e4e6ea", borderRadius: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#666", marginBottom: 6 }}>페이지 완성도</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {[
                        { label: "본문", done: !!currentText },
                        { label: "시각화", done: currentBlocks.length > 0 },
                      ].map(item => (
                        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: item.done ? "#2d6a4f" : "#bbb" }}>
                          <span style={{ fontSize: 13 }}>{item.done ? "✅" : "⭕"}</span> {item.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
