import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BarChart3, PieChart, TrendingUp, Download, RefreshCw, Settings, Plus, Minus, Save } from 'lucide-react';
import { useReportStore, type ChartData, type SavedEsgTable } from '@/store/reportStore';
import { toast } from 'sonner';
import type { DataPoint, ChartSeries, SeriesType, SavedChart, EditableTable, EnvTablePresetId } from '../types';
import { makeId, ensureChartJsLoaded, hydrateTables } from '../utils/chartJs';
import {
  TABLE_PRESETS,
  GHG_TABLES,
  WATER_TABLES,
  WASTE_AIR_TABLES,
  INVEST_PUE_TABLES,
  ENERGY_TABLES,
  dataSources,
  dataSourceLegendHints,
  categoryTabs,
  ENV_COLORS,
  ENV_DATA_SOURCE_SET,
} from '../data/environmental-data';

const isEnvChart = (c: ChartData) => ENV_DATA_SOURCE_SET.has(c.dataSource);

export function EnvironmentalChartsPage() {
  const {
    charts,
    addChart,
    removeChart,
    currentChart,
    setCurrentChart,
    esgTables,
    addEsgTable,
    removeEsgTable,
  } = useReportStore();
  const [envCategory, setEnvCategory] = useState<'ghg_energy' | 'waste_air' | 'water_wastewater'>('ghg_energy');
  const [chartType, setChartType] = useState(currentChart?.chartType || '');
  const [dataSource, setDataSource] = useState(currentChart?.dataSource || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chartTitle, setChartTitle] = useState(currentChart?.chartTitle || '연도별 CO2 배출량 (Scope 1+2)');
  const [dataPoints, setDataPoints] = useState<DataPoint[]>(currentChart?.dataPoints && currentChart.dataPoints.length > 0
    ? currentChart.dataPoints
    : [
    { label: '2021년', value: 1200 },
    { label: '2022년', value: 1150 },
    { label: '2023년', value: 1080 },
    { label: '2024년', value: 1010 },
      ]
  );
  const [xAxisLabel, setXAxisLabel] = useState(currentChart?.xAxisLabel || '월별');
  const [yAxisLabel, setYAxisLabel] = useState(currentChart?.yAxisLabel || '배출량 (tCO2eq)');
  const [legendEnabled, setLegendEnabled] = useState<boolean>(true);
  const [multiSeriesEnabled, setMultiSeriesEnabled] = useState<boolean>(false);
  const [series, setSeries] = useState<ChartSeries[]>(() => [
    {
      id: makeId(),
      name: currentChart?.datasets?.[0]?.label || '시리즈 1',
      type: (currentChart?.datasets?.[0]?.type as SeriesType) || 'bar',
      values:
        currentChart?.datasets?.[0]?.data?.length
          ? currentChart.datasets[0].data
          : (currentChart?.dataPoints?.length ? currentChart.dataPoints.map((p: { value: number }) => p.value) : [1200, 1150, 1080, 1010]),
    },
  ]);
  
  // store의 charts를 SavedChart 형식으로 변환
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>(() =>
    charts
      .filter(isEnvChart)
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
  
  // store의 charts 변경 시 savedCharts 동기화 (깊은 복사로 데이터 보호)
  useEffect(() => {
    setSavedCharts(
      charts
        .filter(isEnvChart)
        .slice(0, 4)
        .map((chart: ChartData) => ({
        id: chart.id,
        chartType: chart.chartType,
        dataSource: chart.dataSource,
        chartTitle: chart.chartTitle,
        xAxisLabel: chart.xAxisLabel,
        yAxisLabel: chart.yAxisLabel,
        // dataPoints를 깊은 복사하여 원본 데이터 보호
        dataPoints: chart.dataPoints.map(dp => ({ ...dp })),
        thumbnail: chart.chartImage,
        }))
    );
  }, [charts]);
  type ChartInstance = {
    destroy: () => void;
    toBase64Image: (type?: string, quality?: number) => string;
  };
  type ChartConstructor = new (ctx: CanvasRenderingContext2D, config: unknown) => ChartInstance;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<ChartInstance | null>(null);
  const [isChartRendered, setIsChartRendered] = useState(false);
  const [tablePreset, setTablePreset] = useState<EnvTablePresetId>('ghg_emissions');
  const [ghgTables, setGhgTables] = useState<EditableTable[]>(() => hydrateTables(GHG_TABLES, makeId));
  const [investPueTables, setInvestPueTables] = useState<EditableTable[]>(() => hydrateTables(INVEST_PUE_TABLES, makeId));
  const [waterTables, setWaterTables] = useState<EditableTable[]>(() => hydrateTables(WATER_TABLES, makeId));
  const [energyTables, setEnergyTables] = useState<EditableTable[]>(() => hydrateTables(ENERGY_TABLES, makeId));
  const [wasteAirTables, setWasteAirTables] = useState<EditableTable[]>(() => hydrateTables(WASTE_AIR_TABLES, makeId));

  const chartTypes = [
    { value: 'bar', label: '막대 차트', icon: BarChart3, description: '카테고리별 데이터 비교에 적합' },
    { value: 'stacked_bar', label: '누적 막대 차트', icon: BarChart3, description: '여러 시리즈를 누적으로 합산 비교' },
    { value: 'horizontal', label: '수평 막대 차트', icon: BarChart3, description: '항목이 많을 때 가독성이 좋은 비교 차트' },
    { value: 'pie', label: '원형 차트', icon: PieChart, description: '전체 대비 비율 표시에 적합' },
    { value: 'doughnut', label: '도넛 차트', icon: PieChart, description: '비율을 강조하면서 중앙 공간을 활용' },
    { value: 'line', label: '선형 차트', icon: TrendingUp, description: '시간별 변화 추이 표시에 적합' },
    { value: 'mixed', label: '혼합형(막대+선)', icon: TrendingUp, description: '막대+선을 함께 표시(시리즈별 타입 선택)' },
    { value: 'area', label: '영역 차트', icon: TrendingUp, description: '누적 데이터 변화 표시에 적합' }
  ];

  const allowedSources = (categoryTabs.find((t) => t.id === envCategory)?.sources ?? []) as readonly string[];
  const filteredDataSources = dataSources.filter((s) => allowedSources.includes(s.value));

  useEffect(() => {
    if (!dataSource || !allowedSources.includes(dataSource)) {
      const first = filteredDataSources[0]?.value ?? '';
      setDataSource(first);
    }
    // envCategory별 테이블 프리셋 기본값 세팅 (탭 전환 시 "안 보이는" 문제 방지)
    if (envCategory === 'water_wastewater' && tablePreset !== 'water') {
      setTablePreset('water');
    } else if (envCategory === 'waste_air' && tablePreset !== 'waste_air') {
      setTablePreset('waste_air');
    } else if (
      envCategory === 'ghg_energy' &&
      tablePreset !== 'ghg_emissions' &&
      tablePreset !== 'energy' &&
      tablePreset !== 'investment_pue'
    ) {
      setTablePreset('ghg_emissions');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envCategory]);

  // 데이터 소스 선택 시 차트 제목에도 반영
  const handleDataSourceChange = (value: string) => {
    setDataSource(value);
    const selected = dataSources.find((source) => source.value === value);
    if (selected) {
      // 선택된 데이터 소스 라벨을 기본 차트 제목으로 사용
      setChartTitle(selected.label);
      if (selected.unit) {
        // 단위 표기 통일: (단위 : ...)
        const raw = selected.unit.trim();
        const normalized =
          raw === 't (톤)' || raw === 't(톤)'
            ? '톤'
            : raw;
        setYAxisLabel(normalized.startsWith('(단위') ? normalized : `(단위 : ${normalized})`);
      }
    }
  };

  // 데이터 포인트 추가
  const addDataPoint = () => {
    if (dataPoints.length >= 10) return;
    setDataPoints([...dataPoints, { label: '', value: 0 }]);
    syncSeriesLength(dataPoints.length + 1);
  };

  // 데이터 포인트 제거
  const removeDataPoint = () => {
    if (dataPoints.length > 1) {
      setDataPoints(dataPoints.slice(0, -1));
      syncSeriesLength(dataPoints.length - 1);
    }
  };

  // 데이터 포인트 업데이트
  const updateDataPoint = (index: number, field: 'label' | 'value', value: string | number) => {
    const newDataPoints = [...dataPoints];
    if (field === 'label') {
      newDataPoints[index].label = value as string;
    } else {
      newDataPoints[index].value = typeof value === 'string' ? parseFloat(value) || 0 : value;
    }
    setDataPoints(newDataPoints);
    // 멀티 시리즈 모드에서 1번 시리즈를 기존 단일 입력값과 동기화
    if (multiSeriesEnabled) {
      setSeries((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const first = { ...next[0], values: [...next[0].values] };
        first.values[index] = newDataPoints[index].value;
        next[0] = first;
        return next;
      });
    }
  };


  // 차트 설정 상태를 전역 store에 동기화 (탭 이동 후에도 유지)
  useEffect(() => {
    setCurrentChart({
      chartType,
      dataSource,
      chartTitle,
      xAxisLabel,
      yAxisLabel,
      dataPoints,
      labels: dataPoints.map((p) => p.label).filter((l) => l.trim() !== ''),
      datasets: multiSeriesEnabled
        ? series.map((s) => ({ label: s.name, data: s.values, type: s.type }))
        : undefined,
    });
  }, [chartType, dataSource, chartTitle, xAxisLabel, yAxisLabel, dataPoints, setCurrentChart]);

  // 차트 렌더링
  useEffect(() => {
    if (!chartType || !dataSource) {
      setIsChartRendered(false);
      return;
    }

    const loadAndRender = async () => {
      // canvasRef가 준비될 때까지 대기
      if (!canvasRef.current) {
        // 다음 프레임에서 다시 시도
        requestAnimationFrame(() => {
          loadAndRender();
        });
        return;
      }

      await ensureChartJsLoaded();
      renderChart();
    };

    loadAndRender();
  }, [chartType, chartTitle, dataPoints, xAxisLabel, yAxisLabel, dataSource]);

  // 차트 렌더링 함수
  const renderChart = () => {
    if (!canvasRef.current || !chartType) {
      setIsChartRendered(false);
      return;
    }
    // @ts-expect-error - Chart.js는 window에 동적으로 추가됨
    if (typeof window.Chart === 'undefined') {
      setIsChartRendered(false);
      return;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) {
      setIsChartRendered(false);
      return;
    }

    // Theme ENV_COLORS (match homepage tokens)
    const cssVar = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const hsl = (name: string) => `hsl(${cssVar(name)})`;
    const hsla = (name: string, alpha: number) => `hsl(${cssVar(name)} / ${alpha})`;
    const themeForeground = hsl('--foreground');
    const themeMuted = hsl('--muted-foreground');
    const themeBorder = hsla('--border', 0.55);
    const themeBorderSoft = hsla('--border', 0.25);

    // Canvas background should be white (hint: also fixes exported PNG background)
    const canvasBgPlugin = {
      id: 'canvas-bg',
      beforeDraw: (chart: unknown) => {
        const c = chart as { ctx?: CanvasRenderingContext2D; width?: number; height?: number };
        const ctx = c.ctx;
        if (!ctx || typeof c.width !== 'number' || typeof c.height !== 'number') return;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.restore();
      },
    };

    // 기존 차트 파괴
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const labels = dataPoints.map(d => d.label).filter(l => l.trim() !== '');
    const primaryData = dataPoints.map(d => d.value).slice(0, labels.length);

    if (labels.length === 0) {
      setIsChartRendered(false);
      return;
    }

    let backgroundColor: string | string[], borderColor: string | string[];
    // Chart.js 실제 타입 매핑
    const actualChartType =
      chartType === 'area'
        ? 'line'
        : chartType === 'horizontal'
          ? 'bar'
          : chartType === 'stacked_bar'
            ? 'bar'
            : chartType === 'mixed'
              ? 'bar'
              : chartType;

    const isPieLike = actualChartType === 'pie' || actualChartType === 'doughnut';
    if (isPieLike) {
      backgroundColor = primaryData.map((_v: number, i: number) => ENV_COLORS[i % ENV_COLORS.length]);
      borderColor = '#ffffff';
    } else if (actualChartType === 'bar') {
      // 막대 그래프는 데이터 포인트(연도)별로 서로 다른 그린 톤 적용
      const barShades = [ENV_COLORS[3], ENV_COLORS[2], ENV_COLORS[1], ENV_COLORS[0]];
      backgroundColor = labels.map((_l: string, i: number) => barShades[i % barShades.length]);
      borderColor = labels.map((_l: string, i: number) => barShades[i % barShades.length]);
    } else {
      backgroundColor = ENV_COLORS[0] + 'D9';
      borderColor = ENV_COLORS[0];
    }

    const shouldShowLegend = legendEnabled && (multiSeriesEnabled ? series.length > 1 : isPieLike);

    const buildDatasets = () => {
      if (!multiSeriesEnabled) {
        return [
          {
            label: chartTitle,
            data: primaryData,
            backgroundColor,
            borderColor,
            borderWidth: 2,
            borderRadius: 8,
            ...((actualChartType === 'line' || chartType === 'area') && {
              tension: 0.4,
              fill: chartType === 'area',
              backgroundColor: ENV_COLORS[0] + '33',
              pointBackgroundColor: ENV_COLORS[0],
              pointRadius: 5,
              pointHoverRadius: 7
            })
          },
        ];
      }

      const usableSeries = series.slice(0, 6);
    const seriesDatasets = usableSeries.map((s, idx) => {
        const shade = ENV_COLORS[idx % ENV_COLORS.length];
      const base: Record<string, unknown> = {
          label: s.name || `시리즈 ${idx + 1}`,
          data: s.values.slice(0, labels.length),
          borderWidth: 2,
          borderRadius: 8,
        };
        if (chartType === 'mixed') {
          base.type = s.type;
        }
        if (chartType === 'stacked_bar') {
          base.stack = 'stack1';
        }
        if (s.type === 'line' || actualChartType === 'line') {
          base.borderColor = shade;
          base.backgroundColor = shade + '33';
          base.tension = 0.35;
          base.pointRadius = 4;
          base.pointHoverRadius = 6;
          base.fill = chartType === 'area';
        } else {
          base.backgroundColor = shade;
          base.borderColor = shade;
        }
        return base;
      });
      return seriesDatasets;
    };

    const ChartCtor = (window as unknown as { Chart?: ChartConstructor }).Chart;
    if (!ChartCtor) {
      setIsChartRendered(false);
      return;
    }
    chartInstanceRef.current = new ChartCtor(ctx, {
      type: actualChartType,
      data: {
        labels: labels,
        datasets: buildDatasets(),
      },
      plugins: [canvasBgPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...(chartType === 'horizontal' ? { indexAxis: 'y' as const } : {}),
        plugins: {
          title: {
            display: true,
            text: chartTitle,
            color: themeForeground,
            font: {
              size: 18,
              weight: 'bold'
            },
            padding: {
              top: 10,
              bottom: 20
            }
          },
          legend: {
            display: shouldShowLegend,
            position: 'bottom',
            labels: {
              color: themeMuted
            }
          }
        },
        scales: (actualChartType === 'bar' || actualChartType === 'line') ? {
          y: {
            beginAtZero: true,
            stacked: chartType === 'stacked_bar',
            title: {
              display: true,
              text: yAxisLabel,
              color: themeMuted,
              font: { weight: 'bold' }
            },
            ticks: {
              color: themeMuted
            },
            grid: {
              color: themeBorder
            }
          },
          x: {
            stacked: chartType === 'stacked_bar',
            title: {
              display: true,
              text: xAxisLabel,
              color: themeMuted,
              font: { weight: 'bold' }
            },
            ticks: {
              color: themeMuted
            },
            grid: {
              color: themeBorderSoft
            }
          }
        } : undefined
      }
    });
    
    setIsChartRendered(true);
  };

  const handleGenerate = async () => {
    if (!chartType || !dataSource) return;
    setIsGenerating(true);
    await ensureChartJsLoaded();
      setIsGenerating(false);
      renderChart();
  };

  // 차트 다운로드
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

  // 차트 저장 (항상 새 차트 추가, 기존 차트는 절대 수정하지 않음)
  const saveChart = () => {
    if (!chartInstanceRef.current || !chartType || !dataSource) {
      toast.error('차트를 먼저 생성해주세요.');
      return;
    }

    const thumbnail = chartInstanceRef.current.toBase64Image('image/png', 0.3);
    
    // 현재 인풋 값으로 새 차트 데이터 생성 (기존 차트와 독립적)
    // dataPoints를 깊은 복사하여 원본 데이터 보호
    const chartDataToSave = {
      chartType: chartType as 'bar' | 'pie' | 'line' | 'area',
      dataSource,
      chartTitle,
      xAxisLabel,
      yAxisLabel,
      dataPoints: dataPoints.map(dp => ({ ...dp })), // 깊은 복사
      labels: dataPoints.map((p) => p.label).filter((l) => l.trim() !== ''),
      datasets: multiSeriesEnabled
        ? series.map((s) => ({ label: s.name, data: [...s.values], type: s.type }))
        : undefined,
      chartImage: thumbnail,
    };
    
    // 항상 새 차트만 추가 (기존 차트는 절대 업데이트하지 않음)
    addChart(chartDataToSave);
    
    toast.success('차트가 저장되었습니다.', {
      description: '대시보드에서 확인할 수 있습니다.',
    });
  };

  // 저장된 차트 로드
  // NOTE: 여기서는 상태만 업데이트하고, 실제 렌더링은 위 useEffect가 상태 변경을 감지해서 실행합니다.
  // 이렇게 해야 첫 클릭 시에도 최신 상태가 반영된 값으로 미리보기가 그려집니다.
  const loadChart = (savedChart: SavedChart) => {
    setChartType(savedChart.chartType);
    setDataSource(savedChart.dataSource);
    setChartTitle(savedChart.chartTitle);
    setXAxisLabel(savedChart.xAxisLabel);
    setYAxisLabel(savedChart.yAxisLabel);
    
    // 새로운 배열을 생성하여 React가 변경을 감지하도록 함
    const newDataPoints = savedChart.dataPoints.map(dp => ({ ...dp }));
    setDataPoints(newDataPoints);
  };

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

  const updateEditableCell = (
    which: 'ghg' | 'invest' | 'water' | 'energy' | 'waste_air',
    tableId: string,
    rowId: string,
    colKey: string,
    value: string
  ) => {
    const setter =
      which === 'ghg'
        ? setGhgTables
        : which === 'invest'
          ? setInvestPueTables
          : which === 'water'
            ? setWaterTables
            : which === 'energy'
              ? setEnergyTables
            : setWasteAirTables;
    setter((prev) =>
      prev.map((t) =>
        t.id !== tableId
          ? t
          : {
              ...t,
              rows: t.rows.map((r) => (r.id !== rowId ? r : { ...r, cells: { ...r.cells, [colKey]: value } })),
            }
      )
    );
  };

  const addEditableRow = (which: 'ghg' | 'invest' | 'water' | 'energy' | 'waste_air', tableId: string) => {
    const setter =
      which === 'ghg'
        ? setGhgTables
        : which === 'invest'
          ? setInvestPueTables
          : which === 'water'
            ? setWaterTables
            : which === 'energy'
              ? setEnergyTables
            : setWasteAirTables;
    setter((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        const empty: Record<string, string> = {};
        t.columns.forEach((c) => (empty[c.key] = ''));
        return { ...t, rows: [...t.rows, { id: makeId(), cells: empty }] };
      })
    );
  };

  const removeEditableRow = (which: 'ghg' | 'invest' | 'water' | 'energy' | 'waste_air', tableId: string, rowId: string) => {
    const setter =
      which === 'ghg'
        ? setGhgTables
        : which === 'invest'
          ? setInvestPueTables
          : which === 'water'
            ? setWaterTables
            : which === 'energy'
              ? setEnergyTables
            : setWasteAirTables;
    setter((prev) =>
      prev.map((t) => (t.id !== tableId ? t : { ...t, rows: t.rows.filter((r) => r.id !== rowId) }))
    );
  };

  const renderEditableTables = (which: 'ghg' | 'invest' | 'water' | 'energy' | 'waste_air', tables: EditableTable[]) => {
    return (
      <div className="space-y-6">
        {tables.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{t.title}</CardTitle>
                  {t.note ? (
                    <CardDescription className="whitespace-pre-line">{t.note}</CardDescription>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      addEsgTable({
                        presetId: tablePreset,
                        title: t.title,
                        note: t.note,
                        columns: t.columns,
                        rows: t.rows,
                      });
                      toast.success('도표가 최종보고서에 저장되었습니다.');
                    }}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    저장
                  </Button>
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
                    <Download className="h-4 w-4 mr-1" />
                    다운로드
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
                            c.align === 'right'
                              ? 'text-right'
                              : c.align === 'center'
                                ? 'text-center'
                                : 'text-left'
                          } ${
                            c.key === 'category'
                              ? 'w-[360px]'
                              : c.key === 'division'
                                ? 'w-[220px]'
                                : c.key === 'item'
                                  ? 'w-[260px]'
                                  : c.key === 'metric'
                                    ? 'w-[220px]'
                                    : c.key === 'method'
                                      ? 'w-[180px]'
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
                          const align =
                            c.align === 'right'
                              ? 'text-right'
                              : c.align === 'center'
                                ? 'text-center'
                                : 'text-left';
                          const val = r.cells?.[c.key] ?? '';
                          const isTextColumn =
                            c.key === 'category' ||
                            c.key === 'metric' ||
                            c.key === 'division' ||
                            c.key === 'item' ||
                            c.key === 'method' ||
                            c.key === 'unit';
                          return (
                            <td key={c.key} className={`p-2 ${align}`}>
                              <Input
                                value={val}
                                onChange={(e) =>
                                  updateEditableCell(which, t.id, r.id, c.key, e.target.value)
                                }
                                className={`h-11 text-base ${align} ${isTextColumn ? '' : 'tabular-nums'} ${
                                  c.key === 'category' ? 'text-base font-medium' : ''
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="p-2 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeEditableRow(which, t.id, r.id)}
                          >
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
      {/* 카테고리 탭 */}
      <div className="border-b border-border">
        <div className="flex justify-center gap-6">
          {categoryTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setEnvCategory(t.id)}
              className={`px-8 py-3 text-lg font-bold transition-colors border-b-2 -mb-[2px] ${
                envCategory === t.id
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 레이아웃: (좌+중)=80%(3:5), 우=20% */}
      <div className="flex flex-col xl:flex-row gap-8 items-start">
        <div className="w-full xl:flex-[8] min-w-0">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,5fr)] gap-x-8 gap-y-4 items-start">
            {/* 좌측: 설정 패널 */}
            <div className="space-y-4">
              <div className="space-y-4">
            {/* 데이터 소스 선택 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">데이터 소스</CardTitle>
                <CardDescription>
                  시각화할 데이터 유형을 선택하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={dataSource} onValueChange={handleDataSourceChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="데이터 유형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDataSources.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* 차트 설정 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">차트 설정</CardTitle>
                <CardDescription>
                  차트의 세부 설정을 조정하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="font-semibold text-sm">범례/멀티시리즈</div>
                    <div className="text-xs text-muted-foreground">
                      누적 막대/혼합형(막대+선) 및 범례 표시를 위한 멀티 시리즈 입력
                    </div>
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
                              return [
                                {
                                  id: makeId(),
                                  name: '시리즈 1',
                                  type: 'bar',
                                  values: dataPoints.map((p) => p.value),
                                },
                              ];
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="chart-title">차트 제목</Label>
                  <Input
                    id="chart-title"
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    placeholder="예: 2024년 탄소 배출량 현황"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="x-axis">X축 라벨</Label>
                  <Input
                    id="x-axis"
                    value={xAxisLabel}
                    onChange={(e) => setXAxisLabel(e.target.value)}
                    placeholder="예: 월별"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="y-axis">Y축 라벨</Label>
                  <Input
                    id="y-axis"
                    value={yAxisLabel}
                    onChange={(e) => setYAxisLabel(e.target.value)}
                    placeholder="예: 배출량 (tCO2eq)"
                    className="mt-1"
                  />
                </div>

                {/* 데이터 포인트 입력 */}
                <div className="pt-4 border-t">
                  <Label className="mb-2 block">데이터 포인트</Label>
                  {dataSourceLegendHints[dataSource]?.length ? (
                    <div className="mb-3 text-xs text-muted-foreground">
                      <span className="font-semibold">범례:</span>{" "}
                      {dataSourceLegendHints[dataSource].join(", ")}
                    </div>
                  ) : null}
                  {!multiSeriesEnabled ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {dataPoints.map((point, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <span className="font-bold text-muted-foreground text-xs w-4">{index + 1}.</span>
                          <Input
                            placeholder="레이블"
                            value={point.label}
                            onChange={(e) => updateDataPoint(index, 'label', e.target.value)}
                            className="flex-1 text-sm"
                          />
                          <Input
                            type="number"
                            placeholder="값"
                            value={point.value || ''}
                            onChange={(e) => updateDataPoint(index, 'value', e.target.value)}
                            className="w-20 text-right text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          시리즈는 최대 6개까지, 라벨은 최대 10개까지 입력을 권장합니다.
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSeries((prev) => {
                                if (prev.length >= 6) return prev;
                                return [
                                  ...prev,
                                  { id: makeId(), name: `시리즈 ${prev.length + 1}`, type: 'bar', values: dataPoints.map(() => 0) },
                                ];
                              });
                            }}
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
                        {series.map((s, sidx) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <Input
                              value={s.name}
                              onChange={(e) =>
                                setSeries((prev) =>
                                  prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x))
                                )
                              }
                              className="flex-1 text-sm"
                              placeholder={`시리즈 ${sidx + 1} 이름`}
                            />
                            {chartType === 'mixed' ? (
                              <Select
                                value={s.type}
                                onValueChange={(v) =>
                                  setSeries((prev) =>
                                    prev.map((x) => (x.id === s.id ? { ...x, type: v as SeriesType } : x))
                                  )
                                }
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
                              <div className="w-[110px] text-xs text-muted-foreground text-right pr-1">
                                {chartType === 'stacked_bar' ? '누적' : '시리즈'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2 max-h-52 overflow-y-auto">
                        {dataPoints.map((p, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 items-center">
                            <Input
                              value={p.label}
                              onChange={(e) => updateDataPoint(idx, 'label', e.target.value)}
                              className="text-sm"
                              placeholder={`레이블 ${idx + 1}`}
                            />
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
                            {series.length > 3 ? (
                              <div className="text-[11px] text-muted-foreground text-right pr-1">
                                +{series.length - 3}개
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={addDataPoint}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={dataPoints.length >= 10}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      추가
                    </Button>
                    <Button
                      onClick={removeDataPoint}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={dataPoints.length <= 1}
                    >
                      <Minus className="h-3 w-3 mr-1" />
                      제거
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

                {/* NOTE: 차트 유형/생성 버튼/갤러리는 우측 패널에만 표시합니다. */}
              </div>
            </div>

            {/* 중간: 차트 미리보기 */}
            <div className="min-w-0">
          <Card className="min-h-[720px] h-[calc(100vh-320px)]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">차트 미리보기</CardTitle>
                  <CardDescription>
                    생성된 차트를 확인하고 다운로드하세요
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={downloadChart} disabled={!isChartRendered}>
                    <Download className="h-4 w-4 mr-1" />
                    PNG
                  </Button>
                  <Button variant="outline" size="sm" onClick={saveChart} disabled={!isChartRendered}>
                    <Save className="h-4 w-4 mr-1" />
                    저장
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[calc(100%-84px)]">
              {chartType && dataSource && dataPoints.filter(p => p.label.trim() !== '').length > 0 ? (
                <div className="flex items-center justify-center h-full rounded-lg border border-border bg-white">
                  <div className="w-full h-full p-6">
                    <canvas ref={canvasRef} className="w-full h-full"></canvas>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">차트 유형과 데이터 소스를 선택한 후<br />차트 생성하기 버튼을 클릭하세요</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
            </div>

            {/* 테이블: 좌+중 영역으로 span, 차트 아래에 바로 붙도록 */}
            <div className="xl:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">ESG DATA 테이블</CardTitle>
                      <CardDescription>테이블 세트를 선택하고 각 셀 값을 직접 입력/편집할 수 있습니다.</CardDescription>
                    </div>
                    <div className="min-w-[320px]">
                      <Select value={tablePreset} onValueChange={(v) => setTablePreset(v as EnvTablePresetId)}>
                        <SelectTrigger>
                          <SelectValue placeholder="테이블 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {envCategory === 'ghg_energy' &&
                            TABLE_PRESETS.filter((p) => p.id === 'ghg_emissions' || p.id === 'energy' || p.id === 'investment_pue').map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.label}
                              </SelectItem>
                            ))}
                          {envCategory === 'water_wastewater' &&
                            TABLE_PRESETS.filter((p) => p.id === 'water').map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.label}
                              </SelectItem>
                            ))}
                          {envCategory === 'waste_air' &&
                            TABLE_PRESETS.filter((p) => p.id === 'waste_air').map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {TABLE_PRESETS.find((p) => p.id === tablePreset)?.description}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {envCategory === 'ghg_energy' && tablePreset === 'ghg_emissions' && renderEditableTables('ghg', ghgTables)}
                  {envCategory === 'ghg_energy' && tablePreset === 'investment_pue' && renderEditableTables('invest', investPueTables)}
                  {envCategory === 'ghg_energy' && tablePreset === 'energy' && renderEditableTables('energy', energyTables)}
                  {envCategory === 'water_wastewater' && tablePreset === 'water' && renderEditableTables('water', waterTables)}
                  {envCategory === 'waste_air' && tablePreset === 'waste_air' && renderEditableTables('waste_air', wasteAirTables)}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* 우측: 차트 유형/생성/갤러리 */}
        <div className="w-full xl:flex-[2] min-w-0 space-y-4 xl:sticky xl:top-24 self-start">
          {/* 차트 유형 선택 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center">
                <Settings className="h-6 w-6 mr-2 text-secondary" />
                차트 유형
              </CardTitle>
              <CardDescription>
                데이터에 적합한 차트 유형을 선택하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {chartTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <div
                      key={type.value}
                      className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                        chartType === type.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      }`}
                      onClick={() => setChartType(type.value)}
                    >
                      <Icon
                        className={`h-7 w-7 mb-2 ${
                          chartType === type.value ? 'text-secondary' : 'text-muted-foreground'
                        }`}
                      />
                      <h4 className="font-bold text-base mb-1">{type.label}</h4>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 생성 버튼 */}
          <Button
            onClick={handleGenerate}
            disabled={!chartType || !dataSource || isGenerating}
            className="w-full bg-accent hover:bg-accent/90 text-white py-4 text-lg font-bold"
          >
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
              <CardDescription>
                최근 생성된 차트들을 확인하고 재사용하세요
              </CardDescription>
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
                        <img
                          src={savedChart.thumbnail}
                          alt={savedChart.chartTitle}
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <BarChart3 className="h-10 w-10 mx-auto mb-2 text-secondary opacity-60 group-hover:opacity-100 transition-opacity" />
                            <p className="text-xs text-muted-foreground truncate px-2">{savedChart.chartTitle}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  [1, 2, 3, 4].map((index) => (
                    <div
                      key={index}
                      className="w-full h-[130px] bg-seed-light/20 rounded-lg border border-border flex items-center justify-center"
                    >
                      <div className="text-center">
                        <BarChart3 className="h-10 w-10 mx-auto mb-2 text-secondary opacity-30" />
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
              <CardDescription>
                저장한 ESG DATA 테이블을 최종보고서에 포함할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {esgTables.filter((t: SavedEsgTable) => ['ghg_emissions', 'energy', 'investment_pue', 'water', 'waste_air'].includes(t.presetId)).length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  저장된 도표가 없습니다. 각 테이블의 “저장”을 눌러 추가하세요.
                </div>
              ) : (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {esgTables
                    .filter((t: SavedEsgTable) => ['ghg_emissions', 'energy', 'investment_pue', 'water', 'waste_air'].includes(t.presetId))
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
                              // CSV 다운로드
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
