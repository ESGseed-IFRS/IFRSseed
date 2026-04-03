'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Trash2, Zap, Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { EmissionData, Scope2FormData, Scope2HeatRow, HeatKey, KdhcBranchKey, GwpPreset, DataQuality, RenewablePerformance } from '../types/ghg.types';
import { calcHeatKDHC, calcHeatStandard, calcScope2Electricity, EMISSION_FACTOR_DB } from '../utils/emissionFactors';
import { useGHGStore } from '../store/ghg.store';
import { MethodologyDetailPanel } from '../components/MethodologyDetailPanel';
import { DataQualityDialog, DEFAULT_DATA_QUALITY } from '../components/DataQualityDialog';
import { DATA_QUALITY_TYPE_OPTIONS } from '../components/DataQualityDialog';
import { CalculationDetailDialog } from '../components/CalculationDetailDialog';

interface Scope2FormProps {
  /** 폼 데이터 */
  formData: Scope2FormData;
  /** 폼 데이터 변경 콜백 */
  onDataChange: (data: Scope2FormData) => void;
  /** 사업장 목록 */
  facilities: string[];
  /** 선택된 년도 */
  selectedYear?: number;
}

// KDHC 지사 옵션
const KDHC_BRANCH_OPTIONS: { value: KdhcBranchKey; label: string }[] = [
  { value: 'metropolitan_link', label: '수도권연계지사' },
  { value: 'cheongju', label: '청주지사' },
  { value: 'sejong', label: '세종지사' },
  { value: 'daegu', label: '대구지사' },
  { value: 'yangsan', label: '양산지사' },
  { value: 'gimhae', label: '김해지사' },
  { value: 'gwangju_jeonnam', label: '광주전남지사' },
  { value: 'pyeongtaek', label: '평택지사' },
];

// GWP 프리셋 옵션
const GWP_PRESET_OPTIONS: { value: GwpPreset; label: string }[] = [
  { value: 'AR6_fossil', label: 'IPCC AR6 (화석연료)' },
  { value: 'AR6_nonfossil', label: 'IPCC AR6 (비화석연료)' },
  { value: 'AR5_fossil', label: 'IPCC AR5 (화석연료)' },
  { value: 'AR5_nonfossil', label: 'IPCC AR5 (비화석연료)' },
  { value: 'custom', label: '사용자 정의' },
];

/**
 * Scope 2 폼 컴포넌트
 * 전력 및 열/스팀/온수 구매로 인한 간접 배출량 입력 폼
 */
const DEFAULT_RENEWABLE: RenewablePerformance = { greenPremiumKwh: 0, recKwh: 0, ppaKwh: 0, onsiteKwh: 0 };

export function Scope2Form({
  formData,
  onDataChange,
  facilities,
  selectedYear = new Date().getFullYear(),
}: Scope2FormProps) {
  const factorYear = useGHGStore((s) => s.factorYear);
  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);
  const [dataQualityDialogRowId, setDataQualityDialogRowId] = useState<string | null>(null);
  const [detailDialogRowId, setDetailDialogRowId] = useState<string | null>(null);

  const scope2Included = boundaryPolicy.operationalBoundary?.scope2Included ?? '';
  const showRenewable =
    scope2Included.includes('시장 기반') || scope2Included.includes('동시 산정');
  const renewable = formData.renewablePerformance ?? DEFAULT_RENEWABLE;

  const updateRenewable = (patch: Partial<RenewablePerformance>) => {
    onDataChange({
      ...formData,
      renewablePerformance: { ...renewable, ...patch },
    });
  };

  const getDataQualityLabel = (dq: DataQuality | undefined) =>
    DATA_QUALITY_TYPE_OPTIONS.find((o) => o.value === (dq?.dataType ?? 'measured'))?.label ?? '실측';

  const handleSaveDataQuality = (id: string, dq: DataQuality) => {
    const updatedRows = formData.electricity.map((row) =>
      row.id === id ? { ...row, dataQuality: dq } : row
    );
    onDataChange({ ...formData, electricity: updatedRows });
    setDataQualityDialogRowId(null);
  };

  // 전력 행 추가
  const handleAddElectricityRow = () => {
    const newRow: EmissionData = {
      id: `electricity-${Date.now()}`,
      year: selectedYear,
      month: new Date().getMonth() + 1,
      facility: facilities[0] || '',
      energySource: '전력',
      amount: 0,
      unit: 'kWh',
      emissions: 0,
      createdAt: new Date(),
      dataQuality: DEFAULT_DATA_QUALITY,
    };
    onDataChange({
      ...formData,
      electricity: [...formData.electricity, newRow],
    });
  };

  // 열/스팀/온수 행 추가 (표준)
  const handleAddHeatRowStandard = () => {
    const newRow: Scope2HeatRow = {
      kind: 'standard',
      source: 'provider_avg',
      amount: 0,
      amountUnit: 'GJ',
      factorMode: 'preset',
    };
    onDataChange({
      ...formData,
      heat: [...formData.heat, newRow],
    });
  };

  // 열/스팀/온수 행 추가 (KDHC)
  const handleAddHeatRowKDHC = () => {
    const newRow: Scope2HeatRow = {
      kind: 'kdhc',
      year: '2024',
      branch: 'metropolitan_link',
      amount: 0,
      unit: 'GJ',
      gwpPreset: 'AR6_fossil',
    };
    onDataChange({
      ...formData,
      heat: [...formData.heat, newRow],
    });
  };

  // 전력 행 삭제
  const handleDeleteElectricityRow = (id: string) => {
    onDataChange({
      ...formData,
      electricity: formData.electricity.filter((row) => row.id !== id),
    });
    toast.success('행이 삭제되었습니다.');
  };

  // 열/스팀/온수 행 삭제
  const handleDeleteHeatRow = (index: number) => {
    const updatedHeat = formData.heat.filter((_, idx) => idx !== index);
    onDataChange({
      ...formData,
      heat: updatedHeat,
    });
    toast.success('행이 삭제되었습니다.');
  };

  // 전력 행 업데이트
  const handleUpdateElectricityRow = (id: string, field: keyof EmissionData, value: any) => {
    const updatedRows = formData.electricity.map((row) => {
      if (row.id === id) {
        const updated = { ...row, [field]: value };
        updated.emissions = calcScope2Electricity(
          Number(updated.amount || 0),
          (updated.unit as 'kWh' | 'MWh') || 'kWh',
          'kr_national',
          factorYear
        );
        return updated;
      }
      return row;
    });
    onDataChange({
      ...formData,
      electricity: updatedRows,
    });
  };

  // 열/스팀/온수 행 업데이트
  const handleUpdateHeatRow = (index: number, updates: Partial<Scope2HeatRow>) => {
    const updatedHeat = formData.heat.map((row, idx) => {
      if (idx === index) {
        return { ...row, ...updates } as Scope2HeatRow;
      }
      return row;
    });
    onDataChange({
      ...formData,
      heat: updatedHeat,
    });
  };

  // 총 배출량 계산
  const totalElectricityEmissions = formData.electricity.reduce(
    (sum, row) => sum + (row.emissions || 0),
    0
  );
  const totalHeatEmissions = formData.heat.reduce((sum, row) => {
    if (row.kind === 'standard') {
      const factorTPerGJ =
        row.factorMode === 'manual'
          ? row.manualFactorUnit === 'kg_per_TJ'
            ? (row.manualFactor || 0) / 1_000_000 // kg/TJ -> t/GJ
            : (row.manualFactor || 0) // t/GJ
          : EMISSION_FACTOR_DB[factorYear].heat[row.source].factor;
      return sum + calcHeatStandard(Number(row.amount || 0), row.amountUnit, factorTPerGJ);
    }
    const res = calcHeatKDHC({
      year: row.year,
      branch: row.branch,
      amount: Number(row.amount || 0),
      unit: row.unit,
      gwpPreset: row.gwpPreset,
      customGwpCh4: row.customGwpCh4,
      customGwpN2o: row.customGwpN2o,
    });
    return sum + res.tCo2e;
  }, 0);
  const totalEmissions = totalElectricityEmissions + totalHeatEmissions;

  const currentDqRow = dataQualityDialogRowId
    ? formData.electricity.find((r) => r.id === dataQualityDialogRowId)
    : null;
  const detailRow = detailDialogRowId
    ? formData.electricity.find((r) => r.id === detailDialogRowId)
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">Scope 2 배출량 입력</CardTitle>
            <CardDescription className="text-xs">
              전력 및 열/스팀/온수 구매로 인한 간접 배출량을 입력하세요. 데이터 유형(실측/추정)과 가정을 기록하면 감사·검증 대응에 유리합니다.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <MethodologyDetailPanel scope="scope2" variant="electricity" />
            <MethodologyDetailPanel scope="scope2" variant="heat" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* 총 배출량 요약 */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg border">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">전력</div>
            <div className="text-xl font-bold">{totalElectricityEmissions.toFixed(3)}</div>
            <div className="text-[10px] text-muted-foreground">tCO2e</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">열/스팀/온수</div>
            <div className="text-xl font-bold">{totalHeatEmissions.toFixed(3)}</div>
            <div className="text-[10px] text-muted-foreground">tCO2e</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Scope 2 총계</div>
            <div className="text-xl font-bold text-primary">{totalEmissions.toFixed(3)}</div>
            <div className="text-[10px] text-muted-foreground">tCO2e</div>
          </div>
        </div>

        {/* 탭: 전력 / 열/스팀/온수 */}
        <Tabs defaultValue="electricity" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="electricity" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              전력
            </TabsTrigger>
            <TabsTrigger value="heat" className="flex items-center gap-2">
              <Flame className="h-4 w-4" />
              열/스팀/온수
            </TabsTrigger>
          </TabsList>

          {/* 전력 탭 */}
          <TabsContent value="electricity" className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">전력 사용 데이터</Label>
              <Button onClick={handleAddElectricityRow} size="sm" className="h-8 text-xs">
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
                      <TableHead className="w-32">사용량</TableHead>
                      <TableHead className="w-24">단위</TableHead>
                      <TableHead className="w-28">데이터 품질</TableHead>
                      <TableHead className="w-32">배출량 (tCO2e)</TableHead>
                      <TableHead className="w-20">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.electricity.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-muted-foreground text-sm">
                          <p className="font-medium mb-1.5">입력된 데이터가 없습니다.</p>
                          <p>[EMS 불러오기] 또는 [엑셀 업로드]로 데이터를 가져오거나, [+ 행 추가]로 직접 입력하세요.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      formData.electricity.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            max="12"
                            value={row.month}
                            onChange={(e) =>
                              handleUpdateElectricityRow(row.id, 'month', parseInt(e.target.value) || 1)
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.facility}
                            onValueChange={(value) =>
                              handleUpdateElectricityRow(row.id, 'facility', value)
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
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.amount || ''}
                            onChange={(e) =>
                              handleUpdateElectricityRow(
                                row.id,
                                'amount',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.unit}
                            onValueChange={(value) =>
                              handleUpdateElectricityRow(row.id, 'unit', value)
                            }
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kWh">kWh</SelectItem>
                              <SelectItem value="MWh">MWh</SelectItem>
                            </SelectContent>
                          </Select>
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
                              onClick={() => setDataQualityDialogRowId(row.id)}
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
                              onClick={() => setDetailDialogRowId(row.id)}
                            >
                              왜 이렇게 계산됐는지 상세 보기
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteElectricityRow(row.id)}
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

            {/* 재생에너지 이행 실적 (시장 기반·RE100 시 조건부 노출) */}
            {showRenewable && (
              <Card className="mt-4 border-emerald-200 bg-emerald-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-800">재생에너지 이행 실적 (시장 기반 산정)</CardTitle>
                  <CardDescription className="text-xs">
                    K-ETS 명세서에는 일부만 반영되며, RE100/시장 기반 산정 시 배출량 차감에 사용됩니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">녹색프리미엄 (kWh)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={renewable.greenPremiumKwh || ''}
                        onChange={(e) => updateRenewable({ greenPremiumKwh: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        className="rounded-lg"
                      />
                      <p className="text-[10px] text-slate-500">K-ETS 미반영, RE100 시 0kg 처리</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">REC 구매 (kWh)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={renewable.recKwh || ''}
                        onChange={(e) => updateRenewable({ recKwh: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        className="rounded-lg"
                      />
                      <p className="text-[10px] text-slate-500">K-ETS·RE100 감축 실적 반영</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">PPA 제3자/직접 (kWh)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={renewable.ppaKwh || ''}
                        onChange={(e) => updateRenewable({ ppaKwh: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">자가발전 On-site (kWh)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={renewable.onsiteKwh || ''}
                        onChange={(e) => updateRenewable({ onsiteKwh: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        className="rounded-lg"
                      />
                      <p className="text-[10px] text-slate-500">소비량 중 자가 소비분 차감</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">EAC 인증서 번호 (선택)</Label>
                      <Input
                        value={renewable.eacCertificateNo ?? ''}
                        onChange={(e) => updateRenewable({ eacCertificateNo: e.target.value || undefined })}
                        placeholder="2027 RE100 대비"
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">EAC 유효기간 (선택)</Label>
                      <Input
                        type="text"
                        value={renewable.eacValidUntil ?? ''}
                        onChange={(e) => updateRenewable({ eacValidUntil: e.target.value || undefined })}
                        placeholder="YYYY-MM-DD"
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 열/스팀/온수 탭 */}
          <TabsContent value="heat" className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">열/스팀/온수 데이터</Label>
              <div className="flex gap-2">
                <Button onClick={handleAddHeatRowStandard} size="sm" variant="outline" className="h-8 text-xs">
                  <Plus className="h-3 w-3 mr-1.5" />
                  표준 추가
                </Button>
                <Button onClick={handleAddHeatRowKDHC} size="sm" variant="outline" className="h-8 text-xs">
                  <Plus className="h-3 w-3 mr-1.5" />
                  KDHC 추가
                </Button>
              </div>
            </div>

            {formData.heat.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                <Flame className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">열/스팀/온수 데이터가 없습니다. 행을 추가하여 입력하세요.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.heat.map((row, index) => (
                  <Card key={index} className="border">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          {row.kind === 'kdhc' ? (
                            <Badge variant="outline" className="text-xs">KDHC</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">표준</Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteHeatRow(index)}
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>

                      {row.kind === 'kdhc' ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">KDHC 지사</Label>
                            <Select
                              value={row.branch}
                              onValueChange={(value: KdhcBranchKey) =>
                                handleUpdateHeatRow(index, { branch: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {KDHC_BRANCH_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>사용량</Label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.amount || ''}
                                onChange={(e) =>
                                  handleUpdateHeatRow(index, {
                                    amount: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="flex-1"
                              />
                              <Select
                                value={row.unit}
                                onValueChange={(value: 'GJ' | 'TJ') =>
                                  handleUpdateHeatRow(index, { unit: value })
                                }
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="GJ">GJ</SelectItem>
                                  <SelectItem value="TJ">TJ</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">GWP 프리셋</Label>
                            <Select
                              value={row.gwpPreset}
                              onValueChange={(value: GwpPreset) =>
                                handleUpdateHeatRow(index, { gwpPreset: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {GWP_PRESET_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {row.gwpPreset === 'custom' && (
                            <>
                              <div>
                                <Label className="text-xs">사용자 정의 CH4 GWP</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={row.customGwpCh4 || ''}
                                  onChange={(e) =>
                                    handleUpdateHeatRow(index, {
                                      customGwpCh4: parseFloat(e.target.value) || undefined,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>사용자 정의 N2O GWP</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={row.customGwpN2o || ''}
                                  onChange={(e) =>
                                    handleUpdateHeatRow(index, {
                                      customGwpN2o: parseFloat(e.target.value) || undefined,
                                    })
                                  }
                                />
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">공급원</Label>
                            <Select
                              value={row.source}
                              onValueChange={(value: Exclude<HeatKey, 'kdhc'>) =>
                                handleUpdateHeatRow(index, { source: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="provider_avg">공급자 제공 평균값</SelectItem>
                                <SelectItem value="national_default">국가고유 또는 IPCC default</SelectItem>
                                <SelectItem value="lci_db">LCI DB 또는 IPCC 2006</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>사용량</Label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.amount || ''}
                                onChange={(e) =>
                                  handleUpdateHeatRow(index, {
                                    amount: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="flex-1"
                              />
                              <Select
                                value={row.amountUnit}
                                onValueChange={(value: 'GJ' | 'TJ') =>
                                  handleUpdateHeatRow(index, { amountUnit: value })
                                }
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="GJ">GJ</SelectItem>
                                  <SelectItem value="TJ">TJ</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label>계수 모드</Label>
                            <Select
                              value={row.factorMode}
                              onValueChange={(value: 'preset' | 'manual') =>
                                handleUpdateHeatRow(index, { factorMode: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="preset">프리셋</SelectItem>
                                <SelectItem value="manual">수동 입력</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {row.factorMode === 'manual' && (
                            <div>
                              <Label className="text-xs">수동 배출계수</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  step="0.0001"
                                  value={row.manualFactor || ''}
                                  onChange={(e) =>
                                    handleUpdateHeatRow(index, {
                                      manualFactor: parseFloat(e.target.value) || undefined,
                                    })
                                  }
                                  className="flex-1"
                                />
                                <Select
                                  value={row.manualFactorUnit || 't_per_GJ'}
                                  onValueChange={(value: 't_per_GJ' | 'kg_per_TJ') =>
                                    handleUpdateHeatRow(index, { manualFactorUnit: value })
                                  }
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="t_per_GJ">t/GJ</SelectItem>
                                    <SelectItem value="kg_per_TJ">kg/TJ</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {detailRow && detailDialogRowId && (
          <CalculationDetailDialog
            open={!!detailDialogRowId}
            onOpenChange={(open) => !open && setDetailDialogRowId(null)}
            scope="scope2"
            variant="electricity"
            dataQuality={detailRow.dataQuality}
            rowLabel={`전력 · ${detailRow.amount} ${detailRow.unit}`}
          />
        )}

        {currentDqRow && dataQualityDialogRowId && (
          <DataQualityDialog
            open={!!dataQualityDialogRowId}
            onOpenChange={(open) => !open && setDataQualityDialogRowId(null)}
            value={currentDqRow.dataQuality}
            onSave={(dq) => handleSaveDataQuality(dataQualityDialogRowId, dq)}
          />
        )}
      </CardContent>
    </Card>
  );
}
