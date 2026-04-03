'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/** STEP_DETAIL: 셀 클릭 시 수정 사유 입력 모달 */
export interface CellEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  energySource: string;
  month: number;
  value: number;
  dataType?: string;
  viewMode: 'raw' | 'emission';
  onSave?: (params: { value: number; reason: string }) => void;
}

export function CellEditModal({
  open,
  onOpenChange,
  energySource,
  month,
  value,
  dataType,
  viewMode,
  onSave,
}: CellEditModalProps) {
  const [editValue, setEditValue] = useState(String(value));
  const [reason, setReason] = useState('');

  const handleSave = () => {
    const num = parseFloat(editValue);
    if (Number.isFinite(num) && reason.trim()) {
      onSave?.({ value: num, reason: reason.trim() });
      setReason('');
      setEditValue(String(value));
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setEditValue(String(value));
    setReason('');
    onOpenChange(false);
  };

  const unitLabel = viewMode === 'raw' ? '사용량' : 'tCO2e';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={handleClose}>
        <DialogHeader>
          <DialogTitle>데이터 수정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="text-sm text-slate-600">
            <span className="font-semibold">{energySource}</span> · {month}월
            {dataType && <span className="ml-2 text-xs">({dataType})</span>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cell-value">값 ({unitLabel})</Label>
            <Input
              id="cell-value"
              type="number"
              step="any"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cell-reason">수정 사유 (필수)</Label>
            <Textarea
              id="cell-reason"
              placeholder="수정 사유를 입력하세요. (감사·검증 대응)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={!reason.trim()}
            className="bg-[#669900] hover:bg-[#558000]"
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
