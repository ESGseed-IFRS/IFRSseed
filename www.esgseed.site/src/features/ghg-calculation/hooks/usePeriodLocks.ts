'use client';

import { useState, useCallback } from 'react';

const LOCK_STORAGE_KEY = 'ghg.periodLocks.v1';

export interface PeriodLock {
  id: string;
  scope: 'scope1' | 'scope2' | 'scope3' | 'all';
  periodType: 'monthly' | 'yearly';
  periodValue: string;
  lockedAt: string;
  lockedBy: string;
}

function loadLocksFromStorage(): PeriodLock[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCK_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** AUDIT_TRAIL_IMPLEMENTATION_ROADMAP §3.2.1: Period Lock 훅 */
export function usePeriodLocks() {
  const [locks, setLocks] = useState<PeriodLock[]>(loadLocksFromStorage);

  const saveLocks = useCallback((next: PeriodLock[]) => {
    setLocks(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const isLocked = useCallback(
    (scope: PeriodLock['scope'], periodType: 'monthly' | 'yearly', periodValue: string) => {
      return locks.some(
        (l) =>
          (l.scope === scope || l.scope === 'all') &&
          l.periodType === periodType &&
          l.periodValue === periodValue
      );
    },
    [locks]
  );

  const addLock = useCallback(
    (scope: PeriodLock['scope'], periodType: 'monthly' | 'yearly', periodValue: string) => {
      const newLock: PeriodLock = {
        id: `lock-${Date.now()}`,
        scope,
        periodType,
        periodValue,
        lockedAt: new Date().toISOString(),
        lockedBy: 'current-user',
      };
      const next = locks.filter(
        (l) => !(l.scope === scope && l.periodType === periodType && l.periodValue === periodValue)
      );
      saveLocks([...next, newLock]);
      return newLock;
    },
    [locks, saveLocks]
  );

  const removeLock = useCallback(
    (id: string) => {
      const next = locks.filter((l) => l.id !== id);
      saveLocks(next);
    },
    [locks, saveLocks]
  );

  return { locks, isLocked, addLock, removeLock };
}
