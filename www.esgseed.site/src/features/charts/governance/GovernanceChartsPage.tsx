import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Download, RefreshCw, Save, Settings, TrendingUp, PieChart, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { useReportStore, type ChartData, type SavedEsgTable } from '@/store/reportStore';
import type { DataPoint, ChartSeries, SeriesType, SavedChart, EditableTable, GovTablePresetId } from '../types';
import { makeId, ensureChartJsLoaded, hydrateTables } from '../utils/chartJs';
import {
  TABLE_PRESETS,
  GOV_BOARD_TABLES,
  GOV_ETHICS_TABLES,
  dataSources,
  GOV_COLORS,
  GOV_DATA_SOURCE_SET,
} from '../data/governance-data';

const isGovChart = (c: ChartData) => GOV_DATA_SOURCE_SET.has(c.dataSource);

export function GovernanceChartsPage() {
  const { charts, addChart, removeChart, esgTables, addEsgTable, removeEsgTable } = useReportStore();

  const [tablePreset, setTablePreset] = useState<GovTablePresetId>('governance_board');
  const [boardTables, setBoardTables] = useState<EditableTable[]>(() => hydrateTables(GOV_BOARD_TABLES, makeId));
  const [ethicsTables, setEthicsTables] = useState<EditableTable[]>(() => hydrateTables(GOV_ETHICS_TABLES, makeId));

  const [chartType, setChartType] = useState<string>('');
  const [dataSource, setDataSource] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chartTitle, setChartTitle] = useState('이사회 출석률');
  const [xAxisLabel, setXAxisLabel] = useState('연도');
  const [yAxisLabel, setYAxisLabel] = useState('(단위 : %)');
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([
    { label: '2022', value: 96.4 },
    { label: '2023', value: 98.4 },
    { label: '2024', value: 95.9 },
  ]);

  const [legendEnabled, setLegendEnabled] = useState<boolean>(true);
  const [multiSeriesEnabled, setMultiSeriesEnabled] = useState<boolean>(false);
  const [series, setSeries] = useState<ChartSeries[]>([{ id: makeId(), name: '시리즈 1', type: 'bar', values: dataPoints.map((p) => p.value) }]);

  const syncSeriesLength = (nextLen: number) => {
    setSeries((prev) =>
      prev.map((s) => {
        const values = [...s.values];
        while (values.length < nextLen) values.push(0);
        while (values.length > nextLen) values.pop();
        return { ...s, values };
      })
    );
  };

  type ChartInstance = {
    destroy: () => void;
    toBase64Image: (type?: string, quality?: number) => string;
  };
  type ChartConstructor = new (ctx: CanvasRenderingContext2D, config: unknown) => ChartInstance;
  const getChartConstructor = () => (window as unknown as { Chart?: ChartConstructor }).Chart;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<ChartInstance | null>(null);
  const [isChartRendered, setIsChartRendered] = useState(false);

  const chartTypes = [
    { value: 'bar', label: '막대 차트', icon: BarChart3, description: '카테고리별 데이터 비교' },
    { value: 'stacked_bar', label: '누적 막대 차트', icon: BarChart3, description: '여러 시리즈 누적 합산' },
    { value: 'line', label: '선형 차트', icon: TrendingUp, description: '시간 변화 추이' },
    { value: 'mixed', label: '혼합형(막대+선)', icon: TrendingUp, description: '시리즈별 막대/선 혼합' },
    { value: 'pie', label: '원형 차트', icon: PieChart, description: '전체 대비 비율' },
    { value: 'doughnut', label: '도넛 차트', icon: PieChart, description: '비율 + 중앙 공간' },
  ];

  const [savedCharts, setSavedCharts] = useState<SavedChart[]>(() =>
    charts
      .filter(isGovChart)
      .slice(0, 4)
      .map((chart: ChartData) => ({
      id: chart.id,
      chartType: chart.chartType,
      dataSource: chart.dataSource,
      chartTitle: chart.chartTitle,
      xAxisLabel: chart.xAxisLabel,
      yAxisLabel: chart.yAxisLabel,
      dataPoints: chart.dataPoints,
      thumbnail: chart.chartImage,
      }))
  );
  useEffect(() => {
    setSavedCharts(
      charts
        .filter(isGovChart)
        .slice(0, 4)
        .map((chart: ChartData) => ({
        id: chart.id,
        chartType: chart.chartType,
        dataSource: chart.dataSource,
        chartTitle: chart.chartTitle,
        xAxisLabel: chart.xAxisLabel,
        yAxisLabel: chart.yAxisLabel,
        dataPoints: chart.dataPoints.map((dp) => ({ ...dp })),
        thumbnail: chart.chartImage,
        }))
    );
  }, [charts]);

  const loadChart = (savedChart: SavedChart) => {
    setChartType(savedChart.chartType);
    setDataSource(savedChart.dataSource);
    setChartTitle(savedChart.chartTitle);
    setXAxisLabel(savedChart.xAxisLabel);
    setYAxisLabel(savedChart.yAxisLabel);
    const next = savedChart.dataPoints.map((dp) => ({ ...dp }));
    setDataPoints(next);
  };

  // 최초 진입 시 기본 데이터 소스 자동 선택
  useEffect(() => {
    if (!dataSource) {
      const first = dataSources[0]?.value ?? '';
      if (first) handleDataSourceChange(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDataPoint = (index: number, field: 'label' | 'value', value: string) => {
    setDataPoints((prev) => {
      const next = [...prev];
      if (field === 'label') {
        next[index] = { ...next[index], label: value };
      } else {
        next[index] = { ...next[index], value: parseFloat(value) || 0 };
      }
      return next;
    });
    // 멀티 시리즈 모드에서 1번 시리즈를 기존 단일 입력값과 동기화
    if (field === 'value' && multiSeriesEnabled) {
      const v = parseFloat(value) || 0;
      setSeries((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const first = { ...next[0], values: [...next[0].values] };
        first.values[index] = v;
        next[0] = first;
        return next;
      });
    }
  };

  const handleDataSourceChange = (value: string) => {
    setDataSource(value);
    const selected = dataSources.find((s) => s.value === value);
    if (!selected) return;
    setChartTitle(selected.label);
    if (selected.unit) setYAxisLabel(`(단위 : ${selected.unit})`);

    // 권장 차트 타입/라벨/기본값 자동 세팅
    if (selected.defaultChartType) setChartType(selected.defaultChartType);
    if (selected.defaultLabels?.length) {
      setXAxisLabel('연도');
      const labels = selected.defaultLabels;
      // 기본은 1시리즈 기준 dataPoints를 채움(단일 모드 호환)
      const firstSeries = selected.defaultSeries?.[0] ?? [];
      setDataPoints(labels.map((lbl, i) => ({ label: lbl, value: typeof firstSeries[i] === 'number' ? firstSeries[i] : 0 })));
      syncSeriesLength(labels.length);
    }

    if (selected.legend?.length) {
      const wantsMulti = selected.legend.length > 1;
      setMultiSeriesEnabled(wantsMulti);
      if (wantsMulti) {
        const labelsLen = (selected.defaultLabels?.length ?? dataPoints.length) || 0;
        const seriesValues = selected.defaultSeries ?? selected.legend.map(() => Array(labelsLen).fill(0));
        const types = selected.defaultSeriesTypes ?? selected.legend.map((_, idx) => (idx === 1 && selected.defaultChartType === 'mixed' ? 'line' : 'bar'));
        setSeries(
          selected.legend.slice(0, 6).map((name, idx) => ({
            id: makeId(),
            name,
            type: (types[idx] ?? 'bar') as SeriesType,
            values: (seriesValues[idx] ?? Array(labelsLen).fill(0)).slice(0, labelsLen),
          }))
        );
      } else {
        // 단일 시리즈는 이름만 세팅
        setSeries((prev) => (prev.length ? [{ ...prev[0], name: selected.legend?.[0] ?? '시리즈 1' }] : prev));
      }
    }
  };

  const renderChart = () => {
    if (!canvasRef.current || !chartType) return;
    const ChartCtor = getChartConstructor();
    if (!ChartCtor) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const labels = dataPoints.map((d) => d.label).filter((l) => l.trim() !== '');
    const primaryData = dataPoints.map((d) => d.value).slice(0, labels.length);
    if (labels.length === 0) return;

    const actualChartType = chartType === 'stacked_bar' || chartType === 'mixed' ? 'bar' : chartType;
    const isPieLike = actualChartType === 'pie' || actualChartType === 'doughnut';
    const shouldShowLegend = legendEnabled && (multiSeriesEnabled ? series.length > 1 : isPieLike);

    const datasets = !multiSeriesEnabled
      ? [{ label: chartTitle, data: primaryData, backgroundColor: GOV_COLORS[0], borderColor: GOV_COLORS[0], borderWidth: 2, borderRadius: 8 }]
      : series.slice(0, 6).map((s, idx) => {
          const shade = GOV_COLORS[idx % GOV_COLORS.length];
          const base: Record<string, unknown> = { label: s.name, data: s.values.slice(0, labels.length), borderWidth: 2, borderRadius: 8 };
          if (chartType === 'mixed') base.type = s.type;
          if (chartType === 'stacked_bar') base.stack = 'stack1';
          if (s.type === 'line') {
            base.borderColor = shade;
            base.backgroundColor = shade + '33';
            base.tension = 0.35;
            base.pointRadius = 4;
          } else {
            base.backgroundColor = shade;
            base.borderColor = shade;
          }
          return base;
        });

    chartInstanceRef.current = new ChartCtor(ctx, {
      type: actualChartType,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: shouldShowLegend, position: 'bottom' }, title: { display: true, text: chartTitle } },
        scales: (actualChartType === 'bar' || actualChartType === 'line') ? { y: { stacked: chartType === 'stacked_bar' }, x: { stacked: chartType === 'stacked_bar' } } : undefined,
      },
    });
    setIsChartRendered(true);
  };

  useEffect(() => {
    if (!chartType || !dataSource) return;
    const go = async () => {
      await ensureChartJsLoaded();
      renderChart();
    };
    go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, chartTitle, dataSource, xAxisLabel, yAxisLabel, dataPoints, multiSeriesEnabled, series]);

  const handleGenerate = async () => {
    if (!chartType || !dataSource) return;
    setIsGenerating(true);
    await ensureChartJsLoaded();
    setIsGenerating(false);
    renderChart();
  };

  const downloadChart = () => {
    if (!chartInstanceRef.current) return;
    const imageURL = chartInstanceRef.current.toBase64Image('image/png', 1.0);
    const link = document.createElement('a');
    link.href = imageURL;
    link.download = `${chartTitle.replace(/[^a-z0-9\uAC00-\uD7A3]/gi, '_') || 'chart'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveChart = () => {
    if (!chartInstanceRef.current || !chartType || !dataSource) {
      toast.error('차트를 먼저 생성해주세요.');
      return;
    }
    const thumbnail = chartInstanceRef.current.toBase64Image('image/png', 0.3);
    addChart({
      chartType: chartType as ChartData['chartType'],
      dataSource,
      chartTitle,
      xAxisLabel,
      yAxisLabel,
      dataPoints: dataPoints.map((d) => ({ ...d })),
      labels: dataPoints.map((p) => p.label).filter((l) => l.trim() !== ''),
      datasets: multiSeriesEnabled ? series.map((s) => ({ label: s.name, data: [...s.values], type: s.type })) : undefined,
      chartImage: thumbnail,
    });
    toast.success('차트가 저장되었습니다.');
  };

  const updateEditableCell = (which: 'board' | 'ethics', tableId: string, rowId: string, colKey: string, value: string) => {
    const setter = which === 'board' ? setBoardTables : setEthicsTables;
    setter((prev) =>
      prev.map((t) =>
        t.id !== tableId
          ? t
          : { ...t, rows: t.rows.map((r) => (r.id !== rowId ? r : { ...r, cells: { ...r.cells, [colKey]: value } })) }
      )
    );
  };
  const addEditableRow = (which: 'board' | 'ethics', tableId: string) => {
    const setter = which === 'board' ? setBoardTables : setEthicsTables;
    setter((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        const empty: Record<string, string> = {};
        t.columns.forEach((c) => (empty[c.key] = ''));
        return { ...t, rows: [...t.rows, { id: makeId(), cells: empty }] };
      })
    );
  };
  const removeEditableRow = (which: 'board' | 'ethics', tableId: string, rowId: string) => {
    const setter = which === 'board' ? setBoardTables : setEthicsTables;
    setter((prev) => prev.map((t) => (t.id !== tableId ? t : { ...t, rows: t.rows.filter((r) => r.id !== rowId) })));
  };

  const renderEditableTables = (presetId: GovTablePresetId, which: 'board' | 'ethics', tables: EditableTable[]) => {
    return (
      <div className="space-y-6">
        {tables.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{t.title}</CardTitle>
                  {t.note ? <CardDescription className="whitespace-pre-line">{t.note}</CardDescription> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      addEsgTable({ presetId, title: t.title, note: t.note, columns: t.columns, rows: t.rows });
                      toast.success('도표가 최종보고서에 저장되었습니다.');
                    }}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    저장
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addEditableRow(which, t.id)}>
                    <Plus className="h-4 w-4 mr-1" />
                    행 추가
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse table-auto min-w-[1200px]">
                  <thead>
                    <tr className="border-b-2 border-border">
                      {t.columns.map((c) => (
                        <th
                          key={c.key}
                          className={`p-4 text-base font-semibold bg-muted/50 ${
                            c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                          } ${
                            c.key === 'category'
                              ? 'w-[320px]'
                              : c.key === 'item'
                                ? 'w-[220px]'
                                : c.key === 'name'
                                  ? 'w-[200px]'
                                  : c.key === 'sub'
                                    ? 'w-[90px]'
                                    : c.key === 'unit'
                                      ? 'w-[110px]'
                                      : ''
                          } ${
                            c.key === '2021' || c.key === '2022' || c.key === '2023' || c.key === '2024'
                              ? 'w-[120px]'
                              : ''
                          }`}
                        >
                          {c.label}
                        </th>
                      ))}
                      <th className="p-4 text-base font-semibold bg-muted/50 text-center w-[110px]">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((r) => (
                      <tr key={r.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        {t.columns.map((c) => {
                          const align = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
                          const val = r.cells?.[c.key] ?? '';
                          const isTextColumn =
                            c.key === 'category' || c.key === 'item' || c.key === 'name' || c.key === 'sub' || c.key === 'unit';
                          return (
                            <td key={c.key} className={`p-2 ${align}`}>
                              <Input
                                value={val}
                                onChange={(e) => updateEditableCell(which, t.id, r.id, c.key, e.target.value)}
                                className={`h-11 text-base ${align} ${isTextColumn ? '' : 'tabular-nums'} ${
                                  c.key === 'category' ? 'text-base font-medium' : ''
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="p-2 text-center">
                          <Button variant="outline" size="sm" onClick={() => removeEditableRow(which, t.id, r.id)}>
                            <Minus className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row gap-8 items-start">
        {/* 좌+중: 80% (3:5) */}
        <div className="w-full xl:flex-[8] min-w-0">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,5fr)] gap-x-8 gap-y-4 items-start">
            <div className="space-y-4">
              <Card>
            <CardHeader>
              <CardTitle className="text-lg">데이터 소스</CardTitle>
              <CardDescription>시각화할 지표를 선택하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={dataSource} onValueChange={handleDataSourceChange}>
                <SelectTrigger><SelectValue placeholder="데이터 유형 선택" /></SelectTrigger>
                <SelectContent>
                  {dataSources.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

              <Card>
            <CardHeader>
              <CardTitle className="text-lg">차트 설정</CardTitle>
              <CardDescription>누적/혼합형/범례를 포함한 차트를 구성하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-semibold text-sm">범례/멀티시리즈</div>
                  <div className="text-xs text-muted-foreground">누적 막대/혼합형(막대+선) 입력</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">범례</Label>
                    <Switch checked={legendEnabled} onCheckedChange={setLegendEnabled} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">멀티</Label>
                    <Switch
                      checked={multiSeriesEnabled}
                      onCheckedChange={(v) => {
                        setMultiSeriesEnabled(v);
                        if (v) {
                          setSeries((prev) => {
                            if (prev.length > 0) return prev;
                            return [{ id: makeId(), name: '시리즈 1', type: 'bar', values: dataPoints.map((p) => p.value) }];
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>차트 제목</Label>
                <Input value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>X축 라벨</Label>
                <Input value={xAxisLabel} onChange={(e) => setXAxisLabel(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Y축 라벨</Label>
                <Input value={yAxisLabel} onChange={(e) => setYAxisLabel(e.target.value)} className="mt-1" />
              </div>

              <div className="pt-4 border-t">
                <Label className="mb-2 block">데이터 포인트</Label>
                {!multiSeriesEnabled ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dataPoints.map((p, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <span className="font-bold text-muted-foreground text-xs w-4">{idx + 1}.</span>
                        <Input value={p.label} onChange={(e) => updateDataPoint(idx, 'label', e.target.value)} className="flex-1 text-sm" />
                        <Input type="number" value={p.value || ''} onChange={(e) => updateDataPoint(idx, 'value', e.target.value)} className="w-24 text-right text-sm" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">시리즈(최대 6), 라벨(최대 10)</div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSeries((prev) =>
                              prev.length >= 6 ? prev : [...prev, { id: makeId(), name: `시리즈 ${prev.length + 1}`, type: 'bar', values: dataPoints.map(() => 0) }]
                            )
                          }
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          시리즈 추가
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSeries((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))}
                          disabled={series.length <= 1}
                        >
                          <Minus className="h-3 w-3 mr-1" />
                          시리즈 제거
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {series.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <Input
                            value={s.name}
                            onChange={(e) => setSeries((prev) => prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
                            className="flex-1 text-sm"
                          />
                          {chartType === 'mixed' ? (
                            <Select
                              value={s.type}
                              onValueChange={(v) => setSeries((prev) => prev.map((x) => (x.id === s.id ? { ...x, type: v as SeriesType } : x)))}
                            >
                              <SelectTrigger className="w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bar">막대</SelectItem>
                                <SelectItem value="line">선</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="w-[110px] text-xs text-muted-foreground text-right pr-1">{chartType === 'stacked_bar' ? '누적' : '시리즈'}</div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {dataPoints.map((p, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 items-center">
                          <Input value={p.label} onChange={(e) => updateDataPoint(idx, 'label', e.target.value)} className="text-sm" placeholder={`레이블 ${idx + 1}`} />
                          {series.slice(0, 3).map((s) => (
                            <Input
                              key={s.id}
                              type="number"
                              value={s.values[idx] ?? 0}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                setSeries((prev) =>
                                  prev.map((x) => {
                                    if (x.id !== s.id) return x;
                                    const values = [...x.values];
                                    values[idx] = v;
                                    return { ...x, values };
                                  })
                                );
                              }}
                              className="text-right text-sm"
                            />
                          ))}
                          {series.length > 3 ? <div className="text-[11px] text-muted-foreground text-right pr-1">+{series.length - 3}개</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setDataPoints((prev) => (prev.length >= 10 ? prev : [...prev, { label: '', value: 0 }]));
                      syncSeriesLength(Math.min(dataPoints.length + 1, 10));
                    }}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Plus className="h-3 w-3 mr-1" />추가
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setDataPoints((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
                      syncSeriesLength(Math.max(dataPoints.length - 1, 1));
                    }}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Minus className="h-3 w-3 mr-1" />제거
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
            </div>

            {/* 차트 미리보기 */}
            <div className="min-w-0">
              <Card className="min-h-[720px] h-[calc(100vh-320px)]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">차트 미리보기</CardTitle>
                  <CardDescription>생성된 차트를 확인하고 다운로드하세요</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={downloadChart} disabled={!isChartRendered}>
                    <Download className="h-4 w-4 mr-1" />PNG
                  </Button>
                  <Button variant="outline" size="sm" onClick={saveChart} disabled={!isChartRendered}>
                    <Save className="h-4 w-4 mr-1" />저장
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[calc(100%-84px)]">
              <div className="flex items-center justify-center h-full rounded-lg border border-border bg-white">
                <div className="w-full h-full p-6">
                  <canvas ref={canvasRef} className="w-full h-full"></canvas>
                </div>
              </div>
            </CardContent>
              </Card>
            </div>

            {/* 테이블: 좌+중 span, 차트 아래 바로 */}
            <div className="xl:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">ESG DATA 테이블 (거버넌스)</CardTitle>
                      <CardDescription>테이블 세트를 선택하고 각 셀 값을 직접 입력/편집/저장할 수 있습니다.</CardDescription>
                    </div>
                    <div className="min-w-[320px]">
                      <Select value={tablePreset} onValueChange={(v) => setTablePreset(v as GovTablePresetId)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TABLE_PRESETS.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="mt-2 text-sm text-muted-foreground">{TABLE_PRESETS.find((p) => p.id === tablePreset)?.description}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {tablePreset === 'governance_board' && renderEditableTables('governance_board', 'board', boardTables)}
                  {tablePreset === 'governance_ethics' && renderEditableTables('governance_ethics', 'ethics', ethicsTables)}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* 우측: 20% */}
        <div className="w-full xl:flex-[2] min-w-0 space-y-4 xl:sticky xl:top-24 self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center">
                <Settings className="h-6 w-6 mr-2 text-secondary" />
                차트 유형
              </CardTitle>
              <CardDescription>데이터에 적합한 차트 유형을 선택하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {chartTypes.map((t) => {
                  const Icon = t.icon;
                  return (
                    <div
                      key={t.value}
                      className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                        chartType === t.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                      }`}
                      onClick={() => setChartType(t.value)}
                    >
                      <Icon className={`h-7 w-7 mb-2 ${chartType === t.value ? 'text-secondary' : 'text-muted-foreground'}`} />
                      <h4 className="font-bold text-base mb-1">{t.label}</h4>
                      <p className="text-sm text-muted-foreground">{t.description}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleGenerate} disabled={!chartType || !dataSource || isGenerating} className="w-full bg-accent hover:bg-accent/90 text-white py-4 text-lg font-bold">
            {isGenerating ? (
              <>
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <BarChart3 className="mr-2 h-5 w-5" />
                차트 생성하기
              </>
            )}
          </Button>

          {/* 차트 갤러리 */}
          <Card className="h-[420px]">
            <CardHeader>
              <CardTitle className="text-xl">차트 갤러리</CardTitle>
              <CardDescription>최근 생성된 차트들을 확인하고 재사용하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {savedCharts.length > 0 ? (
                  savedCharts.map((savedChart) => (
                    <div
                      key={savedChart.id}
                      onClick={() => loadChart(savedChart)}
                      className="w-full h-[130px] bg-seed-light/20 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-all duration-200 overflow-hidden group relative"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeChart(savedChart.id);
                          toast.success('차트가 갤러리에서 삭제되었습니다.');
                        }}
                        className="absolute top-1 right-1 z-10 rounded-full bg-white/80 hover:bg-red-500 hover:text-white text-xs px-1.5 py-0.5 shadow-sm"
                      >
                        ✕
                      </button>
                      {savedChart.thumbnail ? (
                        <img src={savedChart.thumbnail} alt={savedChart.chartTitle} className="w-full h-full object-contain p-2" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground truncate px-2">{savedChart.chartTitle}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  [1, 2, 3, 4].map((index) => (
                    <div key={index} className="w-full h-[130px] bg-seed-light/20 rounded-lg border border-border flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground opacity-50">비어있음</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* 도표(테이블) 갤러리 */}
          <Card className="h-[420px]">
            <CardHeader>
              <CardTitle className="text-xl">도표 갤러리</CardTitle>
              <CardDescription>저장한 ESG DATA 테이블을 최종보고서에 포함할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {esgTables.filter((t: SavedEsgTable) => t.presetId.startsWith('governance_')).length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  저장된 도표가 없습니다. 각 테이블의 “저장”을 눌러 추가하세요.
                </div>
              ) : (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {esgTables
                    .filter((t: SavedEsgTable) => t.presetId.startsWith('governance_'))
                    .map((t: SavedEsgTable) => (
                    <div key={t.id} className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-foreground">{t.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.presetId} · {new Date(t.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const headers = t.columns.map((c) => c.label);
                              const keys = t.columns.map((c) => c.key);
                              const escape = (v: string) => {
                                const s = (v ?? '').toString();
                                return /[\",\n]/.test(s) ? `\"${s.replace(/\"/g, '\"\"')}\"` : s;
                              };
                              const lines = [
                                headers.map(escape).join(','),
                                ...t.rows.map((r) => keys.map((k) => escape(r.cells?.[k] ?? '')).join(',')),
                              ];
                              const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${t.title.replace(/[^a-z0-9\uAC00-\uD7A3]/gi, '_') || 'table'}.csv`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => removeEsgTable(t.id)}>
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
