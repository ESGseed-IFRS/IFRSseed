'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DP_CARDS_INIT, APPROVALS_INIT, DP_GHG_EDITOR_ID } from './lib/mockSrReport';
import type { SrDpCard, SrDpStatus, SrEditorMode } from './lib/types';
import { SrReportSidebar } from './components/SrReportSidebar';
import { SrReportStandardsEditor } from './components/SrReportStandardsEditor';
import { SrReportGhgEditor } from './components/SrReportGhgEditor';
import { HoldingSrWorkspace } from './components/HoldingSrWorkspace';
import type { HoldingSrTabId } from './lib/types';
import type { SrReportWorkspace } from './components/SrReportModeSwitch';

const DRAFT_STATE_ALLOWED: SrDpStatus[] = ['todo', 'wip', 'submitted', 'approved', 'rejected'];
const STORAGE_KEY = 'sr-report:dpStatusByDpId';

function isDraftState(v: string | null): v is SrDpStatus {
  return v != null && DRAFT_STATE_ALLOWED.includes(v as SrDpStatus);
}

function getEditorFromDp(activeDpId: string): SrEditorMode {
  return activeDpId === DP_GHG_EDITOR_ID ? 'ghg' : 'standards';
}

function editorModeForSubsidiary(modeParam: string | null, activeDpId: string): SrEditorMode {
  if (modeParam === 'ghg') return 'ghg';
  if (modeParam === 'standards') return 'standards';
  return getEditorFromDp(activeDpId);
}

function parseWorkspace(modeParam: string | null): SrReportWorkspace {
  if (modeParam === 'holding') return 'holding';
  return 'subsidiary';
}

function parseHoldingTab(param: string | null): HoldingSrTabId {
  if (param === 'h-write' || param === 'h-gen' || param === 'h-aggregate-write') return param;
  return 'h-aggregate-write';
}

export function SrReportPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dpIdParam = searchParams.get('dpId');
  const modeParam = searchParams.get('mode');
  const draftStateParam = searchParams.get('draftState');
  const holdingTabParam = searchParams.get('holdingTab');

  const workspace = parseWorkspace(modeParam);
  const holdingTab = parseHoldingTab(holdingTabParam);

  const initialDpId = useMemo(() => {
    const valid = dpIdParam && DP_CARDS_INIT.some((c) => c.id === dpIdParam);
    if (valid) return dpIdParam as string;
    const first = DP_CARDS_INIT.find((c) => c.status !== 'approved')?.id ?? DP_CARDS_INIT[0]?.id;
    return first ?? 'd2';
  }, [dpIdParam]);

  const [cards, setCards] = useState<SrDpCard[]>(() => DP_CARDS_INIT.map((c) => ({ ...c })));
  const [activeDpId, setActiveDpId] = useState<string>(initialDpId);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const map = JSON.parse(raw) as Record<string, SrDpStatus>;
      setCards((prev) =>
        prev.map((c) => {
          const stored = map[c.id];
          if (!stored) return c;
          if (stored === 'approved') return { ...c, status: 'approved' };
          if (stored === 'submitted') return { ...c, status: 'submitted' };
          if (stored === 'rejected') return { ...c, status: 'rejected' };
          if (stored === 'wip') return { ...c, status: 'wip' };
          return { ...c, status: 'todo' };
        }),
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!dpIdParam) return;
    if (!DP_CARDS_INIT.some((c) => c.id === dpIdParam)) return;
    setActiveDpId(dpIdParam);
  }, [dpIdParam]);

  useEffect(() => {
    if (!activeDpId) return;
    if (!isDraftState(draftStateParam)) return;
    setCards((prev) => prev.map((c) => (c.id === activeDpId ? { ...c, status: draftStateParam } : c)));
  }, [activeDpId, draftStateParam]);

  const activeCard = cards.find((c) => c.id === activeDpId) ?? cards[0];
  const activeEditorMode = editorModeForSubsidiary(modeParam, activeCard.id);

  const approvals = useMemo(() => APPROVALS_INIT.filter((a) => a.dpId === activeCard.id), [activeCard.id]);

  const pushSubsidiaryQuery = (nextDpId: string, nextEditor?: SrEditorMode) => {
    const editor = nextEditor ?? editorModeForSubsidiary(modeParam, nextDpId);
    router.replace(`/sr-report?dpId=${encodeURIComponent(nextDpId)}&mode=${encodeURIComponent(editor)}`);
  };

  const persistDpStatus = (dpId: string, status: SrDpStatus) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, SrDpStatus>) : {};
      map[dpId] = status;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  };

  const handleSelectDpId = (dpId: string) => {
    setActiveDpId(dpId);
    const nextEditor: SrEditorMode = dpId === DP_GHG_EDITOR_ID ? 'ghg' : 'standards';
    pushSubsidiaryQuery(dpId, nextEditor);
  };

  const handleSelectHoldingTab = (tab: HoldingSrTabId) => {
    router.replace(
      `/sr-report?dpId=${encodeURIComponent(activeDpId)}&mode=holding&holdingTab=${encodeURIComponent(tab)}`,
    );
  };

  const onBack = () => router.push('/dashboard');

  const onSaveText = (dpId: string, nextText: string) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== dpId) return c;
        if (c.status === 'approved') return c;
        const status: SrDpStatus = c.status === 'todo' ? 'wip' : c.status === 'submitted' || c.status === 'rejected' ? 'wip' : c.status;
        persistDpStatus(dpId, status);
        return { ...c, savedText: nextText, status };
      }),
    );
  };

  const onSaveValues = (dpId: string, values: Record<string, string>) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== dpId) return c;
        if (c.status === 'approved') return c;
        const status: SrDpStatus = c.status === 'todo' ? 'wip' : c.status === 'submitted' || c.status === 'rejected' ? 'wip' : c.status;
        persistDpStatus(dpId, status);
        return { ...c, savedText: JSON.stringify(values), status };
      }),
    );
  };

  const onSubmitText = (dpId: string, nextText: string) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== dpId) return c;
        if (c.status === 'approved') return c;
        persistDpStatus(dpId, 'submitted');
        return { ...c, savedText: nextText, status: 'submitted' };
      }),
    );
  };

  const onSubmitValues = (dpId: string, values: Record<string, string>) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== dpId) return c;
        if (c.status === 'approved') return c;
        persistDpStatus(dpId, 'submitted');
        return { ...c, savedText: JSON.stringify(values), status: 'submitted' };
      }),
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: 0,
        background: '#f4f6f4',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <SrReportSidebar
          workspace={workspace}
          cards={cards}
          activeDpId={activeDpId}
          onSelectDpId={handleSelectDpId}
          holdingTab={holdingTab}
          onSelectHoldingTab={handleSelectHoldingTab}
        />

        <main style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex' }}>
          {workspace === 'holding' ? (
            <HoldingSrWorkspace activeTab={holdingTab} onTabChange={handleSelectHoldingTab} />
          ) : activeEditorMode === 'ghg' ? (
            <SrReportGhgEditor
              card={activeCard}
              approvals={approvals}
              onBack={onBack}
              onSaveValues={onSaveValues}
              onSubmitValues={onSubmitValues}
            />
          ) : (
            <SrReportStandardsEditor
              card={activeCard}
              approvals={approvals}
              onBack={onBack}
              onSaveText={onSaveText}
              onSubmitText={onSubmitText}
            />
          )}
        </main>
      </div>
    </div>
  );
}
