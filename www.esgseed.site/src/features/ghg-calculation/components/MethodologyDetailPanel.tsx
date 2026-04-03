'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import type { MethodologyInfo } from '../types/ghg.types';

export const SCOPE1_METHODOLOGY: MethodologyInfo = {
  methodologyId: 'S1-FUEL-KR-2025',
  guideline: 'GHG Protocol Scope 1',
  method: 'Activity Data × Emission Factor',
  formula: 'CO₂ 배출량(tCO₂e) = 활동자료(사용량) × 배출계수(EF)',
  efSource: '환경부 국가 온실가스 배출계수 (2025 버전)',
  gwp: 'IPCC AR6',
  version: '1.2 (2025-01 업데이트)',
};

export const SCOPE2_ELECTRICITY_METHODOLOGY: MethodologyInfo = {
  methodologyId: 'S2-ELEC-KR-2025',
  guideline: 'GHG Protocol Scope 2',
  method: 'Activity Data × Emission Factor (Location-based)',
  formula: 'CO₂ 배출량(tCO₂e) = 전력 사용량(kWh/MWh) × 그리드 배출계수',
  efSource: '한국전력 거래소·환경부 국가 배출계수',
  gwp: 'IPCC AR6',
  version: '1.2 (2025-01 업데이트)',
};

export const SCOPE2_HEAT_METHODOLOGY: MethodologyInfo = {
  methodologyId: 'S2-HEAT-KR-2025',
  guideline: 'GHG Protocol Scope 2',
  method: 'Activity Data × Emission Factor (열·스팀·온수)',
  formula: 'CO₂ 배출량(tCO₂e) = 열 사용량(GJ/TJ) × 배출계수 (또는 KDHC 지사별 계수 적용)',
  efSource: '공급자 평균 / 국가고유 / KDHC 지사별 계수',
  gwp: 'IPCC AR6',
  version: '1.2 (2025-01 업데이트)',
};

function MethodologyContent({ m }: { m: MethodologyInfo }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 text-sm">
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-muted-foreground font-medium">Methodology ID</span>
          <span className="font-mono font-semibold">{m.methodologyId}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-muted-foreground font-medium">Guideline</span>
          <span>{m.guideline}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-muted-foreground font-medium">Method</span>
          <span>{m.method}</span>
        </div>
        {m.formula && (
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <span className="text-muted-foreground font-medium">산식</span>
            <span className="font-mono text-xs bg-muted/50 px-2 py-1 rounded">{m.formula}</span>
          </div>
        )}
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-muted-foreground font-medium">EF Source</span>
          <span>{m.efSource}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-muted-foreground font-medium">GWP</span>
          <span>{m.gwp}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="text-muted-foreground font-medium">Version</span>
          <span>{m.version}</span>
        </div>
      </div>
      <p className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-md px-3 py-2">
        ✓ 이 설정은 감사 증빙으로 사용 가능합니다.
      </p>
    </div>
  );
}

interface MethodologyDetailPanelProps {
  scope: 'scope1' | 'scope2';
  variant?: 'electricity' | 'heat';
}

/**
 * [산정 방식 상세 보기] 버튼 → Dialog
 * Methodology Layer: 감사 대응용 메타데이터 표시
 */
export function MethodologyDetailPanel({ scope, variant }: MethodologyDetailPanelProps) {
  const methodology =
    scope === 'scope1'
      ? SCOPE1_METHODOLOGY
      : variant === 'heat'
        ? SCOPE2_HEAT_METHODOLOGY
        : SCOPE2_ELECTRICITY_METHODOLOGY;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5">
          <Info className="h-3.5 w-3.5" />
          산정 방식 상세 보기
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">산정 방식 (Methodology)</DialogTitle>
          <DialogDescription>
            가이드라인, 산식, 배출계수(EF) 출처, GWP, 버전을 확인할 수 있습니다. 감사·검증 대응 시 참고하세요. (필수 확인 권장)
          </DialogDescription>
        </DialogHeader>
        <MethodologyContent m={methodology} />
      </DialogContent>
    </Dialog>
  );
}
