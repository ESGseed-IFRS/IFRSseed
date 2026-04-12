'use client';

import { useEffect, useState } from 'react';
import { Check, X, Clock, AlertCircle, Building2 } from 'lucide-react';

type SubmissionItem = {
  id: string;
  subsidiary_company_id: string;
  subsidiary_company_name: string;
  holding_company_id: string;
  holding_company_name: string;
  submission_year: number;
  submission_quarter: number | null;
  submission_date: string;
  scope_1_submitted: boolean;
  scope_2_submitted: boolean;
  scope_3_submitted: boolean;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  staging_row_count: number;
  total_emission_tco2e: number;
};

type Props = {
  holdingCompanyId: string;
  reviewerUserId: string;
};

export function SubsidiaryApprovalPanel({ holdingCompanyId, reviewerUserId }: Props) {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected'>('submitted');

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:9001';
      const statusParam = filter === 'all' ? '' : `&status=${filter}`;
      const res = await fetch(
        `${apiBaseUrl}/data-integration/subsidiary/list?holding_company_id=${holdingCompanyId}${statusParam}`
      );
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error('제출 이력 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [holdingCompanyId, filter]);

  const handleApprove = async (submissionId: string) => {
    if (!confirm('이 제출 데이터를 승인하시겠습니까?')) return;

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:9001';
      const res = await fetch(`${apiBaseUrl}/data-integration/subsidiary/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          reviewed_by: reviewerUserId,
        }),
      });

      if (res.ok) {
        alert('승인되었습니다.');
        fetchSubmissions();
      } else {
        const error = await res.json();
        alert(`승인 실패: ${error.detail}`);
      }
    } catch (error) {
      console.error('승인 실패:', error);
      alert('승인 중 오류가 발생했습니다.');
    }
  };

  const handleReject = async (submissionId: string) => {
    const reason = prompt('반려 사유를 입력해주세요:');
    if (!reason) return;

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:9001';
      const res = await fetch(`${apiBaseUrl}/data-integration/subsidiary/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          reviewed_by: reviewerUserId,
          rejection_reason: reason,
        }),
      });

      if (res.ok) {
        alert('반려되었습니다.');
        fetchSubmissions();
      } else {
        const error = await res.json();
        alert(`반려 실패: ${error.detail}`);
      }
    } catch (error) {
      console.error('반려 실패:', error);
      alert('반려 중 오류가 발생했습니다.');
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: '작성중', icon: Clock },
      submitted: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '제출완료', icon: AlertCircle },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: '승인', icon: Check },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: '반려', icon: X },
    }[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status, icon: Clock };

    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">
          계열사 데이터 제출 현황
        </h2>

        {/* 필터 */}
        <div className="flex gap-2">
          {(['all', 'submitted', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-3 py-1 text-xs rounded-lg border transition-colors
                ${filter === f
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              {f === 'all' ? '전체' : f === 'submitted' ? '제출완료' : f === 'approved' ? '승인' : '반려'}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-500">
          로딩 중...
        </div>
      )}

      {!loading && submissions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          제출 이력이 없습니다.
        </div>
      )}

      {!loading && submissions.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  계열사
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  연도/분기
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scope 1
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scope 2
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scope 3
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  총 배출량
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {submissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {sub.subsidiary_company_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {sub.submission_year}년 {sub.submission_quarter ? `Q${sub.submission_quarter}` : '연간'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {sub.scope_1_submitted ? (
                      <Check size={16} className="inline text-green-600" />
                    ) : (
                      <X size={16} className="inline text-gray-300" />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {sub.scope_2_submitted ? (
                      <Check size={16} className="inline text-green-600" />
                    ) : (
                      <X size={16} className="inline text-gray-300" />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {sub.scope_3_submitted ? (
                      <Check size={16} className="inline text-green-600" />
                    ) : (
                      <X size={16} className="inline text-gray-300" />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {sub.total_emission_tco2e.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      tCO₂e
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {getStatusBadge(sub.status)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {sub.status === 'submitted' && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(sub.id)}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-colors"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => handleReject(sub.id)}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
                        >
                          반려
                        </button>
                      </div>
                    )}
                    {sub.status === 'approved' && (
                      <span className="text-xs text-gray-500">
                        {sub.reviewed_at ? new Date(sub.reviewed_at).toLocaleDateString('ko-KR') : '-'}
                      </span>
                    )}
                    {sub.status === 'rejected' && (
                      <button
                        onClick={() => alert(sub.rejection_reason || '반려 사유 없음')}
                        className="text-xs text-red-600 hover:underline"
                      >
                        사유 보기
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
