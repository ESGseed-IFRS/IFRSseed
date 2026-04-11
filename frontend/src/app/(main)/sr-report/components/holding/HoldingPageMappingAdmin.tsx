'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Save, RefreshCw, AlertCircle, Loader2, RotateCcw, Download, Upload } from 'lucide-react';
import { HOLDING_SR_PAGE_DATA, type HoldingSrPageRow } from '../../lib/holdingPageData';
import {
  mergeHoldingSrPagesWithStorage,
  mergePayloadOntoBase,
  upsertPageSrMapping,
  clearPageSrMapping,
  exportSrMappingsJson,
  importSrMappingsJson,
  writeStoredSrMappingsPayload,
  HOLDING_SR_MAPPINGS_CHANGED_EVENT,
  HOLDING_SR_MAPPINGS_STORAGE_KEY,
} from '../../lib/holdingPageMappingsStorage';
import {
  apiGetHoldingSrMappings,
  apiPutHoldingSrMappings,
  DEFAULT_HOLDING_SR_CATALOG_KEY,
  HOLDING_SR_MAPPINGS_COMPANY_ID,
} from '../../lib/holdingPageMappingsApi';

type MappingStatus = 'mapped' | 'partial' | 'unmapped';

type PageMappingRow = HoldingSrPageRow & {
  status: MappingStatus;
  bodyCount: number;
  imageCount: number;
};

function toPageMappingRows(merged: HoldingSrPageRow[]): PageMappingRow[] {
  return merged.map((p) => {
    const bodyCount = (p.srBodyIds || []).filter(Boolean).length;
    const imageCount = (p.srImageIds || []).filter(Boolean).length;
    let status: MappingStatus = 'unmapped';
    if (bodyCount > 0 && imageCount > 0) {
      status = 'mapped';
    } else if (bodyCount > 0 || imageCount > 0) {
      status = 'partial';
    }
    return { ...p, status, bodyCount, imageCount };
  });
}

/**
 * 관리자 UI: 페이지별 SR 본문·이미지 ID 매핑 관리
 * 
 * 기능:
 * - 전체 페이지 목록 및 매핑 상태 표시
 * - 페이지별 srBodyIds, srImageIds 편집
 * - 자동 매핑 생성 (검색 기반)
 * - 매핑 검증 (ID 존재 여부 확인)
 */
function defaultApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:9001').replace(/\/$/, '');
}

export function HoldingPageMappingAdmin() {
  const companyId = HOLDING_SR_MAPPINGS_COMPANY_ID;
  const [pages, setPages] = useState<PageMappingRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPage, setSelectedPage] = useState<PageMappingRow | null>(null);
  const [editBodyIds, setEditBodyIds] = useState<string>('');
  const [editImageIds, setEditImageIds] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const loadMergedRows = useCallback(async (): Promise<HoldingSrPageRow[]> => {
    const apiBase = defaultApiBase();
    if (companyId) {
      const remote = await apiGetHoldingSrMappings(apiBase, companyId, DEFAULT_HOLDING_SR_CATALOG_KEY);
      if (remote) return mergePayloadOntoBase(HOLDING_SR_PAGE_DATA, remote);
      return mergeHoldingSrPagesWithStorage(HOLDING_SR_PAGE_DATA);
    }
    return mergeHoldingSrPagesWithStorage(HOLDING_SR_PAGE_DATA);
  }, [companyId]);

  /** API(성공 시) → 없으면 localStorage → 생성 파일 */
  const reloadMerged = useCallback(async () => {
    const merged = await loadMergedRows();
    setPages(toPageMappingRows(merged));
    setSelectedPage((prev) => {
      if (!prev) return null;
      const row = merged.find((p) => p.page === prev.page);
      return row ? toPageMappingRows([row])[0] : null;
    });
  }, [loadMergedRows]);

  useEffect(() => {
    void reloadMerged();
    const onChanged = () => void reloadMerged();
    window.addEventListener(HOLDING_SR_MAPPINGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(HOLDING_SR_MAPPINGS_CHANGED_EVENT, onChanged);
  }, [reloadMerged]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === HOLDING_SR_MAPPINGS_STORAGE_KEY) void reloadMerged();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reloadMerged]);

  const filtered = pages.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.page.toString().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.section.toLowerCase().includes(q) ||
      p.standards.some((s) => s.toLowerCase().includes(q))
    );
  });

  const stats = {
    total: pages.length,
    mapped: pages.filter((p) => p.status === 'mapped').length,
    partial: pages.filter((p) => p.status === 'partial').length,
    unmapped: pages.filter((p) => p.status === 'unmapped').length,
  };

  const handleSelectPage = (page: PageMappingRow) => {
    setSelectedPage(page);
    setEditBodyIds((page.srBodyIds || []).join('\n'));
    setEditImageIds((page.srImageIds || []).join('\n'));
    setValidationResult(null);
  };

  /** 선택 페이지: DB·localStorage에서 해당 키 제거 → 생성 파일 기본값 */
  const handleRevertToGenerated = async () => {
    if (!selectedPage) return;
    const pageNum = selectedPage.page;
    const key = String(pageNum);
    const apiBase = defaultApiBase();

    if (companyId) {
      const prev = await apiGetHoldingSrMappings(apiBase, companyId, DEFAULT_HOLDING_SR_CATALOG_KEY);
      if (prev?.pages && key in prev.pages) {
        const nextPages = { ...prev.pages };
        delete nextPages[key];
        const out = await apiPutHoldingSrMappings(
          apiBase,
          companyId,
          { version: 1, pages: nextPages },
          DEFAULT_HOLDING_SR_CATALOG_KEY,
        );
        if (out) {
          writeStoredSrMappingsPayload({
            version: 1,
            updatedAt: out.updatedAt || new Date().toISOString(),
            pages: out.pages,
          });
        }
      }
    }
    clearPageSrMapping(pageNum);
    const merged = await loadMergedRows();
    setPages(toPageMappingRows(merged));
    const row = merged.find((p) => p.page === pageNum);
    if (row) {
      setSelectedPage(toPageMappingRows([row])[0]);
      setEditBodyIds((row.srBodyIds || []).join('\n'));
      setEditImageIds((row.srImageIds || []).join('\n'));
    }
    setValidationResult('✅ 이 페이지 매핑을 DB/local에서 제거했습니다. 생성 파일 기본값이 적용됩니다.');
  };

  const handleExportJson = () => {
    const blob = new Blob([exportSrMappingsJson()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holding-sr-mappings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setValidationResult('✅ JSON 파일을 내려받았습니다.');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const result = importSrMappingsJson(text);
      if (result.ok) {
        void reloadMerged();
        setValidationResult('✅ JSON에서 매핑을 불러왔습니다.');
      } else {
        setValidationResult(`❌ 가져오기 실패: ${result.error}`);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleSave = async () => {
    if (!selectedPage) return;
    
    setSaving(true);
    try {
      const bodyIds = editBodyIds
        .split('\n')
        .map((id) => id.trim())
        .filter(Boolean);
      const imageIds = editImageIds
        .split('\n')
        .map((id) => id.trim())
        .filter(Boolean);

      const apiBase = defaultApiBase();
      const mapping = { srBodyIds: bodyIds, srImageIds: imageIds };

      if (companyId) {
        const prev =
          (await apiGetHoldingSrMappings(apiBase, companyId, DEFAULT_HOLDING_SR_CATALOG_KEY)) ?? {
            version: 1 as const,
            updatedAt: '',
            pages: {} as Record<string, { srBodyIds: string[]; srImageIds: string[] }>,
          };
        const pagesMap = { ...prev.pages, [String(selectedPage.page)]: mapping };
        const out = await apiPutHoldingSrMappings(
          apiBase,
          companyId,
          { version: 1, pages: pagesMap },
          DEFAULT_HOLDING_SR_CATALOG_KEY,
        );
        if (out) {
          writeStoredSrMappingsPayload({
            version: 1,
            updatedAt: out.updatedAt || new Date().toISOString(),
            pages: out.pages,
          });
          setValidationResult(
            '✅ DB에 저장했습니다. localStorage에도 동기화했으며 페이지별 작성 화면에 반영됩니다.',
          );
        } else {
          upsertPageSrMapping(selectedPage.page, mapping);
          setValidationResult(
            '⚠️ DB 저장에 실패했습니다. localStorage에만 저장했습니다. API·마이그레이션을 확인하세요.',
          );
        }
      } else {
        upsertPageSrMapping(selectedPage.page, mapping);
        setValidationResult('✅ localStorage에 저장했습니다.');
      }
      await reloadMerged();
    } catch (error) {
      setValidationResult(`❌ 저장 실패: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoMapping = async () => {
    if (!selectedPage) return;
    
    setValidating(true);
    setValidationResult('🔍 자동 매핑 생성 중...');
    
    try {
      const apiBase = defaultApiBase();
      const response = await fetch(`${apiBase}/ifrs-agent/admin/mapping/auto-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          company_id: companyId,
          pages: [selectedPage].map(p => ({
            page: p.page,
            title: p.title,
            section: p.section,
          })),
          year: 2024,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }
      
      const data = await response.json();
      const mapping = data.mappings?.[0];
      
      if (mapping && mapping.sr_body_id) {
        setEditBodyIds(mapping.sr_body_id);
        setValidationResult(
          `✅ 자동 매핑 완료\n` +
          `Body ID: ${mapping.sr_body_id}\n` +
          `Page: ${mapping.page_number}\n` +
          `신뢰도: ${(mapping.confidence * 100).toFixed(0)}%`
        );
      } else {
        setValidationResult(`⚠️ 매핑 실패: ${mapping?.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      setValidationResult(`❌ 자동 매핑 실패: ${error}`);
    } finally {
      setValidating(false);
    }
  };

  const handleValidate = async () => {
    if (!selectedPage) return;
    
    setValidating(true);
    setValidationResult(null);
    
    try {
      const bodyIds = editBodyIds
        .split('\n')
        .map((id) => id.trim())
        .filter(Boolean);
      const imageIds = editImageIds
        .split('\n')
        .map((id) => id.trim())
        .filter(Boolean);
      
      const apiBase = defaultApiBase();
      const response = await fetch(`${apiBase}/ifrs-agent/admin/mapping/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          body_ids: bodyIds,
          image_ids: imageIds,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }
      
      const data = await response.json();
      
      const bodyResults = data.body_results || [];
      const imageResults = data.image_results || [];
      
      const bodyValid = bodyResults.filter((r: any) => r.exists).length;
      const bodyInvalid = bodyResults.filter((r: any) => !r.exists).length;
      const imageValid = imageResults.filter((r: any) => r.exists).length;
      const imageInvalid = imageResults.filter((r: any) => !r.exists).length;
      
      let message = data.valid ? '✅ 검증 통과\n' : '❌ 검증 실패\n';
      message += `Body IDs: ${bodyValid}개 존재, ${bodyInvalid}개 없음\n`;
      if (imageIds.length > 0) {
        message += `Image IDs: ${imageValid}개 존재, ${imageInvalid}개 없음\n`;
      }
      
      if (!data.valid) {
        const invalidBodies = bodyResults.filter((r: any) => !r.exists);
        const invalidImages = imageResults.filter((r: any) => !r.exists);
        
        if (invalidBodies.length > 0) {
          message += `\n존재하지 않는 Body IDs:\n${invalidBodies.map((r: any) => `- ${r.id}`).join('\n')}`;
        }
        if (invalidImages.length > 0) {
          message += `\n존재하지 않는 Image IDs:\n${invalidImages.map((r: any) => `- ${r.id}`).join('\n')}`;
        }
      }
      
      setValidationResult(message);
    } catch (error) {
      setValidationResult(`❌ 검증 실패: ${error}`);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6f8]">
      {/* 좌측: 페이지 목록 */}
      <aside className="w-80 shrink-0 bg-white border-r border-[#e4e6ea] flex flex-col">
        <header className="px-4 py-3 border-b border-[#e4e6ea]">
          <h1 className="text-lg font-bold text-[#222] mb-2">매핑 관리</h1>
          <div className="flex gap-2 text-xs text-[#666] mb-3">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#2d6a4f]" />
              완료 {stats.mapped}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
              부분 {stats.partial}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#aaa]" />
              미완 {stats.unmapped}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="페이지·제목 검색..."
              className="w-full pl-9 pr-3 py-2 bg-[#f5f6f8] border border-[#e4e6ea] rounded-md text-xs outline-none"
            />
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto">
          {filtered.map((page) => {
            const active = selectedPage?.page === page.page;
            const statusColor =
              page.status === 'mapped'
                ? 'bg-[#2d6a4f]'
                : page.status === 'partial'
                  ? 'bg-[#f59e0b]'
                  : 'bg-[#aaa]';
            
            return (
              <div
                key={page.page}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectPage(page)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectPage(page);
                  }
                }}
                className={`px-3.5 py-2.5 border-l-[3px] cursor-pointer transition-colors outline-none ${
                  active
                    ? 'border-[#2d6a4f] bg-[#f0faf3]'
                    : 'border-transparent hover:bg-[#fafafa]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-mono font-bold ${active ? 'text-[#2d6a4f]' : 'text-[#aaa]'}`}>
                        P.{page.page}
                      </span>
                      <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                    </div>
                    <div className={`text-xs leading-snug ${active ? 'text-[#2d6a4f] font-semibold' : 'text-[#444]'}`}>
                      {page.title}
                    </div>
                    <div className="text-[10px] text-[#999] mt-0.5">
                      Body: {page.bodyCount} · Image: {page.imageCount}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* 우측: 매핑 편집 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedPage ? (
          <div className="flex-1 flex items-center justify-center text-[#ccc]">
            <div className="text-center">
              <div className="text-5xl mb-3">🗂️</div>
              <div className="text-sm text-[#bbb]">좌측에서 페이지를 선택하세요</div>
            </div>
          </div>
        ) : (
          <>
            <header className="shrink-0 px-6 py-4 border-b border-[#e4e6ea] bg-white">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="text-[10px] text-[#aaa] font-mono mb-1">
                    PAGE {selectedPage.page} · {selectedPage.section}
                  </div>
                  <h2 className="text-lg font-bold text-[#222]">{selectedPage.title}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedPage.standards.slice(0, 5).map((s, i) => (
                      <span key={i} className="text-[10px] bg-[#edf5ef] text-[#2d6a4f] rounded-full px-2 py-0.5">
                        {s}
                      </span>
                    ))}
                    {selectedPage.standards.length > 5 && (
                      <span className="text-[10px] text-[#999]">+{selectedPage.standards.length - 5}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end max-w-[min(100%,520px)]">
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#444] bg-white border border-[#e4e6ea] rounded-md hover:bg-[#fafafa]"
                  >
                    <Download className="w-4 h-4" />
                    JSON보내기
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#444] bg-white border border-[#e4e6ea] rounded-md hover:bg-[#fafafa]"
                  >
                    <Upload className="w-4 h-4" />
                    JSON 가져오기
                  </button>
                  <button
                    type="button"
                    onClick={handleRevertToGenerated}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#92400e] bg-[#fffbeb] border border-[#fcd34d] rounded-md hover:bg-[#fef3c7]"
                  >
                    <RotateCcw className="w-4 h-4" />
                    저장 제거
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoMapping}
                    disabled={validating}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#2d6a4f] bg-[#edf5ef] rounded-md hover:bg-[#d8f3dc] disabled:opacity-60"
                  >
                    {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    자동 매핑
                  </button>
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={validating}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#666] bg-[#f5f6f8] rounded-md hover:bg-[#e4e6ea] disabled:opacity-60"
                  >
                    {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                    검증
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#2d6a4f] rounded-md hover:bg-[#1b4332] disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    localStorage 저장
                  </button>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="max-w-4xl space-y-6">
                {/* SR Body IDs */}
                <div>
                  <label className="block text-sm font-bold text-[#222] mb-2">
                    SR Body IDs
                    <span className="ml-2 text-xs font-normal text-[#666]">
                      (sr_report_body 테이블 ID, 줄바꿈으로 구분, 첫 줄=2024년, 둘째 줄=2023년)
                    </span>
                  </label>
                  <textarea
                    value={editBodyIds}
                    onChange={(e) => setEditBodyIds(e.target.value)}
                    placeholder={`1906c30e-171f-4e81-b8ac-4a53618e536a\n662a48e0-e3b0-48cb-b3ae-c9ad193c928a`}
                    className="w-full h-32 border border-[#dde1e7] rounded-lg px-4 py-3 text-xs font-mono leading-relaxed resize-y outline-none bg-[#fafafa]"
                  />
                </div>

                {/* SR Image IDs */}
                <div>
                  <label className="block text-sm font-bold text-[#222] mb-2">
                    SR Image IDs
                    <span className="ml-2 text-xs font-normal text-[#666]">
                      (sr_report_images 테이블 ID, 줄바꿈으로 구분, 비어있으면 page_number 기반 자동 조회)
                    </span>
                  </label>
                  <textarea
                    value={editImageIds}
                    onChange={(e) => setEditImageIds(e.target.value)}
                    placeholder="선택적 - 비워두면 page_number로 자동 조회됩니다"
                    className="w-full h-24 border border-[#dde1e7] rounded-lg px-4 py-3 text-xs font-mono leading-relaxed resize-y outline-none bg-[#fafafa]"
                  />
                </div>

                {/* 검증 결과 */}
                {validationResult && (
                  <div
                    className={`p-4 rounded-lg text-xs whitespace-pre-wrap ${
                      validationResult.startsWith('✅')
                        ? 'bg-[#d8f3dc] text-[#1b4332] border border-[#95d5b2]'
                        : validationResult.startsWith('❌')
                          ? 'bg-[#fee2e2] text-[#7f1d1d] border border-[#fca5a5]'
                          : 'bg-[#fff8e6] text-[#8a6d3b] border border-[#f0d78c]'
                    }`}
                  >
                    {validationResult}
                  </div>
                )}

                {/* 사용 안내 */}
                <div className="p-4 bg-[#f0f7fb] border border-[#bdd7ea] rounded-lg text-xs text-[#457b9d]">
                  <div className="font-bold mb-2">💡 저장 위치</div>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>
                      <strong>localStorage 키:</strong> <code className="bg-white/80 px-1 rounded">{HOLDING_SR_MAPPINGS_STORAGE_KEY}</code> — 이 브라우저에만 보관됩니다.
                    </li>
                    <li>
                      <strong>페이지별 작성</strong> 화면은 같은 브라우저에서 위 저장본과 생성 파일(
                      <code className="bg-white/80 px-1 rounded">holdingSrSds2024Pages.generated.ts</code>)을 병합해 표시합니다.
                    </li>
                    <li>
                      <strong>저장 제거</strong>는 해당 페이지의 오버레이만 삭제합니다. 생성 파일에 박혀 있는 기본 ID는 그대로 남습니다.
                    </li>
                    <li>배포·다른 PC와 공유하려면 <strong>JSON보내기/가져오기</strong>를 사용하세요.</li>
                    <li>직접 참조: Body ID가 있으면 빠른 조회 · 없으면 검색 폴백 · 이미지 ID는 선택(없으면 페이지 기준 조회).</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
