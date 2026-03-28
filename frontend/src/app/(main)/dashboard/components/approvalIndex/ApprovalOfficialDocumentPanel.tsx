'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { Eye } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { ApprovalDraftRichEditor } from '@/app/(main)/dashboard/components/approvalIndex/ApprovalDraftRichEditor';
import { ApprovalStampGrid } from '@/app/(main)/dashboard/components/approvalIndex/ApprovalStampGrid';
import { Card, CTitle } from '@/app/(main)/dashboard/components/shared';
import { C } from '@/app/(main)/dashboard/lib/constants';
import type { ApprovalMenuKey } from '@/app/(main)/dashboard/lib/dashboardNewMock';
import {
  ENTITY_TYPE_LABEL,
  type ApprovalDocUnified,
  formatEntitySourceLine,
} from '@/app/(main)/dashboard/lib/approvalUnified';

const RETENTION_OPTIONS = ['3년', '5년', '7년', '10년', '영구'] as const;
const RECORD_FOLDERS = ['공용문서철', 'ESG 보고', 'GHG 산정', '감사 대응'] as const;

function summarizeRole(doc: ApprovalDocUnified, roles: string[]): string {
  const names = doc.approvalLines
    .filter((l) => roles.includes(l.role))
    .flatMap((l) => l.people.map((p) => p.name));
  return names.length ? names.join(', ') : '—';
}

export function ApprovalOfficialDocumentPanel({
  doc,
  onClose,
  onUpdateDoc,
  setApprovalMenu,
  onOpenLineModal,
}: {
  doc: ApprovalDocUnified;
  onClose: () => void;
  onUpdateDoc: (id: string, patch: Partial<ApprovalDocUnified>) => void;
  setApprovalMenu: (menu: ApprovalMenuKey) => void;
  onOpenLineModal: () => void;
}) {
  const editable = doc.status === 'draft' || doc.status === 'rejected';
  const canActInbox = doc.myTurn && (doc.status === 'pending' || doc.status === 'inProgress');
  const nowIso = () => new Date().toISOString();

  const [title, setTitle] = useState(doc.title);
  const [opinion, setOpinion] = useState(doc.opinion);
  const [bodyHtml, setBodyHtml] = useState(doc.bodyHtml);
  const [retention, setRetention] = useState(doc.retention);
  const [recordFolder, setRecordFolder] = useState<string>(RECORD_FOLDERS[0]);
  const [visibility, setVisibility] = useState<'공개' | '일반'>('일반');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setTitle(doc.title);
    setOpinion(doc.opinion);
    setBodyHtml(doc.bodyHtml);
    setRetention(doc.retention);
  }, [doc.id, doc.title, doc.opinion, doc.bodyHtml, doc.retention]);

  const persistDraftFields = () => ({
    title: title.trim() || doc.title,
    opinion: opinion.trim(),
    bodyHtml: bodyHtml.trim() ? bodyHtml : '<p></p>',
    retention,
    updatedAt: nowIso(),
  });

  const classicBarBtn = (active?: boolean): CSSProperties => ({
    padding: '6px 11px',
    fontSize: 11,
    fontWeight: 600,
    border: '1px solid #9ca3af',
    background: active ? '#4b5563' : '#fff',
    color: active ? '#fff' : '#111',
    cursor: 'pointer',
    marginRight: -1,
    whiteSpace: 'nowrap',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: '#e8eef4',
      }}
    >
      {/* 상단 액션 — 공문 툴바 */}
      <div
        style={{
          padding: '10px 14px',
          background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
          borderBottom: '1px solid #b8c9dc',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        {canActInbox && (
          <>
            <button
              type="button"
              onClick={() => {
                onUpdateDoc(doc.id, {
                  status: 'approved',
                  menuKey: 'outbox.completed',
                  myTurn: false,
                  updatedAt: nowIso(),
                });
                setApprovalMenu('outbox.completed');
              }}
              style={{
                padding: '7px 14px',
                fontSize: 11,
                fontWeight: 800,
                borderRadius: 4,
                border: '1px solid #15803d',
                background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 100%)',
                color: '#052e16',
                cursor: 'pointer',
              }}
            >
              승인
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdateDoc(doc.id, {
                  status: 'rejected',
                  menuKey: 'outbox.rejected',
                  myTurn: false,
                  updatedAt: nowIso(),
                });
                setApprovalMenu('outbox.rejected');
              }}
              style={{
                padding: '7px 14px',
                fontSize: 11,
                fontWeight: 800,
                borderRadius: 4,
                border: `1px solid ${C.g300}`,
                background: 'white',
                color: C.red,
                cursor: 'pointer',
              }}
            >
              반려
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onOpenLineModal}
          title="결재 인원을 등록·변경합니다. 반영 후 아래 결재 표에 즉시 표시됩니다."
          style={{
            padding: '7px 14px',
            fontSize: 11,
            fontWeight: 800,
            borderRadius: 4,
            border: '1px solid #c4a035',
            background: 'linear-gradient(180deg, #fef9c3 0%, #fde047 100%)',
            color: '#713f12',
            cursor: 'pointer',
          }}
        >
          결재라인설정
        </button>
        <button
          type="button"
          disabled={!editable}
          onClick={() => {
            const fields = persistDraftFields();
            onUpdateDoc(doc.id, {
              ...fields,
              status: 'inProgress',
              menuKey: 'outbox.progress',
            });
            setApprovalMenu('outbox.progress');
            toast.success('기안 반영됨', {
              description: '브라우저 mock 상태만 갱신됩니다. 새로고침 시 초기 데이터로 돌아갈 수 있습니다.',
            });
          }}
          style={{
            padding: '7px 14px',
            fontSize: 11,
            fontWeight: 800,
            borderRadius: 4,
            border: '1px solid #be185d',
            background: editable ? 'linear-gradient(180deg, #fbcfe8 0%, #f472b6 100%)' : C.g200,
            color: editable ? '#831843' : C.g400,
            cursor: editable ? 'pointer' : 'not-allowed',
          }}
        >
          기안하기
        </button>
        <button
          type="button"
          disabled={!editable}
          onClick={() => {
            const fields = persistDraftFields();
            onUpdateDoc(doc.id, {
              ...fields,
              status: 'draft',
              menuKey: 'outbox.draft',
            });
            setApprovalMenu('outbox.draft');
            toast.message('임시보관됨', {
              description: '서버 저장 없이 이 세션의 목록/본문만 유지됩니다.',
            });
          }}
          style={{
            padding: '7px 14px',
            fontSize: 11,
            fontWeight: 800,
            borderRadius: 4,
            border: `1px solid ${C.g300}`,
            background: 'white',
            color: editable ? C.g800 : C.g400,
            cursor: editable ? 'pointer' : 'not-allowed',
          }}
        >
          임시보관
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '7px 14px',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 4,
            border: `1px solid ${C.g300}`,
            background: 'white',
            color: C.g600,
            cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <div
          style={{
            maxWidth: 920,
            margin: '0 auto',
            background: 'white',
            border: '1px solid #8fa8c4',
            borderRadius: 4,
            boxShadow: '0 4px 24px rgba(30,58,95,.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              background: 'linear-gradient(90deg, #1e3a5f 0%, #2c5282 100%)',
              color: 'white',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, marginBottom: 4 }}>결재기안</div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>전자결재 기안서</div>
          </div>

          <div style={{ padding: '16px 18px 20px' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                borderBottom: '1px solid #d1d5db',
                marginBottom: 12,
                paddingBottom: 10,
              }}
            >
              <button
                type="button"
                disabled={!canActInbox}
                style={classicBarBtn(canActInbox)}
                onClick={() => {
                  if (!canActInbox) return;
                  onUpdateDoc(doc.id, {
                    status: 'approved',
                    menuKey: 'outbox.completed',
                    myTurn: false,
                    updatedAt: nowIso(),
                  });
                  setApprovalMenu('outbox.completed');
                  toast.success('결재(승인) 처리됨 (mock)');
                }}
              >
                결재
              </button>
              <button
                type="button"
                style={classicBarBtn(false)}
                onClick={() => toast.message('보류', { description: '데모 단계에서는 연결되지 않았습니다.' })}
              >
                보류
              </button>
              <button
                type="button"
                style={classicBarBtn(false)}
                disabled={!editable}
                onClick={() =>
                  document.getElementById('approval-draft-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                수정
              </button>
              <button type="button" style={classicBarBtn(false)} onClick={onOpenLineModal}>
                결재선
              </button>
              <button
                type="button"
                style={classicBarBtn(false)}
                onClick={() => toast.message('참조자', { description: '결재라인 설정의 참조 박스를 이용하세요.' })}
              >
                참조자
              </button>
              <button
                type="button"
                style={classicBarBtn(false)}
                onClick={() =>
                  toast.message('진행현황', { description: `상태: ${doc.status} · 메뉴: ${doc.menuKey}` })
                }
              >
                진행현황
              </button>
              <button type="button" style={classicBarBtn(false)} onClick={() => window.print()}>
                인쇄
              </button>
              <button type="button" style={classicBarBtn(false)} onClick={onClose}>
                목록
              </button>
            </div>

            <div
              style={{
                marginBottom: 14,
                padding: '10px 12px',
                fontSize: 11,
                lineHeight: 1.5,
                color: '#92400e',
                background: '#fffbeb',
                border: '1px solid #fcd34d',
                borderRadius: 4,
              }}
            >
              <strong>프론트 mock 안내:</strong> 본문·첨부·결재라인 변경은{' '}
              <strong>이 브라우저 세션의 React 상태</strong>에만 반영됩니다. 실제 업로드·DB 저장·전자결재 연동은 API
              구축 후 가능합니다. 새로고침 시 초기 mock 데이터로 돌아갈 수 있습니다.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,1fr) minmax(280px,1.05fr)', gap: 16, marginBottom: 16 }}>
              {/* 메타 그리드 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 1fr',
                  gap: '6px 12px',
                  fontSize: 12,
                  alignContent: 'start',
                }}
              >
                {[
                  ['문서번호', doc.id],
                  ['기안일시', new Date(doc.draftedAt).toLocaleString('ko-KR')],
                  ['기안부서', doc.dept],
                  ['기안직급', doc.drafter.title ?? '—'],
                  ['기안자', doc.drafter.name],
                  [
                    '보존연한',
                    editable ? (
                      <select
                        value={retention}
                        onChange={(e) => setRetention(e.target.value)}
                        style={{
                          padding: '4px 8px',
                          fontSize: 12,
                          borderRadius: 4,
                          border: `1px solid ${C.g200}`,
                          maxWidth: 200,
                        }}
                      >
                        {RETENTION_OPTIONS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                        {(RETENTION_OPTIONS as readonly string[]).includes(retention) ? null : (
                          <option value={retention}>{retention}</option>
                        )}
                      </select>
                    ) : (
                      doc.retention
                    ),
                  ],
                ].map(([k, v]) => (
                  <div key={String(k)} style={{ display: 'contents' }}>
                    <div style={{ color: C.g500, fontWeight: 700 }}>{k}</div>
                    <div style={{ color: C.g800, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
                <div style={{ color: C.g500, fontWeight: 700 }}>출처</div>
                <div style={{ color: C.g800 }}>{formatEntitySourceLine(doc)}</div>
                <div style={{ color: C.g500, fontWeight: 700 }}>엔티티</div>
                <div style={{ color: C.g800 }}>{ENTITY_TYPE_LABEL[doc.entitySnapshot.entityType]}</div>
              </div>

              {/* 전자결재식 결재 칸 (문서별 결재라인 연동) */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.g500, marginBottom: 6 }}>결재 칸</div>
                <ApprovalStampGrid doc={doc} onOpenLineModal={onOpenLineModal} />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '88px 1fr',
                gap: 8,
                fontSize: 11,
                marginBottom: 12,
                padding: 10,
                background: '#f8fafc',
                borderRadius: 4,
                border: `1px solid ${C.g200}`,
              }}
            >
              <div style={{ fontWeight: 800, color: C.g600 }}>협의</div>
              <div style={{ color: C.g700 }}>{summarizeRole(doc, ['합의'])}</div>
              <div style={{ fontWeight: 800, color: C.g600 }}>수신</div>
              <div style={{ color: C.g700 }}>{summarizeRole(doc, ['수신'])}</div>
              <div style={{ fontWeight: 800, color: C.g600 }}>참조</div>
              <div style={{ color: C.g700 }}>{summarizeRole(doc, ['참조'])}</div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.g600 }}>기록물철</span>
                <select
                  value={recordFolder}
                  disabled={!editable}
                  onChange={(e) => setRecordFolder(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 11, borderRadius: 4, border: `1px solid ${C.g200}` }}
                >
                  {RECORD_FOLDERS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['공개', '일반'] as const).map((v) => (
                  <label key={v} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: editable ? 'pointer' : 'default' }}>
                    <input type="radio" name="vis" checked={visibility === v} disabled={!editable} onChange={() => setVisibility(v)} />
                    {v}
                  </label>
                ))}
              </div>
              <button
                type="button"
                style={{
                  ...linkStyle,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                참조문서 연결…
              </button>
            </div>

            <div id="approval-draft-section" style={{ scrollMarginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.g600, marginBottom: 4 }}>
                문서제목 <span style={{ color: '#ca8a04' }}>●</span>
              </div>
              {editable ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    border: '1px solid #94a3b8',
                    borderRadius: 4,
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '10px 12px',
                    border: `1px solid ${C.g200}`,
                    borderRadius: 4,
                    fontSize: 14,
                    fontWeight: 800,
                    background: '#fafbfc',
                  }}
                >
                  {doc.title}
                </div>
              )}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.g600, marginBottom: 4 }}>첨부</div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!editable) return;
                  const files = Array.from(e.dataTransfer.files);
                  if (!files.length) return;
                  const next = [
                    ...doc.attachments,
                    ...files.map((f) => ({ name: f.name, size: `${Math.max(1, Math.round(f.size / 1024))}KB` })),
                  ];
                  onUpdateDoc(doc.id, { attachments: next, updatedAt: nowIso() });
                  toast.success(`첨부 ${files.length}건 추가`, { description: '세션 mock 목록에만 반영됩니다.' });
                }}
                style={{
                  border: '2px dashed #b8c9dc',
                  borderRadius: 6,
                  padding: '18px 14px',
                  textAlign: 'center',
                  background: editable ? '#f8fafc' : '#fafbfc',
                  fontSize: 11,
                  color: C.g500,
                }}
              >
                <label style={{ cursor: editable ? 'pointer' : 'default' }}>
                  <input
                    type="file"
                    multiple
                    disabled={!editable}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const files = e.target.files;
                      if (!files?.length) return;
                      const next = [
                        ...doc.attachments,
                        ...Array.from(files).map((f) => ({
                          name: f.name,
                          size: `${Math.max(1, Math.round(f.size / 1024))}KB`,
                        })),
                      ];
                      onUpdateDoc(doc.id, { attachments: next, updatedAt: nowIso() });
                      toast.success(`첨부 ${files.length}건 추가`, { description: '세션 mock 목록에만 반영됩니다.' });
                      e.target.value = '';
                    }}
                  />
                  <span style={{ fontWeight: 800, color: '#2563eb' }}>파일 선택</span>
                </label>
                <span style={{ margin: '0 8px' }}>|</span>
                여기로 파일을 끌어다 놓으세요 (데모)
              </div>
              {doc.attachments.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 11, color: C.g700 }}>
                  {doc.attachments.map((a) => (
                    <li key={a.name}>
                      {a.name}
                      {a.size ? ` (${a.size})` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.g600, marginBottom: 4 }}>기안의견</div>
              {editable ? (
                <textarea
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    border: `1px solid ${C.g200}`,
                    borderRadius: 4,
                    fontSize: 12,
                    resize: 'vertical',
                  }}
                />
              ) : (
                <div style={{ padding: '10px 12px', border: `1px solid ${C.g200}`, borderRadius: 4, fontSize: 12 }}>{doc.opinion || '—'}</div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.g600 }}>본문</div>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 800,
                  borderRadius: 4,
                  border: '1px solid #2563eb',
                  background: 'linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)',
                  color: '#1e40af',
                  cursor: 'pointer',
                }}
              >
                <Eye size={14} />
                미리보기
              </button>
            </div>
            <div
              style={{
                padding: '10px 12px',
                marginBottom: 12,
                fontSize: 11,
                lineHeight: 1.5,
                color: '#1e40af',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 4,
              }}
            >
              최종 결재자 화면에서는 서식이 약간 다르게 보일 수 있습니다. 제출 전 <strong>미리보기</strong>로 확인하세요.
            </div>

            <ApprovalDraftRichEditor
              key={doc.id}
              html={editable ? bodyHtml : doc.bodyHtml}
              onChange={setBodyHtml}
              disabled={!editable}
              minHeight={320}
            />
            </div>

            <Card style={{ marginTop: 16 }}>
              <CTitle>결재선 요약</CTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {doc.approvalLines.map((line, i) => (
                  <div key={i} style={{ fontSize: 12 }}>
                    <span style={{ fontWeight: 800, color: C.navy }}>{line.role}</span>
                    <span style={{ color: C.g500, marginLeft: 8 }}>
                      {line.people.map((p) => `${p.name}(${p.dept})`).join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {(doc.links?.srDpId || doc.links?.srDpCode || doc.links?.ghgAuditEventId) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {(doc.links.srDpId || doc.links.srDpCode) && (
                  <Link
                    href={`/sr-report?dpId=${encodeURIComponent(doc.links.srDpId ?? doc.links.srDpCode ?? '')}`}
                    style={linkButton(C.blue, 'white')}
                  >
                    SR 원문 보기
                  </Link>
                )}
                {doc.links.ghgAuditEventId && (
                  <Link href="/ghg_calc" style={linkButton(C.tealSoft, C.teal)}>
                    GHG 산정에서 보기
                  </Link>
                )}
              </div>
            )}

            {doc.links?.previousDocId && (
              <div style={{ fontSize: 11, color: C.g500, marginTop: 12 }}>이전 문서 참조: {doc.links.previousDocId}</div>
            )}
          </div>
        </div>
      </div>

      {previewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 85,
            background: 'rgba(15,23,42,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setPreviewOpen(false)}
        >
          <div
            style={{
              width: 'min(720px, 100%)',
              maxHeight: '85vh',
              overflow: 'auto',
              background: 'white',
              borderRadius: 8,
              padding: 20,
              boxShadow: '0 20px 50px rgba(0,0,0,.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>본문 미리보기</span>
              <button type="button" onClick={() => setPreviewOpen(false)} style={{ ...linkStyle, fontWeight: 800 }}>
                닫기
              </button>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{editable ? title : doc.title}</div>
            <div
              style={{
                border: `1px solid ${C.g200}`,
                borderRadius: 6,
                padding: 16,
                fontSize: 13,
                lineHeight: 1.65,
                minHeight: 200,
              }}
              dangerouslySetInnerHTML={{ __html: editable ? bodyHtml || '<p></p>' : doc.bodyHtml }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const linkStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  padding: 0,
  color: '#2563eb',
  cursor: 'pointer',
  textDecoration: 'underline',
};

function linkButton(bg: string, color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: 32,
    padding: '0 14px',
    borderRadius: 6,
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 800,
    textDecoration: 'none',
    border: `1px solid ${color === 'white' ? bg : color}`,
  };
}
