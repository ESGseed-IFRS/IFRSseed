'use client';

import { useState, useCallback } from "react";
import { GHGCalcLayout } from "./components/layout/GHGCalcLayout";
import { GhgSessionProvider } from "./lib/ghgSession";
import type { CalcSubTab } from "./components/layout/Sidebar";
import type { RawDataCategory } from "./types/ghg";
import type { ScopeRecalculateApiResponse } from "./lib/ghgScopeCalculationData";
import { RawDataUpload } from "./components/raw-data/RawDataUpload";
import { AnomalyDetection } from "./components/ghg/AnomalyDetection";
import { EmissionFactorMapping } from "./components/ghg/EmissionFactorMapping";
import { ScopeCalculation } from "./components/ghg/ScopeCalculation";
import { GroupResults } from "./components/ghg/GroupResults";
import { AuditTrailPanel } from "./components/audit/AuditTrailPanel";
import { GHGReport } from "./components/report/GHGReport";

interface CalcContentProps {
  subTab: CalcSubTab;
  rawDataCategory: RawDataCategory;
  scopeApiResponse: ScopeRecalculateApiResponse | null;
  onScopeApiUpdate: (data: ScopeRecalculateApiResponse | null) => void;
}

function CalcContent({ subTab, rawDataCategory, scopeApiResponse, onScopeApiUpdate }: CalcContentProps) {
  switch (subTab) {
    case "raw-data":
      return <RawDataUpload category={rawDataCategory} />;
    case "anomaly":
      return <AnomalyDetection />;
    case "emission-factor":
      return <EmissionFactorMapping apiResponse={scopeApiResponse} />;
    case "scope-calculation":
      return <ScopeCalculation onApiResponseUpdate={onScopeApiUpdate} />;
    case "group-results":
      return <GroupResults />;
    default:
      return <RawDataUpload category={rawDataCategory} />;
  }
}

function AuditContent() {
  return <AuditTrailPanel />;
}

function GHGCalcPageInner() {
  const [mainTab, setMainTab] = useState<'calc' | 'audit' | 'report'>('calc');
  const [calcSubTab, setCalcSubTab] = useState<CalcSubTab>('raw-data');
  const [rawDataCategory, setRawDataCategory] = useState<RawDataCategory>('energy');
  const [scopeApiResponse, setScopeApiResponse] = useState<ScopeRecalculateApiResponse | null>(null);

  const handleScopeApiUpdate = useCallback((data: ScopeRecalculateApiResponse | null) => {
    setScopeApiResponse(data);
  }, []);

  return (
    <GHGCalcLayout
      mainTab={mainTab}
      setMainTab={setMainTab}
      calcSubTab={calcSubTab}
      setCalcSubTab={setCalcSubTab}
      rawDataCategory={rawDataCategory}
      setRawDataCategory={setRawDataCategory}
    >
      {mainTab === "calc" && (
        <CalcContent 
          subTab={calcSubTab} 
          rawDataCategory={rawDataCategory}
          scopeApiResponse={scopeApiResponse}
          onScopeApiUpdate={handleScopeApiUpdate}
        />
      )}
      {mainTab === "audit" && <AuditContent />}
      {mainTab === "report" && <GHGReport />}
    </GHGCalcLayout>
  );
}

export default function GHGCalcPage() {
  return (
    <GhgSessionProvider>
      <GHGCalcPageInner />
    </GhgSessionProvider>
  );
}
