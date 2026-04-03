import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Download, Minus, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useReportStore, type ChartData, type SavedEsgTable } from '@/store/reportStore';
import type { DataPoint, ChartSeries, SeriesType, SavedChart, EditableTable, SocialTablePresetId } from '../types';
import { makeId, ensureChartJsLoaded, hydrateTables } from '../utils/chartJs';
import {
  TABLE_PRESETS,
  socialTabs,
  SOC_WORKFORCE_TABLES,
  SOC_TRAINING_TABLES,
  SOC_DIVERSITY_RETENTION_TABLES,
  SOC_SAFETY_HEALTH_TABLES,
  SOC_SUPPLY_CHAIN_TABLES,
  SOC_CUSTOMER_PRIVACY_TABLES,
  SOCIAL_COLORS,
} from '../data/social-data';

type ChartInstance = {
  destroy: () => void;
  toBase64Image: (type?: string, quality?: number) => string;
};
type ChartConstructor = new (ctx: CanvasRenderingContext2D, config: unknown) => ChartInstance;
const getChartConstructor = () => (window as unknown as { Chart?: ChartConstructor }).Chart;

export function SocialChartsPage() {
  const { esgTables, addEsgTable, removeEsgTable } = useReportStore();
  const [tablePreset, setTablePreset] = useState<SocialTablePresetId>('social_workforce');
  const [workforceTables, setWorkforceTables] = useState<EditableTable[]>(() => hydrateTables(SOC_WORKFORCE_TABLES, makeId));
  const [trainingTables, setTrainingTables] = useState<EditableTable[]>(() => hydrateTables(SOC_TRAINING_TABLES, makeId));
  const [diversityTables, setDiversityTables] = useState<EditableTable[]>(() => hydrateTables(SOC_DIVERSITY_RETENTION_TABLES, makeId));
  const [safetyTables, setSafetyTables] = useState<EditableTable[]>(() => hydrateTables(SOC_SAFETY_HEALTH_TABLES, makeId));
  const [supplyTables, setSupplyTables] = useState<EditableTable[]>(() => hydrateTables(SOC_SUPPLY_CHAIN_TABLES, makeId));
  const [customerTables, setCustomerTables] = useState<EditableTable[]>(() => hydrateTables(SOC_CUSTOMER_PRIVACY_TABLES, makeId));

  const [socialTab, setSocialTab] = useState<(typeof socialTabs)[number]['id']>('people_edu');

  // 차트 빌더 (Environmental과 동일 구조)
  const { charts, addChart, removeChart, currentChart, setCurrentChart } = useReportStore();
  const [chartType, setChartType] = useState(currentChart?.chartType || '');
  const [dataSource, setDataSource] = useState(currentChart?.dataSource || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chartTitle, setChartTitle] = useState(currentChart?.chartTitle || '');
  const [dataPoints, setDataPoints] = useState<DataPoint[]>(
    currentChart?.dataPoints?.length
      ? currentChart.dataPoints
      : [
          { label: '2022', value: 0 },
          { label: '2023', value: 0 },
          { label: '2024', value: 0 },
        ]
  );
  const [xAxisLabel, setXAxisLabel] = useState(currentChart?.xAxisLabel || '연도');
  const [yAxisLabel, setYAxisLabel] = useState(currentChart?.yAxisLabel || '(단위 : )');
  const [centerText, setCenterText] = useState<string>('');
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
          : (currentChart?.dataPoints?.length ? currentChart.dataPoints.map((p: { value: number }) => p.value) : [0, 0, 0]),
    },
  ]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<ChartInstance | null>(null);
  const [isChartRendered, setIsChartRendered] = useState(false);

  // store의 charts를 갤러리용 형식으로 변환/동기화 (Environmental과 동일)
  const isSocialChart = (c: ChartData) => (c.dataSource ?? '').startsWith('social_');

  const [savedCharts, setSavedCharts] = useState<SavedChart[]>(() =>
    charts
      .filter(isSocialChart)
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
        .filter(isSocialChart)
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

  const chartTypes = [
    { value: 'bar', label: '막대 차트', description: '카테고리별 데이터 비교' },
    { value: 'stacked_bar', label: '누적 막대 차트', description: '여러 시리즈 누적 합산' },
    { value: 'horizontal', label: '수평 막대 차트', description: '항목이 많을 때 가독성 좋음' },
    { value: 'pie', label: '원형 차트', description: '전체 대비 비율' },
    { value: 'doughnut', label: '도넛 차트', description: '비율 + 중앙 공간' },
    { value: 'line', label: '선형 차트', description: '시간 변화 추이' },
    { value: 'mixed', label: '혼합형(막대+선)', description: '시리즈별 막대/선 혼합' },
    { value: 'area', label: '영역 차트', description: '누적 데이터 변화' },
  ];

  type SocialGraphPreset = {
    id: string;
    tab: (typeof socialTabs)[number]['id'];
    label: string; // 드롭다운 표시명
    apply: () => {
      chartType: string;
      chartTitle: string;
      xAxisLabel: string;
      yAxisLabel: string;
      legendEnabled: boolean;
      multiSeriesEnabled: boolean;
      dataPoints: DataPoint[];
      series?: ChartSeries[];
      centerText?: string;
    };
  };

  // 임직원/교육 그래프 프리셋 (Environmental처럼 데이터 소스에서 선택)
  const SOCIAL_GRAPH_PRESETS: SocialGraphPreset[] = [
    {
      id: 'social_graph_people_edu_employees_2024',
      tab: 'people_edu',
      label: '임직원 수(2024)',
      apply: () => {
        const total = 23174;
        const female = 5800; // 이미지상 약 25% 수준
        const male = total - female;
        return {
          chartType: 'doughnut',
          chartTitle: '임직원 수(2024)',
          xAxisLabel: '성별',
          yAxisLabel: '(단위 : 명)',
          legendEnabled: true,
          multiSeriesEnabled: false,
          dataPoints: [
            { label: '임직원수(남성)', value: male },
            { label: '임직원수(여성)', value: female },
          ],
          centerText: `총 ${total.toLocaleString()} 명`,
        };
      },
    },
    {
      id: 'social_graph_people_edu_disabled',
      tab: 'people_edu',
      label: '장애인 고용 현황',
      apply: () => {
        const total = 23174;
        const counts = [335, 352, 350];
        const ratios = counts.map((c) => Math.round((c / total) * 1000) / 10); // 소수 1자리(%)
        return {
          chartType: 'mixed',
          chartTitle: '장애인 고용 현황',
          xAxisLabel: '연도',
          yAxisLabel: '(단위 : 명, %)',
          legendEnabled: true,
          multiSeriesEnabled: true,
          dataPoints: [
            { label: '2022', value: counts[0] },
            { label: '2023', value: counts[1] },
            { label: '2024', value: counts[2] },
          ],
          series: [
            { id: makeId(), name: '장애인 구성원 수', type: 'bar', values: counts },
            { id: makeId(), name: '장애인 비율', type: 'line', values: ratios },
          ],
        };
      },
    },
    {
      id: 'social_graph_people_edu_domestic_employees',
      tab: 'people_edu',
      label: '국내 임직원 현황',
      apply: () => ({
        chartType: 'bar',
        chartTitle: '국내 임직원 현황',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 명)',
        legendEnabled: false,
        multiSeriesEnabled: false,
        dataPoints: [
          { label: '2022', value: 9500 },
          { label: '2023', value: 10000 },
          { label: '2024', value: 10200 },
        ],
      }),
    },
    {
      id: 'social_graph_people_edu_overseas_employees',
      tab: 'people_edu',
      label: '해외 임직원 현황',
      apply: () => ({
        chartType: 'stacked_bar',
        chartTitle: '해외 임직원 현황',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 명)',
        legendEnabled: true,
        multiSeriesEnabled: true,
        dataPoints: [
          { label: '2022', value: 0 },
          { label: '2023', value: 0 },
          { label: '2024', value: 0 },
        ],
        series: [
          { id: makeId(), name: '유럽', type: 'bar', values: [4000, 5000, 4500] },
          { id: makeId(), name: '미주', type: 'bar', values: [3000, 5000, 3500] },
          { id: makeId(), name: '아시아', type: 'bar', values: [7000, 7000, 5000] },
        ],
      }),
    },
    {
      id: 'social_graph_people_edu_female_domestic',
      tab: 'people_edu',
      label: '여성 임직원 현황(국내)',
      apply: () => ({
        chartType: 'mixed',
        chartTitle: '여성 임직원 현황(국내)',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 명, %)',
        legendEnabled: true,
        multiSeriesEnabled: true,
        dataPoints: [
          { label: '2022', value: 1700 },
          { label: '2023', value: 1850 },
          { label: '2024', value: 1950 },
        ],
        series: [
          { id: makeId(), name: '여성 임직원 수', type: 'bar', values: [1700, 1850, 1950] },
          { id: makeId(), name: '여성 관리직 비율', type: 'line', values: [8, 9, 10] },
        ],
      }),
    },
    {
      id: 'social_graph_people_edu_domestic_hires',
      tab: 'people_edu',
      label: '국내 신규 채용',
      apply: () => ({
        chartType: 'bar',
        chartTitle: '국내 신규 채용',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 명)',
        legendEnabled: false,
        multiSeriesEnabled: false,
        dataPoints: [
          { label: '2022', value: 2000 },
          { label: '2023', value: 1200 },
          { label: '2024', value: 800 },
        ],
      }),
    },
    {
      id: 'social_graph_people_edu_overseas_hires',
      tab: 'people_edu',
      label: '해외 신규 채용',
      apply: () => ({
        chartType: 'stacked_bar',
        chartTitle: '해외 신규 채용',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 명)',
        legendEnabled: true,
        multiSeriesEnabled: true,
        dataPoints: [
          { label: '2022', value: 0 },
          { label: '2023', value: 0 },
          { label: '2024', value: 0 },
        ],
        series: [
          { id: makeId(), name: '유럽', type: 'bar', values: [2000, 2500, 1000] },
          { id: makeId(), name: '미주', type: 'bar', values: [3500, 2500, 1500] },
          { id: makeId(), name: '아시아', type: 'bar', values: [2500, 4000, 1500] },
        ],
      }),
    },
    {
      id: 'social_graph_people_edu_domestic_turnover',
      tab: 'people_edu',
      label: '국내 퇴직 현황',
      apply: () => ({
        chartType: 'mixed',
        chartTitle: '국내 퇴직 현황',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 명, %)',
        legendEnabled: true,
        multiSeriesEnabled: true,
        dataPoints: [
          { label: '2022', value: 330 },
          { label: '2023', value: 450 },
          { label: '2024', value: 650 },
        ],
        series: [
          { id: makeId(), name: '국내 퇴직 인원', type: 'bar', values: [330, 450, 650] },
          { id: makeId(), name: '자발적 이직률', type: 'line', values: [2.1, 2.1, 3.0] },
        ],
      }),
    },
    {
      id: 'social_graph_people_edu_training_hours_total',
      tab: 'people_edu',
      label: '총 교육 시간',
      apply: () => ({
        chartType: 'bar',
        chartTitle: '총 교육 시간',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 시간)',
        legendEnabled: false,
        multiSeriesEnabled: false,
        dataPoints: [
          { label: '2022', value: 380000 },
          { label: '2023', value: 420000 },
          { label: '2024', value: 520000 },
        ],
      }),
    },
    {
      id: 'social_graph_people_edu_training_cost_total',
      tab: 'people_edu',
      label: '총 교육 비용',
      apply: () => ({
        chartType: 'bar',
        chartTitle: '총 교육 비용',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 억원)',
        legendEnabled: false,
        multiSeriesEnabled: false,
        dataPoints: [
          { label: '2022', value: 280 },
          { label: '2023', value: 340 },
          { label: '2024', value: 300 },
        ],
      }),
    },
    {
      id: 'social_graph_people_edu_training_cost_per_capita',
      tab: 'people_edu',
      label: '인당 교육 비용',
      apply: () => ({
        chartType: 'bar',
        chartTitle: '인당 교육 비용',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 백만원)',
        legendEnabled: false,
        multiSeriesEnabled: false,
        dataPoints: [
          { label: '2022', value: 5.8 },
          { label: '2023', value: 6.0 },
          { label: '2024', value: 5.3 },
        ],
      }),
    },
    // 안전보건 / 윤리
    {
      id: 'social_graph_safety_ethics_lti_ltir',
      tab: 'safety_ethics',
      label: '근로손실재해건수 및 비율',
      apply: () => ({
        chartType: 'mixed',
        chartTitle: '근로손실재해건수 및 비율',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 건, 20만근로시간 당 건수)',
        legendEnabled: true,
        multiSeriesEnabled: true,
        dataPoints: [
          { label: '2022', value: 33 },
          { label: '2023', value: 38 },
          { label: '2024', value: 13 },
        ],
        series: [
          { id: makeId(), name: '근로손실재해건수 LTI(합계)', type: 'bar', values: [33, 38, 13] },
          // 이미지상 추세(2023 최고, 2024 감소) 맞춘 근사치
          { id: makeId(), name: '근로손실재해율 LTIR(합계)', type: 'line', values: [0.28, 0.32, 0.11] },
        ],
      }),
    },
    {
      id: 'social_graph_safety_ethics_ethics_training_hours',
      tab: 'safety_ethics',
      label: '윤리 교육 시간',
      apply: () => ({
        chartType: 'bar',
        chartTitle: '윤리 교육 시간',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 시간)',
        legendEnabled: false,
        multiSeriesEnabled: false,
        dataPoints: [
          { label: '2022', value: 8343 },
          { label: '2023', value: 6718 },
          { label: '2024', value: 7738 },
        ],
      }),
    },
    {
      id: 'social_graph_safety_ethics_tri_trir',
      tab: 'safety_ethics',
      label: '총 기록재해건수 및 비율',
      apply: () => ({
        chartType: 'mixed',
        chartTitle: '총 기록재해건수 및 비율',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 건, 20만근로시간 당 건수)',
        legendEnabled: true,
        multiSeriesEnabled: true,
        dataPoints: [
          { label: '2022', value: 62 },
          { label: '2023', value: 70 },
          { label: '2024', value: 58 },
        ],
        series: [
          { id: makeId(), name: '총 기록재해건수 TRI(합계)', type: 'bar', values: [62, 70, 58] },
          // 이미지상 0.3 내외의 완만한 변화 추세(근사치)
          { id: makeId(), name: '총 기록재해율 TRIR(합계)', type: 'line', values: [0.32, 0.34, 0.31] },
        ],
      }),
    },
    {
      id: 'social_graph_safety_ethics_fatality',
      tab: 'safety_ethics',
      label: 'Fatality',
      apply: () => ({
        chartType: 'mixed',
        chartTitle: 'Fatality',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 명, 건)',
        legendEnabled: true,
        multiSeriesEnabled: true,
        dataPoints: [
          { label: '2022', value: 0 },
          { label: '2023', value: 0 },
          { label: '2024', value: 0 },
        ],
        series: [
          { id: makeId(), name: 'Fatality (구성원)', type: 'bar', values: [0, 0, 0] },
          { id: makeId(), name: 'Fatality (협력사)', type: 'bar', values: [3, 0, 1] },
          { id: makeId(), name: '직업성질환 발생건수', type: 'line', values: [0, 2, 0] },
        ],
      }),
    },
    {
      id: 'social_graph_safety_ethics_safety_training_hours',
      tab: 'safety_ethics',
      label: '산업안전 교육 시간',
      apply: () => ({
        chartType: 'mixed',
        chartTitle: '산업안전 교육 시간',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 시간, 시간(1인당))',
        legendEnabled: true,
        multiSeriesEnabled: true,
        dataPoints: [
          { label: '2022', value: 130000 },
          { label: '2023', value: 190000 },
          { label: '2024', value: 110000 },
        ],
        series: [
          { id: makeId(), name: '산업안전 교육 시간', type: 'bar', values: [130000, 190000, 110000] },
          { id: makeId(), name: '인당 산업안전 교육 시간', type: 'line', values: [22, 30, 16] },
        ],
      }),
    },
    {
      id: 'social_graph_safety_ethics_ethics_mgmt_overview',
      tab: 'safety_ethics',
      label: '윤리 경영 현황',
      apply: () => ({
        chartType: 'stacked_bar',
        chartTitle: '윤리 경영 현황',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 건)',
        legendEnabled: true,
        multiSeriesEnabled: true,
        dataPoints: [
          { label: '2022', value: 0 },
          { label: '2023', value: 0 },
          { label: '2024', value: 0 },
        ],
        series: [
          { id: makeId(), name: '윤리경영 제보 건수', type: 'bar', values: [60, 90, 120] },
          { id: makeId(), name: '윤리경영 상담 건수', type: 'bar', values: [80, 45, 30] },
          { id: makeId(), name: '윤리경영 발견 건수', type: 'bar', values: [30, 25, 20] },
        ],
      }),
    },
    {
      id: 'social_graph_safety_ethics_ethics_violation_discipline',
      tab: 'safety_ethics',
      label: '윤리경영 위반 징계 현황',
      apply: () => ({
        chartType: 'bar',
        chartTitle: '윤리경영 위반 징계 현황',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 건)',
        legendEnabled: false,
        multiSeriesEnabled: false,
        dataPoints: [
          { label: '2022', value: 25 },
          { label: '2023', value: 50 },
          { label: '2024', value: 105 },
        ],
      }),
    },
    // 사회공헌 / 협력사
    {
      id: 'social_graph_contrib_partner_social_spend',
      tab: 'contrib_partner',
      label: '사회공헌 활동 비용',
      apply: () => ({
        chartType: 'bar',
        chartTitle: '사회공헌 활동 비용',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 억원)',
        legendEnabled: false,
        multiSeriesEnabled: false,
        dataPoints: [
          { label: '2022', value: 435 },
          { label: '2023', value: 505 },
          { label: '2024', value: 272 },
        ],
      }),
    },
    {
      id: 'social_graph_contrib_partner_esg_risk_suppliers',
      tab: 'contrib_partner',
      label: 'ESG리스크 평가 협력사 수',
      apply: () => ({
        chartType: 'bar',
        chartTitle: 'ESG리스크 평가 협력사 수',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 개)',
        legendEnabled: false,
        multiSeriesEnabled: false,
        dataPoints: [
          { label: '2022', value: 1732 },
          { label: '2023', value: 1864 },
          { label: '2024', value: 2001 },
        ],
      }),
    },
    {
      id: 'social_graph_contrib_partner_volunteer_hours',
      tab: 'contrib_partner',
      label: '봉사활동 시간',
      apply: () => ({
        chartType: 'bar',
        chartTitle: '봉사활동 시간',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 시간)',
        legendEnabled: false,
        multiSeriesEnabled: false,
        // 이미지 형태(2024 급증) 기준 근사치
        dataPoints: [
          { label: '2022', value: 20000 },
          { label: '2023', value: 30000 },
          { label: '2024', value: 60000 },
        ],
      }),
    },
    {
      id: 'social_graph_contrib_partner_supplier_purchase',
      tab: 'contrib_partner',
      label: '협력사 구매액',
      apply: () => ({
        chartType: 'bar',
        chartTitle: '협력사 구매액',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 억원)',
        legendEnabled: false,
        multiSeriesEnabled: false,
        // 이미지 형태(2023 최고, 2024 소폭 감소) 기준 근사치
        dataPoints: [
          { label: '2022', value: 45000 },
          { label: '2023', value: 55000 },
          { label: '2024', value: 50000 },
        ],
      }),
    },
    {
      id: 'social_graph_contrib_partner_improvement_plan_suppliers',
      tab: 'contrib_partner',
      label: '개선 계획 수립 협력사 수',
      apply: () => ({
        chartType: 'bar',
        chartTitle: '개선 계획 수립 협력사 수',
        xAxisLabel: '연도',
        yAxisLabel: '(단위 : 개)',
        legendEnabled: false,
        multiSeriesEnabled: false,
        // 이미지 형태(3개년 비슷) 기준 근사치
        dataPoints: [
          { label: '2022', value: 33 },
          { label: '2023', value: 30 },
          { label: '2024', value: 31 },
        ],
      }),
    },
  ];

  const dataSourcesAll: Array<{ value: string; label: string; unit?: string; tab: (typeof socialTabs)[number]['id'] }> = [
    // 임직원/교육
    ...SOCIAL_GRAPH_PRESETS.filter((p) => p.tab === 'people_edu').map((p) => ({ value: p.id, label: p.label, unit: '', tab: p.tab })),
    // 안전보건/윤리
    ...SOCIAL_GRAPH_PRESETS.filter((p) => p.tab === 'safety_ethics').map((p) => ({ value: p.id, label: p.label, unit: '', tab: p.tab })),
    // 사회공헌/협력사
    ...SOCIAL_GRAPH_PRESETS.filter((p) => p.tab === 'contrib_partner').map((p) => ({ value: p.id, label: p.label, unit: '', tab: p.tab })),
  ];
  const filteredDataSources = dataSourcesAll.filter((s) => s.tab === socialTab);

  const applyGraphPresetIfAny = (value: string) => {
    const preset = SOCIAL_GRAPH_PRESETS.find((p) => p.id === value);
    if (!preset) return false;
    const cfg = preset.apply();
    setChartType(cfg.chartType);
    setChartTitle(cfg.chartTitle);
    setXAxisLabel(cfg.xAxisLabel);
    setYAxisLabel(cfg.yAxisLabel);
    setLegendEnabled(cfg.legendEnabled);
    setMultiSeriesEnabled(cfg.multiSeriesEnabled);
    setCenterText(cfg.centerText ?? '');
    setDataPoints(cfg.dataPoints);
    if (cfg.multiSeriesEnabled && cfg.series?.length) setSeries(cfg.series);
    return true;
  };

  useEffect(() => {
    if (!dataSource || !filteredDataSources.some((s) => s.value === dataSource)) {
      const first = filteredDataSources[0]?.value ?? '';
      if (!first) return;
      handleDataSourceChange(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socialTab]);

  const handleDataSourceChange = (value: string) => {
    setDataSource(value);
    if (applyGraphPresetIfAny(value)) return;
    setCenterText('');
    const selected = filteredDataSources.find((s) => s.value === value);
    if (selected) {
      setChartTitle(selected.label);
      setYAxisLabel(selected.unit ? `(단위 : ${selected.unit})` : '(단위 : )');
    }
  };

  const addDataPoint = () => {
    if (dataPoints.length >= 10) return;
    setDataPoints([...dataPoints, { label: '', value: 0 }]);
    syncSeriesLength(dataPoints.length + 1);
  };
  const removeDataPoint = () => {
    if (dataPoints.length > 1) {
      setDataPoints(dataPoints.slice(0, -1));
      syncSeriesLength(dataPoints.length - 1);
    }
  };
  const updateDataPoint = (index: number, field: 'label' | 'value', value: string | number) => {
    const next = [...dataPoints];
    if (field === 'label') next[index].label = value as string;
    else next[index].value = typeof value === 'string' ? parseFloat(value) || 0 : value;
    setDataPoints(next);
    if (multiSeriesEnabled) {
      setSeries((prev) => {
        if (prev.length === 0) return prev;
        const out = [...prev];
        const first = { ...out[0], values: [...out[0].values] };
        first.values[index] = next[index].value;
        out[0] = first;
        return out;
      });
    }
  };

  useEffect(() => {
    setCurrentChart({
      chartType,
      dataSource,
      chartTitle,
      xAxisLabel,
      yAxisLabel,
      dataPoints,
      labels: dataPoints.map((p) => p.label).filter((l) => l.trim() !== ''),
      datasets: multiSeriesEnabled ? series.map((s) => ({ label: s.name, data: s.values, type: s.type })) : undefined,
    });
  }, [chartType, dataSource, chartTitle, xAxisLabel, yAxisLabel, dataPoints, multiSeriesEnabled, series, setCurrentChart]);

  const renderChart = () => {
    if (!canvasRef.current || !chartType) {
      setIsChartRendered(false);
      return;
    }
    const ChartCtor = getChartConstructor();
    if (!ChartCtor) {
      setIsChartRendered(false);
      return;
    }
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const labels = dataPoints.map((d) => d.label).filter((l) => l.trim() !== '');
    const primaryData = dataPoints.map((d) => d.value).slice(0, labels.length);
    if (labels.length === 0) {
      setIsChartRendered(false);
      return;
    }

    const actualChartType =
      chartType === 'area' ? 'line' : chartType === 'horizontal' ? 'bar' : chartType === 'stacked_bar' ? 'bar' : chartType === 'mixed' ? 'bar' : chartType;
    const isPieLike = actualChartType === 'pie' || actualChartType === 'doughnut';
    const shouldShowLegend = legendEnabled && (multiSeriesEnabled ? series.length > 1 : isPieLike);

    const palette = SOCIAL_COLORS;
    const yearColor = (label: string) => {
      if (label.includes('2022')) return palette[0];
      if (label.includes('2023')) return palette[1];
      if (label.includes('2024')) return palette[2];
      return palette[4];
    };

    const buildDatasets = () => {
      if (!multiSeriesEnabled) {
        const pieColors = labels.map((l, i) => {
          // 도넛(임직원 수 2024): 남성=주황, 여성=노랑 톤
          if (l.includes('남성')) return palette[2];
          if (l.includes('여성')) return palette[1];
          return palette[i % 3];
        });
        return [
          {
            label: chartTitle,
            data: primaryData,
            backgroundColor: isPieLike
              ? pieColors
              : (actualChartType === 'bar' ? labels.map((l: string) => yearColor(l)) : palette[2]),
            borderColor: isPieLike ? '#ffffff' : (actualChartType === 'bar' ? labels.map((l: string) => yearColor(l)) : palette[2]),
            borderWidth: 2,
            borderRadius: 8,
            ...((actualChartType === 'line' || chartType === 'area') && {
              tension: 0.35,
              fill: chartType === 'area',
              borderColor: palette[3],
              backgroundColor: palette[3] + '33',
              pointBackgroundColor: palette[3],
              pointRadius: 5,
            }),
          },
        ];
      }
      const barSeriesCount = series.filter((s) => s.type === 'bar').length;
      return series.slice(0, 6).map((s, idx) => {
        // 멀티 시리즈 컬러: 누적막대는 "시리즈(지역)"별 고정색, 콤보는 단일 막대면 연도색 유지
        const shade = palette[idx % palette.length];
        const base: Record<string, unknown> = {
          label: s.name,
          data: s.values.slice(0, labels.length),
          borderWidth: 2,
          borderRadius: 8,
        };

        if (chartType === 'mixed') {
          base.type = s.type;
          base.yAxisID = s.type === 'line' ? 'y1' : 'y';
        }
        if (chartType === 'stacked_bar') base.stack = 'stack1';

        if (s.type === 'line' || actualChartType === 'line') {
          base.borderColor = palette[3];
          base.backgroundColor = palette[3] + '33';
          base.tension = 0.35;
          base.pointRadius = 5;
          base.pointBackgroundColor = '#ffffff';
          base.fill = false;
        } else {
          if (chartType === 'stacked_bar') {
            // 지역별(유럽/미주/아시아) 색 고정
            base.backgroundColor = shade;
            base.borderColor = shade;
          } else if (chartType === 'mixed') {
            // 막대 시리즈가 1개면 연도색(2022/2023/2024), 여러개면 시리즈색
            if (barSeriesCount <= 1) {
              base.backgroundColor = labels.map((l: string) => yearColor(l));
              base.borderColor = labels.map((l: string) => yearColor(l));
            } else {
              base.backgroundColor = shade;
              base.borderColor = shade;
            }
          } else {
            base.backgroundColor = shade;
            base.borderColor = shade;
          }
        }
        return base;
      });
    };

    const hasSecondaryAxis = multiSeriesEnabled && chartType === 'mixed' && series.some((s) => s.type === 'line');
    const getAxisUnitParts = () => {
      const m = yAxisLabel.match(/\(단위\s*:\s*([^)]+)\)/);
      const raw = (m?.[1] ?? '').trim();
      if (!raw) return null;
      const parts = raw
        .split(',')
        .map((p: string) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) return { primary: parts[0], secondary: parts.slice(1).join(', ') };
      return { primary: raw, secondary: '' };
    };
    const unitParts = hasSecondaryAxis ? getAxisUnitParts() : null;

    const centerTextPlugin = {
      id: 'centerTextPlugin',
      afterDraw: (chart: unknown) => {
        if (actualChartType !== 'doughnut' || !centerText) return;
        const c = chart as { ctx?: CanvasRenderingContext2D; chartArea?: { left: number; right: number; top: number; bottom: number } };
        const chartArea = c.chartArea;
        const ctx2 = c.ctx;
        if (!ctx2 || !chartArea) return;
        const x = (chartArea.left + chartArea.right) / 2;
        const y = (chartArea.top + chartArea.bottom) / 2;
        ctx2.save();
        ctx2.textAlign = 'center';
        ctx2.textBaseline = 'middle';
        ctx2.fillStyle = '#111827';
        ctx2.font = 'bold 18px sans-serif';
        ctx2.fillText(centerText, x, y);
        ctx2.restore();
      },
    };

    chartInstanceRef.current = new ChartCtor(ctx, {
      type: actualChartType,
      plugins: [centerTextPlugin],
      data: { labels, datasets: buildDatasets() },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...(chartType === 'horizontal' ? { indexAxis: 'y' as const } : {}),
        plugins: {
          title: { display: true, text: chartTitle, font: { size: 18, weight: 'bold' } },
          legend: { display: shouldShowLegend, position: 'bottom' },
        },
        scales:
          actualChartType === 'bar' || actualChartType === 'line'
            ? {
                y: {
                  beginAtZero: true,
                  stacked: chartType === 'stacked_bar',
                  title: { display: true, text: unitParts?.primary ? `(단위 : ${unitParts.primary})` : yAxisLabel },
                },
                ...(hasSecondaryAxis
                  ? {
                      y1: {
                        beginAtZero: true,
                        position: 'right' as const,
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: unitParts?.secondary ? `(단위 : ${unitParts.secondary})` : '(단위 : )' },
                      },
                    }
                  : {}),
                x: { stacked: chartType === 'stacked_bar', title: { display: true, text: xAxisLabel } },
              }
            : undefined,
      },
    });
    setIsChartRendered(true);
  };

  useEffect(() => {
    if (!chartType || !dataSource) {
      setIsChartRendered(false);
      return;
    }
    const go = async () => {
      if (!canvasRef.current) {
        requestAnimationFrame(() => go());
        return;
      }
      await ensureChartJsLoaded();
      renderChart();
    };
    go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, chartTitle, dataSource, xAxisLabel, yAxisLabel, dataPoints, legendEnabled, multiSeriesEnabled, series]);

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

  const updateEditableCell = (setter: React.Dispatch<React.SetStateAction<EditableTable[]>>, tableId: string, rowId: string, colKey: string, value: string) => {
    setter((prev) =>
      prev.map((t) =>
        t.id !== tableId ? t : { ...t, rows: t.rows.map((r) => (r.id !== rowId ? r : { ...r, cells: { ...r.cells, [colKey]: value } })) }
      )
    );
  };
  const addEditableRow = (setter: React.Dispatch<React.SetStateAction<EditableTable[]>>, tableId: string) => {
    setter((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        const empty: Record<string, string> = {};
        t.columns.forEach((c) => (empty[c.key] = ''));
        return { ...t, rows: [...t.rows, { id: makeId(), cells: empty }] };
      })
    );
  };
  const removeEditableRow = (setter: React.Dispatch<React.SetStateAction<EditableTable[]>>, tableId: string, rowId: string) => {
    setter((prev) => prev.map((t) => (t.id !== tableId ? t : { ...t, rows: t.rows.filter((r) => r.id !== rowId) })));
  };

  const renderEditableTables = (presetId: SocialTablePresetId, tables: EditableTable[], setter: React.Dispatch<React.SetStateAction<EditableTable[]>>) => {
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
                  <Button variant="outline" size="sm" onClick={() => addEditableRow(setter, t.id)}>
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
                            c.key === 'category' ? 'w-[360px]' : c.key === 'country' ? 'w-[180px]' : c.key === 'desc' ? 'w-[520px]' : c.key === 'program' ? 'w-[260px]' : c.key === 'item' ? 'w-[260px]' : c.key === 'metric' ? 'w-[160px]' : c.key === 'group' ? 'w-[220px]' : c.key === 'unit' ? 'w-[110px]' : c.key === 'target' ? 'w-[110px]' : ''
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
                            c.key === 'category' ||
                            c.key === 'item' ||
                            c.key === 'country' ||
                            c.key === 'group' ||
                            c.key === 'program' ||
                            c.key === 'metric' ||
                            c.key === 'desc' ||
                            c.key === 'unit';
                          return (
                            <td key={c.key} className={`p-2 ${align}`}>
                              <Input
                                value={val}
                                onChange={(e) => updateEditableCell(setter, t.id, r.id, c.key, e.target.value)}
                                className={`h-11 text-base ${align} ${isTextColumn ? '' : 'tabular-nums'} ${
                                  c.key === 'category' ? 'text-base font-medium' : ''
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="p-2 text-center">
                          <Button variant="outline" size="sm" onClick={() => removeEditableRow(setter, t.id, r.id)}>
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
      {/* Social 세부 탭(3개) */}
      <div className="border-b border-border">
        <div className="flex justify-center gap-10">
          {socialTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSocialTab(t.id)}
              className={`px-10 py-3 text-lg font-black transition-colors border-b-2 -mb-[2px] ${
                socialTab === t.id
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
            {/* 좌측: 데이터 소스 + 차트 설정 */}
            <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">데이터 소스</CardTitle>
              <CardDescription>시각화할 Social 데이터 유형을 선택하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={dataSource} onValueChange={handleDataSourceChange}>
                <SelectTrigger>
                  <SelectValue placeholder="데이터 유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  {filteredDataSources.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">차트 설정</CardTitle>
              <CardDescription>차트의 세부 설정을 조정하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-semibold text-sm">범례/멀티시리즈</div>
                  <div className="text-xs text-muted-foreground">누적/혼합형 및 범례 표시를 위한 멀티 시리즈 입력</div>
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
                <div className="text-sm font-semibold">차트 제목</div>
                <Input value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} className="mt-1" />
              </div>
              <div>
                <div className="text-sm font-semibold">X축 라벨</div>
                <Input value={xAxisLabel} onChange={(e) => setXAxisLabel(e.target.value)} className="mt-1" />
              </div>
              <div>
                <div className="text-sm font-semibold">Y축 라벨</div>
                <Input value={yAxisLabel} onChange={(e) => setYAxisLabel(e.target.value)} className="mt-1" />
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm font-semibold mb-2">데이터 포인트</div>

                {!multiSeriesEnabled ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dataPoints.map((p, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <span className="font-bold text-muted-foreground text-xs w-4">{idx + 1}.</span>
                        <Input
                          placeholder="레이블"
                          value={p.label}
                          onChange={(e) => updateDataPoint(idx, 'label', e.target.value)}
                          className="flex-1 text-sm"
                        />
                        <Input
                          type="number"
                          placeholder="값"
                          value={p.value || ''}
                          onChange={(e) => updateDataPoint(idx, 'value', e.target.value)}
                          className="w-24 text-right text-sm"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">시리즈 최대 6 / 라벨 최대 10 권장</div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSeries((prev) =>
                              prev.length >= 6
                                ? prev
                                : [...prev, { id: makeId(), name: `시리즈 ${prev.length + 1}`, type: 'bar', values: dataPoints.map(() => 0) }]
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
                          {series.length > 3 ? <div className="text-[11px] text-muted-foreground text-right pr-1">+{series.length - 3}개</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <Button onClick={addDataPoint} variant="outline" size="sm" className="flex-1" disabled={dataPoints.length >= 10}>
                    <Plus className="h-3 w-3 mr-1" />
                    추가
                  </Button>
                  <Button onClick={removeDataPoint} variant="outline" size="sm" className="flex-1" disabled={dataPoints.length <= 1}>
                    <Minus className="h-3 w-3 mr-1" />
                    제거
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

            {/* 중간: 차트 미리보기 */}
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
              {chartType && dataSource && dataPoints.filter((p) => p.label.trim() !== '').length > 0 ? (
                <div className="flex items-center justify-center h-full rounded-lg border border-border bg-white">
                  <div className="w-full h-full p-6">
                    <canvas ref={canvasRef} className="w-full h-full"></canvas>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <div className="text-lg font-semibold">차트 유형과 데이터 소스를 선택한 후 생성 버튼을 눌러주세요</div>
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
                      <CardTitle className="text-xl">Social · ESG DATA 테이블</CardTitle>
                      <CardDescription>테이블 세트를 선택하고 각 셀 값을 직접 입력/편집할 수 있습니다.</CardDescription>
                    </div>
                    <div className="min-w-[320px]">
                      <Select value={tablePreset} onValueChange={(v) => setTablePreset(v as SocialTablePresetId)}>
                        <SelectTrigger>
                          <SelectValue placeholder="테이블 세트 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {TABLE_PRESETS.map((p) => (
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
                  {tablePreset === 'social_workforce' && renderEditableTables('social_workforce', workforceTables, setWorkforceTables)}
                  {tablePreset === 'social_training' && renderEditableTables('social_training', trainingTables, setTrainingTables)}
                  {tablePreset === 'social_diversity_retention' &&
                    renderEditableTables('social_diversity_retention', diversityTables, setDiversityTables)}
                  {tablePreset === 'social_safety_health' && renderEditableTables('social_safety_health', safetyTables, setSafetyTables)}
                  {tablePreset === 'social_supply_chain' && renderEditableTables('social_supply_chain', supplyTables, setSupplyTables)}
                  {tablePreset === 'social_customer_privacy' &&
                    renderEditableTables('social_customer_privacy', customerTables, setCustomerTables)}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* 우측: 차트 유형 + 생성 버튼 + 갤러리(환경과 동일) */}
        <div className="w-full xl:flex-[2] min-w-0 space-y-4 xl:sticky xl:top-24 self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">차트 유형</CardTitle>
              <CardDescription>데이터에 적합한 차트 유형을 선택하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {chartTypes.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setChartType(t.value)}
                    className={`p-4 border rounded-xl text-left transition-all ${
                      chartType === t.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="font-bold">{t.label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{t.description}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleGenerate}
            disabled={!chartType || !dataSource || isGenerating}
            className="w-full bg-accent hover:bg-accent/90 text-white py-4 text-lg font-bold"
          >
            {isGenerating ? '생성 중...' : '차트 생성하기'}
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
                        <img
                          src={savedChart.thumbnail}
                          alt={savedChart.chartTitle}
                          className="w-full h-full object-contain p-2"
                        />
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
                    <div
                      key={index}
                      className="w-full h-[130px] bg-seed-light/20 rounded-lg border border-border flex items-center justify-center"
                    >
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
              {esgTables.filter((t: SavedEsgTable) => t.presetId.startsWith('social_')).length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  저장된 도표가 없습니다. 각 테이블의 “저장”을 눌러 추가하세요.
                </div>
              ) : (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {esgTables
                    .filter((t: SavedEsgTable) => t.presetId.startsWith('social_'))
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
