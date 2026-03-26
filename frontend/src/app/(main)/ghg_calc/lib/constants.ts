// 상수 정의
import type { Framework, InputTabId, AuditMenuId } from '../types/ghg';

export const FRAMEWORKS: readonly Framework[] = ['ISSB', 'KSSB', 'K-ETS', 'GRI', 'ESRS'] as const;

export const INPUT_TABS: ReadonlyArray<{ id: InputTabId; label: string; icon: string; source: string }> = [
  { id: 'power', label: '전력·열·스팀', icon: 'Zap', source: 'EMS' },
  { id: 'fuel', label: '연료·차량', icon: 'Fuel', source: 'ERP' },
  { id: 'refrigerant', label: '냉매', icon: 'Snowflake', source: 'EHS' },
  { id: 'waste', label: '폐기물', icon: 'Trash2', source: 'EMS' },
  { id: 'logistics', label: '물류·출장·통근', icon: 'Truck', source: 'SRM·HR' },
  { id: 'material', label: '원료·제품', icon: 'Package', source: 'SRM·PLM' },
] as const;

export const AUDIT_MENUS: ReadonlyArray<{ id: AuditMenuId; label: string; icon: string }> = [
  { id: 'unified', label: '통합 감사 추적', icon: 'Shield' },
  { id: 'approval', label: '결재함', icon: 'Inbox' },
] as const;

export const FACILITIES = ['전체', '본관동', '생산동A', '생산동B', '유틸리티동', '연구동'];

export const YEARS = ['2026', '2025', '2024', '2023'];

/** Raw Data 필터 바 - 기간 단위 (월 / 분기 / 반기) */
export const PERIOD_TYPES = ['월', '분기', '반기'] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

/** 에너지 사용량 유형 드롭다운 (필터 바 드릴다운) */
export const ENERGY_SUB_TYPES = ['전체', '전력', '열·스팀', '순수(정제수)', 'LNG', '용수'] as const;

/** 오염물질 배출량 유형 드롭다운 (필터 바 드릴다운) */
export const POLLUTANT_SUB_TYPES = ['전체', '수질', '대기'] as const;

export const MONTHS = ['전체', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
