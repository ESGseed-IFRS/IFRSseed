import { useState } from "react";

const mockData = {
  deadline: "2026-03-31",
  dDay: 36,
  overallPercent: 28,
  counts: { done: 0, inProgress: 1, waiting: 3 },
  cards: [
    { id: "company", label: "회사정보", status: "waiting", message: "입력 필요", percent: 0, route: "/company-info" },
    { id: "ghg", label: "GHG 산정", status: "inProgress", message: "활동자료 입력 중", percent: 45, route: "/ghg-calculation", assignee: "홍길동" },
    { id: "sr", label: "SR 작성", status: "waiting", message: "미작성", percent: 0, route: "/report" },
    { id: "charts", label: "도표 생성", status: "waiting", message: "저장 0건", percent: 0, route: "/charts" },
  ],
  actions: [
    { id: 1, priority: "high", message: "팀원 2명의 가입 승인이 필요합니다.", linkLabel: "팀원 현황으로 이동", link: "#team", managerOnly: true },
    { id: 2, priority: "high", message: "회사정보를 최종 보고서에 제출해 주세요.", linkLabel: "회사정보로 이동", link: "/company-info" },
    { id: 3, priority: "high", message: "GHG 산정 결과를 저장해 주세요.", linkLabel: "GHG 산정으로 이동", link: "/ghg-calculation" },
    { id: 4, priority: "mid", message: "SR 작성을 시작해 주세요. 공시 항목 0/50 작성됨.", linkLabel: "SR 작성으로 이동", link: "/report" },
    { id: 5, priority: "low", message: "저장된 차트가 없습니다. 시각화를 추가하면 보고서 품질이 향상됩니다.", linkLabel: "도표 생성으로 이동", link: "/charts" },
    { id: 6, priority: "high", message: "팀장이 GHG 섹션 수정을 요청했습니다.", linkLabel: "GHG 산정으로 이동", link: "/ghg-calculation", memberOnly: true },
  ],
  teamMembers: [
    { name: "홍길동", dept: "환경안전팀", page: "GHG 산정", status: "active", lastActive: "2시간 전", percent: 45 },
    { name: "이영희", dept: "ESG팀", page: "SR 작성", status: "active", lastActive: "어제", percent: 0 },
    { name: "김철수", dept: "인사팀", page: "도표 생성", status: "pending", lastActive: "—", percent: 0 },
  ],
  pendingApprovals: [
    { name: "박지수", dept: "경영기획팀", requestedAt: "2026-02-23" },
    { name: "최민준", dept: "재무팀", requestedAt: "2026-02-22" },
  ],
  feedbacks: [
    { type: "rejected", section: "GHG 산정", message: "Scope 3 활동자료 보완이 필요합니다.", time: "3시간 전" },
    { type: "approved", section: "회사정보", message: "승인 완료되었습니다.", time: "어제" },
  ],
  scorecard: [
    { label: "회사정보 제출", ok: false },
    { label: "GHG 산정 결과 저장", ok: false },
    { label: "SR 공시 항목 작성", ok: false, detail: "0/50 작성됨" },
    { label: "차트·도표 저장", ok: false, detail: "0건" },
  ],
  sections: [
    { label: "회사정보", percent: 0 },
    { label: "지속가능경영 전략", percent: 0 },
    { label: "환경 성과", percent: 45 },
    { label: "사회적 책임", percent: 0 },
    { label: "지배구조", percent: 0 },
    { label: "성과 지표", percent: 0 },
    { label: "향후 계획", percent: 0 },
  ],
  activityLog: [
    { name: "홍길동", action: "GHG 산정 활동자료 저장", time: "2시간 전" },
    { name: "이영희", action: "SR 작성 페이지 접속", time: "어제" },
    { name: "홍길동", action: "GHG Scope 1 데이터 입력", time: "2일 전" },
    { name: "김철수", action: "도표 생성 페이지 접속", time: "3일 전" },
  ],
};

const statusConfig = {
  done: { label: "완료", color: "#16a34a", bg: "#dcfce7", icon: "✓" },
  inProgress: { label: "진행중", color: "#d97706", bg: "#fef3c7", icon: "◐" },
  waiting: { label: "대기", color: "#9ca3af", bg: "#f3f4f6", icon: "○" },
};

const priorityBar = { high: "#ef4444", mid: "#d97706", low: "#9ca3af" };

export default function Dashboard() {
  const [role, setRole] = useState("MANAGER");
  const [approvals, setApprovals] = useState(mockData.pendingApprovals);

  const visibleActions = mockData.actions.filter(a => {
    if (a.managerOnly && role !== "MANAGER") return false;
    if (a.memberOnly && role !== "MEMBER") return false;
    return true;
  });

  return (
    <div style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", background: "#f4f6f4", minHeight: "100vh", color: "#1a1a1a" }}>

      {/* 상단 네비 */}
      <div style={{ background: "#1c2b1c", padding: "10px 32px", display: "flex", alignItems: "center" }}>
        <span style={{ color: "#86efac", fontSize: 14, fontWeight: 700 }}>🌿 IFRSseed</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#6b7280", fontSize: 12 }}>역할 미리보기:</span>
          {["MANAGER", "MEMBER"].map(r => (
            <button key={r} onClick={() => setRole(r)} style={{
              padding: "5px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
              background: role === r ? "#16a34a" : "#2d3d2d", color: role === r ? "#fff" : "#6b7280",
              transition: "all 0.2s"
            }}>{r === "MANAGER" ? "팀장" : "팀원"}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "32px 24px" }}>

        {/* 페이지 헤더 */}
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>대시보드</h1>
              <span style={{
                padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: role === "MANAGER" ? "#dcfce7" : "#dbeafe",
                color: role === "MANAGER" ? "#15803d" : "#1d4ed8"
              }}>{role === "MANAGER" ? "팀장" : "팀원"}</span>
            </div>
            <p style={{ color: "#6b7280", margin: 0, fontSize: 13 }}>ESG 보고서 작성 현황을 한눈에 확인하고, 필요한 작업을 빠르게 진행하세요</p>
          </div>
        </div>

        {/* 블록 1: 전체 진행률 */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>전체 진행률</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>4개 카드 완료 여부 기반</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>마감일 <strong style={{ color: "#374151" }}>{mockData.deadline}</strong></span>
              <span style={{ background: "#fef3c7", color: "#b45309", borderRadius: 8, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>D-{mockData.dDay}</span>
            </div>
          </div>
          <div style={{ position: "relative", height: 8, background: "#e5e7eb", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${mockData.overallPercent}%`, background: "linear-gradient(90deg, #16a34a, #4ade80)", borderRadius: 99 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#16a34a" }}>{mockData.overallPercent}%</span>
            <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
              {[["완료", mockData.counts.done, "#16a34a"], ["진행중", mockData.counts.inProgress, "#d97706"], ["대기", mockData.counts.waiting, "#9ca3af"]].map(([label, count, color]) => (
                <span key={label}><strong style={{ color }}>{count}</strong> <span style={{ color: "#9ca3af" }}>{label}</span></span>
              ))}
            </div>
          </div>
        </div>

        {/* 2단 그리드: 카드 + 확인 필요 사항 */}
        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 18, marginBottom: 18 }}>

          {/* 블록 2: 페이지별 카드 */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>페이지별 진행 상태</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 18 }}>각 페이지 작성 현황</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {mockData.cards.map(card => {
                const s = statusConfig[card.status];
                return (
                  <div key={card.id} style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "14px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 18 }}>{card.icon}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: s.bg, color: s.color }}>{s.icon} {s.label}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{card.label}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>{card.message}</div>
                    {card.percent > 0 && (
                      <div style={{ height: 3, background: "#e5e7eb", borderRadius: 99, marginBottom: 8, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${card.percent}%`, background: "#16a34a", borderRadius: 99 }} />
                      </div>
                    )}
                    {role === "MANAGER" && card.assignee && (
                      <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 6 }}>담당: {card.assignee}</div>
                    )}
                    <a href={card.route} style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, textDecoration: "none" }}>이동 →</a>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 블록 3: 확인 필요 사항 */}
          <div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>확인 필요 사항 · 다음 액션</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 18 }}>미완료·미제출·검토 필요 항목</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visibleActions.map(a => (
                <div key={a.id} style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 10, background: "#fafafa", border: "1px solid #f0f0f0" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: priorityBar[a.priority], marginTop: 6, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, marginBottom: 3 }}>{a.message}</div>
                    <a href={a.link} style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, textDecoration: "none" }}>[{a.linkLabel}]</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 블록 4: 팀원 현황 (팀장 전용) */}
        {role === "MANAGER" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>팀원 현황</div>
              <button style={{ padding: "6px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ 팀원 초대</button>
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 18 }}>담당 페이지별 진행 현황 및 가입 승인 관리</div>

            {approvals.length > 0 && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 10 }}>⏳ 가입 승인 대기 {approvals.length}명</div>
                {approvals.map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: i < approvals.length - 1 ? 8 : 0 }}>
                    <span style={{ fontSize: 13 }}><strong>{p.name}</strong> · {p.dept} · {p.requestedAt} 요청</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setApprovals(approvals.filter((_, j) => j !== i))} style={{ padding: "4px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>승인</button>
                      <button onClick={() => setApprovals(approvals.filter((_, j) => j !== i))} style={{ padding: "4px 14px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>반려</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {mockData.teamMembers.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#15803d", flexShrink: 0 }}>{m.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name} <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 400 }}>· {m.dept}</span></div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{m.page} 담당 · 마지막 활동 {m.lastActive}</div>
                  </div>
                  {m.percent > 0 && (
                    <div style={{ width: 72 }}>
                      <div style={{ height: 4, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${m.percent}%`, background: "#16a34a", borderRadius: 99 }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "right", marginTop: 2 }}>{m.percent}%</div>
                    </div>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: m.status === "active" ? "#dcfce7" : "#fef3c7", color: m.status === "active" ? "#15803d" : "#92400e" }}>
                    {m.status === "active" ? "활성" : "승인 대기"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 블록 5: 피드백 수신함 (팀원 전용) */}
        {role === "MEMBER" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>팀장 피드백</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 18 }}>수정 요청 및 승인 결과</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mockData.feedbacks.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 14, padding: "14px 16px", borderRadius: 10, background: f.type === "rejected" ? "#fff7ed" : "#f0fdf4", border: `1px solid ${f.type === "rejected" ? "#fed7aa" : "#bbf7d0"}` }}>
                  <span style={{ fontSize: 18 }}>{f.type === "rejected" ? "🔴" : "✅"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{f.section}</div>
                    <div style={{ fontSize: 13, color: "#374151" }}>{f.message}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{f.time}</div>
                  </div>
                  {f.type === "rejected" && (
                    <button style={{ padding: "6px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", alignSelf: "center" }}>재요청</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 블록 6: 보고서 출력 */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>보고서 출력</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>완성도 확인 후 다운로드</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#374151" }}>보고서 완성도 스코어카드</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {mockData.scorecard.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: s.ok ? "#f0fdf4" : "#fafafa", border: `1px solid ${s.ok ? "#bbf7d0" : "#e5e7eb"}` }}>
                    <span style={{ fontSize: 13, color: "#374151" }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.ok ? "#16a34a" : "#ef4444" }}>
                      {s.ok ? "✓" : "✗"}{s.detail ? ` (${s.detail})` : ""}
                    </span>
                  </div>
                ))}
              </div>
              {role === "MANAGER" && (
                <button style={{ marginTop: 12, width: "100%", padding: "10px", background: "#e5e7eb", color: "#9ca3af", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "not-allowed" }}>
                  최종 승인 — 완성도 충족 후 활성화
                </button>
              )}
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#374151" }}>섹션별 진행 상황</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
                {mockData.sections.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#374151", width: 116, flexShrink: 0 }}>{s.label}</span>
                    <div style={{ flex: 1, height: 5, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${s.percent}%`, background: "#16a34a", borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 11, color: "#9ca3af", width: 30, textAlign: "right" }}>{s.percent}%</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#374151" }}>다운로드</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                <button style={{ flex: 1, padding: "10px", background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Excel (.xlsx)
                </button>
                <button style={{ flex: 1, padding: "10px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  PowerPoint (.pptx)
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>팀장 최종 승인 후 팀장·팀원 모두 다운로드 가능</div>
            </div>
          </div>
        </div>

        {/* 블록 7: 최근 활동 로그 (팀장 전용) */}
        {role === "MANAGER" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>최근 활동 로그</div>
              <a href="#" style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, textDecoration: "none" }}>전체 로그 보기 →</a>
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 18 }}>팀 전체 활동 기록</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {mockData.activityLog.map((log, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < mockData.activityLog.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#15803d", flexShrink: 0 }}>{log.name[0]}</div>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <strong>{log.name}</strong> <span style={{ color: "#374151" }}>· {log.action}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
