'use client';

import { useEffect, useState } from 'react';
import { Check, Building2 } from 'lucide-react';

type SubsidiaryDataItem = {
  company_id: string;
  company_name: string;
  emission_tco2e: number;
  site_count: number;
  ratio_pct: number;
};

type Props = {
  dpId: string;
  year: number;
  holdingCompanyId: string;
  scope: 'scope1' | 'scope2' | 'scope3';
  onSelect?: (selected: SubsidiaryDataItem[]) => void;
};

export function SubsidiaryDataSelector({ 
  dpId, 
  year, 
  holdingCompanyId, 
  scope,
  onSelect 
}: Props) {
  const [subsidiaries, setSubsidiaries] = useState<SubsidiaryDataItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubsidiaries = async () => {
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:9001';
        const res = await fetch(
          `${apiBaseUrl}/ifrs-agent/dp/${dpId}/sources?company_id=${holdingCompanyId}&year=${year}`
        );
        const data = await res.json();
        
        // 계열사 데이터만 필터링
        const subsidiaryData = data.sources.filter(
          (s: any) => s.source_type === 'subsidiary_reported'
        );
        
        setSubsidiaries(subsidiaryData);
        
        // 기본으로 모두 선택
        setSelected(new Set(subsidiaryData.map((s: any) => s.company_id)));
      } catch (error) {
        console.error('계열사 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubsidiaries();
  }, [dpId, year, holdingCompanyId]);

  useEffect(() => {
    if (onSelect) {
      const selectedItems = subsidiaries.filter(s => selected.has(s.company_id));
      onSelect(selectedItems);
    }
  }, [selected, subsidiaries, onSelect]);

  const toggleSelect = (companyId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const totalEmission = subsidiaries
    .filter(s => selected.has(s.company_id))
    .reduce((sum, s) => sum + s.emission_tco2e, 0);

  if (loading) {
    return (
      <div className="text-sm text-gray-500">
        계열사 데이터를 불러오는 중...
      </div>
    );
  }

  if (subsidiaries.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        승인된 계열사 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">
          포함할 계열사 선택
        </span>
        <span className="text-xs text-gray-500">
          {selected.size}/{subsidiaries.length}개 선택
        </span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
        {subsidiaries.map((sub) => {
          const isSelected = selected.has(sub.company_id);
          
          return (
            <label
              key={sub.company_id}
              className={`
                flex items-center justify-between p-3 rounded-lg border cursor-pointer
                transition-all
                ${isSelected 
                  ? 'border-emerald-500 bg-emerald-50' 
                  : 'border-gray-200 bg-white hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(sub.company_id)}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                />
                
                <Building2 
                  size={16} 
                  className={isSelected ? 'text-emerald-600' : 'text-gray-400'} 
                />
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {sub.company_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    사업장 {sub.site_count}개
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">
                  {sub.emission_tco2e.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  tCO₂e
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* 합계 */}
      <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
        <span className="text-sm font-medium text-gray-700">
          선택한 계열사 배출량 합계
        </span>
        <div className="text-right">
          <span className="text-lg font-bold text-gray-900">
            {totalEmission.toLocaleString()}
          </span>
          <span className="text-sm text-gray-600 ml-1">
            tCO₂e
          </span>
        </div>
      </div>
    </div>
  );
}
