'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useDashboardStore } from '@/store/dashboardStore';
import { useDashboardStatus } from '@/hooks/useDashboardStatus';

/** dashboard-mockup.jsx 기반 대시보드 — 아이콘 없이 텍스트·배지 중심 */

const PAGE_CARDS = [
  { key: 'companyInfo' as const, label: '회사정보', assignee: '홍길동' },
  { key: 'ghg' as const, label: 'GHG 산정', assignee: '이영희' },
  { key: 'sr' as const, label: 'SR 작성', assignee: '김철수' },
  { key: 'charts' as const, label: '도표 생성', assignee: '박민수' },
];

const STATUS_CONFIG = {
  completed: { label: '완료', color: '#16a34a', bg: '#dcfce7', icon: '✓' },
  'in-progress': { label: '진행중', color: '#d97706', bg: '#fef3c7', icon: '◐' },
  pending: { label: '대기', color: '#9ca3af', bg: '#f3f4f6', icon: '○' },
} as const;

const REPORT_SECTIONS = [
  { id: 'company', title: '회사정보' },
  { id: 'strategy', title: '지속가능경영 전략' },
  { id: 'environmental', title: '환경 성과' },
  { id: 'social', title: '사회적 책임' },
  { id: 'governance', title: '지배구조' },
  { id: 'performance', title: '성과 지표' },
  { id: 'future', title: '향후 계획' },
];

const TEAM_MEMBERS = [
  { name: '홍길동', dept: '환경안전팀', page: 'GHG 산정', status: 'active' as const, percent: 0 },
  { name: '이영희', dept: 'ESG팀', page: 'SR 작성', status: 'active' as const, percent: 0 },
  { name: '김철수', dept: '인사팀', page: '도표 생성', status: 'pending' as const, percent: 0 },
];

const FEEDBACKS = [
  { type: 'rejected' as const, section: 'GHG 산정', message: 'Scope 3 활동자료 보완이 필요합니다.', time: '3시간 전' },
  { type: 'approved' as const, section: '회사정보', message: '승인 완료되었습니다.', time: '어제' },
];

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 60) return `${min}분 전`;
  if (hour < 24) return `${hour}시간 전`;
  return `${day}일 전`;
}

export default function DashboardPage() {
  const [isPending, startTransition] = useTransition();
  const role = useDashboardStore((s) => s.role);

  const handleRoleChange = (r: 'MANAGER' | 'MEMBER') => {
    startTransition(() => {
      useDashboardStore.getState().setRole(r);
    });
  };

  const status = useDashboardStatus();
  const deadline = useDashboardStore((s) => s.deadline);
  const finalApproved = useDashboardStore((s) => s.finalApproved);
  const setRole = useDashboardStore((s) => s.setRole);
  const setDeadline = useDashboardStore((s) => s.setDeadline);
  const setFinalApproved = useDashboardStore((s) => s.setFinalApproved);
  const activityLog = useDashboardStore((s) => s.activityLog);
  const pendingApprovals = useDashboardStore((s) => s.pendingApprovals);

  const visibleActionItems = status.actionItems;

  const allScorecardMet = status.scorecardItems.every((s) => s.met);
  const dDay = deadline ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000) : null;

  const fallbackLog = [
    { id: '1', userName: '홍길동', action: 'GHG 산정 활동자료 저장', timestamp: Date.now() - 7200000 },
    { id: '2', userName: '이영희', action: 'SR 작성 페이지 접속', timestamp: Date.now() - 86400000 },
    { id: '3', userName: '홍길동', action: 'GHG Scope 1 데이터 입력', timestamp: Date.now() - 259200000 },
    { id: '4', userName: '김철수', action: '도표 생성 페이지 접속', timestamp: Date.now() - 259200000 },
  ];
  const rawLog = activityLog.length > 0 ? activityLog : fallbackLog;
  const displayLog = rawLog.slice(0, 10);

  return (
    <div className="min-h-screen bg-[#f4f6f4] text-[#1a1a1a] font-['Pretendard','Apple_SD_Gothic_Neo',sans-serif]">
      <div className="max-w-[1160px] mx-auto px-6 py-8">
        {/* 헤더 */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-2xl font-extrabold m-0">대시보드</h1>
              <span
                className="px-3 py-1 rounded-full text-[11px] font-bold"
                style={{
                  background: role === 'MANAGER' ? '#dcfce7' : '#dbeafe',
                  color: role === 'MANAGER' ? '#15803d' : '#1d4ed8',
                }}
              >
                {role === 'MANAGER' ? '팀장' : '팀원'}
              </span>
            </div>
            <p className="text-[13px] text-[#6b7280] m-0">
              ESG 보고서 작성 현황을 한눈에 확인하고, 필요한 작업을 빠르게 진행하세요
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#6b7280]">역할 미리보기:</span>
            {(['MANAGER', 'MEMBER'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleChange(r)}
                disabled={isPending}
                className="px-4 py-1.5 rounded-full text-xs font-bold border-none cursor-pointer transition-all disabled:opacity-70 disabled:cursor-wait"
                style={{
                  background: role === r ? '#16a34a' : '#2d3d2d',
                  color: role === r ? '#fff' : '#6b7280',
                }}
              >
                {r === 'MANAGER' ? '팀장' : '팀원'}
              </button>
            ))}
            {role === 'MANAGER' && (
              <input
                type="date"
                value={deadline ?? ''}
                onChange={(e) => setDeadline(e.target.value || null)}
                className="border border-[#e5e7eb] rounded-lg px-2 py-1.5 text-sm"
              />
            )}
          </div>
        </div>

        {/* 블록 1: 전체 진행률 */}
        <div
          className="rounded-[14px] p-6 mb-[18px] bg-white"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          <div className="flex justify-between items-center mb-3.5">
            <div>
              <div className="text-sm font-bold">전체 진행률</div>
              <div className="text-xs text-[#9ca3af] mt-0.5">4개 카드 완료 여부 기반</div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-[#6b7280]">
                마감일 <strong className="text-[#374151]">{deadline || '미설정'}</strong>
              </span>
              {dDay !== null && deadline && (
                <span
                  className="rounded-lg px-3 py-1 text-xs font-bold"
                  style={{ background: '#fef3c7', color: '#b45309' }}
                >
                  D{dDay >= 0 ? '' : '+'}{dDay}
                </span>
              )}
            </div>
          </div>
          <div className="h-2 bg-[#e5e7eb] rounded-full overflow-hidden mb-2.5">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${status.overallProgress}%`,
                background: 'linear-gradient(90deg, #16a34a, #4ade80)',
              }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xl font-extrabold" style={{ color: '#16a34a' }}>
              {status.overallProgress}%
            </span>
            <div className="flex gap-3.5 text-[13px]">
              <span>
                <strong style={{ color: '#16a34a' }}>{status.completedCount}</strong>{' '}
                <span className="text-[#9ca3af]">완료</span>
              </span>
              <span>
                <strong style={{ color: '#d97706' }}>{status.inProgressCount}</strong>{' '}
                <span className="text-[#9ca3af]">진행중</span>
              </span>
              <span>
                <strong style={{ color: '#9ca3af' }}>{status.pendingCount}</strong>{' '}
                <span className="text-[#9ca3af]">대기</span>
              </span>
            </div>
          </div>
        </div>

        {/* 2단: 카드 + 확인 필요 사항 */}
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-[18px] mb-[18px]">
          {/* 블록 2: 페이지별 카드 */}
          <div
            className="rounded-[14px] p-6 bg-white"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            <div className="text-sm font-bold mb-0.5">페이지별 진행 상태</div>
            <div className="text-xs text-[#9ca3af] mb-4">각 페이지 작성 현황</div>
            <div className="grid grid-cols-2 gap-3">
              {PAGE_CARDS.map(({ key, label, assignee }) => {
                const item = status.pageStatuses[key];
                const s = STATUS_CONFIG[item.status];
                return (
                  <Link key={key} href={item.link}>
                    <div
                      className="border border-[#e5e7eb] rounded-xl p-3.5 cursor-pointer hover:border-[#16a34a]/40 transition-colors"
                      style={{ borderWidth: 1.5 }}
                    >
                      <div className="flex justify-between items-center mb-2.5">
                        <span className="text-lg font-medium">{s.icon}</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: s.bg, color: s.color }}
                        >
                          {s.icon} {s.label}
                        </span>
                      </div>
                      <div className="text-[13px] font-bold mb-0.5">{label}</div>
                      <div className="text-[11px] text-[#9ca3af] mb-2">{item.message}</div>
                      {(item.percent ?? 0) > 0 && (
                        <div className="h-0.5 bg-[#e5e7eb] rounded-full mb-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#16a34a]"
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                      )}
                      {role === 'MANAGER' && assignee && (
                        <div className="text-[10px] text-[#9ca3af] mb-1.5">담당: {assignee}</div>
                      )}
                      <span className="text-[11px] font-semibold text-[#16a34a] no-underline">
                        이동 →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 블록 3: 확인 필요 사항 */}
          <div
            className="rounded-[14px] p-6 bg-white"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            <div className="text-sm font-bold mb-0.5">확인 필요 사항 · 다음 액션</div>
            <div className="text-xs text-[#9ca3af] mb-4">미완료·미제출·검토 필요 항목</div>
            <div className="flex flex-col gap-2">
              {visibleActionItems.length === 0 ? (
                <p className="text-sm text-[#9ca3af] py-4">확인 필요 사항이 없습니다.</p>
              ) : (
                visibleActionItems.map((action) => (
                  <Link key={action.id} href={action.link}>
                    <div
                      className="flex gap-3 p-3 rounded-lg bg-[#fafafa] border border-[#f0f0f0] hover:bg-[#f5f5f5]"
                      style={{ minHeight: 52 }}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                        style={{
                          background:
                            action.priority <= 2 ? '#ef4444' : action.priority <= 4 ? '#d97706' : '#9ca3af',
                        }}
                      />
                      <div>
                        <div className="text-[13px] text-[#374151] leading-relaxed">
                          {action.message}
                        </div>
                        <span className="text-[11px] font-semibold text-[#16a34a]">
                          [{action.page}로 이동]
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 블록 4: 팀원 현황 (팀장 전용) */}
        {role === 'MANAGER' && (
          <div
            className="rounded-[14px] p-6 mb-[18px] bg-white"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            <div className="flex justify-between items-center mb-0.5">
              <div className="text-sm font-bold">팀원 현황</div>
              <button
                type="button"
                className="px-4 py-1.5 bg-[#16a34a] text-white border-none rounded-lg text-xs font-bold cursor-pointer"
              >
                + 팀원 초대
              </button>
            </div>
            <div className="text-xs text-[#9ca3af] mb-4">담당 페이지별 진행 현황 및 가입 승인 관리</div>

            {pendingApprovals.length > 0 && (
              <div
                className="rounded-lg p-4 mb-4 border"
                style={{ background: '#fffbeb', borderColor: '#fde68a' }}
              >
                <div className="text-[13px] font-bold text-[#92400e] mb-2">
                  가입 승인 대기 {pendingApprovals.length}명
                </div>
                {pendingApprovals.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center py-2 border-b border-[#fde68a]/50 last:border-0"
                  >
                    <span className="text-[13px]">
                      <strong>{p.userName}</strong> · {new Date(p.requestedAt).toLocaleDateString('ko-KR')} 요청
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="px-3 py-1 bg-[#16a34a] text-white border-none rounded text-xs font-bold cursor-pointer"
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1 bg-[#f3f4f6] text-[#374151] border-none rounded text-xs cursor-pointer"
                      >
                        반려
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {TEAM_MEMBERS.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3.5 p-3 border border-[#e5e7eb] rounded-lg"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                    style={{ background: '#dcfce7', color: '#15803d' }}
                  >
                    {m.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold">
                      {m.name} <span className="text-xs text-[#9ca3af] font-normal">· {m.dept}</span>
                    </div>
                    <div className="text-[11px] text-[#9ca3af]">{m.page} 담당</div>
                  </div>
                  {m.percent > 0 && (
                    <div className="w-[72px]">
                      <div className="h-1 bg-[#e5e7eb] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#16a34a] rounded-full"
                          style={{ width: `${m.percent}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-[#9ca3af] text-right mt-0.5">{m.percent}%</div>
                    </div>
                  )}
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
                    style={{
                      background: m.status === 'active' ? '#dcfce7' : '#fef3c7',
                      color: m.status === 'active' ? '#15803d' : '#92400e',
                    }}
                  >
                    {m.status === 'active' ? '활성' : '승인 대기'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 블록 5: 피드백 수신함 (팀원 전용) */}
        {role === 'MEMBER' && (
          <div
            className="rounded-[14px] p-6 mb-[18px] bg-white"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            <div className="text-sm font-bold mb-0.5">팀장 피드백</div>
            <div className="text-xs text-[#9ca3af] mb-4">수정 요청 및 승인 결과</div>
            <div className="flex flex-col gap-2.5">
              {FEEDBACKS.length === 0 ? (
                <p className="text-sm text-[#9ca3af] py-4">수신된 피드백이 없습니다.</p>
              ) : (
                FEEDBACKS.map((f, i) => (
                  <div
                    key={i}
                    className="flex gap-3.5 p-4 rounded-lg border"
                    style={{
                      background: f.type === 'rejected' ? '#fff7ed' : '#f0fdf4',
                      borderColor: f.type === 'rejected' ? '#fed7aa' : '#bbf7d0',
                    }}
                  >
                    <span className="text-lg">{f.type === 'rejected' ? '○' : '✓'}</span>
                    <div className="flex-1">
                      <div className="text-[13px] font-bold mb-0.5">{f.section}</div>
                      <div className="text-[13px] text-[#374151]">{f.message}</div>
                      <div className="text-[11px] text-[#9ca3af] mt-1">{f.time}</div>
                    </div>
                    {f.type === 'rejected' && (
                      <button
                        type="button"
                        className="self-center px-3.5 py-1.5 bg-[#16a34a] text-white border-none rounded-lg text-xs font-bold cursor-pointer"
                      >
                        재요청
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 블록 6: 보고서 출력 */}
        <div
          className="rounded-[14px] p-6 mb-[18px] bg-white"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          <div className="text-sm font-bold mb-0.5">보고서 출력</div>
          <div className="text-xs text-[#9ca3af] mb-5">완성도 확인 후 다운로드</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-[13px] font-bold mb-3 text-[#374151]">보고서 완성도 스코어카드</div>
              <div className="flex flex-col gap-2">
                {status.scorecardItems.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between items-center p-2.5 rounded-lg border"
                    style={{
                      background: s.met ? '#f0fdf4' : '#fafafa',
                      borderColor: s.met ? '#bbf7d0' : '#e5e7eb',
                    }}
                  >
                    <span className="text-[13px] text-[#374151]">{s.label}</span>
                    <span
                      className="text-xs font-bold"
                      style={{ color: s.met ? '#16a34a' : '#ef4444' }}
                    >
                      {s.met ? '✓' : '✗'}
                      {s.detail ? ` (${s.detail})` : ''}
                    </span>
                  </div>
                ))}
              </div>
              {role === 'MANAGER' && (
                <button
                  type="button"
                  onClick={() => allScorecardMet && setFinalApproved(true)}
                  disabled={!allScorecardMet || finalApproved}
                  className="mt-3 w-full py-2.5 rounded-lg text-[13px] font-bold border-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: allScorecardMet && !finalApproved ? '#16a34a' : '#e5e7eb',
                    color: allScorecardMet && !finalApproved ? '#fff' : '#9ca3af',
                  }}
                >
                  {finalApproved ? '최종 승인 완료' : '최종 승인 — 완성도 충족 후 활성화'}
                </button>
              )}
            </div>
            <div>
              <div className="text-[13px] font-bold mb-3 text-[#374151]">섹션별 진행 상황</div>
              <div className="flex flex-col gap-2 mb-5">
                {REPORT_SECTIONS.map((s) => (
                  <div key={s.id} className="flex items-center gap-2.5">
                    <span className="text-xs text-[#374151] w-[116px] shrink-0">{s.title}</span>
                    <div className="flex-1 h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#16a34a] rounded-full"
                        style={{ width: '0%' }}
                      />
                    </div>
                    <span className="text-[11px] text-[#9ca3af] w-8 text-right">0%</span>
                  </div>
                ))}
              </div>
              <div className="text-[13px] font-bold mb-2.5 text-[#374151]">다운로드</div>
              <div className="flex gap-2.5 mb-2">
                <button
                  type="button"
                  disabled={!finalApproved}
                  className="flex-1 py-2.5 rounded-lg text-[13px] font-bold border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: finalApproved ? '#f0fdf4' : '#f9fafb',
                    color: finalApproved ? '#15803d' : '#9ca3af',
                    borderColor: finalApproved ? '#bbf7d0' : '#e5e7eb',
                  }}
                >
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  disabled={!finalApproved}
                  className="flex-1 py-2.5 rounded-lg text-[13px] font-bold border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: finalApproved ? '#eff6ff' : '#f9fafb',
                    color: finalApproved ? '#1d4ed8' : '#9ca3af',
                    borderColor: finalApproved ? '#bfdbfe' : '#e5e7eb',
                  }}
                >
                  PowerPoint (.pptx)
                </button>
              </div>
              <div className="text-[11px] text-[#9ca3af]">팀장 최종 승인 후 팀장·팀원 모두 다운로드 가능</div>
            </div>
          </div>
        </div>

        {/* 블록 7: 최근 활동 로그 (팀장만) */}
        {role === 'MANAGER' && (
          <div
            className="rounded-[14px] p-6 bg-white"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            <div className="flex justify-between items-center mb-0.5">
              <div className="text-sm font-bold">최근 활동 로그</div>
              <Link href="#" className="text-xs font-semibold text-[#16a34a] no-underline">
                전체 로그 보기 →
              </Link>
            </div>
            <div className="text-xs text-[#9ca3af] mb-4">팀 전체 활동 기록</div>
            <div className="flex flex-col">
              {displayLog.length === 0 ? (
                <p className="text-sm text-[#9ca3af] py-4">활동 로그가 없습니다.</p>
              ) : (
                displayLog.map((log, i) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 py-2.5 border-b border-[#f3f4f6] last:border-0"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: '#dcfce7', color: '#15803d' }}
                    >
                      {log.userName[0]}
                    </div>
                    <div className="flex-1 text-[13px]">
                      <strong>{log.userName}</strong> <span className="text-[#374151]">· {log.action}</span>
                    </div>
                    <span className="text-[11px] text-[#9ca3af]">{formatTimeAgo(log.timestamp)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
