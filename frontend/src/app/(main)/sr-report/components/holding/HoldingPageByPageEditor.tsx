'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, GripVertical, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fetchWithAuthJson, useAuthSessionStore } from '@/store/authSessionStore';
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

type LayoutBlock =
  | { kind: 'paragraph'; text?: string }
  | { kind: 'table'; markdown?: string; note?: string }
  | {
      kind: 'image_recommendation';
      image_ref?: string;
      role?: string;
      placement_hint?: string;
      rationale_ko?: string;
    };

type CreateReportResponse = {
  workflow_id?: string;
  status?: string;
  generated_text?: string;
  validation?: { is_valid?: boolean; errors?: string[]; warnings?: string[] };
  layout?: { version?: number; blocks?: LayoutBlock[] };
  image_recommendations?: Array<{
    image_ref?: string;
    role?: string;
    placement_hint?: string;
    rationale_ko?: string;
  }>;
  error?: string | null;
};

type SortableSectionHeaderProps = {
  section: string;
  onAddPage: (section: string) => void;
};

function SortableSectionHeader({ section, onAddPage }: SortableSectionHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `sec:${section}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between gap-2 px-3.5 pt-2.5 pb-1">
      <div className="text-[10px] font-bold text-[#aaa] tracking-widest uppercase flex items-center gap-1.5">
        <span
          className="inline-flex items-center cursor-grab active:cursor-grabbing text-[#bbb]"
          title="섹션 드래그"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
        {section}
      </div>
      <button
        type="button"
        onClick={() => onAddPage(section)}
        className="text-[10px] font-bold text-[#bbb] hover:text-[#2d6a4f] inline-flex items-center gap-1"
        title="이 섹션에 페이지 추가"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

type SortablePageItemProps = {
  page: HoldingSrPageRow;
  active: boolean;
  editing: boolean;
  hasText: boolean;
  blockCount: number;
  editingTitleValue: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onRemove: () => void;
  onTitleChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
};

function SortablePageItem({
  page,
  active,
  editing,
  hasText,
  blockCount,
  editingTitleValue,
  onSelect,
  onStartEdit,
  onRemove,
  onTitleChange,
  onSaveEdit,
  onCancelEdit,
}: SortablePageItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `page:${page.page}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`w-full text-left px-3.5 py-2 cursor-pointer border-l-[3px] transition-colors outline-none ${
        active ? 'border-[#2d6a4f] bg-[#f0faf3]' : 'border-transparent bg-transparent hover:bg-[#fafafa]'
      }`}
    >
      <div className="flex justify-between items-center">
        <span className={`text-[10px] font-mono font-semibold ${active ? 'text-[#2d6a4f]' : 'text-[#aaa]'}`}>
          P.{page.page}
        </span>
        <div className="flex gap-0.5 items-center">
          <span
            className="inline-flex items-center p-1 text-[#aaa] cursor-grab active:cursor-grabbing"
            title="페이지 드래그"
            {...attributes}
            {...listeners}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>
          {hasText && (
            <span className="text-[9px] bg-[#edf5ef] text-[#2d6a4f] rounded-md px-1 py-px">
              문단
            </span>
          )}
          {blockCount > 0 && (
            <span className="text-[9px] bg-[#fff3e8] text-[#c06020] rounded-md px-1 py-px">
              +{blockCount}
            </span>
          )}
          <span className="w-1" />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartEdit();
            }}
            className="p-1 rounded hover:bg-white/60"
            title="제목 수정"
          >
            <Pencil className="w-3.5 h-3.5 text-[#aaa]" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded hover:bg-white/60"
            title="페이지 삭제"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#aaa]" />
          </button>
        </div>
      </div>
      {editing ? (
        <div className="mt-1 flex items-center gap-1.5">
          <input
            value={editingTitleValue}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex-1 bg-white border border-[#e4e6ea] rounded-md px-2 py-1 text-xs outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSaveEdit();
            }}
            className="p-1 rounded hover:bg-white/60"
            title="저장"
          >
            <Check className="w-4 h-4 text-[#2d6a4f]" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancelEdit();
            }}
            className="p-1 rounded hover:bg-white/60"
            title="취소"
          >
            <X className="w-4 h-4 text-[#aaa]" />
          </button>
        </div>
      ) : (
        <div
          className={`text-xs mt-0.5 leading-snug ${
            active ? 'text-[#2d6a4f] font-bold' : 'text-[#444] font-normal'
          }`}
        >
          {page.title}
        </div>
      )}
    </div>
  );
}

export function HoldingPageByPageEditor({ initialKeyword, onInitialKeywordConsumed }: Props) {
  const apiBase = process.env.NEXT_PUBLIC_IFRS_AGENT_BASE ?? 'http://localhost:9005';
  const companyId = useAuthSessionStore((s) => s.user?.company_id?.trim() ?? '');
  const [selectedPage, setSelectedPage] = useState<HoldingSrPageRow | null>(null);
  const [search, setSearch] = useState('');
  const [pagesData, setPagesData] = useState<HoldingSrPageRow[]>(() => [...HOLDING_SR_PAGE_DATA]);
  const [pageTexts, setPageTexts] = useState<Record<string, string>>({});
  const [pagePrompts, setPagePrompts] = useState<Record<string, string>>({});
  const [agentReplies, setAgentReplies] = useState<Record<string, string>>({});
  const [agentLayouts, setAgentLayouts] = useState<Record<string, LayoutBlock[]>>({});
  const [blocks, setBlocks] = useState<Record<string, PageContentBlock[]>>({});
  const [activeTab, setActiveTab] = useState<'content' | 'chart' | 'table' | 'infographic'>('content');
  const [generating, setGenerating] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [editingTitlePage, setEditingTitlePage] = useState<number | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [newStandard, setNewStandard] = useState('');
  const [editingStandardIndex, setEditingStandardIndex] = useState<number | null>(null);
  const [editingStandardValue, setEditingStandardValue] = useState('');
  const [infographicEdit, setInfographicEdit] = useState<{
    id: string;
    payload: InfographicBlockPayload;
  } | null>(null);

  useEffect(() => {
    if (!initialKeyword?.trim()) return;
    const found = findPageByKeyword(initialKeyword);
    if (found) {
      const inCurrent = pagesData.find((p) => p.page === found.page) || null;
      setSelectedPage(inCurrent ?? found);
    }
    onInitialKeywordConsumed?.();
  }, [initialKeyword, onInitialKeywordConsumed, pagesData]);

  const sections = useMemo(
    // pagesData의 "등장 순서"를 유지 (Set은 삽입 순서를 유지하지만, 명시적으로 안전하게 생성)
    () => pagesData.reduce<string[]>((acc, p) => (acc.includes(p.section) ? acc : [...acc, p.section]), []),
    [pagesData],
  );
  const filtered = useMemo(
    () =>
      pagesData.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.standards.some((s) => s.toLowerCase().includes(search.toLowerCase())),
      ),
    [search, pagesData],
  );

  const pageKey = selectedPage ? String(selectedPage.page) : null;
  const currentText = pageKey ? pageTexts[pageKey] || '' : '';
  const currentPrompt = pageKey ? pagePrompts[pageKey] || '' : '';
  const currentReply = pageKey ? agentReplies[pageKey] || '' : '';
  const currentLayoutBlocks = pageKey ? agentLayouts[pageKey] || [] : [];
  const currentBlocks = pageKey ? blocks[pageKey] || [] : [];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const visibleSections = useMemo(
    () => sections.filter((sec) => filtered.some((p) => p.section === sec)),
    [sections, filtered],
  );

  function startEditTitle(p: HoldingSrPageRow) {
    setEditingTitlePage(p.page);
    setEditingTitleValue(p.title);
  }

  function cancelEditTitle() {
    setEditingTitlePage(null);
    setEditingTitleValue('');
  }

  function saveEditTitle() {
    if (editingTitlePage == null) return;
    const nextTitle = editingTitleValue.trim();
    if (!nextTitle) return;
    setPagesData((prev) =>
      prev.map((p) => (p.page === editingTitlePage ? { ...p, title: nextTitle } : p)),
    );
    setSelectedPage((prev) =>
      prev && prev.page === editingTitlePage ? { ...prev, title: nextTitle } : prev,
    );
    cancelEditTitle();
  }

  function updateSelectedPageStandards(updater: (prev: string[]) => string[]) {
    if (!selectedPage) return;
    const page = selectedPage.page;
    setPagesData((prev) =>
      prev.map((p) => (p.page === page ? { ...p, standards: updater(p.standards || []) } : p)),
    );
    setSelectedPage((prev) =>
      prev && prev.page === page ? { ...prev, standards: updater(prev.standards || []) } : prev,
    );
  }

  function addStandard() {
    const v = newStandard.trim();
    if (!v) return;
    updateSelectedPageStandards((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setNewStandard('');
  }

  function removeStandard(target: string) {
    updateSelectedPageStandards((prev) => prev.filter((s) => s !== target));
    if (editingStandardValue === target) {
      setEditingStandardIndex(null);
      setEditingStandardValue('');
    }
  }

  function startEditStandard(index: number, value: string) {
    setEditingStandardIndex(index);
    setEditingStandardValue(value);
  }

  function cancelEditStandard() {
    setEditingStandardIndex(null);
    setEditingStandardValue('');
  }

  function saveEditStandard() {
    if (editingStandardIndex == null) return;
    const v = editingStandardValue.trim();
    if (!v) return;
    updateSelectedPageStandards((prev) =>
      prev.map((s, idx) => (idx === editingStandardIndex ? v : s)),
    );
    cancelEditStandard();
  }

  function addPage(section?: string) {
    const nextPage = Math.max(0, ...pagesData.map((p) => p.page)) + 1;
    const nextSection = section || selectedPage?.section || sections[0] || 'NEW';
    const newPage: HoldingSrPageRow = {
      page: nextPage,
      section: nextSection,
      title: `새 페이지 ${nextPage}`,
      standards: [],
    };
    setPagesData((prev) => [...prev, newPage]);
    setSelectedPage(newPage);
    setActiveTab('content');
    // 새 페이지는 텍스트/블록이 없도록 초기화
    setPageTexts((prev) => ({ ...prev, [String(nextPage)]: '' }));
    setBlocks((prev) => ({ ...prev, [String(nextPage)]: [] }));
  }

  function removePage(p: HoldingSrPageRow) {
    const pKey = String(p.page);
    setPagesData((prev) => prev.filter((x) => x.page !== p.page));
    setPageTexts((prev) => {
      const { [pKey]: _, ...rest } = prev;
      return rest;
    });
    setBlocks((prev) => {
      const { [pKey]: _, ...rest } = prev;
      return rest;
    });
    setPagePrompts((prev) => {
      const { [pKey]: _, ...rest } = prev;
      return rest;
    });
    setAgentReplies((prev) => {
      const { [pKey]: _, ...rest } = prev;
      return rest;
    });
    setAgentLayouts((prev) => {
      const { [pKey]: _, ...rest } = prev;
      return rest;
    });
    setSelectedPage((prev) => {
      if (!prev || prev.page !== p.page) return prev;
      // 삭제한 페이지가 선택 중이면 같은 섹션의 다른 페이지로 이동 (없으면 null)
      const fallback =
        pagesData.find((x) => x.section === p.section && x.page !== p.page) ||
        pagesData.find((x) => x.page !== p.page) ||
        null;
      return fallback;
    });
    cancelEditTitle();
  }

  function reorderBySectionOrder(prev: HoldingSrPageRow[], orderedSections: string[]): HoldingSrPageRow[] {
    const bySec = new Map<string, HoldingSrPageRow[]>();
    for (const p of prev) {
      const arr = bySec.get(p.section) || [];
      arr.push(p);
      bySec.set(p.section, arr);
    }
    const rebuilt: HoldingSrPageRow[] = [];
    for (const sec of orderedSections) {
      const arr = bySec.get(sec);
      if (arr?.length) rebuilt.push(...arr);
    }
    return rebuilt.length ? rebuilt : prev;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('sec:') && overId.startsWith('sec:')) {
      const activeSec = activeId.slice(4);
      const overSec = overId.slice(4);
      setPagesData((prev) => {
        const currentOrder = prev.reduce<string[]>(
          (acc, p) => (acc.includes(p.section) ? acc : [...acc, p.section]),
          [],
        );
        const oldIndex = currentOrder.indexOf(activeSec);
        const newIndex = currentOrder.indexOf(overSec);
        if (oldIndex < 0 || newIndex < 0) return prev;
        const nextOrder = arrayMove(currentOrder, oldIndex, newIndex);
        return reorderBySectionOrder(prev, nextOrder);
      });
      return;
    }

    if (activeId.startsWith('page:')) {
      const activePage = Number(activeId.slice(5));
      setPagesData((prev) => {
        const fromIndex = prev.findIndex((p) => p.page === activePage);
        if (fromIndex < 0) return prev;

        if (overId.startsWith('page:')) {
          const overPage = Number(overId.slice(5));
          const toIndex = prev.findIndex((p) => p.page === overPage);
          if (toIndex < 0) return prev;
          const targetSection = prev[toIndex]?.section;
          const base = prev.map((p, idx) =>
            idx === fromIndex && targetSection ? { ...p, section: targetSection } : p,
          );
          return arrayMove(base, fromIndex, toIndex);
        }

        if (overId.startsWith('sec:')) {
          const targetSection = overId.slice(4);
          const moved = { ...prev[fromIndex], section: targetSection };
          const rest = prev.filter((_, idx) => idx !== fromIndex);
          let insertAt = rest.length;
          for (let i = 0; i < rest.length; i += 1) {
            if (rest[i]?.section === targetSection) insertAt = i + 1;
          }
          const out = [...rest];
          out.splice(insertAt, 0, moved);
          return out;
        }

        return prev;
      });
    }
  }

  async function generateText() {
    if (!selectedPage || !pageKey) return;
    if (!companyId) {
      setRequestError('로그인된 회사 ID가 없습니다. 다시 로그인해 주세요.');
      return;
    }
    const resolvedCategory = (selectedPage.title || selectedPage.section || '').trim();
    const resolvedPrompt = (currentPrompt || '').trim();
    const dpIds = Array.from(
      new Set(
        (selectedPage.standards || [])
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
    if (!resolvedCategory) {
      setRequestError('카테고리가 비어 있습니다.');
      return;
    }
    if (!resolvedPrompt) {
      setRequestError('프롬프트를 입력해 주세요.');
      return;
    }

    setGenerating(true);
    setRequestError(null);
    try {
      const res = await fetchWithAuthJson(`${apiBase.replace(/\/$/, '')}/ifrs-agent/reports/create`, {
        method: 'POST',
        jsonBody: {
          company_id: companyId,
          category: resolvedCategory,
          prompt: resolvedPrompt,
          dp_ids: dpIds,
          ref_pages: {},
          max_retries: 3,
        },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText || '요청 실패');
      }

      const body = (await res.json()) as CreateReportResponse;
      if (body.error) throw new Error(body.error);

      const generated = (body.generated_text || '').trim();
      if (generated) {
        setPageTexts((prev) => ({ ...prev, [pageKey]: generated }));
      }

      const layoutBlocks: LayoutBlock[] = Array.isArray(body.layout?.blocks)
        ? body.layout?.blocks || []
        : Array.isArray(body.image_recommendations)
          ? body.image_recommendations.map((r) => ({
              kind: 'image_recommendation' as const,
              image_ref: r.image_ref,
              role: r.role,
              placement_hint: r.placement_hint,
              rationale_ko: r.rationale_ko,
            }))
          : [];
      setAgentLayouts((prev) => ({ ...prev, [pageKey]: layoutBlocks }));

      const replyLines = [
        `workflow_id: ${body.workflow_id ?? '-'}`,
        `status: ${body.status ?? '-'}`,
        `validation: ${body.validation?.is_valid === true ? 'passed' : body.validation?.is_valid === false ? 'failed' : '-'}`,
        body.validation?.errors?.length ? `errors: ${body.validation.errors.join(' | ')}` : 'errors: -',
        generated ? `generated_text: ${generated.slice(0, 220)}${generated.length > 220 ? '…' : ''}` : 'generated_text: -',
        layoutBlocks.length ? `layout_blocks: ${layoutBlocks.length}` : 'layout_blocks: 0',
      ];
      setAgentReplies((prev) => ({ ...prev, [pageKey]: replyLines.join('\n') }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '요청에 실패했습니다.';
      setRequestError(msg);
      setAgentReplies((prev) => ({ ...prev, [pageKey]: `요청 실패\n${msg}` }));
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    setEditingStandardIndex(null);
    setEditingStandardValue('');
    setNewStandard('');
  }, [selectedPage?.page]);

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
          페이지 {pagesData.length}개 · 블록 {totalBlocks}개
        </span>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-64 shrink-0 bg-white border-r border-[#e4e6ea] flex flex-col">
          <div className="px-3.5 pt-3.5 pb-2.5 border-b border-[#f0f0f0]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-[11px] font-bold text-[#2d6a4f] tracking-wide">페이지 목록</div>
              <button
                type="button"
                onClick={() => addPage()}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2d6a4f] hover:opacity-80"
                title="페이지 추가"
              >
                <Plus className="w-3.5 h-3.5" />
                추가
              </button>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="페이지·공시기준 검색..."
              className="w-full bg-[#f5f6f8] border border-[#e4e6ea] rounded-md py-1.5 px-2.5 text-xs text-[#222] outline-none box-border"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={visibleSections.map((sec) => `sec:${sec}`)}
                strategy={verticalListSortingStrategy}
              >
            {visibleSections.map((sec) => {
              const pages = filtered.filter((p) => p.section === sec);
              if (!pages.length) return null;
              return (
                <div key={sec}>
                  <SortableSectionHeader section={sec} onAddPage={addPage} />
                  <SortableContext
                    items={pages.map((p) => `page:${p.page}`)}
                    strategy={verticalListSortingStrategy}
                  >
                  {pages.map((p) => {
                    const pKey = String(p.page);
                    const blkCount = (blocks[pKey] || []).length;
                    const hasText = !!pageTexts[pKey];
                    const active = selectedPage?.page === p.page;
                    const editing = editingTitlePage === p.page;
                    return (
                      <SortablePageItem
                        key={p.page}
                        page={p}
                        active={active}
                        editing={editing}
                        hasText={hasText}
                        blockCount={blkCount}
                        editingTitleValue={editingTitleValue}
                        onSelect={() => {
                          setSelectedPage(p);
                          setActiveTab('content');
                        }}
                        onStartEdit={() => startEditTitle(p)}
                        onRemove={() => removePage(p)}
                        onTitleChange={setEditingTitleValue}
                        onSaveEdit={saveEditTitle}
                        onCancelEdit={cancelEditTitle}
                      />
                    );
                  })}
                  </SortableContext>
                </div>
              );
            })}
              </SortableContext>
            </DndContext>
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
                    <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                      {selectedPage.standards.map((s, idx) => {
                        const isEditing = editingStandardIndex === idx;
                        return isEditing ? (
                          <div key={`edit-${idx}`} className="inline-flex items-center gap-1">
                            <input
                              value={editingStandardValue}
                              onChange={(e) => setEditingStandardValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditStandard();
                                if (e.key === 'Escape') cancelEditStandard();
                              }}
                              className="h-6 min-w-[120px] bg-white border border-[#cfe2d7] rounded-full px-2.5 text-[10px] text-[#2d6a4f] outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={saveEditStandard}
                              className="text-[10px] text-[#2d6a4f] font-semibold hover:underline"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditStandard}
                              className="text-[10px] text-[#999] hover:underline"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <span
                            key={`${s}-${idx}`}
                            className="inline-flex items-center gap-1 text-[10px] bg-[#edf5ef] text-[#2d6a4f] rounded-full px-2 py-0.5"
                          >
                            {s}
                            <button
                              type="button"
                              onClick={() => startEditStandard(idx, s)}
                              className="text-[#2d6a4f] hover:underline"
                              title="DP 수정"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStandard(s)}
                              className="text-[#999] hover:text-[#c06020]"
                              title="DP 삭제"
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                      <div className="inline-flex items-center gap-1">
                        <input
                          value={newStandard}
                          onChange={(e) => setNewStandard(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') addStandard();
                          }}
                          placeholder="DP 추가"
                          className="h-6 w-[120px] bg-white border border-[#e4e6ea] rounded-full px-2.5 text-[10px] outline-none"
                        />
                        <button
                          type="button"
                          onClick={addStandard}
                          className="text-[10px] text-[#2d6a4f] font-semibold hover:underline"
                        >
                          추가
                        </button>
                      </div>
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
                        value={currentPrompt}
                        onChange={(e) =>
                          pageKey &&
                          setPagePrompts((prev) => ({ ...prev, [pageKey]: e.target.value }))
                        }
                        placeholder="생성 프롬프트를 입력하세요. (예: 위 카테고리를 기준으로 인재상/채용절차/대학생 알고리즘 특강 중심으로 작성)"
                        className="w-full min-h-[120px] border border-[#dde1e7] rounded-[10px] py-3 px-4 text-[12px] leading-[1.8] resize-y outline-none text-[#333] bg-[#fffdf9] box-border"
                      />
                      <div className="bg-[#f7fbf8] border border-[#dbe9df] rounded-[10px] p-3.5">
                        <div className="text-[11px] font-bold text-[#2d6a4f] tracking-wide mb-2">
                          문단생성 에이전트 응답
                        </div>
                        <textarea
                          value={currentReply}
                          readOnly
                          placeholder="아직 생성된 에이전트 응답이 없습니다. 상단의 'AI 문단 생성' 버튼을 눌러주세요."
                          className="w-full min-h-[120px] border border-[#dde1e7] rounded-[8px] py-2.5 px-3 text-[12px] leading-[1.7] resize-y outline-none text-[#444] bg-white box-border"
                        />
                        {requestError && (
                          <div className="mt-2 text-[11px] text-[#c06020]">
                            {requestError}
                          </div>
                        )}
                        {currentLayoutBlocks.length > 0 && (
                          <div className="mt-3 border-t border-[#e4e6ea] pt-2.5">
                            <div className="text-[11px] font-bold text-[#2d6a4f] mb-1.5">추천 레이아웃</div>
                            <div className="flex flex-col gap-1.5">
                              {currentLayoutBlocks.map((bl, i) => (
                                <div key={`${bl.kind}-${i}`} className="text-[11px] bg-white border border-[#e4e6ea] rounded-md p-2">
                                  {bl.kind === 'table' && (
                                    <>
                                      <div className="font-semibold text-[#2d6a4f]">표 추천</div>
                                      <div className="text-[#555] whitespace-pre-wrap">{bl.markdown || '-'}</div>
                                      {bl.note && <div className="text-[#888] mt-1">{bl.note}</div>}
                                    </>
                                  )}
                                  {bl.kind === 'image_recommendation' && (
                                    <>
                                      <div className="font-semibold text-[#2d6a4f]">{bl.role || '이미지 추천'}</div>
                                      <div className="text-[#555]">ref: {bl.image_ref || '-'}</div>
                                      <div className="text-[#555]">위치: {bl.placement_hint || '-'}</div>
                                      <div className="text-[#777] mt-1">{bl.rationale_ko || '-'}</div>
                                    </>
                                  )}
                                  {bl.kind === 'paragraph' && (
                                    <>
                                      <div className="font-semibold text-[#2d6a4f]">문단 블록</div>
                                      <div className="text-[#555] whitespace-pre-wrap">{bl.text || '-'}</div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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
