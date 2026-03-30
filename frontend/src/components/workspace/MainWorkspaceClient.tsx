'use client';

import type { ReactNode } from 'react';
import { AppWorkspaceLayout } from '@/components/workspace/AppWorkspaceLayout';
import { WorkspacePerspectiveProvider } from '@/components/workspace/WorkspacePerspectiveContext';

export function MainWorkspaceClient({ children }: { children: ReactNode }) {
  return (
    <WorkspacePerspectiveProvider>
      <AppWorkspaceLayout>{children}</AppWorkspaceLayout>
    </WorkspacePerspectiveProvider>
  );
}
