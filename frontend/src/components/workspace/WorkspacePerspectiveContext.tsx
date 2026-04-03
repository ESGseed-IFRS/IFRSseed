'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isHoldingCompany, isSubsidiaryLikeCompany, useAuthSessionStore } from '@/store/authSessionStore';

export type WorkspacePerspective = 'subsidiary' | 'holding';

type Ctx = {
  perspective: WorkspacePerspective;
  setPerspective: (p: WorkspacePerspective) => void;
};

const WorkspacePerspectiveContext = createContext<Ctx | null>(null);

const STORAGE_KEY = 'ifrsseed:workspace-perspective';

function readPerspective(pathname: string, searchParams: URLSearchParams): WorkspacePerspective {
  if (pathname.startsWith('/dashboard')) {
    const m = searchParams.get('mode');
    if (m === 'holding' || m === 'subsidiary') return m;
    try {
      const s = sessionStorage.getItem(STORAGE_KEY);
      if (s === 'holding' || s === 'subsidiary') return s;
    } catch {
      /* ignore */
    }
    return 'subsidiary';
  }
  if (pathname.startsWith('/sr-report')) {
    if (searchParams.get('mode') === 'holding') return 'holding';
    return 'subsidiary';
  }
  try {
    const s = sessionStorage.getItem(STORAGE_KEY);
    if (s === 'holding' || s === 'subsidiary') return s;
  } catch {
    /* ignore */
  }
  return 'subsidiary';
}

export function WorkspacePerspectiveProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const router = useRouter();
  const groupEntityType = useAuthSessionStore((s) => s.user?.group_entity_type);
  const [perspective, setPerspectiveState] = useState<WorkspacePerspective>('subsidiary');

  useEffect(() => {
    setPerspectiveState(readPerspective(pathname, searchParams));
  }, [pathname, searchParams]);

  /**
   * 회사 유형별 관점 고정: 계열사·종속 → subsidiary만, 지주 → holding만.
   * (group_entity_type 없으면 기존 URL·토글 유지)
   */
  useEffect(() => {
    const u = useAuthSessionStore.getState().user;
    if (isSubsidiaryLikeCompany(u)) {
      setPerspectiveState('subsidiary');
      try {
        sessionStorage.setItem(STORAGE_KEY, 'subsidiary');
      } catch {
        /* ignore */
      }
      if (pathname.startsWith('/dashboard')) {
        const m = searchParams.get('mode');
        if (m !== 'subsidiary') {
          router.replace('/dashboard?mode=subsidiary');
        }
      }
      if (pathname.startsWith('/sr-report') && searchParams.get('mode') === 'holding') {
        const dpId = searchParams.get('dpId') ?? 'd2';
        router.replace(`/sr-report?dpId=${encodeURIComponent(dpId)}&mode=standards`);
      }
      return;
    }
    if (isHoldingCompany(u)) {
      setPerspectiveState('holding');
      try {
        sessionStorage.setItem(STORAGE_KEY, 'holding');
      } catch {
        /* ignore */
      }
      if (pathname.startsWith('/dashboard')) {
        const m = searchParams.get('mode');
        if (m !== 'holding') {
          router.replace('/dashboard?mode=holding');
        }
      }
      if (pathname.startsWith('/sr-report')) {
        const mode = searchParams.get('mode');
        if (mode !== 'holding') {
          const dpId = searchParams.get('dpId') ?? 'd2';
          const holdingTab = searchParams.get('holdingTab') ?? 'h-aggregate-write';
          router.replace(
            `/sr-report?dpId=${encodeURIComponent(dpId)}&mode=holding&holdingTab=${encodeURIComponent(holdingTab)}`,
          );
        }
      }
    }
  }, [groupEntityType, pathname, searchParams, router]);

  useEffect(() => {
    if (!pathname.startsWith('/dashboard')) return;
    const m = searchParams.get('mode');
    if (m === 'subsidiary' || m === 'holding') return;
    let p: WorkspacePerspective = 'subsidiary';
    try {
      const s = sessionStorage.getItem(STORAGE_KEY);
      if (s === 'holding' || s === 'subsidiary') p = s;
    } catch {
      /* ignore */
    }
    router.replace(`/dashboard?mode=${p}`);
  }, [pathname, searchParams, router]);

  const setPerspective = useCallback(
    (p: WorkspacePerspective) => {
      const u = useAuthSessionStore.getState().user;
      if (isSubsidiaryLikeCompany(u) && p === 'holding') return;
      if (isHoldingCompany(u) && p === 'subsidiary') return;
      setPerspectiveState(p);
      try {
        sessionStorage.setItem(STORAGE_KEY, p);
      } catch {
        /* ignore */
      }

      if (pathname.startsWith('/dashboard')) {
        router.replace(`/dashboard?mode=${p}`);
        return;
      }
      if (pathname.startsWith('/sr-report')) {
        const dpId = searchParams.get('dpId') ?? 'd2';
        const holdingTab = searchParams.get('holdingTab') ?? 'h-aggregate-write';
        if (p === 'holding') {
          router.replace(
            `/sr-report?dpId=${encodeURIComponent(dpId)}&mode=holding&holdingTab=${encodeURIComponent(holdingTab)}`,
          );
        } else {
          const editor = searchParams.get('mode');
          const ed = editor === 'ghg' || editor === 'standards' ? editor : 'standards';
          router.replace(`/sr-report?dpId=${encodeURIComponent(dpId)}&mode=${encodeURIComponent(ed)}`);
        }
      }
    },
    [pathname, router, searchParams],
  );

  const value = useMemo(() => ({ perspective, setPerspective }), [perspective, setPerspective]);
  return <WorkspacePerspectiveContext.Provider value={value}>{children}</WorkspacePerspectiveContext.Provider>;
}

export function useWorkspacePerspective() {
  const ctx = useContext(WorkspacePerspectiveContext);
  if (!ctx) throw new Error('useWorkspacePerspective must be used within WorkspacePerspectiveProvider');
  return ctx;
}
