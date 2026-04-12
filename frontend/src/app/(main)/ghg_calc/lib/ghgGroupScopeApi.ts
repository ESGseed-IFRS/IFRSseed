/** GET /ghg-calculation/scope/group-results, group-trend 응답 (snake_case) */

export type GroupScopeResultRowApi = {
  company_id: string;
  name: string;
  role: 'holding' | 'subsidiary';
  scope1_total: number;
  scope2_total: number;
  scope3_total: number;
  grand_total: number;
  prev_grand_total: number | null;
  frozen: boolean;
};

export type GroupScopeResultsApi = {
  holding_company_id: string;
  year: number;
  basis: string;
  rows: GroupScopeResultRowApi[];
};

export type GroupScopeTrendPointApi = {
  year: number;
  scope1_total: number;
  scope2_total: number;
  scope3_total: number;
  grand_total: number;
};

export type GroupScopeTrendApi = {
  holding_company_id: string;
  basis: string;
  points: GroupScopeTrendPointApi[];
};
