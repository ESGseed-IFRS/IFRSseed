import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 회사정보 타입
export interface CompanyData {
  companyName: string;
  businessNumber: string;
  ceoName: string;
  industry: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  mission: string;
  vision: string;
  esgGoals: string;
  employees: string;
  shareholders: string;
  stakeholders: string;
  communication: string;
}

// 생성된 문단 타입
export interface PreviewSection {
  id: string;
  title: string;
  content: string;
  ifrsCode: string;  // IFRS S2 코드 (예: "14", "22–23,25")
  aiComment?: string;
  commentType?: 'info' | 'warning';
  createdAt: Date;
  updatedAt: Date;
}

// 차트 데이터 타입
export interface ChartData {
  id: string;
  chartType: 'bar' | 'pie' | 'line' | 'area' | 'horizontal' | 'doughnut' | 'stacked_bar' | 'mixed';
  dataSource: string;
  chartTitle: string;
  xAxisLabel: string;
  yAxisLabel: string;
  dataPoints: { label: string; value: number }[];
  // 멀티 시리즈 차트용 (선택)
  labels?: string[];
  datasets?: { label: string; data: number[]; type?: 'bar' | 'line' }[];
  chartImage?: string; // base64 이미지
  createdAt: Date;
}

// 보고서 메타데이터
export interface ReportMetadata {
  reportYear: string;
  reportPeriod: string;
  language: string;
  lastUpdated: Date;
}

// ContentGenerationPage 상태
export interface ChecklistItem {
  id: string;
  label: string;
  status: 'completed' | 'in-progress' | 'pending';
}

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: string; // ISO string
}

// ChartsPage 현재 편집 중인 차트 상태
export interface CurrentChartState {
  chartType: string;
  dataSource: string;
  chartTitle: string;
  xAxisLabel: string;
  yAxisLabel: string;
  dataPoints: { label: string; value: number }[];
  labels?: string[];
  datasets?: { label: string; data: number[]; type?: 'bar' | 'line' }[];
}

// 재생에너지 표 데이터 (ChartsPage 표와 동일 구조)
export interface RenewableTableRow {
  id: string;
  division: string;
  type: string;
  unit: string;
  values: { [key: string]: string };
}

// ESG 데이터 테이블(도표) 저장용
export interface EsgTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}
export interface EsgTableRow {
  id: string;
  cells: Record<string, string>;
}
export interface SavedEsgTable {
  id: string;
  presetId:
    | 'ghg_emissions'
    | 'energy'
    | 'investment_pue'
    | 'water'
    | 'waste_air'
    | 'governance_board'
    | 'governance_ethics'
    | 'social_workforce'
    | 'social_training'
    | 'social_diversity_retention'
    | 'social_safety_health'
    | 'social_supply_chain'
    | 'social_customer_privacy';
  title: string;
  note?: string;
  columns: EsgTableColumn[];
  rows: EsgTableRow[];
  createdAt: string; // ISO string (persist-friendly)
}

// Store 상태 타입
export interface ReportStore {
  // 데이터
  companyInfo: CompanyData | null; // 임시 저장용 (CompanyInfoPage에서 사용)
  finalCompanyInfo: CompanyData | null; // 최종 제출용 (FinalReportPage에서 사용)
  contentSections: PreviewSection[];
  charts: ChartData[];
  reportMetadata: ReportMetadata;
  renewableTable: RenewableTableRow[];
  esgTables: SavedEsgTable[];
  
  // ContentGenerationPage 상태
  checklistItems: ChecklistItem[];
  chatMessages: ChatMessage[];
  
  // ChartsPage 현재 편집 중인 차트 상태
  currentChart: CurrentChartState | null;

  // Actions - 회사정보
  setCompanyInfo: (data: CompanyData) => void;
  updateCompanyInfo: (partial: Partial<CompanyData>) => void;
  submitCompanyInfoToFinal: () => void; // companyInfo를 finalCompanyInfo로 제출

  // Actions - 문단
  addContentSection: (section: Omit<PreviewSection, 'createdAt' | 'updatedAt'>) => void;
  updateContentSection: (id: string, updates: Partial<PreviewSection>) => void;
  removeContentSection: (id: string) => void;

  // Actions - 차트
  addChart: (chart: Omit<ChartData, 'id' | 'createdAt'>) => void;
  updateChart: (id: string, updates: Partial<ChartData>) => void;
  removeChart: (id: string) => void;
  setCurrentChart: (chart: CurrentChartState | null) => void;

  // Actions - ContentGenerationPage
  setChecklistItems: (items: ChecklistItem[]) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  addChatMessage: (message: Omit<ChatMessage, 'timestamp'>) => void;

  // Actions - 메타데이터
  updateReportMetadata: (metadata: Partial<ReportMetadata>) => void;

  // Actions - 재생에너지 표
  setRenewableTable: (rows: RenewableTableRow[]) => void;

  // Actions - ESG 도표(테이블)
  addEsgTable: (table: Omit<SavedEsgTable, 'id' | 'createdAt'>) => void;
  removeEsgTable: (id: string) => void;

  // Utils
  getReportData: () => {
    companyInfo: CompanyData | null;
    contentSections: PreviewSection[];
    charts: ChartData[];
    reportMetadata: ReportMetadata;
  };
  clearAllData: () => void;
}

// 초기 메타데이터
const getInitialMetadata = (): ReportMetadata => ({
  reportYear: new Date().getFullYear().toString(),
  reportPeriod: `${new Date().getFullYear()}년 1월 - 12월`,
  language: '한국어',
  lastUpdated: new Date(),
});

// 초기 상태
const initialState = {
  companyInfo: null,
  finalCompanyInfo: null,
  contentSections: [],
  charts: [],
  reportMetadata: getInitialMetadata(),
  checklistItems: [],
  chatMessages: [],
  currentChart: null,
   renewableTable: [] as RenewableTableRow[],
  esgTables: [] as SavedEsgTable[],
};

// @ts-expect-error - Zustand persist 미들웨어 타입 추론 이슈
export const useReportStore = create<ReportStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // 회사정보 설정
      setCompanyInfo: (data) => {
        set({ companyInfo: data });
        get().updateReportMetadata({ lastUpdated: new Date() });
      },

      // 회사정보 부분 업데이트
      updateCompanyInfo: (partial) => {
        const current = get().companyInfo;
        if (current) {
          set({ companyInfo: { ...current, ...partial } });
          get().updateReportMetadata({ lastUpdated: new Date() });
        }
      },

      // 회사정보를 최종 제출 (FinalReportPage로 전달)
      submitCompanyInfoToFinal: () => {
        const current = get().companyInfo;
        if (current) {
          set({ finalCompanyInfo: current });
          get().updateReportMetadata({ lastUpdated: new Date() });
          console.log('✅ 회사정보가 최종 보고서로 제출되었습니다:', current);
        }
      },

      // 문단 추가
      addContentSection: (section) => {
        const now = new Date();
        const newSection: PreviewSection = {
          ...section,
          createdAt: now,
          updatedAt: now,
        };

        // 이미 존재하는 섹션이면 업데이트, 없으면 추가
        const existingIndex = get().contentSections.findIndex((s) => s.id === section.id);
        if (existingIndex >= 0) {
          const updated = [...get().contentSections];
          updated[existingIndex] = { ...updated[existingIndex], ...newSection, updatedAt: now };
          set({ contentSections: updated });
        } else {
          set({ contentSections: [...get().contentSections, newSection] });
        }
        get().updateReportMetadata({ lastUpdated: new Date() });
      },

      // 문단 업데이트
      updateContentSection: (id, updates) => {
        const sections = get().contentSections.map((section) =>
          section.id === id
            ? { ...section, ...updates, updatedAt: new Date() }
            : section
        );
        set({ contentSections: sections });
        get().updateReportMetadata({ lastUpdated: new Date() });
      },

      // 문단 제거
      removeContentSection: (id) => {
        set({ contentSections: get().contentSections.filter((s) => s.id !== id) });
        get().updateReportMetadata({ lastUpdated: new Date() });
      },

      // 차트 추가
      addChart: (chart) => {
        const newChart: ChartData = {
          ...chart,
          // dataPoints 배열을 깊은 복사하여 원본 데이터 보호
          dataPoints: chart.dataPoints.map(dp => ({ ...dp })),
          labels: chart.labels ? [...chart.labels] : undefined,
          datasets: chart.datasets
            ? chart.datasets.map((d) => ({ label: d.label, data: [...d.data], type: d.type }))
            : undefined,
          id: `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
        };
        set({ charts: [...get().charts, newChart] });
        get().updateReportMetadata({ lastUpdated: new Date() });
      },

      // 차트 업데이트
      updateChart: (id, updates) => {
        const charts = get().charts.map((chart) =>
          chart.id === id ? { ...chart, ...updates } : chart
        );
        set({ charts });
        get().updateReportMetadata({ lastUpdated: new Date() });
      },

      // 차트 제거
      removeChart: (id) => {
        set({ charts: get().charts.filter((c) => c.id !== id) });
        get().updateReportMetadata({ lastUpdated: new Date() });
      },

      // 현재 편집 중인 차트 설정
      setCurrentChart: (chart) => {
        set({ currentChart: chart });
      },

      // 재생에너지 표 저장
      setRenewableTable: (rows) => {
        set({ renewableTable: rows });
        get().updateReportMetadata({ lastUpdated: new Date() });
      },

      // ESG 도표(테이블) 저장/삭제
      addEsgTable: (table) => {
        const newTable: SavedEsgTable = {
          ...table,
          id: `esg-table-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          createdAt: new Date().toISOString(),
          columns: table.columns.map((c) => ({ ...c })),
          rows: table.rows.map((r) => ({ ...r, cells: { ...r.cells } })),
        };
        set({ esgTables: [newTable, ...get().esgTables].slice(0, 30) });
        get().updateReportMetadata({ lastUpdated: new Date() });
      },
      removeEsgTable: (id) => {
        set({ esgTables: get().esgTables.filter((t) => t.id !== id) });
        get().updateReportMetadata({ lastUpdated: new Date() });
      },

      // 체크리스트 아이템 설정
      setChecklistItems: (items) => {
        set({ checklistItems: items });
      },

      // 채팅 메시지 설정
      setChatMessages: (messages) => {
        set({ chatMessages: messages });
      },

      // 채팅 메시지 추가
      addChatMessage: (message) => {
        const newMessage: ChatMessage = {
          ...message,
          timestamp: new Date().toISOString(),
        };
        set({ chatMessages: [...get().chatMessages, newMessage] });
      },

      // 메타데이터 업데이트
      updateReportMetadata: (metadata) => {
        set({
          reportMetadata: {
            ...get().reportMetadata,
            ...metadata,
            lastUpdated: new Date(),
          },
        });
      },

      // 통합 데이터 가져오기
      getReportData: () => {
        return {
          companyInfo: get().companyInfo,
          contentSections: get().contentSections,
          charts: get().charts,
          reportMetadata: get().reportMetadata,
        };
      },

      // 모든 데이터 초기화
      clearAllData: () => {
        set(initialState);
      },
    }),
    {
      name: 'esg-report-storage', // localStorage key
      storage: createJSONStorage(() => sessionStorage), // sessionStorage 사용
      // Date 객체를 문자열로 변환
      partialize: (state: ReportStore) => ({
        ...state,
        contentSections: state.contentSections.map((s) => ({
          ...s,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createdAt: s.createdAt.toISOString() as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updatedAt: s.updatedAt.toISOString() as any,
        })),
        charts: state.charts.map((c) => ({
          ...c,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createdAt: c.createdAt.toISOString() as any,
        })),
        reportMetadata: {
          ...state.reportMetadata,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lastUpdated: state.reportMetadata.lastUpdated.toISOString() as any,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
      // 문자열을 Date 객체로 복원
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onRehydrateStorage: () => (state: any) => {
        if (state) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          state.contentSections = state.contentSections.map((s: any) => ({
            ...s,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
          }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          state.charts = state.charts.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
          }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          state.reportMetadata.lastUpdated = new Date(state.reportMetadata.lastUpdated as any);
        }
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any
) as typeof useReportStore;

