import { useState } from "react";

export default function LoginPage({ onLogin, onRegister }) {
  const [form, setForm] = useState({ loginId: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotForm, setForgotForm] = useState({ loginId: "", email: "" });
  const [forgotMsg, setForgotMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.loginId || !form.password) { setError("아이디와 비밀번호를 모두 입력해주세요."); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setLoading(false);
    if (form.loginId === "master" && form.password === "1234") {
      onLogin?.({ role: "master", company: "(주)계열사A" });
    } else {
      const next = failCount + 1; setFailCount(next);
      setError(next >= 5
        ? "로그인 시도 5회 초과로 30분간 계정이 잠겼습니다."
        : `아이디 또는 비밀번호가 올바르지 않습니다. (${next}/5)`);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!forgotForm.loginId || !forgotForm.email) { setForgotMsg("모두 입력해주세요."); return; }
    setLoading(true); await new Promise(r => setTimeout(r, 800)); setLoading(false);
    setForgotStep(2);
  };

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&family=Pretendard:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <div style={S.left}>
        <div style={S.leftGlow} />
        <div style={S.leftContent}>
          <div style={S.logo}>
            <LogoMark />
            <div>
              <div style={S.logoName}>SR Report</div>
              <div style={S.logoSub}>지속가능경영보고서 플랫폼</div>
            </div>
          </div>
          <div style={S.heroBlock}>
            <div style={S.eyebrow}>그룹사 전용 보고서 시스템</div>
            <h1 style={S.heroTitle}>지속가능한<br />경영의 기록</h1>
            <p style={S.heroDesc}>계열사별 ESG 데이터를 통합 관리하고<br />지주사와 실시간으로 공유하세요.</p>
          </div>
          <div style={S.stats}>
            {[["12","계열사"],["48","보고서"],["2024","기준연도"]].map(([n,l]) => (
              <div key={l} style={S.stat}><span style={S.statN}>{n}</span><span style={S.statL}>{l}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div style={S.right}>
        <div style={S.card}>
          {!showForgot ? (
            <>
              <div style={S.cardTop}>
                <h2 style={S.cardTitle}>로그인</h2>
                <p style={S.cardSub}>지주사로부터 발급받은 계정으로 접속하세요</p>
              </div>
              <form onSubmit={handleSubmit} style={S.form}>
                <div style={S.fld}>
                  <label style={S.lbl}>아이디</label>
                  <div style={S.ibox}>
                    <span style={S.iicL}><UserIcon /></span>
                    <input value={form.loginId} onChange={e=>{setForm({...form,loginId:e.target.value});setError("");}} placeholder="법인 아이디 입력" style={S.inp} />
                  </div>
                </div>
                <div style={S.fld}>
                  <label style={S.lbl}>비밀번호</label>
                  <div style={S.ibox}>
                    <span style={S.iicL}><LockIcon /></span>
                    <input type={showPw?"text":"password"} value={form.password} onChange={e=>{setForm({...form,password:e.target.value});setError("");}} placeholder="비밀번호 입력" style={S.inp} />
                    <button type="button" onClick={()=>setShowPw(!showPw)} style={S.eye}>{showPw?<EyeOffIcon/>:<EyeIcon/>}</button>
                  </div>
                </div>
                {error && <div style={S.errBox}><InfoIcon size={14} color="#DC2626"/><span>{error}</span></div>}
                <button type="submit" style={{...S.primBtn,opacity:loading?.7:1}} disabled={loading}>
                  {loading?<Spinner/>:"로그인"}
                </button>
                <button type="button" onClick={()=>setShowForgot(true)} style={S.txLink}>비밀번호를 잊으셨나요?</button>
              </form>

              <div style={S.div}><div style={S.divLine}/><span style={S.divTxt}>또는</span><div style={S.divLine}/></div>

              {/* ★ 계정 등록 진입점 */}
              <div style={S.regBox}>
                <div style={S.regIconWrap}><RegIcon /></div>
                <div style={S.regText}>
                  <p style={S.regTitle}>계정이 없으신가요?</p>
                  <p style={S.regDesc}>마스터 계정에서 발급받은 <strong>등록 코드</strong>로 가입하세요</p>
                </div>
                <button style={S.regBtn} onClick={()=>onRegister?.()}>계정 등록 →</button>
              </div>

              <p style={S.adminNote}>관리자 로그인 → /admin</p>
            </>
          ) : (
            <>
              <button onClick={()=>{setShowForgot(false);setForgotStep(1);setForgotMsg("");}} style={S.backBtn}>← 돌아가기</button>
              <div style={S.cardTop}><h2 style={S.cardTitle}>비밀번호 찾기</h2><p style={S.cardSub}>가입 시 등록한 이메일로 재설정 링크를 보내드립니다</p></div>
              {forgotStep===1?(
                <form onSubmit={handleForgot} style={S.form}>
                  <div style={S.fld}><label style={S.lbl}>아이디</label><div style={S.ibox}><input value={forgotForm.loginId} onChange={e=>setForgotForm({...forgotForm,loginId:e.target.value})} placeholder="아이디" style={{...S.inp,paddingLeft:14}}/></div></div>
                  <div style={S.fld}><label style={S.lbl}>등록 이메일</label><div style={S.ibox}><input value={forgotForm.email} onChange={e=>setForgotForm({...forgotForm,email:e.target.value})} placeholder="이메일" style={{...S.inp,paddingLeft:14}}/></div></div>
                  {forgotMsg&&<div style={S.errBox}><span>{forgotMsg}</span></div>}
                  <button type="submit" style={S.primBtn} disabled={loading}>{loading?<Spinner/>:"재설정 링크 발송"}</button>
                </form>
              ):(
                <div style={S.sucBox}>
                  <div style={S.sucIcon}><MailIcon/></div>
                  <p style={S.sucTitle}>이메일이 발송되었습니다</p>
                  <p style={S.sucDesc}>비밀번호 재설정 링크는 <strong>30분</strong> 동안 유효합니다.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// icons
const mk = (d,sz=16,col="#94A3B8")=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2">{d}</svg>;
const UserIcon=()=>mk(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>);
const LockIcon=()=>mk(<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>);
const EyeIcon=()=>mk(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>);
const EyeOffIcon=()=>mk(<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>);
const InfoIcon=({size=16,color="#94A3B8"})=>mk(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,size,color);
const MailIcon=()=>mk(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,28,"#2563EB");
const RegIcon=()=>mk(<><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></>,20,"#2563EB");
const LogoMark=()=><svg width="32" height="32" viewBox="0 0 36 36" fill="none"><rect x="0" y="0" width="16" height="16" rx="3" fill="#4F7FFF"/><rect x="20" y="0" width="16" height="16" rx="3" fill="#4F7FFF" opacity=".5"/><rect x="0" y="20" width="16" height="16" rx="3" fill="#4F7FFF" opacity=".3"/><rect x="20" y="20" width="16" height="16" rx="3" fill="#4F7FFF"/></svg>;
const Spinner=()=><span style={{width:17,height:17,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin .7s linear infinite"}}/>;

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
  heroTitle:{fontFamily:"'Noto Serif KR',serif",fontSize:46,fontWeight:700,color:"#F0F6FF",lineHeight:1.2,letterSpacing:"-1px"},
  heroDesc:{fontSize:15,color:"#7B91B0",lineHeight:1.8},
  stats:{display:"flex",gap:36,paddingTop:32,borderTop:"1px solid rgba(255,255,255,.07)"},
  stat:{display:"flex",flexDirection:"column",gap:3},
  statN:{fontSize:26,fontWeight:700,color:"#4F7FFF",letterSpacing:"-0.5px"},
  statL:{fontSize:12,color:"#7B91B0"},
  right:{width:480,background:"#F0F4FA",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 32px",animation:"fadeUp .7s .1s ease both"},
  card:{background:"#fff",borderRadius:18,padding:"40px 36px",width:"100%",boxShadow:"0 8px 48px rgba(0,0,0,.09)",border:"1px solid #E8EDF5"},
  cardTop:{marginBottom:28},
  cardTitle:{fontSize:22,fontWeight:700,color:"#0F172A",letterSpacing:"-0.4px",marginBottom:6},
  cardSub:{fontSize:13,color:"#64748B",lineHeight:1.6},
  form:{display:"flex",flexDirection:"column",gap:18},
  fld:{display:"flex",flexDirection:"column",gap:7},
  lbl:{fontSize:13,fontWeight:600,color:"#374151"},
  ibox:{display:"flex",alignItems:"center",background:"#F8FAFC",border:"1.5px solid #E2E8F0",borderRadius:10,position:"relative"},
  iicL:{position:"absolute",left:13,display:"flex",alignItems:"center",pointerEvents:"none"},
  inp:{width:"100%",padding:"12px 14px 12px 40px",background:"transparent",border:"none",outline:"none",fontSize:14,color:"#0F172A",fontFamily:"inherit"},
  eye:{position:"absolute",right:12,background:"none",border:"none",cursor:"pointer",display:"flex",padding:4},
  errBox:{display:"flex",alignItems:"center",gap:8,background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#DC2626"},
  primBtn:{width:"100%",padding:13,background:"linear-gradient(135deg,#1D4ED8,#4F7FFF)",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",marginTop:4,transition:"opacity .2s"},
  txLink:{background:"none",border:"none",color:"#4F7FFF",fontSize:13,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline",textUnderlineOffset:3},
  div:{display:"flex",alignItems:"center",gap:12,margin:"24px 0"},
  divLine:{flex:1,height:1,background:"#E8EDF5"},
  divTxt:{fontSize:12,color:"#94A3B8",whiteSpace:"nowrap"},
  regBox:{display:"flex",alignItems:"center",gap:14,background:"#EFF6FF",border:"1.5px solid #BFDBFE",borderRadius:12,padding:"16px 18px"},
  regIconWrap:{flexShrink:0},
  regText:{flex:1},
  regTitle:{fontSize:13,fontWeight:700,color:"#1D4ED8",marginBottom:2},
  regDesc:{fontSize:12,color:"#3B82F6",lineHeight:1.5},
  regBtn:{flexShrink:0,background:"#1D4ED8",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"},
  adminNote:{fontSize:11,color:"#CBD5E1",textAlign:"center",marginTop:20},
  backBtn:{background:"none",border:"none",color:"#64748B",fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:20,padding:0},
  sucBox:{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"24px 0"},
  sucIcon:{width:64,height:64,background:"#EFF6FF",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"},
  sucTitle:{fontSize:16,fontWeight:700,color:"#0F172A"},
  sucDesc:{fontSize:13,color:"#64748B",textAlign:"center",lineHeight:1.7},
};
