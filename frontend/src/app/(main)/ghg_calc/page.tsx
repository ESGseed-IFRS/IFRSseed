'use client';

import { useState } from "react";
import { GHGCalcLayout } from "./components/layout/GHGCalcLayout";
import { GhgSessionProvider } from "./lib/ghgSession";
import type { CalcSubTab } from "./components/layout/Sidebar";
import type { RawDataCategory } from "./types/ghg";
import { RawDataUpload } from "./components/raw-data/RawDataUpload";
import { AnomalyDetection } from "./components/ghg/AnomalyDetection";
import { EmissionFactorMapping } from "./components/ghg/EmissionFactorMapping";
import { ScopeCalculation } from "./components/ghg/ScopeCalculation";
import { GroupResults } from "./components/ghg/GroupResults";
import { AuditTrailPanel } from "./components/audit/AuditTrailPanel";
import { GHGReport } from "./components/report/GHGReport";

function CalcContent({ subTab, rawDataCategory }: { subTab: CalcSubTab; rawDataCategory: RawDataCategory }) {
  switch (subTab) {
    case "raw-data":
      return <RawDataUpload category={rawDataCategory} />;
    case "anomaly":
      return <AnomalyDetection />;
    case "emission-factor":
      return <EmissionFactorMapping />;
    case "scope-calculation":
      return <ScopeCalculation />;
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

  return (
    <GHGCalcLayout
      mainTab={mainTab}
      setMainTab={setMainTab}
      calcSubTab={calcSubTab}
      setCalcSubTab={setCalcSubTab}
      rawDataCategory={rawDataCategory}
      setRawDataCategory={setRawDataCategory}
    >
      {mainTab === "calc" && <CalcContent subTab={calcSubTab} rawDataCategory={rawDataCategory} />}
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
