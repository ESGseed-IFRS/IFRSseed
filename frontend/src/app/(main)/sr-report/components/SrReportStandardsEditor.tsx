'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspacePerspective } from '@/components/workspace/WorkspacePerspectiveContext';
import { buildDashboardApprovalHref } from '@/app/(main)/dashboard/lib/dashboardApprovalLink';
import type { SrDpCard, SrDpStatus, SrApprovalDoc } from '../lib/types';

const C = {
  blue: { bg: '#e8f1fb', text: '#185fa5', border: 'rgba(24,95,165,0.25)' },
  green: { bg: '#eaf3de', text: '#3b6d11', border: 'rgba(59,109,17,0.25)' },
  amber: { bg: '#faeeda', text: '#854f0b', border: 'rgba(133,79,11,0.25)' },
  red: { bg: '#fcebeb', text: '#a32d2d', border: 'rgba(163,45,45,0.25)' },
  purple: { bg: '#eeedfe', text: '#534ab7', border: 'rgba(83,74,183,0.25)' },
  gray: { bg: '#f1efe8', text: '#5f5e5a', border: 'rgba(0,0,0,0.12)' },
};

const STD_C: Record<string, { bg: string; text: string; border: string }> = {
  GRI: C.blue,
  SASB: C.amber,
  TCFD: C.purple,
  ESRS: C.purple,
  IFRS: C.blue,
};

const CATEGORY_C: Record<SrDpCard['category'], { bg: string; text: string; border: string }> = {
  환경: C.green,
  사회: C.blue,
  지배구조: C.purple,
};

const getStatusBadge = (st: SrDpStatus) => {
  if (st === 'todo') return { bg: C.gray.bg, color: C.gray.text, label: '미작성' };
  if (st === 'wip') return { bg: C.amber.bg, color: C.amber.text, label: '작성중' };
  if (st === 'submitted') return { bg: C.blue.bg, color: C.blue.text, label: '제출완료' };
  if (st === 'approved') return { bg: C.green.bg, color: C.green.text, label: '승인완료' };
  return { bg: C.red.bg, color: C.red.text, label: '반려' };
};

const getGuideText = (stdCode: string) => {
  if (stdCode.startsWith('GRI 302')) return '재생에너지, 화석연료, 전력 등 에너지원별 소비량을 기재하세요. 단위는 TJ 또는 MWh로 통일합니다.';
  if (stdCode.startsWith('GRI 303')) return '취수원(지표수/지하수/빗물/해수)별 취수량을 구분하여 기재하세요. 물 스트레스 지역 여부도 명시합니다.';
  // ESRS E1 세부 데이터포인트(통합 DP) — 긴 접두사·접미사부터 매칭
  if (stdCode.includes('E1-6-44-a'))
    return 'ESRS E1-6-44-a: 보고기간 Scope 1 총 배출(tCO₂eq), 조직·시설 경계, 산정 방법(GHG Protocol 등), 전년 대비 변동 요인을 통합 서술하세요.';
  if (stdCode.includes('E1-6-44-b'))
    return 'ESRS E1-6-44-b: Scope 2 위치기반·시장기반(해당 시) 총 배출(tCO₂eq), 전력/열/스팀 등 에너지원별 요약, 계약·REC 등 시장기반 적용 시 근거를 통합 서술하세요.';
  if (stdCode.includes('E1-6-44-c'))
    return 'ESRS E1-6-44-c: Scope 3 총 배출(tCO₂eq), 주요 카테고리 기여도, 전년 대비 변동 및 재무·전략과의 연계를 통합 서술하세요.';
  if (stdCode.includes('E1-6-51'))
    return 'ESRS E1-6-51: Scope 3 각 배출 범주(카테고리)별 활동·산정 범위, 사용 데이터·배출계수 출처, 유의적 누락 여부를 표 또는 서술로 통합 공시하세요.';
  if (stdCode.includes('BP-2-10') || stdCode.includes('ESRS2-BP'))
    return 'ESRS 기반점(BP): 온실가스·가치사슬(Scope 3) 산정에 적용한 방법론, 가정, 한계, 검증·품질 관리, 기준년·재계산 정책을 통합 서술하세요.';
  if (stdCode.includes('MDR-A-68') || stdCode.includes('ESRS2-MDR-A-68'))
    return 'ESRS2-MDR-A-68-a: 기후·지속가능성과 연계된 주요 조치(액션)를 목록화하고, 조치별 예상 성과·지표·시간축을 제시하며, 해당 조치가 채택한 정책·목표·전략에 어떻게 기여하는지 논리적으로 연결해 서술하세요.';
  if (stdCode.includes('305-2-a'))
    return 'GRI 305-2-a: Scope 2 총 간접 배출(위치기반·시장기반 구분)을 tCO₂eq로 제시하고, 적용 배출계수·전력 믹스 출처를 명시하세요.';
  if (stdCode.includes('305-3-g'))
    return 'GRI 305-3-g: Scope 3 산정 방법론(활동자료·계수·품질 등급), 카테고리별 접근, 이중계상 방지 및 불확실성 관리 방식을 서술하세요.';
  if (stdCode.includes('305-3-d'))
    return 'GRI 305-3-d: Scope 3 범주별 활동 데이터(구매·물류·출장 등)와 산정 범위, 제외·추정 항목 및 근거를 구체적으로 기재하세요.';
  if (stdCode.includes('305-3-a'))
    return 'GRI 305-3-a: Scope 3 총 기타 간접 배출(tCO₂eq), 포함 카테고리 범위, 전년 대비 변동 요인을 제시하세요.';
  if (stdCode.includes('305-1-a'))
    return 'GRI 305-1-a: Scope 1 총 직접 배출량(가스·연료·공정 등)을 tCO₂eq로 제시하고, 생물권 제외 여부·GWP 기준(IPCC AR5/AR6)을 명시하세요.';
  if (stdCode.includes('IFRS2-29-a-i-1'))
    return 'IFRS S2 §29(a)(i)(1): Scope 1 총 배출이 기후 관련 위험·기회·목표·전략과 어떻게 연결되는지 서술하세요.';
  if (stdCode.includes('IFRS2-29-a-i-2'))
    return 'IFRS S2 §29(a)(i)(2): Scope 2 총 배출(위치·시장기반 구분)과 전략·목표·실적의 연계를 서술하세요.';
  if (stdCode.includes('IFRS2-29-a-i-3'))
    return 'IFRS S2 §29(a)(i)(3): Scope 3 총 배출과 가치사슬 기후 이슈·목표·실적의 연계를 서술하세요.';
  if (stdCode.includes('IFRS2-29-a-iii-1'))
    return 'IFRS S2 §29(a)(iii)(1): 온실가스·가치사슬 배출 산정에 사용한 방법·가정·한계를 투자자가 이해할 수 있게 설명하세요.';
  if (stdCode.includes('IFRS2-29-a-vi-1'))
    return 'IFRS S2 §29(a)(vi)(1): Scope 3 범주·활동별 정보가 의사결정에 어떻게 쓰이는지, 중요 범주 선정 근거를 서술하세요.';
  if (stdCode.includes('IFRS2-29') || stdCode.includes('S2-29'))
    return 'IFRS S2(기후 공시) 관련 항목에 맞춰, 배출량·방법론·전략 연계를 일관되게 기술하세요.';
  if (stdCode.startsWith('GRI 305')) return 'Scope 1(직접), Scope 2(간접), Scope 3(기타 간접) 배출량을 구분하여 tCO₂eq 단위로 기재합니다.';
  if (stdCode.startsWith('GRI 401')) return '성별, 연령대(30세 미만/30~50세/50세 이상)별 신규 채용 수 및 이직자 수를 기재합니다.';
  if (stdCode.startsWith('GRI 405')) return '이사회 구성원의 성별, 연령, 국적 다양성 지표를 기재합니다. 소수집단 구성원 수도 포함합니다.';
  if (stdCode.startsWith('GRI 403')) return '업무상 부상 건수, 재해율, 직업성 질환 건수를 기재합니다. 근로자와 도급업체 종사자를 구분합니다.';
  if (stdCode.startsWith('GRI 414')) return '인권 영향 평가를 실시한 공급업체 수 및 비율, 주요 우려 사항을 기재합니다.';
  if (stdCode.startsWith('TCFD')) return '물리적 리스크(급성·만성)와 전환 리스크(정책·기술·시장)를 시나리오 분석에 기반하여 기재합니다.';
  return '선택된 공시 기준에 맞춰 2024년도 데이터/현황을 자연스럽게 서술하세요.';
};

function Chip({ bg, color, children }: { bg: string; color: string; children: string }) {
  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 800,
        border: '0.5px solid rgba(0,0,0,0.08)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

type Props = {
  card: SrDpCard;
  approvals: SrApprovalDoc[];
  onSaveText: (dpId: string, text: string) => void;
  onSubmitText: (dpId: string, text: string) => void | Promise<void>;
  onBack: () => void;
};

export function SrReportStandardsEditor({ card, approvals, onSaveText, onSubmitText, onBack }: Props) {
  const router = useRouter();
  const { perspective } = useWorkspacePerspective();
  const [text, setText] = useState(card.savedText || '');
  const [activeStd, setActiveStd] = useState<string>(card.standards[0]?.code ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setText(card.savedText || '');
    setActiveStd(card.standards[0]?.code ?? '');
    setSubmitError(null);
  }, [card.id, card.savedText, card.standards]);

  const statusBadge = getStatusBadge(card.status);
  const isFrozen = card.status === 'approved';
  const showSubmitToApproval = card.status === 'submitted';
  const isRejected = card.status === 'rejected';
  const rejectedDoc = useMemo(() => approvals.find((a) => a.status === 'rejected') ?? null, [approvals]);

  const category = useMemo(() => CATEGORY_C[card.category] ?? CATEGORY_C['환경'], [card.category]);

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isDirty = text !== (card.savedText || '');

  const standards = card.standards;

  const showWipSubmit = card.status === 'wip';

  return (
    <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', background: '#f8f8f6' }}>
      <div
        style={{
          height: 56,
          background: '#fff',
          borderBottom: '0.5px solid rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          gap: 14,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 800,
            color: '#888780',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ← 돌아가기
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#b4b2a9', fontWeight: 800 }}>
            {card.deadline} · {card.category}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0c447c', lineHeight: 1.2 }}>{card.title}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              background: statusBadge.bg,
              color: statusBadge.color,
              border: '0.5px solid rgba(0,0,0,0.08)',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 900,
              whiteSpace: 'nowrap',
            }}
          >
            {statusBadge.label}
          </span>
          {!isFrozen ? (
            <>
              <button
                type="button"
                onClick={() => onSaveText(card.id, text)}
                style={{
                  fontSize: 12,
                  padding: '7px 14px',
                  borderRadius: 10,
                  border: '0.5px solid rgba(0,0,0,0.15)',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 900,
                  color: '#2c2c2a',
                  opacity: card.status === 'submitted' || isDirty ? 1 : 0.7,
                }}
              >
                {card.status === 'submitted'
                  ? '수정'
                  : card.status === 'todo'
                    ? '임시저장(작성중으로)'
                    : '임시저장'}
              </button>
              {showWipSubmit && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitError(null);
                    setSubmitting(true);
                    try {
                      await Promise.resolve(onSubmitText(card.id, text));
                    } catch (e) {
                      setSubmitError(e instanceof Error ? e.message : '제출에 실패했습니다.');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  style={{
                    fontSize: 12,
                    padding: '7px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: submitting ? '#94a3b8' : '#185fa5',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontWeight: 900,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {submitting ? '저장 중…' : '제출'}
                </button>
              )}
              {showSubmitToApproval && (
                <button
                  type="button"
                  onClick={() => {
                    router.push(
                      buildDashboardApprovalHref({
                        mode: perspective,
                        domain: 'sr',
                        menu: 'outbox.progress',
                        srDpId: card.id,
                      }),
                    );
                  }}
                  style={{
                    fontSize: 12,
                    padding: '7px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#0c447c',
                    cursor: 'pointer',
                    fontWeight: 900,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  결재 상신 →
                </button>
              )}
            </>
          ) : (
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: '#534ab7',
                background: '#eeedfe',
                border: '0.5px solid rgba(83,74,183,0.25)',
                padding: '7px 12px',
                borderRadius: 12,
                whiteSpace: 'nowrap',
              }}
            >
              승인 완료 · 수정 불가
            </div>
          )}
          </div>
          {submitError ? (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', maxWidth: 360, textAlign: 'right', lineHeight: 1.4 }}>
              {submitError}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ height: 'calc(100% - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {(isRejected || rejectedDoc?.rejReason) && (
          <div
            style={{
              background: C.red.bg,
              borderBottom: `0.5px solid ${C.red.border}`,
              color: C.red.text,
              padding: '10px 18px',
              fontSize: 12,
              fontWeight: 900,
              lineHeight: 1.5,
              flexShrink: 0,
            }}
          >
            반려됨 · 수정 후 대시보드에서 재상신하세요
            {rejectedDoc?.rejReason ? (
              <span style={{ display: 'block', marginTop: 4, fontSize: 11, fontWeight: 700, color: '#791f1f' }}>
                사유: {rejectedDoc.rejReason}
              </span>
            ) : null}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '260px 1fr 320px', gap: 0 }}>
          {/* 왼쪽: 연결된 공시 기준 + 작성 가이드 */}
          <div style={{ background: '#fff', borderRight: '0.5px solid rgba(0,0,0,0.08)', overflowY: 'auto' }}>
            <div style={{ padding: '14px 12px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#b4b2a9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                연결된 공시 기준
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {standards.map((s) => {
                  const sty = STD_C[s.type] ?? C.gray;
                  const active = s.code === activeStd;
                  return (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => setActiveStd(s.code)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: active ? `1px solid ${sty.text}` : '0.5px solid rgba(0,0,0,0.1)',
                        background: active ? sty.bg : '#fff',
                        transition: 'all 0.12s',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 900, color: active ? sty.text : '#2c2c2a', marginBottom: 3 }}>
                        {s.code}
                      </div>
                      <div style={{ fontSize: 11, color: '#888780' }}>{s.type} 기준 · 클릭하면 가이드</div>
                    </button>
                  );
                })}
              </div>

              <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '14px 0' }} />

              <div style={{ fontSize: 10, fontWeight: 900, color: '#b4b2a9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                작성 가이드 ({activeStd})
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#5f5e5a',
                  lineHeight: 1.7,
                  background: '#f5f4f0',
                  borderRadius: 8,
                  padding: '12px 12px',
                  border: '0.5px solid rgba(0,0,0,0.06)',
                }}
              >
                {getGuideText(activeStd)}
              </div>

              <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '14px 0' }} />

              <div style={{ fontSize: 10, fontWeight: 900, color: '#b4b2a9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                작성 현황
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 18 }}>
                {[
                  { label: '마감일', value: card.deadline },
                  { label: '담당자', value: card.assignee },
                  { label: '글자 수', value: `${charCount}자`, strong: charCount > 50 },
                  { label: '단어 수', value: `${wordCount}단어` },
                ].map((f) => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#b4b2a9', fontWeight: 800 }}>{f.label}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: f.strong ? '#3b6d11' : '#2c2c2a',
                      }}
                    >
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 가운데: 서술 편집 */}
          <div style={{ overflowY: 'auto', padding: 24, background: '#f8f8f6' }}>
            <div style={{ fontSize: 12, color: '#b4b2a9', marginBottom: 12 }}>
              {card.standards.map((s) => s.code).join(' · ')} 기준에 따른 2024년도 데이터를 자유롭게 서술하세요.
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`${card.title}에 대한 2024년도 데이터와 현황을 서술하세요.\n\n예시:\n- 정량 데이터 (수치, 단위)\n- 전년 대비 변화 및 원인\n- 특이사항 및 산정 방법론`}
              disabled={isFrozen}
              style={{
                width: '100%',
                height: 'calc(100% - 0px)',
                minHeight: 360,
                fontSize: 14,
                lineHeight: 1.85,
                padding: '16px 18px',
                borderRadius: 9,
                border: '0.5px solid rgba(0,0,0,0.15)',
                background: isFrozen ? '#f1f2ef' : '#fff',
                color: '#2c2c2a',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 오른쪽: 활동 이력 & 코멘트 */}
          <div style={{ background: '#fff', borderLeft: '0.5px solid rgba(0,0,0,0.1)', overflowY: 'auto', padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#b4b2a9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              활동 이력
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 18 }}>
              {[
                { date: '25.03.22', actor: '박지훈 대리', action: '데이터 입력 수정', color: '#5f5e5a' },
                { date: '25.03.20', actor: '연시은 차장', action: '검토 의견 등록', color: '#185fa5' },
                { date: '25.03.18', actor: '박지훈 대리', action: '최초 작성', color: '#5f5e5a' },
              ].map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 12, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: h.color, marginTop: 3 }} />
                    {i < 2 && <div style={{ width: 1, flex: 1, background: '#e8e6de', marginTop: 4 }} />}
                  </div>
                  <div style={{ paddingBottom: i < 2 ? 4 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#2c2c2a' }}>{h.action}</div>
                    <div style={{ fontSize: 11, color: '#b4b2a9', marginTop: 1 }}>
                      {h.actor} · {h.date}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '14px 0' }} />

            <div style={{ fontSize: 10, fontWeight: 900, color: '#b4b2a9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              코멘트
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {card.id === 'd8' && card.status === 'submitted' ? (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fcebeb', border: '0.5px solid rgba(163,45,45,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#a32d2d' }}>연시은 차장</span>
                    <span style={{ fontSize: 10, color: '#b4b2a9' }}>25.03.23</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#791f1f', lineHeight: 1.6 }}>
                    재해 분류 기준 근거 자료 추가 첨부 필요합니다. ILO 기준 적용 여부 명시 바랍니다.
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#d3d1c7', textAlign: 'center', padding: '14px 0' }}>등록된 코멘트가 없습니다</div>
              )}
            </div>

            <textarea
              placeholder="코멘트를 입력하세요..."
              rows={3}
              disabled
              style={{
                width: '100%',
                fontSize: 12,
                padding: '8px 10px',
                borderRadius: 7,
                border: '0.5px solid rgba(0,0,0,0.15)',
                background: '#fafaf8',
                color: '#2c2c2a',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                opacity: 0.7,
              }}
            />

            <div style={{ marginTop: 8, fontSize: 11, color: '#b4b2a9', lineHeight: 1.4 }}>
              코멘트 등록은 추후 결재함/승인 단계와 연동됩니다.
            </div>

            {/* v3의 approved 배너/기안 모달은 sr보고서 범위 제외 */}
            <div style={{ marginTop: 14 }}>
              <Chip bg={category.bg} color={category.text}>
                {card.category}
              </Chip>
            </div>

            {/* approvals는 1차에서는 읽기 전용으로만 사용 */}
            <div style={{ marginTop: 10, fontSize: 11, color: '#b4b2a9', lineHeight: 1.5 }}>
              제출 문서 관련 상태는 대시보드 결재함에서 확인하세요. (관련 문서 {approvals.length}건)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

