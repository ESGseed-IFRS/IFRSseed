'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { ReceiptAttachment, Scope3FormData } from '../types/ghg.types';
import { ReceiptAttachment as ReceiptAttachmentComponent } from '../components/ReceiptAttachment';

type Props = {
  formData: Scope3FormData;
  onDataChange: (data: Scope3FormData) => void;
  facilities: string[];
  selectedYear?: number;
  /** ERP_DATA_DISCLOSURE_STRATEGY §5: 공시기준별 우선 카테고리 안내 */
  disclosureFramework?: string;
};

type Scope3DetailedInputs = {
  purchasedGoods: { purchaseAmount: number; emissionFactor: number };
  capitalGoods: { purchaseAmount: number; emissionFactor: number };
  upstreamTransport: { distance: number; weight: number; emissionFactor: number };
  waste: { amount: number; emissionFactor: number };
  businessTravel: { distance: number; passengers: number; emissionFactor: number };
  employeeCommuting: { employees: number; distancePerDay: number; workDays: number; emissionFactor: number };
  upstreamLeasedAssets: { area: number; emissionFactor: number };
  downstreamTransport: { distance: number; weight: number; emissionFactor: number };
  processingSoldProducts: { amount: number; emissionFactor: number };
  useSoldProducts: { quantity: number; usagePerUnit: number; emissionFactor: number };
  endOfLifeSoldProducts: { amount: number; emissionFactor: number };
  downstreamLeasedAssets: { area: number; emissionFactor: number };
  franchises: { count: number; emissionFactor: number };
  investments: { amount: number; emissionFactor: number };
};

type Scope3Data = {
  purchased_goods: number;
  capital_goods: number;
  fuel_energy_activities: number;
  upstream_transport: number;
  waste: number;
  business_travel: number;
  employee_commuting: number;
  upstream_leased_assets: number;
  downstream_transport: number;
  processing_sold_products: number;
  use_sold_products: number;
  end_of_life_sold_products: number;
  downstream_leased_assets: number;
  franchises: number;
  investments: number;
};

function safe(v: any) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

const PRIORITY_CATEGORY_HINTS: Record<string, string> = {
  KSSB: 'Cat.1(구매 상품), 4(상류 운송), 9(하류 운송), 11(판매 제품 사용) 우선',
  ISSB: '중대 카테고리: Cat.1,3,4,6,7,9,11,12 등',
  GRI: 'ISSB와 동일. 중대 카테고리 우선',
  ESRS: '15개 카테고리 대부분 필수. double materiality 적용',
};

export function Scope3FormPage22({ formData, onDataChange, disclosureFramework }: Props) {
  // Page22 기본 입력값 세팅(디자인/플로우 동일)
  const [scope3DetailedInputs, setScope3DetailedInputs] = useState<Scope3DetailedInputs>({
    purchasedGoods: { purchaseAmount: 0, emissionFactor: 0.45 },
    capitalGoods: { purchaseAmount: 0, emissionFactor: 0.38 },
    upstreamTransport: { distance: 0, weight: 0, emissionFactor: 0.00012 },
    waste: { amount: 0, emissionFactor: 0.52 },
    businessTravel: { distance: 0, passengers: 0, emissionFactor: 0.000115 },
    employeeCommuting: { employees: 0, distancePerDay: 0, workDays: 0, emissionFactor: 0.00018 },
    upstreamLeasedAssets: { area: 0, emissionFactor: 0.005 },
    downstreamTransport: { distance: 0, weight: 0, emissionFactor: 0.00012 },
    processingSoldProducts: { amount: 0, emissionFactor: 0.8 },
    useSoldProducts: { quantity: 0, usagePerUnit: 0, emissionFactor: 0.001 },
    endOfLifeSoldProducts: { amount: 0, emissionFactor: 0.3 },
    downstreamLeasedAssets: { area: 0, emissionFactor: 0.005 },
    franchises: { count: 0, emissionFactor: 15 },
    investments: { amount: 0, emissionFactor: 0.00001 },
  });

  // Page22의 Category 3/직접 입력 형태 유지
  const [scope3DataManual, setScope3DataManual] = useState<Pick<Scope3Data, 'fuel_energy_activities'>>({
    fuel_energy_activities: 0,
  });

  const scope3Data: Scope3Data = useMemo(() => {
    return {
      purchased_goods: safe(scope3DetailedInputs.purchasedGoods.purchaseAmount) * safe(scope3DetailedInputs.purchasedGoods.emissionFactor),
      capital_goods: safe(scope3DetailedInputs.capitalGoods.purchaseAmount) * safe(scope3DetailedInputs.capitalGoods.emissionFactor),
      fuel_energy_activities: safe(scope3DataManual.fuel_energy_activities),
      upstream_transport:
        safe(scope3DetailedInputs.upstreamTransport.distance) *
        safe(scope3DetailedInputs.upstreamTransport.weight) *
        safe(scope3DetailedInputs.upstreamTransport.emissionFactor),
      waste: safe(scope3DetailedInputs.waste.amount) * safe(scope3DetailedInputs.waste.emissionFactor),
      business_travel:
        safe(scope3DetailedInputs.businessTravel.distance) *
        safe(scope3DetailedInputs.businessTravel.passengers) *
        safe(scope3DetailedInputs.businessTravel.emissionFactor),
      employee_commuting:
        safe(scope3DetailedInputs.employeeCommuting.employees) *
        safe(scope3DetailedInputs.employeeCommuting.distancePerDay) *
        safe(scope3DetailedInputs.employeeCommuting.workDays) *
        safe(scope3DetailedInputs.employeeCommuting.emissionFactor),
      upstream_leased_assets:
        safe(scope3DetailedInputs.upstreamLeasedAssets.area) * safe(scope3DetailedInputs.upstreamLeasedAssets.emissionFactor),
      downstream_transport:
        safe(scope3DetailedInputs.downstreamTransport.distance) *
        safe(scope3DetailedInputs.downstreamTransport.weight) *
        safe(scope3DetailedInputs.downstreamTransport.emissionFactor),
      processing_sold_products:
        safe(scope3DetailedInputs.processingSoldProducts.amount) * safe(scope3DetailedInputs.processingSoldProducts.emissionFactor),
      use_sold_products:
        safe(scope3DetailedInputs.useSoldProducts.quantity) *
        safe(scope3DetailedInputs.useSoldProducts.usagePerUnit) *
        safe(scope3DetailedInputs.useSoldProducts.emissionFactor),
      end_of_life_sold_products:
        safe(scope3DetailedInputs.endOfLifeSoldProducts.amount) * safe(scope3DetailedInputs.endOfLifeSoldProducts.emissionFactor),
      downstream_leased_assets:
        safe(scope3DetailedInputs.downstreamLeasedAssets.area) * safe(scope3DetailedInputs.downstreamLeasedAssets.emissionFactor),
      franchises: safe(scope3DetailedInputs.franchises.count) * safe(scope3DetailedInputs.franchises.emissionFactor),
      investments: safe(scope3DetailedInputs.investments.amount) * safe(scope3DetailedInputs.investments.emissionFactor),
    };
  }, [scope3DetailedInputs, scope3DataManual]);

  const resultS3 = useMemo(() => Object.values(scope3Data).reduce((s, v) => s + (v || 0), 0), [scope3Data]);

  const updateReceipts = (category: string, receipts: ReceiptAttachment[]) => {
    const existing = formData.categories || [];
    const idx = existing.findIndex((c) => c.category === category);
    if (idx >= 0) {
      const next = [...existing];
      next[idx] = { ...next[idx], receipts };
      onDataChange({ categories: next });
    } else {
      onDataChange({ categories: [...existing, { category, data: [], receipts }] });
    }
  };

  // store 반영(겉 UI 변경 없이 totals/CSV/히스토리에는 반영되게)
  useEffect(() => {
    const labels: Array<{ key: keyof Scope3Data; label: string }> = [
      { key: 'purchased_goods', label: '1. 구매 상품 및 서비스' },
      { key: 'capital_goods', label: '2. 자본재' },
      { key: 'fuel_energy_activities', label: '3. 연료 및 에너지 관련 활동' },
      { key: 'upstream_transport', label: '4. 상류 운송 및 유통' },
      { key: 'waste', label: '5. 사업장 발생 폐기물' },
      { key: 'business_travel', label: '6. 비즈니스 출장' },
      { key: 'employee_commuting', label: '7. 임직원 통근' },
      { key: 'upstream_leased_assets', label: '8. 업스트림 임차 자산' },
      { key: 'downstream_transport', label: '9. 하류 운송 및 유통' },
      { key: 'processing_sold_products', label: '10. 판매된 제품의 가공' },
      { key: 'use_sold_products', label: '11. 판매된 제품의 사용' },
      { key: 'end_of_life_sold_products', label: '12. 판매된 제품의 폐기' },
      { key: 'downstream_leased_assets', label: '13. 하류 임차 자산' },
      { key: 'franchises', label: '14. 프랜차이즈' },
      { key: 'investments', label: '15. 투자' },
    ];

    const existing = formData.categories || [];
    const categories = labels.map((x) => {
      const prev = existing.find((c) => c.category === x.label);
      const receipts = prev?.receipts || [];
      return {
        category: x.label,
        data: [
          {
            id: `s3-${x.key}`,
            year: new Date().getFullYear(),
            month: 1,
            facility: '',
            energySource: x.label,
            amount: 0,
            unit: 'tCO2e',
            emissions: parseFloat((scope3Data[x.key] || 0).toFixed(6)),
            createdAt: new Date(),
          },
        ],
        receipts,
      };
    });

    onDataChange({ categories });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope3Data]);

  const [savedRuns, setSavedRuns] = useState<Array<{ id: string; createdAt: number; totalTco2e: number; inputs: Scope3Data }>>([]);

  const saveScope3Run = () => {
    setSavedRuns((prev) => [
      {
        id: `s3-run-${Date.now()}`,
        createdAt: Date.now(),
        totalTco2e: parseFloat(resultS3.toFixed(4)),
        inputs: { ...scope3Data },
      },
      ...prev,
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900">SCOPE 3</h2>
          <p className="text-sm text-slate-600 mt-1">가치사슬 배출량 산정</p>
          {disclosureFramework && PRIORITY_CATEGORY_HINTS[disclosureFramework] && (
            <p className="text-xs text-slate-500 mt-2 px-2 py-1 rounded bg-slate-100 border border-slate-200">
              {disclosureFramework} 기준: {PRIORITY_CATEGORY_HINTS[disclosureFramework]}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-700">Scope3 Result</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-slate-900">
            {resultS3.toFixed(2)} <span className="text-sm font-normal">tCO2e</span>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={saveScope3Run}
              className="px-4 py-2 text-sm font-semibold bg-[#669900] text-white shadow-md hover:bg-slate-800 transition-colors"
            >
              결과 저장
            </button>
          </div>
        </div>
      </div>

      {/* 업스트림 */}
      <div className="mb-10">
        <div className="mb-6 pb-4 border-b border-slate-300 p-4">
          <h3 className="text-lg font-bold text-slate-900 mb-2">1. 업스트림 (Upstream Activities)</h3>
          <p className="text-sm text-slate-700 leading-relaxed">
            기업이 운영을 위해 외부로부터 자원이나 서비스를 가져오는 과정에서 발생합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 1 */}
          <div className="space-y-4 p-5 bg-blue-100 border-2 border-blue-500">
            <label className="text-base font-semibold text-slate-900">Category 1. 구매 상품 및 서비스</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">원료 구매액</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.purchasedGoods.purchaseAmount || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      purchasedGoods: { ...scope3DetailedInputs.purchasedGoods, purchaseAmount: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-16">백만원</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.purchasedGoods.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      purchasedGoods: { ...scope3DetailedInputs.purchasedGoods, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="0.3">0.3 (서비스업)</option>
                  <option value="0.45">0.45 (제조업 평균)</option>
                  <option value="0.6">0.6 (중공업)</option>
                  <option value="0.35">0.35 (경공업)</option>
                  <option value="0.55">0.55 (화학업)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/백만원</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.purchased_goods.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              기업이 구매한 원자재, 부품 및 서비스의 생산 단계에서 발생한 배출량입니다.
            </p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-1"
                existingAttachments={(formData.categories.find((c) => c.category === '1. 구매 상품 및 서비스')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('1. 구매 상품 및 서비스', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>

          {/* 2 */}
          <div className="space-y-4 p-5 bg-blue-100 border-2 border-blue-500">
            <label className="text-base font-semibold text-slate-900">Category 2. 자본재</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">설비·기계 구매액</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.capitalGoods.purchaseAmount || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      capitalGoods: { ...scope3DetailedInputs.capitalGoods, purchaseAmount: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-16">백만원</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.capitalGoods.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      capitalGoods: { ...scope3DetailedInputs.capitalGoods, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="0.2">0.2 (경량 설비)</option>
                  <option value="0.38">0.38 (제조업 평균)</option>
                  <option value="0.5">0.5 (중공업 설비)</option>
                  <option value="0.3">0.3 (일반 설비)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/백만원</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.capital_goods.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              기업이 구매한 설비, 기계, 건물 등 자산의 제조 과정에서 발생합니다.
            </p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-2"
                existingAttachments={(formData.categories.find((c) => c.category === '2. 자본재')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('2. 자본재', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>
        </div>

        {/* 3 */}
        <div className="grid grid-cols-1 gap-4 mt-4">
          <div className="space-y-4 p-5 bg-blue-100 border-2 border-blue-500">
            <label className="text-base font-semibold text-slate-900">Category 3. 연료 및 에너지 관련 활동</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">Scope 1,2 연계</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DataManual.fuel_energy_activities || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DataManual({ fuel_energy_activities: parseFloat(e.target.value) || 0 })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-20">tCO₂e</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200">
                <p className="text-sm font-semibold text-slate-700">
                  × 배출계수: <strong>약 10~15%</strong> (Scope 1,2 합계 기준 추정)
                </p>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.fuel_energy_activities.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Scope 1, 2에 포함되지 않은 활동(연료 추출·생산·운송 등)입니다. 실측이 어려우면 Scope 1+2 합계의 10~15% 정도를 입력하세요.
            </p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-3"
                existingAttachments={(formData.categories.find((c) => c.category === '3. 연료 및 에너지 관련 활동')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('3. 연료 및 에너지 관련 활동', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>
        </div>

        {/* 4~8 (Page22 원형 그대로) */}
        {/* NOTE: 아래 블록은 Page22 코드와 동일한 클래스/문구/플로우를 유지합니다. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* 4 */}
          <div className="space-y-4 p-5 bg-blue-100 border-2 border-blue-500">
            <label className="text-base font-semibold text-slate-900">Category 4. 상류 운송 및 유통</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-20">운송 거리</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.upstreamTransport.distance || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      upstreamTransport: { ...scope3DetailedInputs.upstreamTransport, distance: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-8">km</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-20">화물 중량</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.upstreamTransport.weight || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      upstreamTransport: { ...scope3DetailedInputs.upstreamTransport, weight: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-8">ton</span>
              </div>
              <div className="ml-1 border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                × 배출계수: <strong>{scope3DetailedInputs.upstreamTransport.emissionFactor} tCO₂e/ton-km</strong> (트럭 기준)
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.upstream_transport.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">공급업체로부터 기업까지 제품이나 원재료를 운반하는 물류 과정입니다.</p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-4"
                existingAttachments={(formData.categories.find((c) => c.category === '4. 상류 운송 및 유통')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('4. 상류 운송 및 유통', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>

          {/* 5 */}
          <div className="space-y-4 p-5 bg-blue-100 border-2 border-blue-500">
            <label className="text-base font-semibold text-slate-900">Category 5. 사업장 발생 폐기물</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">폐기물 발생량</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.waste.amount || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      waste: { ...scope3DetailedInputs.waste, amount: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-8">ton</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.waste.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      waste: { ...scope3DetailedInputs.waste, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="0.3">0.3 (재활용 중심)</option>
                  <option value="0.52">0.52 (매립, 평균)</option>
                  <option value="0.8">0.8 (소각, 높음)</option>
                  <option value="0.4">0.4 (혼합 처리)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/ton</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.waste.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              기업 내 사업장에서 발생한 폐기물을 외부 업체가 수거하여 처리(매립, 소각 등)할 때 발생합니다.
            </p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-5"
                existingAttachments={(formData.categories.find((c) => c.category === '5. 사업장 발생 폐기물')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('5. 사업장 발생 폐기물', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* 6. 출장 */}
          <div className="space-y-4 p-5 bg-blue-100 border-2 border-blue-500">
            <label className="text-base font-semibold text-slate-900">Category 6. 비즈니스 출장</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-20">항공 거리</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.businessTravel.distance || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      businessTravel: { ...scope3DetailedInputs.businessTravel, distance: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-8">km</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-20">승객 수</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.businessTravel.passengers || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      businessTravel: { ...scope3DetailedInputs.businessTravel, passengers: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-8">명</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.businessTravel.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      businessTravel: { ...scope3DetailedInputs.businessTravel, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="0.0001">0.0001 (항공, 단거리)</option>
                  <option value="0.000115">0.000115 (항공, 평균)</option>
                  <option value="0.00015">0.00015 (항공, 장거리)</option>
                  <option value="0.00003">0.00003 (고속철도)</option>
                  <option value="0.00005">0.00005 (일반 철도)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/승객-km</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.business_travel.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              임직원이 업무 목적으로 이용하는 항공, 철도, 택시 등 외부 교통수단에 의한 배출량입니다.
            </p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-6"
                existingAttachments={(formData.categories.find((c) => c.category === '6. 비즈니스 출장')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('6. 비즈니스 출장', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>
          <div key="cat7" className="space-y-4 p-5 bg-blue-100 border-2 border-blue-500">
            <label className="text-base font-semibold text-slate-900">Category 7. 임직원 통근</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">직원 수</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.employeeCommuting.employees || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      employeeCommuting: { ...scope3DetailedInputs.employeeCommuting, employees: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-8">명</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">평균 통근 거리</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.employeeCommuting.distancePerDay || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      employeeCommuting: { ...scope3DetailedInputs.employeeCommuting, distancePerDay: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-12">km/일</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">연간 근무일수</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.employeeCommuting.workDays || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      employeeCommuting: { ...scope3DetailedInputs.employeeCommuting, workDays: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-8">일</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.employeeCommuting.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      employeeCommuting: { ...scope3DetailedInputs.employeeCommuting, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="0.00015">0.00015 (승용차, 경유)</option>
                  <option value="0.00018">0.00018 (승용차, 평균)</option>
                  <option value="0.0002">0.0002 (승용차, 휘발유)</option>
                  <option value="0.00005">0.00005 (대중교통)</option>
                  <option value="0.0001">0.0001 (하이브리드)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/km</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.employee_commuting.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">직원들이 출퇴근 시 이용하는 차량이나 대중교통에서 발생합니다.</p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-7"
                existingAttachments={(formData.categories.find((c) => c.category === '7. 임직원 통근')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('7. 임직원 통근', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* 8 */}
          <div className="space-y-4 p-5 bg-blue-100 border-2 border-blue-500">
            <label className="text-base font-semibold text-slate-900">Category 8. 업스트림 임차 자산</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">임차 면적</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.upstreamLeasedAssets.area || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      upstreamLeasedAssets: { ...scope3DetailedInputs.upstreamLeasedAssets, area: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-12">m²</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.upstreamLeasedAssets.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      upstreamLeasedAssets: { ...scope3DetailedInputs.upstreamLeasedAssets, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="0.003">0.003 (사무실, 낮음)</option>
                  <option value="0.005">0.005 (사무실, 평균)</option>
                  <option value="0.008">0.008 (사무실, 높음)</option>
                  <option value="0.01">0.01 (제조시설)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/m²</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.upstream_leased_assets.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">기업이 타인으로부터 빌려서 운영하는 자산에서 발생하는 배출량입니다.</p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-8"
                existingAttachments={(formData.categories.find((c) => c.category === '8. 업스트림 임차 자산')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('8. 업스트림 임차 자산', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 다운스트림 섹션 */}
      <div className="mt-10 mb-10">
        <div className="mb-6 pb-4 border-b border-slate-300 p-4">
          <h3 className="text-lg font-bold text-slate-900 mb-2">2. 다운스트림 (Downstream Activities)</h3>
          <p className="text-sm text-slate-700 leading-relaxed">
            기업이 만든 제품이 소비자에게 전달되고 사용된 후 폐기되기까지의 과정입니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 9 */}
          <div className="space-y-4 p-5 bg-green-100 border-2 border-green-500">
            <label className="text-base font-semibold text-slate-900">Category 9. 하류 운송 및 유통</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-20">운송 거리</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.downstreamTransport.distance || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      downstreamTransport: { ...scope3DetailedInputs.downstreamTransport, distance: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-8">km</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-20">화물 중량</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.downstreamTransport.weight || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      downstreamTransport: { ...scope3DetailedInputs.downstreamTransport, weight: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-8">ton</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.downstreamTransport.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      downstreamTransport: { ...scope3DetailedInputs.downstreamTransport, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="0.0001">0.0001 (트럭, 경량)</option>
                  <option value="0.00012">0.00012 (트럭, 평균)</option>
                  <option value="0.00015">0.00015 (트럭, 중량)</option>
                  <option value="0.00008">0.00008 (선박)</option>
                  <option value="0.00005">0.00005 (철도)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/ton-km</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.downstream_transport.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">판매된 제품이 고객에게 전달되는 과정에서 발생하는 운송 및 보관 활동입니다.</p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-9"
                existingAttachments={(formData.categories.find((c) => c.category === '9. 하류 운송 및 유통')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('9. 하류 운송 및 유통', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>

          <div key="cat10" className="space-y-4 p-5 bg-green-100 border-2 border-green-500">
            <label className="text-base font-semibold text-slate-900">Category 10. 판매된 제품의 가공</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">처리량</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.processingSoldProducts.amount || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      processingSoldProducts: { ...scope3DetailedInputs.processingSoldProducts, amount: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-8">ton</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.processingSoldProducts.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      processingSoldProducts: { ...scope3DetailedInputs.processingSoldProducts, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="0.5">0.5 (경공업)</option>
                  <option value="0.8">0.8 (제조업 평균)</option>
                  <option value="1.2">1.2 (중공업)</option>
                  <option value="0.6">0.6 (일반 제조)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/ton</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.processing_sold_products.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">기업이 판매한 중간재를 고객사(타 기업)가 최종 제품으로 가공할 때 발생하는 배출량입니다.</p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-10"
                existingAttachments={(formData.categories.find((c) => c.category === '10. 판매된 제품의 가공')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('10. 판매된 제품의 가공', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>

          <div key="cat11" className="space-y-4 p-5 bg-green-100 border-2 border-green-500">
            <label className="text-base font-semibold text-slate-900">Category 11. 판매된 제품의 사용</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">제품 수량</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.useSoldProducts.quantity || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      useSoldProducts: { ...scope3DetailedInputs.useSoldProducts, quantity: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-12">대</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">사용량/대</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.useSoldProducts.usagePerUnit || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      useSoldProducts: { ...scope3DetailedInputs.useSoldProducts, usagePerUnit: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-12">kWh</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.useSoldProducts.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      useSoldProducts: { ...scope3DetailedInputs.useSoldProducts, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="0.0004">0.0004 (전력 배출계수, 낮음)</option>
                  <option value="0.001">0.001 (전력 배출계수, 평균)</option>
                  <option value="0.0015">0.0015 (전력 배출계수, 높음)</option>
                  <option value="0.002">0.002 (연료 사용 제품)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/kWh</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.use_sold_products.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              소비자가 제품을 직접 사용할 때(예: 자동차 주행, 가전제품 가동) 발생하는 배출량으로, 정유/에너지 기업에서 비중이 가장 큽니다.
            </p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-11"
                existingAttachments={(formData.categories.find((c) => c.category === '11. 판매된 제품의 사용')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('11. 판매된 제품의 사용', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>

          <div key="cat12" className="space-y-4 p-5 bg-green-100 border-2 border-green-500">
            <label className="text-base font-semibold text-slate-900">Category 12. 판매된 제품의 폐기</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">폐기량</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.endOfLifeSoldProducts.amount || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      endOfLifeSoldProducts: { ...scope3DetailedInputs.endOfLifeSoldProducts, amount: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-8">ton</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.endOfLifeSoldProducts.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      endOfLifeSoldProducts: { ...scope3DetailedInputs.endOfLifeSoldProducts, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="0.1">0.1 (재활용 중심)</option>
                  <option value="0.3">0.3 (혼합 처리)</option>
                  <option value="0.5">0.5 (매립 중심)</option>
                  <option value="0.2">0.2 (재활용+매립)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/ton</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.end_of_life_sold_products.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">수명이 다한 제품이 폐기되거나 재활용되는 처리 과정에서 발생합니다.</p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-12"
                existingAttachments={(formData.categories.find((c) => c.category === '12. 판매된 제품의 폐기')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('12. 판매된 제품의 폐기', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>

          <div key="cat13" className="space-y-4 p-5 bg-green-100 border-2 border-green-500">
            <label className="text-base font-semibold text-slate-900">Category 13. 하류 임차 자산</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">임대 면적</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.downstreamLeasedAssets.area || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      downstreamLeasedAssets: { ...scope3DetailedInputs.downstreamLeasedAssets, area: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-12">m²</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.downstreamLeasedAssets.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      downstreamLeasedAssets: { ...scope3DetailedInputs.downstreamLeasedAssets, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="0.003">0.003 (사무실, 낮음)</option>
                  <option value="0.005">0.005 (사무실, 평균)</option>
                  <option value="0.008">0.008 (사무실, 높음)</option>
                  <option value="0.01">0.01 (제조시설)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/m²</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.downstream_leased_assets.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              기업이 소유한 자산을 타인에게 임대해 주었을 때, 임차인이 그 자산을 운영하며 발생하는 배출량입니다.
            </p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-13"
                existingAttachments={(formData.categories.find((c) => c.category === '13. 하류 임차 자산')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('13. 하류 임차 자산', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>

          <div key="cat14" className="space-y-4 p-5 bg-green-100 border-2 border-green-500">
            <label className="text-base font-semibold text-slate-900">Category 14. 프랜차이즈</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">가맹점 수</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.franchises.count || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      franchises: { ...scope3DetailedInputs.franchises, count: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-12">개</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.franchises.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      franchises: { ...scope3DetailedInputs.franchises, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="5">5 (소규모 매장)</option>
                  <option value="10">10 (중규모 매장)</option>
                  <option value="20">20 (대규모 매장)</option>
                  <option value="15">15 (평균)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/개</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.franchises.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">프랜차이즈 가맹점주가 사업장을 운영하며 발생하는 배출량입니다.</p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-14"
                existingAttachments={(formData.categories.find((c) => c.category === '14. 프랜차이즈')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('14. 프랜차이즈', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>

          <div key="cat15" className="space-y-4 p-5 bg-green-100 border-2 border-green-500">
            <label className="text-base font-semibold text-slate-900">Category 15. 투자</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700 w-28">투자액</label>
                <input
                  type="number"
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                  placeholder="0"
                  value={scope3DetailedInputs.investments.amount || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      investments: { ...scope3DetailedInputs.investments, amount: parseFloat(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-700 w-16">백만원</span>
              </div>
              <div className="ml-1 flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-700">배출계수:</label>
                <select
                  value={scope3DetailedInputs.investments.emissionFactor}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setScope3DetailedInputs({
                      ...scope3DetailedInputs,
                      investments: { ...scope3DetailedInputs.investments, emissionFactor: parseFloat(e.target.value) },
                    })
                  }
                  className="flex-1 bg-white border border-slate-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-slate-400 outline-none"
                >
                  <option value="0.00001">0.00001 (금융 투자)</option>
                  <option value="0.00005">0.00005 (일반 투자)</option>
                  <option value="0.0001">0.0001 (에너지 투자)</option>
                  <option value="0.00002">0.00002 (평균)</option>
                </select>
                <span className="text-sm font-semibold text-slate-700">tCO₂e/백만원</span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-900">계산 결과</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {scope3Data.investments.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              기업이 투자한 다른 기업이나 프로젝트의 활동으로 인해 발생하는 배출량입니다. (주로 금융기관에 중요함)
            </p>
            <div className="pt-2">
              <ReceiptAttachmentComponent
                relatedItemId="scope3-cat-15"
                existingAttachments={(formData.categories.find((c) => c.category === '15. 투자')?.receipts || []) as ReceiptAttachment[]}
                onUploadComplete={(attachments) => updateReceipts('15. 투자', attachments)}
                maxFileSize={10}
                acceptedFileTypes={['image/*', 'application/pdf']}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 저장된 산정값(간소 복제) */}
      <div className="mt-8 border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-lg font-bold text-slate-900">저장된 산정값 (Scope 3)</div>
          <button
            type="button"
            onClick={() => setSavedRuns([])}
            className="px-3 py-1.5 text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40"
            disabled={savedRuns.length === 0}
          >
            전체 삭제
          </button>
        </div>
        {savedRuns.length === 0 ? (
          <div className="text-sm text-slate-700">
            아직 저장된 산정값이 없습니다. 상단에서 <span className="font-semibold">"결과 저장"</span>을 눌러 기록을 남겨보세요.
          </div>
        ) : (
          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {savedRuns.slice(0, 12).map((r) => (
              <div key={r.id} className="border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-700">{new Date(r.createdAt).toLocaleString()}</div>
                  <button
                    type="button"
                    onClick={() => setSavedRuns((prev) => prev.filter((x) => x.id !== r.id))}
                    className="px-3 py-1.5 text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                  >
                    삭제
                  </button>
                </div>
                <div className="mt-3 text-base text-slate-900">
                  총 배출량: <span className="font-bold tabular-nums">{r.totalTco2e.toFixed(4)}</span>{' '}
                  <span className="text-sm text-slate-700">tCO₂e</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

