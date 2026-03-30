'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useWorkspacePerspective } from '@/components/workspace/WorkspacePerspectiveContext';
import type { GhgLegalEntityId } from '../types/ghg';

const VALID_LEGAL_ENTITY_IDS: GhgLegalEntityId[] = [
  'miracom',
  'secui',
  'score',
  'multicam',
  'emro',
  'openhands',
];

export type GhgTenantType = 'holding' | 'subsidiary';

export interface GhgSessionValue {
  tenantType: GhgTenantType;
  /** 계열사일 때만 사용. 지주는 의미 없음 */
  legalEntityId: GhgLegalEntityId | null;
  corpDisplayName: string;
  userDisplayName: string;
  userRoleLabel: string;
  canViewGroupAggregate: boolean;
}

const DEFAULT_SESSION: GhgSessionValue = {
  tenantType: 'holding',
  legalEntityId: null,
  corpDisplayName: '그룹',
  userDisplayName: '박지훈',
  userRoleLabel: '지주',
  canViewGroupAggregate: true,
};

const ENTITY_LABELS: Record<GhgLegalEntityId, string> = {
  miracom: '미라콤',
  secui: '시큐아이',
  score: '에스코어',
  multicam: '멀티캠퍼스',
  emro: '엠로',
  openhands: '오픈핸즈',
};

function buildSubsidiarySession(): GhgSessionValue {
  const entityRaw = (process.env.NEXT_PUBLIC_GHG_LEGAL_ENTITY ?? 'miracom').toLowerCase();
  const id = (VALID_LEGAL_ENTITY_IDS.includes(entityRaw as GhgLegalEntityId)
    ? entityRaw
    : 'miracom') as GhgLegalEntityId;
  return {
    tenantType: 'subsidiary',
    legalEntityId: id,
    corpDisplayName: ENTITY_LABELS[id],
    userDisplayName: '박지훈',
    userRoleLabel: '실무자',
    canViewGroupAggregate: false,
  };
}

/**
 * GHG 산정 세션: 상단 크롬「계열사 | 지주사」관점과 동기화.
 * 배포 시 특정 포털만 고정하려면 NEXT_PUBLIC_GHG_TENANT 로 강제 가능.
 */
function resolveGhgSession(perspective: 'subsidiary' | 'holding'): GhgSessionValue {
  const force = process.env.NEXT_PUBLIC_GHG_TENANT?.toLowerCase();
  if (force === 'subsidiary') return buildSubsidiarySession();
  if (force === 'holding') return { ...DEFAULT_SESSION };

  return perspective === 'holding' ? { ...DEFAULT_SESSION } : buildSubsidiarySession();
}

const GhgSessionContext = createContext<{ session: GhgSessionValue } | null>(null);

export function GhgSessionProvider({ children }: { children: React.ReactNode }) {
  const { perspective } = useWorkspacePerspective();
  const session = useMemo(() => resolveGhgSession(perspective), [perspective]);
  const value = useMemo(() => ({ session }), [session]);
  return <GhgSessionContext.Provider value={value}>{children}</GhgSessionContext.Provider>;
}

export function useGhgSession() {
  const ctx = useContext(GhgSessionContext);
  if (!ctx) {
    return { session: DEFAULT_SESSION };
  }
  return ctx;
}
