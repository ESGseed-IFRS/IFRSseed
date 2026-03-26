'use client';

import { useWorkspacePerspective } from '@/components/workspace/WorkspacePerspectiveContext';
import { DashboardNewShell } from './components/DashboardNewShell';

export function DashboardPageClient() {
  const { perspective } = useWorkspacePerspective();

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f4f6f4] font-['Pretendard','Apple_SD_Gothic_Neo',sans-serif] text-[#1a1a1a]">
        <div className="flex min-h-0 flex-1 flex-col">
          <DashboardNewShell mode={perspective} />
        </div>
      </div>
  );
}
