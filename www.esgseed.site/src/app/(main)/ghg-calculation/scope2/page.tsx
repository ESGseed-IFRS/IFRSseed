'use client';

import { useEffect } from 'react';
import { GHGCalculationMain } from '@/features/ghg-calculation';
import { useGHGStore } from '@/features/ghg-calculation/store/ghg.store';

export default function Scope2Page() {
  const setActiveScope = useGHGStore((s) => s.setActiveScope);
  
  useEffect(() => {
    setActiveScope('scope2');
  }, [setActiveScope]);
  
  return <GHGCalculationMain />;
}
