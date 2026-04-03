'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useWorkspacePerspective } from '@/components/workspace/WorkspacePerspectiveContext';
import {
  AUTH_USER_SESSION_KEY,
  useAuthSessionStore,
  type AuthSessionUser,
} from '@/store/authSessionStore';
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

/** @deprecated 호환용 별칭 — `AuthSessionUser` 사용 권장 */
export type StoredAuthUser = AuthSessionUser;

const ROLE_LABELS: Record<string, string> = {
  viewer: '조회',
  reviewer: '검토',
  author: '작성',
  admin: '관리',
};

export function readAuthUserFromStorage(): StoredAuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AUTH_USER_SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as StoredAuthUser;
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

function normalizeGroupEntityType(raw: string | null | undefined): 'holding' | 'subsidiary' | 'affiliate' | null {
  const x = (raw ?? '').trim().toLowerCase();
  if (x === 'holding' || x === 'subsidiary' || x === 'affiliate') return x;
  return null;
}

/**
 * 로그인 회사의 group_entity_type 이 있으면 GHG 관점을 고정·보강합니다.
 * - subsidiary / affiliate → 단일 법인(그룹 집계 비활성) 데모 세션
 * - holding → 지주 세션 고정 (계열사 관점 전환 없음)
 * - 그 외 → perspective 기반 base
 */
function mergeAuthIntoSession(base: GhgSessionValue, auth: StoredAuthUser | null): GhgSessionValue {
  if (!auth) return base;

  const ge = normalizeGroupEntityType(auth.group_entity_type);
  let core: GhgSessionValue;
  if (ge === 'subsidiary' || ge === 'affiliate') {
    core = buildSubsidiarySession();
  } else if (ge === 'holding') {
    core = resolveGhgSession('holding');
  } else {
    core = base;
  }

  const name = (auth.name ?? '').trim();
  const emailLocal = (auth.email ?? '').split('@')[0]?.trim() ?? '';
  const userDisplayName = name || emailLocal || core.userDisplayName;
  const corp = (auth.company_name_ko ?? '').trim();
  const roleRaw = (auth.role ?? '').trim().toLowerCase();
  const userRoleLabel = (ROLE_LABELS[roleRaw] ?? roleRaw) || core.userRoleLabel;

  return {
    ...core,
    userDisplayName,
    corpDisplayName: corp || core.corpDisplayName,
    userRoleLabel,
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
  const [mounted, setMounted] = useState(false);
  const [storageTick, setStorageTick] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_USER_SESSION_KEY) setStorageTick((t) => t + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    return useAuthSessionStore.subscribe((state, prev) => {
      if (state.user !== prev.user) setStorageTick((t) => t + 1);
    });
  }, [mounted]);

  const session = useMemo(() => {
    const base = resolveGhgSession(perspective);
    if (!mounted) return base;
    return mergeAuthIntoSession(base, readAuthUserFromStorage());
  }, [perspective, mounted, storageTick]);

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
