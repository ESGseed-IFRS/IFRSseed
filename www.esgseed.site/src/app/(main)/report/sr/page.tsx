'use client';

import { useEffect, useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { useReportStore, type ReportStore } from '@/store/reportStore';
import { useGHGStore } from '@/features/ghg-calculation/store/ghg.store';
import { Layout3Column } from '@/features/report/components/common/Layout3Column';
import { LeftNavTree } from '@/features/report/components/common/LeftNavTree';
import { RightChecklist } from '@/features/report/components/common/RightChecklist';
import { SREditor } from '@/features/report/components/sr/SREditor';
import { srTableOfContents, srPageStandardMappings } from '@/features/report/data/sr-data';
import { extractDisclosureStandards } from '@/features/report/utils/disclosureStandards';
import { useReportLogic } from '@/features/report/hooks/useReportLogic';

/** SR_PAGE_IMPLEMENTATION: 3단 레이아웃 — 목차 / 작성 영역(직접·AI 탭) / 공시기준·준수율·시각화 추천 */

export default function SRReportPage() {
  const tableOfContents = srTableOfContents;
  const pageStandardMappings = srPageStandardMappings;
  const disclosureStandards = useMemo(
    () => extractDisclosureStandards(pageStandardMappings),
    [pageStandardMappings]
  );

  const {
    selectedTocId,
    setSelectedTocId,
    currentPageContent,
    selectedTocItem,
    relevantStandards,
    complianceMatches,
    overallComplianceRate,
    aiGeneratedText,
    aiLoading,
    visualizationRecommendations,
    handleContentChange,
    handleSavePageContent,
    handleGenerateCrawledContent,
    handleUseGeneratedContent,
    handleRegenerateAi,
  } = useReportLogic(tableOfContents, pageStandardMappings, disclosureStandards);

  const companyInfo = useReportStore((s: ReportStore) => s.companyInfo);
  const finalCompanyInfo = useReportStore((s: ReportStore) => s.finalCompanyInfo);
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const scope3 = useGHGStore((s) => s.scope3);
  const ghgHistory = useGHGStore((s) => s.history);

  useEffect(() => {
    if (tableOfContents.length > 0 && !selectedTocId) {
      setSelectedTocId(tableOfContents[0].id);
    }
  }, [tableOfContents, selectedTocId, setSelectedTocId]);

  const setSrCompliance = useDashboardStore((s) => s.setSrCompliance);
  useEffect(() => {
    setSrCompliance(overallComplianceRate, false);
  }, [overallComplianceRate, setSrCompliance]);

  const hasCompanyInfo = !!(finalCompanyInfo ?? companyInfo?.companyName);
  const hasGhgData =
    scope1.stationary.length > 0 ||
    scope1.mobile.length > 0 ||
    scope2.electricity.length > 0 ||
    scope2.heat.length > 0 ||
    scope3.categories.some((c) => c.data.length > 0) ||
    ghgHistory.length > 0;
  const conditionSummary = {
    companyInfo: hasCompanyInfo,
    ghg: hasGhgData,
    erp: false,
  };
  const quantitativeLinked = hasGhgData;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">SR 보고서 작성</h1>
          <p className="text-sm text-muted-foreground">
            목차를 선택한 뒤 직접 작성하거나 AI 문단 생성을 활용하고, 우측에서 공시 기준 준수율을 확인하세요
          </p>
        </div>

        <Layout3Column
          left={
            <LeftNavTree
              items={tableOfContents}
              selectedId={selectedTocId}
              onSelect={setSelectedTocId}
            />
          }
          center={
            <SREditor
              selectedTocItem={selectedTocItem ?? null}
              currentPageContent={currentPageContent ?? null}
              aiGeneratedText={aiGeneratedText}
              aiLoading={aiLoading}
              quantitativeLinked={quantitativeLinked}
              conditionSummary={conditionSummary}
              onContentChange={handleContentChange}
              onSave={handleSavePageContent}
              onGenerateAi={handleGenerateCrawledContent}
              onUseGeneratedContent={handleUseGeneratedContent}
              onRegenerateAi={handleRegenerateAi}
            />
          }
          right={
            <RightChecklist
              selectedTocItem={selectedTocItem ?? null}
              relevantStandards={relevantStandards}
              complianceMatches={complianceMatches}
              pageStandardMappings={pageStandardMappings}
              overallComplianceRate={overallComplianceRate}
              visualizationRecommendations={visualizationRecommendations}
            />
          }
        />
      </div>
    </div>
  );
}
