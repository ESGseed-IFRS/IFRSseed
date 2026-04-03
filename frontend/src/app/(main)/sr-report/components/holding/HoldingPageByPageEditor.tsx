'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  HOLDING_SR_PAGE_DATA,
  getInfographicSuggestions,
  findPageByKeyword,
  type HoldingSrPageRow,
} from '../../lib/holdingPageData';
import { getRecommendedInfographicTemplates } from '../../lib/holdingInfographicCatalog';
import type { InfographicBlockPayload } from '../../lib/holdingInfographicTypes';
import {
  HoldingChartSVG,
  HoldingChartEditor,
  HoldingTableEditor,
  HoldingTableBlock,
  uid,
  type ChartSeriesState,
  type PageContentBlock,
  type ChartBlockPayload,
  type TableBlockPayload,
} from './HoldingPageEditorBlocks';
import { HoldingInfographicEditor } from './HoldingInfographicEditor';
import { HoldingInfographicSvg } from './HoldingInfographicSvg';

const INFO_ICONS = ['📊', '📈', '🗂️', '🎯', '📉'];

type Props = {
  /** 공시데이터 작성 등에서 넘어올 때 목차 키워드(예: 온실가스 배출)로 해당 페이지 자동 선택 */
  initialKeyword?: string | null;
  onInitialKeywordConsumed?: () => void;
};

export function HoldingPageByPageEditor({ initialKeyword, onInitialKeywordConsumed }: Props) {
  const [selectedPage, setSelectedPage] = useState<HoldingSrPageRow | null>(null);
  const [search, setSearch] = useState('');
  const [pageTexts, setPageTexts] = useState<Record<string, string>>({});
  const [blocks, setBlocks] = useState<Record<string, PageContentBlock[]>>({});
  const [activeTab, setActiveTab] = useState<'content' | 'chart' | 'table' | 'infographic'>('content');
  const [generating, setGenerating] = useState(false);
  const [infographicEdit, setInfographicEdit] = useState<{
    id: string;
    payload: InfographicBlockPayload;
  } | null>(null);

  useEffect(() => {
    if (!initialKeyword?.trim()) return;
    const found = findPageByKeyword(initialKeyword);
    if (found) setSelectedPage(found);
    onInitialKeywordConsumed?.();
  }, [initialKeyword, onInitialKeywordConsumed]);

  const sections = useMemo(
    () => Array.from(new Set(HOLDING_SR_PAGE_DATA.map((p) => p.section))),
    [],
  );
  const filtered = useMemo(
    () =>
      HOLDING_SR_PAGE_DATA.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.standards.some((s) => s.toLowerCase().includes(search.toLowerCase())),
      ),
    [search],
  );

  const pageKey = selectedPage ? String(selectedPage.page) : null;
  const currentText = pageKey ? pageTexts[pageKey] || '' : '';
  const currentBlocks = pageKey ? blocks[pageKey] || [] : [];

  async function generateText() {
    if (!selectedPage || !pageKey) return;
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 700));
    const stub = `[${selectedPage.title}]에 대한 지주사 그룹 관점 서술 초안입니다.\n\n본 보고 기간 동안 그룹은 관련 공시기준(${selectedPage.standards.slice(0, 4).join(', ')})에 따라 [수치]를 집계·검증하였으며, [회사명] 및 주요 계열사의 활동을 통합하여 공시합니다.\n\n향후 데이터 확정 시 본 문단은 업데이트됩니다. (실서비스에서는 AI/내부 API 연동 가능)`;
    setPageTexts((prev) => ({ ...prev, [pageKey]: stub }));
    setGenerating(false);
  }

  function addBlock(b: ChartBlockPayload | TableBlockPayload | InfographicBlockPayload) {
    if (!pageKey) return;
    setBlocks((prev) => ({
      ...prev,
      [pageKey]: [...(prev[pageKey] || []), { ...b, id: uid() } as PageContentBlock],
    }));
    setActiveTab('content');
    setInfographicEdit(null);
  }

  function saveInfographicEdit(blockId: string, payload: InfographicBlockPayload) {
    if (!pageKey) return;
    setBlocks((prev) => ({
      ...prev,
      [pageKey]: (prev[pageKey] || []).map((bl) =>
        bl.id === blockId ? ({ ...payload, id: blockId } as PageContentBlock) : bl,
      ),
    }));
    setInfographicEdit(null);
    setActiveTab('content');
  }

  function removeBlock(id: string) {
    if (!pageKey) return;
    setBlocks((prev) => ({
      ...prev,
      [pageKey]: (prev[pageKey] || []).filter((b) => b.id !== id),
    }));
  }

  const suggestions = selectedPage ? getInfographicSuggestions(selectedPage.standards) : [];
  const templateRecs = selectedPage ? getRecommendedInfographicTemplates(selectedPage.standards) : [];
  const totalBlocks = Object.values(blocks).reduce((a, arr) => a + arr.length, 0);

  function seriesForPreview(chart: ChartBlockPayload): ChartSeriesState[] {
    return chart.series.map((s, i) => ({
      id: `s-${i}`,
      name: s.name,
      type: s.type,
      color: s.color,
      labels: s.labels,
      values: s.values,
    }));
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f7f8fa] text-[#222] overflow-hidden font-sans">
      <header className="h-[50px] shrink-0 bg-white border-b border-[#e4e6ea] flex items-center justify-between px-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-[#2d6a4f] to-[#5a9e6e] flex items-center justify-center text-white text-sm font-bold">
            SR
          </div>
          <span className="text-[15px] font-bold text-[#222]">페이지별 작성</span>
          <span className="text-[11px] text-[#aaa]">지주사 편집</span>
        </div>
        <span className="text-[11px] text-[#888]">
          페이지 {HOLDING_SR_PAGE_DATA.length}개 · 블록 {totalBlocks}개
        </span>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-64 shrink-0 bg-white border-r border-[#e4e6ea] flex flex-col">
          <div className="px-3.5 pt-3.5 pb-2.5 border-b border-[#f0f0f0]">
            <div className="text-[11px] font-bold text-[#2d6a4f] mb-2 tracking-wide">페이지 목록</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="페이지·공시기준 검색..."
              className="w-full bg-[#f5f6f8] border border-[#e4e6ea] rounded-md py-1.5 px-2.5 text-xs text-[#222] outline-none box-border"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {sections.map((sec) => {
              const pages = filtered.filter((p) => p.section === sec);
              if (!pages.length) return null;
              return (
                <div key={sec}>
                  <div className="text-[10px] font-bold text-[#aaa] tracking-widest px-3.5 pt-2.5 pb-1 uppercase">
                    {sec}
                  </div>
                  {pages.map((p) => {
                    const pKey = String(p.page);
                    const blkCount = (blocks[pKey] || []).length;
                    const hasText = !!pageTexts[pKey];
                    const active = selectedPage?.page === p.page;
                    return (
                      <button
                        type="button"
                        key={p.page}
                        onClick={() => {
                          setSelectedPage(p);
                          setActiveTab('content');
                        }}
                        className={`w-full text-left px-3.5 py-2 cursor-pointer border-l-[3px] transition-colors ${
                          active
                            ? 'border-[#2d6a4f] bg-[#f0faf3]'
                            : 'border-transparent bg-transparent hover:bg-[#fafafa]'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span
                            className={`text-[10px] font-mono font-semibold ${active ? 'text-[#2d6a4f]' : 'text-[#aaa]'}`}
                          >
                            P.{p.page}
                          </span>
                          <div className="flex gap-0.5">
                            {hasText && (
                              <span className="text-[9px] bg-[#edf5ef] text-[#2d6a4f] rounded-md px-1 py-px">
                                문단
                              </span>
                            )}
                            {blkCount > 0 && (
                              <span className="text-[9px] bg-[#fff3e8] text-[#c06020] rounded-md px-1 py-px">
                                +{blkCount}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          className={`text-xs mt-0.5 leading-snug ${
                            active ? 'text-[#2d6a4f] font-bold' : 'text-[#444] font-normal'
                          }`}
                        >
                          {p.title}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!selectedPage ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#ccc]">
              <div className="text-5xl">📄</div>
              <div className="text-sm text-[#bbb]">좌측에서 편집할 페이지를 선택하세요</div>
            </div>
          ) : (
            <>
              <div className="shrink-0 px-6 pt-4 pb-0 border-b border-[#e4e6ea] bg-white">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#aaa] font-mono mb-0.5">
                      PAGE {selectedPage.page} · {selectedPage.section}
                    </div>
                    <h2 className="text-[17px] font-bold text-[#222]">{selectedPage.title}</h2>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {selectedPage.standards.map((s) => (
                        <span
                          key={s}
                          className="text-[10px] bg-[#edf5ef] text-[#2d6a4f] rounded-full px-2 py-0.5"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  {activeTab === 'content' && (
                    <button
                      type="button"
                      onClick={() => void generateText()}
                      disabled={generating}
                      className="shrink-0 flex items-center gap-2 py-2 px-4 rounded-lg bg-[#2d6a4f] text-white text-xs font-bold disabled:opacity-60"
                    >
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>✦</span>}
                      {generating ? '생성 중...' : 'AI 문단 생성'}
                    </button>
                  )}
                </div>
                <div className="flex gap-0 mt-3">
                  {(
                    [
                      ['content', '📝 본문 편집'],
                      ['chart', '📊 차트(자유)'],
                      ['table', '📋 표'],
                      ['infographic', '🎨 인포그래픽'],
                    ] as const
                  ).map(([t, label]) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setActiveTab(t)}
                      className={`py-2 px-[18px] text-xs font-semibold cursor-pointer border-none bg-transparent border-b-2 transition-colors ${
                        activeTab === t
                          ? 'text-[#2d6a4f] border-[#2d6a4f]'
                          : 'text-[#888] border-transparent'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
                  {activeTab === 'content' && (
                    <>
                      <textarea
                        value={currentText}
                        onChange={(e) =>
                          pageKey &&
                          setPageTexts((prev) => ({ ...prev, [pageKey]: e.target.value }))
                        }
                        placeholder={`${selectedPage.title} 페이지의 내용을 작성하거나 AI 생성을 활용하세요.\n\n계열사로부터 받은 DP 내용이 여기에 취합됩니다.`}
                        className="w-full min-h-[200px] border border-[#dde1e7] rounded-[10px] py-3.5 px-4 text-[13px] leading-[1.9] resize-y outline-none text-[#333] bg-white box-border"
                      />
                      {currentBlocks.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-[#2d6a4f] tracking-wide mb-2.5">
                            추가된 콘텐츠
                          </div>
                          {currentBlocks.map((block) => (
                            <div
                              key={block.id}
                              className="bg-white border border-[#e4e6ea] rounded-[10px] p-4 mb-3"
                            >
                              <div className="flex justify-between mb-2.5 gap-2">
                                <span className="text-[11px] bg-[#edf5ef] text-[#2d6a4f] rounded-lg px-2.5 py-0.5 font-semibold">
                                  {block.type === 'chart'
                                    ? `📊 ${block.chartType?.split(' ')[0]} 차트`
                                    : block.type === 'infographic'
                                      ? `🎨 인포그래픽 · ${block.templateId}`
                                      : '📋 표'}
                                  {block.type === 'chart' && block.title && ` · ${block.title}`}
                                  {block.type === 'table' && block.tableTitle && ` · ${block.tableTitle}`}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {block.type === 'infographic' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInfographicEdit({
                                          id: block.id,
                                          payload: {
                                            type: 'infographic',
                                            templateId: block.templateId,
                                            schemaVersion: block.schemaVersion,
                                            dataSource: block.dataSource,
                                            props: block.props,
                                          } as InfographicBlockPayload,
                                        });
                                        setActiveTab('infographic');
                                      }}
                                      className="text-[10px] text-[#457b9d] font-semibold underline-offset-2 hover:underline"
                                    >
                                      편집
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeBlock(block.id)}
                                    className="bg-transparent border-none text-[#ccc] cursor-pointer text-base leading-none"
                                    aria-label="삭제"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                              {block.type === 'chart' && (
                                <HoldingChartSVG
                                  chartType={block.chartType}
                                  series={seriesForPreview(block)}
                                  title={block.title}
                                />
                              )}
                              {block.type === 'table' && <HoldingTableBlock block={block} />}
                              {block.type === 'infographic' && <HoldingInfographicSvg block={block} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {activeTab === 'chart' && <HoldingChartEditor onAdd={addBlock} />}
                  {activeTab === 'table' && <HoldingTableEditor onAdd={addBlock} />}
                  {activeTab === 'infographic' && selectedPage && (
                    <HoldingInfographicEditor
                      standards={selectedPage.standards}
                      onAdd={addBlock}
                      onSwitchToFreeChart={() => setActiveTab('chart')}
                      editTarget={infographicEdit}
                      onSaveEdit={saveInfographicEdit}
                      onCancelEdit={() => setInfographicEdit(null)}
                    />
                  )}
                </div>

                <aside className="w-[200px] shrink-0 border-l border-[#e4e6ea] px-3.5 py-4 overflow-y-auto bg-[#fafafa]">
                  <div className="text-[10px] font-bold text-[#2d6a4f] tracking-wide mb-2.5">인포그래픽 템플릿</div>
                  {templateRecs.slice(0, 5).map((t) => (
                    <button
                      key={t.templateId}
                      type="button"
                      onClick={() => {
                        setInfographicEdit(null);
                        setActiveTab('infographic');
                      }}
                      className="w-full text-left bg-white border border-[#e4e6ea] rounded-lg p-2.5 text-[10px] text-[#333] mb-2 cursor-pointer hover:border-[#5a9e6e] hover:bg-[#f8fdf9] transition-colors"
                    >
                      <div className="font-semibold text-[#2d6a4f] mb-0.5">{t.title}</div>
                      <div className="text-[#888] line-clamp-3">{t.description}</div>
                    </button>
                  ))}
                  <div className="text-[10px] font-bold text-[#888] tracking-wide mb-2 mt-4">문구 아이디어</div>
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="w-full text-left bg-[#f5f6f8] border border-[#e8e8e8] rounded-lg p-2 text-[10px] text-[#555] mb-2"
                    >
                      <span className="mr-1">{INFO_ICONS[i % INFO_ICONS.length]}</span>
                      {s}
                    </div>
                  ))}
                  <div className="mt-3 p-2.5 bg-[#f5f6f8] rounded-lg text-[10px] text-[#aaa] leading-relaxed">
                    공시기준 기반 자동 추천
                    <br />
                    {selectedPage.standards.slice(0, 3).join(', ')}
                  </div>
                  <div className="mt-4 p-2.5 bg-white border border-[#e4e6ea] rounded-lg">
                    <div className="text-[10px] font-bold text-[#666] mb-1.5">페이지 완성도</div>
                    <div className="flex flex-col gap-1">
                      {[
                        { label: '본문', done: !!currentText },
                        { label: '시각화', done: currentBlocks.length > 0 },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`flex items-center gap-1.5 text-[11px] ${
                            item.done ? 'text-[#2d6a4f]' : 'text-[#bbb]'
                          }`}
                        >
                          <span>{item.done ? '✅' : '⭕'}</span> {item.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
