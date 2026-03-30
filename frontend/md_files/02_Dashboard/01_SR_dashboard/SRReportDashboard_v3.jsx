'use client';

import { useEffect, useMemo, useState } from "react";
import { HOLDING_SR_PAGE_DATA } from "../../../src/app/(main)/sr-report/lib/holdingPageData";

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
  { code:"GRI 302-1", name:"에너지 소비량",    group:"E" },
  { code:"GRI 305-1", name:"온실가스 배출",    group:"E" },
  { code:"GRI 303-3", name:"취수 및 방류",     group:"E" },
  { code:"GRI 401-1", name:"신규 채용·이직",   group:"S" },
  { code:"GRI 405-1", name:"이사회 다양성",    group:"G" },
  { code:"TCFD S-2",  name:"기후 리스크",      group:"E" },
  { code:"GRI 414-1", name:"공급망 인권실사",  group:"S" },
  { code:"GRI 403-9", name:"산업안전·보건",    group:"S" },
];

const mockHoldingPageStatus = (page) => {
  const h = (page * 13 + 17) % 7;
  if (h <= 2) return "done";
  if (h <= 4) return "wip";
  return "todo";
};

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

// SR 대시보드: 계열사 DP 본문 작성·구버전 결재함 UI는 제거 → /sr-report 및 통합 결재함
// (SR_DASHBOARD_APPROVAL_AND_REPORT_UNIFICATION_STRATEGY.md, SR_HOLDING_DASHBOARD_AND_REPORT_TAB_LINKAGE_STRATEGY.md)

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
const SubsidiaryView = ({ selectedDpId, selectedFeedbackId, onNavigateToApproval = () => {}, onNavigateToSrReport = () => {} } = {}) => {
  const [cards, setCards] = useState(DP_CARDS_INIT);
  const [approvals, setApprovals] = useState(APPROVALS_INIT);
  const [draftCard, setDraftCard] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [toast, setToast] = useState("");

  const pending = approvals.filter(a=>a.status==="pending").length;
  const rejected = approvals.filter(a=>a.status==="rejected").length;

  const submitDraft = ({title,body,card}) => {
    const doc = {
      id:`a${Date.now()}`,dpId:card.id,docNo:`ESG-2025-0${34+approvals.length}`,
      title,drafter:"박지훈 대리",draftedAt:"25.03.26 지금",status:"pending",
      body,attachments:[`${card.title}_data_2024.xlsx`],comments:[],rejReason:"",
    };
    setApprovals(p=>[doc,...p]);
    setCards(p=>p.map(c=>c.id===card.id?{...c,status:"submitted"}:c));
    setDraftCard(null);
    onNavigateToApproval({ menu: "inbox.request", dpId: card.id, docId: doc.id });
    setToast("결재 상신되었습니다. 좌측 메뉴「결재함」에서 확인하세요.");
  };

  const stats = Object.fromEntries(COLS.map(c=>[c.key,cards.filter(x=>x.status===c.key).length]));

  useEffect(() => {
    if (!selectedDpId) return;
    const card = cards.find(c => c.id === selectedDpId);
    if (!card) return;
    setTimeout(() => {
      const el = document.getElementById(`dp-card-${selectedDpId}`);
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 0);
  }, [selectedDpId, cards]);

  useEffect(() => {
    if (!selectedFeedbackId) return;
    const rejectedA = approvals.find(a => a.status === "rejected") || null;
    const byDp = selectedDpId ? approvals.find(a => a.dpId === selectedDpId) : null;
    const pick = byDp || rejectedA || approvals[0] || null;
    if (!pick) return;
    onNavigateToApproval({ menu: "inbox.request", docId: pick.id, dpId: pick.dpId });
  }, [selectedFeedbackId, selectedDpId, approvals, onNavigateToApproval]);

  const openSr = (c) => { onNavigateToSrReport(c.id); };

  return (
    <>
      {toast && <Toast msg={toast} onDone={()=>setToast("")}/>}
      {draftCard && <DraftModal card={draftCard} onClose={()=>setDraftCard(null)} onSubmit={submitDraft}/>}

      <div style={{ background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,0.1)",padding:"0 24px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:15,fontWeight:800,color:"#2c2c2a" }}>SR 보고서 작성</span>
          <Tag ckey="amber">㈜ A에너지</Tag>
          <Tag ckey="blue">2024년도</Tag>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          {rejected>0 && <div onClick={()=>onNavigateToApproval({ menu: "inbox.request" })} style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"5px 12px",borderRadius:7,background:"#fcebeb",border:"0.5px solid rgba(163,45,45,0.2)" }}>
            <span style={{ width:6,height:6,borderRadius:"50%",background:"#a32d2d",display:"inline-block" }}/>
            <span style={{ fontSize:12,color:"#a32d2d",fontWeight:700 }}>반려 {rejected}건 확인 필요</span>
          </div>}
          {pending>0 && <div onClick={()=>onNavigateToApproval({ menu: "inbox.request" })} style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"5px 12px",borderRadius:7,background:"#faeeda",border:"0.5px solid rgba(133,79,11,0.2)" }}>
            <span style={{ fontSize:12,color:"#854f0b",fontWeight:700 }}>결재 대기 {pending}건</span>
          </div>}
        </div>
      </div>

      <div style={{ background:"#e8f4fc",borderBottom:"0.5px solid rgba(24,95,165,0.2)",padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,gap:12,flexWrap:"wrap" }}>
        <span style={{ fontSize:12,color:"#185fa5",lineHeight:1.5 }}>
          결재·승인 요청은 <b>좌측 사이드바「결재함」</b>에서 통합 처리합니다. DP 본문 작성은 <b>SR 보고서</b> 메뉴로 이동하세요.
        </span>
        <Btn variant="primary" small onClick={()=>onNavigateToApproval({ menu: "inbox.request" })}>결재함으로 이동 →</Btn>
      </div>

      <div style={{ background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,0.1)",padding:"0 24px",display:"flex",flexShrink:0 }}>
        <div style={{ padding:"10px 18px",fontSize:13,color:"#0c447c",fontWeight:700,borderBottom:"2px solid #0c447c",marginBottom:"-0.5px" }}>작성 현황</div>
      </div>

      <div style={{ flex:1,overflow:"hidden",display:"flex",flexDirection:"column" }}>
        <div style={{ flex:1,overflowY:"auto",padding:"18px 20px" }}>
          <div style={{ display:"flex",gap:8,marginBottom:18 }}>
            {COLS.map(col=>(
              <div key={col.key} style={{ flex:1,background:col.bg,border:`0.5px solid ${col.border}`,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                <span style={{ fontSize:11,fontWeight:700,color:col.text }}>{col.label}</span>
                <span style={{ fontSize:22,fontWeight:800,color:col.text }}>{stats[col.key]}</span>
              </div>
            ))}
          </div>

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
                    onClick={openSr}
                    onDraft={setDraftCard}
                    onDragStart={(e,id)=>{setDragId(id);e.dataTransfer.effectAllowed="move";}}
                  />
                ))}
                {stats[col.key]===0 && <div style={{ textAlign:"center",padding:"28px 12px",color:"#d3d1c7",fontSize:12,border:"1.5px dashed #e8e6de",borderRadius:8 }}>항목 없음</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── 지주사 뷰 ────────────────────────────────────────────────────────────────
const HoldingView = ({ onNavigateToApproval = () => {}, onNavigateToSrReportHolding = () => {} } = {}) => {
  const [tab, setTab] = useState("matrix");
  const [approvals] = useState(APPROVALS_INIT);
  const [nudge, setNudge] = useState(null); // {sub, dp?}
  const [toast, setToast] = useState("");
  const [matrixDpFilter, setMatrixDpFilter] = useState("all");
  const [matrixDpGroup, setMatrixDpGroup] = useState("all");
  const [matrixRowSearch, setMatrixRowSearch] = useState("");
  const [matrixViewMode, setMatrixViewMode] = useState("grid");
  const [pivotEntityName, setPivotEntityName] = useState("");
  const [pivotDpCode, setPivotDpCode] = useState("");
  const [cellDrawer, setCellDrawer] = useState(null);
  const [pageListSearch, setPageListSearch] = useState("");
  const [pageSectionOpen, setPageSectionOpen] = useState({});

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
  const rejectedCt = approvals.filter(a=>a.status==="rejected").length;
  const visibleDpMeta = useMemo(() => {
    let list = DP_META;
    if (matrixDpGroup !== "all") list = list.filter((d) => d.group === matrixDpGroup);
    if (matrixDpFilter !== "all") list = list.filter((d) => d.code === matrixDpFilter);
    return list;
  }, [matrixDpFilter, matrixDpGroup]);
  const visibleEntities = useMemo(() => {
    const q = matrixRowSearch.trim().toLowerCase();
    const all = [...SUBS_DATA, ...DOMESTIC_SITES_DATA];
    if (!q) return all;
    return all.filter((s) => s.name.toLowerCase().includes(q));
  }, [matrixRowSearch]);

  const pageOutlineStats = useMemo(() => {
    const rows = HOLDING_SR_PAGE_DATA;
    let done = 0, wip = 0, todo = 0;
    rows.forEach((r) => {
      const st = mockHoldingPageStatus(r.page);
      if (st === "done") done++;
      else if (st === "wip") wip++;
      else todo++;
    });
    return { total: rows.length, done, wip, todo };
  }, []);

  const pageSections = useMemo(() => {
    const m = {};
    HOLDING_SR_PAGE_DATA.forEach((r) => {
      if (!m[r.section]) m[r.section] = [];
      m[r.section].push(r);
    });
    return m;
  }, []);

  const entityIdFromRowName = (name) => {
    const ENTITY_SLUG = {
      "미라콤":"ent-miracom","시큐아이":"ent-secui","에스코어":"ent-score","멀티캠퍼스":"ent-multicampus","엠로":"ent-mro","오픈핸즈":"ent-openhands",
      "판교 IT 캠퍼스":"ent-pangyo-it","판교 물류 캠퍼스":"ent-pangyo-log","서울 R&D 캠퍼스":"ent-seoul-rnd","상암 데이터센터":"ent-sangam-dc",
      "수원 데이터센터":"ent-suwon-dc","춘천 데이터센터":"ent-chuncheon-dc","동탄 데이터센터":"ent-dongtan-dc","구미 데이터센터":"ent-gumi-dc",
    };
    return ENTITY_SLUG[name] || `ent-${String(name).replace(/\s+/g,"-").slice(0,40)}`;
  };
  const dpCodeToSubsidiaryDpId = (code) => {
    const card = DP_CARDS_INIT.find(c => c.standards.some(s => s.code === code));
    return card ? card.id : null;
  };

  const getCellDetailMock = (dpCode) => {
    const dpId = dpCodeToSubsidiaryDpId(dpCode);
    const card = dpId ? DP_CARDS_INIT.find((c) => c.id === dpId) : null;
    const approval = dpId ? APPROVALS_INIT.find((a) => a.dpId === dpId) : null;
    const bodyText = approval?.body || card?.savedText || "";
    const snippet = bodyText.length > 520 ? `${bodyText.slice(0, 520)}…` : bodyText;
    return { snippet, approval, card, dpId, attachments: approval?.attachments || [] };
  };

  const openCellDrawer = (s, d, st, k) => {
    setCellDrawer({ s, d, st, k });
  };

  const runCellPrimaryAction = () => {
    if (!cellDrawer) return;
    const { s, d, st } = cellDrawer;
    const entityId = entityIdFromRowName(s.name);
    const dpCode = d.code;
    setCellDrawer(null);
    if (st === "rejected" || st === "submitted" || st === "reviewing") {
      const dpId = dpCodeToSubsidiaryDpId(dpCode);
      const doc = dpId ? APPROVALS_INIT.find((a) => a.dpId === dpId) : null;
      if (dpId) onNavigateToApproval({ menu: "inbox.request", dpId, docId: doc?.id });
      else onNavigateToApproval({ menu: "inbox.request" });
      setToast("통합 결재함에서 본문·승인/반려를 처리합니다.");
      return;
    }
    if (st === "none") {
      setNudge({ sub: s, dp: d });
      setToast("독촉 발송 창을 열었습니다.");
      return;
    }
    onNavigateToSrReportHolding({
      holdingTab: "h-aggregate-write",
      entityId,
      dpCode,
      source: "dashboard-matrix",
      fiscalYear: "2024",
    });
    setToast("공시데이터 취합(SR 보고서)으로 이동합니다.");
  };

  const pgC = { done: C.green, wip: C.amber, todo: C.gray };

  return (
    <>
      {toast && <Toast msg={toast} onDone={()=>setToast("")}/>}
      {nudge && <NudgeModal sub={nudge.sub} dp={nudge.dp} onClose={()=>setNudge(null)} onSend={()=>setToast(`${nudge.sub.name}에게 독촉 알림 발송 완료`)}/>}
      {cellDrawer && (() => {
        const { s, d, st } = cellDrawer;
        const det = getCellDetailMock(d.code);
        const stLabel = stMap[st].label;
        const primaryLabel = st === "none" ? "독촉 보내기" : (st === "approved" ? "공시데이터 취합으로" : "통합 결재함에서 처리");
        return (
          <Modal width={640} onClose={()=>setCellDrawer(null)}>
            <ModalHeader title={`${s.name} · ${d.code}`} sub={`상태: ${stLabel} · ${d.name}`} onClose={()=>setCellDrawer(null)}/>
            <div style={{ padding:"18px 24px 24px" }}>
              <SLabel>제출 본문 미리보기 (읽기 전용)</SLabel>
              <div style={{ fontSize:12,color:"#5f5e5a",lineHeight:1.75,whiteSpace:"pre-wrap",background:"#fafaf8",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:8,padding:"12px 14px",minHeight:100,maxHeight:220,overflowY:"auto",marginBottom:12 }}>
                {st === "none" ? "아직 제출된 본문이 없습니다. 미제출 대상에게 독촉을 보내거나 계열사 작성 화면으로 안내하세요." : (det.snippet || "연결된 본문이 없습니다.")}
              </div>
              {det.attachments.length > 0 && (
                <>
                  <SLabel>첨부 (메타)</SLabel>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:14 }}>
                    {det.attachments.map((f) => <Tag key={f} ckey="blue" small>{f}</Tag>)}
                  </div>
                </>
              )}
              {st === "rejected" && det.approval?.rejReason && (
                <div style={{ padding:"10px 12px",borderRadius:8,background:"#fcebeb",marginBottom:14,fontSize:12,color:"#791f1f" }}>
                  <b>반려 사유:</b> {det.approval.rejReason}
                </div>
              )}
              <div style={{ display:"flex",justifyContent:"flex-end",gap:8,flexWrap:"wrap" }}>
                <Btn variant="ghost" onClick={()=>setCellDrawer(null)}>닫기</Btn>
                <Btn variant="primary" onClick={runCellPrimaryAction}>{primaryLabel} →</Btn>
              </div>
              <div style={{ fontSize:10,color:"#b4b2a9",marginTop:12,lineHeight:1.5 }}>
                승인·반려의 최종 기록은 통합 결재함과 동기화됩니다. 전문 검토는 결재함에서 진행하세요.
              </div>
            </div>
          </Modal>
        );
      })()}

      <div style={{ background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,0.1)",padding:"0 24px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:15,fontWeight:800,color:"#2c2c2a" }}>SR 보고서 관리</span>
          <Tag ckey="navy">지주사</Tag>
          <Tag ckey="blue">2024년도</Tag>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          {rejectedCt>0 && <div onClick={()=>onNavigateToApproval({ menu: "inbox.request" })} style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"5px 12px",borderRadius:7,background:"#fcebeb",border:"0.5px solid rgba(163,45,45,0.2)" }}>
            <span style={{ fontSize:12,color:"#a32d2d",fontWeight:700 }}>반려 {rejectedCt}건</span>
          </div>}
          {pending>0 && <div onClick={()=>onNavigateToApproval({ menu: "inbox.request" })} style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"5px 12px",borderRadius:7,background:"#faeeda",border:"0.5px solid rgba(133,79,11,0.2)" }}>
            <span style={{ fontSize:12,color:"#854f0b",fontWeight:700 }}>결재 대기 {pending}건</span>
          </div>}
          <Btn variant="ghost">보고서 미리보기</Btn>
          <Btn variant="primary">최종 확정</Btn>
        </div>
      </div>

      <div style={{ background:"#e8f4fc",borderBottom:"0.5px solid rgba(24,95,165,0.2)",padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,gap:12,flexWrap:"wrap" }}>
        <span style={{ fontSize:12,color:"#185fa5",lineHeight:1.5 }}>
          계열사 결재·승인은 <b>좌측「결재함」</b>에서 통합 처리합니다. 지주 보고서 본문 작성은 <b>SR 보고서(지주 모드)</b>로 이동하세요.
        </span>
        <Btn variant="primary" small onClick={()=>onNavigateToApproval({ menu: "inbox.request" })}>결재함으로 이동 →</Btn>
      </div>

      <div style={{ background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,0.1)",padding:"0 24px",display:"flex",flexShrink:0 }}>
        {[
          {key:"matrix",  label:"국내 자회사/사업장 제출 현황"},
          {key:"pages",   label:"페이지 작성"},
        ].map(t=>(
          <div key={t.key} onClick={()=>setTab(t.key)} style={{
            padding:"10px 18px",fontSize:13,cursor:"pointer",
            color:tab===t.key?"#0c447c":"#888780",fontWeight:tab===t.key?700:400,
            borderBottom:tab===t.key?"2px solid #0c447c":"2px solid transparent",
            marginBottom:"-0.5px",
          }}>{t.label}</div>
        ))}
      </div>

      <div style={{ flex:1,overflow:"auto",padding:"18px 22px" }}>

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

            <div style={{ marginBottom:14,padding:"12px 14px",background:"#fafaf8",borderRadius:10,border:"0.5px solid rgba(0,0,0,0.08)",display:"flex",flexWrap:"wrap",gap:10,alignItems:"center" }}>
              <span style={{ fontSize:11,fontWeight:700,color:"#888780" }}>뷰</span>
              {[{k:"grid",l:"매트릭스"},{k:"entityPivot",l:"조직별"},{k:"dpPivot",l:"DP별"}].map(({k,l})=>(
                <Btn key={k} variant={matrixViewMode===k?"primary":"subtle"} small onClick={()=>setMatrixViewMode(k)}>{l}</Btn>
              ))}
              <span style={{ width:1,height:20,background:"#e8e6de" }}/>
              <input type="search" placeholder="조직명 검색…" value={matrixRowSearch} onChange={e=>setMatrixRowSearch(e.target.value)} style={{ fontSize:12,padding:"6px 10px",borderRadius:6,border:"0.5px solid rgba(0,0,0,0.15)",minWidth:160 }} />
              <label style={{ fontSize:11,color:"#5f5e5a",display:"flex",alignItems:"center",gap:6 }}>
                DP 그룹
                <select value={matrixDpGroup} onChange={e=>setMatrixDpGroup(e.target.value)} style={{ fontSize:11,padding:"4px 8px",borderRadius:6 }}>
                  <option value="all">전체</option>
                  <option value="E">환경(E)</option>
                  <option value="S">사회(S)</option>
                  <option value="G">지배(G)</option>
                </select>
              </label>
              <span style={{ fontSize:10,color:"#b4b2a9" }}>DP 열이 많을수록 피벗·그룹 필터·셀 클릭 상세를 활용하세요.</span>
            </div>

            {/* 매트릭스 테이블 */}
            {matrixViewMode==="grid" && (
            <div style={{ background:"#fff",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:10,overflow:"hidden",marginBottom:16 }}>
              <div style={{ padding:"13px 16px",borderBottom:"0.5px solid rgba(0,0,0,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10 }}>
                <span style={{ fontSize:13,fontWeight:800 }}>DP × 국내 자회사/사업장 제출 현황</span>
                <div style={{ display:"flex",gap:12,alignItems:"center",flexWrap:"wrap" }}>
                  <label style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#5f5e5a" }}>
                    <span>DP 필터</span>
                    <select value={matrixDpFilter} onChange={e=>setMatrixDpFilter(e.target.value)} style={{ fontSize:11,padding:"4px 8px",borderRadius:6,border:"0.5px solid rgba(0,0,0,0.15)",background:"#fff" }}>
                      <option value="all">전체 DP</option>
                      {DP_META.map(d=>(<option key={d.code} value={d.code}>{d.code} · {d.name}</option>))}
                    </select>
                  </label>
                  {Object.entries(stMap).map(([k,v])=>(
                    <div key={k} style={{ display:"flex",alignItems:"center",gap:4 }}>
                      <div style={{ width:8,height:8,borderRadius:2,background:C[v.ckey].bg,border:`0.5px solid ${C[v.ckey].border}` }}/>
                      <span style={{ fontSize:10,color:"#888780" }}>{v.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ overflow:"auto",maxHeight:"min(62vh, 520px)" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                  <thead>
                    <tr style={{ background:"#f5f4f0",position:"sticky",top:0,zIndex:2,boxShadow:"0 1px 0 rgba(0,0,0,0.06)" }}>
                      <th style={{ padding:"8px 14px",textAlign:"left",fontWeight:700,color:"#888780",whiteSpace:"nowrap",borderBottom:"0.5px solid rgba(0,0,0,0.08)",minWidth:110,background:"#f5f4f0" }}>국내 대상</th>
                      {visibleDpMeta.map(d=>(
                        <th key={d.code} style={{ padding:"8px 10px",fontWeight:700,color:"#888780",borderBottom:"0.5px solid rgba(0,0,0,0.08)",whiteSpace:"nowrap",textAlign:"center",minWidth:80,background:"#f5f4f0" }}>
                          <div style={{ fontSize:10 }}>{d.code}</div>
                          <div style={{ fontSize:9,color:"#b4b2a9",fontWeight:400 }}>{d.name}</div>
                        </th>
                      ))}
                      <th style={{ padding:"8px 10px",fontWeight:700,color:"#888780",borderBottom:"0.5px solid rgba(0,0,0,0.08)",textAlign:"center",minWidth:80,background:"#f5f4f0" }}>진행률</th>
                      <th style={{ padding:"8px 10px",fontWeight:700,color:"#888780",borderBottom:"0.5px solid rgba(0,0,0,0.08)",textAlign:"center",minWidth:60,background:"#f5f4f0" }}>액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntities.map((s,si)=>{
                      const pct = Math.round(s.submitted/s.total*100);
                      return (
                        <tr key={s.name}
                          onMouseEnter={e=>e.currentTarget.style.background="#fafaf8"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                        >
                          <td style={{ padding:"10px 14px",fontWeight:700,color:"#2c2c2a",borderBottom:"0.5px solid rgba(0,0,0,0.06)",whiteSpace:"nowrap" }}>
                            {s.name}
                          </td>
                          {visibleDpMeta.map(d=>{
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
                                  cursor:"pointer",
                                }}
                                  onClick={()=>openCellDrawer(s, d, st, k)}
                                  title="클릭: 제출 본문 미리보기 · 독촉 · 결재"
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
            )}

            {matrixViewMode==="entityPivot" && (
              <div style={{ background:"#fff",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:10,padding:16,marginBottom:16 }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12 }}>
                  <span style={{ fontSize:13,fontWeight:800 }}>조직별 DP 목록</span>
                  <select value={pivotEntityName} onChange={e=>setPivotEntityName(e.target.value)} style={{ fontSize:12,padding:"6px 10px",borderRadius:6,minWidth:220 }}>
                    <option value="">조직 선택…</option>
                    {HOLDING_ENTITIES.map(s=>(<option key={s.name} value={s.name}>{s.name}</option>))}
                  </select>
                </div>
                {pivotEntityName && (() => {
                  const s = HOLDING_ENTITIES.find((x)=>x.name===pivotEntityName);
                  if (!s) return null;
                  const pct = Math.round(s.submitted/s.total*100);
                  return (
                    <div style={{ overflow:"auto",maxHeight:420 }}>
                      <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                        <thead>
                          <tr style={{ background:"#f5f4f0" }}>
                            <th style={{ padding:8,textAlign:"left" }}>DP</th>
                            <th style={{ padding:8,textAlign:"center" }}>상태</th>
                            <th style={{ padding:8,textAlign:"center" }}>상세</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleDpMeta.map((d)=>{
                            const k=`${s.name}::${d.code}`;
                            const st=cellSt[k]||"none";
                            const cs=stMap[st];
                            return (
                              <tr key={d.code}>
                                <td style={{ padding:8,borderBottom:"0.5px solid rgba(0,0,0,0.06)" }}><b>{d.code}</b> · {d.name}</td>
                                <td style={{ padding:8,textAlign:"center",borderBottom:"0.5px solid rgba(0,0,0,0.06)" }}>
                                  <span style={{ padding:"3px 8px",borderRadius:4,background:C[cs.ckey].bg,color:C[cs.ckey].text,fontSize:10,fontWeight:600 }}>{cs.label}</span>
                                </td>
                                <td style={{ padding:8,textAlign:"center",borderBottom:"0.5px solid rgba(0,0,0,0.06)" }}>
                                  <Btn variant="subtle" small onClick={()=>openCellDrawer(s,d,st,k)}>열기</Btn>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div style={{ marginTop:8,fontSize:11,color:"#888780" }}>행 진행률 {pct}% (요약)</div>
                    </div>
                  );
                })()}
              </div>
            )}

            {matrixViewMode==="dpPivot" && (
              <div style={{ background:"#fff",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:10,padding:16,marginBottom:16 }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12 }}>
                  <span style={{ fontSize:13,fontWeight:800 }}>DP별 조직 목록</span>
                  <select value={pivotDpCode} onChange={e=>setPivotDpCode(e.target.value)} style={{ fontSize:12,padding:"6px 10px",borderRadius:6,minWidth:260 }}>
                    <option value="">DP 선택…</option>
                    {visibleDpMeta.map((d)=>(<option key={d.code} value={d.code}>{d.code} · {d.name}</option>))}
                  </select>
                </div>
                {pivotDpCode && (() => {
                  const d = DP_META.find((x)=>x.code===pivotDpCode);
                  if (!d) return null;
                  return (
                    <div style={{ overflow:"auto",maxHeight:420 }}>
                      <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                        <thead>
                          <tr style={{ background:"#f5f4f0" }}>
                            <th style={{ padding:8,textAlign:"left" }}>국내 대상</th>
                            <th style={{ padding:8,textAlign:"center" }}>상태</th>
                            <th style={{ padding:8,textAlign:"center" }}>상세</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleEntities.map((s)=>{
                            const k=`${s.name}::${d.code}`;
                            const st=cellSt[k]||"none";
                            const cs=stMap[st];
                            return (
                              <tr key={s.name}>
                                <td style={{ padding:8,borderBottom:"0.5px solid rgba(0,0,0,0.06)",fontWeight:700 }}>{s.name}</td>
                                <td style={{ padding:8,textAlign:"center",borderBottom:"0.5px solid rgba(0,0,0,0.06)" }}>
                                  <span style={{ padding:"3px 8px",borderRadius:4,background:C[cs.ckey].bg,color:C[cs.ckey].text,fontSize:10,fontWeight:600 }}>{cs.label}</span>
                                </td>
                                <td style={{ padding:8,textAlign:"center",borderBottom:"0.5px solid rgba(0,0,0,0.06)" }}>
                                  <Btn variant="subtle" small onClick={()=>openCellDrawer(s,d,st,k)}>열기</Btn>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

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

        {/* ── 페이지별 작성 (h-write 목차와 동일 소스: HOLDING_SR_PAGE_DATA) ── */}
        {tab==="pages" && (
          <>
            <div style={{ padding:"10px 14px",borderRadius:8,background:"#e8f1fb",border:"0.5px solid rgba(24,95,165,0.2)",marginBottom:14,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:"#185fa5",display:"inline-block" }}/>
              <span style={{ fontSize:12,color:"#185fa5",fontWeight:700 }}>지주 SR 페이지별 작성과 동일 목차</span>
              <span style={{ fontSize:12,color:"#5f5e5a" }}>아래 표는 `holdingPageData` 기준 페이지 목록입니다. 상태는 데모용 해시입니다(실서비스는 API 동기화).</span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:14 }}>
              {[
                {label:"전체",v:pageOutlineStats.total},
                {label:"완료",v:pageOutlineStats.done,c:"#3b6d11"},
                {label:"작성중",v:pageOutlineStats.wip,c:"#854f0b"},
                {label:"미작성",v:pageOutlineStats.todo,c:"#a32d2d"},
              ].map((m,i)=>(
                <div key={i} style={{ background:"#f5f4f0",borderRadius:8,padding:"12px 14px" }}>
                  <div style={{ fontSize:11,color:"#b4b2a9",marginBottom:4 }}>{m.label}</div>
                  <div style={{ fontSize:22,fontWeight:800,color:m.c||"#2c2c2a" }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex",gap:10,marginBottom:12,flexWrap:"wrap",alignItems:"center" }}>
              <input type="search" placeholder="제목·섹션 검색…" value={pageListSearch} onChange={e=>setPageListSearch(e.target.value)} style={{ fontSize:12,padding:"8px 12px",borderRadius:8,border:"0.5px solid rgba(0,0,0,0.15)",minWidth:220,flex:1,maxWidth:360 }} />
              <Btn variant="primary" small onClick={()=>onNavigateToSrReportHolding({ holdingTab: "h-write", source: "dashboard-pages", fiscalYear: "2024" })}>SR 보고서에서 편집 →</Btn>
            </div>
            <div style={{ background:"#fff",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:10,padding:12,maxHeight:"min(70vh, 640px)",overflowY:"auto" }}>
              {Object.entries(pageSections).map(([section, rows]) => {
                const q = pageListSearch.trim().toLowerCase();
                const filtered = q
                  ? rows.filter((r) => r.title.toLowerCase().includes(q) || section.toLowerCase().includes(q))
                  : rows;
                if (filtered.length === 0) return null;
                const open = pageSectionOpen[section] !== false;
                return (
                  <div key={section} style={{ marginBottom:8 }}>
                    <button
                      type="button"
                      onClick={()=>setPageSectionOpen((prev)=>({ ...prev, [section]: !open }))}
                      style={{
                        width:"100%",textAlign:"left",padding:"10px 12px",background:"#f5f4f0",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:8,
                        fontSize:13,fontWeight:800,color:"#2c2c2a",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
                      }}
                    >
                      <span>{section}</span>
                      <span style={{ fontSize:11,color:"#888780" }}>{open ? "접기" : "펼치기"} · {filtered.length}p</span>
                    </button>
                    {open && (
                      <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11,marginTop:6 }}>
                        <thead>
                          <tr style={{ background:"#fafaf8" }}>
                            <th style={{ padding:"8px 10px",textAlign:"left",fontWeight:700,color:"#888780" }}>p.</th>
                            <th style={{ padding:"8px 10px",textAlign:"left",fontWeight:700,color:"#888780" }}>제목</th>
                            <th style={{ padding:"8px 10px",textAlign:"left",fontWeight:700,color:"#888780" }}>공시기준</th>
                            <th style={{ padding:"8px 10px",textAlign:"center",fontWeight:700,color:"#888780" }}>상태</th>
                            <th style={{ padding:"8px 10px",textAlign:"center",fontWeight:700,color:"#888780" }}>작업</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((r)=>{
                            const st = mockHoldingPageStatus(r.page);
                            const cs = pgC[st];
                            return (
                              <tr key={`${section}-${r.page}`} style={{ borderBottom:"0.5px solid rgba(0,0,0,0.06)" }}>
                                <td style={{ padding:"8px 10px",whiteSpace:"nowrap",color:"#888780" }}>{r.page}</td>
                                <td style={{ padding:"8px 10px",fontWeight:600 }}>{r.title}</td>
                                <td style={{ padding:"8px 10px",color:"#5f5e5a",fontSize:10 }}>
                                  {r.standards.slice(0,3).map((x)=>x.trim()).filter(Boolean).join(", ")}{r.standards.length > 3 ? " …" : ""}
                                </td>
                                <td style={{ padding:"8px 10px",textAlign:"center" }}>
                                  <span style={{ padding:"3px 8px",borderRadius:4,background:cs.bg,color:cs.text,fontSize:10,fontWeight:600 }}>
                                    {st==="done"?"완료":st==="wip"?"작성중":"미작성"}
                                  </span>
                                </td>
                                <td style={{ padding:"8px 10px",textAlign:"center" }}>
                                  <Btn
                                    variant="subtle"
                                    small
                                    onClick={()=>onNavigateToSrReportHolding({
                                      holdingTab: "h-write",
                                      sectionId: `page-${r.page}`,
                                      source: "dashboard-pages",
                                      fiscalYear: "2024",
                                    })}
                                  >
                                    작성 화면
                                  </Btn>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
};

// ─── 루트 ────────────────────────────────────────────────────────────────────
export default function SRReportDashboard() {
  const [role, setRole] = useState("subsidiary");
  const navs = {
    subsidiary:["작성 현황"],
    holding:["계열사 제출 현황","페이지 작성"],
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
export const SRReportDashboardV3Subsidiary = ({ selectedDpId, selectedFeedbackId, onNavigateToApproval, onNavigateToSrReport } = {}) => (
  <SubsidiaryView
    selectedDpId={selectedDpId}
    selectedFeedbackId={selectedFeedbackId}
    onNavigateToApproval={onNavigateToApproval}
    onNavigateToSrReport={onNavigateToSrReport}
  />
);
export const SRReportDashboardV3Holding = ({ onNavigateToApproval, onNavigateToSrReportHolding } = {}) => (
  <HoldingView onNavigateToApproval={onNavigateToApproval} onNavigateToSrReportHolding={onNavigateToSrReportHolding} />
);
