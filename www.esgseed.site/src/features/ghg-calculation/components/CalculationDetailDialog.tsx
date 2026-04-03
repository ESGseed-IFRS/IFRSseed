'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { DataQuality, MethodologyInfo } from '../types/ghg.types';
import {
  SCOPE1_METHODOLOGY,
  SCOPE2_ELECTRICITY_METHODOLOGY,
  SCOPE2_HEAT_METHODOLOGY,
} from './MethodologyDetailPanel';
import { DATA_QUALITY_TYPE_OPTIONS } from './DataQualityDialog';

function getMethodology(scope: 'scope1' | 'scope2', variant?: 'electricity' | 'heat'): MethodologyInfo {
  if (scope === 'scope1') return SCOPE1_METHODOLOGY;
  return variant === 'heat' ? SCOPE2_HEAT_METHODOLOGY : SCOPE2_ELECTRICITY_METHODOLOGY;
}

function MethodologyBlock({ m }: { m: MethodologyInfo }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground uppercase">산정 방식 (Methodology)</Label>
      <div className="grid gap-2 text-sm rounded-md border bg-muted/30 p-3">
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <span className="text-muted-foreground">Methodology ID</span>
          <span className="font-mono font-medium">{m.methodologyId}</span>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <span className="text-muted-foreground">산식</span>
          <span className="font-mono text-xs">{m.formula || m.method}</span>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <span className="text-muted-foreground">EF Source</span>
          <span>{m.efSource}</span>
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <span className="text-muted-foreground">GWP / Version</span>
          <span>{m.gwp} · {m.version}</span>
        </div>
      </div>
    </div>
  );
}

function DataQualityBlock({ dq }: { dq: DataQuality | undefined }) {
  const dataTypeLabel = DATA_QUALITY_TYPE_OPTIONS.find((o) => o.value === (dq?.dataType ?? 'measured'))?.label ?? '실측';
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground uppercase">데이터 품질 및 가정</Label>
      <div className="grid gap-2 text-sm rounded-md border bg-muted/30 p-3">
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <span className="text-muted-foreground">데이터 유형</span>
          <span>{dataTypeLabel}</span>
        </div>
        {dq?.estimationMethod && (
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <span className="text-muted-foreground">추정 방법</span>
            <span>{dq.estimationMethod}</span>
          </div>
        )}
        {dq?.assumptions && (
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <span className="text-muted-foreground">가정 사항</span>
            <span className="whitespace-pre-wrap">{dq.assumptions}</span>
          </div>
        )}
        {!dq?.dataType && !dq?.estimationMethod && !dq?.assumptions && (
          <p className="text-muted-foreground text-xs">데이터 품질 설정에서 실측/추정·가정을 입력할 수 있습니다.</p>
        )}
      </div>
    </div>
  );
}

interface CalculationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: 'scope1' | 'scope2';
  variant?: 'electricity' | 'heat';
  dataQuality: DataQuality | undefined;
  rowLabel?: string;
}

/**
 * [왜 이렇게 계산됐는지 상세 보기] 다이얼로그
 * 계산 결과 행별로 Methodology + Data Quality 전체 표시 (감사·검증 대응)
 */
export function CalculationDetailDialog({
  open,
  onOpenChange,
  scope,
  variant,
  dataQuality,
  rowLabel,
}: CalculationDetailDialogProps) {
  const methodology = getMethodology(scope, variant);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">왜 이렇게 계산됐는지 (상세 보기)</DialogTitle>
          <DialogDescription>
            {rowLabel ? `해당 행의 산정 방식과 데이터 품질입니다.` : '산정 방식과 데이터 품질을 확인할 수 있습니다. 감사 증빙으로 활용하세요.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <MethodologyBlock m={methodology} />
          <DataQualityBlock dq={dataQuality} />
          <p className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-md px-3 py-2">
            ✓ 이 내용은 감사 증빙으로 사용 가능합니다.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
