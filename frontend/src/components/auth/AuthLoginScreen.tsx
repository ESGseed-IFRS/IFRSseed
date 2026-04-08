'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AuthSessionUser } from '@/store/authSessionStore';
import { useAuthSessionStore } from '@/store/authSessionStore';
import type { CSSProperties } from 'react';
import {
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  LockIcon,
  LogoMark,
  MailIcon,
  RegIcon,
  Spinner,
  UserIcon,
} from '@/components/auth/icons';

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
    fontSize: 46,
    fontWeight: 700,
    color: '#F0F6FF',
    lineHeight: 1.2,
    letterSpacing: '-1px',
  },
  heroDesc: { fontSize: 15, color: '#7B91B0', lineHeight: 1.8 },
  stats: { display: 'flex', gap: 36, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,.07)' },
  stat: { display: 'flex', flexDirection: 'column', gap: 3 },
  statN: { fontSize: 26, fontWeight: 700, color: '#4F7FFF', letterSpacing: '-0.5px' },
  statL: { fontSize: 12, color: '#7B91B0' },
  right: {
    flex: '1 1 50%',
    minWidth: 0,
    background: '#F0F4FA',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 32px',
    animation: 'authFadeUp .7s .1s ease both',
  },
  card: {
    background: '#fff',
    borderRadius: 18,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 8px 48px rgba(0,0,0,.09)',
    border: '1px solid #E8EDF5',
  },
  cardTop: { marginBottom: 28 },
  cardTitle: { fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.4px', marginBottom: 6 },
  cardSub: { fontSize: 13, color: '#64748B', lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  fld: { display: 'flex', flexDirection: 'column', gap: 7 },
  lbl: { fontSize: 13, fontWeight: 600, color: '#374151' },
  ibox: {
    display: 'flex',
    alignItems: 'center',
    background: '#F8FAFC',
    border: '1.5px solid #E2E8F0',
    borderRadius: 10,
    position: 'relative',
  },
  iicL: { position: 'absolute', left: 13, display: 'flex', alignItems: 'center', pointerEvents: 'none' },
  inp: {
    width: '100%',
    padding: '12px 14px 12px 40px',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'inherit',
  },
  eye: { position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 },
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
    marginTop: 4,
    transition: 'opacity .2s',
  },
  txLink: {
    background: 'none',
    border: 'none',
    color: '#4F7FFF',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  div: { display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' },
  divLine: { flex: 1, height: 1, background: '#E8EDF5' },
  divTxt: { fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' },
  regBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    background: '#EFF6FF',
    border: '1.5px solid #BFDBFE',
    borderRadius: 12,
    padding: '16px 18px',
  },
  regIconWrap: { flexShrink: 0 },
  regText: { flex: 1 },
  regTitle: { fontSize: 13, fontWeight: 700, color: '#1D4ED8', marginBottom: 2 },
  regDesc: { fontSize: 12, color: '#3B82F6', lineHeight: 1.5 },
  regBtn: {
    flexShrink: 0,
    background: '#1D4ED8',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  adminNote: { fontSize: 11, color: '#CBD5E1', textAlign: 'center', marginTop: 20 },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: 20,
    padding: 0,
  },
  sucBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '24px 0' },
  sucIcon: {
    width: 64,
    height: 64,
    background: '#EFF6FF',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sucTitle: { fontSize: 16, fontWeight: 700, color: '#0F172A' },
  sucDesc: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 1.7 },
};

export function AuthLoginScreen() {
  const router = useRouter();
  const [form, setForm] = useState({ loginId: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotForm, setForgotForm] = useState({ loginId: '', email: '' });
  const [forgotMsg, setForgotMsg] = useState('');
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:9001';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.loginId || !form.email || !form.password) {
      setError('아이디, 이메일, 비밀번호를 모두 입력해주세요.');
      return;
    }
    if (!emailPattern.test(form.email)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // HttpOnly 쿠키 수신
        body: JSON.stringify({
          loginId: form.loginId.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      if (!response.ok) {
        const next = failCount + 1;
        setFailCount(next);
        const message =
          next >= 5
            ? '로그인 시도 5회 초과로 30분간 계정이 잠겼습니다.'
            : `아이디, 이메일 또는 비밀번호가 올바르지 않습니다. (${next}/5)`;
        setError(message);
        return;
      }

      const data = await response.json();
      if (data?.user) {
        useAuthSessionStore.getState().setUser(data.user as AuthSessionUser);
      }
      router.push('/dashboard');
    } catch {
      setError('로그인 요청에 실패했습니다. 서버 연결 상태를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotForm.loginId || !forgotForm.email) {
      setForgotMsg('모두 입력해주세요.');
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setForgotStep(2);
  };

  return (
    <div style={S.root} className="auth-split-root">
      <div style={S.left} className="auth-split-left">
        <div style={S.leftGlow} />
        <div style={S.leftContent} className="auth-split-leftContent">
          <div style={S.logo}>
            <LogoMark />
            <div>
              <div style={S.logoName}>ESGseed</div>
              <div style={S.logoSub}>지속가능한 미래를 위한
              스마트 보고서 플랫폼</div>
            </div>
          </div>
          <div style={S.heroBlock}>
            <div style={S.eyebrow}>그룹사 전용 보고서 시스템</div>
            <h1 style={S.heroTitle}>
              IFRSseed
            </h1>
            <p style={S.heroDesc}>
              계열사별 ESG·재무 데이터를 통합 관리하고
              <br />
              지주사와 실시간으로 공유하세요.
            </p>
          </div>
          <div style={S.stats}>
            {[
              ['12', '계열사'],
              ['48', '보고서'],
              ['2024', '기준연도'],
            ].map(([n, l]) => (
              <div key={l} style={S.stat}>
                <span style={S.statN}>{n}</span>
                <span style={S.statL}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={S.right} className="auth-split-right">
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
                    <span style={S.iicL}>
                      <UserIcon />
                    </span>
                    <input
                      value={form.loginId}
                      onChange={(e) => {
                        setForm({ ...form, loginId: e.target.value });
                        setError('');
                      }}
                      placeholder="법인 아이디 입력"
                      style={S.inp}
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div style={S.fld}>
                  <label style={S.lbl}>비밀번호</label>
                  <div style={S.ibox}>
                    <span style={S.iicL}>
                      <LockIcon />
                    </span>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => {
                        setForm({ ...form, password: e.target.value });
                        setError('');
                      }}
                      placeholder="비밀번호 입력"
                      style={S.inp}
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={S.eye}>
                      {showPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div style={S.fld}>
                  <label style={S.lbl}>이메일</label>
                  <div style={S.ibox}>
                    <span style={S.iicL}>
                      <MailIcon />
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => {
                        setForm({ ...form, email: e.target.value });
                        setError('');
                      }}
                      placeholder="개인 이메일 입력"
                      style={S.inp}
                      autoComplete="email"
                    />
                  </div>
                </div>
                {error && (
                  <div style={S.errBox}>
                    <InfoIcon size={14} color="#DC2626" />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  type="submit"
                  style={{ ...S.primBtn, opacity: loading ? 0.7 : 1 }}
                  disabled={loading}
                >
                  {loading ? <Spinner /> : '로그인'}
                </button>
                <button type="button" onClick={() => setShowForgot(true)} style={S.txLink}>
                  비밀번호를 잊으셨나요?
                </button>
              </form>

              <div style={S.div}>
                <div style={S.divLine} />
                <span style={S.divTxt}>또는</span>
                <div style={S.divLine} />
              </div>

              <div style={S.regBox}>
                <div style={S.regIconWrap}>
                  <RegIcon />
                </div>
                <div style={S.regText}>
                  <p style={S.regTitle}>계정이 없으신가요?</p>
                  <p style={S.regDesc}>
                    <strong>법인 관리자 아이디·비밀번호</strong>로 확인 후 서브계정을 등록하세요
                  </p>
                </div>
                <button type="button" style={S.regBtn} onClick={() => router.push('/register')}>
                  계정 등록 →
                </button>
              </div>

              <p style={S.adminNote}>데모: master / 1234 · 관리자 /admin</p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowForgot(false);
                  setForgotStep(1);
                  setForgotMsg('');
                }}
                style={S.backBtn}
              >
                ← 돌아가기
              </button>
              <div style={S.cardTop}>
                <h2 style={S.cardTitle}>비밀번호 찾기</h2>
                <p style={S.cardSub}>가입 시 등록한 이메일로 재설정 링크를 보내드립니다</p>
              </div>
              {forgotStep === 1 ? (
                <form onSubmit={handleForgot} style={S.form}>
                  <div style={S.fld}>
                    <label style={S.lbl}>아이디</label>
                    <div style={S.ibox}>
                      <input
                        value={forgotForm.loginId}
                        onChange={(e) => setForgotForm({ ...forgotForm, loginId: e.target.value })}
                        placeholder="아이디"
                        style={{ ...S.inp, paddingLeft: 14 }}
                      />
                    </div>
                  </div>
                  <div style={S.fld}>
                    <label style={S.lbl}>등록 이메일</label>
                    <div style={S.ibox}>
                      <input
                        value={forgotForm.email}
                        onChange={(e) => setForgotForm({ ...forgotForm, email: e.target.value })}
                        placeholder="이메일"
                        style={{ ...S.inp, paddingLeft: 14 }}
                      />
                    </div>
                  </div>
                  {forgotMsg && (
                    <div style={S.errBox}>
                      <span>{forgotMsg}</span>
                    </div>
                  )}
                  <button type="submit" style={S.primBtn} disabled={loading}>
                    {loading ? <Spinner /> : '재설정 링크 발송'}
                  </button>
                </form>
              ) : (
                <div style={S.sucBox}>
                  <div style={S.sucIcon}>
                    <MailIcon size={28} color="#2563EB" />
                  </div>
                  <p style={S.sucTitle}>이메일이 발송되었습니다</p>
                  <p style={S.sucDesc}>
                    비밀번호 재설정 링크는 <strong>30분</strong> 동안 유효합니다.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
