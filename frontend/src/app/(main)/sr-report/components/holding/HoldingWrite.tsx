'use client';

import { useState, useEffect } from 'react';
import { BarChart3, PieChart, Table, LineChart, Info } from 'lucide-react';
import { DOT_COLOR } from '../../lib/platformConstants';
import { TOC_ITEMS, MERGED_DATA, VIZ_RECOMMENDATIONS } from '../../lib/platformData';
import { VizPreview } from './VizPreview';
import type { VizItem } from '../../lib/platformTypes';

function Badge({ label, style }: { label: string; style?: { bg: string; color: string } }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
      style={{ background: style?.bg ?? '#F1EFE8', color: style?.color ?? '#5F5E5A' }}
    >
      {label}
    </span>
  );
}

const VIZ_ICONS: Record<string, React.ReactNode> = {
  bar: <BarChart3 className="w-3.5 h-3.5 text-[#185FA5]" />,
  line: <LineChart className="w-3.5 h-3.5 text-[#185FA5]" />,
  pie: <PieChart className="w-3.5 h-3.5 text-[#185FA5]" />,
  table: <Table className="w-3.5 h-3.5 text-[#185FA5]" />,
  infographic: <Info className="w-3.5 h-3.5 text-[#185FA5]" />,
};

interface HoldingWriteProps {
  initialToc?: string | null;
  onInitialTocConsumed?: () => void;
}

export function HoldingWrite({ initialToc, onInitialTocConsumed }: HoldingWriteProps) {
  const [activeToc, setActiveToc] = useState('온실가스 배출');

  useEffect(() => {
    if (initialToc) {
      setActiveToc(initialToc);
      onInitialTocConsumed?.();
    }
  }, [initialToc, onInitialTocConsumed]);
  const [bodyText, setBodyText] = useState(
    '그룹 전체 Scope 1 직접 배출량은 20,660 tCO₂e, Scope 2 간접 배출량은 13,610 tCO₂e로 집계되었습니다. (C법인 데이터 취합 완료 후 최종 확정 예정)\n\nA법인의 Scope 1은 전년 대비 4.2% 감소하였으며, 이는 생산 공정 연료 전환 및 에너지 효율 개선 활동의 결과입니다.'
  );
  const [vizTab, setVizTab] = useState<'추천' | '삽입됨'>('추천');
  const [insertedVizIds, setInsertedVizIds] = useState<string[]>(['v1', 'v4']);
  const [previewViz, setPreviewViz] = useState<VizItem | null>(null);

  const allTocItems = TOC_ITEMS.flatMap((g) => g.items);
  const currentItem = allTocItems.find((t) => t.label === activeToc);
  const linkedMerge = currentItem?.linkedMerge
    ? MERGED_DATA.find((m) => m.id === currentItem.linkedMerge)
    : null;
  const vizList = VIZ_RECOMMENDATIONS[activeToc] ?? [];
  const insertedList = vizList.filter((v) => insertedVizIds.includes(v.id));

  const toggleInsert = (id: string) => {
    setInsertedVizIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* 목차 */}
      <div className="w-[172px] min-w-[172px] bg-white border-r border-[#e8e8e4] flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-[#e8e8e4] text-[10px] font-medium text-[#aaa] uppercase tracking-wider">
          보고서 목차
        </div>
        <div className="flex-1 overflow-y-auto py-1.5">
          {TOC_ITEMS.map((g) => (
            <div key={g.group}>
              <div className="px-3 py-0.5 text-[10px] font-medium text-[#aaa] uppercase tracking-wide">
                {g.group}
              </div>
              {g.items.map((item) => {
                const active = item.label === activeToc;
                const hasViz = !!(VIZ_RECOMMENDATIONS[item.label]);
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setActiveToc(item.label);
                      setPreviewViz(null);
                    }}
                    className={`flex items-center gap-1.5 w-full py-1.5 ${item.sub ? 'pl-5' : 'px-3'} border-none cursor-pointer text-left text-[11px] transition-colors ${
                      active ? 'bg-[#EFF5FC] text-[#185FA5] font-medium' : 'text-[#666] hover:bg-[#f5f5f3]'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: DOT_COLOR[item.dot] }}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.linkedMerge && (
                      <span
                        className="w-1 h-1 rounded-full bg-[#185FA5] shrink-0"
                        title="공시 데이터 연동"
                      />
                    )}
                    {hasViz && <span className="text-[9px] text-[#aaa]">📊</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 에디터 */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="px-4 py-2 bg-white border-b border-[#e8e8e4] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium">{activeToc}</span>
            {[['ISSB ✓', true], ['GRI ✓', true], ['ESRS 미충족', false]].map(([label, ok]) => (
              <span
                key={String(label)}
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  ok ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-[#FCEBEB] text-[#A32D2D]'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex gap-1.5 items-center">
            <span className="text-[11px] text-[#aaa]">v3 · 03-14 저장</span>
            <button className="h-7 px-3 text-xs border border-[#ddd] rounded-md bg-white text-[#333] cursor-pointer hover:bg-[#f5f5f5]">
              미리보기
            </button>
            <button className="h-7 px-3 text-xs rounded-md bg-[#185FA5] text-white border border-[#185FA5] cursor-pointer hover:opacity-90">
              저장
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex gap-0">
          {/* 좌: 본문 에디터 */}
          <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3 bg-[#f8f8f6] min-w-0">
            {linkedMerge && (
              <div className="bg-white border border-[#e8e8e4] rounded-lg overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-[#e8e8e4] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#185FA5] shrink-0" />
                  <span className="text-[11px] font-medium text-[#185FA5]">
                    공시데이터 연동 — {linkedMerge.name}
                  </span>
                  <Badge
                    label={linkedMerge.mergeStatus === '완료' ? '머지완료' : '부분머지'}
                    style={
                      linkedMerge.mergeStatus === '완료'
                        ? { bg: '#EAF3DE', color: '#3B6D11' }
                        : { bg: '#FAEEDA', color: '#633806' }
                    }
                  />
                  <span className="text-[11px] text-[#bbb] ml-auto">{linkedMerge.sources.join(' · ')}</span>
                </div>
                <div className="p-3.5">
                  <div className="text-xs text-[#555] leading-relaxed bg-[#f8f8f6] p-2 rounded-md border border-[#e8e8e4] mb-2">
                    {linkedMerge.merged}
                  </div>
                  <div className="flex gap-1.5">
                    <button className="h-6 px-2 text-[11px] border border-[#B5D4F4] rounded-md bg-[#EFF5FC] text-[#0C447C] cursor-pointer hover:opacity-90">
                      본문에 삽입
                    </button>
                    <button className="h-6 px-2 text-[11px] border border-[#ddd] rounded-md bg-white text-[#333] cursor-pointer hover:bg-[#f5f5f5]">
                      취합 화면으로 이동
                    </button>
                  </div>
                </div>
              </div>
            )}

            {insertedList.length > 0 && (
              <div className="flex flex-col gap-2">
                {insertedList.map((v) => (
                  <div key={v.id} className="bg-white border border-[#e8e8e4] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        {VIZ_ICONS[v.icon] ?? VIZ_ICONS.bar}
                        <span className="text-xs font-medium text-[#333]">{v.label}</span>
                        <Badge label="삽입됨" style={{ bg: '#EAF3DE', color: '#3B6D11' }} />
                      </div>
                      <button
                        className="h-6 px-2 text-[11px] border border-[#F7C1C1] rounded-md text-[#A32D2D] bg-white cursor-pointer hover:bg-[#FCEBEB]"
                        onClick={() => toggleInsert(v.id)}
                      >
                        삭제
                      </button>
                    </div>
                    <VizPreview viz={v} />
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white border border-[#e8e8e4] rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3.5 pt-2.5">
                <span className="text-[11px] font-medium text-[#888]">본문 작성</span>
                <div className="flex gap-1">
                  <button className="h-6 px-2 text-[11px] border border-[#B5D4F4] rounded-md bg-[#EFF5FC] text-[#0C447C] cursor-pointer hover:opacity-90">
                    AI 초안 생성
                  </button>
                  <button className="h-6 px-2 text-[11px] border border-[#ddd] rounded-md bg-white text-[#333] cursor-pointer hover:bg-[#f5f5f5]">
                    근거 파일 첨부
                  </button>
                </div>
              </div>
              <div className="p-3.5">
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={9}
                  className="w-full border border-[#e0e0db] rounded-md p-2 text-xs font-[inherit] text-[#222] bg-[#f8f8f6] resize-none leading-relaxed outline-none"
                />
              </div>
            </div>
          </div>

          {/* 우: 시각화 추천 패널 */}
          <div className="w-[280px] min-w-[280px] border-l border-[#e8e8e4] bg-white flex flex-col overflow-hidden">
            <div className="px-3.5 pt-2.5 border-b border-[#e8e8e4] shrink-0">
              <div className="text-[11px] font-medium text-[#555] mb-2">시각화 추천</div>
              <div className="flex gap-0">
                {(['추천', '삽입됨'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setVizTab(tab)}
                    className={`flex-1 py-1 border-none cursor-pointer text-[11px] font-medium bg-transparent transition-colors ${
                      vizTab === tab ? 'text-[#185FA5] border-b-2 border-[#185FA5]' : 'text-[#aaa] border-b-2 border-transparent'
                    }`}
                  >
                    {tab} {tab === '삽입됨' && `(${insertedList.length})`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5">
              {vizTab === '추천' &&
                (vizList.length > 0 ? (
                  <>
                    <div className="text-[10px] text-[#aaa] mb-2.5 leading-relaxed">
                      <span className="font-medium text-[#185FA5]">{activeToc}</span> 페이지에 적합한 시각화{' '}
                      {vizList.length}종
                    </div>
                    {vizList.map((v) => {
                      const inserted = insertedVizIds.includes(v.id);
                      const isPreviewing = previewViz?.id === v.id;
                      return (
                        <div
                          key={v.id}
                          className={`mb-2.5 border rounded-lg overflow-hidden transition-colors ${
                            inserted ? 'border-[#C0DD97] bg-[#f8fcf5]' : isPreviewing ? 'border-[#185FA5]' : 'border-[#e8e8e4]'
                          }`}
                        >
                          <div className="p-2.5 flex items-center gap-1.5">
                            {VIZ_ICONS[v.icon] ?? VIZ_ICONS.bar}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-xs font-medium text-[#333] truncate">{v.label}</span>
                                {v.urgent && <Badge label="추천" style={{ bg: '#EFF5FC', color: '#0C447C' }} />}
                                {inserted && <Badge label="삽입됨" style={{ bg: '#EAF3DE', color: '#3B6D11' }} />}
                              </div>
                              <div className="text-[10px] text-[#aaa] leading-snug">{v.desc}</div>
                            </div>
                          </div>
                          <div className="px-2.5 pb-2">
                            <button
                              onClick={() => setPreviewViz(isPreviewing ? null : v)}
                              className="w-full h-6 text-[10px] border border-[#e8e8e4] rounded-md bg-[#f8f8f6] text-[#888] cursor-pointer hover:bg-[#eee] mb-2"
                            >
                              {isPreviewing ? '미리보기 닫기' : '미리보기'}
                            </button>
                            {isPreviewing && <VizPreview viz={v} />}
                          </div>
                          <div className="px-2.5 pb-2.5 flex gap-1">
                            <button
                              className={`flex-1 h-7 text-[11px] rounded-md cursor-pointer ${
                                inserted
                                  ? 'bg-[#FCEBEB] text-[#A32D2D] border border-[#F7C1C1]'
                                  : 'bg-[#185FA5] text-white border border-[#185FA5]'
                              }`}
                              onClick={() => toggleInsert(v.id)}
                            >
                              {inserted ? '본문에서 삭제' : '본문에 삽입'}
                            </button>
                            <button className="h-7 px-2 text-[11px] border border-[#ddd] rounded-md bg-white text-[#333] cursor-pointer hover:bg-[#f5f5f5]">
                              편집
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="py-8 text-center text-xs text-[#bbb]">
                    이 페이지에 대한
                    <br />
                    시각화 추천이 없습니다
                  </div>
                ))}
              {vizTab === '삽입됨' &&
                (insertedList.length > 0 ? (
                  insertedList.map((v) => (
                    <div
                      key={v.id}
                      className="mb-2.5 border border-[#C0DD97] rounded-lg overflow-hidden bg-[#f8fcf5]"
                    >
                      <div className="p-2.5 flex items-center gap-1.5">
                        {VIZ_ICONS[v.icon]}
                        <div className="flex-1">
                          <div className="text-xs font-medium text-[#333] mb-0.5">{v.label}</div>
                          <div className="text-[10px] text-[#aaa]">{v.desc}</div>
                        </div>
                      </div>
                      <div className="px-2.5 pb-2.5">
                        <VizPreview viz={v} />
                        <button
                          className="w-full h-6 mt-2 text-[11px] border border-[#F7C1C1] rounded-md text-[#A32D2D] bg-white cursor-pointer hover:bg-[#FCEBEB]"
                          onClick={() => toggleInsert(v.id)}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-[#bbb]">삽입된 시각화가 없습니다</div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
