'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { EmissionData, Scope3FormData, ReceiptAttachment } from '../types/ghg.types';
import { ReceiptAttachment as ReceiptAttachmentComponent } from '../components/ReceiptAttachment';

interface Scope3FormProps {
  /** 폼 데이터 */
  formData: Scope3FormData;
  /** 폼 데이터 변경 콜백 */
  onDataChange: (data: Scope3FormData) => void;
  /** 사업장 목록 */
  facilities: string[];
  /** 선택된 년도 */
  selectedYear?: number;
}

// Scope 3 카테고리 목록 (예시)
const SCOPE3_CATEGORIES = [
  '구매한 상품 및 서비스',
  '자본재',
  '운송 및 배송 (상향)',
  '운송 및 배송 (하향)',
  '폐기물 처리',
  '출장',
  '직원 통근',
  '임대 자산',
  '투자',
];

/**
 * Scope 3 폼 컴포넌트
 * 기타 간접 배출량 입력 폼 (영수증 첨부 기능 포함)
 */
export function Scope3Form({
  formData,
  onDataChange,
  facilities,
  selectedYear = new Date().getFullYear(),
}: Scope3FormProps) {
  // 카테고리별 행 추가
  const handleAddRow = (category: string) => {
    const categoryIndex = formData.categories.findIndex((cat) => cat.category === category);
    const newRow: EmissionData = {
      id: `scope3-${category}-${Date.now()}`,
      year: selectedYear,
      month: new Date().getMonth() + 1,
      facility: facilities[0] || '',
      energySource: category,
      amount: 0,
      unit: '',
      emissions: 0,
      createdAt: new Date(),
    };

    if (categoryIndex >= 0) {
      // 기존 카테고리 업데이트
      const updatedCategories = [...formData.categories];
      updatedCategories[categoryIndex] = {
        ...updatedCategories[categoryIndex],
        data: [...updatedCategories[categoryIndex].data, newRow],
      };
      onDataChange({ categories: updatedCategories });
    } else {
      // 새 카테고리 추가
      onDataChange({
        categories: [
          ...formData.categories,
          {
            category,
            data: [newRow],
            receipts: [],
          },
        ],
      });
    }
  };

  // 행 삭제
  const handleDeleteRow = (category: string, rowId: string) => {
    const categoryIndex = formData.categories.findIndex((cat) => cat.category === category);
    if (categoryIndex >= 0) {
      const updatedCategories = [...formData.categories];
      updatedCategories[categoryIndex] = {
        ...updatedCategories[categoryIndex],
        data: updatedCategories[categoryIndex].data.filter((row) => row.id !== rowId),
      };
      onDataChange({ categories: updatedCategories });
      toast.success('행이 삭제되었습니다.');
    }
  };

  // 행 업데이트
  const handleUpdateRow = (category: string, rowId: string, field: keyof EmissionData, value: any) => {
    const categoryIndex = formData.categories.findIndex((cat) => cat.category === category);
    if (categoryIndex >= 0) {
      const updatedCategories = [...formData.categories];
      updatedCategories[categoryIndex] = {
        ...updatedCategories[categoryIndex],
        data: updatedCategories[categoryIndex].data.map((row) => {
          if (row.id === rowId) {
            const updated = { ...row, [field]: value };
            // 배출량 계산 (TODO: 실제 배출계수 적용)
            // updated.emissions = calculateEmissions(updated);
            return updated;
          }
          return row;
        }),
      };
      onDataChange({ categories: updatedCategories });
    }
  };

  // 영수증 첨부 완료 핸들러
  const handleReceiptUpload = (category: string, attachments: ReceiptAttachment[]) => {
    const categoryIndex = formData.categories.findIndex((cat) => cat.category === category);
    if (categoryIndex >= 0) {
      const updatedCategories = [...formData.categories];
      updatedCategories[categoryIndex] = {
        ...updatedCategories[categoryIndex],
        receipts: attachments,
      };
      onDataChange({ categories: updatedCategories });
    }
  };

  // 총 배출량 계산
  const totalEmissions = formData.categories.reduce((sum, category) => {
    return sum + category.data.reduce((catSum, row) => catSum + (row.emissions || 0), 0);
  }, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Scope 3 배출량 입력</CardTitle>
        <CardDescription className="text-xs">
          기타 간접 배출량을 입력하고 증빙 자료를 첨부하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* 총 배출량 요약 */}
        <div className="p-3 bg-muted/50 rounded-lg border text-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Scope 3 총 배출량</div>
          <div className="text-2xl font-bold text-primary">{totalEmissions.toFixed(3)}</div>
          <div className="text-[10px] text-muted-foreground">tCO2e</div>
        </div>

        {/* 카테고리별 입력 */}
        <Accordion type="multiple" className="w-full">
          {SCOPE3_CATEGORIES.map((category) => {
            const categoryData = formData.categories.find((cat) => cat.category === category);
            const rows = categoryData?.data || [];
            const receipts = categoryData?.receipts || [];

            return (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{category}</span>
                      {rows.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({rows.length}개 항목)
                        </span>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-3">
                    {/* 행 추가 버튼 */}
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-semibold">데이터 입력</Label>
                      <Button onClick={() => handleAddRow(category)} size="sm" className="h-8 text-xs">
                        <Plus className="h-3 w-3 mr-1.5" />
                        행 추가
                      </Button>
                    </div>

                    {/* 데이터 테이블 — GHG_GRID_EMPTY_STATE_SPEC: 컬럼 헤더 항상 표시 */}
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-20">월</TableHead>
                              <TableHead className="w-32">사업장</TableHead>
                              <TableHead className="w-40">항목</TableHead>
                              <TableHead className="w-32">사용량</TableHead>
                              <TableHead className="w-24">단위</TableHead>
                              <TableHead className="w-32">배출량 (tCO2e)</TableHead>
                              <TableHead className="w-20">작업</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground text-sm">
                                  <p className="font-medium mb-1.5">입력된 데이터가 없습니다.</p>
                                  <p>[EMS 불러오기] 또는 [엑셀 업로드]로 데이터를 가져오거나, [+ 행 추가]로 직접 입력하세요.</p>
                                </TableCell>
                              </TableRow>
                            ) : (
                              rows.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="12"
                                    value={row.month}
                                    onChange={(e) =>
                                      handleUpdateRow(
                                        category,
                                        row.id,
                                        'month',
                                        parseInt(e.target.value) || 1
                                      )
                                    }
                                    className="w-20"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={row.facility}
                                    onValueChange={(value) =>
                                      handleUpdateRow(category, row.id, 'facility', value)
                                    }
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {facilities.map((facility) => (
                                        <SelectItem key={facility} value={facility}>
                                          {facility}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={row.energySource || ''}
                                    onChange={(e) =>
                                      handleUpdateRow(category, row.id, 'energySource', e.target.value)
                                    }
                                    className="w-40"
                                    placeholder="항목명"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={row.amount || ''}
                                    onChange={(e) =>
                                      handleUpdateRow(
                                        category,
                                        row.id,
                                        'amount',
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="w-32"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={row.unit || ''}
                                    onChange={(e) =>
                                      handleUpdateRow(category, row.id, 'unit', e.target.value)
                                    }
                                    className="w-24"
                                    placeholder="단위"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm font-medium">
                                    {row.emissions.toFixed(3)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteRow(category, row.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                            )}
                          </TableBody>
                        </Table>
                      </div>

                    {/* 영수증 첨부 섹션 */}
                    <div className="pt-4 border-t">
                      <ReceiptAttachmentComponent
                        relatedItemId={category}
                        existingAttachments={receipts}
                        onUploadComplete={(attachments) => handleReceiptUpload(category, attachments)}
                        maxFileSize={10}
                        acceptedFileTypes={['image/*', 'application/pdf']}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
