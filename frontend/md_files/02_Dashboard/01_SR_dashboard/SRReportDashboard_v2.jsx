import { useState } from "react";

// ── 데이터 ────────────────────────────────────────────────────────────────────
const INITIAL_DP_CARDS = [
  {
    id:"dp-1", title:"에너지 소비량",
    standards:[
      { code:"GRI 302-1", label:"GRI 302-1", type:"GRI" },
      { code:"SASB EM-EP-130a.1", label:"SASB EM-EP", type:"SASB" },
    ],
    category:"환경", deadline:"25.04.10", status:"todo",
    description:"조직 내 에너지 소비 총량 및 에너지원별 데이터", assignee:"박지훈",
  },
  {
    id:"dp-2", title:"온실가스 배출",
    standards:[
      { code:"GRI 305-1", label:"GRI 305-1", type:"GRI" },
      { code:"GRI 305-2", label:"GRI 305-2", type:"GRI" },
      { code:"TCFD S-1",  label:"TCFD S-1",  type:"TCFD" },
    ],
    category:"환경", deadline:"25.04.10", status:"wip",
    description:"Scope 1·2·3 온실가스 배출량 (tCO₂eq)", assignee:"김가영",
  },
  {
    id:"dp-3", title:"취수 및 방류",
    standards:[
      { code:"GRI 303-3", label:"GRI 303-3", type:"GRI" },
      { code:"GRI 303-4", label:"GRI 303-4", type:"GRI" },
    ],
    category:"환경", deadline:"25.04.15", status:"submitted",
    description:"취수원별 취수량 및 방류 수질 데이터", assignee:"박지훈",
  },
  {
    id:"dp-4", title:"신규 채용 및 이직",
    standards:[{ code:"GRI 401-1", label:"GRI 401-1", type:"GRI" }],
    category:"사회", deadline:"25.04.20", status:"todo",
    description:"성별·연령별 신규 채용 및 이직률", assignee:"김인사",
  },
  {
    id:"dp-5", title:"이사회 다양성",
    standards:[
      { code:"GRI 405-1", label:"GRI 405-1", type:"GRI" },
      { code:"SASB CG",   label:"SASB CG",   type:"SASB" },
    ],
    category:"지배구조", deadline:"25.04.08", status:"approved",
    description:"이사회 구성원 다양성 지표 (성별·연령·국적)", assignee:"안수호",
  },
  {
    id:"dp-6", title:"기후 리스크 평가",
    standards:[
      { code:"TCFD S-2", label:"TCFD S-2", type:"TCFD" },
      { code:"TCFD S-3", label:"TCFD S-3", type:"TCFD" },
    ],
    category:"환경", deadline:"25.04.12", status:"wip",
    description:"물리적·전환 기후 리스크 시나리오 분석", assignee:"김가영",
  },
  {
    id:"dp-7", title:"공급망 인권실사",
    standards:[
      { code:"GRI 414-1", label:"GRI 414-1", type:"GRI" },
      { code:"GRI 414-2", label:"GRI 414-2", type:"GRI" },
    ],
    category:"사회", deadline:"25.04.25", status:"todo",
    description:"공급업체 인권·사회 기준 평가 결과", assignee:"박지훈",
  },
  {
    id:"dp-8", title:"산업안전 및 보건",
    standards:[
      { code:"GRI 403-9",  label:"GRI 403-9",  type:"GRI" },
      { code:"GRI 403-10", label:"GRI 403-10", type:"GRI" },
    ],
    category:"사회", deadline:"25.04.18", status:"submitted",
    description:"재해율·산업재해 건수 및 직업성 질환 현황", assignee:"김인사",
  },
];

const COLUMNS = [
  { key:"todo",      label:"미작성",    color:"#888780", bg:"#f1efe8", dashed:"rgba(0,0,0,0.12)" },
  { key:"wip",       label:"작성 중",   color:"#854f0b", bg:"#faeeda", dashed:"rgba(133,79,11,0.3)" },
  { key:"submitted", label:"제출 완료", color:"#185fa5", bg:"#e8f1fb", dashed:"rgba(24,95,165,0.3)" },
  { key:"approved",  label:"승인 완료", color:"#3b6d11", bg:"#eaf3de", dashed:"rgba(59,109,17,0.3)" },
];

const STD_C = { GRI:{ bg:"#e8f1fb", color:"#185fa5" }, SASB:{ bg:"#faeeda", color:"#854f0b" }, TCFD:{ bg:"#eeedfe", color:"#534ab7" } };
const CAT_C = { "환경":{ bg:"#eaf3de", color:"#3b6d11" }, "사회":{ bg:"#e8f1fb", color:"#185fa5" }, "지배구조":{ bg:"#eeedfe", color:"#534ab7" } };

const INIT_APPROVALS = [
  {
    id:"apr-1", dpId:"dp-3", title:"취수 및 방류 데이터 제출 승인 요청",
    drafter:"박지훈 대리", draftedAt:"25.03.21 09:30", docNo:"ESG-2025-029", status:"pending",
    body:"GRI 303-3, GRI 303-4 기준에 따라 2024년도 취수 및 방류 데이터를 첨부하여 제출합니다.\n\n■ 취수량: 234,500 m³ (지표수 180,000 / 지하수 54,500)\n■ 방류량: 198,200 m³\n■ 재이용수: 36,300 m³\n\n데이터 검증 완료 후 SR 보고서에 반영 예정입니다.",
    attachments:["GRI303_data_2024.xlsx","수질검사결과서.pdf"],
    comments:[],
  },
  {
    id:"apr-2", dpId:"dp-8", title:"산업안전보건 데이터 제출 승인 요청",
    drafter:"김인사 대리", draftedAt:"25.03.22 14:11", docNo:"ESG-2025-031", status:"pending",
    body:"GRI 403-9, GRI 403-10 기준에 따른 2024년도 산업안전보건 데이터를 제출합니다.\n\n■ 재해율: 0.42‰\n■ 산업재해 건수: 3건 (경상 2, 무재해 목표 미달 1)\n■ 직업성 질환: 0건\n\n전년 대비 재해율 0.08‰ 감소하였습니다.",
    attachments:["안전보건_통계_2024.xlsx"],
    comments:[],
  },
];

// ── 공통 ──────────────────────────────────────────────────────────────────────
const Chip = ({ bg, color, children, onClick, small }) => (
  <span onClick={onClick} style={{
    background:bg, color, fontSize:small?10:11, fontWeight:500,
    padding: small?"1px 6px":"2px 8px", borderRadius:4, whiteSpace:"nowrap",
    cursor:onClick?"pointer":"default",
  }}>{children}</span>
);

const Btn = ({ children, primary, danger, ghost, small, onClick, disabled, style }) => (
  <button onClick={onClick} disabled={disabled} style={{
    fontSize:small?11:13, padding:small?"5px 12px":"8px 18px",
    borderRadius:7, border:ghost?"0.5px solid rgba(0,0,0,0.15)":"none",
    background: disabled?"#e8e6de":primary?"#0c447c":danger?"#a32d2d":ghost?"#fff":"#f1efe8",
    color: disabled?"#b4b2a9":(primary||danger)?"#fff":"#2c2c2a",
    cursor:disabled?"not-allowed":"pointer", fontWeight:500,
    ...style,
  }}>{children}</button>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize:10, fontWeight:700, color:"#b4b2a9", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:7 }}>{children}</div>
);

// ── 전자결재 기안 모달 ──────────────────────────────────────────────────────────
const DraftModal = ({ card, onClose, onSubmit }) => {
  const [title, setTitle] = useState(`[${card.title}] SR 보고서 데이터 제출 승인 요청`);
  const [body, setBody] = useState(
    `${card.standards.map(s=>s.label).join(", ")} 기준에 따라 2024년도 "${card.title}" 데이터를 제출합니다.\n\n■ 데이터 요약:\n\n■ 특이사항:\n\n검토 후 SR 보고서에 반영 부탁드립니다.`
  );
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
      <div style={{ background:"#fff", borderRadius:14, width:620, maxHeight:"90vh", overflow:"auto", boxShadow:"0 12px 40px rgba(0,0,0,0.2)" }}>
        {/* 헤더 */}
        <div style={{ padding:"18px 24px 14px", borderBottom:"0.5px solid rgba(0,0,0,0.1)", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:10, color:"#b4b2a9", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:4 }}>전자결재 · 기안 작성</div>
            <div style={{ fontSize:17, fontWeight:800, color:"#0c447c" }}>SR 데이터 제출 기안</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"#b4b2a9", lineHeight:1, padding:0 }}>×</button>
        </div>

        <div style={{ padding:"20px 24px" }}>
          {/* 결재선 */}
          <SectionLabel>결재선</SectionLabel>
          <div style={{ display:"flex", gap:0, border:"0.5px solid rgba(0,0,0,0.1)", borderRadius:9, overflow:"hidden", marginBottom:20 }}>
            {[
              { role:"기안", name:"박지훈 대리", dept:"ESG팀", done:true },
              { role:"검토", name:"안수호 차장", dept:"ESG팀", done:false },
              { role:"승인", name:"연시은 팀장", dept:"지주사 ESG팀", done:false },
            ].map((a,i)=>(
              <div key={i} style={{
                flex:1, padding:"12px", textAlign:"center",
                borderRight:i<2?"0.5px solid rgba(0,0,0,0.08)":"none",
                background:a.done?"#eaf3de":"#fff",
              }}>
                <div style={{ fontSize:10, fontWeight:700, color:a.done?"#3b6d11":"#b4b2a9", marginBottom:3 }}>{a.role}</div>
                <div style={{ fontSize:12, fontWeight:700, color:"#2c2c2a", marginBottom:2 }}>{a.name}</div>
                <div style={{ fontSize:10, color:"#b4b2a9" }}>{a.dept}</div>
                {a.done && <div style={{ fontSize:10, color:"#3b6d11", marginTop:4 }}>✓ 기안</div>}
                {!a.done && <div style={{ fontSize:10, color:"#d3d1c7", marginTop:4 }}>대기</div>}
              </div>
            ))}
          </div>

          {/* 문서 메타 */}
          <SectionLabel>문서 정보</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 20px", marginBottom:18 }}>
            {[["기안부서","ESG팀"],["기안일","2025.03.25"],["문서번호","ESG-2025-032"],["보존기간","5년"]].map(([k,v],i)=>(
              <div key={i} style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:11, color:"#b4b2a9", width:56, flexShrink:0 }}>{k}</span>
                <span style={{ fontSize:12, fontWeight:600, color:"#2c2c2a" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* 제목 */}
          <SectionLabel>제목</SectionLabel>
          <input value={title} onChange={e=>setTitle(e.target.value)} style={{
            width:"100%", fontSize:13, padding:"9px 12px", borderRadius:7,
            border:"0.5px solid rgba(0,0,0,0.15)", background:"#fafaf8",
            color:"#2c2c2a", outline:"none", marginBottom:16, boxSizing:"border-box",
          }}/>

          {/* 관련 DP */}
          <SectionLabel>관련 DP 항목</SectionLabel>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
            {card.standards.map(s=><Chip key={s.code} {...STD_C[s.type]}>{s.label}</Chip>)}
            <Chip {...CAT_C[card.category]}>{card.category}</Chip>
          </div>

          {/* 본문 */}
          <SectionLabel>본문</SectionLabel>
          <textarea value={body} onChange={e=>setBody(e.target.value)} rows={8} style={{
            width:"100%", fontSize:13, padding:"10px 12px", borderRadius:7,
            border:"0.5px solid rgba(0,0,0,0.15)", background:"#fafaf8",
            color:"#2c2c2a", resize:"vertical", outline:"none",
            lineHeight:1.75, fontFamily:"inherit", boxSizing:"border-box", marginBottom:14,
          }}/>

          {/* 첨부 */}
          <SectionLabel>첨부파일</SectionLabel>
          <div style={{ padding:"10px 14px", borderRadius:7, background:"#f5f4f0", marginBottom:20 }}>
            <div style={{ fontSize:12, color:"#888780", marginBottom:8 }}>DP 데이터 파일 자동 첨부 · 추가 파일 드래그 또는 클릭</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <Chip bg="#e8f1fb" color="#185fa5" small>📎 {card.title}_data_2024.xlsx</Chip>
              <Chip bg="#f1efe8" color="#5f5e5a" small onClick={()=>{}}>+ 파일 추가</Chip>
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
            <Btn ghost onClick={onClose}>취소</Btn>
            <Btn primary onClick={()=>onSubmit({ title, body, card })}>결재 상신 →</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 기준 작성 페이지 모달 ──────────────────────────────────────────────────────
const WriteModal = ({ card, standard, onClose, onSave }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
    <div style={{ background:"#fff", borderRadius:14, width:540, boxShadow:"0 12px 40px rgba(0,0,0,0.2)", overflow:"hidden" }}>
      <div style={{ padding:"18px 24px 14px", borderBottom:"0.5px solid rgba(0,0,0,0.1)", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ display:"flex", gap:6, marginBottom:6 }}>
            <Chip {...STD_C[standard.type]}>{standard.label}</Chip>
            <Chip {...CAT_C[card.category]}>{card.category}</Chip>
          </div>
          <div style={{ fontSize:16, fontWeight:800, color:"#2c2c2a" }}>{card.title}</div>
          <div style={{ fontSize:12, color:"#888780", marginTop:2 }}>{card.description}</div>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"#b4b2a9", padding:0, marginLeft:16 }}>×</button>
      </div>
      <div style={{ padding:"20px 24px" }}>
        <div style={{ padding:"12px 14px", borderRadius:8, background:"#e8f1fb", border:"0.5px solid rgba(24,95,165,0.2)", marginBottom:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#185fa5", marginBottom:2 }}>실제 구현 시</div>
          <div style={{ fontSize:12, color:"#185fa5" }}>{standard.label} 기준의 전체 데이터 입력 폼 페이지로 이동합니다. 각 기준별 필수 항목, 단위, 산정기준이 가이드와 함께 표시됩니다.</div>
        </div>
        {[["보고 연도","2024"],["데이터 총량",""],["산정 방법론",""],["특이사항 및 배제 항목",""]].map(([l,p],i)=>(
          <div key={i} style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#5f5e5a", marginBottom:5 }}>{l}</div>
            <input defaultValue={p} placeholder={p||"입력하세요"} style={{
              width:"100%", fontSize:13, padding:"9px 12px", borderRadius:7,
              border:"0.5px solid rgba(0,0,0,0.15)", background:"#fafaf8",
              color:"#2c2c2a", outline:"none", boxSizing:"border-box",
            }}/>
          </div>
        ))}
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
          <Btn ghost onClick={onClose}>닫기</Btn>
          <Btn primary onClick={()=>{ onSave(card.id); onClose(); }}>저장 · 작성 중으로 이동</Btn>
        </div>
      </div>
    </div>
  </div>
);

// ── 결재 문서함 ────────────────────────────────────────────────────────────────
const ApprovalBox = ({ approvals, setApprovals, cards, isHolding }) => {
  const [sel, setSel] = useState(approvals[0]?.id || null);
  const doc = approvals.find(a=>a.id===sel);
  const card = doc ? cards.find(c=>c.id===doc.dpId) : null;

  const stStyle = {
    pending:  { bg:"#faeeda", color:"#854f0b", label:"결재 대기" },
    approved: { bg:"#eaf3de", color:"#3b6d11", label:"승인완료"  },
    rejected: { bg:"#fcebeb", color:"#a32d2d", label:"반려"      },
  };

  const updateStatus = (id, status) => setApprovals(prev=>prev.map(a=>a.id===id?{...a,status}:a));

  return (
    <div style={{ display:"flex", height:"100%", minHeight:400 }}>
      {/* 목록 */}
      <div style={{ width:264, borderRight:"0.5px solid rgba(0,0,0,0.1)", display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"13px 16px 10px", borderBottom:"0.5px solid rgba(0,0,0,0.08)", flexShrink:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#2c2c2a" }}>결재 문서함</div>
          <div style={{ fontSize:11, color:"#b4b2a9", marginTop:1 }}>총 {approvals.length}건 · 대기 {approvals.filter(a=>a.status==="pending").length}건</div>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {approvals.map(a=>{
            const aCard = cards.find(c=>c.id===a.dpId);
            const s = stStyle[a.status];
            return (
              <div key={a.id} onClick={()=>setSel(a.id)} style={{
                padding:"12px 16px", cursor:"pointer",
                borderBottom:"0.5px solid rgba(0,0,0,0.07)",
                background: sel===a.id?"#e8f1fb":"#fff",
                borderLeft: sel===a.id?"3px solid #0c447c":"3px solid transparent",
                transition:"all 0.1s",
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <Chip bg={s.bg} color={s.color} small>{s.label}</Chip>
                  <span style={{ fontSize:10, color:"#d3d1c7" }}>{a.draftedAt}</span>
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:"#2c2c2a", marginBottom:3, lineHeight:1.4 }}>{a.title}</div>
                <div style={{ fontSize:11, color:"#888780", marginBottom:6 }}>{a.drafter}</div>
                {aCard && (
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                    {aCard.standards.slice(0,2).map(s=>(
                      <Chip key={s.code} {...STD_C[s.type]} small>{s.label}</Chip>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {approvals.length === 0 && (
            <div style={{ padding:"32px 16px", textAlign:"center", color:"#d3d1c7", fontSize:13 }}>결재 문서가 없습니다</div>
          )}
        </div>
      </div>

      {/* 문서 뷰어 */}
      {doc ? (
        <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>
          {/* 문서 헤더 */}
          <div style={{ marginBottom:20, paddingBottom:16, borderBottom:"0.5px solid rgba(0,0,0,0.1)" }}>
            <div style={{ fontSize:11, color:"#b4b2a9", marginBottom:6 }}>{doc.docNo} · {doc.draftedAt}</div>
            <div style={{ fontSize:19, fontWeight:800, color:"#0c447c", marginBottom:10, lineHeight:1.3 }}>{doc.title}</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <Chip bg={stStyle[doc.status].bg} color={stStyle[doc.status].color}>{stStyle[doc.status].label}</Chip>
              <span style={{ fontSize:12, color:"#888780" }}>기안자: {doc.drafter}</span>
            </div>
          </div>

          {/* 결재선 */}
          <SectionLabel>결재 현황</SectionLabel>
          <div style={{ display:"flex", gap:0, border:"0.5px solid rgba(0,0,0,0.1)", borderRadius:9, overflow:"hidden", marginBottom:20 }}>
            {[
              { role:"기안", name:"박지훈 대리", dept:"ESG팀", done:true, date:doc.draftedAt },
              { role:"검토", name:"안수호 차장", dept:"ESG팀", done:doc.status==="approved", date:doc.status==="approved"?"25.03.23":null },
              { role:"승인", name:"연시은 팀장", dept:"지주사 ESG팀", done:doc.status==="approved", date:doc.status==="approved"?"25.03.24":null },
            ].map((a,i)=>(
              <div key={i} style={{
                flex:1, padding:"12px 10px", textAlign:"center",
                borderRight:i<2?"0.5px solid rgba(0,0,0,0.08)":"none",
                background:a.done?"#eaf3de":"#fff",
              }}>
                <div style={{ fontSize:10, fontWeight:700, color:a.done?"#3b6d11":"#b4b2a9", marginBottom:3 }}>{a.role}</div>
                <div style={{ fontSize:12, fontWeight:700, color:"#2c2c2a", marginBottom:2 }}>{a.name}</div>
                <div style={{ fontSize:10, color:"#b4b2a9", marginBottom:3 }}>{a.dept}</div>
                <div style={{ fontSize:10, color:a.done?"#3b6d11":"#d3d1c7" }}>{a.done?`✓ ${a.date}`:"대기 중"}</div>
              </div>
            ))}
          </div>

          {/* 관련 DP */}
          {card && (<>
            <SectionLabel>관련 DP 항목</SectionLabel>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:18 }}>
              {card.standards.map(s=><Chip key={s.code} {...STD_C[s.type]}>{s.label}</Chip>)}
              <Chip {...CAT_C[card.category]}>{card.category}</Chip>
            </div>
          </>)}

          {/* 본문 */}
          <SectionLabel>본문</SectionLabel>
          <div style={{
            background:"#fafaf8", border:"0.5px solid rgba(0,0,0,0.1)",
            borderRadius:8, padding:"14px 16px", marginBottom:18,
            fontSize:13, color:"#2c2c2a", lineHeight:1.8, whiteSpace:"pre-wrap",
          }}>{doc.body}</div>

          {/* 첨부 */}
          <SectionLabel>첨부파일</SectionLabel>
          <div style={{ display:"flex", gap:8, marginBottom:24 }}>
            {doc.attachments.map(f=>(
              <div key={f} style={{
                display:"flex", alignItems:"center", gap:6, padding:"7px 12px",
                borderRadius:7, border:"0.5px solid rgba(0,0,0,0.12)",
                background:"#fff", fontSize:12, color:"#2c2c2a", cursor:"pointer",
              }}>📎 {f}</div>
            ))}
          </div>

          {/* 처리 버튼 — 지주사: 승인/반려, 계열사: 결재 대기 안내 */}
          {doc.status === "pending" && (
            <div style={{
              padding:"16px", borderRadius:8,
              background:"#f5f4f0", border:"0.5px solid rgba(0,0,0,0.1)",
            }}>
              {isHolding ? (
                <>
                  <div style={{ fontSize:12, fontWeight:700, color:"#5f5e5a", marginBottom:10 }}>결재 처리</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <Btn primary small onClick={()=>updateStatus(doc.id,"approved")}>✓ 승인</Btn>
                    <Btn danger small onClick={()=>updateStatus(doc.id,"rejected")}>✗ 반려</Btn>
                  </div>
                </>
              ) : (
                <div style={{ fontSize:12, color:"#888780" }}>
                  지주사 검토·승인 대기 중입니다. 승인 완료 시 알림이 발송됩니다.
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#d3d1c7", fontSize:13 }}>문서를 선택하세요</div>
      )}
    </div>
  );
};

// ── 칸반 카드 컴포넌트 ──────────────────────────────────────────────────────────
const KanbanCard = ({ card, onDragStart, onMoveToNext, onOpenDraft, onWrite }) => {
  const col = COLUMNS.find(c=>c.key===card.status);
  return (
    <div
      draggable onDragStart={e=>onDragStart(e,card.id)}
      style={{
        background:"#fff", borderRadius:9, marginBottom:8, cursor:"grab",
        border:`0.5px solid ${col.dashed}`, borderTop:`2.5px solid ${col.color}`,
        padding:"13px 14px", userSelect:"none", transition:"box-shadow 0.15s",
      }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 3px 10px rgba(0,0,0,0.1)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}
    >
      {/* 카테고리 + 마감 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <Chip {...CAT_C[card.category]} small>{card.category}</Chip>
        <span style={{ fontSize:10, color:"#d3d1c7" }}>마감 {card.deadline}</span>
      </div>

      {/* 제목 */}
      <div style={{ fontSize:13, fontWeight:800, color:"#2c2c2a", marginBottom:4, lineHeight:1.3 }}>{card.title}</div>

      {/* 설명 */}
      <div style={{ fontSize:11, color:"#888780", marginBottom:10, lineHeight:1.5 }}>{card.description}</div>

      {/* 기준 태그 — 클릭 시 작성 페이지 이동 */}
      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12 }}>
        {card.standards.map(s=>(
          <Chip key={s.code} {...STD_C[s.type]} small onClick={()=>onWrite(card,s)}>{s.label} ↗</Chip>
        ))}
      </div>

      {/* 담당자 + 액션 버튼 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{
            width:20, height:20, borderRadius:"50%", background:"#e8f1fb",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:9, fontWeight:800, color:"#185fa5",
          }}>{card.assignee[0]}</div>
          <span style={{ fontSize:11, color:"#b4b2a9" }}>{card.assignee}</span>
        </div>
        <div style={{ display:"flex", gap:5 }}>
          {card.status==="todo" && (
            <Btn small primary style={{ background:"#185fa5" }} onClick={()=>onWrite(card,card.standards[0])}>작성 시작 →</Btn>
          )}
          {card.status==="wip" && (
            <Btn small ghost onClick={()=>onMoveToNext(card.id)}>제출 완료 →</Btn>
          )}
          {card.status==="submitted" && (
            <Btn small primary onClick={()=>onOpenDraft(card)}>결재 상신 ↗</Btn>
          )}
          {card.status==="approved" && (
            <span style={{ fontSize:11, color:"#3b6d11", fontWeight:700 }}>✓ 완료</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ── 계열사 뷰 ─────────────────────────────────────────────────────────────────
const SubsidiaryView = () => {
  const [tab, setTab] = useState("kanban");
  const [cards, setCards] = useState(INITIAL_DP_CARDS);
  const [approvals, setApprovals] = useState(INIT_APPROVALS);
  const [draftModal, setDraftModal]   = useState(null);
  const [writeModal, setWriteModal]   = useState(null);
  const [dragId, setDragId]           = useState(null);
  const [dragOver, setDragOver]       = useState(null);

  const pending = approvals.filter(a=>a.status==="pending").length;

  const moveToNext = id => setCards(prev=>prev.map(c=>{
    if(c.id!==id) return c;
    const idx = COLUMNS.findIndex(col=>col.key===c.status);
    return idx<COLUMNS.length-1 ? {...c,status:COLUMNS[idx+1].key} : c;
  }));

  const handleDrop = (e, colKey) => {
    e.preventDefault();
    setCards(prev=>prev.map(c=>c.id===dragId?{...c,status:colKey}:c));
    setDragId(null); setDragOver(null);
  };

  const handleDraftSubmit = ({title,body,card}) => {
    const newDoc = {
      id:`apr-${Date.now()}`, dpId:card.id, title, drafter:"박지훈 대리",
      draftedAt:"25.03.25 지금", docNo:`ESG-2025-0${33+approvals.length}`, status:"pending",
      body, attachments:[`${card.title}_data_2024.xlsx`], comments:[],
    };
    setApprovals(prev=>[newDoc,...prev]);
    setCards(prev=>prev.map(c=>c.id===card.id?{...c,status:"approved"}:c));
    setDraftModal(null);
    setTab("approval");
  };

  const stats = Object.fromEntries(COLUMNS.map(c=>[c.key, cards.filter(x=>x.status===c.key).length]));

  return (
    <>
      {draftModal && <DraftModal card={draftModal} onClose={()=>setDraftModal(null)} onSubmit={handleDraftSubmit}/>}
      {writeModal && <WriteModal card={writeModal.card} standard={writeModal.standard} onClose={()=>setWriteModal(null)} onSave={id=>setCards(prev=>prev.map(c=>c.id===id?{...c,status:"wip"}:c))}/>}

      {/* Topbar */}
      <div style={{ background:"#fff", borderBottom:"0.5px solid rgba(0,0,0,0.1)", padding:"0 24px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:15, fontWeight:800, color:"#2c2c2a" }}>SR 보고서 작성</span>
          <Chip bg="#faeeda" color="#854f0b">㈜ A에너지</Chip>
          <Chip bg="#e8f1fb" color="#185fa5">2024년도</Chip>
        </div>
        {pending>0 && (
          <div onClick={()=>setTab("approval")} style={{
            display:"flex", alignItems:"center", gap:6, cursor:"pointer",
            padding:"5px 14px", borderRadius:7,
            background:"#faeeda", border:"0.5px solid rgba(133,79,11,0.2)",
          }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#854f0b", display:"inline-block" }}/>
            <span style={{ fontSize:12, color:"#854f0b", fontWeight:700 }}>결재 대기 {pending}건</span>
          </div>
        )}
      </div>

      {/* 탭 */}
      <div style={{ background:"#fff", borderBottom:"0.5px solid rgba(0,0,0,0.1)", padding:"0 24px", display:"flex", flexShrink:0 }}>
        {[{key:"kanban",label:"DP 작성 현황"},{key:"approval",label:`결재함${pending>0?` (${pending})`:""}` }].map(t=>(
          <div key={t.key} onClick={()=>setTab(t.key)} style={{
            padding:"10px 18px", fontSize:13, cursor:"pointer",
            color:tab===t.key?"#0c447c":"#888780", fontWeight:tab===t.key?700:400,
            borderBottom:tab===t.key?"2px solid #0c447c":"2px solid transparent",
            marginBottom:"-0.5px", transition:"color 0.1s",
          }}>{t.label}</div>
        ))}
      </div>

      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {tab==="kanban" && (
          <div style={{ flex:1, overflowY:"auto", padding:"18px 20px" }}>
            {/* 요약 바 */}
            <div style={{ display:"flex", gap:8, marginBottom:18 }}>
              {COLUMNS.map(col=>(
                <div key={col.key} style={{
                  flex:1, background:col.bg, border:`0.5px solid ${col.dashed}`,
                  borderRadius:8, padding:"10px 14px",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                }}>
                  <span style={{ fontSize:11, fontWeight:700, color:col.color }}>{col.label}</span>
                  <span style={{ fontSize:22, fontWeight:800, color:col.color }}>{stats[col.key]}</span>
                </div>
              ))}
            </div>

            {/* 칸반 보드 */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:10 }}>
              {COLUMNS.map(col=>(
                <div
                  key={col.key}
                  onDragOver={e=>{e.preventDefault();setDragOver(col.key);}}
                  onDrop={e=>handleDrop(e,col.key)}
                  onDragLeave={()=>setDragOver(null)}
                  style={{
                    minHeight:320, padding:4, borderRadius:10, transition:"all 0.15s",
                    background:dragOver===col.key?col.bg:"transparent",
                    border:dragOver===col.key?`1.5px dashed ${col.color}`:"1.5px dashed transparent",
                  }}
                >
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 6px 10px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background:col.color, display:"inline-block" }}/>
                      <span style={{ fontSize:12, fontWeight:700, color:col.color }}>{col.label}</span>
                    </div>
                    <span style={{
                      fontSize:11, fontWeight:700, width:20, height:20,
                      background:col.bg, color:col.color, borderRadius:"50%",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>{stats[col.key]}</span>
                  </div>
                  {cards.filter(c=>c.status===col.key).map(card=>(
                    <KanbanCard
                      key={card.id} card={card}
                      onDragStart={(e,id)=>{setDragId(id);e.dataTransfer.effectAllowed="move";}}
                      onMoveToNext={moveToNext}
                      onOpenDraft={setDraftModal}
                      onWrite={(c,s)=>setWriteModal({card:c,standard:s})}
                    />
                  ))}
                  {stats[col.key]===0 && (
                    <div style={{ textAlign:"center", padding:"28px 12px", color:"#d3d1c7", fontSize:12, border:"1.5px dashed #e8e6de", borderRadius:8 }}>
                      항목 없음
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="approval" && (
          <div style={{ flex:1, overflow:"hidden", background:"#fff" }}>
            <ApprovalBox approvals={approvals} setApprovals={setApprovals} cards={cards} isHolding={false}/>
          </div>
        )}
      </div>
    </>
  );
};

// ── 지주사 뷰 ─────────────────────────────────────────────────────────────────
const HoldingView = () => {
  const [tab, setTab] = useState("overview");
  const [approvals, setApprovals] = useState(INIT_APPROVALS);

  const DP_LIST = [
    { code:"GRI 302-1", name:"에너지 소비량",    std:"GRI",  sub:9, appr:8, total:10 },
    { code:"GRI 305-1", name:"온실가스 배출",     std:"GRI",  sub:7, appr:5, total:10 },
    { code:"GRI 303-3", name:"취수 및 방류",      std:"GRI",  sub:10,appr:9, total:10 },
    { code:"GRI 401-1", name:"신규 채용 및 이직", std:"GRI",  sub:6, appr:4, total:10 },
    { code:"GRI 405-1", name:"이사회 다양성",     std:"GRI",  sub:8, appr:7, total:10 },
    { code:"SASB EM-EP",name:"온실가스 배출 강도",std:"SASB", sub:5, appr:3, total:10 },
    { code:"TCFD S-1",  name:"기후 리스크 평가",  std:"TCFD", sub:4, appr:2, total:10 },
    { code:"GRI 414-1", name:"공급망 인권실사",   std:"GRI",  sub:3, appr:1, total:10 },
  ];
  const SUBS = [
    { name:"㈜ A에너지",sub:8,appr:7,total:8,rej:0 },
    { name:"㈜ B화학",  sub:8,appr:6,total:8,rej:1 },
    { name:"㈜ C건설",  sub:6,appr:4,total:8,rej:0 },
    { name:"㈜ D물산",  sub:3,appr:1,total:8,rej:1 },
    { name:"㈜ E바이오",sub:0,appr:0,total:8,rej:0 },
    { name:"㈜ F반도체",sub:7,appr:6,total:8,rej:0 },
    { name:"㈜ G물류",  sub:5,appr:3,total:8,rej:0 },
    { name:"㈜ H금융",  sub:4,appr:2,total:8,rej:2 },
  ];
  const PAGES = [
    { range:"p.1–2",  title:"CEO 메시지",      status:"done" },
    { range:"p.3–5",  title:"회사 개요",        status:"done" },
    { range:"p.6–8",  title:"ESG 전략 및 목표", status:"done" },
    { range:"p.9–12", title:"환경 성과 데이터", status:"wip"  },
    { range:"p.13–15",title:"사회 성과 데이터", status:"wip"  },
    { range:"p.16–18",title:"지배구조 현황",    status:"todo" },
    { range:"p.19–20",title:"이해관계자 참여",  status:"done" },
    { range:"p.21–22",title:"GRI 인덱스",      status:"todo" },
    { range:"p.23",   title:"제3자 검증 의견",  status:"wip"  },
    { range:"p.24",   title:"보고 경계 및 기준",status:"done" },
  ];

  const [selDp, setSelDp] = useState("GRI 302-1");
  const [pgSt, setPgSt] = useState(Object.fromEntries(PAGES.map(p=>[p.range,p.status])));
  const [dpAppr, setDpAppr] = useState(
    Object.fromEntries(DP_LIST.flatMap(d=>SUBS.map(s=>[`${d.code}::${s.name}`,"reviewing"])))
  );
  const pg = { done:"#3b6d11", wip:"#854f0b", todo:"#888780" };
  const pgBg = { done:"#eaf3de", wip:"#faeeda", todo:"#f1efe8" };
  const pgLbl = { done:"완성", wip:"작성중", todo:"미작성" };
  const ProgBar = ({val,color="#185fa5"}) => (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:4, background:"#e8e6de", borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${val}%`, height:"100%", background:color, borderRadius:3 }}/>
      </div>
      <span style={{ fontSize:10, color:"#b4b2a9", minWidth:26, textAlign:"right" }}>{val}%</span>
    </div>
  );
  const Card = ({children,style}) => (
    <div style={{ background:"#fff", border:"0.5px solid rgba(0,0,0,0.1)", borderRadius:10, padding:16, ...style }}>{children}</div>
  );

  return (
    <>
      <div style={{ background:"#fff", borderBottom:"0.5px solid rgba(0,0,0,0.1)", padding:"0 24px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:15, fontWeight:800, color:"#2c2c2a" }}>SR 보고서 관리</span>
          <Chip bg="#e8f1fb" color="#0c447c">지주사</Chip>
          <Chip bg="#e8f1fb" color="#185fa5">2024년도</Chip>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn ghost>미리보기</Btn>
          <Btn primary>최종 확정</Btn>
        </div>
      </div>

      <div style={{ background:"#fff", borderBottom:"0.5px solid rgba(0,0,0,0.1)", padding:"0 24px", display:"flex", flexShrink:0 }}>
        {[{key:"overview",label:"전체 현황"},{key:"dp",label:"DP별 취합"},{key:"pages",label:"페이지 작성"},{key:"approval",label:`승인 처리${approvals.filter(a=>a.status==="pending").length>0?` (${approvals.filter(a=>a.status==="pending").length})`:""}` }].map(t=>(
          <div key={t.key} onClick={()=>setTab(t.key)} style={{
            padding:"10px 18px", fontSize:13, cursor:"pointer",
            color:tab===t.key?"#0c447c":"#888780", fontWeight:tab===t.key?700:400,
            borderBottom:tab===t.key?"2px solid #0c447c":"2px solid transparent",
            marginBottom:"-0.5px", transition:"color 0.1s",
          }}>{t.label}</div>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"18px 22px" }}>
        {tab==="overview" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:10, marginBottom:16 }}>
              {[
                { label:"DP 항목",   value:DP_LIST.length },
                { label:"참여 계열사", value:SUBS.length },
                { label:"전체 제출률", value:`${Math.round(SUBS.reduce((a,s)=>a+s.sub,0)/SUBS.reduce((a,s)=>a+s.total,0)*100)}%`, color:"#185fa5" },
                { label:"전체 승인 건",value:SUBS.reduce((a,s)=>a+s.appr,0), color:"#3b6d11" },
              ].map((m,i)=>(
                <div key={i} style={{ background:"#f5f4f0", borderRadius:8, padding:"12px 14px" }}>
                  <div style={{ fontSize:11, color:"#b4b2a9", marginBottom:4 }}>{m.label}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:m.color||"#2c2c2a" }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Card>
                <div style={{ fontSize:13, fontWeight:800, color:"#2c2c2a", marginBottom:12 }}>DP별 제출 현황</div>
                {DP_LIST.map(d=>(
                  <div key={d.code} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontSize:12, color:"#444441" }}>{d.code} · {d.name}</span>
                      <span style={{ fontSize:11, color:"#b4b2a9" }}>{d.sub}/{d.total}</span>
                    </div>
                    <ProgBar val={Math.round(d.sub/d.total*100)}/>
                  </div>
                ))}
              </Card>
              <Card>
                <div style={{ fontSize:13, fontWeight:800, color:"#2c2c2a", marginBottom:12 }}>계열사별 현황</div>
                {SUBS.map(s=>(
                  <div key={s.name} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <span style={{ fontSize:12, width:80, color:"#444441", flexShrink:0 }}>{s.name.replace("㈜ ","")}</span>
                    <div style={{ flex:1 }}>
                      <ProgBar val={Math.round(s.sub/s.total*100)} color={s.rej>0?"#a32d2d":s.sub===s.total?"#3b6d11":"#185fa5"}/>
                    </div>
                    {s.rej>0 && <Chip bg="#fcebeb" color="#a32d2d" small>{s.rej}반려</Chip>}
                  </div>
                ))}
              </Card>
            </div>
          </>
        )}

        {tab==="dp" && (
          <div style={{ display:"grid", gridTemplateColumns:"234px 1fr", gap:14 }}>
            <div>
              {DP_LIST.map(d=>(
                <div key={d.code} onClick={()=>setSelDp(d.code)} style={{
                  padding:"11px 13px", borderRadius:8, cursor:"pointer", marginBottom:6,
                  border:selDp===d.code?"1px solid #185fa5":"0.5px solid rgba(0,0,0,0.1)",
                  background:selDp===d.code?"#e8f1fb":"#fff",
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:selDp===d.code?"#185fa5":"#2c2c2a" }}>{d.code}</span>
                    <Chip {...STD_C[d.std]} small>{d.std}</Chip>
                  </div>
                  <div style={{ fontSize:11, color:"#888780", marginBottom:6 }}>{d.name}</div>
                  <div style={{ display:"flex", gap:4 }}>
                    <Chip bg="#e8f1fb" color="#185fa5" small>{d.sub}제출</Chip>
                    <Chip bg="#eaf3de" color="#3b6d11" small>{d.appr}승인</Chip>
                  </div>
                </div>
              ))}
            </div>
            <Card style={{ padding:0 }}>
              <div style={{ padding:"14px 18px", borderBottom:"0.5px solid rgba(0,0,0,0.1)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:13, fontWeight:800 }}>{selDp} · 계열사별 현황</span>
                <Btn small primary>일괄 승인</Btn>
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr>{["계열사","상태","제출일","처리"].map(h=>(
                    <th key={h} style={{ fontSize:11, fontWeight:600, color:"#b4b2a9", padding:"8px 14px", borderBottom:"0.5px solid rgba(0,0,0,0.08)", textAlign:"left" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {SUBS.map((s,i)=>{
                    const k=`${selDp}::${s.name}`;
                    const st=i===4?"none":i===3?"rejected":dpAppr[k];
                    return (
                      <tr key={s.name}
                        onMouseEnter={e=>e.currentTarget.style.background="#f5f4f0"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                      >
                        <td style={{ padding:"9px 14px", fontWeight:700 }}>{s.name}</td>
                        <td style={{ padding:"9px 14px" }}>
                          {st==="approved"?<Chip bg="#eaf3de" color="#3b6d11">승인완료</Chip>
                          :st==="rejected"?<Chip bg="#fcebeb" color="#a32d2d">반려</Chip>
                          :st==="none"?<Chip bg="#f1efe8" color="#888780">미제출</Chip>
                          :<Chip bg="#faeeda" color="#854f0b">검토중</Chip>}
                        </td>
                        <td style={{ padding:"9px 14px", color:"#b4b2a9" }}>25.03.{18+i}</td>
                        <td style={{ padding:"9px 14px" }}>
                          {st==="reviewing"
                            ? <div style={{ display:"flex", gap:5 }}>
                                <Btn small primary style={{ background:"#3b6d11" }} onClick={()=>setDpAppr(p=>({...p,[k]:"approved"}))}>승인</Btn>
                                <Btn small primary style={{ background:"#a32d2d" }} onClick={()=>setDpAppr(p=>({...p,[k]:"rejected"}))}>반려</Btn>
                              </div>
                            : st==="none"?<Btn small ghost>독촉 알림</Btn>
                            :<span style={{ fontSize:11, color:"#d3d1c7" }}>—</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab==="pages" && (
          <>
            <div style={{ padding:"10px 14px", borderRadius:8, background:"#e8f1fb", border:"0.5px solid rgba(24,95,165,0.2)", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"#185fa5", display:"inline-block" }}/>
              <span style={{ fontSize:12, color:"#185fa5", fontWeight:700 }}>지주사 전용 기능</span>
              <span style={{ fontSize:12, color:"#5f5e5a" }}>페이지별 직접 작성은 지주사만 접근할 수 있습니다.</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:10, marginBottom:14 }}>
              {[
                {label:"전체 페이지",value:PAGES.length},
                {label:"완성",value:PAGES.filter(p=>pgSt[p.range]==="done").length,color:"#3b6d11"},
                {label:"작성중",value:PAGES.filter(p=>pgSt[p.range]==="wip").length,color:"#854f0b"},
                {label:"미작성",value:PAGES.filter(p=>pgSt[p.range]==="todo").length,color:"#a32d2d"},
              ].map((m,i)=>(
                <div key={i} style={{ background:"#f5f4f0", borderRadius:8, padding:"12px 14px" }}>
                  <div style={{ fontSize:11, color:"#b4b2a9", marginBottom:4 }}>{m.label}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:m.color||"#2c2c2a" }}>{m.value}</div>
                </div>
              ))}
            </div>
            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <span style={{ fontSize:13, fontWeight:800 }}>페이지 현황</span>
                <Btn small primary>+ 페이지 추가</Btn>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:10 }}>
                {PAGES.map(p=>{
                  const st=pgSt[p.range];
                  return (
                    <div key={p.range} style={{
                      border:`0.5px solid ${st==="done"?"rgba(59,109,17,0.3)":st==="wip"?"rgba(133,79,11,0.3)":"rgba(0,0,0,0.1)"}`,
                      borderRadius:8, padding:"10px 12px", cursor:"pointer", background:pgBg[st],
                    }}>
                      <div style={{ fontSize:10, color:pg[st], marginBottom:3, fontWeight:700 }}>{p.range}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#2c2c2a", marginBottom:8, lineHeight:1.4 }}>{p.title}</div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:11, fontWeight:600, color:pg[st] }}>{pgLbl[st]}</span>
                        {st!=="done" && <button onClick={()=>setPgSt(s=>({...s,[p.range]:"done"}))} style={{ fontSize:10, padding:"2px 7px", borderRadius:4, border:"0.5px solid rgba(0,0,0,0.15)", background:"#fff", cursor:"pointer", color:"#5f5e5a" }}>완료</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}

        {tab==="approval" && (
          <Card style={{ padding:0, overflow:"hidden", height:"calc(100vh - 230px)", minHeight:400 }}>
            <div style={{ padding:"13px 18px", borderBottom:"0.5px solid rgba(0,0,0,0.1)", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:13, fontWeight:800 }}>계열사 결재 처리</span>
              <span style={{ fontSize:12, color:"#b4b2a9" }}>계열사가 상신한 문서를 검토·승인합니다</span>
            </div>
            <div style={{ height:"calc(100% - 48px)" }}>
              <ApprovalBox approvals={approvals} setApprovals={setApprovals} cards={INITIAL_DP_CARDS} isHolding={true}/>
            </div>
          </Card>
        )}
      </div>
    </>
  );
};

// ── 루트 ─────────────────────────────────────────────────────────────────────
export default function SRReportDashboard() {
  const [role, setRole] = useState("subsidiary");

  return (
    <div style={{ display:"flex", height:"100vh", minHeight:640, background:"#f5f4f0", fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      {/* 사이드바 */}
      <aside style={{ width:192, minWidth:192, background:"#fff", borderRight:"0.5px solid rgba(0,0,0,0.1)", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"18px 16px 14px", borderBottom:"0.5px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize:14, fontWeight:800, color:"#0c447c", letterSpacing:"-0.3px" }}>ESG Hub</div>
          <div style={{ fontSize:10, color:"#b4b2a9", marginTop:1 }}>지속가능경영 포털</div>
          <div style={{ marginTop:10, display:"flex", borderRadius:7, border:"0.5px solid rgba(0,0,0,0.12)", overflow:"hidden" }}>
            {[{r:"subsidiary",l:"계열사"},{r:"holding",l:"지주사"}].map(({r,l})=>(
              <button key={r} onClick={()=>setRole(r)} style={{
                flex:1, fontSize:11, padding:"6px 4px", border:"none", cursor:"pointer",
                fontWeight:role===r?800:400,
                background:role===r?(r==="holding"?"#0c447c":"#185fa5"):"#fff",
                color:role===r?"#fff":"#888780",
                transition:"all 0.15s",
              }}>{l}</button>
            ))}
          </div>
        </div>
        <nav style={{ padding:"10px 8px", flex:1 }}>
          <div style={{ fontSize:9, color:"#d3d1c7", padding:"4px 8px 6px", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>메뉴</div>
          {(role==="holding"
            ?["전체 현황","DP별 취합","페이지 작성","승인 처리"]
            :["DP 작성 현황","결재함"]
          ).map(n=>(
            <div key={n} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", borderRadius:6, cursor:"pointer", color:"#5f5e5a", fontSize:13, marginBottom:1 }}
              onMouseEnter={e=>e.currentTarget.style.background="#f5f4f0"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            >
              <span style={{ width:4, height:4, borderRadius:"50%", background:"#d3d1c7", display:"inline-block" }}/>
              {n}
            </div>
          ))}
        </nav>
        <div style={{ padding:"12px 14px", borderTop:"0.5px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize:10, color:"#d3d1c7" }}>{role==="holding"?"지주사 관리자":"계열사 담당자"}</div>
          <div style={{ fontSize:12, fontWeight:800, color:"#2c2c2a", marginTop:1 }}>{role==="holding"?"연시은 팀장":"박지훈 대리"}</div>
          <div style={{ fontSize:10, color:"#b4b2a9", marginTop:1 }}>{role==="holding"?"ESG전략팀":"㈜ A에너지"}</div>
        </div>
      </aside>

      {/* 메인 */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {role==="subsidiary"?<SubsidiaryView/>:<HoldingView/>}
      </div>
    </div>
  );
}
