'use client';

import type { ComponentType } from 'react';
import {
  SRReportDashboardV3Holding,
  SRReportDashboardV3Subsidiary as SRReportDashboardV3SubsidiaryRaw,
} from '../../../../../../md_files/02_Dashboard/01_SR_dashboard/SRReportDashboard_v3.jsx';

const SRReportDashboardV3Subsidiary = SRReportDashboardV3SubsidiaryRaw as unknown as ComponentType<{
  selectedDpId: string | null;
  selectedFeedbackId: string | null;
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
  return mode === 'subsidiary' ? (
    <SRReportDashboardV3Subsidiary selectedDpId={selectedDpId} selectedFeedbackId={selectedFeedbackId} />
  ) : (
    <SRReportDashboardV3Holding />
  );
}
