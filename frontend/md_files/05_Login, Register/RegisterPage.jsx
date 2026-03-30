import { useState } from "react";

const ROLES = [
  { key:"writer", label:"작성자", desc:"보고서 작성 및 데이터 입력", color:"#2563EB", bg:"#EFF6FF", border:"#BFDBFE" },
  { key:"reviewer", label:"검토자", desc:"보고서 검토 및 승인 요청", color:"#16A34A", bg:"#F0FDF4", border:"#BBF7D0" },
  { key:"viewer", label:"조회 전용", desc:"보고서 열람만 가능", color:"#475569", bg:"#F8FAFC", border:"#CBD5E1" },
];

const STEPS = ["코드 확인", "정보 입력", "가입 완료"];

export default function RegisterPage({ onBack }) {
  const [step, setStep] = useState(0);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState({ name:"", email:"", loginId:"", password:"", passwordConfirm:"", role:"" });
  const [errs, setErrs] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  // Step 0 → 1: 코드 검증
  const verifyCode = async () => {
    if (!code.trim()) { setCodeErr("등록 코드를 입력해주세요."); return; }
    setLoading(true);
    await new Promise(r=>setTimeout(r,900));
    setLoading(false);
    // Demo: CODE-2024 → (주)계열사A
    if (code.trim().toUpperCase() === "CODE-2024") {
      setCompany({ name:"(주)계열사A", code:"SUB-001" });
      setCodeErr("");
      setStep(1);
    } else {
      setCodeErr("유효하지 않거나 만료된 등록 코드입니다.");
    }
  };

  // Step 1 → 2: 폼 검증
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "이름을 입력해주세요.";
    if (!form.email.trim()) e.email = "이메일을 입력해주세요.";
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = "올바른 이메일 형식이 아닙니다.";
    if (!form.loginId.trim()) e.loginId = "아이디를 입력해주세요.";
    else if (form.loginId.length < 4) e.loginId = "아이디는 4자 이상이어야 합니다.";
    if (!form.password) e.password = "비밀번호를 입력해주세요.";
    else if (form.password.length < 8) e.password = "비밀번호는 8자 이상이어야 합니다.";
    if (form.password !== form.passwordConfirm) e.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (!form.role) e.role = "권한을 선택해주세요.";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrs(e); return; }
    setLoading(true);
    await new Promise(r=>setTimeout(r,1000));
    setLoading(false);
    setStep(2);
  };

  const f = (k, v) => { setForm({...form, [k]:v}); setErrs({...errs, [k]:""}); };

  const pwStrength = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();
  const pwLabel = ["","약함","보통","강함","매우 강함"][pwStrength];
  const pwColor = ["","#EF4444","#F59E0B","#22C55E","#2563EB"][pwStrength];

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700&family=Pretendard:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
      `}</style>

      {/* Left panel */}
      <div style={S.left}>
        <div style={S.leftGlow}/>
        <div style={S.leftContent}>
          <div style={S.logo}>
            <LogoMark/>
            <div>
              <div style={S.logoName}>SR Report</div>
              <div style={S.logoSub}>지속가능경영보고서 플랫폼</div>
            </div>
          </div>
          <div style={S.heroBlock}>
            <div style={S.eyebrow}>서브 계정 등록</div>
            <h1 style={S.heroTitle}>담당자 계정을<br/>직접 등록하세요</h1>
            <p style={S.heroDesc}>마스터 계정에서 발급받은 등록 코드로<br/>본인 정보를 직접 입력하고 비밀번호를 설정하세요.<br/>마스터 승인 후 즉시 사용 가능합니다.</p>
          </div>
          {/* Flow guide */}
          <div style={S.flowGuide}>
            {[
              {n:"01", t:"코드 입력", d:"마스터로부터 받은 등록 코드"},
              {n:"02", t:"정보 입력", d:"이름, 이메일, 비밀번호 설정"},
              {n:"03", t:"승인 대기", d:"마스터 계정 승인 후 활성화"},
            ].map((item,i)=>(
              <div key={i} style={S.flowItem}>
                <span style={S.flowN}>{item.n}</span>
                <div>
                  <p style={S.flowT}>{item.t}</p>
                  <p style={S.flowD}>{item.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={S.right}>
        {/* Step indicator */}
        <div style={S.stepBar}>
          {STEPS.map((label,i)=>(
            <div key={i} style={S.stepItem}>
              <div style={{
                ...S.stepCircle,
                background: i<step?"#22C55E": i===step?"#1D4ED8":"#E2E8F0",
                color: i<=step?"#fff":"#94A3B8"
              }}>
                {i<step
                  ? <CheckIcon size={12}/>
                  : <span style={{fontSize:12,fontWeight:700}}>{i+1}</span>
                }
              </div>
              <span style={{fontSize:12,fontWeight:500,color:i===step?"#0F172A":i<step?"#22C55E":"#94A3B8"}}>{label}</span>
              {i<STEPS.length-1&&<div style={{...S.stepLine,background:i<step?"#22C55E":"#E2E8F0"}}/>}
            </div>
          ))}
        </div>

        <div style={S.card}>
          {/* STEP 0: 코드 확인 */}
          {step===0&&(
            <div style={{animation:"slideIn .3s ease"}}>
              <div style={S.cardTop}>
                <h2 style={S.cardTitle}>등록 코드 확인</h2>
                <p style={S.cardSub}>마스터 계정 담당자로부터 받은 등록 코드를 입력해주세요</p>
              </div>
              <div style={S.codeWrap}>
                <div style={S.codeHint}>
                  <KeyIcon/>
                  <span>등록 코드는 마스터 계정 담당자가 발급합니다. <br/>코드가 없다면 담당자에게 문의하세요.</span>
                </div>
                <div style={S.fld}>
                  <label style={S.lbl}>등록 코드 <Req/></label>
                  <input
                    value={code}
                    onChange={e=>{setCode(e.target.value.toUpperCase());setCodeErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&verifyCode()}
                    placeholder="예: CODE-2024"
                    style={{...S.inp2,...(codeErr?S.inpErr:{}),textAlign:"center",letterSpacing:"0.2em",fontSize:18,fontWeight:700}}
                  />
                  {codeErr&&<span style={S.errTxt}>{codeErr}</span>}
                  <span style={S.helper}>테스트 코드: CODE-2024</span>
                </div>
              </div>
              <button style={{...S.primBtn,opacity:loading?.7:1,marginTop:8}} onClick={verifyCode} disabled={loading}>
                {loading?<Spinner/>:"코드 확인"}
              </button>
              <button style={S.txLink2} onClick={()=>onBack?.()}>← 로그인으로 돌아가기</button>
            </div>
          )}

          {/* STEP 1: 정보 입력 */}
          {step===1&&(
            <div style={{animation:"slideIn .3s ease"}}>
              <div style={S.cardTop}>
                <h2 style={S.cardTitle}>담당자 정보 입력</h2>
                <p style={S.cardSub}>가입 정보와 비밀번호를 직접 설정하세요</p>
              </div>

              {/* 회사 확인 배지 */}
              <div style={S.companyBadge}>
                <BuildingIcon/>
                <div>
                  <p style={S.companyName}>{company?.name}</p>
                  <p style={S.companyCode}>법인코드: {company?.code}</p>
                </div>
                <span style={S.companyCheck}><CheckIcon size={10}/></span>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:16,marginTop:20}}>
                {/* 이름 */}
                <Row label="이름" req err={errs.name}>
                  <input value={form.name} onChange={e=>f("name",e.target.value)} placeholder="홍길동" style={{...S.inp2,...(errs.name?S.inpErr:{})}}/>
                </Row>

                {/* 이메일 */}
                <Row label="이메일" req err={errs.email}>
                  <input value={form.email} onChange={e=>f("email",e.target.value)} placeholder="example@company.com" style={{...S.inp2,...(errs.email?S.inpErr:{})}}/>
                </Row>

                {/* 아이디 */}
                <Row label="사용할 아이디" req err={errs.loginId} helper="영문/숫자 4자 이상">
                  <input value={form.loginId} onChange={e=>f("loginId",e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))} placeholder="my_id" style={{...S.inp2,...(errs.loginId?S.inpErr:{})}}/>
                </Row>

                {/* 비밀번호 */}
                <Row label="비밀번호" req err={errs.password}>
                  <div style={S.pwWrap}>
                    <input type={showPw?"text":"password"} value={form.password} onChange={e=>f("password",e.target.value)} placeholder="8자 이상 입력" style={{...S.inp2,...(errs.password?S.inpErr:{})}}/>
                    <button type="button" onClick={()=>setShowPw(!showPw)} style={S.eyeAbs}>{showPw?<EyeOffIcon/>:<EyeIcon/>}</button>
                  </div>
                  {form.password&&(
                    <div style={S.pwStr}>
                      <div style={S.pwBar}>
                        {[1,2,3,4].map(i=>(
                          <div key={i} style={{...S.pwSeg,background:i<=pwStrength?pwColor:"#E2E8F0"}}/>
                        ))}
                      </div>
                      <span style={{fontSize:11,color:pwColor,fontWeight:600}}>{pwLabel}</span>
                    </div>
                  )}
                </Row>

                {/* 비밀번호 확인 */}
                <Row label="비밀번호 확인" req err={errs.passwordConfirm}>
                  <div style={S.pwWrap}>
                    <input type={showPw2?"text":"password"} value={form.passwordConfirm} onChange={e=>f("passwordConfirm",e.target.value)} placeholder="비밀번호 재입력" style={{...S.inp2,...(errs.passwordConfirm?S.inpErr:{})}}/>
                    <button type="button" onClick={()=>setShowPw2(!showPw2)} style={S.eyeAbs}>{showPw2?<EyeOffIcon/>:<EyeIcon/>}</button>
                  </div>
                </Row>

                {/* 권한 선택 */}
                <div style={S.fld}>
                  <label style={S.lbl}>권한 선택 <Req/></label>
                  <p style={S.helper2}>마스터 승인 시 조정될 수 있습니다</p>
                  <div style={S.roleGrid}>
                    {ROLES.map(r=>(
                      <div key={r.key} onClick={()=>f("role",r.key)} style={{
                        ...S.roleCard,
                        borderColor: form.role===r.key?r.color:errs.role?"#FCA5A5":"#E2E8F0",
                        background: form.role===r.key?r.bg:"#fff",
                      }}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <span style={{fontSize:13,fontWeight:700,color:form.role===r.key?r.color:"#374151"}}>{r.label}</span>
                          {form.role===r.key&&<span style={{...S.roleChk,background:r.color}}><CheckIcon size={9}/></span>}
                        </div>
                        <span style={{fontSize:11,color:"#94A3B8",lineHeight:1.5}}>{r.desc}</span>
                      </div>
                    ))}
                  </div>
                  {errs.role&&<span style={S.errTxt}>{errs.role}</span>}
                </div>
              </div>

              <div style={{display:"flex",gap:10,marginTop:24}}>
                <button style={S.secBtn} onClick={()=>setStep(0)}>← 이전</button>
                <button style={{...S.primBtn,flex:2,opacity:loading?.7:1,marginTop:0}} onClick={handleSubmit} disabled={loading}>
                  {loading?<Spinner/>:"가입 신청"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: 완료 */}
          {step===2&&(
            <div style={{animation:"slideIn .3s ease",display:"flex",flexDirection:"column",alignItems:"center",padding:"16px 0",gap:16}}>
              <div style={S.doneCircle}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h3 style={{fontSize:20,fontWeight:700,color:"#0F172A",letterSpacing:"-0.3px"}}>가입 신청 완료!</h3>
              <p style={{fontSize:13,color:"#64748B",textAlign:"center",lineHeight:1.8}}>
                <strong>{company?.name}</strong>의 마스터 계정 담당자가<br/>가입 신청을 검토 후 승인합니다.<br/>승인되면 <strong>{form.email}</strong>로 안내 메일이 발송됩니다.
              </p>
              <div style={S.pendingBox}>
                <ClockIcon/>
                <div>
                  <p style={{fontSize:13,fontWeight:600,color:"#92400E"}}>승인 대기 중</p>
                  <p style={{fontSize:12,color:"#B45309"}}>보통 1영업일 이내에 처리됩니다</p>
                </div>
              </div>
              <button style={{...S.primBtn,width:"100%",marginTop:8}} onClick={()=>onBack?.()}>
                로그인 화면으로 →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helper components ──
const Row = ({label,req,err,helper,helper2,children})=>(
  <div style={S.fld}>
    <label style={S.lbl}>{label} {req&&<Req/>}</label>
    {helper2&&<p style={S.helper2}>{helper2}</p>}
    {children}
    {helper&&!err&&<span style={S.helper}>{helper}</span>}
    {err&&<span style={S.errTxt}>{err}</span>}
  </div>
);
const Req=()=><span style={{color:"#EF4444"}}>*</span>;
const Spinner=()=><span style={{width:17,height:17,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin .7s linear infinite"}}/>;

// ── Icons ──
const mk=(d,sz=16,col="#94A3B8")=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2">{d}</svg>;
const CheckIcon=({size=16})=>mk(<polyline points="20 6 9 17 4 12"/>,size,"currentColor");
const EyeIcon=()=>mk(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>);
const EyeOffIcon=()=>mk(<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>);
const KeyIcon=()=>mk(<><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>,16,"#4F7FFF");
const BuildingIcon=()=>mk(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,18,"#2563EB");
const ClockIcon=()=>mk(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,18,"#B45309");
const LogoMark=()=><svg width="32" height="32" viewBox="0 0 36 36" fill="none"><rect x="0" y="0" width="16" height="16" rx="3" fill="#4F7FFF"/><rect x="20" y="0" width="16" height="16" rx="3" fill="#4F7FFF" opacity=".5"/><rect x="0" y="20" width="16" height="16" rx="3" fill="#4F7FFF" opacity=".3"/><rect x="20" y="20" width="16" height="16" rx="3" fill="#4F7FFF"/></svg>;

const S={
  root:{display:"flex",minHeight:"100vh",fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",background:"#0A0F1E"},
  left:{flex:1,position:"relative",overflow:"hidden"},
  leftGlow:{position:"absolute",top:"30%",left:"20%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(79,127,255,.12) 0%,transparent 70%)",zIndex:0},
  leftContent:{position:"relative",zIndex:1,display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"52px 56px",height:"100%",background:"linear-gradient(140deg,#0D1B3E 0%,#0A0F1E 100%)",backgroundImage:"linear-gradient(rgba(79,127,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(79,127,255,.05) 1px,transparent 1px)",backgroundSize:"40px 40px",animation:"fadeUp .7s ease both"},
  logo:{display:"flex",alignItems:"center",gap:12},
  logoName:{fontSize:18,fontWeight:700,color:"#F0F6FF"},
  logoSub:{fontSize:11,color:"#4F7FFF",marginTop:2},
  heroBlock:{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:20},
  eyebrow:{fontSize:11,fontWeight:600,color:"#4F7FFF",letterSpacing:".12em",textTransform:"uppercase",border:"1px solid rgba(79,127,255,.3)",borderRadius:4,padding:"4px 10px",width:"fit-content"},
  heroTitle:{fontFamily:"'Noto Serif KR',serif",fontSize:38,fontWeight:700,color:"#F0F6FF",lineHeight:1.25,letterSpacing:"-0.8px"},
  heroDesc:{fontSize:14,color:"#7B91B0",lineHeight:1.85},
  flowGuide:{display:"flex",flexDirection:"column",gap:16,paddingTop:32,borderTop:"1px solid rgba(255,255,255,.07)"},
  flowItem:{display:"flex",alignItems:"flex-start",gap:14},
  flowN:{fontSize:11,fontWeight:700,color:"#4F7FFF",letterSpacing:".05em",minWidth:24,marginTop:1},
  flowT:{fontSize:13,fontWeight:600,color:"#E2E8F0",marginBottom:2},
  flowD:{fontSize:12,color:"#7B91B0"},

  right:{width:520,background:"#F0F4FA",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 32px",animation:"fadeUp .7s .1s ease both",gap:16},
  stepBar:{display:"flex",alignItems:"center",width:"100%",maxWidth:440},
  stepItem:{display:"flex",alignItems:"center",gap:8,flex:1},
  stepCircle:{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  stepLine:{flex:1,height:2,margin:"0 4px",transition:"background .3s"},

  card:{background:"#fff",borderRadius:18,padding:"36px 36px",width:"100%",boxShadow:"0 8px 48px rgba(0,0,0,.09)",border:"1px solid #E8EDF5"},
  cardTop:{marginBottom:24},
  cardTitle:{fontSize:20,fontWeight:700,color:"#0F172A",letterSpacing:"-0.4px",marginBottom:5},
  cardSub:{fontSize:13,color:"#64748B",lineHeight:1.6},

  codeWrap:{display:"flex",flexDirection:"column",gap:16,margin:"4px 0 8px"},
  codeHint:{display:"flex",alignItems:"flex-start",gap:10,background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#1D4ED8",lineHeight:1.6},
  companyBadge:{display:"flex",alignItems:"center",gap:12,background:"#F0FDF4",border:"1.5px solid #BBF7D0",borderRadius:10,padding:"12px 16px"},
  companyName:{fontSize:14,fontWeight:700,color:"#15803D"},
  companyCode:{fontSize:11,color:"#4ADE80",marginTop:1},
  companyCheck:{width:20,height:20,borderRadius:"50%",background:"#22C55E",display:"flex",alignItems:"center",justifyContent:"center",marginLeft:"auto",color:"#fff",flexShrink:0},

  fld:{display:"flex",flexDirection:"column",gap:7},
  lbl:{fontSize:13,fontWeight:600,color:"#374151"},
  inp2:{padding:"11px 14px",background:"#F8FAFC",border:"1.5px solid #E2E8F0",borderRadius:10,fontSize:14,color:"#0F172A",fontFamily:"inherit",outline:"none",width:"100%"},
  inpErr:{borderColor:"#FCA5A5",background:"#FFF5F5"},
  errTxt:{fontSize:12,color:"#EF4444"},
  helper:{fontSize:12,color:"#94A3B8"},
  helper2:{fontSize:12,color:"#64748B",marginBottom:4},

  pwWrap:{position:"relative",display:"flex",alignItems:"center"},
  eyeAbs:{position:"absolute",right:12,background:"none",border:"none",cursor:"pointer",display:"flex",padding:4},
  pwStr:{display:"flex",alignItems:"center",gap:8,marginTop:4},
  pwBar:{display:"flex",gap:4,flex:1},
  pwSeg:{height:4,flex:1,borderRadius:2,transition:"background .3s"},

  roleGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:4},
  roleCard:{border:"1.5px solid #E2E8F0",borderRadius:10,padding:"12px",cursor:"pointer",display:"flex",flexDirection:"column",gap:6,position:"relative",transition:"all .15s"},
  roleChk:{width:18,height:18,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"},

  primBtn:{width:"100%",padding:13,background:"linear-gradient(135deg,#1D4ED8,#4F7FFF)",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",marginTop:0,transition:"opacity .2s"},
  secBtn:{padding:"13px 20px",background:"#F1F5F9",border:"1.5px solid #E2E8F0",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#64748B"},
  txLink2:{background:"none",border:"none",color:"#64748B",fontSize:13,cursor:"pointer",fontFamily:"inherit",textAlign:"center",marginTop:12,textDecoration:"underline",textUnderlineOffset:3},

  doneCircle:{width:72,height:72,borderRadius:"50%",background:"#F0FDF4",border:"2px solid #BBF7D0",display:"flex",alignItems:"center",justifyContent:"center"},
  pendingBox:{display:"flex",alignItems:"center",gap:12,background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,padding:"12px 16px",width:"100%"},
};
