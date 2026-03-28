import { useState } from "react";

// ─── 팔레트 ──────────────────────────────────────────────────────────────────
const P = {
  navy:   "#0c447c",
  blue:   "#185fa5",
  teal:   "#0f6e56",
  green:  "#3b6d11",
  amber:  "#854f0b",
  red:    "#a32d2d",
  gray:   "#5f5e5a",
  ink:    "#2c2c2a",
  muted:  "#888780",
  faint:  "#b4b2a9",
  dust:   "#d3d1c7",
  paper:  "#f5f4f0",
  white:  "#ffffff",
};

// ─── 목 데이터 ────────────────────────────────────────────────────────────────
const YEARS = ["2022", "2023", "2024"];

const SUBS = [
  { id:"s1", name:"㈜ A에너지",  short:"A에너지"  },
  { id:"s2", name:"㈜ B화학",    short:"B화학"    },
  { id:"s3", name:"㈜ C건설",    short:"C건설"    },
  { id:"s4", name:"㈜ D물산",    short:"D물산"    },
  { id:"s5", name:"㈜ E바이오",  short:"E바이오"  },
  { id:"s6", name:"㈜ F반도체",  short:"F반도체"  },
  { id:"s7", name:"㈜ G물류",    short:"G물류"    },
  { id:"s8", name:"㈜ H금융",    short:"H금융"    },
  { id:"s9", name:"㈜ I미디어",  short:"I미디어"  },
  { id:"s10",name:"㈜ J서비스",  short:"J서비스"  },
];

// SR 보고서 – 연도별 계열사 제출/승인 현황
const SR_HISTORY = {
  "2022": { submitted: 7, approved: 6, rejected: 1, total: 10 },
  "2023": { submitted: 8, approved: 7, rejected: 1, total: 10 },
  "2024": { submitted: 8, approved: 5, rejected: 2, total: 10 },
};

// SR DP별 현황
const SR_DP = [
  { code:"GRI 302-1", name:"에너지 소비량",      cat:"환경",    "2022":{sub:8,appr:7}, "2023":{sub:9,appr:8}, "2024":{sub:8,appr:6} },
  { code:"GRI 305-1", name:"온실가스 배출",       cat:"환경",    "2022":{sub:7,appr:6}, "2023":{sub:8,appr:7}, "2024":{sub:7,appr:5} },
  { code:"GRI 303-3", name:"취수 및 방류",        cat:"환경",    "2022":{sub:9,appr:8}, "2023":{sub:10,appr:9},"2024":{sub:9,appr:8} },
  { code:"GRI 401-1", name:"신규 채용·이직",      cat:"사회",    "2022":{sub:6,appr:5}, "2023":{sub:7,appr:6}, "2024":{sub:6,appr:4} },
  { code:"GRI 405-1", name:"이사회 다양성",       cat:"지배구조","2022":{sub:8,appr:7}, "2023":{sub:9,appr:8}, "2024":{sub:8,appr:7} },
  { code:"TCFD S-1",  name:"기후 리스크 평가",    cat:"환경",    "2022":{sub:5,appr:4}, "2023":{sub:6,appr:5}, "2024":{sub:5,appr:3} },
  { code:"GRI 414-1", name:"공급망 인권실사",     cat:"사회",    "2022":{sub:4,appr:3}, "2023":{sub:6,appr:5}, "2024":{sub:5,appr:3} },
  { code:"GRI 403-9", name:"산업안전·보건",       cat:"사회",    "2022":{sub:9,appr:8}, "2023":{sub:10,appr:9},"2024":{sub:9,appr:7} },
];

// 계열사별 SR 현황 (2024)
const SR_SUB_2024 = [
  { id:"s1",  submitted:8, approved:7, rejected:0, total:8, lastAt:"25.03.25" },
  { id:"s2",  submitted:8, approved:6, rejected:1, total:8, lastAt:"25.03.24" },
  { id:"s3",  submitted:6, approved:4, rejected:0, total:8, lastAt:"25.03.22" },
  { id:"s4",  submitted:3, approved:1, rejected:2, total:8, lastAt:"25.03.20" },
  { id:"s5",  submitted:0, approved:0, rejected:0, total:8, lastAt:"-"        },
  { id:"s6",  submitted:7, approved:6, rejected:0, total:8, lastAt:"25.03.25" },
  { id:"s7",  submitted:5, approved:3, rejected:0, total:8, lastAt:"25.03.21" },
  { id:"s8",  submitted:4, approved:2, rejected:2, total:8, lastAt:"25.03.19" },
  { id:"s9",  submitted:2, approved:1, rejected:0, total:8, lastAt:"25.03.17" },
  { id:"s10", submitted:1, approved:0, rejected:1, total:8, lastAt:"25.03.15" },
];

// GHG 산정 데이터
const GHG_HISTORY = {
  "2022": { scope1: 42800, scope2: 31200, scope3: 118600 },
  "2023": { scope1: 40100, scope2: 28900, scope3: 112300 },
  "2024": { scope1: 37600, scope2: 26400, scope3: 107800 },
};

const GHG_SUB = [
  { id:"s1",  scope1:5800, scope2:4200, scope3:18400, verified:true,  submitted:true,  approved:true  },
  { id:"s2",  scope1:9200, scope2:6800, scope3:28600, verified:true,  submitted:true,  approved:true  },
  { id:"s3",  scope1:4100, scope2:3100, scope3:14200, verified:false, submitted:true,  approved:false },
  { id:"s4",  scope1:3200, scope2:2400, scope3:11800, verified:false, submitted:true,  approved:false },
  { id:"s5",  scope1:0,    scope2:0,    scope3:0,     verified:false, submitted:false, approved:false },
  { id:"s6",  scope1:7400, scope2:5200, scope3:21600, verified:true,  submitted:true,  approved:true  },
  { id:"s7",  scope1:2800, scope2:2100, scope3:8400,  verified:false, submitted:true,  approved:false },
  { id:"s8",  scope1:1900, scope2:1400, scope3:6200,  verified:false, submitted:false, approved:false },
  { id:"s9",  scope1:1600, scope2:1200, scope3:4800,  verified:false, submitted:true,  approved:false },
  { id:"s10", scope1:1600, scope2:0,    scope3:0,     verified:false, submitted:false, approved:false },
];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
const fmt = (n) => n >= 1000 ? (n/1000).toFixed(1)+"k" : String(n);
const fmtN = (n) => n.toLocaleString();
const pct = (a, b) => b === 0 ? 0 : Math.round(a / b * 100);
const diff = (cur, prev) => {
  const d = cur - prev;
  return { val: Math.abs(d), dir: d < 0 ? "down" : d > 0 ? "up" : "flat", sign: d < 0 ? "▼" : d > 0 ? "▲" : "—" };
};

// ─── 원자 컴포넌트 ────────────────────────────────────────────────────────────
const Tag = ({ color = P.blue, bg, children, small }) => (
  <span style={{
    background: bg || color + "18",
    color,
    fontSize: small ? 10 : 11,
    fontWeight: 700,
    padding: small ? "1px 6px" : "2px 8px",
    borderRadius: 4,
    whiteSpace: "nowrap",
    border: `0.5px solid ${color}30`,
  }}>{children}</span>
);

const Btn = ({ children, variant = "ghost", small, onClick, full, style }) => {
  const vs = {
    primary: { bg: P.navy,  color: "#fff", border: "none" },
    success: { bg: P.green, color: "#fff", border: "none" },
    danger:  { bg: P.red,   color: "#fff", border: "none" },
    amber:   { bg: P.amber, color: "#fff", border: "none" },
    ghost:   { bg: "#fff",  color: P.ink,  border: `0.5px solid ${P.dust}` },
    subtle:  { bg: P.paper, color: P.ink,  border: "none" },
  };
  const v = vs[variant] || vs.ghost;
  return (
    <button onClick={onClick} style={{
      fontSize: small ? 11 : 12, padding: small ? "4px 10px" : "6px 14px",
      borderRadius: 6, border: v.border, background: v.bg, color: v.color,
      cursor: "pointer", fontWeight: 600, width: full ? "100%" : undefined,
      transition: "opacity 0.12s", whiteSpace: "nowrap", ...style,
    }}>{children}</button>
  );
};

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{
    background: P.white,
    border: `0.5px solid rgba(0,0,0,0.09)`,
    borderRadius: 12,
    padding: "16px 18px",
    cursor: onClick ? "pointer" : undefined,
    transition: onClick ? "box-shadow 0.15s" : undefined,
    ...style,
  }}
    onMouseEnter={onClick ? e => e.currentTarget.style.boxShadow = "0 3px 14px rgba(0,0,0,0.09)" : undefined}
    onMouseLeave={onClick ? e => e.currentTarget.style.boxShadow = "none" : undefined}
  >{children}</div>
);

const SLabel = ({ children, style }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: P.dust, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, ...style }}>{children}</div>
);

const Divider = ({ my = 14 }) => <div style={{ height: "0.5px", background: "rgba(0,0,0,0.07)", margin: `${my}px 0` }} />;

// 스파크라인 (SVG 인라인)
const Sparkline = ({ values, color = P.blue, height = 32, width = 80 }) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const lastX = width;
  const lastY = height - ((values[values.length - 1] - min) / range) * (height - 4) - 2;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
};

// 미니 바 차트 (3년 비교)
const MiniBarChart = ({ data, color = P.blue, height = 48, width = 96 }) => {
  const max = Math.max(...data.map(d => d.val));
  return (
    <svg width={width} height={height}>
      {data.map((d, i) => {
        const bw = 20;
        const gap = (width - bw * data.length) / (data.length + 1);
        const x = gap + i * (bw + gap);
        const bh = max > 0 ? (d.val / max) * (height - 16) : 0;
        const y = height - bh - 16;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} rx="3" fill={i === data.length - 1 ? color : color + "55"} />
            <text x={x + bw / 2} y={height - 2} textAnchor="middle" fontSize="8" fill={P.faint} fontFamily="inherit">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

// 링 차트
const RingChart = ({ value, total, color = P.blue, size = 64 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = total > 0 ? (value / total) * circ : 0;
  const pctVal = pct(value, total);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={P.paper} strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: P.ink }}>{pctVal}%</span>
      </div>
    </div>
  );
};

// 프로그레스 바
const Bar = ({ val, max = 100, color = P.blue, thin, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    {label && <span style={{ fontSize: 11, color: P.muted, minWidth: 60 }}>{label}</span>}
    <div style={{ flex: 1, height: thin ? 3 : 5, background: P.paper, borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(pct(val, max), 100)}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s" }} />
    </div>
    <span style={{ fontSize: 10, color: P.faint, minWidth: 28, textAlign: "right" }}>{pct(val, max)}%</span>
  </div>
);

// 독촉/승인/반려 액션 모달
const ActionModal = ({ type, target, onClose, onConfirm }) => {
  const [note, setNote] = useState("");
  const configs = {
    remind:  { title: "리마인드 발송",  color: P.amber, btnLabel: "발송하기 →",  btnVariant: "amber"   },
    approve: { title: "승인 처리",      color: P.green, btnLabel: "✓ 승인 확정", btnVariant: "success" },
    reject:  { title: "반려 처리",      color: P.red,   btnLabel: "✗ 반려 확정", btnVariant: "danger"  },
  };
  const cfg = configs[type];
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }}>
      <div style={{ background: P.white, borderRadius: 14, width: 460, boxShadow: "0 16px 48px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ background: cfg.color, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{cfg.title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.8)", fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "18px 20px 22px" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: cfg.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 16 }}>{type === "remind" ? "📨" : type === "approve" ? "✓" : "✗"}</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: P.ink, marginBottom: 2 }}>{target?.name || target}</div>
              <div style={{ fontSize: 12, color: P.muted }}>{target?.sub || ""}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: P.faint, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            {type === "remind" ? "메시지" : type === "reject" ? "반려 사유 (필수)" : "처리 메모 (선택)"}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={4}
            placeholder={
              type === "remind" ? "리마인드 메시지를 입력하세요..." :
              type === "reject" ? "반려 사유를 구체적으로 작성해주세요..." :
              "승인 메모를 입력하세요 (선택사항)..."
            }
            style={{ width: "100%", fontSize: 13, padding: "10px 12px", borderRadius: 8, border: `0.5px solid ${P.dust}`, background: P.paper, color: P.ink, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.7, marginBottom: 16 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>취소</Btn>
            <Btn variant={cfg.btnVariant} disabled={type === "reject" && !note.trim()} onClick={() => { onConfirm(note); onClose(); }}>{cfg.btnLabel}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// 토스트
const Toast = ({ msg, onDone }) => {
  setTimeout(onDone, 2600);
  return (
    <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: P.ink, color: "#fff", fontSize: 13, fontWeight: 600, padding: "10px 22px", borderRadius: 30, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>
      {msg}
    </div>
  );
};

// ─── 전체 대시보드 ─────────────────────────────────────────────────────────────
const OverviewDash = ({ onNav }) => {
  const srCur = SR_HISTORY["2024"];
  const srPrv = SR_HISTORY["2023"];
  const ghgCur = GHG_HISTORY["2024"];
  const ghgPrv = GHG_HISTORY["2023"];
  const totalGhgCur = ghgCur.scope1 + ghgCur.scope2 + ghgCur.scope3;
  const totalGhgPrv = ghgPrv.scope1 + ghgPrv.scope2 + ghgPrv.scope3;
  const ghgDiff = diff(totalGhgCur, totalGhgPrv);
  const srDiff  = diff(srCur.approved, srPrv.approved);
  const pending = SR_SUB_2024.filter(s => s.submitted > 0 && s.approved < s.submitted).length;
  const noSubmit = SR_SUB_2024.filter(s => s.submitted === 0).length;
  const rejected = SR_SUB_2024.filter(s => s.rejected > 0).length;

  return (
    <div style={{ padding: "22px 26px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: P.faint, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>ESG 통합 현황</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: P.ink }}>지주사 대시보드</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Tag color={P.blue}>2024년도 기준</Tag>
          <Tag color={P.muted}>2025.03.26 업데이트</Tag>
        </div>
      </div>

      {/* 긴급 액션 배너 */}
      {(noSubmit > 0 || rejected > 0) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          {noSubmit > 0 && (
            <div style={{ flex: 1, padding: "11px 16px", borderRadius: 9, background: "#fcebeb", border: "0.5px solid rgba(163,45,45,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: P.red }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: P.red }}>미제출 계열사 {noSubmit}개사 — SR 보고서</span>
              </div>
              <Btn variant="danger" small onClick={() => onNav("sr")}>바로가기 →</Btn>
            </div>
          )}
          {rejected > 0 && (
            <div style={{ flex: 1, padding: "11px 16px", borderRadius: 9, background: "#faeeda", border: "0.5px solid rgba(133,79,11,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: P.amber }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: P.amber }}>반려 처리 계열사 {rejected}개사 — 재제출 요청 필요</span>
              </div>
              <Btn variant="amber" small onClick={() => onNav("sr")}>바로가기 →</Btn>
            </div>
          )}
        </div>
      )}

      {/* KPI 카드 4개 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 18 }}>
        {[
          {
            label: "SR 보고서 승인률",
            value: `${pct(srCur.approved, srCur.total * 8)}%`,
            sub: `${srCur.approved}개사 / ${srCur.total}개사`,
            spark: [pct(SR_HISTORY["2022"].approved, 60), pct(SR_HISTORY["2023"].approved, 70), pct(srCur.approved, 80)],
            color: P.blue, d: srDiff, dLabel: "전년 대비",
          },
          {
            label: "GHG 총 배출량",
            value: `${(totalGhgCur / 1000).toFixed(0)}k`,
            sub: "tCO₂eq · Scope 1+2+3",
            spark: [totalGhgPrv + 12000, totalGhgPrv, totalGhgCur].map(v => v / 1000),
            color: P.teal, d: ghgDiff, dLabel: "전년 대비", invert: true,
          },
          {
            label: "승인 대기",
            value: pending,
            sub: "건 · 검토 필요",
            spark: [4, 6, pending],
            color: P.amber, dLabel: "",
          },
          {
            label: "미제출 계열사",
            value: noSubmit,
            sub: `개사 · SR 보고서 기준`,
            spark: [2, 1, noSubmit],
            color: noSubmit > 0 ? P.red : P.green, dLabel: "",
          },
        ].map((k, i) => (
          <Card key={i} style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: P.muted, fontWeight: 600, marginBottom: 10 }}>{k.label}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: P.faint, marginTop: 4 }}>{k.sub}</div>
                {k.d && (
                  <div style={{ fontSize: 11, marginTop: 6, color: k.invert ? (k.d.dir === "down" ? P.green : P.red) : (k.d.dir === "up" ? P.green : P.red) }}>
                    {k.d.sign} {k.d.val}{typeof k.value === "string" && k.value.includes("%") ? "p" : ""} {k.dLabel}
                  </div>
                )}
              </div>
              <Sparkline values={k.spark} color={k.color} />
            </div>
          </Card>
        ))}
      </div>

      {/* 2행: SR 연도 추이 + GHG 추이 + 계열사 현황 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 14, marginBottom: 14 }}>
        {/* SR 3년 추이 */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <SLabel style={{ marginBottom: 2 }}>SR 보고서</SLabel>
              <div style={{ fontSize: 14, fontWeight: 800, color: P.ink }}>연도별 제출·승인 추이</div>
            </div>
            <Btn variant="ghost" small onClick={() => onNav("sr")}>상세 보기</Btn>
          </div>
          {YEARS.map(y => {
            const d = SR_HISTORY[y];
            return (
              <div key={y} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: y === "2024" ? 800 : 500, color: y === "2024" ? P.ink : P.muted }}>{y}년</span>
                  <div style={{ display: "flex", gap: 5 }}>
                    <Tag color={P.blue} small>제출 {d.submitted}/{d.total}</Tag>
                    <Tag color={P.green} small>승인 {d.approved}</Tag>
                    {d.rejected > 0 && <Tag color={P.red} small>반려 {d.rejected}</Tag>}
                  </div>
                </div>
                <Bar val={d.approved} max={d.total} color={y === "2024" ? P.blue : P.blue + "88"} thin />
              </div>
            );
          })}
        </Card>

        {/* GHG 3년 추이 */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <SLabel style={{ marginBottom: 2 }}>GHG 산정</SLabel>
              <div style={{ fontSize: 14, fontWeight: 800, color: P.ink }}>연도별 배출량 추이</div>
            </div>
            <Btn variant="ghost" small onClick={() => onNav("ghg")}>상세 보기</Btn>
          </div>
          {YEARS.map(y => {
            const d = GHG_HISTORY[y];
            const total = d.scope1 + d.scope2 + d.scope3;
            const maxTotal = Math.max(...YEARS.map(yr => { const g = GHG_HISTORY[yr]; return g.scope1+g.scope2+g.scope3; }));
            const isLatest = y === "2024";
            return (
              <div key={y} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: isLatest ? 800 : 500, color: isLatest ? P.ink : P.muted }}>{y}년</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: isLatest ? P.teal : P.muted }}>{fmtN(total)} tCO₂eq</span>
                </div>
                <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", gap: 1 }}>
                  {[
                    { v: d.scope1, c: P.teal },
                    { v: d.scope2, c: P.blue },
                    { v: d.scope3, c: P.faint },
                  ].map((s, i) => (
                    <div key={i} style={{ width: `${s.v / maxTotal * 100}%`, height: "100%", background: isLatest ? s.c : s.c + "66", transition: "width 0.4s" }} />
                  ))}
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {[{ c: P.teal, l: "Scope 1" }, { c: P.blue, l: "Scope 2" }, { c: P.faint, l: "Scope 3" }].map(s => (
              <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} />
                <span style={{ fontSize: 10, color: P.muted }}>{s.l}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* 계열사 현황 요약 */}
        <Card style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <SLabel style={{ marginBottom: 2 }}>계열사 현황</SLabel>
              <div style={{ fontSize: 14, fontWeight: 800, color: P.ink }}>2024 전체 요약</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {SUBS.slice(0, 8).map(sub => {
              const d = SR_SUB_2024.find(s => s.id === sub.id);
              const p = pct(d.submitted, d.total);
              const statusColor = d.submitted === 0 ? P.red : d.rejected > 0 ? P.amber : d.approved === d.submitted ? P.green : P.blue;
              return (
                <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: P.muted, width: 52, flexShrink: 0 }}>{sub.short}</span>
                  <div style={{ flex: 1 }}>
                    <Bar val={d.submitted} max={d.total} color={statusColor} thin />
                  </div>
                  {d.submitted === 0 && <Tag color={P.red} small>미제출</Tag>}
                  {d.submitted > 0 && d.rejected > 0 && <Tag color={P.amber} small>반려{d.rejected}</Tag>}
                  {d.submitted > 0 && d.rejected === 0 && d.approved === d.submitted && <Tag color={P.green} small>완료</Tag>}
                  {d.submitted > 0 && d.rejected === 0 && d.approved < d.submitted && <Tag color={P.blue} small>검토중</Tag>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 하단: 최근 처리 이력 */}
      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: P.ink }}>최근 처리 이력</div>
          <SLabel style={{ marginBottom: 0 }}>최근 7일</SLabel>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 0 }}>
          {[
            { date:"03.25 14:22", type:"승인",    actor:"김지속 팀장", target:"㈜ A에너지 · GRI 302-1", color: P.green },
            { date:"03.25 11:08", type:"반려",    actor:"이보고 차장", target:"㈜ B화학 · GRI 405-1",   color: P.red   },
            { date:"03.24 17:41", type:"리마인드",actor:"박담당 팀장", target:"㈜ E바이오 전체 미제출",  color: P.amber },
            { date:"03.24 09:15", type:"승인",    actor:"김지속 팀장", target:"㈜ F반도체 · GHG Scope1",color: P.green },
            { date:"03.23 15:00", type:"반려",    actor:"이보고 차장", target:"㈜ D물산 · TCFD S-1",    color: P.red   },
          ].map((h, i) => (
            <div key={i} style={{ padding: "10px 14px", borderLeft: i > 0 ? `0.5px solid rgba(0,0,0,0.07)` : "none" }}>
              <div style={{ fontSize: 10, color: P.dust, marginBottom: 4 }}>{h.date}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: h.color, marginBottom: 3 }}>{h.type}</div>
              <div style={{ fontSize: 11, color: P.ink, fontWeight: 600, marginBottom: 1, lineHeight: 1.4 }}>{h.actor}</div>
              <div style={{ fontSize: 11, color: P.muted, lineHeight: 1.4 }}>{h.target}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── SR 보고서 대시보드 ────────────────────────────────────────────────────────
const SRDash = () => {
  const [year, setYear] = useState("2024");
  const [action, setAction] = useState(null); // {type, target}
  const [statuses, setStatuses] = useState(() => {
    const o = {};
    SR_SUB_2024.forEach(s => { o[s.id] = { submitted: s.submitted, approved: s.approved, rejected: s.rejected }; });
    return o;
  });
  const [toast, setToast] = useState("");

  const allSubs = SUBS.map(sub => {
    const d = SR_SUB_2024.find(s => s.id === sub.id);
    const st = statuses[sub.id];
    return { ...sub, ...d, ...st };
  });

  const totSubmit = allSubs.reduce((a, s) => a + s.submitted, 0);
  const totTotal  = allSubs.reduce((a, s) => a + s.total, 0);
  const totAppr   = allSubs.reduce((a, s) => a + s.approved, 0);
  const totRej    = allSubs.reduce((a, s) => a + s.rejected, 0);
  const noSub     = allSubs.filter(s => s.submitted === 0);
  const pending   = allSubs.filter(s => s.submitted > s.approved && s.rejected === 0);

  const handleAction = (type, sub) => setAction({ type, target: sub });
  const confirmAction = (note) => {
    if (!action) return;
    const { type, target } = action;
    if (type === "approve") {
      setStatuses(p => ({ ...p, [target.id]: { ...p[target.id], approved: target.total, rejected: 0 } }));
      setToast(`${target.name} 승인 완료`);
    } else if (type === "reject") {
      setStatuses(p => ({ ...p, [target.id]: { ...p[target.id], rejected: (p[target.id].rejected || 0) + 1 } }));
      setToast(`${target.name} 반려 처리 완료`);
    } else {
      setToast(`${target.name}에게 리마인드 발송 완료`);
    }
  };

  return (
    <div style={{ padding: "22px 26px", overflowY: "auto", height: "100%" }}>
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
      {action && <ActionModal type={action.type} target={action.target} onClose={() => setAction(null)} onConfirm={confirmAction} />}

      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <SLabel style={{ marginBottom: 2 }}>SR 보고서</SLabel>
          <div style={{ fontSize: 22, fontWeight: 800, color: P.ink }}>계열사 제출 현황 관리</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {YEARS.map(y => (
            <button key={y} onClick={() => setYear(y)} style={{
              fontSize: 12, padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 700,
              background: year === y ? P.navy : P.white,
              color: year === y ? "#fff" : P.muted,
              border: year === y ? "none" : `0.5px solid ${P.dust}`,
            }}>{y}</button>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10, marginBottom: 18 }}>
        {[
          { label: "전체 제출률",  value: `${pct(totSubmit, totTotal)}%`, color: P.blue,  sub: `${totSubmit}/${totTotal}건` },
          { label: "전체 승인률",  value: `${pct(totAppr, totSubmit)}%`,  color: P.green, sub: `${totAppr}건 승인` },
          { label: "반려 건수",    value: totRej,                         color: P.red,   sub: "재제출 필요" },
          { label: "승인 대기",    value: pending.length,                 color: P.amber, sub: "개사 검토 필요" },
          { label: "미제출 계열사",value: noSub.length,                   color: noSub.length > 0 ? P.red : P.green, sub: "개사" },
        ].map((k, i) => (
          <div key={i} style={{ background: P.paper, borderRadius: 9, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: P.muted, fontWeight: 600, marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: P.faint, marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* 2열: DP별 연도 추이 + 계열사 테이블 */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, marginBottom: 14 }}>
        {/* DP별 3년 추이 */}
        <Card style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: P.ink, marginBottom: 14 }}>DP별 제출·승인 추이 (3년)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SR_DP.slice(0, 6).map(dp => {
              const d24 = dp["2024"], d23 = dp["2023"], d22 = dp["2022"];
              const sparkSub  = [d22.sub, d23.sub, d24.sub];
              const sparkAppr = [d22.appr, d23.appr, d24.appr];
              return (
                <div key={dp.code} style={{ paddingBottom: 10, borderBottom: `0.5px solid rgba(0,0,0,0.06)` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: P.ink }}>{dp.code}</span>
                      <span style={{ fontSize: 10, color: P.faint, marginLeft: 6 }}>{dp.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <Tag color={P.blue} small>제출 {d24.sub}</Tag>
                      <Tag color={P.green} small>승인 {d24.appr}</Tag>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Bar val={d24.appr} max={10} color={P.blue} thin />
                    <Sparkline values={sparkAppr} color={P.blue} height={20} width={56} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 계열사별 상세 테이블 */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `0.5px solid rgba(0,0,0,0.08)`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: P.ink }}>{year}년 계열사별 제출 현황</div>
            <div style={{ display: "flex", gap: 6 }}>
              {noSub.length > 0 && (
                <Btn variant="amber" small onClick={() => noSub.forEach(s => handleAction("remind", s))}>
                  미제출 전체 리마인드 ({noSub.length})
                </Btn>
              )}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: P.paper }}>
                  {["계열사", "제출 현황", "진행률", "승인", "반려", "최근 활동", "액션"].map(h => (
                    <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: P.muted, textAlign: "left", borderBottom: `0.5px solid rgba(0,0,0,0.08)`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allSubs.map(sub => {
                  const st = statuses[sub.id];
                  const isNone   = sub.submitted === 0;
                  const isRej    = sub.rejected > 0;
                  const isPend   = sub.submitted > sub.approved && sub.rejected === 0;
                  const isDone   = sub.submitted > 0 && sub.approved >= sub.submitted && sub.rejected === 0;
                  return (
                    <tr key={sub.id}
                      onMouseEnter={e => e.currentTarget.style.background = "#fafaf8"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: P.ink, whiteSpace: "nowrap", borderBottom: `0.5px solid rgba(0,0,0,0.06)` }}>{sub.name}</td>
                      <td style={{ padding: "10px 14px", borderBottom: `0.5px solid rgba(0,0,0,0.06)` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <RingChart value={sub.submitted} total={sub.total} color={isNone ? P.dust : isDone ? P.green : isRej ? P.amber : P.blue} size={36} />
                          <span style={{ fontSize: 12, color: P.muted }}>{sub.submitted}/{sub.total}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", borderBottom: `0.5px solid rgba(0,0,0,0.06)`, minWidth: 100 }}>
                        <Bar val={sub.submitted} max={sub.total} color={isNone ? P.dust : isDone ? P.green : P.blue} thin />
                      </td>
                      <td style={{ padding: "10px 14px", borderBottom: `0.5px solid rgba(0,0,0,0.06)`, textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: P.green }}>{sub.approved}</span>
                      </td>
                      <td style={{ padding: "10px 14px", borderBottom: `0.5px solid rgba(0,0,0,0.06)`, textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: sub.rejected > 0 ? P.red : P.dust }}>
                          {sub.rejected > 0 ? sub.rejected : "—"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", borderBottom: `0.5px solid rgba(0,0,0,0.06)`, color: P.faint, fontSize: 11, whiteSpace: "nowrap" }}>{sub.lastAt}</td>
                      <td style={{ padding: "10px 14px", borderBottom: `0.5px solid rgba(0,0,0,0.06)` }}>
                        <div style={{ display: "flex", gap: 5 }}>
                          {isNone && <Btn variant="amber" small onClick={() => handleAction("remind", sub)}>리마인드</Btn>}
                          {isPend && <Btn variant="success" small onClick={() => handleAction("approve", sub)}>승인</Btn>}
                          {isPend && <Btn variant="danger"  small onClick={() => handleAction("reject",  sub)}>반려</Btn>}
                          {isRej  && <Btn variant="amber"   small onClick={() => handleAction("remind",  sub)}>재제출 요청</Btn>}
                          {isDone && <span style={{ fontSize: 11, color: P.green, fontWeight: 700 }}>✓ 완료</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 하단: 연도별 승인률 바 차트 비교 */}
      <Card style={{ padding: "16px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: P.ink, marginBottom: 14 }}>3개년 DP 항목별 승인률 비교</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16 }}>
          {SR_DP.slice(0, 8).map(dp => (
            <div key={dp.code}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.ink, marginBottom: 2 }}>{dp.code}</div>
              <div style={{ fontSize: 10, color: P.faint, marginBottom: 8 }}>{dp.name}</div>
              <MiniBarChart
                data={YEARS.map(y => ({ val: dp[y].appr, label: y.slice(2) }))}
                color={P.blue}
                height={44}
                width={80}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── GHG 산정 대시보드 ─────────────────────────────────────────────────────────
const GHGDash = () => {
  const [year, setYear] = useState("2024");
  const [action, setAction] = useState(null);
  const [statuses, setStatuses] = useState(() => Object.fromEntries(GHG_SUB.map(s => [s.id, { ...s }])));
  const [toast, setToast] = useState("");

  const allSubs = SUBS.map(sub => ({ ...sub, ...statuses[sub.id] }));
  const ghgCur  = GHG_HISTORY[year];
  const ghgPrv  = GHG_HISTORY[String(Number(year) - 1)] || ghgCur;
  const totalCur = ghgCur.scope1 + ghgCur.scope2 + ghgCur.scope3;
  const totalPrv = ghgPrv.scope1 + ghgPrv.scope2 + ghgPrv.scope3;
  const reduction = diff(totalCur, totalPrv);

  const noSub   = allSubs.filter(s => !s.submitted);
  const pending  = allSubs.filter(s => s.submitted && !s.approved);
  const verified = allSubs.filter(s => s.verified);

  const confirmAction = (note) => {
    if (!action) return;
    const { type, target } = action;
    if (type === "approve") {
      setStatuses(p => ({ ...p, [target.id]: { ...p[target.id], approved: true } }));
      setToast(`${target.name} GHG 데이터 승인 완료`);
    } else if (type === "reject") {
      setStatuses(p => ({ ...p, [target.id]: { ...p[target.id], approved: false, submitted: false } }));
      setToast(`${target.name} GHG 데이터 반려`);
    } else {
      setToast(`${target.name}에게 리마인드 발송 완료`);
    }
  };

  return (
    <div style={{ padding: "22px 26px", overflowY: "auto", height: "100%" }}>
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
      {action && <ActionModal type={action.type} target={action.target} onClose={() => setAction(null)} onConfirm={confirmAction} />}

      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <SLabel style={{ marginBottom: 2 }}>GHG 산정</SLabel>
          <div style={{ fontSize: 22, fontWeight: 800, color: P.ink }}>온실가스 배출량 현황</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {YEARS.map(y => (
            <button key={y} onClick={() => setYear(y)} style={{
              fontSize: 12, padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 700,
              background: year === y ? P.teal : P.white,
              color: year === y ? "#fff" : P.muted,
              border: year === y ? "none" : `0.5px solid ${P.dust}`,
            }}>{y}</button>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10, marginBottom: 18 }}>
        {[
          { label: "총 배출량 (Scope 1+2+3)", value: `${(totalCur / 1000).toFixed(1)}k`, unit: "tCO₂eq", color: P.teal,
            diff: `${reduction.sign} ${((reduction.val / totalPrv) * 100).toFixed(1)}% 전년 대비`, diffColor: reduction.dir === "down" ? P.green : P.red },
          { label: "Scope 1 (직접 배출)", value: fmtN(ghgCur.scope1), unit: "tCO₂eq", color: P.teal,
            diff: `${diff(ghgCur.scope1, ghgPrv.scope1).sign} ${fmtN(diff(ghgCur.scope1, ghgPrv.scope1).val)}`, diffColor: diff(ghgCur.scope1, ghgPrv.scope1).dir === "down" ? P.green : P.red },
          { label: "Scope 2 (간접 전력)", value: fmtN(ghgCur.scope2), unit: "tCO₂eq", color: P.blue,
            diff: `${diff(ghgCur.scope2, ghgPrv.scope2).sign} ${fmtN(diff(ghgCur.scope2, ghgPrv.scope2).val)}`, diffColor: diff(ghgCur.scope2, ghgPrv.scope2).dir === "down" ? P.green : P.red },
          { label: "제출 완료",  value: allSubs.filter(s => s.submitted).length, unit: `/ ${SUBS.length}개사`, color: P.blue  },
          { label: "제3자 검증", value: verified.length,                          unit: `/ ${SUBS.length}개사`, color: P.green },
        ].map((k, i) => (
          <div key={i} style={{ background: P.paper, borderRadius: 9, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: P.muted, fontWeight: 600, marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: i === 0 ? 26 : 20, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: P.faint, marginTop: 3 }}>{k.unit}</div>
            {k.diff && <div style={{ fontSize: 10, color: k.diffColor, marginTop: 5, fontWeight: 600 }}>{k.diff}</div>}
          </div>
        ))}
      </div>

      {/* 2열: Scope 별 3년 추이 + 계열사 테이블 */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14, marginBottom: 14 }}>
        {/* Scope 추이 */}
        <Card style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: P.ink, marginBottom: 14 }}>3개년 Scope별 배출량 추이</div>
          {[
            { label: "Scope 1", key: "scope1", color: P.teal },
            { label: "Scope 2", key: "scope2", color: P.blue },
            { label: "Scope 3", key: "scope3", color: P.faint },
          ].map(sc => {
            const vals = YEARS.map(y => GHG_HISTORY[y][sc.key]);
            const latest = vals[vals.length - 1];
            const prev   = vals[vals.length - 2];
            const d = diff(latest, prev);
            return (
              <div key={sc.key} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: P.ink }}>{sc.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: sc.color }}>{fmtN(latest)}</span>
                    <span style={{ fontSize: 10, color: d.dir === "down" ? P.green : P.red, fontWeight: 600 }}>
                      {d.sign}{fmtN(d.val)}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  {vals.map((v, i) => {
                    const maxV = Math.max(...vals);
                    const h = maxV > 0 ? (v / maxV) * 44 : 2;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <div style={{ width: "100%", height: h, borderRadius: "3px 3px 0 0", background: i === vals.length - 1 ? sc.color : sc.color + "55", transition: "height 0.4s" }} />
                        <span style={{ fontSize: 9, color: P.dust }}>{YEARS[i].slice(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* 전체 감축 추이 */}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.ink, marginBottom: 6 }}>총 배출량 추이</div>
            <Sparkline
              values={YEARS.map(y => { const g = GHG_HISTORY[y]; return g.scope1 + g.scope2 + g.scope3; })}
              color={P.teal} height={36} width={230}
            />
          </div>
        </Card>

        {/* 계열사 테이블 */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `0.5px solid rgba(0,0,0,0.08)`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: P.ink }}>{year}년 계열사별 GHG 산정 현황</div>
            {noSub.length > 0 && (
              <Btn variant="amber" small onClick={() => setAction({ type: "remind", target: { name: "미제출 전체", sub: `${noSub.length}개사 일괄 발송` } })}>
                미제출 리마인드 ({noSub.length})
              </Btn>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: P.paper }}>
                  {["계열사", "Scope 1", "Scope 2", "Scope 3", "합계", "제3자검증", "상태", "액션"].map(h => (
                    <th key={h} style={{ padding: "9px 12px", fontSize: 10, fontWeight: 700, color: P.muted, textAlign: h === "계열사" ? "left" : "center", borderBottom: `0.5px solid rgba(0,0,0,0.08)`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allSubs.map(sub => {
                  const total = sub.scope1 + sub.scope2 + sub.scope3;
                  return (
                    <tr key={sub.id}
                      onMouseEnter={e => e.currentTarget.style.background = "#fafaf8"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: P.ink, whiteSpace: "nowrap", borderBottom: `0.5px solid rgba(0,0,0,0.06)` }}>{sub.name}</td>
                      {[sub.scope1, sub.scope2, sub.scope3].map((v, i) => (
                        <td key={i} style={{ padding: "10px 12px", textAlign: "center", borderBottom: `0.5px solid rgba(0,0,0,0.06)`, color: v > 0 ? P.ink : P.dust, fontWeight: v > 0 ? 600 : 400 }}>
                          {v > 0 ? fmtN(v) : "—"}
                        </td>
                      ))}
                      <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, color: total > 0 ? P.teal : P.dust, borderBottom: `0.5px solid rgba(0,0,0,0.06)` }}>
                        {total > 0 ? fmtN(total) : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", borderBottom: `0.5px solid rgba(0,0,0,0.06)` }}>
                        {sub.verified ? <Tag color={P.green} small>검증완료</Tag> : <Tag color={P.dust} small>미검증</Tag>}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", borderBottom: `0.5px solid rgba(0,0,0,0.06)` }}>
                        {!sub.submitted && <Tag color={P.red} small>미제출</Tag>}
                        {sub.submitted && sub.approved  && <Tag color={P.green} small>승인</Tag>}
                        {sub.submitted && !sub.approved && <Tag color={P.amber} small>검토중</Tag>}
                      </td>
                      <td style={{ padding: "10px 12px", borderBottom: `0.5px solid rgba(0,0,0,0.06)` }}>
                        <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                          {!sub.submitted && <Btn variant="amber"   small onClick={() => setAction({ type: "remind",  target: sub })}>리마인드</Btn>}
                          {sub.submitted && !sub.approved && <Btn variant="success" small onClick={() => setAction({ type: "approve", target: sub })}>승인</Btn>}
                          {sub.submitted && !sub.approved && <Btn variant="danger"  small onClick={() => setAction({ type: "reject",  target: sub })}>반려</Btn>}
                          {sub.submitted && sub.approved  && <span style={{ fontSize: 11, color: P.green, fontWeight: 700 }}>✓ 완료</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 하단: 배출 집약도 트렌드 */}
      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: P.ink }}>3개년 총 배출량 비교 (계열사별)</div>
          <div style={{ display: "flex", gap: 10 }}>
            {[{ c: P.teal + "99", l: "2022" }, { c: P.teal + "bb", l: "2023" }, { c: P.teal, l: "2024" }].map(s => (
              <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: s.c }} />
                <span style={{ fontSize: 10, color: P.muted }}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 16 }}>
          {SUBS.slice(0, 5).map(sub => {
            const d = GHG_SUB.find(s => s.id === sub.id);
            const total = d.scope1 + d.scope2 + d.scope3;
            const chartData = [
              { val: total * 1.08, label: "22" },
              { val: total * 1.04, label: "23" },
              { val: total,         label: "24" },
            ];
            return (
              <div key={sub.id}>
                <div style={{ fontSize: 11, fontWeight: 700, color: P.ink, marginBottom: 2 }}>{sub.short}</div>
                <div style={{ fontSize: 10, color: P.faint, marginBottom: 6 }}>{total > 0 ? fmtN(total) + " tCO₂" : "미제출"}</div>
                <MiniBarChart data={chartData} color={P.teal} height={44} width={80} />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// ─── 루트 ─────────────────────────────────────────────────────────────────────
export default function HoldingDashboard() {
  const [page, setPage] = useState("overview");

  const navItems = [
    { key: "overview", label: "전체 현황",   icon: "◈" },
    { key: "sr",       label: "SR 보고서",   icon: "◇" },
    { key: "ghg",      label: "GHG 산정",    icon: "◎" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", background: P.paper, fontFamily: "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif" }}>
      {/* 사이드바 */}
      <aside style={{ width: 200, minWidth: 200, background: P.navy, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "22px 18px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>ESG Hub</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>지주사 관리 포털</div>
        </div>

        <nav style={{ padding: "12px 10px", flex: 1 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", padding: "4px 8px 8px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>대시보드</div>
          {navItems.map(n => (
            <div key={n.key} onClick={() => setPage(n.key)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
              background: page === n.key ? "rgba(255,255,255,0.12)" : "transparent",
              color: page === n.key ? "#fff" : "rgba(255,255,255,0.5)",
              fontWeight: page === n.key ? 700 : 400,
              fontSize: 13, transition: "all 0.12s",
              borderLeft: page === n.key ? "2.5px solid rgba(255,255,255,0.7)" : "2.5px solid transparent",
            }}>
              <span style={{ fontSize: 14 }}>{n.icon}</span>
              {n.label}
            </div>
          ))}

          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", padding: "16px 8px 8px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>관리</div>
          {["결재함", "계열사 관리", "기준 설정"].map(n => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 2, color: "rgba(255,255,255,0.35)", fontSize: 13, borderLeft: "2.5px solid transparent" }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.65)"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
            >
              <span style={{ fontSize: 10 }}>○</span>{n}
            </div>
          ))}
        </nav>

        <div style={{ padding: "14px 18px", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>지주사 관리자</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.85)", marginTop: 3 }}>김지속 팀장</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>ESG전략팀</div>
        </div>
      </aside>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* 탑바 */}
        <div style={{ background: P.white, borderBottom: `0.5px solid rgba(0,0,0,0.09)`, padding: "0 26px", height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: P.faint }}>ESG Hub</span>
            <span style={{ color: P.dust }}>›</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>
              {navItems.find(n => n.key === page)?.label || "대시보드"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Tag color={P.muted}>2024년도 보고 주기</Tag>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: P.navy + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: P.navy }}>김</div>
          </div>
        </div>

        {/* 페이지 콘텐츠 */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {page === "overview" && <OverviewDash onNav={setPage} />}
          {page === "sr"       && <SRDash />}
          {page === "ghg"      && <GHGDash />}
        </div>
      </div>
    </div>
  );
}
