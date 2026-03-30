'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  BuildingIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  LockIcon,
  LogoMark,
  Spinner,
  UserIcon,
} from '@/components/auth/icons';

const ROLES = [
  { key: 'writer', label: '작성자', desc: '보고서 작성 및 데이터 입력', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'reviewer', label: '검토자', desc: '보고서 검토 및 승인 요청', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { key: 'viewer', label: '조회 전용', desc: '보고서 열람만 가능', color: '#475569', bg: '#F8FAFC', border: '#CBD5E1' },
] as const;

const STEPS = ['법인 확인', '정보 입력', '가입 완료'];

const S: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    width: '100%',
    minHeight: '100vh',
    fontFamily: "'Apple SD Gothic Neo',system-ui,sans-serif",
    background: '#0A0F1E',
  },
  left: { flex: '1 1 50%', minWidth: 0, position: 'relative', overflow: 'hidden' },
  leftGlow: {
    position: 'absolute',
    top: '30%',
    left: '20%',
    width: 400,
    height: 400,
    borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(79,127,255,.12) 0%,transparent 70%)',
    zIndex: 0,
  },
  leftContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '52px 56px',
    height: '100%',
    minHeight: '100vh',
    background: 'linear-gradient(140deg,#0D1B3E 0%,#0A0F1E 100%)',
    backgroundImage:
      'linear-gradient(rgba(79,127,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(79,127,255,.05) 1px,transparent 1px)',
    backgroundSize: '40px 40px',
    animation: 'authFadeUp .7s ease both',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 12 },
  logoName: { fontSize: 18, fontWeight: 700, color: '#F0F6FF' },
  logoSub: { fontSize: 11, color: '#4F7FFF', marginTop: 2 },
  heroBlock: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 },
  eyebrow: {
    fontSize: 11,
    fontWeight: 600,
    color: '#4F7FFF',
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    border: '1px solid rgba(79,127,255,.3)',
    borderRadius: 4,
    padding: '4px 10px',
    width: 'fit-content',
  },
  heroTitle: {
    fontFamily: "'Noto Serif KR',serif",
    fontSize: 38,
    fontWeight: 700,
    color: '#F0F6FF',
    lineHeight: 1.25,
    letterSpacing: '-0.8px',
  },
  heroDesc: { fontSize: 14, color: '#7B91B0', lineHeight: 1.85 },
  flowGuide: { display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,.07)' },
  flowItem: { display: 'flex', alignItems: 'flex-start', gap: 14 },
  flowN: { fontSize: 11, fontWeight: 700, color: '#4F7FFF', letterSpacing: '.05em', minWidth: 24, marginTop: 1 },
  flowT: { fontSize: 13, fontWeight: 600, color: '#E2E8F0', marginBottom: 2 },
  flowD: { fontSize: 12, color: '#7B91B0' },

  right: {
    flex: '1 1 50%',
    minWidth: 0,
    background: '#F0F4FA',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 32px',
    animation: 'authFadeUp .7s .1s ease both',
    gap: 16,
  },
  stepBar: { display: 'flex', alignItems: 'center', width: '100%', maxWidth: 440 },
  stepItem: { display: 'flex', alignItems: 'center', gap: 8, flex: 1 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepLine: { flex: 1, height: 2, margin: '0 4px', transition: 'background .3s' },

  card: {
    background: '#fff',
    borderRadius: 18,
    padding: '36px 36px',
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 8px 48px rgba(0,0,0,.09)',
    border: '1px solid #E8EDF5',
  },
  cardTop: { marginBottom: 24 },
  cardTitle: { fontSize: 20, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.4px', marginBottom: 5 },
  cardSub: { fontSize: 13, color: '#64748B', lineHeight: 1.6 },

  gateHint: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    background: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 12,
    color: '#1D4ED8',
    lineHeight: 1.6,
  },
  gateForm: { display: 'flex', flexDirection: 'column', gap: 18, margin: '4px 0 8px' },
  ibox: {
    display: 'flex',
    alignItems: 'center',
    background: '#F8FAFC',
    border: '1.5px solid #E2E8F0',
    borderRadius: 10,
    position: 'relative',
  },
  iicL: { position: 'absolute', left: 13, display: 'flex', alignItems: 'center', pointerEvents: 'none' },
  inpGate: {
    width: '100%',
    padding: '12px 14px 12px 40px',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'inherit',
  },
  eyeGate: { position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 },
  errBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: '#DC2626',
  },
  companyBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#F0FDF4',
    border: '1.5px solid #BBF7D0',
    borderRadius: 10,
    padding: '12px 16px',
  },
  companyName: { fontSize: 14, fontWeight: 700, color: '#15803D' },
  companyCode: { fontSize: 11, color: '#4ADE80', marginTop: 1 },
  companyCheck: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#22C55E',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    color: '#fff',
    flexShrink: 0,
  },

  fld: { display: 'flex', flexDirection: 'column', gap: 7 },
  lbl: { fontSize: 13, fontWeight: 600, color: '#374151' },
  inp2: {
    padding: '11px 14px',
    background: '#F8FAFC',
    border: '1.5px solid #E2E8F0',
    borderRadius: 10,
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  inpErr: { borderColor: '#FCA5A5', background: '#FFF5F5' },
  errTxt: { fontSize: 12, color: '#EF4444' },
  helper: { fontSize: 12, color: '#94A3B8' },
  helper2: { fontSize: 12, color: '#64748B', marginBottom: 4 },

  pwWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  eyeAbs: { position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 },
  pwStr: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 },
  pwBar: { display: 'flex', gap: 4, flex: 1 },
  pwSeg: { height: 4, flex: 1, borderRadius: 2, transition: 'background .3s' },

  roleGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 4 },
  roleCard: {
    border: '1.5px solid #E2E8F0',
    borderRadius: 10,
    padding: '12px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    position: 'relative',
    transition: 'all .15s',
  },
  roleChk: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },

  primBtn: {
    width: '100%',
    padding: 13,
    background: 'linear-gradient(135deg,#1D4ED8,#4F7FFF)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    transition: 'opacity .2s',
  },
  secBtn: {
    padding: '13px 20px',
    background: '#F1F5F9',
    border: '1.5px solid #E2E8F0',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: '#64748B',
  },
  txLink2: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center',
    marginTop: 12,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },

  doneCircle: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: '#F0FDF4',
    border: '2px solid #BBF7D0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#FFFBEB',
    border: '1px solid #FDE68A',
    borderRadius: 10,
    padding: '12px 16px',
    width: '100%',
  },
};

function Req() {
  return <span style={{ color: '#EF4444' }}>*</span>;
}

function Row({
  label,
  req,
  err,
  helper,
  helper2,
  children,
}: {
  label: string;
  req?: boolean;
  err?: string;
  helper?: string;
  helper2?: string;
  children: ReactNode;
}) {
  return (
    <div style={S.fld}>
      <label style={S.lbl}>
        {label} {req && <Req />}
      </label>
      {helper2 && <p style={S.helper2}>{helper2}</p>}
      {children}
      {helper && !err && <span style={S.helper}>{helper}</span>}
      {err && <span style={S.errTxt}>{err}</span>}
    </div>
  );
}

export function AuthRegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [gateForm, setGateForm] = useState({ loginId: '', password: '' });
  const [gateErr, setGateErr] = useState('');
  const [showGatePw, setShowGatePw] = useState(false);
  /** 서버 연동 시 POST /api/auth/register 페이로드에 포함 (httpOnly 쿠키면 생략 가능) */
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [company, setCompany] = useState<{ name: string; code: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    loginId: '',
    password: '',
    passwordConfirm: '',
    role: '' as '' | (typeof ROLES)[number]['key'],
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const verifyCorporate = async () => {
    if (!gateForm.loginId.trim() || !gateForm.password) {
      setGateErr('법인 아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    setGateErr('');
    await new Promise((r) => setTimeout(r, 900));
    setLoading(false);
    if (gateForm.loginId === 'master' && gateForm.password === '1234') {
      setCompany({ name: '(주)계열사A', code: 'SUB-001' });
      setRegistrationToken('mock-registration-token');
      setStep(1);
    } else {
      setGateErr('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = '이름을 입력해주세요.';
    if (!form.email.trim()) e.email = '이메일을 입력해주세요.';
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = '올바른 이메일 형식이 아닙니다.';
    if (!form.loginId.trim()) e.loginId = '아이디를 입력해주세요.';
    else if (form.loginId.length < 4) e.loginId = '아이디는 4자 이상이어야 합니다.';
    if (!form.password) e.password = '비밀번호를 입력해주세요.';
    else if (form.password.length < 8) e.password = '비밀번호는 8자 이상이어야 합니다.';
    if (form.password !== form.passwordConfirm) e.passwordConfirm = '비밀번호가 일치하지 않습니다.';
    if (!form.role) e.role = '권한을 선택해주세요.';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrs(e);
      return;
    }
    if (!registrationToken) {
      setStep(0);
      setGateErr('세션이 만료되었습니다. 법인 확인부터 다시 진행해주세요.');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setStep(2);
  };

  const f = (k: keyof typeof form, v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setErrs((prev) => ({ ...prev, [k]: '' }));
  };

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
  const pwLabel = ['', '약함', '보통', '강함', '매우 강함'][pwStrength];
  const pwColor = ['', '#EF4444', '#F59E0B', '#22C55E', '#2563EB'][pwStrength];

  const goLogin = () => router.push('/login');

  return (
    <div style={S.root} className="auth-split-root">
      <div style={S.left} className="auth-split-left">
        <div style={S.leftGlow} />
        <div style={S.leftContent} className="auth-split-leftContent">
          <div style={S.logo}>
            <LogoMark />
            <div>
              <div style={S.logoName}>ESGseed</div>
              <div style={S.logoSub}>지속가능경영보고서 작성 플랫폼</div>
            </div>
          </div>
          <div style={S.heroBlock}>
            <div style={S.eyebrow}>서브 계정 등록</div>
            <h1 style={S.heroTitle}>
              담당자 계정을
              <br />
              직접 등록하세요
            </h1>
            <p style={S.heroDesc}>
              서브계정 등록을 위해 <strong style={{ color: '#E2E8F0' }}>법인 관리자 계정</strong>으로 먼저 확인하세요.
              <br />
              확인 후 담당자 정보와 비밀번호를 설정합니다.
              <br />
              마스터 승인 후 즉시 사용 가능합니다.
            </p>
          </div>
          <div style={S.flowGuide}>
            {[
              { n: '01', t: '법인 확인', d: '관리자 아이디·비밀번호로 법인 연결' },
              { n: '02', t: '정보 입력', d: '이름, 이메일, 비밀번호 설정' },
              { n: '03', t: '승인 대기', d: '마스터 계정 승인 후 활성화' },
            ].map((item) => (
              <div key={item.n} style={S.flowItem}>
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

      <div style={S.right} className="auth-split-right">
        <div style={S.stepBar}>
          {STEPS.map((label, i) => (
            <div key={label} style={S.stepItem}>
              <div
                style={{
                  ...S.stepCircle,
                  background: i < step ? '#22C55E' : i === step ? '#1D4ED8' : '#E2E8F0',
                  color: i <= step ? '#fff' : '#94A3B8',
                }}
              >
                {i < step ? <CheckIcon size={12} /> : <span style={{ fontSize: 12, fontWeight: 700 }}>{i + 1}</span>}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: i === step ? '#0F172A' : i < step ? '#22C55E' : '#94A3B8',
                }}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div style={{ ...S.stepLine, background: i < step ? '#22C55E' : '#E2E8F0' }} />
              )}
            </div>
          ))}
        </div>

        <div style={S.card}>
          {step === 0 && (
            <div style={{ animation: 'authSlideIn .3s ease' }}>
              <div style={S.cardTop}>
                <h2 style={S.cardTitle}>법인 계정 확인</h2>
                <p style={S.cardSub}>
                  서브계정 등록을 위해 법인(마스터) 관리자 계정으로 확인합니다. 발급 정보는 지주사·관리자에게 문의하세요.
                </p>
              </div>
              <div style={S.gateForm}>
                <div style={S.fld}>
                  <label style={S.lbl}>
                    법인 아이디 <Req />
                  </label>
                  <div style={S.ibox}>
                    <span style={S.iicL}>
                      <UserIcon />
                    </span>
                    <input
                      value={gateForm.loginId}
                      onChange={(e) => {
                        setGateForm({ ...gateForm, loginId: e.target.value });
                        setGateErr('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && void verifyCorporate()}
                      placeholder="법인 관리자 아이디"
                      style={S.inpGate}
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div style={S.fld}>
                  <label style={S.lbl}>
                    비밀번호 <Req />
                  </label>
                  <div style={S.ibox}>
                    <span style={S.iicL}>
                      <LockIcon />
                    </span>
                    <input
                      type={showGatePw ? 'text' : 'password'}
                      value={gateForm.password}
                      onChange={(e) => {
                        setGateForm({ ...gateForm, password: e.target.value });
                        setGateErr('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && void verifyCorporate()}
                      placeholder="비밀번호 입력"
                      style={S.inpGate}
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowGatePw(!showGatePw)} style={S.eyeGate}>
                      {showGatePw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                {gateErr && (
                  <div style={S.errBox}>
                    <InfoIcon size={14} color="#DC2626" />
                    <span>{gateErr}</span>
                  </div>
                )}
                <span style={S.helper}>데모: 로그인과 동일 — master / 1234</span>
              </div>
              <button
                type="button"
                style={{ ...S.primBtn, opacity: loading ? 0.7 : 1, marginTop: 8 }}
                onClick={() => void verifyCorporate()}
                disabled={loading}
              >
                {loading ? <Spinner /> : '확인 후 계속'}
              </button>
              <button type="button" style={S.txLink2} onClick={goLogin}>
                ← 로그인으로 돌아가기
              </button>
            </div>
          )}

          {step === 1 && (
            <div style={{ animation: 'authSlideIn .3s ease' }}>
              <div style={S.cardTop}>
                <h2 style={S.cardTitle}>담당자 정보 입력</h2>
                <p style={S.cardSub}>가입 정보와 비밀번호를 직접 설정하세요</p>
              </div>

              <div style={S.companyBadge}>
                <BuildingIcon />
                <div>
                  <p style={S.companyName}>{company?.name}</p>
                  <p style={S.companyCode}>법인코드: {company?.code}</p>
                </div>
                <span style={S.companyCheck}>
                  <CheckIcon size={10} />
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
                <Row label="이름" req err={errs.name}>
                  <input
                    value={form.name}
                    onChange={(e) => f('name', e.target.value)}
                    placeholder="홍길동"
                    style={{ ...S.inp2, ...(errs.name ? S.inpErr : {}) }}
                  />
                </Row>

                <Row label="이메일" req err={errs.email}>
                  <input
                    value={form.email}
                    onChange={(e) => f('email', e.target.value)}
                    placeholder="example@company.com"
                    style={{ ...S.inp2, ...(errs.email ? S.inpErr : {}) }}
                  />
                </Row>

                <Row label="사용할 아이디" req err={errs.loginId} helper="영문/숫자 4자 이상">
                  <input
                    value={form.loginId}
                    onChange={(e) =>
                      f('loginId', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    placeholder="my_id"
                    style={{ ...S.inp2, ...(errs.loginId ? S.inpErr : {}) }}
                  />
                </Row>

                <Row label="비밀번호" req err={errs.password}>
                  <div style={S.pwWrap}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => f('password', e.target.value)}
                      placeholder="8자 이상 입력"
                      style={{ ...S.inp2, ...(errs.password ? S.inpErr : {}) }}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={S.eyeAbs}>
                      {showPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {form.password && (
                    <div style={S.pwStr}>
                      <div style={S.pwBar}>
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} style={{ ...S.pwSeg, background: i <= pwStrength ? pwColor : '#E2E8F0' }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: pwColor, fontWeight: 600 }}>{pwLabel}</span>
                    </div>
                  )}
                </Row>

                <Row label="비밀번호 확인" req err={errs.passwordConfirm}>
                  <div style={S.pwWrap}>
                    <input
                      type={showPw2 ? 'text' : 'password'}
                      value={form.passwordConfirm}
                      onChange={(e) => f('passwordConfirm', e.target.value)}
                      placeholder="비밀번호 재입력"
                      style={{ ...S.inp2, ...(errs.passwordConfirm ? S.inpErr : {}) }}
                    />
                    <button type="button" onClick={() => setShowPw2(!showPw2)} style={S.eyeAbs}>
                      {showPw2 ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </Row>

                <div style={S.fld}>
                  <label style={S.lbl}>
                    권한 선택 <Req />
                  </label>
                  <p style={S.helper2}>마스터 승인 시 조정될 수 있습니다</p>
                  <div style={S.roleGrid}>
                    {ROLES.map((r) => (
                      <div
                        key={r.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => f('role', r.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            f('role', r.key);
                          }
                        }}
                        style={{
                          ...S.roleCard,
                          borderColor: form.role === r.key ? r.color : errs.role ? '#FCA5A5' : '#E2E8F0',
                          background: form.role === r.key ? r.bg : '#fff',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: form.role === r.key ? r.color : '#374151' }}>
                            {r.label}
                          </span>
                          {form.role === r.key && (
                            <span style={{ ...S.roleChk, background: r.color }}>
                              <CheckIcon size={9} />
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.5 }}>{r.desc}</span>
                      </div>
                    ))}
                  </div>
                  {errs.role && <span style={S.errTxt}>{errs.role}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  style={S.secBtn}
                  onClick={() => {
                    setStep(0);
                    setGateForm({ loginId: '', password: '' });
                    setRegistrationToken(null);
                    setGateErr('');
                    setShowGatePw(false);
                  }}
                >
                  ← 이전
                </button>
                <button
                  type="button"
                  style={{ ...S.primBtn, flex: 2, opacity: loading ? 0.7 : 1, marginTop: 0 }}
                  onClick={() => void handleSubmit()}
                  disabled={loading}
                >
                  {loading ? <Spinner /> : '가입 신청'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div
              style={{
                animation: 'authSlideIn .3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '16px 0',
                gap: 16,
              }}
            >
              <div style={S.doneCircle}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>가입 신청 완료!</h3>
              <p style={{ fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 1.8 }}>
                <strong>{company?.name}</strong>의 마스터 계정 담당자가
                <br />
                가입 신청을 검토 후 승인합니다.
                <br />
                승인되면 <strong>{form.email}</strong>로 안내 메일이 발송됩니다.
              </p>
              <div style={S.pendingBox}>
                <ClockIcon />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>승인 대기 중</p>
                  <p style={{ fontSize: 12, color: '#B45309' }}>보통 1영업일 이내에 처리됩니다</p>
                </div>
              </div>
              <button type="button" style={{ ...S.primBtn, width: '100%', marginTop: 8 }} onClick={goLogin}>
                로그인 화면으로 →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
