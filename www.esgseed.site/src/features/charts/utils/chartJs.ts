/**
 * Chart.js 로드 및 공통 유틸
 * REFACTOR_CHARTS_DATA_STRATEGY: utils 분리
 */

import type { EditableTable, TableTemplate } from '../types';

export const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const ensureChartJsLoaded = async (): Promise<void> => {
  // @ts-expect-error - Chart.js는 window에 동적으로 추가됨
  if (typeof window !== 'undefined' && typeof window.Chart !== 'undefined') return;

  const existing = document.querySelector<HTMLScriptElement>('script[data-chartjs="true"]');
  if (existing) {
    await new Promise<void>((resolve) => {
      if (existing.dataset.loaded === 'true') resolve();
      else existing.addEventListener('load', () => resolve(), { once: true });
    });
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js';
  script.async = true;
  script.dataset.chartjs = 'true';
  document.head.appendChild(script);

  await new Promise<void>((resolve) => {
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true }
    );
  });
};

/**
 * TableTemplate → EditableTable 변환 (rows에 id 주입)
 */
export function hydrateTable(template: TableTemplate, idFn: () => string): EditableTable {
  return {
    ...template,
    rows: template.rows.map((r) => ({ ...r, id: idFn() })),
  };
}

/**
 * TableTemplate[] → EditableTable[] 변환
 */
export function hydrateTables(templates: TableTemplate[], idFn: () => string): EditableTable[] {
  return templates.map((t) => hydrateTable(t, idFn));
}
