'use client';

import { useEffect, useState } from "react";

// ─── 팔레트 & 공통 ────────────────────────────────────────────────────────────
const C = {
  blue:   { bg:"#e8f1fb", text:"#185fa5", border:"rgba(24,95,165,0.25)" },
  green:  { bg:"#eaf3de", text:"#3b6d11", border:"rgba(59,109,17,0.25)" },
  amber:  { bg:"#faeeda", text:"#854f0b", border:"rgba(133,79,11,0.25)" },
  red:    { bg:"#fcebeb", text:"#a32d2d", border:"rgba(163,45,45,0.25)" },
  purple: { bg:"#eeedfe", text:"#534ab7", border:"rgba(83,74,183,0.25)" },
  gray:   { bg:"#f1efe8", text:"#5f5e5a", border:"rgba(0,0,0,0.12)" },
  navy:   { bg:"#e8f1fb", text:"#0c447c", border:"rgba(12,68,124,0.25)" },
};
const STD_C = { GRI: C.blue, SASB: C.amber, TCFD: C.purple };
const CAT_C = { "환경":"green", "사회":"blue", "지배구조":"purple" };

const COLS = [
  { key:"todo",      label:"미작성",    ...C.gray  },
  { key:"wip",       label:"작성 중",   ...C.amber },
  { key:"submitted", label:"제출 완료", ...C.blue  },
  { key:"approved",  label:"승인 완료", ...C.green },
];

// ─── 목 데이터 ────────────────────────────────────────────────────────────────
const DP_CARDS_INIT = [
  { id:"d1", title:"에너지 소비량",    standards:[{code:"GRI 302-1",type:"GRI"},{code:"SASB EM-EP",type:"SASB"}], category:"환경",    deadline:"25.04.10", status:"wip",       assignee:"박지훈",  savedText:"2024년 총 에너지 소비량은 전력 1,234 TJ, 도시가스 567 TJ이며 전년 대비 3.2% 감소하였습니다.\n\n재생에너지 비중은 12.4%로 전년(9.1%) 대비 증가하였으며, 태양광 설비 추가 설치(3MW)에 따른 결과입니다." },
  { id:"d2", title:"온실가스 배출",    standards:[{code:"GRI 305-1",type:"GRI"},{code:"GRI 305-2",type:"GRI"},{code:"TCFD S-1",type:"TCFD"}], category:"환경",    deadline:"25.04.10", status:"todo",      assignee:"김가영", savedText:"" },
  { id:"d3", title:"취수 및 방류",     standards:[{code:"GRI 303-3",type:"GRI"},{code:"GRI 303-4",type:"GRI"}], category:"환경",    deadline:"25.04.15", status:"submitted", assignee:"박지훈",  savedText:"2024년 총 취수량은 234,500 m³(지표수 180,000, 지하수 54,500)이며 전년 대비 1.8% 감소하였습니다.\n\n방류량은 198,200 m³이며 방류수 수질검사 결과 전 항목 기준치 이내입니다." },
  { id:"d4", title:"신규 채용·이직",   standards:[{code:"GRI 401-1",type:"GRI"}], category:"사회",    deadline:"25.04.20", status:"todo",      assignee:"김인사", savedText:"" },
  { id:"d5", title:"이사회 다양성",    standards:[{code:"GRI 405-1",type:"GRI"},{code:"SASB CG",type:"SASB"}], category:"지배구조", deadline:"25.04.08", status:"approved",  assignee:"안수호", savedText:"2024년 이사회는 총 9명으로 구성되어 있으며 여성이사 비율 22.2%(2명), 사외이사 비율 66.7%(6명)입니다." },
  { id:"d6", title:"기후 리스크 평가", standards:[{code:"TCFD S-2",type:"TCFD"},{code:"TCFD S-3",type:"TCFD"}], category:"환경",    deadline:"25.04.12", status:"wip",       assignee:"김가영", savedText:"물리적 리스크: 2030년 기준 홍수 리스크 노출 자산 약 320억원(전체의 4.2%)으로 평가됩니다.\n\n전환 리스크: 탄소세 도입 시나리오(50$/tCO₂)에서 추가 비용 연간 약 28억원 예상됩니다." },
  { id:"d7", title:"공급망 인권실사",  standards:[{code:"GRI 414-1",type:"GRI"},{code:"GRI 414-2",type:"GRI"}], category:"사회",    deadline:"25.04.25", status:"todo",      assignee:"박지훈",  savedText:"" },
  { id:"d8", title:"산업안전·보건",    standards:[{code:"GRI 403-9",type:"GRI"},{code:"GRI 403-10",type:"GRI"}], category:"사회",    deadline:"25.04.18", status:"submitted", assignee:"김인사", savedText:"2024년 재해율 0.42‰(전년 0.50‰), 산업재해 3건(경상 2건, 중상 1건), 직업성 질환 0건입니다.\n\n안전보건 교육 이수율 98.7%, 위험성 평가 실시율 100%입니다." },
];

const APPROVALS_INIT = [
  { id:"a1", dpId:"d3", docNo:"ESG-2025-029", title:"취수 및 방류 데이터 제출 승인 요청", drafter:"박지훈 대리", draftedAt:"25.03.21 09:30", status:"pending",  body:"GRI 303-3, GRI 303-4 기준에 따라 2024년도 취수 및 방류 데이터를 첨부하여 제출합니다.\n\n■ 취수량: 234,500 m³ (지표수 180,000 / 지하수 54,500)\n■ 방류량: 198,200 m³\n■ 재이용수: 36,300 m³\n\n데이터 검증 완료 후 SR 보고서에 반영 예정입니다.", attachments:["GRI303_data_2024.xlsx","수질검사결과서.pdf"], comments:[], rejReason:"" },
  { id:"a2", dpId:"d8", docNo:"ESG-2025-031", title:"산업안전보건 데이터 제출 승인 요청",   drafter:"김인사 대리", draftedAt:"25.03.22 14:11", status:"rejected", body:"GRI 403-9, GRI 403-10 기준에 따른 2024년도 산업안전보건 데이터를 제출합니다.\n\n■ 재해율: 0.42‰\n■ 산업재해 건수: 3건\n■ 직업성 질환: 0건", attachments:["안전보건_통계_2024.xlsx"], comments:[{author:"연시은 차장",date:"25.03.23 10:15",text:"재해 분류 기준 근거 자료 추가 첨부 필요합니다. ILO 기준 적용 여부 명시 바랍니다."}], rejReason:"재해 분류 기준 근거 자료 미첨부 — ILO 기준 적용 여부 명시 후 재상신 바랍니다." },
  { id:"a3", dpId:"d5", docNo:"ESG-2025-025", title:"이사회 다양성 데이터 제출 승인 요청",  drafter:"안수호 대리", draftedAt:"25.03.15 11:00", status:"approved", body:"GRI 405-1 기준에 따른 이사회 구성 다양성 데이터를 제출합니다.\n\n■ 총 이사 수: 9명\n■ 여성이사: 2명(22.2%)\n■ 사외이사: 6명(66.7%)\n■ 평균 재임기간: 3.2년", attachments:["이사회구성현황_2024.xlsx"], comments:[{author:"김지속 팀장",date:"25.03.17 14:30",text:"내용 확인 완료. 승인합니다."}], rejReason:"" },
];

// Holding 대시보드(신규)에서 사용할 국내 자회사(계열사) 목록
// - `SAMSUNG_SDS_ENTITY_STRUCTURE.md`의 국내 자회사 6개와 동일 표기 유지
const SUBS_DATA = [
  { name:"미라콤", short:"미라콤", submitted:7, approved:6, total:8, rejected:0, lastActivity:"25.03.25" },
  { name:"시큐아이", short:"시큐아이", submitted:7, approved:5, total:8, rejected:1, lastActivity:"25.03.24" },
  { name:"에스코어", short:"에스코어", submitted:6, approved:5, total:8, rejected:0, lastActivity:"25.03.23" },
  { name:"멀티캠퍼스", short:"멀티캠", submitted:4, approved:2, total:8, rejected:2, lastActivity:"25.03.22" },
  { name:"엠로", short:"엠로", submitted:6, approved:6, total:8, rejected:0, lastActivity:"25.03.25" },
  { name:"오픈핸즈", short:"오픈핸즈", submitted:0, approved:0, total:8, rejected:0, lastActivity:"-" },
];

// 국내 사업장(데이터센터/캠퍼스) — 지주사 관점에서 함께 표시
const DOMESTIC_SITES_DATA = [
  { name:"판교 IT 캠퍼스", short:"판교IT", submitted:6, approved:4, total:8, rejected:1, lastActivity:"25.03.24" },
  { name:"판교 물류 캠퍼스", short:"판교물류", submitted:5, approved:3, total:8, rejected:2, lastActivity:"25.03.23" },
  { name:"서울 R&D 캠퍼스", short:"서울R&D", submitted:6, approved:5, total:8, rejected:0, lastActivity:"25.03.25" },
  { name:"상암 데이터센터", short:"상암DC", submitted:4, approved:2, total:8, rejected:2, lastActivity:"25.03.22" },
  { name:"수원 데이터센터", short:"수원DC", submitted:6, approved:4, total:8, rejected:1, lastActivity:"25.03.23" },
  { name:"춘천 데이터센터", short:"춘천DC", submitted:3, approved:2, total:8, rejected:1, lastActivity:"25.03.21" },
  { name:"동탄 데이터센터", short:"동탄DC", submitted:4, approved:3, total:8, rejected:0, lastActivity:"25.03.20" },
  { name:"구미 데이터센터", short:"구미DC", submitted:2, approved:1, total:8, rejected:1, lastActivity:"25.03.19" },
];

const DP_META = [
  { code:"GRI 302-1", name:"에너지 소비량"    },
  { code:"GRI 305-1", name:"온실가스 배출"    },
  { code:"GRI 303-3", name:"취수 및 방류"     },
  { code:"GRI 401-1", name:"신규 채용·이직"   },
  { code:"GRI 405-1", name:"이사회 다양성"    },
  { code:"TCFD S-2",  name:"기후 리스크"      },
  { code:"GRI 414-1", name:"공급망 인권실사"  },
  { code:"GRI 403-9", name:"산업안전·보건"    },
];

// ─── 원자 컴포넌트 ─────────────────────────────────────────────────────────────
const Tag = ({ ckey="gray", small, children, onClick }) => {
  const s = C[ckey] || C.gray;
  return (
    <span onClick={onClick} style={{
      background:s.bg, color:s.text,
      fontSize:small?10:11, fontWeight:600,
      padding:small?"1px 6px":"2px 8px", borderRadius:4,
      whiteSpace:"nowrap", cursor:onClick?"pointer":"default",
      border:`0.5px solid ${s.border}`,
    }}>{children}</span>
  );
};

const Btn = ({ children, variant="ghost", small, onClick, disabled, full, style }) => {
  const vs = {
    primary: { bg:"#0c447c", color:"#fff", border:"none" },
    danger:  { bg:"#a32d2d", color:"#fff", border:"none" },
    success: { bg:"#3b6d11", color:"#fff", border:"none" },
    ghost:   { bg:"#fff",    color:"#2c2c2a", border:"0.5px solid rgba(0,0,0,0.18)" },
    subtle:  { bg:"#f1efe8", color:"#2c2c2a", border:"none" },
  };
  const v = vs[variant] || vs.ghost;
  return (
    <button disabled={disabled} onClick={onClick} style={{
      fontSize:small?11:13, padding:small?"5px 11px":"7px 16px",
      borderRadius:7, border:v.border, background:disabled?"#e8e6de":v.bg,
      color:disabled?"#b4b2a9":v.color, cursor:disabled?"not-allowed":"pointer",
      fontWeight:600, width:full?"100%":undefined, transition:"opacity 0.12s",
      ...style,
    }}>{children}</button>
  );
};

const Divider = () => <div style={{ height:"0.5px", background:"rgba(0,0,0,0.08)", margin:"14px 0" }}/>;

const SLabel = ({ children }) => (
  <div style={{ fontSize:10, fontWeight:700, color:"#b4b2a9", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>{children}</div>
);

const Modal = ({ width=560, onClose, children }) => (
  <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
    style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,padding:20 }}>
    <div style={{ background:"#fff",borderRadius:14,width,maxWidth:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 16px 48px rgba(0,0,0,0.22)" }}>
      {children}
    </div>
  </div>
);

const ModalHeader = ({ title, sub, onClose }) => (
  <div style={{ padding:"18px 24px 14px",borderBottom:"0.5px solid rgba(0,0,0,0.1)",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0 }}>
    <div>
      {sub && <div style={{ fontSize:10,fontWeight:700,color:"#b4b2a9",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4 }}>{sub}</div>}
      <div style={{ fontSize:16,fontWeight:800,color:"#0c447c" }}>{title}</div>
    </div>
    <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#b4b2a9",padding:0,marginLeft:12,lineHeight:1 }}>×</button>
  </div>
);

const Toast = ({ msg, onDone }) => {
  setTimeout(onDone, 2400);
  return (
    <div style={{ position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",background:"#2c2c2a",color:"#fff",fontSize:13,fontWeight:600,padding:"11px 22px",borderRadius:30,zIndex:9999,boxShadow:"0 4px 16px rgba(0,0,0,0.25)",whiteSpace:"nowrap" }}>
      {msg}
    </div>
  );
};

const ProgBar = ({ val, color="#185fa5", thin }) => (
  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
    <div style={{ flex:1, height:thin?3:4, background:"#e8e6de", borderRadius:3, overflow:"hidden" }}>
      <div style={{ width:`${val}%`, height:"100%", background:color, borderRadius:3, transition:"width 0.5s" }}/>
    </div>
    <span style={{ fontSize:10, color:"#b4b2a9", minWidth:24, textAlign:"right" }}>{val}%</span>
  </div>
);

// ─── DP 입력 상세 페이지 (풀스크린 오버레이) ──────────────────────────────────
const DPDetailPage = ({ card, onClose, onSave, onSubmitDraft }) => {
  const [text, setText] = useState(card.savedText || "");
  const [activeStd, setActiveStd] = useState(card.standards[0].code);
  const isDirty = text !== (card.savedText || "");

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <div style={{ position:"fixed",inset:0,background:"#f5f4f0",zIndex:8000,display:"flex",flexDirection:"column",fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      {/* 상단바 */}
      <div style={{ background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,0.1)",padding:"0 24px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#888780",fontWeight:600,padding:0,display:"flex",alignItems:"center",gap:4 }}>
            ← 돌아가기
          </button>
          <span style={{ color:"#d3d1c7" }}>|</span>
          <span style={{ fontSize:14,fontWeight:800,color:"#2c2c2a" }}>{card.title}</span>
          <Tag ckey={CAT_C[card.category]} small>{card.category}</Tag>
          {isDirty && <Tag ckey="amber" small>미저장</Tag>}
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <Btn variant="ghost" small onClick={onClose}>취소</Btn>
          <Btn variant="subtle" small onClick={()=>onSave(card.id,text)}>임시저장</Btn>
          {card.status==="wip" && (
            <Btn variant="primary" small onClick={()=>{onSave(card.id,text,"submitted");onClose();}}>
              작성 완료 · 제출 완료로 이동
            </Btn>
          )}
          {card.status==="todo" && (
            <Btn variant="primary" small onClick={()=>{onSave(card.id,text,"wip");onClose();}}>
              저장 · 작성 중으로 이동
            </Btn>
          )}
        </div>
      </div>

      <div style={{ flex:1,overflow:"hidden",display:"grid",gridTemplateColumns:"260px 1fr 300px",gap:0 }}>
        {/* 왼쪽: 기준 목록 */}
        <div style={{ background:"#fff",borderRight:"0.5px solid rgba(0,0,0,0.1)",padding:"16px 12px",overflowY:"auto" }}>
          <SLabel>연결된 공시 기준</SLabel>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {card.standards.map(s=>(
              <div key={s.code} onClick={()=>setActiveStd(s.code)} style={{
                padding:"10px 12px",borderRadius:8,cursor:"pointer",
                border:activeStd===s.code?`1px solid ${STD_C[s.type].text}`:"0.5px solid rgba(0,0,0,0.1)",
                background:activeStd===s.code?STD_C[s.type].bg:"#fff",
                transition:"all 0.12s",
              }}>
                <div style={{ fontSize:12,fontWeight:800,color:activeStd===s.code?STD_C[s.type].text:"#2c2c2a",marginBottom:3 }}>{s.code}</div>
                <div style={{ fontSize:11,color:"#888780" }}>{s.type} 기준 · 클릭하면 가이드 확인</div>
              </div>
            ))}
          </div>

          <Divider/>
          <SLabel>작성 가이드 ({activeStd})</SLabel>
          <div style={{ fontSize:12,color:"#5f5e5a",lineHeight:1.7,background:"#f5f4f0",borderRadius:7,padding:"10px 12px" }}>
            {activeStd.startsWith("GRI 302") && "재생에너지, 화석연료, 전력 등 에너지원별 소비량을 기재하세요. 단위는 TJ 또는 MWh로 통일합니다."}
            {activeStd.startsWith("GRI 303") && "취수원(지표수/지하수/빗물/해수)별 취수량을 구분하여 기재하세요. 물 스트레스 지역 여부도 명시합니다."}
            {activeStd.startsWith("GRI 305") && "Scope 1(직접), Scope 2(간접), Scope 3(기타 간접) 배출량을 구분하여 tCO₂eq 단위로 기재합니다."}
            {activeStd.startsWith("GRI 401") && "성별, 연령대(30세 미만/30~50세/50세 이상)별 신규 채용 수 및 이직자 수를 기재합니다."}
            {activeStd.startsWith("GRI 405") && "이사회 구성원의 성별, 연령, 국적 다양성 지표를 기재합니다. 소수집단 구성원 수도 포함합니다."}
            {activeStd.startsWith("GRI 403") && "업무상 부상 건수, 재해율, 직업성 질환 건수를 기재합니다. 근로자와 도급업체 종사자를 구분합니다."}
            {activeStd.startsWith("GRI 414") && "인권 영향 평가를 실시한 공급업체 수 및 비율, 주요 우려 사항을 기재합니다."}
            {activeStd.startsWith("TCFD") && "물리적 리스크(급성·만성)와 전환 리스크(정책·기술·시장)를 시나리오 분석에 기반하여 기재합니다."}
            {activeStd.startsWith("SASB") && "SASB 해당 섹터 기준에 따른 정량·정성 데이터를 기재합니다. 산업별 지표를 확인하세요."}
          </div>

          <Divider/>
          <SLabel>작성 현황</SLabel>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {[
              { label:"마감일",  value:card.deadline, color:"#2c2c2a" },
              { label:"담당자",  value:card.assignee, color:"#2c2c2a" },
              { label:"글자 수", value:`${charCount}자`, color:charCount>50?"#3b6d11":"#a32d2d" },
              { label:"단어 수", value:`${wordCount}단어`, color:"#2c2c2a" },
            ].map(f=>(
              <div key={f.label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ fontSize:11,color:"#b4b2a9" }}>{f.label}</span>
                <span style={{ fontSize:12,fontWeight:600,color:f.color }}>{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 가운데: 편집 영역 */}
        <div style={{ display:"flex",flexDirection:"column",padding:"24px",overflowY:"auto" }}>
          <div style={{ fontSize:11,color:"#b4b2a9",marginBottom:10 }}>
            {card.standards.map(s=>s.code).join(" · ")} 기준에 따른 2024년도 데이터를 자유롭게 서술하세요.
          </div>
          <textarea
            value={text}
            onChange={e=>setText(e.target.value)}
            placeholder={`${card.title}에 대한 2024년도 데이터와 현황을 서술하세요.\n\n예시:\n- 정량 데이터 (수치, 단위)\n- 전년 대비 변화 및 원인\n- 특이사항 및 산정 방법론`}
            style={{
              flex:1, minHeight:360, fontSize:14, lineHeight:1.85,
              padding:"16px 18px", borderRadius:9,
              border:"0.5px solid rgba(0,0,0,0.15)",
              background:"#fff", color:"#2c2c2a",
              resize:"none", outline:"none", fontFamily:"inherit",
            }}
          />
          {card.status==="approved" && (
            <div style={{ marginTop:10,padding:"10px 14px",borderRadius:7,background:"#eaf3de",border:"0.5px solid rgba(59,109,17,0.25)" }}>
              <span style={{ fontSize:12,color:"#3b6d11",fontWeight:700 }}>승인 완료 — 지주사에서 최종 승인된 항목입니다.</span>
            </div>
          )}
        </div>

        {/* 오른쪽: 히스토리 & 코멘트 */}
        <div style={{ background:"#fff",borderLeft:"0.5px solid rgba(0,0,0,0.1)",padding:"16px",overflowY:"auto" }}>
          <SLabel>활동 이력</SLabel>
          <div style={{ display:"flex",flexDirection:"column",gap:0 }}>
            {[
              { date:"25.03.22", actor:"박지훈 대리",   action:"데이터 입력 수정",  color:"#5f5e5a" },
              { date:"25.03.20", actor:"연시은 차장",   action:"검토 의견 등록",    color:"#185fa5" },
              { date:"25.03.18", actor:"박지훈 대리",   action:"최초 작성",          color:"#5f5e5a" },
            ].map((h,i)=>(
              <div key={i} style={{ display:"flex",gap:10,paddingBottom:12,position:"relative" }}>
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:h.color,marginTop:3,flexShrink:0 }}/>
                  {i<2 && <div style={{ width:1,flex:1,background:"#e8e6de",marginTop:4 }}/>}
                </div>
                <div style={{ paddingBottom:i<2?4:0 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:"#2c2c2a" }}>{h.action}</div>
                  <div style={{ fontSize:11,color:"#b4b2a9",marginTop:1 }}>{h.actor} · {h.date}</div>
                </div>
              </div>
            ))}
          </div>

          <Divider/>
          <SLabel>코멘트</SLabel>
          <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:10 }}>
            {card.id==="d8" ? (
              <div style={{ padding:"10px 12px",borderRadius:7,background:"#fcebeb",border:"0.5px solid rgba(163,45,45,0.2)" }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:12,fontWeight:700,color:"#a32d2d" }}>연시은 차장</span>
                  <span style={{ fontSize:10,color:"#b4b2a9" }}>25.03.23</span>
                </div>
                <div style={{ fontSize:12,color:"#791f1f",lineHeight:1.6 }}>재해 분류 기준 근거 자료 추가 첨부 필요합니다. ILO 기준 적용 여부 명시 바랍니다.</div>
              </div>
            ) : (
              <div style={{ fontSize:12,color:"#d3d1c7",textAlign:"center",padding:"14px 0" }}>등록된 코멘트가 없습니다</div>
            )}
          </div>
          <textarea placeholder="코멘트를 입력하세요..." rows={3} style={{
            width:"100%",fontSize:12,padding:"8px 10px",borderRadius:7,
            border:"0.5px solid rgba(0,0,0,0.15)",background:"#fafaf8",
            color:"#2c2c2a",resize:"none",outline:"none",fontFamily:"inherit",boxSizing:"border-box",
          }}/>
          <Btn variant="subtle" small full style={{ marginTop:6 }}>코멘트 등록</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── 기안 모달 ────────────────────────────────────────────────────────────────
const DraftModal = ({ card, onClose, onSubmit }) => {
  const [title, setTitle] = useState(`[${card.title}] SR 보고서 데이터 제출 승인 요청`);
  const [body, setBody] = useState(card.savedText
    ? `${card.standards.map(s=>s.code).join(", ")} 기준에 따라 2024년도 "${card.title}" 데이터를 제출합니다.\n\n${card.savedText}\n\n검토 후 SR 보고서 반영 부탁드립니다.`
    : `${card.standards.map(s=>s.code).join(", ")} 기준에 따라 2024년도 "${card.title}" 데이터를 제출합니다.\n\n■ 데이터 요약:\n\n■ 특이사항:\n\n검토 후 SR 보고서 반영 부탁드립니다.`
  );
  return (
    <Modal width={620} onClose={onClose}>
      <ModalHeader title="SR 데이터 제출 기안" sub="전자결재 · 기안 작성" onClose={onClose}/>
      <div style={{ padding:"18px 24px 24px" }}>
        {/* 결재선 */}
        <SLabel>결재선</SLabel>
        <div style={{ display:"flex",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:9,overflow:"hidden",marginBottom:18 }}>
          {[{role:"기안",name:"박지훈 대리",dept:"ESG팀",done:true},{role:"검토",name:"연시은 차장",dept:"ESG팀",done:false},{role:"승인",name:"김지속 팀장",dept:"지주사 ESG팀",done:false}].map((a,i)=>(
            <div key={i} style={{ flex:1,padding:"11px 10px",textAlign:"center",borderRight:i<2?"0.5px solid rgba(0,0,0,0.08)":"none",background:a.done?"#eaf3de":"#fff" }}>
              <div style={{ fontSize:10,fontWeight:700,color:a.done?"#3b6d11":"#b4b2a9",marginBottom:3 }}>{a.role}</div>
              <div style={{ fontSize:12,fontWeight:800,color:"#2c2c2a",marginBottom:2 }}>{a.name}</div>
              <div style={{ fontSize:10,color:"#b4b2a9" }}>{a.dept}</div>
              <div style={{ fontSize:10,color:a.done?"#3b6d11":"#d3d1c7",marginTop:3 }}>{a.done?"기안 완료":"대기"}</div>
            </div>
          ))}
        </div>

        {/* 문서정보 */}
        <SLabel>문서 정보</SLabel>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px 20px",marginBottom:16 }}>
          {[["기안부서","ESG팀"],["기안일","2025.03.26"],["문서번호","ESG-2025-034"],["보존기간","5년"]].map(([k,v])=>(
            <div key={k} style={{ display:"flex",gap:8,alignItems:"center" }}>
              <span style={{ fontSize:11,color:"#b4b2a9",width:56,flexShrink:0 }}>{k}</span>
              <span style={{ fontSize:12,fontWeight:700,color:"#2c2c2a" }}>{v}</span>
            </div>
          ))}
        </div>

        <SLabel>제목</SLabel>
        <input value={title} onChange={e=>setTitle(e.target.value)} style={{
          width:"100%",fontSize:13,padding:"9px 12px",borderRadius:7,
          border:"0.5px solid rgba(0,0,0,0.15)",background:"#fafaf8",
          color:"#2c2c2a",outline:"none",boxSizing:"border-box",marginBottom:14,
        }}/>

        <SLabel>관련 DP</SLabel>
        <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:14 }}>
          {card.standards.map(s=><Tag key={s.code} ckey={s.type==="GRI"?"blue":s.type==="SASB"?"amber":"purple"} small>{s.code}</Tag>)}
        </div>

        <SLabel>본문</SLabel>
        <textarea value={body} onChange={e=>setBody(e.target.value)} rows={7} style={{
          width:"100%",fontSize:13,padding:"10px 12px",borderRadius:7,
          border:"0.5px solid rgba(0,0,0,0.15)",background:"#fafaf8",
          color:"#2c2c2a",resize:"vertical",outline:"none",lineHeight:1.75,
          fontFamily:"inherit",boxSizing:"border-box",marginBottom:14,
        }}/>

        <SLabel>첨부파일</SLabel>
        <div style={{ padding:"10px 14px",borderRadius:7,background:"#f5f4f0",marginBottom:20,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
          <Tag ckey="blue" small>첨부 {card.title}_data_2024.xlsx</Tag>
          <Tag ckey="gray" small>+ 파일 추가</Tag>
        </div>

        <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
          <Btn variant="ghost" onClick={onClose}>취소</Btn>
          <Btn variant="primary" onClick={()=>onSubmit({title,body,card})}>결재 상신 →</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── 결재 문서함 ──────────────────────────────────────────────────────────────
const ApprovalBox = ({ approvals, setApprovals, cards, isHolding, selectedDocId }) => {
  const [selId, setSelId] = useState(approvals[0]?.id);
  const [rejText, setRejText] = useState("");
  const [showRejInput, setShowRejInput] = useState(false);

  useEffect(() => {
    if (!selectedDocId) return;
    const exists = approvals.some(a => a.id === selectedDocId);
    if (exists) setSelId(selectedDocId);
  }, [selectedDocId, approvals]);

  const doc = approvals.find(a=>a.id===selId);
  const card = doc ? cards.find(c=>c.id===doc.dpId) : null;
  const stMap = {
    pending:  { label:"결재 대기", ckey:"amber" },
    approved: { label:"승인 완료", ckey:"green" },
    rejected: { label:"반려",      ckey:"red"   },
  };
  const upd = (id,patch) => setApprovals(p=>p.map(a=>a.id===id?{...a,...patch}:a));

  return (
    <div style={{ display:"flex",height:"100%",minHeight:400 }}>
      {/* 목록 */}
      <div style={{ width:268,borderRight:"0.5px solid rgba(0,0,0,0.1)",display:"flex",flexDirection:"column",flexShrink:0 }}>
        <div style={{ padding:"12px 16px 10px",borderBottom:"0.5px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize:12,fontWeight:800,color:"#2c2c2a" }}>결재 문서함</div>
          <div style={{ fontSize:11,color:"#b4b2a9",marginTop:1 }}>총 {approvals.length}건 · 대기 {approvals.filter(a=>a.status==="pending").length}건</div>
        </div>
        <div style={{ flex:1,overflowY:"auto" }}>
          {approvals.map(a=>{
            const st = stMap[a.status];
            const aCard = cards.find(c=>c.id===a.dpId);
            return (
              <div key={a.id} onClick={()=>{setSelId(a.id);setShowRejInput(false);}} style={{
                padding:"12px 14px",cursor:"pointer",
                borderBottom:"0.5px solid rgba(0,0,0,0.07)",
                background:selId===a.id?"#e8f1fb":"#fff",
                borderLeft:selId===a.id?"3px solid #0c447c":"3px solid transparent",
              }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                  <Tag ckey={st.ckey} small>{st.label}</Tag>
                  <span style={{ fontSize:10,color:"#d3d1c7" }}>{a.draftedAt}</span>
                </div>
                <div style={{ fontSize:12,fontWeight:700,color:"#2c2c2a",lineHeight:1.4,marginBottom:3 }}>{a.title}</div>
                <div style={{ fontSize:11,color:"#b4b2a9",marginBottom:6 }}>{a.drafter}</div>
                {aCard && <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
                  {aCard.standards.slice(0,2).map(s=><Tag key={s.code} ckey={s.type==="GRI"?"blue":s.type==="SASB"?"amber":"purple"} small>{s.code}</Tag>)}
                </div>}
              </div>
            );
          })}
          {approvals.length===0 && <div style={{ padding:"32px 16px",textAlign:"center",color:"#d3d1c7",fontSize:13 }}>결재 문서가 없습니다</div>}
        </div>
      </div>

      {/* 문서 뷰어 */}
      {doc ? (
        <div style={{ flex:1,overflowY:"auto",padding:"24px 28px" }}>
          <div style={{ marginBottom:20,paddingBottom:16,borderBottom:"0.5px solid rgba(0,0,0,0.1)" }}>
            <div style={{ fontSize:11,color:"#b4b2a9",marginBottom:6 }}>{doc.docNo} · {doc.draftedAt}</div>
            <div style={{ fontSize:19,fontWeight:800,color:"#0c447c",marginBottom:10,lineHeight:1.3 }}>{doc.title}</div>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <Tag ckey={stMap[doc.status].ckey}>{stMap[doc.status].label}</Tag>
              <span style={{ fontSize:12,color:"#888780" }}>기안: {doc.drafter}</span>
            </div>
          </div>

          {/* 결재선 */}
          <SLabel>결재 현황</SLabel>
          <div style={{ display:"flex",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:9,overflow:"hidden",marginBottom:20 }}>
            {[
              {role:"기안",  name:"박지훈 대리",   dept:"ESG팀",       done:true,                        date:doc.draftedAt},
              {role:"검토",  name:"연시은 차장",   dept:"ESG팀",       done:doc.status!=="pending",      date:doc.status!=="pending"?"25.03.23":null},
              {role:"최종승인",name:"김지속 팀장", dept:"지주사 ESG팀",done:doc.status==="approved",     date:doc.status==="approved"?"25.03.24":null},
            ].map((a,i)=>(
              <div key={i} style={{ flex:1,padding:"11px 10px",textAlign:"center",borderRight:i<2?"0.5px solid rgba(0,0,0,0.08)":"none",background:a.done?"#eaf3de":"#fff" }}>
                <div style={{ fontSize:10,fontWeight:700,color:a.done?"#3b6d11":"#b4b2a9",marginBottom:3 }}>{a.role}</div>
                <div style={{ fontSize:12,fontWeight:800,color:"#2c2c2a",marginBottom:2 }}>{a.name}</div>
                <div style={{ fontSize:10,color:"#b4b2a9",marginBottom:3 }}>{a.dept}</div>
                <div style={{ fontSize:10,color:a.done?"#3b6d11":"#d3d1c7" }}>{a.done?`${a.date}`:"대기 중"}</div>
              </div>
            ))}
          </div>

          {card && (<>
            <SLabel>관련 DP</SLabel>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:18 }}>
              {card.standards.map(s=><Tag key={s.code} ckey={s.type==="GRI"?"blue":s.type==="SASB"?"amber":"purple"}>{s.code}</Tag>)}
              <Tag ckey={CAT_C[card.category]}>{card.category}</Tag>
            </div>
          </>)}

          <SLabel>본문</SLabel>
          <div style={{ background:"#fafaf8",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:8,padding:"14px 16px",marginBottom:18,fontSize:13,color:"#2c2c2a",lineHeight:1.8,whiteSpace:"pre-wrap" }}>{doc.body}</div>

          <SLabel>첨부파일</SLabel>
          <div style={{ display:"flex",gap:8,marginBottom:20 }}>
            {doc.attachments.map(f=>(
              <div key={f} style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:7,border:"0.5px solid rgba(0,0,0,0.12)",background:"#fff",fontSize:12,color:"#2c2c2a",cursor:"pointer" }}>첨부 {f}</div>
            ))}
          </div>

          {/* 반려 사유 */}
          {doc.status==="rejected" && doc.rejReason && (
            <div style={{ padding:"12px 16px",borderRadius:8,background:"#fcebeb",border:"0.5px solid rgba(163,45,45,0.2)",marginBottom:18 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"#a32d2d",marginBottom:4 }}>반려 사유</div>
              <div style={{ fontSize:13,color:"#791f1f",lineHeight:1.7 }}>{doc.rejReason}</div>
            </div>
          )}

          {/* 코멘트 */}
          {doc.comments.length>0 && (<>
            <SLabel>검토 의견</SLabel>
            <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:18 }}>
              {doc.comments.map((c,i)=>(
                <div key={i} style={{ padding:"10px 14px",borderRadius:7,background:"#f5f4f0",border:"0.5px solid rgba(0,0,0,0.08)" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                    <span style={{ fontSize:12,fontWeight:700,color:"#2c2c2a" }}>{c.author}</span>
                    <span style={{ fontSize:11,color:"#b4b2a9" }}>{c.date}</span>
                  </div>
                  <div style={{ fontSize:13,color:"#2c2c2a",lineHeight:1.7 }}>{c.text}</div>
                </div>
              ))}
            </div>
          </>)}

          {/* 결재 처리 영역 */}
          {doc.status==="pending" && (
            <div style={{ padding:"16px",borderRadius:9,background:"#f5f4f0",border:"0.5px solid rgba(0,0,0,0.1)" }}>
              {isHolding ? (
                <>
                  <div style={{ fontSize:12,fontWeight:700,color:"#5f5e5a",marginBottom:10 }}>결재 처리</div>
                  {showRejInput ? (
                    <>
                      <div style={{ fontSize:12,color:"#5f5e5a",marginBottom:6 }}>반려 사유를 입력하세요</div>
                      <textarea value={rejText} onChange={e=>setRejText(e.target.value)} rows={3} placeholder="담당자에게 전달될 반려 사유를 구체적으로 작성해주세요."
                        style={{ width:"100%",fontSize:13,padding:"9px 12px",borderRadius:7,border:"0.5px solid rgba(0,0,0,0.15)",background:"#fff",color:"#2c2c2a",resize:"none",outline:"none",fontFamily:"inherit",boxSizing:"border-box",marginBottom:10 }}
                      />
                      <div style={{ display:"flex",gap:8 }}>
                        <Btn variant="ghost" small onClick={()=>{setShowRejInput(false);setRejText("");}}>취소</Btn>
                        <Btn variant="danger" small disabled={!rejText.trim()} onClick={()=>upd(doc.id,{status:"rejected",rejReason:rejText})}>반려 확정</Btn>
                      </div>
                    </>
                  ) : (
                    <div style={{ display:"flex",gap:8 }}>
                      <Btn variant="success" small onClick={()=>upd(doc.id,{status:"approved"})}>승인</Btn>
                      <Btn variant="danger"  small onClick={()=>setShowRejInput(true)}>✗ 반려</Btn>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize:12,color:"#888780" }}>지주사 검토·승인 대기 중입니다. 승인 완료 시 알림이 발송됩니다.</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"#d3d1c7",fontSize:13 }}>문서를 선택하세요</div>
      )}
    </div>
  );
};

// ─── 독촉 알림 모달 ───────────────────────────────────────────────────────────
const NudgeModal = ({ sub, dp, onClose, onSend }) => {
  const [msg, setMsg] = useState(`안녕하세요, ESG팀입니다.\n\n${sub.name}의 SR 보고서 데이터 제출을 요청드립니다.\n\n[미제출 항목]\n${dp ? `- ${dp.code}: ${dp.name}` : "- 전체 미제출 항목"}\n\n제출 마감: 2025년 4월 15일(화)\n\n빠른 처리 부탁드립니다.\n\nESG전략팀 드림`);
  return (
    <Modal width={520} onClose={onClose}>
      <ModalHeader title={`${sub.name} · 독촉 알림 발송`} sub="미제출 알림" onClose={onClose}/>
      <div style={{ padding:"18px 24px 24px" }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px 20px",marginBottom:16 }}>
          {[["수신자",`${sub.name} ESG 담당자`],["발신자","김지속 팀장 (ESG전략팀)"],["발송 채널","이메일 + 시스템 알림"],["미제출 현황",`${sub.total-sub.submitted}개 항목`]].map(([k,v])=>(
            <div key={k} style={{ display:"flex",gap:8,alignItems:"center" }}>
              <span style={{ fontSize:11,color:"#b4b2a9",width:70,flexShrink:0 }}>{k}</span>
              <span style={{ fontSize:12,fontWeight:700,color:"#2c2c2a" }}>{v}</span>
            </div>
          ))}
        </div>
        <Divider/>
        <SLabel>알림 메시지</SLabel>
        <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={10} style={{
          width:"100%",fontSize:13,padding:"12px 14px",borderRadius:8,
          border:"0.5px solid rgba(0,0,0,0.15)",background:"#fafaf8",
          color:"#2c2c2a",resize:"none",outline:"none",lineHeight:1.8,
          fontFamily:"inherit",boxSizing:"border-box",marginBottom:16,
        }}/>
        <div style={{ display:"flex",justifyContent:"flex-end",gap:8 }}>
          <Btn variant="ghost" onClick={onClose}>취소</Btn>
          <Btn variant="primary" onClick={()=>{onSend();onClose();}}>발송하기 →</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── 칸반 카드 ────────────────────────────────────────────────────────────────
const KanbanCard = ({ card, onClick, onDraft, onDragStart, isSelected }) => {
  const col = COLS.find(c=>c.key===card.status);
  const isRejected = card.id==="d8" && card.status==="submitted";
  return (
    <div
      id={`dp-card-${card.id}`}
      draggable
      onDragStart={e=>onDragStart(e,card.id)}
      onClick={()=>onClick(card)}
      style={{
        background:"#fff",borderRadius:9,marginBottom:8,cursor:"pointer",
        border:`0.5px solid ${col.border}`,borderTop:`2.5px solid ${col.text}`,
        padding:"13px 14px",userSelect:"none",transition:"box-shadow 0.15s",
        boxShadow: isSelected ? "0 0 0 2px rgba(24,95,165,0.25), 0 10px 24px rgba(0,0,0,0.10)" : undefined,
      }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 3px 12px rgba(0,0,0,0.1)"}
      onMouseLeave={e=>{ if (!isSelected) e.currentTarget.style.boxShadow="none"; }}
    >
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
        <Tag ckey={CAT_C[card.category]} small>{card.category}</Tag>
        <span style={{ fontSize:10,color:"#d3d1c7" }}>마감 {card.deadline}</span>
      </div>
      <div style={{ fontSize:13,fontWeight:800,color:"#2c2c2a",marginBottom:4,lineHeight:1.3 }}>{card.title}</div>
      <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:10 }}>
        {card.standards.map(s=>(
          <Tag key={s.code} ckey={s.type==="GRI"?"blue":s.type==="SASB"?"amber":"purple"} small>
            {s.code}
          </Tag>
        ))}
      </div>
      {isRejected && (
        <div style={{ fontSize:11,color:"#a32d2d",background:"#fcebeb",borderRadius:5,padding:"4px 8px",marginBottom:8,fontWeight:600 }}>
          반려 — 재작성 필요
        </div>
      )}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div style={{ display:"flex",alignItems:"center",gap:5 }}>
          <div style={{ width:18,height:18,borderRadius:"50%",background:"#e8f1fb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#185fa5" }}>
            {card.assignee[0]}
          </div>
          <span style={{ fontSize:11,color:"#b4b2a9" }}>{card.assignee}</span>
        </div>
        <div style={{ display:"flex",gap:5 }} onClick={e=>e.stopPropagation()}>
          {card.status==="todo" && <Btn variant="primary" small style={{background:"#185fa5"}} onClick={()=>onClick(card)}>작성 시작 →</Btn>}
          {card.status==="wip"  && <Btn variant="ghost"   small onClick={()=>onClick(card)}>이어 작성</Btn>}
          {card.status==="submitted" && <Btn variant="primary" small onClick={()=>onDraft(card)}>결재 상신 ↗</Btn>}
          {card.status==="approved" && <span style={{ fontSize:11,color:"#3b6d11",fontWeight:700 }}>완료</span>}
        </div>
      </div>
    </div>
  );
};

// ─── 계열사 뷰 ────────────────────────────────────────────────────────────────
const SubsidiaryView = ({ selectedDpId, selectedFeedbackId } = {}) => {
  const [tab, setTab] = useState("kanban");
  const [cards, setCards] = useState(DP_CARDS_INIT);
  const [approvals, setApprovals] = useState(APPROVALS_INIT);
  const [detailCard, setDetailCard] = useState(null);
  const [draftCard, setDraftCard] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [toast, setToast] = useState("");
  const [selectedApprovalId, setSelectedApprovalId] = useState(null);

  const pending = approvals.filter(a=>a.status==="pending").length;
  const rejected = approvals.filter(a=>a.status==="rejected").length;

  const saveCard = (id, text, newStatus) => {
    setCards(p=>p.map(c=>c.id===id?{...c,savedText:text,...(newStatus?{status:newStatus}:{})}:c));
    setToast(newStatus?"저장 · 상태 변경 완료":"임시저장 완료");
  };

  const submitDraft = ({title,body,card}) => {
    const doc = {
      id:`a${Date.now()}`,dpId:card.id,docNo:`ESG-2025-0${34+approvals.length}`,
      title,drafter:"박지훈 대리",draftedAt:"25.03.26 지금",status:"pending",
      body,attachments:[`${card.title}_data_2024.xlsx`],comments:[],rejReason:"",
    };
    setApprovals(p=>[doc,...p]);
    setCards(p=>p.map(c=>c.id===card.id?{...c,status:"approved"}:c));
    setDraftCard(null);
    setTab("approval");
    setToast("결재 상신 완료");
  };

  const stats = Object.fromEntries(COLS.map(c=>[c.key,cards.filter(x=>x.status===c.key).length]));

  useEffect(() => {
    if (!selectedDpId) return;
    const card = cards.find(c => c.id === selectedDpId);
    if (!card) return;
    setTab("kanban");
    setDetailCard({ ...card, savedText: cards.find(x=>x.id===card.id)?.savedText || "" });
    setTimeout(() => {
      const el = document.getElementById(`dp-card-${selectedDpId}`);
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 0);
  }, [selectedDpId, cards]);

  useEffect(() => {
    if (!selectedFeedbackId) return;
    const rejected = approvals.find(a => a.status === "rejected") || null;
    const byDp = selectedDpId ? approvals.find(a => a.dpId === selectedDpId) : null;
    const pick = byDp || rejected || approvals[0] || null;
    if (!pick) return;
    setSelectedApprovalId(pick.id);
    setTab("approval");
  }, [selectedFeedbackId, selectedDpId, approvals]);

  return (
    <>
      {toast && <Toast msg={toast} onDone={()=>setToast("")}/>}
      {detailCard && <DPDetailPage card={detailCard} onClose={()=>setDetailCard(null)} onSave={saveCard} onSubmitDraft={setDraftCard}/>}
      {draftCard && <DraftModal card={draftCard} onClose={()=>setDraftCard(null)} onSubmit={submitDraft}/>}

      {/* 탑바 */}
      <div style={{ background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,0.1)",padding:"0 24px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:15,fontWeight:800,color:"#2c2c2a" }}>SR 보고서 작성</span>
          <Tag ckey="amber">㈜ A에너지</Tag>
          <Tag ckey="blue">2024년도</Tag>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          {rejected>0 && <div onClick={()=>setTab("approval")} style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"5px 12px",borderRadius:7,background:"#fcebeb",border:"0.5px solid rgba(163,45,45,0.2)" }}>
            <span style={{ width:6,height:6,borderRadius:"50%",background:"#a32d2d",display:"inline-block" }}/>
            <span style={{ fontSize:12,color:"#a32d2d",fontWeight:700 }}>반려 {rejected}건 확인 필요</span>
          </div>}
          {pending>0 && <div onClick={()=>setTab("approval")} style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"5px 12px",borderRadius:7,background:"#faeeda",border:"0.5px solid rgba(133,79,11,0.2)" }}>
            <span style={{ fontSize:12,color:"#854f0b",fontWeight:700 }}>결재 대기 {pending}건</span>
          </div>}
        </div>
      </div>

      {/* 탭 */}
      <div style={{ background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,0.1)",padding:"0 24px",display:"flex",flexShrink:0 }}>
        {[{key:"kanban",label:"작성 현황"},{key:"approval",label:`결재함${pending+rejected>0?` (${pending+rejected})`:""}` }].map(t=>(
          <div key={t.key} onClick={()=>setTab(t.key)} style={{
            padding:"10px 18px",fontSize:13,cursor:"pointer",
            color:tab===t.key?"#0c447c":"#888780",fontWeight:tab===t.key?700:400,
            borderBottom:tab===t.key?"2px solid #0c447c":"2px solid transparent",
            marginBottom:"-0.5px",
          }}>{t.label}</div>
        ))}
      </div>

      <div style={{ flex:1,overflow:"hidden",display:"flex",flexDirection:"column" }}>
        {tab==="kanban" && (
          <div style={{ flex:1,overflowY:"auto",padding:"18px 20px" }}>
            {/* 요약 */}
            <div style={{ display:"flex",gap:8,marginBottom:18 }}>
              {COLS.map(col=>(
                <div key={col.key} style={{ flex:1,background:col.bg,border:`0.5px solid ${col.border}`,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <span style={{ fontSize:11,fontWeight:700,color:col.text }}>{col.label}</span>
                  <span style={{ fontSize:22,fontWeight:800,color:col.text }}>{stats[col.key]}</span>
                </div>
              ))}
            </div>

            {/* 칸반 */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10 }}>
              {COLS.map(col=>(
                <div key={col.key}
                  onDragOver={e=>{e.preventDefault();setDragOver(col.key);}}
                  onDrop={e=>{e.preventDefault();setCards(p=>p.map(c=>c.id===dragId?{...c,status:col.key}:c));setDragId(null);setDragOver(null);}}
                  onDragLeave={()=>setDragOver(null)}
                  style={{ minHeight:300,padding:4,borderRadius:10,border:dragOver===col.key?`1.5px dashed ${col.text}`:"1.5px dashed transparent",background:dragOver===col.key?col.bg:"transparent",transition:"all 0.12s" }}
                >
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 6px 10px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <span style={{ width:7,height:7,borderRadius:"50%",background:col.text,display:"inline-block" }}/>
                      <span style={{ fontSize:12,fontWeight:700,color:col.text }}>{col.label}</span>
                    </div>
                    <span style={{ fontSize:11,fontWeight:700,width:20,height:20,background:col.bg,color:col.text,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:`0.5px solid ${col.border}` }}>{stats[col.key]}</span>
                  </div>
                  {cards.filter(c=>c.status===col.key).map(card=>(
                    <KanbanCard key={card.id} card={card}
                      isSelected={selectedDpId === card.id}
                      onClick={c=>setDetailCard({...c,savedText:cards.find(x=>x.id===c.id)?.savedText||""})}
                      onDraft={setDraftCard}
                      onDragStart={(e,id)=>{setDragId(id);e.dataTransfer.effectAllowed="move";}}
                    />
                  ))}
                  {stats[col.key]===0 && <div style={{ textAlign:"center",padding:"28px 12px",color:"#d3d1c7",fontSize:12,border:"1.5px dashed #e8e6de",borderRadius:8 }}>항목 없음</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="approval" && (
          <div style={{ flex:1,overflow:"hidden",background:"#fff" }}>
            <ApprovalBox approvals={approvals} setApprovals={setApprovals} cards={cards} isHolding={false} selectedDocId={selectedApprovalId}/>
          </div>
        )}
      </div>
    </>
  );
};

// ─── 지주사 뷰 ────────────────────────────────────────────────────────────────
const HoldingView = () => {
  const [tab, setTab] = useState("matrix");
  const [approvals, setApprovals] = useState(APPROVALS_INIT);
  const [nudge, setNudge] = useState(null); // {sub, dp?}
  const [toast, setToast] = useState("");
  const [selDp, setSelDp] = useState(DP_META[0].code);

  const HOLDING_ENTITIES = [...SUBS_DATA, ...DOMESTIC_SITES_DATA];

  // 매트릭스 셀 상태 (sub x dp)
  const [cellSt, setCellSt] = useState(() => {
    const o = {};
    HOLDING_ENTITIES.forEach((s,si) => DP_META.forEach((d,di) => {
      const n = si*8+di;
      o[`${s.name}::${d.code}`] = n%13===4?"none":n%7===0?"rejected":n%5===0?"approved":n%3===0?"reviewing":"submitted";
    }));
    return o;
  });

  const stMap = {
    none:      { label:"미제출", ckey:"gray" },
    submitted: { label:"제출",   ckey:"blue" },
    reviewing: { label:"검토중", ckey:"amber" },
    approved:  { label:"승인",   ckey:"green" },
    rejected:  { label:"반려",   ckey:"red" },
  };

  const pending = approvals.filter(a=>a.status==="pending").length;

  const PAGES = [
    {range:"p.1–2",title:"CEO 메시지",status:"done"},
    {range:"p.3–5",title:"회사 개요",status:"done"},
    {range:"p.6–8",title:"ESG 전략",status:"done"},
    {range:"p.9–12",title:"환경 성과",status:"wip"},
    {range:"p.13–15",title:"사회 성과",status:"wip"},
    {range:"p.16–18",title:"지배구조",status:"todo"},
    {range:"p.19–20",title:"이해관계자",status:"done"},
    {range:"p.21–22",title:"GRI 인덱스",status:"todo"},
    {range:"p.23",title:"제3자 검증",status:"wip"},
    {range:"p.24",title:"보고 경계",status:"done"},
  ];
  const [pgSt, setPgSt] = useState(Object.fromEntries(PAGES.map(p=>[p.range,p.status])));
  const pgC = {done:C.green,wip:C.amber,todo:C.gray};

  return (
    <>
      {toast && <Toast msg={toast} onDone={()=>setToast("")}/>}
      {nudge && <NudgeModal sub={nudge.sub} dp={nudge.dp} onClose={()=>setNudge(null)} onSend={()=>setToast(`${nudge.sub.name}에게 독촉 알림 발송 완료`)}/>}

      <div style={{ background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,0.1)",padding:"0 24px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:15,fontWeight:800,color:"#2c2c2a" }}>SR 보고서 관리</span>
          <Tag ckey="navy">지주사</Tag>
          <Tag ckey="blue">2024년도</Tag>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <Btn variant="ghost">보고서 미리보기</Btn>
          <Btn variant="primary">최종 확정</Btn>
        </div>
      </div>

      <div style={{ background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,0.1)",padding:"0 24px",display:"flex",flexShrink:0 }}>
        {[
          {key:"matrix",  label:"국내 자회사/사업장 제출 현황"},
          {key:"pages",   label:"페이지 작성"},
          {key:"approval",label:`결재함${pending>0?` (${pending})`:""}` },
        ].map(t=>(
          <div key={t.key} onClick={()=>setTab(t.key)} style={{
            padding:"10px 18px",fontSize:13,cursor:"pointer",
            color:tab===t.key?"#0c447c":"#888780",fontWeight:tab===t.key?700:400,
            borderBottom:tab===t.key?"2px solid #0c447c":"2px solid transparent",
            marginBottom:"-0.5px",
          }}>{t.label}</div>
        ))}
      </div>

      <div style={{ flex:1,overflow:"auto",padding: tab==="approval"?"0":"18px 22px" }}>

        {/* ── 국내 자회사/사업장 제출 현황 매트릭스 ── */}
        {tab==="matrix" && (
          <>
            {/* 요약 카드 */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10,marginBottom:18 }}>
              {[
                {label:"전체 대상", value:HOLDING_ENTITIES.length},
                {label:"전체 제출률", value:`${Math.round(HOLDING_ENTITIES.reduce((a,s)=>a+s.submitted,0)/HOLDING_ENTITIES.reduce((a,s)=>a+s.total,0)*100)}%`, color:"#185fa5"},
                {label:"승인 완료",   value:HOLDING_ENTITIES.reduce((a,s)=>a+s.approved,0), color:"#3b6d11"},
                {label:"미제출 대상", value:HOLDING_ENTITIES.filter(s=>s.submitted===0).length, color:"#a32d2d"},
                {label:"반려 건수",   value:HOLDING_ENTITIES.reduce((a,s)=>a+s.rejected,0), color:"#a32d2d"},
              ].map((m,i)=>(
                <div key={i} style={{ background:"#f5f4f0",borderRadius:8,padding:"12px 14px" }}>
                  <div style={{ fontSize:11,color:"#b4b2a9",marginBottom:4 }}>{m.label}</div>
                  <div style={{ fontSize:22,fontWeight:800,color:m.color||"#2c2c2a" }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* 매트릭스 테이블 */}
            <div style={{ background:"#fff",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:10,overflow:"hidden",marginBottom:16 }}>
              <div style={{ padding:"13px 16px",borderBottom:"0.5px solid rgba(0,0,0,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ fontSize:13,fontWeight:800 }}>DP × 국내 자회사/사업장 제출 현황</span>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  {Object.entries(stMap).map(([k,v])=>(
                    <div key={k} style={{ display:"flex",alignItems:"center",gap:4 }}>
                      <div style={{ width:8,height:8,borderRadius:2,background:C[v.ckey].bg,border:`0.5px solid ${C[v.ckey].border}` }}/>
                      <span style={{ fontSize:10,color:"#888780" }}>{v.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                  <thead>
                    <tr style={{ background:"#f5f4f0" }}>
                      <th style={{ padding:"8px 14px",textAlign:"left",fontWeight:700,color:"#888780",whiteSpace:"nowrap",borderBottom:"0.5px solid rgba(0,0,0,0.08)",minWidth:110 }}>국내 대상</th>
                      {DP_META.map(d=>(
                        <th key={d.code} style={{ padding:"8px 10px",fontWeight:700,color:"#888780",borderBottom:"0.5px solid rgba(0,0,0,0.08)",whiteSpace:"nowrap",textAlign:"center",minWidth:80 }}>
                          <div style={{ fontSize:10 }}>{d.code}</div>
                          <div style={{ fontSize:9,color:"#b4b2a9",fontWeight:400 }}>{d.name}</div>
                        </th>
                      ))}
                      <th style={{ padding:"8px 10px",fontWeight:700,color:"#888780",borderBottom:"0.5px solid rgba(0,0,0,0.08)",textAlign:"center",minWidth:80 }}>진행률</th>
                      <th style={{ padding:"8px 10px",fontWeight:700,color:"#888780",borderBottom:"0.5px solid rgba(0,0,0,0.08)",textAlign:"center",minWidth:60 }}>액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HOLDING_ENTITIES.map((s,si)=>{
                      const pct = Math.round(s.submitted/s.total*100);
                      return (
                        <tr key={s.name}
                          onMouseEnter={e=>e.currentTarget.style.background="#fafaf8"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                        >
                          <td style={{ padding:"10px 14px",fontWeight:700,color:"#2c2c2a",borderBottom:"0.5px solid rgba(0,0,0,0.06)",whiteSpace:"nowrap" }}>
                            {s.name}
                          </td>
                          {DP_META.map(d=>{
                            const k=`${s.name}::${d.code}`;
                            const st=cellSt[k]||"none";
                            const cs=stMap[st];
                            return (
                              <td key={d.code} style={{ padding:"8px 10px",textAlign:"center",borderBottom:"0.5px solid rgba(0,0,0,0.06)" }}>
                                <div style={{
                                  display:"inline-flex",alignItems:"center",justifyContent:"center",
                                  width:54,height:22,borderRadius:4,
                                  background:C[cs.ckey].bg,border:`0.5px solid ${C[cs.ckey].border}`,
                                  fontSize:10,fontWeight:600,color:C[cs.ckey].text,
                                  cursor:st==="reviewing"?"pointer":"default",
                                }}
                                  onClick={()=>{ if(st==="reviewing") setCellSt(p=>({...p,[k]:"approved"})); }}
                                  title={st==="reviewing"?"클릭하여 승인":""}
                                >
                                  {cs.label}
                                </div>
                              </td>
                            );
                          })}
                          <td style={{ padding:"8px 14px",borderBottom:"0.5px solid rgba(0,0,0,0.06)",minWidth:100 }}>
                            <ProgBar val={pct} color={s.rejected>0?"#a32d2d":pct===100?"#3b6d11":"#185fa5"} thin/>
                          </td>
                          <td style={{ padding:"8px 10px",textAlign:"center",borderBottom:"0.5px solid rgba(0,0,0,0.06)" }}>
                            {s.submitted<s.total && (
                              <Btn variant="subtle" small onClick={()=>setNudge({sub:s})}>독촉</Btn>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 미제출 대상 알림 배너 */}
            {HOLDING_ENTITIES.filter(s=>s.submitted===0).length>0 && (
              <div style={{ padding:"12px 16px",borderRadius:8,background:"#fcebeb",border:"0.5px solid rgba(163,45,45,0.2)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ width:7,height:7,borderRadius:"50%",background:"#a32d2d",display:"inline-block" }}/>
                  <span style={{ fontSize:13,fontWeight:700,color:"#a32d2d" }}>
                    미제출 대상: {HOLDING_ENTITIES.filter(s=>s.submitted===0).map(s=>s.name).join(", ")}
                  </span>
                </div>
                <Btn variant="danger" small onClick={()=>HOLDING_ENTITIES.filter(s=>s.submitted===0).forEach(s=>setNudge({sub:s}))}>
                  전체 독촉 발송
                </Btn>
              </div>
            )}
          </>
        )}

        {/* ── 페이지별 작성 ── */}
        {tab==="pages" && (
          <>
            <div style={{ padding:"10px 14px",borderRadius:8,background:"#e8f1fb",border:"0.5px solid rgba(24,95,165,0.2)",marginBottom:14,display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:"#185fa5",display:"inline-block" }}/>
              <span style={{ fontSize:12,color:"#185fa5",fontWeight:700 }}>지주사 전용</span>
              <span style={{ fontSize:12,color:"#5f5e5a" }}>보고서 페이지 직접 작성 및 관리는 지주사만 접근할 수 있습니다.</span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:14 }}>
              {[{label:"전체",v:PAGES.length},{label:"완성",v:PAGES.filter(p=>pgSt[p.range]==="done").length,c:"#3b6d11"},{label:"작성중",v:PAGES.filter(p=>pgSt[p.range]==="wip").length,c:"#854f0b"},{label:"미작성",v:PAGES.filter(p=>pgSt[p.range]==="todo").length,c:"#a32d2d"}].map((m,i)=>(
                <div key={i} style={{ background:"#f5f4f0",borderRadius:8,padding:"12px 14px" }}>
                  <div style={{ fontSize:11,color:"#b4b2a9",marginBottom:4 }}>{m.label}</div>
                  <div style={{ fontSize:22,fontWeight:800,color:m.c||"#2c2c2a" }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div style={{ background:"#fff",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:10,padding:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                <span style={{ fontSize:13,fontWeight:800 }}>페이지 현황</span>
                <Btn variant="primary" small>+ 페이지 추가</Btn>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10 }}>
                {PAGES.map(p=>{
                  const st=pgSt[p.range];
                  const cs=pgC[st];
                  return (
                    <div key={p.range} style={{ border:`0.5px solid ${cs.border}`,borderRadius:8,padding:"11px 13px",cursor:"pointer",background:cs.bg,transition:"all 0.12s" }}>
                      <div style={{ fontSize:10,fontWeight:700,color:cs.text,marginBottom:3 }}>{p.range}</div>
                      <div style={{ fontSize:12,fontWeight:800,color:"#2c2c2a",marginBottom:8,lineHeight:1.4 }}>{p.title}</div>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                        <span style={{ fontSize:11,fontWeight:600,color:cs.text }}>{st==="done"?"완성":st==="wip"?"작성중":"미작성"}</span>
                        {st!=="done" && <button onClick={()=>setPgSt(s=>({...s,[p.range]:"done"}))} style={{ fontSize:10,padding:"2px 7px",borderRadius:4,border:"0.5px solid rgba(0,0,0,0.15)",background:"#fff",cursor:"pointer",color:"#5f5e5a" }}>완료</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── 결재함 ── */}
        {tab==="approval" && (
          <div style={{ background:"#fff",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:10,overflow:"hidden",height:"calc(100vh - 230px)",minHeight:400,margin:"18px 22px" }}>
            <div style={{ padding:"13px 18px",borderBottom:"0.5px solid rgba(0,0,0,0.1)",display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ fontSize:13,fontWeight:800 }}>계열사 결재 처리</span>
              <span style={{ fontSize:12,color:"#b4b2a9" }}>계열사가 상신한 문서를 검토·승인합니다</span>
            </div>
            <div style={{ height:"calc(100% - 48px)" }}>
              <ApprovalBox approvals={approvals} setApprovals={setApprovals} cards={DP_CARDS_INIT} isHolding={true}/>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ─── 루트 ────────────────────────────────────────────────────────────────────
export default function SRReportDashboard() {
  const [role, setRole] = useState("subsidiary");
  const navs = {
    subsidiary:["작성 현황","결재함"],
    holding:["계열사 제출 현황","페이지 작성","결재함"],
  };
  return (
    <div style={{ display:"flex",height:"100vh",minHeight:640,background:"#f5f4f0",fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      <aside style={{ width:188,minWidth:188,background:"#fff",borderRight:"0.5px solid rgba(0,0,0,0.1)",display:"flex",flexDirection:"column" }}>
        <div style={{ padding:"18px 14px 14px",borderBottom:"0.5px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize:14,fontWeight:800,color:"#0c447c",letterSpacing:"-0.3px" }}>ESG Hub</div>
          <div style={{ fontSize:9,color:"#b4b2a9",marginTop:1,letterSpacing:"0.04em" }}>지속가능경영 포털</div>
          <div style={{ marginTop:10,display:"flex",borderRadius:7,border:"0.5px solid rgba(0,0,0,0.12)",overflow:"hidden" }}>
            {[{r:"subsidiary",l:"계열사"},{r:"holding",l:"지주사"}].map(({r,l})=>(
              <button key={r} onClick={()=>setRole(r)} style={{
                flex:1,fontSize:11,padding:"6px 4px",border:"none",cursor:"pointer",
                fontWeight:role===r?800:400,
                background:role===r?(r==="holding"?"#0c447c":"#185fa5"):"#fff",
                color:role===r?"#fff":"#888780",transition:"all 0.15s",
              }}>{l}</button>
            ))}
          </div>
        </div>
        <nav style={{ padding:"10px 8px",flex:1 }}>
          <div style={{ fontSize:9,color:"#d3d1c7",padding:"4px 8px 6px",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" }}>메뉴</div>
          {navs[role].map(n=>(
            <div key={n} style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:6,cursor:"pointer",color:"#5f5e5a",fontSize:13,marginBottom:1 }}
              onMouseEnter={e=>e.currentTarget.style.background="#f5f4f0"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            >
              <span style={{ width:4,height:4,borderRadius:"50%",background:"#d3d1c7",display:"inline-block" }}/>
              {n}
            </div>
          ))}
        </nav>
        <div style={{ padding:"12px 14px",borderTop:"0.5px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize:9,color:"#d3d1c7",textTransform:"uppercase",letterSpacing:"0.06em" }}>{role==="holding"?"지주사 관리자":"계열사 담당자"}</div>
          <div style={{ fontSize:12,fontWeight:800,color:"#2c2c2a",marginTop:2 }}>{role==="holding"?"김지속 팀장":"박지훈 대리"}</div>
          <div style={{ fontSize:10,color:"#b4b2a9",marginTop:1 }}>{role==="holding"?"ESG전략팀":"㈜ A에너지"}</div>
        </div>
      </aside>
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
        {role==="subsidiary"?<SubsidiaryView/>:<HoldingView/>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 앱에서 모드별로 직접 렌더링할 수 있도록 named export 제공
export const SRReportDashboardV3Subsidiary = ({ selectedDpId, selectedFeedbackId } = {}) => (
  <SubsidiaryView selectedDpId={selectedDpId} selectedFeedbackId={selectedFeedbackId} />
);
export const SRReportDashboardV3Holding = () => <HoldingView />;
