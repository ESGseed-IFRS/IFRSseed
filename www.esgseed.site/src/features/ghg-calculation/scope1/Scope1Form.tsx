'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Factory, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { EmissionData, Scope1FormData, StationaryFuelKey, MobileFuelKey, DataQuality } from '../types/ghg.types';
import { calcScope1Mobile, calcScope1Stationary, tryMapScope1FuelKey } from '../utils/emissionFactors';
import { useGHGStore } from '../store/ghg.store';
import { MethodologyDetailPanel } from '../components/MethodologyDetailPanel';
import { DataQualityDialog, DEFAULT_DATA_QUALITY } from '../components/DataQualityDialog';
import { DATA_QUALITY_TYPE_OPTIONS } from '../components/DataQualityDialog';
import { CalculationDetailDialog } from '../components/CalculationDetailDialog';

interface Scope1FormProps {
  /** 폼 데이터 */
  formData: Scope1FormData;
  /** 폼 데이터 변경 콜백 */
  onDataChange: (data: Scope1FormData) => void;
  /** 사업장 목록 */
  facilities: string[];
  /** 선택된 년도 */
  selectedYear?: number;
}

/**
 * Scope 1 폼 컴포넌트
 * 고정연소 및 이동연소 배출량 입력 폼
 */
export function Scope1Form({
  formData,
  onDataChange,
  facilities,
  selectedYear = new Date().getFullYear(),
}: Scope1FormProps) {
  const factorYear = useGHGStore((s) => s.factorYear);
  // 고정연소 연료 옵션
  const stationaryFuelOptions: { value: StationaryFuelKey; label: string; unit: string }[] = [
    { value: 'lng', label: '도시가스(LNG)', unit: 'Nm³' },
    { value: 'diesel', label: '경유', unit: 'L' },
    { value: 'gasoline', label: '휘발유', unit: 'L' },
    { value: 'lpg', label: 'LPG', unit: 'kg' },
    { value: 'bunkerC', label: '벙커유(중유)', unit: 'ton' },
    { value: 'anthracite', label: '무연탄', unit: 'ton' },
  ];

  // 이동연소 연료 옵션
  const mobileFuelOptions: { value: MobileFuelKey; label: string; unit: string }[] = [
    { value: 'diesel', label: '경유(차량)', unit: 'L' },
    { value: 'gasoline', label: '휘발유(차량)', unit: 'L' },
  ];

  const [dataQualityDialogRowId, setDataQualityDialogRowId] = useState<string | null>(null);
  const [dataQualityDialogTarget, setDataQualityDialogTarget] = useState<'stationary' | 'mobile' | null>(null);
  const [detailDialogRowId, setDetailDialogRowId] = useState<string | null>(null);
  const [detailDialogTarget, setDetailDialogTarget] = useState<'stationary' | 'mobile' | null>(null);

  const getDataQualityLabel = (dq: DataQuality | undefined) =>
    DATA_QUALITY_TYPE_OPTIONS.find((o) => o.value === (dq?.dataType ?? 'measured'))?.label ?? '실측';

  const handleSaveDataQuality = (target: 'stationary' | 'mobile', id: string, dq: DataQuality) => {
    if (target === 'stationary') {
      const updatedRows = formData.stationary.map((row) =>
        row.id === id ? { ...row, dataQuality: dq } : row
      );
      onDataChange({ ...formData, stationary: updatedRows });
    } else {
      const updatedRows = formData.mobile.map((row) =>
        row.id === id ? { ...row, dataQuality: dq } : row
      );
      onDataChange({ ...formData, mobile: updatedRows });
    }
    setDataQualityDialogRowId(null);
    setDataQualityDialogTarget(null);
  };

  // 고정연소 행 추가
  const handleAddStationaryRow = () => {
    const newRow: EmissionData = {
      id: `stationary-${Date.now()}`,
      year: selectedYear,
      month: new Date().getMonth() + 1,
      facility: facilities[0] || '',
      energySource: stationaryFuelOptions[0].value,
      amount: 0,
      unit: stationaryFuelOptions[0].unit,
      emissions: 0,
      createdAt: new Date(),
      dataQuality: DEFAULT_DATA_QUALITY,
    };
    onDataChange({
      ...formData,
      stationary: [...formData.stationary, newRow],
    });
  };

  // 이동연소 행 추가
  const handleAddMobileRow = () => {
    const newRow: EmissionData = {
      id: `mobile-${Date.now()}`,
      year: selectedYear,
      month: new Date().getMonth() + 1,
      facility: facilities[0] || '',
      energySource: mobileFuelOptions[0].value,
      amount: 0,
      unit: mobileFuelOptions[0].unit,
      emissions: 0,
      createdAt: new Date(),
      dataQuality: DEFAULT_DATA_QUALITY,
    };
    onDataChange({
      ...formData,
      mobile: [...formData.mobile, newRow],
    });
  };

  // 고정연소 행 삭제
  const handleDeleteStationaryRow = (id: string) => {
    onDataChange({
      ...formData,
      stationary: formData.stationary.filter((row) => row.id !== id),
    });
    toast.success('행이 삭제되었습니다.');
  };

  // 이동연소 행 삭제
  const handleDeleteMobileRow = (id: string) => {
    onDataChange({
      ...formData,
      mobile: formData.mobile.filter((row) => row.id !== id),
    });
    toast.success('행이 삭제되었습니다.');
  };

  // 고정연소 행 업데이트
  const handleUpdateStationaryRow = (id: string, field: keyof EmissionData, value: any) => {
    const updatedRows = formData.stationary.map((row) => {
      if (row.id === id) {
        const updated = { ...row, [field]: value };
        // 연료 종류 변경 시 단위도 업데이트
        if (field === 'energySource') {
          const mapped = typeof value === 'string' ? (tryMapScope1FuelKey(value) as StationaryFuelKey | null) : null;
          const nextFuel = (mapped || value) as StationaryFuelKey;
          updated.energySource = nextFuel;
          const fuelOption = stationaryFuelOptions.find((opt) => opt.value === nextFuel);
          if (fuelOption) {
            updated.unit = fuelOption.unit;
          }
        }
        const fuel = updated.energySource as StationaryFuelKey;
        updated.emissions = calcScope1Stationary(Number(updated.amount || 0), fuel, factorYear);
        return updated;
      }
      return row;
    });
    onDataChange({
      ...formData,
      stationary: updatedRows,
    });
  };

  // 이동연소 행 업데이트
  const handleUpdateMobileRow = (id: string, field: keyof EmissionData, value: any) => {
    const updatedRows = formData.mobile.map((row) => {
      if (row.id === id) {
        const updated = { ...row, [field]: value };
        // 연료 종류 변경 시 단위도 업데이트
        if (field === 'energySource') {
          const mapped = typeof value === 'string' ? (tryMapScope1FuelKey(value) as MobileFuelKey | null) : null;
          const nextFuel = (mapped || value) as MobileFuelKey;
          updated.energySource = nextFuel;
          const fuelOption = mobileFuelOptions.find((opt) => opt.value === nextFuel);
          if (fuelOption) {
            updated.unit = fuelOption.unit;
          }
        }
        const fuel = updated.energySource as MobileFuelKey;
        updated.emissions = calcScope1Mobile(Number(updated.amount || 0), fuel, factorYear);
        return updated;
      }
      return row;
    });
    onDataChange({
      ...formData,
      mobile: updatedRows,
    });
  };

  // 총 배출량 계산
  const totalStationaryEmissions = formData.stationary.reduce(
    (sum, row) => sum + (row.emissions || 0),
    0
  );
  const totalMobileEmissions = formData.mobile.reduce(
    (sum, row) => sum + (row.emissions || 0),
    0
  );
  const totalEmissions = totalStationaryEmissions + totalMobileEmissions;

  const openDataQualityDialog = (target: 'stationary' | 'mobile', rowId: string) => {
    setDataQualityDialogTarget(target);
    setDataQualityDialogRowId(rowId);
  };

  const currentDqRow =
    dataQualityDialogRowId && dataQualityDialogTarget
      ? dataQualityDialogTarget === 'stationary'
        ? formData.stationary.find((r) => r.id === dataQualityDialogRowId)
        : formData.mobile.find((r) => r.id === dataQualityDialogRowId)
      : null;

  const detailRow =
    detailDialogRowId && detailDialogTarget
      ? detailDialogTarget === 'stationary'
        ? formData.stationary.find((r) => r.id === detailDialogRowId)
        : formData.mobile.find((r) => r.id === detailDialogRowId)
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">Scope 1 배출량 입력</CardTitle>
            <CardDescription className="text-xs">
              고정연소 및 이동연소 배출량을 입력하세요. 데이터 유형(실측/추정)과 가정을 기록하면 감사·검증 대응에 유리합니다.
            </CardDescription>
          </div>
          <MethodologyDetailPanel scope="scope1" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* 총 배출량 요약 */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg border">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">고정연소</div>
            <div className="text-xl font-bold">{totalStationaryEmissions.toFixed(3)}</div>
            <div className="text-[10px] text-muted-foreground">tCO2e</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">이동연소</div>
            <div className="text-xl font-bold">{totalMobileEmissions.toFixed(3)}</div>
            <div className="text-[10px] text-muted-foreground">tCO2e</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Scope 1 총계</div>
            <div className="text-xl font-bold text-primary">{totalEmissions.toFixed(3)}</div>
            <div className="text-[10px] text-muted-foreground">tCO2e</div>
          </div>
        </div>

        {/* 탭: 고정연소 / 이동연소 */}
        <Tabs defaultValue="stationary" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stationary" className="flex items-center gap-2">
              <Factory className="h-4 w-4" />
              고정연소
            </TabsTrigger>
            <TabsTrigger value="mobile" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              이동연소
            </TabsTrigger>
          </TabsList>

          {/* 고정연소 탭 */}
          <TabsContent value="stationary" className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">고정연소 데이터</Label>
              <Button onClick={handleAddStationaryRow} size="sm" className="h-8 text-xs">
                <Plus className="h-3 w-3 mr-1.5" />
                행 추가
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">월</TableHead>
                      <TableHead className="w-32">사업장</TableHead>
                      <TableHead className="w-40">연료 종류</TableHead>
                      <TableHead className="w-32">사용량</TableHead>
                      <TableHead className="w-24">단위</TableHead>
                      <TableHead className="w-28">데이터 품질</TableHead>
                      <TableHead className="w-32">배출량 (tCO2e)</TableHead>
                      <TableHead className="w-20">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.stationary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                          <p className="font-medium mb-1.5">입력된 데이터가 없습니다.</p>
                          <p>[EMS 불러오기] 또는 [엑셀 업로드]로 데이터를 가져오거나, [+ 행 추가]로 직접 입력하세요.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      formData.stationary.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            max="12"
                            value={row.month}
                            onChange={(e) =>
                              handleUpdateStationaryRow(row.id, 'month', parseInt(e.target.value) || 1)
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.facility}
                            onValueChange={(value) =>
                              handleUpdateStationaryRow(row.id, 'facility', value)
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
                          <Select
                            value={row.energySource}
                            onValueChange={(value) =>
                              handleUpdateStationaryRow(row.id, 'energySource', value)
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {stationaryFuelOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.amount || ''}
                            onChange={(e) =>
                              handleUpdateStationaryRow(
                                row.id,
                                'amount',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">{row.unit}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              {getDataQualityLabel(row.dataQuality)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1.5 text-xs"
                              onClick={() => openDataQualityDialog('stationary', row.id)}
                            >
                              설정
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{row.emissions.toFixed(3)}</span>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs text-primary font-normal"
                              onClick={() => {
                                setDetailDialogTarget('stationary');
                                setDetailDialogRowId(row.id);
                              }}
                            >
                              왜 이렇게 계산됐는지 상세 보기
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStationaryRow(row.id)}
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
          </TabsContent>

          {/* 이동연소 탭 */}
          <TabsContent value="mobile" className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">이동연소 데이터</Label>
              <Button onClick={handleAddMobileRow} size="sm" className="h-8 text-xs">
                <Plus className="h-3 w-3 mr-1.5" />
                행 추가
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">월</TableHead>
                      <TableHead className="w-32">사업장</TableHead>
                      <TableHead className="w-40">연료 종류</TableHead>
                      <TableHead className="w-32">사용량</TableHead>
                      <TableHead className="w-24">단위</TableHead>
                      <TableHead className="w-28">데이터 품질</TableHead>
                      <TableHead className="w-32">배출량 (tCO2e)</TableHead>
                      <TableHead className="w-20">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.mobile.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                          <p className="font-medium mb-1.5">입력된 데이터가 없습니다.</p>
                          <p>[EMS 불러오기] 또는 [엑셀 업로드]로 데이터를 가져오거나, [+ 행 추가]로 직접 입력하세요.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      formData.mobile.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            max="12"
                            value={row.month}
                            onChange={(e) =>
                              handleUpdateMobileRow(row.id, 'month', parseInt(e.target.value) || 1)
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.facility}
                            onValueChange={(value) =>
                              handleUpdateMobileRow(row.id, 'facility', value)
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
                          <Select
                            value={row.energySource}
                            onValueChange={(value) =>
                              handleUpdateMobileRow(row.id, 'energySource', value)
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {mobileFuelOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.amount || ''}
                            onChange={(e) =>
                              handleUpdateMobileRow(
                                row.id,
                                'amount',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">{row.unit}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              {getDataQualityLabel(row.dataQuality)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-1.5 text-xs"
                              onClick={() => openDataQualityDialog('mobile', row.id)}
                            >
                              설정
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{row.emissions.toFixed(3)}</span>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs text-primary font-normal"
                              onClick={() => {
                                setDetailDialogTarget('mobile');
                                setDetailDialogRowId(row.id);
                              }}
                            >
                              왜 이렇게 계산됐는지 상세 보기
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMobileRow(row.id)}
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
          </TabsContent>
        </Tabs>

        {detailRow && detailDialogRowId && detailDialogTarget && (
          <CalculationDetailDialog
            open={!!detailDialogRowId}
            onOpenChange={(open) => !open && setDetailDialogRowId(null)}
            scope="scope1"
            dataQuality={detailRow.dataQuality}
            rowLabel={`${detailDialogTarget === 'stationary' ? '고정연소' : '이동연소'} · ${detailRow.energySource} ${detailRow.amount} ${detailRow.unit}`}
          />
        )}

        {currentDqRow && dataQualityDialogTarget && dataQualityDialogRowId && (
          <DataQualityDialog
            open={!!dataQualityDialogRowId}
            onOpenChange={(open) => !open && setDataQualityDialogRowId(null)}
            value={currentDqRow.dataQuality}
            onSave={(dq) => handleSaveDataQuality(dataQualityDialogTarget, dataQualityDialogRowId, dq)}
          />
        )}
      </CardContent>
    </Card>
  );
}
