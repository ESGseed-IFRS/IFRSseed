import { useState } from "react";

// ─── 공통 데이터 ───────────────────────────────────────────────────────────────
const DP_ITEMS = [
  { code: "GRI 302-1", name: "에너지 소비량",      std: "GRI",  category: "환경" },
  { code: "GRI 303-3", name: "취수량",            std: "GRI",  category: "환경" },
  { code: "GRI 305-1", name: "직접 온실가스 배출", std: "GRI",  category: "환경" },
  { code: "GRI 401-1", name: "신규 채용 및 이직",  std: "GRI",  category: "사회" },
  { code: "GRI 405-1", name: "이사회 다양성",      std: "GRI",  category: "지배구조" },
  { code: "SASB EM-EP","name": "온실가스 배출 강도",std: "SASB", category: "환경" },
  { code: "TCFD S-1",  name: "기후 리스크 평가",   std: "TCFD", category: "환경" },
  { code: "GRI 414-1", name: "공급업체 사회평가",  std: "GRI",  category: "사회" },
];

const SUBSIDIARIES = [
  "㈜ A에너지", "㈜ B화학", "㈜ C건설", "㈜ D물산", "㈜ E바이오",
  "㈜ F반도체", "㈜ G물류", "㈜ H금융", "㈜ I미디어", "㈜ J서비스",
];

// 계열사 관점 초기 데이터: dp별 상태
const SUBSIDIARY_INIT = {
  "GRI 302-1": { written: true,  submitted: true,  status: "approved",  updatedAt: "25.03.20", value: "전력 1,234 TJ, 가스 567 TJ" },
  "GRI 303-3": { written: true,  submitted: true,  status: "approved",  updatedAt: "25.03.21", value: "취수량 234,500 m³" },
  "GRI 305-1": { written: true,  submitted: true,  status: "reviewing", updatedAt: "25.03.22", value: "Scope1 45,200 tCO₂eq" },
  "GRI 401-1": { written: true,  submitted: false, status: null,        updatedAt: "25.03.18", value: "신규 채용 128명" },
  "GRI 405-1": { written: false, submitted: false, status: null,        updatedAt: null,       value: "" },
  "SASB EM-EP":{ written: true,  submitted: true,  status: "rejected",  updatedAt: "25.03.19", value: "단위 오류 발생" },
  "TCFD S-1":  { written: false, submitted: false, status: null,        updatedAt: null,       value: "" },
  "GRI 414-1": { written: true,  submitted: false, status: null,        updatedAt: "25.03.15", value: "공급업체 평가 87개사" },
};

// 지주사 관점 – 계열사별 DP 상태
const HOLDING_DP_DATA = Object.fromEntries(
  DP_ITEMS.map(dp => [
    dp.code,
    Object.fromEntries(
      SUBSIDIARIES.map((s, i) => {
        const patterns = [
          { written:true,  submitted:true,  status:"approved"  },
          { written:true,  submitted:true,  status:"approved"  },
          { written:true,  submitted:true,  status:"reviewing" },
          { written:true,  submitted:false, status:null        },
          { written:false, submitted:false, status:"rejected"  },
          { written:true,  submitted:true,  status:"approved"  },
          { written:true,  submitted:true,  status:"approved"  },
          { written:false, submitted:false, status:null        },
          { written:true,  submitted:true,  status:"reviewing" },
          { written:false, submitted:false, status:null        },
        ];
        return [s, patterns[i % patterns.length]];
      })
    )
  ])
);

const PAGES = [
  { range:"p.1–2",  title:"CEO 메시지",          status:"done"    },
  { range:"p.3–5",  title:"회사 개요",            status:"done"    },
  { range:"p.6–8",  title:"ESG 전략 및 목표",     status:"done"    },
  { range:"p.9–12", title:"환경 성과 데이터",     status:"wip"     },
  { range:"p.13–15",title:"사회 성과 데이터",     status:"wip"     },
  { range:"p.16–18",title:"지배구조 현황",        status:"todo"    },
  { range:"p.19–20",title:"이해관계자 참여",      status:"done"    },
  { range:"p.21–22",title:"GRI 인덱스",          status:"todo"    },
  { range:"p.23",   title:"제3자 검증 의견",      status:"wip"     },
  { range:"p.24",   title:"보고 경계 및 기준",    status:"done"    },
  { range:"p.25–26",title:"중대성 평가 결과",     status:"done"    },
  { range:"p.27",   title:"공급망 현황",          status:"todo"    },
];

// ─── 유틸 컴포넌트 ─────────────────────────────────────────────────────────────
const Badge = ({ type, children }) => {
  const styles = {
    blue:   { background:"#e8f1fb", color:"#185fa5" },
    green:  { background:"#e8f3de", color:"#3b6d11" },
    amber:  { background:"#faeeda", color:"#854f0b" },
    red:    { background:"#fcebeb", color:"#a32d2d" },
    gray:   { background:"#f1efe8", color:"#5f5e5a" },
    purple: { background:"#eeedfe", color:"#534ab7" },
  };
  const s = styles[type] || styles.gray;
  return (
    <span style={{
      ...s, fontSize:11, fontWeight:500,
      padding:"2px 7px", borderRadius:4, whiteSpace:"nowrap",
    }}>{children}</span>
  );
};

const statusBadge = (status, submitted, written) => {
  if (status === "approved")  return <Badge type="green">승인</Badge>;
  if (status === "rejected")  return <Badge type="red">반려</Badge>;
  if (status === "reviewing") return <Badge type="blue">검토중</Badge>;
  if (submitted)              return <Badge type="blue">제출완료</Badge>;
  if (written)                return <Badge type="amber">작성중</Badge>;
  return <Badge type="gray">미작성</Badge>;
};

const ProgressBar = ({ value, color="#185fa5" }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
    <div style={{ flex:1, height:4, background:"#e8e6de", borderRadius:3, overflow:"hidden" }}>
      <div style={{ width:`${value}%`, height:"100%", background:color, borderRadius:3, transition:"width 0.6s ease" }} />
    </div>
    <span style={{ fontSize:11, color:"#888780", minWidth:30, textAlign:"right" }}>{value}%</span>
  </div>
);

const StdBadge = ({ std }) => {
  const map = { GRI:"blue", SASB:"amber", TCFD:"purple" };
  return <Badge type={map[std]||"gray"}>{std}</Badge>;
};

// ─── 공통 레이아웃 ──────────────────────────────────────────────────────────────
const Shell = ({ role, children, onSwitch }) => {
  const isHolding = role === "holding";
  return (
    <div style={{ display:"flex", height:"100vh", minHeight:640, background:"#f5f4f0", fontFamily:"'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width:200, minWidth:200, background:"#fff",
        borderRight:"0.5px solid rgba(0,0,0,0.1)",
        display:"flex", flexDirection:"column",
      }}>
        <div style={{ padding:"18px 16px 14px", borderBottom:"0.5px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#2c2c2a" }}>ESG Hub</div>
          <div style={{ fontSize:11, color:"#888780", marginTop:2 }}>지속가능경영 포털</div>
          {/* Role Switcher */}
          <div style={{
            marginTop:10, display:"flex", borderRadius:6,
            border:"0.5px solid rgba(0,0,0,0.12)", overflow:"hidden",
          }}>
            {["holding","subsidiary"].map(r => (
              <button key={r} onClick={() => onSwitch(r)} style={{
                flex:1, fontSize:10, padding:"5px 4px", border:"none", cursor:"pointer",
                fontWeight: role===r ? 600 : 400,
                background: role===r ? (r==="holding" ? "#0c447c" : "#3b6d11") : "#fff",
                color: role===r ? "#fff" : "#888780",
                transition:"all 0.15s",
              }}>
                {r === "holding" ? "지주사" : "계열사"}
              </button>
            ))}
          </div>
        </div>
        <nav style={{ padding:"8px 6px", flex:1 }}>
          {children.nav}
        </nav>
        <div style={{ padding:"12px 14px", borderTop:"0.5px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize:11, color:"#888780" }}>
            {isHolding ? "지주사 관리자" : "계열사 담당자"}
          </div>
          <div style={{ fontSize:12, fontWeight:500, color:"#2c2c2a", marginTop:1 }}>
            {isHolding ? "연시은 팀장" : "박지훈 대리"}
          </div>
          <div style={{ fontSize:11, color:"#888780", marginTop:1 }}>
            {isHolding ? "ESG 전략팀" : "㈜ A에너지"}
          </div>
        </div>
      </aside>
      {/* Main */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {children.main}
      </div>
    </div>
  );
};

const NavItem = ({ label, active, onClick, dot }) => (
  <div onClick={onClick} style={{
    display:"flex", alignItems:"center", gap:8,
    padding:"7px 10px", borderRadius:6, cursor:"pointer",
    background: active ? "#e8f1fb" : "transparent",
    color: active ? "#185fa5" : "#5f5e5a",
    fontWeight: active ? 500 : 400,
    fontSize:13, marginBottom:1,
    transition:"background 0.1s",
  }}>
    <span style={{
      width:6, height:6, borderRadius:"50%", flexShrink:0,
      background: active ? "#185fa5" : "#b4b2a9",
    }} />
    {label}
  </div>
);

const Topbar = ({ title, badge, actions }) => (
  <div style={{
    background:"#fff", borderBottom:"0.5px solid rgba(0,0,0,0.1)",
    padding:"0 24px", height:52,
    display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0,
  }}>
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <span style={{ fontSize:15, fontWeight:600, color:"#2c2c2a" }}>{title}</span>
      {badge}
    </div>
    <div style={{ display:"flex", gap:8 }}>{actions}</div>
  </div>
);

const Btn = ({ children, primary, small, onClick, color }) => (
  <button onClick={onClick} style={{
    fontSize: small ? 11 : 12,
    padding: small ? "4px 10px" : "6px 14px",
    borderRadius:6,
    border: primary ? "none" : "0.5px solid rgba(0,0,0,0.15)",
    background: primary ? (color||"#2c2c2a") : "#fff",
    color: primary ? "#fff" : "#2c2c2a",
    cursor:"pointer", fontWeight:500,
    transition:"opacity 0.1s",
  }}>{children}</button>
);

const Card = ({ children, style }) => (
  <div style={{
    background:"#fff", border:"0.5px solid rgba(0,0,0,0.1)",
    borderRadius:10, padding:16, ...style,
  }}>{children}</div>
);

const CardHeader = ({ title, action }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
    <span style={{ fontSize:13, fontWeight:600, color:"#2c2c2a" }}>{title}</span>
    {action}
  </div>
);

const MetricGrid = ({ items }) => (
  <div style={{ display:"grid", gridTemplateColumns:`repeat(${items.length}, minmax(0,1fr))`, gap:10, marginBottom:16 }}>
    {items.map((m,i) => (
      <div key={i} style={{ background:"#f5f4f0", borderRadius:8, padding:"12px 14px" }}>
        <div style={{ fontSize:11, color:"#888780", marginBottom:5 }}>{m.label}</div>
        <div style={{ fontSize:22, fontWeight:600, color:m.color||"#2c2c2a", lineHeight:1 }}>{m.value}</div>
        {m.sub && <div style={{ fontSize:11, color:"#b4b2a9", marginTop:3 }}>{m.sub}</div>}
      </div>
    ))}
  </div>
);

const Table = ({ cols, rows }) => (
  <div style={{ overflowX:"auto" }}>
    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
      <thead>
        <tr>
          {cols.map((c,i) => (
            <th key={i} style={{
              fontSize:11, fontWeight:500, color:"#888780",
              padding:"6px 10px", borderBottom:"0.5px solid rgba(0,0,0,0.1)",
              textAlign:"left", whiteSpace:"nowrap",
            }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row,i) => (
          <tr key={i} style={{ cursor:"default" }}
            onMouseEnter={e => e.currentTarget.style.background="#f5f4f0"}
            onMouseLeave={e => e.currentTarget.style.background="transparent"}
          >
            {row.map((cell,j) => (
              <td key={j} style={{
                padding:"9px 10px",
                borderBottom: i<rows.length-1 ? "0.5px solid rgba(0,0,0,0.07)" : "none",
                verticalAlign:"middle", color:"#2c2c2a",
              }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Tabs = ({ tabs, active, onChange }) => (
  <div style={{ display:"flex", borderBottom:"0.5px solid rgba(0,0,0,0.1)", marginBottom:18 }}>
    {tabs.map(t => (
      <div key={t.key} onClick={() => onChange(t.key)} style={{
        padding:"8px 16px", fontSize:13, cursor:"pointer",
        color: active===t.key ? "#185fa5" : "#888780",
        fontWeight: active===t.key ? 600 : 400,
        borderBottom: active===t.key ? "2px solid #185fa5" : "2px solid transparent",
        marginBottom:"-0.5px", whiteSpace:"nowrap", transition:"color 0.1s",
      }}>{t.label}</div>
    ))}
  </div>
);

// ─── 계열사 뷰 ────────────────────────────────────────────────────────────────
const SubsidiaryView = () => {
  const [tab, setTab] = useState("status");
  const [dpData, setDpData] = useState(SUBSIDIARY_INIT);

  const submit = (code) => setDpData(d => ({
    ...d, [code]: { ...d[code], submitted:true, status:"reviewing" }
  }));

  const totalWritten = Object.values(dpData).filter(d => d.written).length;
  const totalSubmitted = Object.values(dpData).filter(d => d.submitted).length;
  const totalApproved = Object.values(dpData).filter(d => d.status==="approved").length;
  const totalRejected = Object.values(dpData).filter(d => d.status==="rejected").length;

  return (
    <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
      <Topbar
        title="SR 보고서 작성 현황"
        badge={<Badge type="amber">제출 진행 중</Badge>}
        actions={[
          <Btn key="1">보고서 미리보기</Btn>,
          <Btn key="2" primary color="#185fa5">전체 제출</Btn>,
        ]}
      />
      <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
        <Tabs
          tabs={[
            { key:"status", label:"DP 항목 현황" },
            { key:"rejected", label:`반려 항목 (${totalRejected})` },
            { key:"history", label:"제출 이력" },
          ]}
          active={tab} onChange={setTab}
        />

        {tab === "status" && (
          <>
            <MetricGrid items={[
              { label:"전체 DP",    value:DP_ITEMS.length },
              { label:"작성 완료",  value:totalWritten,   color:"#5f5e5a",  sub:"작성 완료" },
              { label:"제출 완료",  value:totalSubmitted, color:"#185fa5",  sub:"검토 요청됨" },
              { label:"승인 완료",  value:totalApproved,  color:"#3b6d11",  sub:"승인됨" },
              { label:"반려",       value:totalRejected,  color:"#a32d2d",  sub:"재작성 필요" },
            ]} />

            {/* 진행률 카드 */}
            <Card style={{ marginBottom:16 }}>
              <CardHeader title="DP 항목별 진행 현황" />
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  { label:"작성 완료", val: Math.round(totalWritten/DP_ITEMS.length*100), color:"#5f5e5a" },
                  { label:"제출 완료", val: Math.round(totalSubmitted/DP_ITEMS.length*100), color:"#185fa5" },
                  { label:"승인 완료", val: Math.round(totalApproved/DP_ITEMS.length*100), color:"#3b6d11" },
                ].map(p => (
                  <div key={p.label}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:"#5f5e5a" }}>{p.label}</span>
                      <span style={{ fontSize:12, fontWeight:500 }}>{p.val}%</span>
                    </div>
                    <ProgressBar value={p.val} color={p.color} />
                  </div>
                ))}
              </div>
            </Card>

            {/* DP 항목 상세 테이블 */}
            <Card>
              <CardHeader
                title="DP 항목 상세"
                action={
                  <select style={{ fontSize:11, padding:"4px 8px", borderRadius:6, border:"0.5px solid rgba(0,0,0,0.15)", background:"#fff", color:"#2c2c2a" }}>
                    <option>전체</option><option>GRI</option><option>SASB</option><option>TCFD</option>
                  </select>
                }
              />
              <Table
                cols={["DP 코드","항목명","기준","카테고리","작성","제출","승인 상태","마지막 수정","액션"]}
                rows={DP_ITEMS.map(dp => {
                  const d = dpData[dp.code];
                  return [
                    <span style={{ fontWeight:600, fontSize:12, color:"#2c2c2a" }}>{dp.code}</span>,
                    <span style={{ color:"#444441" }}>{dp.name}</span>,
                    <StdBadge std={dp.std} />,
                    <Badge type="gray">{dp.category}</Badge>,
                    d.written ? <Badge type="green">완료</Badge> : <Badge type="gray">미작성</Badge>,
                    d.submitted ? <Badge type="blue">완료</Badge> : <Badge type="gray">미제출</Badge>,
                    statusBadge(d.status, d.submitted, d.written),
                    <span style={{ color:"#b4b2a9" }}>{d.updatedAt||"—"}</span>,
                    !d.submitted && d.written
                      ? <Btn small primary color="#185fa5" onClick={() => submit(dp.code)}>제출</Btn>
                      : d.status === "rejected"
                        ? <Btn small primary color="#a32d2d">재작성</Btn>
                        : <span style={{ fontSize:11, color:"#b4b2a9" }}>—</span>,
                  ];
                })}
              />
            </Card>
          </>
        )}

        {tab === "rejected" && (
          <Card>
            <CardHeader title="반려된 DP 항목" />
            {DP_ITEMS.filter(dp => dpData[dp.code].status === "rejected").length === 0
              ? <p style={{ color:"#b4b2a9", fontSize:13, textAlign:"center", padding:"24px 0" }}>반려된 항목이 없습니다.</p>
              : DP_ITEMS.filter(dp => dpData[dp.code].status === "rejected").map(dp => (
                <div key={dp.code} style={{
                  border:"0.5px solid #f7c1c1", borderRadius:8,
                  padding:"12px 14px", marginBottom:10, background:"#fcebeb",
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontWeight:600, fontSize:13, color:"#a32d2d" }}>{dp.code} · {dp.name}</span>
                    <Badge type="red">반려</Badge>
                  </div>
                  <p style={{ fontSize:12, color:"#791f1f", marginBottom:8 }}>
                    반려 사유: 데이터 단위 및 산정 방식 오류 — 기준서 재확인 후 재제출 바랍니다.
                  </p>
                  <Btn small primary color="#a32d2d">재작성하기</Btn>
                </div>
              ))
            }
          </Card>
        )}

        {tab === "history" && (
          <Card>
            <CardHeader title="제출 이력" />
            <Table
              cols={["일시","DP 코드","항목명","처리","처리자"]}
              rows={[
                ["25.03.22 14:11", "GRI 305-1", "직접 온실가스 배출", <Badge type="blue">제출</Badge>, "시스템"],
                ["25.03.21 09:30", "GRI 303-3", "취수량",            <Badge type="green">승인</Badge>, "연시은 팀장"],
                ["25.03.20 16:00", "SASB EM-EP","온실가스 배출 강도", <Badge type="red">반려</Badge>,   "안수호 차장"],
                ["25.03.20 09:12", "GRI 302-1", "에너지 소비량",      <Badge type="blue">제출</Badge>, "시스템"],
                ["25.03.18 11:00", "GRI 302-1", "에너지 소비량",      <Badge type="green">승인</Badge>, "연시은 팀장"],
              ]}
            />
          </Card>
        )}
      </div>
    </div>
  );
};

// ─── 지주사 뷰 ────────────────────────────────────────────────────────────────
const HoldingView = () => {
  const [tab, setTab] = useState("overview");
  const [selectedDp, setSelectedDp] = useState("GRI 302-1");
  const [holdingData, setHoldingData] = useState(HOLDING_DP_DATA);
  const [pageStatuses, setPageStatuses] = useState(
    Object.fromEntries(PAGES.map(p => [p.range, p.status]))
  );
  const [stdFilter, setStdFilter] = useState("전체");

  const approve = (dp, sub) => setHoldingData(d => ({
    ...d, [dp]: { ...d[dp], [sub]: { ...d[dp][sub], status:"approved", submitted:true } }
  }));
  const reject = (dp, sub) => setHoldingData(d => ({
    ...d, [dp]: { ...d[dp], [sub]: { ...d[dp][sub], status:"rejected" } }
  }));

  // 전체 현황 집계
  const allPairs = DP_ITEMS.flatMap(dp => SUBSIDIARIES.map(s => holdingData[dp.code][s]));
  const approvedCount = allPairs.filter(d => d.status==="approved").length;
  const submittedCount = allPairs.filter(d => d.submitted).length;
  const rejectedCount = allPairs.filter(d => d.status==="rejected").length;
  const totalPairs = allPairs.length;

  // DP별 집계
  const dpSummary = DP_ITEMS.map(dp => {
    const subs = SUBSIDIARIES.map(s => holdingData[dp.code][s]);
    return {
      ...dp,
      submitted: subs.filter(d => d.submitted).length,
      approved:  subs.filter(d => d.status==="approved").length,
      rejected:  subs.filter(d => d.status==="rejected").length,
      total: SUBSIDIARIES.length,
    };
  });

  const filteredDp = stdFilter === "전체" ? dpSummary : dpSummary.filter(d => d.std === stdFilter);

  const pageStatusColor = { done:"#3b6d11", wip:"#854f0b", todo:"#888780" };
  const pageStatusLabel = { done:"완성", wip:"작성중", todo:"미작성" };
  const pageStatusBg    = { done:"#eaf3de", wip:"#faeeda", todo:"#f1efe8" };
  const donePages = PAGES.filter(p => pageStatuses[p.range]==="done").length;

  return (
    <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
      <Topbar
        title="SR 보고서 관리"
        badge={<Badge type="blue">2024년도 · 지주사</Badge>}
        actions={[
          <Btn key="1">보고서 미리보기</Btn>,
          <Btn key="2" primary color="#0c447c">최종 확정</Btn>,
        ]}
      />
      <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
        <Tabs
          tabs={[
            { key:"overview",    label:"전체 현황" },
            { key:"dp",         label:"DP별 계열사 취합" },
            { key:"pages",      label:"페이지별 작성" },
            { key:"approval",   label:"승인 처리" },
          ]}
          active={tab} onChange={setTab}
        />

        {/* ── 전체 현황 ── */}
        {tab === "overview" && (
          <>
            <MetricGrid items={[
              { label:"공시기준 항목(DP)", value:DP_ITEMS.length },
              { label:"계열사",           value:SUBSIDIARIES.length },
              { label:"전체 제출률",      value:`${Math.round(submittedCount/totalPairs*100)}%`, color:"#185fa5" },
              { label:"전체 승인 건수",   value:approvedCount,   color:"#3b6d11" },
              { label:"반려 건수",        value:rejectedCount,    color:"#a32d2d" },
              { label:"페이지 완성률",    value:`${Math.round(donePages/PAGES.length*100)}%`, color:"#3b6d11" },
            ]} />

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
              {/* DP별 진행률 */}
              <Card>
                <CardHeader title="DP별 계열사 제출 현황" />
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {DP_ITEMS.slice(0,6).map(dp => {
                    const subs = SUBSIDIARIES.map(s => holdingData[dp.code][s]);
                    const sub = subs.filter(d => d.submitted).length;
                    return (
                      <div key={dp.code}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:12, color:"#444441" }}>{dp.code}</span>
                          <span style={{ fontSize:11, color:"#888780" }}>{sub}/{SUBSIDIARIES.length}</span>
                        </div>
                        <ProgressBar value={Math.round(sub/SUBSIDIARIES.length*100)} color="#185fa5" />
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* 계열사별 현황 */}
              <Card>
                <CardHeader title="계열사별 전체 제출 현황" />
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {SUBSIDIARIES.slice(0,7).map(sub => {
                    const items = DP_ITEMS.map(dp => holdingData[dp.code][sub]);
                    const done = items.filter(d => d.status==="approved").length;
                    const submitted = items.filter(d => d.submitted).length;
                    const pct = Math.round(submitted/DP_ITEMS.length*100);
                    const hasRejected = items.some(d => d.status==="rejected");
                    return (
                      <div key={sub} style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:12, width:90, color:"#444441", flexShrink:0 }}>{sub.replace("㈜ ","")}</span>
                        <div style={{ flex:1 }}>
                          <ProgressBar value={pct} color={hasRejected ? "#a32d2d" : pct===100 ? "#3b6d11" : "#185fa5"} />
                        </div>
                        <span style={{ fontSize:11, color:"#888780", minWidth:26 }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* 최근 처리 이력 */}
            <Card>
              <CardHeader title="최근 처리 내역" action={<span style={{ fontSize:11, color:"#185fa5", cursor:"pointer" }}>전체 이력</span>} />
              <Table
                cols={["일시","DP","계열사","처리","담당자"]}
                rows={[
                  ["25.03.25 14:22","GRI 302-1","㈜ A에너지", <Badge type="green">승인</Badge>,  "연시은 팀장"],
                  ["25.03.25 11:08","GRI 405-1","㈜ B화학",   <Badge type="red">반려</Badge>,    "안수호 차장"],
                  ["25.03.24 17:41","SASB EM-EP","㈜ C건설",  <Badge type="blue">제출됨</Badge>, "시스템"],
                  ["25.03.24 09:15","GRI 301-2","㈜ A에너지", <Badge type="green">승인</Badge>,  "연시은 팀장"],
                  ["25.03.23 15:00","GRI 303-3","㈜ D물산",   <Badge type="red">반려</Badge>,    "안수호 차장"],
                ]}
              />
            </Card>
          </>
        )}

        {/* ── DP별 계열사 취합 ── */}
        {tab === "dp" && (
          <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:14 }}>
            {/* DP 목록 */}
            <div>
              <div style={{ marginBottom:8 }}>
                <select
                  value={stdFilter}
                  onChange={e => setStdFilter(e.target.value)}
                  style={{ width:"100%", fontSize:12, padding:"6px 8px", borderRadius:6, border:"0.5px solid rgba(0,0,0,0.15)", background:"#fff", color:"#2c2c2a", marginBottom:8 }}
                >
                  <option>전체</option><option>GRI</option><option>SASB</option><option>TCFD</option>
                </select>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {filteredDp.map(dp => (
                  <div key={dp.code} onClick={() => setSelectedDp(dp.code)} style={{
                    padding:"10px 12px", borderRadius:8, cursor:"pointer",
                    border: selectedDp===dp.code ? "1px solid #185fa5" : "0.5px solid rgba(0,0,0,0.1)",
                    background: selectedDp===dp.code ? "#e8f1fb" : "#fff",
                    transition:"all 0.12s",
                  }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:600, color: selectedDp===dp.code ? "#185fa5" : "#2c2c2a" }}>{dp.code}</span>
                      <StdBadge std={dp.std} />
                    </div>
                    <div style={{ fontSize:11, color:"#888780", marginBottom:6 }}>{dp.name}</div>
                    <div style={{ display:"flex", gap:4 }}>
                      <Badge type="blue">{dp.submitted}제출</Badge>
                      <Badge type="green">{dp.approved}승인</Badge>
                      {dp.rejected > 0 && <Badge type="red">{dp.rejected}반려</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 선택된 DP 계열사 상세 */}
            <Card>
              <CardHeader
                title={`${selectedDp} · 계열사별 제출 현황`}
                action={<Btn small primary color="#0c447c">일괄 승인</Btn>}
              />
              <Table
                cols={["계열사","제출","제출일시","내용 요약","처리"]}
                rows={SUBSIDIARIES.map(sub => {
                  const d = holdingData[selectedDp][sub];
                  return [
                    <span style={{ fontWeight:600, fontSize:12 }}>{sub}</span>,
                    statusBadge(d.status, d.submitted, d.written),
                    <span style={{ color:"#b4b2a9" }}>25.03.{18 + SUBSIDIARIES.indexOf(sub) % 8}</span>,
                    <span style={{ color:"#888780", fontSize:11 }}>
                      {d.submitted ? `${sub} 제출 데이터 확인됨` : "미제출"}
                    </span>,
                    d.submitted && d.status !== "approved" && d.status !== "rejected"
                      ? (
                        <div style={{ display:"flex", gap:5 }}>
                          <Btn small primary color="#3b6d11" onClick={() => approve(selectedDp, sub)}>승인</Btn>
                          <Btn small primary color="#a32d2d" onClick={() => reject(selectedDp, sub)}>반려</Btn>
                        </div>
                      )
                      : d.status === "approved"
                        ? <span style={{ fontSize:11, color:"#3b6d11", fontWeight:500 }}>승인완료</span>
                        : d.status === "rejected"
                          ? <span style={{ fontSize:11, color:"#a32d2d", fontWeight:500 }}>반려됨</span>
                          : <Btn small>독촉 알림</Btn>,
                  ];
                })}
              />
            </Card>
          </div>
        )}

        {/* ── 페이지별 작성 (지주사 전용) ── */}
        {tab === "pages" && (
          <>
            <div style={{
              display:"flex", alignItems:"center", gap:8,
              padding:"10px 14px", borderRadius:8, marginBottom:16,
              background:"#e8f1fb", border:"0.5px solid rgba(24,95,165,0.2)",
            }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#185fa5", flexShrink:0 }} />
              <span style={{ fontSize:12, color:"#185fa5", fontWeight:500 }}>지주사 전용 기능</span>
              <span style={{ fontSize:12, color:"#5f5e5a" }}>페이지별 직접 작성은 지주사만 접근할 수 있습니다.</span>
            </div>
            <MetricGrid items={[
              { label:"전체 페이지",  value:PAGES.length },
              { label:"완성",        value:donePages,                                              color:"#3b6d11" },
              { label:"작성중",      value:PAGES.filter(p=>pageStatuses[p.range]==="wip").length,  color:"#854f0b" },
              { label:"미작성",      value:PAGES.filter(p=>pageStatuses[p.range]==="todo").length, color:"#a32d2d" },
            ]} />
            <Card>
              <CardHeader
                title="보고서 페이지 현황"
                action={<Btn small primary color="#0c447c">+ 페이지 추가</Btn>}
              />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px,1fr))", gap:10 }}>
                {PAGES.map(pg => {
                  const st = pageStatuses[pg.range];
                  return (
                    <div key={pg.range} style={{
                      border:`0.5px solid ${st==="done" ? "rgba(59,109,17,0.3)" : st==="wip" ? "rgba(133,79,11,0.3)" : "rgba(0,0,0,0.1)"}`,
                      borderRadius:8, padding:"10px 12px", cursor:"pointer",
                      background: st==="done" ? "#eaf3de" : st==="wip" ? "#faeeda" : "#fff",
                      transition:"all 0.12s",
                    }}>
                      <div style={{ fontSize:10, color:pageStatusColor[st], marginBottom:3, fontWeight:500 }}>{pg.range}</div>
                      <div style={{ fontSize:12, fontWeight:600, color:"#2c2c2a", marginBottom:8, lineHeight:1.4 }}>{pg.title}</div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{
                          fontSize:11, fontWeight:500,
                          color:pageStatusColor[st],
                          background:pageStatusBg[st],
                          padding:"2px 7px", borderRadius:4,
                        }}>{pageStatusLabel[st]}</span>
                        {st !== "done" && (
                          <button onClick={() => setPageStatuses(s => ({ ...s, [pg.range]:"done" }))} style={{
                            fontSize:10, padding:"2px 7px", borderRadius:4,
                            border:"0.5px solid rgba(0,0,0,0.15)", background:"#fff",
                            color:"#5f5e5a", cursor:"pointer",
                          }}>완료</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}

        {/* ── 승인 처리 ── */}
        {tab === "approval" && (
          <>
            <MetricGrid items={[
              { label:"승인 대기",  value: allPairs.filter(d=>d.submitted && d.status==="reviewing").length, color:"#854f0b" },
              { label:"승인 완료",  value: approvedCount,  color:"#3b6d11" },
              { label:"반려 처리",  value: rejectedCount,  color:"#a32d2d" },
              { label:"미제출 건",  value: allPairs.filter(d=>!d.submitted).length, color:"#888780" },
            ]} />
            <Card>
              <CardHeader
                title="승인 대기 목록"
                action={<Btn small primary color="#0c447c">일괄 승인</Btn>}
              />
              <Table
                cols={["DP 코드","항목명","기준","계열사","제출일","상태","처리"]}
                rows={DP_ITEMS.flatMap(dp =>
                  SUBSIDIARIES
                    .filter(sub => holdingData[dp.code][sub].status === "reviewing")
                    .map(sub => [
                      <span style={{ fontWeight:600, fontSize:12 }}>{dp.code}</span>,
                      <span style={{ color:"#444441" }}>{dp.name}</span>,
                      <StdBadge std={dp.std} />,
                      <span style={{ fontWeight:500 }}>{sub}</span>,
                      <span style={{ color:"#b4b2a9" }}>25.03.22</span>,
                      <Badge type="amber">검토중</Badge>,
                      <div style={{ display:"flex", gap:5 }}>
                        <Btn small primary color="#3b6d11" onClick={() => approve(dp.code, sub)}>승인</Btn>
                        <Btn small primary color="#a32d2d" onClick={() => reject(dp.code, sub)}>반려</Btn>
                      </div>,
                    ])
                )}
              />
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

// ─── 루트 ──────────────────────────────────────────────────────────────────────
export default function SRReportDashboard() {
  const [role, setRole] = useState("holding");

  const navItems = role === "holding"
    ? [
        { key:"overview", label:"전체 현황" },
        { key:"dp",       label:"DP별 취합" },
        { key:"pages",    label:"페이지 작성" },
        { key:"approval", label:"승인 처리" },
      ]
    : [
        { key:"status",   label:"DP 현황" },
        { key:"rejected", label:"반려 항목" },
        { key:"history",  label:"제출 이력" },
      ];

  return (
    <Shell role={role} onSwitch={setRole}>
      {{
        nav: navItems.map(n => <NavItem key={n.key} label={n.label} active={false} />),
        main: role === "holding" ? <HoldingView /> : <SubsidiaryView />,
      }}
    </Shell>
  );
}
