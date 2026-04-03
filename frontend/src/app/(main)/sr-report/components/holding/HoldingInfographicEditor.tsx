'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  getRecommendedInfographicTemplates,
  HOLDING_INFOGRAPHIC_CATALOG,
  type InfographicCatalogEntry,
} from '../../lib/holdingInfographicCatalog';
import {
  DEFAULT_INFOGRAPHIC_PROPS,
  type InfographicBlockPayload,
  type InfographicDataSource,
  type InfographicPropsById,
  type InfographicTemplateId,
} from '../../lib/holdingInfographicTypes';
import { HoldingInfographicSvg } from './HoldingInfographicSvg';

type DraftSetter = Dispatch<SetStateAction<InfographicPropsById[InfographicTemplateId]>>;

type Props = {
  standards: string[];
  onAdd: (b: InfographicBlockPayload) => void;
  onSwitchToFreeChart: () => void;
  /** 본문 블록에서 편집 진입 시 */
  editTarget?: { id: string; payload: InfographicBlockPayload } | null;
  onSaveEdit?: (id: string, payload: InfographicBlockPayload) => void;
  onCancelEdit?: () => void;
};

function buildPayload(
  templateId: InfographicTemplateId,
  props: InfographicPropsById[InfographicTemplateId],
  dataSource: InfographicDataSource,
): InfographicBlockPayload {
  const base = { type: 'infographic' as const, schemaVersion: 1, dataSource };
  switch (templateId) {
    case 'kpi-orbit':
      return { ...base, templateId: 'kpi-orbit', props: props as InfographicPropsById['kpi-orbit'] };
    case 'reduction-timeline':
      return {
        ...base,
        templateId: 'reduction-timeline',
        props: props as InfographicPropsById['reduction-timeline'],
      };
    case 'scope-pyramid':
      return { ...base, templateId: 'scope-pyramid', props: props as InfographicPropsById['scope-pyramid'] };
    case 'icon-kpi-row':
      return { ...base, templateId: 'icon-kpi-row', props: props as InfographicPropsById['icon-kpi-row'] };
    default:
      return { ...base, templateId: 'kpi-orbit', props: props as InfographicPropsById['kpi-orbit'] };
  }
}

export function HoldingInfographicEditor({
  standards,
  onAdd,
  onSwitchToFreeChart,
  editTarget,
  onSaveEdit,
  onCancelEdit,
}: Props) {
  const ordered = useMemo(() => getRecommendedInfographicTemplates(standards), [standards]);
  const [selected, setSelected] = useState<InfographicCatalogEntry | null>(null);
  const [dataSource, setDataSource] = useState<InfographicDataSource>('manual');
  const [draft, setDraft] = useState<InfographicPropsById[InfographicTemplateId]>(
    DEFAULT_INFOGRAPHIC_PROPS['kpi-orbit'],
  );

  useEffect(() => {
    if (!editTarget) return;
    const { payload } = editTarget;
    const entry = HOLDING_INFOGRAPHIC_CATALOG.find((e) => e.templateId === payload.templateId);
    if (entry) setSelected(entry);
    setDataSource(payload.dataSource);
    setDraft(JSON.parse(JSON.stringify(payload.props)) as InfographicPropsById[InfographicTemplateId]);
  }, [editTarget]);

  const previewBlock = useMemo((): InfographicBlockPayload | null => {
    if (!selected) return null;
    return buildPayload(selected.templateId, draft, dataSource);
  }, [selected, draft, dataSource]);

  const selectTemplate = (e: InfographicCatalogEntry) => {
    setSelected(e);
    setDraft(JSON.parse(JSON.stringify(DEFAULT_INFOGRAPHIC_PROPS[e.templateId])));
  };

  const handleAdd = () => {
    if (!selected || !previewBlock) return;
    onAdd(previewBlock);
    setSelected(null);
    setDraft(JSON.parse(JSON.stringify(DEFAULT_INFOGRAPHIC_PROPS['kpi-orbit'])));
  };

  const handleSaveEdit = () => {
    if (!editTarget || !previewBlock || !onSaveEdit) return;
    onSaveEdit(editTarget.id, previewBlock);
    onCancelEdit?.();
  };

  const inp =
    'w-full border border-[#dde1e7] rounded px-2 py-1 text-xs text-[#222] bg-white outline-none focus:border-[#2d6a4f]';

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <p className="text-xs text-[#666] leading-relaxed">
        공시기준에 맞는 <strong className="text-[#2d6a4f]">인포그래픽 템플릿</strong>을 고른 뒤 수치·문구를 수정하고 페이지에
        추가합니다. 자유 형식 차트는 하단 링크를 이용하세요.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
        {ordered.map((e) => (
          <button
            key={e.templateId}
            type="button"
            onClick={() => selectTemplate(e)}
            className={`text-left rounded-lg border p-3 transition-colors ${
              selected?.templateId === e.templateId
                ? 'border-[#2d6a4f] bg-[#f0faf3]'
                : 'border-[#e4e6ea] bg-white hover:bg-[#fafafa]'
            }`}
          >
            <div className="text-[11px] font-bold text-[#222] mb-1">{e.title}</div>
            <div className="text-[10px] text-[#888] line-clamp-2 mb-2">{e.description}</div>
            <ul className="text-[9px] text-[#666] space-y-0.5 list-disc list-inside">
              {e.styleBullets.slice(0, 2).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-1">
              {e.referenceReports.map((r) => (
                <span key={r.name} className="text-[8px] bg-[#f5f6f8] text-[#888] px-1.5 py-px rounded">
                  참고: {r.name} {r.year}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {selected && previewBlock && (
        <div className="flex flex-col lg:flex-row gap-4 border border-[#e4e6ea] rounded-xl p-4 bg-white">
          <div className="flex-1 min-w-0 overflow-x-auto border border-[#f0f0f0] rounded-lg p-3 bg-[#fafafa]">
            <div className="text-[10px] font-bold text-[#888] mb-2">미리보기</div>
            <HoldingInfographicSvg block={previewBlock} />
          </div>
          <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-3">
            <div>
              <div className="text-[10px] font-semibold text-[#666] mb-1">데이터 출처</div>
              <select
                className={inp}
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value as InfographicDataSource)}
              >
                <option value="manual">수동 입력</option>
                <option value="ghg_group_2025">GHG 그룹 산정(샘플 시드)</option>
              </select>
            </div>
            {selected.templateId === 'kpi-orbit' && (
              <KpiOrbitForm draft={draft as InfographicPropsById['kpi-orbit']} setDraft={setDraft as DraftSetter} inp={inp} />
            )}
            {selected.templateId === 'reduction-timeline' && (
              <TimelineForm
                draft={draft as InfographicPropsById['reduction-timeline']}
                setDraft={setDraft as DraftSetter}
                inp={inp}
              />
            )}
            {selected.templateId === 'scope-pyramid' && (
              <PyramidForm draft={draft as InfographicPropsById['scope-pyramid']} setDraft={setDraft as DraftSetter} inp={inp} />
            )}
            {selected.templateId === 'icon-kpi-row' && (
              <IconRowForm draft={draft as InfographicPropsById['icon-kpi-row']} setDraft={setDraft as DraftSetter} inp={inp} />
            )}
            {editTarget ? (
              <div className="flex gap-2 mt-auto pt-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="flex-1 py-2 rounded-lg bg-[#2d6a4f] text-white text-xs font-bold"
                >
                  변경 저장
                </button>
                <button
                  type="button"
                  onClick={() => onCancelEdit?.()}
                  className="px-3 py-2 rounded-lg border border-[#dde1e7] text-xs text-[#666]"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                className="mt-auto py-2.5 rounded-lg bg-[#2d6a4f] text-white text-xs font-bold"
              >
                인포그래픽을 페이지에 추가
              </button>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onSwitchToFreeChart}
        className="text-left text-[11px] text-[#457b9d] underline-offset-2 hover:underline"
      >
        자유 형식 차트·데이터표로 이동 →
      </button>
    </div>
  );
}

function KpiOrbitForm({
  draft,
  setDraft,
  inp,
}: {
  draft: InfographicPropsById['kpi-orbit'];
  setDraft: DraftSetter;
  inp: string;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] text-[#888]">중앙 %</div>
          <input
            className={inp}
            value={draft.centerPct}
            onChange={(e) => setDraft((d) => ({ ...(d as InfographicPropsById['kpi-orbit']), centerPct: e.target.value }))}
          />
        </div>
        <div>
          <div className="text-[9px] text-[#888]">중앙 라벨</div>
          <input
            className={inp}
            value={draft.centerLabel}
            onChange={(e) =>
              setDraft((d) => ({ ...(d as InfographicPropsById['kpi-orbit']), centerLabel: e.target.value }))
            }
          />
        </div>
      </div>
      {draft.scopes.map((s, i) => (
        <div key={i} className="border border-[#eee] rounded p-2 space-y-1">
          <div className="text-[9px] font-semibold text-[#2d6a4f]">Scope {i + 1}</div>
          <input
            className={inp}
            placeholder="라벨"
            value={s.label}
            onChange={(e) => {
              const scopes = [...draft.scopes];
              scopes[i] = { ...scopes[i], label: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['kpi-orbit']), scopes }));
            }}
          />
          <input
            className={inp}
            placeholder="수치"
            value={s.value}
            onChange={(e) => {
              const scopes = [...draft.scopes];
              scopes[i] = { ...scopes[i], value: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['kpi-orbit']), scopes }));
            }}
          />
          <input
            className={inp}
            placeholder="부가 설명"
            value={s.sublabel}
            onChange={(e) => {
              const scopes = [...draft.scopes];
              scopes[i] = { ...scopes[i], sublabel: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['kpi-orbit']), scopes }));
            }}
          />
          <input
            type="color"
            className="h-8 w-full rounded cursor-pointer"
            value={s.color}
            onChange={(e) => {
              const scopes = [...draft.scopes];
              scopes[i] = { ...scopes[i], color: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['kpi-orbit']), scopes }));
            }}
          />
        </div>
      ))}
    </div>
  );
}

function TimelineForm({
  draft,
  setDraft,
  inp,
}: {
  draft: InfographicPropsById['reduction-timeline'];
  setDraft: DraftSetter;
  inp: string;
}) {
  return (
    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
      {draft.points.map((pt, i) => (
        <div key={i} className="grid grid-cols-2 gap-1 border border-[#eee] rounded p-1.5">
          <input
            className={inp}
            placeholder="연도"
            value={pt.year}
            onChange={(e) => {
              const points = [...draft.points];
              points[i] = { ...points[i], year: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['reduction-timeline']), points }));
            }}
          />
          <input
            className={inp}
            placeholder="제목"
            value={pt.title}
            onChange={(e) => {
              const points = [...draft.points];
              points[i] = { ...points[i], title: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['reduction-timeline']), points }));
            }}
          />
          <input
            className={inp}
            placeholder="수치"
            value={pt.value}
            onChange={(e) => {
              const points = [...draft.points];
              points[i] = { ...points[i], value: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['reduction-timeline']), points }));
            }}
          />
          <input
            className={inp}
            placeholder="단위/상태"
            value={pt.status}
            onChange={(e) => {
              const points = [...draft.points];
              points[i] = { ...points[i], status: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['reduction-timeline']), points }));
            }}
          />
        </div>
      ))}
    </div>
  );
}

function PyramidForm({
  draft,
  setDraft,
  inp,
}: {
  draft: InfographicPropsById['scope-pyramid'];
  setDraft: DraftSetter;
  inp: string;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] text-[#666] cursor-pointer">
        <input
          type="checkbox"
          checked={draft.showPct}
          onChange={(e) =>
            setDraft((d) => ({ ...(d as InfographicPropsById['scope-pyramid']), showPct: e.target.checked }))
          }
        />
        비율(%) 표시
      </label>
      {draft.layers.map((layer, i) => (
        <div key={i} className="grid grid-cols-2 gap-1 border border-[#eee] rounded p-1.5">
          <input
            className={inp}
            value={layer.scope}
            onChange={(e) => {
              const layers = [...draft.layers];
              layers[i] = { ...layers[i], scope: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['scope-pyramid']), layers }));
            }}
          />
          <input
            className={inp}
            placeholder="tCO₂e"
            value={layer.value}
            onChange={(e) => {
              const layers = [...draft.layers];
              layers[i] = { ...layers[i], value: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['scope-pyramid']), layers }));
            }}
          />
          <input
            className={inp}
            placeholder="%"
            value={layer.pct}
            onChange={(e) => {
              const layers = [...draft.layers];
              layers[i] = { ...layers[i], pct: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['scope-pyramid']), layers }));
            }}
          />
          <input
            type="color"
            className="h-7 rounded cursor-pointer"
            value={layer.color}
            onChange={(e) => {
              const layers = [...draft.layers];
              layers[i] = { ...layers[i], color: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['scope-pyramid']), layers }));
            }}
          />
        </div>
      ))}
    </div>
  );
}

function IconRowForm({
  draft,
  setDraft,
  inp,
}: {
  draft: InfographicPropsById['icon-kpi-row'];
  setDraft: DraftSetter;
  inp: string;
}) {
  return (
    <div className="space-y-2 max-h-[220px] overflow-y-auto">
      {draft.items.map((it, i) => (
        <div key={i} className="border border-[#eee] rounded p-2 space-y-1">
          <input
            className={inp}
            placeholder="이모지/아이콘"
            value={it.icon}
            onChange={(e) => {
              const items = [...draft.items];
              items[i] = { ...items[i], icon: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['icon-kpi-row']), items }));
            }}
          />
          <input
            className={inp}
            placeholder="제목"
            value={it.title}
            onChange={(e) => {
              const items = [...draft.items];
              items[i] = { ...items[i], title: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['icon-kpi-row']), items }));
            }}
          />
          <div className="grid grid-cols-2 gap-1">
            <input
              className={inp}
              placeholder="%"
              value={it.pct}
              onChange={(e) => {
                const items = [...draft.items];
                items[i] = { ...items[i], pct: e.target.value };
                setDraft((d) => ({ ...(d as InfographicPropsById['icon-kpi-row']), items }));
              }}
            />
            <input
              className={inp}
              placeholder="부제"
              value={it.sub}
              onChange={(e) => {
                const items = [...draft.items];
                items[i] = { ...items[i], sub: e.target.value };
                setDraft((d) => ({ ...(d as InfographicPropsById['icon-kpi-row']), items }));
              }}
            />
          </div>
          <input
            type="color"
            className="h-7 w-full rounded cursor-pointer"
            value={it.color}
            onChange={(e) => {
              const items = [...draft.items];
              items[i] = { ...items[i], color: e.target.value };
              setDraft((d) => ({ ...(d as InfographicPropsById['icon-kpi-row']), items }));
            }}
          />
        </div>
      ))}
    </div>
  );
}
