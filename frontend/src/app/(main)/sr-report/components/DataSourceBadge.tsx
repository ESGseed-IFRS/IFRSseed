'use client';

import { Building2, CheckCircle2 } from 'lucide-react';

export type DataSource = {
  source_type: 'holding_own' | 'subsidiary_reported' | 'calculated';
  company_id: string;
  company_name: string;
  value: number;
  unit: string;
  submission_date?: string | null;
  verification_status?: string;
};

type Props = {
  source: DataSource;
  showValue?: boolean;
  size?: 'sm' | 'md';
};

export function DataSourceBadge({ source, showValue = false, size = 'md' }: Props) {
  const config = {
    holding_own: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200',
      label: '지주사 자체',
      icon: Building2,
    },
    subsidiary_reported: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200',
      label: '계열사 보고',
      icon: CheckCircle2,
    },
    calculated: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      border: 'border-gray-200',
      label: '계산값',
      icon: Building2,
    },
  }[source.source_type];

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
  }[size];

  const Icon = config.icon;

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded-lg border
        ${config.bg} ${config.text} ${config.border} ${sizeClasses}
        font-medium
      `}
    >
      <Icon size={size === 'sm' ? 12 : 14} />
      
      <span>
        {config.label}: {source.company_name}
      </span>
      
      {showValue && (
        <span className="ml-1 font-semibold">
          {source.value.toLocaleString()} {source.unit}
        </span>
      )}
      
      {source.submission_date && (
        <span className="ml-1 opacity-70 text-xs">
          ({new Date(source.submission_date).toLocaleDateString('ko-KR')})
        </span>
      )}
    </div>
  );
}

type DataSourceListProps = {
  sources: DataSource[];
  showTotal?: boolean;
};

export function DataSourceList({ sources, showTotal = true }: DataSourceListProps) {
  const totalValue = sources.reduce((sum, s) => sum + s.value, 0);
  const unit = sources[0]?.unit || 'tCO₂e';

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-700">
        데이터 출처
      </div>

      <div className="space-y-2">
        {sources.map((source, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
          >
            <DataSourceBadge source={source} size="sm" />
            
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                {source.value.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">
                {source.unit}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showTotal && sources.length > 1 && (
        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <span className="text-sm font-semibold text-emerald-900">
            그룹 전체
          </span>
          <div className="text-right">
            <span className="text-lg font-bold text-emerald-900">
              {totalValue.toLocaleString()}
            </span>
            <span className="text-sm text-emerald-700 ml-1">
              {unit}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
