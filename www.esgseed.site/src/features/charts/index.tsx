'use client';

import { useState, useEffect } from 'react';
import { EnvironmentalChartsPage } from './environmental';
import { SocialChartsPage } from './social';
import { GovernanceChartsPage } from './governance';

type EsgTab = 'environmental' | 'social' | 'governance';

export function ChartsPage() {
  const [activeTab, setActiveTab] = useState<EsgTab>('environmental');

  useEffect(() => {
    const initialTab = sessionStorage.getItem('chartsInitialTab');
    if (initialTab === 'environmental' || initialTab === 'social' || initialTab === 'governance') {
      setActiveTab(initialTab);
      sessionStorage.removeItem('chartsInitialTab');
    }
  }, []);

  const esgTabs = [
    { id: 'environmental' as const, label: 'Environmental' },
    { id: 'social' as const, label: 'Social' },
    { id: 'governance' as const, label: 'Governance' },
  ];

  return (
    <div className="min-h-screen bg-primary">
      <div className="max-w-none w-full mx-auto px-5 sm:px-6 lg:px-8 2xl:px-10 py-10">
        <div className="bg-background rounded-3xl border border-border/60 shadow-seed px-6 sm:px-8 lg:px-10 py-8 overflow-hidden">
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-center gap-4">
              {esgTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-10 py-4 text-2xl font-black rounded-2xl border-2 transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-seed'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-8">
            {activeTab === 'environmental' && <EnvironmentalChartsPage />}
            {activeTab === 'social' && <SocialChartsPage />}
            {activeTab === 'governance' && <GovernanceChartsPage />}
          </div>
        </div>
      </div>
    </div>
  );
}
