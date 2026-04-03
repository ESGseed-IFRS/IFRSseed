'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** DASHBOARD_STRATEGY_V2: 대시보드 전용 상태 */

export type DashboardRole = 'MANAGER' | 'MEMBER';

export interface ActivityLogItem {
  id: string;
  userName: string;
  action: string;
  timestamp: number;
}

export interface PendingApproval {
  id: string;
  userName: string;
  email?: string;
  requestedAt: number;
}

export interface DashboardState {
  role: DashboardRole;
  deadline: string | null; // YYYY-MM-DD
  finalApproved: boolean;
  srComplianceRate: number;
  srDataSubmitted: boolean;
  activityLog: ActivityLogItem[];
  pendingApprovals: PendingApproval[];
  setRole: (role: DashboardRole) => void;
  setDeadline: (date: string | null) => void;
  setFinalApproved: (approved: boolean) => void;
  setSrCompliance: (rate: number, submitted: boolean) => void;
  addActivityLog: (item: Omit<ActivityLogItem, 'id' | 'timestamp'>) => void;
  setPendingApprovals: (items: PendingApproval[]) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      role: 'MEMBER',
      deadline: null,
      finalApproved: false,
      srComplianceRate: 0,
      srDataSubmitted: false,
      activityLog: [],
      pendingApprovals: [],

      setRole: (role) => set({ role }),
      setDeadline: (date) => set({ deadline: date }),
      setFinalApproved: (approved) => set({ finalApproved: approved }),
      setSrCompliance: (rate, submitted) => set({ srComplianceRate: rate, srDataSubmitted: submitted }),

      addActivityLog: (item) =>
        set((state) => ({
          activityLog: [
            { ...item, id: `act-${Date.now()}`, timestamp: Date.now() },
            ...state.activityLog,
          ].slice(0, 20),
        })),

      setPendingApprovals: (items) => set({ pendingApprovals: items }),
    }),
    { name: 'dashboard-store' }
  )
);
