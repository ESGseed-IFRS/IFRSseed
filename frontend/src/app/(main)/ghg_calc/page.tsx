'use client';

import { useState } from "react";
import { GHGCalcLayout } from "./components/layout/GHGCalcLayout";
import type { CalcSubTab, AuditSubTab } from "./components/layout/Sidebar";
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

function AuditContent({ subTab, setAuditSubTab }: { subTab: AuditSubTab; setAuditSubTab: (t: AuditSubTab) => void }) {
  return (
    <AuditTrailPanel
      activeTab={subTab}
      onTabChange={setAuditSubTab}
    />
  );
}

export default function GHGCalcPage() {
  const [mainTab, setMainTab] = useState<'calc' | 'audit' | 'report'>('calc');
  const [calcSubTab, setCalcSubTab] = useState<CalcSubTab>('raw-data');
  const [auditSubTab, setAuditSubTab] = useState<AuditSubTab>('unified');
  const [rawDataCategory, setRawDataCategory] = useState<RawDataCategory>('energy');

  return (
    <GHGCalcLayout
      mainTab={mainTab}
      setMainTab={setMainTab}
      calcSubTab={calcSubTab}
      setCalcSubTab={setCalcSubTab}
      auditSubTab={auditSubTab}
      setAuditSubTab={setAuditSubTab}
      rawDataCategory={rawDataCategory}
      setRawDataCategory={setRawDataCategory}
    >
      {mainTab === "calc" && <CalcContent subTab={calcSubTab} rawDataCategory={rawDataCategory} />}
      {mainTab === "audit" && <AuditContent subTab={auditSubTab} setAuditSubTab={setAuditSubTab} />}
      {mainTab === "report" && <GHGReport />}
    </GHGCalcLayout>
  );
}
