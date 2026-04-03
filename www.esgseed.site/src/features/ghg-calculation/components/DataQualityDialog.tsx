'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import type { DataQuality, DataQualityType } from '../types/ghg.types';

const DATA_QUALITY_TYPE_OPTIONS: { value: DataQualityType; label: string }[] = [
  { value: 'measured', label: '실측' },
  { value: 'estimated', label: '추정' },
  { value: 'supplier', label: '공급자 제공' },
  { value: 'other', label: '기타' },
];

const DEFAULT_DATA_QUALITY: DataQuality = {
  dataType: 'measured',
};

interface DataQualityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: DataQuality | undefined;
  onSave: (dq: DataQuality) => void;
  title?: string;
}

/**
 * 데이터 품질·가정 입력 다이얼로그 (Data Quality & Assumption Layer)
 * 실측/추정/공급자 제공/기타, 추정 방법, 가정 사항
 */
export function DataQualityDialog({
  open,
  onOpenChange,
  value,
  onSave,
  title = '데이터 품질 및 가정',
}: DataQualityDialogProps) {
  const [dataType, setDataType] = useState<DataQualityType>(value?.dataType ?? 'measured');
  const [estimationMethod, setEstimationMethod] = useState(value?.estimationMethod ?? '');
  const [assumptions, setAssumptions] = useState(value?.assumptions ?? '');

  useEffect(() => {
    if (open) {
      setDataType(value?.dataType ?? 'measured');
      setEstimationMethod(value?.estimationMethod ?? '');
      setAssumptions(value?.assumptions ?? '');
    }
  }, [open, value]);

  const handleSave = () => {
    if (dataType === 'estimated' && !estimationMethod.trim()) {
      toast.warning('추정을 선택한 경우 추정 방법을 입력해 주세요. (예: 평균값, 이전연도 보정, 산업평균 등)');
      return;
    }
    onSave({
      dataType,
      estimationMethod: estimationMethod.trim() || undefined,
      assumptions: assumptions.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription>
            ISO 14064-1, IFRS S2 검증 시 필수 요구사항입니다. 입력값의 신뢰도(실측/추정)와 가정을 기록하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">데이터 유형</Label>
            <RadioGroup
              value={dataType}
              onValueChange={(v) => setDataType(v as DataQualityType)}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {DATA_QUALITY_TYPE_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`dq-${opt.value}`} />
                  <Label htmlFor={`dq-${opt.value}`} className="text-sm font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          {dataType === 'estimated' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">추정 방법 (필수)</Label>
              <Input
                placeholder="예: 평균값 / 이전연도 보정 / 산업평균 / 월 평균 사용량 적용"
                value={estimationMethod}
                onChange={(e) => setEstimationMethod(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">추정 선택 시 추정 방법을 입력해야 저장할 수 있습니다.</p>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-sm font-medium">가정 사항 (자유 텍스트)</Label>
            <Textarea
              placeholder="예: 계량기 점검 지연으로 3월 데이터 추정"
              value={assumptions}
              onChange={(e) => setAssumptions(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_DATA_QUALITY, DATA_QUALITY_TYPE_OPTIONS };
