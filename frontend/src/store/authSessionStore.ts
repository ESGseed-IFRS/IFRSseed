'use client';

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

/** sessionStorage 키 — 로그인 API `user` JSON (readAuthUserFromStorage 등과 공유) */
export const AUTH_USER_SESSION_KEY = 'user';

/** 단일 법인 UX. DB: subsidiary | affiliate */
export function isSubsidiaryLikeCompany(user: AuthSessionUser | null | undefined): boolean {
  const x = (user?.group_entity_type ?? '').trim().toLowerCase();
  return x === 'subsidiary' || x === 'affiliate';
}

/** 지주 통합 UX. DB: holding */
export function isHoldingCompany(user: AuthSessionUser | null | undefined): boolean {
  return (user?.group_entity_type ?? '').trim().toLowerCase() === 'holding';
}

/** `/auth/login` 응답 user 객체 (snake_case) */

export type AuthSessionUser = {
  user_id?: string;
  company_id?: string;
  email?: string;
  name?: string | null;
  role?: string;
  department?: string | null;
  position?: string | null;
  company_name_ko?: string | null;
  /** companies.group_entity_type — holding | subsidiary | affiliate */
  group_entity_type?: string | null;
  is_first_login?: boolean;
  must_change_password?: boolean;
};

type AuthSessionState = {
  user: AuthSessionUser | null;
  setUser: (user: AuthSessionUser | null) => void;
  clearAuth: () => void;
};

/** zustand persist 래퍼와 무관하게 sessionStorage `user`에는 평면 JSON만 저장 */
const flatUserSessionStorage: StateStorage = {
  getItem: () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(AUTH_USER_SESSION_KEY);
      if (!raw) return null;
      const user = JSON.parse(raw) as AuthSessionUser;
      if (!user || typeof user !== 'object') return null;
      return JSON.stringify({ state: { user }, version: 0 });
    } catch {
      return null;
    }
  },
  setItem: (_name, value) => {
    if (typeof window === 'undefined') return;
    try {
      const parsed = JSON.parse(value) as { state?: { user?: AuthSessionUser | null } };
      const u = parsed?.state?.user ?? null;
      if (u) sessionStorage.setItem(AUTH_USER_SESSION_KEY, JSON.stringify(u));
      else sessionStorage.removeItem(AUTH_USER_SESSION_KEY);
    } catch {
      sessionStorage.removeItem(AUTH_USER_SESSION_KEY);
    }
  },
  removeItem: () => {
    if (typeof window !== 'undefined') sessionStorage.removeItem(AUTH_USER_SESSION_KEY);
  },
};

export const useAuthSessionStore = create<AuthSessionState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearAuth: () => set({ user: null }),
    }),
    {
      name: 'auth-flat-user',
      storage: createJSONStorage(() => flatUserSessionStorage),
      partialize: (s) => ({ user: s.user }),
    }
  )
);

/** 요청 JSON에 붙일 사용자·회사 컨텍스트 (서버는 참고용; 권한은 세션 쿠키로 검증 권장) */
export function getAuthContextForBody(user: AuthSessionUser | null): Record<string, unknown> | null {
  if (!user) return null;
  if (!user.user_id && !user.company_id) return null;
  return {
    user_id: user.user_id ?? null,
    company_id: user.company_id ?? null,
    email: user.email ?? null,
    name: user.name ?? null,
    role: user.role ?? null,
    company_name_ko: user.company_name_ko ?? null,
    group_entity_type: user.group_entity_type ?? null,
    department: user.department ?? null,
    position: user.position ?? null,
  };
}

export function mergeAuthIntoRequestBody<T extends Record<string, unknown>>(
  body: T
): T & { auth_context?: Record<string, unknown> } {
  const ctx = getAuthContextForBody(useAuthSessionStore.getState().user);
  if (!ctx) return { ...body };
  return { ...body, auth_context: ctx };
}

export type FetchWithAuthJsonInit = Omit<RequestInit, 'body'> & {
  /** Record → JSON.stringify(mergeAuthIntoRequestBody(...)) */
  jsonBody?: Record<string, unknown>;
};

/** credentials 기본 include; jsonBody 있으면 auth_context 자동 병합 */
export async function fetchWithAuthJson(
  input: RequestInfo | URL,
  init: FetchWithAuthJsonInit = {}
): Promise<Response> {
  const { jsonBody, headers: initHeaders, credentials, ...rest } = init;
  const headers = new Headers(initHeaders ?? undefined);
  const creds = credentials ?? 'include';

  if (jsonBody !== undefined) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const merged = mergeAuthIntoRequestBody(jsonBody);
    return fetch(input, {
      ...rest,
      credentials: creds,
      headers,
      body: JSON.stringify(merged),
    });
  }

  return fetch(input, { ...rest, credentials: creds, headers });
}
