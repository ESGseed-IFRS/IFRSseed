'use client';

import type { ComponentType } from 'react';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  SRReportDashboardV3Holding,
  SRReportDashboardV3Subsidiary as SRReportDashboardV3SubsidiaryRaw,
} from '../../../../../../md_files/02_Dashboard/01_SR_dashboard/SRReportDashboard_v3.jsx';

const SRReportDashboardV3Subsidiary = SRReportDashboardV3SubsidiaryRaw as unknown as ComponentType<{
  selectedDpId: string | null;
  selectedFeedbackId: string | null;
  onNavigateToApproval: (opts?: { docId?: string; dpId?: string; menu?: string }) => void;
  onNavigateToSrReport: (dpId: string) => void;
}>;

export type SrHoldingReportNavOpts = {
  holdingTab?: string;
  sectionId?: string;
  dpCode?: string;
  entityId?: string;
  source?: string;
  fiscalYear?: string;
};

const SRReportDashboardV3HoldingTyped = SRReportDashboardV3Holding as unknown as ComponentType<{
  onNavigateToApproval: (opts?: { docId?: string; dpId?: string; menu?: string }) => void;
  onNavigateToSrReportHolding: (opts?: string | SrHoldingReportNavOpts) => void;
}>;

export function DashboardSrTab({
  mode,
  selectedDpId,
  selectedFeedbackId,
}: {
  mode: 'subsidiary' | 'holding';
  selectedDpId: string | null;
  selectedFeedbackId: string | null;
}) {
  const router = useRouter();

  const onNavigateToApproval = useCallback((opts?: { docId?: string; dpId?: string; menu?: string }) => {
    const q = new URLSearchParams();
    q.set('tab', 'approval');
    q.set('domain', 'sr');
    q.set('menu', opts?.menu ?? 'inbox.request');
    if (opts?.docId) q.set('docId', opts.docId);
    if (opts?.dpId) q.set('dpId', opts.dpId);
    router.push(`/dashboard?${q.toString()}`);
  }, [router]);

  const onNavigateToSrReport = useCallback((dpId: string) => {
    router.push(`/sr-report?dpId=${encodeURIComponent(dpId)}&mode=standards`);
  }, [router]);

  const onNavigateToSrReportHolding = useCallback((opts?: string | SrHoldingReportNavOpts) => {
    const q = new URLSearchParams();
    q.set('mode', 'holding');
    if (opts == null || typeof opts === 'string') {
      q.set('holdingTab', typeof opts === 'string' ? opts : 'h-write');
    } else {
      q.set('holdingTab', opts.holdingTab ?? 'h-write');
      if (opts.sectionId) q.set('sectionId', opts.sectionId);
      if (opts.dpCode) q.set('dpCode', opts.dpCode);
      if (opts.entityId) q.set('entityId', opts.entityId);
      if (opts.source) q.set('source', opts.source);
      if (opts.fiscalYear) q.set('fiscalYear', opts.fiscalYear);
    }
    router.push(`/sr-report?${q.toString()}`);
  }, [router]);

  return mode === 'subsidiary' ? (
    <SRReportDashboardV3Subsidiary
      selectedDpId={selectedDpId}
      selectedFeedbackId={selectedFeedbackId}
      onNavigateToApproval={onNavigateToApproval}
      onNavigateToSrReport={onNavigateToSrReport}
    />
  ) : (
    <SRReportDashboardV3HoldingTyped
      onNavigateToApproval={onNavigateToApproval}
      onNavigateToSrReportHolding={onNavigateToSrReportHolding}
    />
  );
}
