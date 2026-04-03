'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { DisclosureStandard, ComplianceMatch, TableOfContentsItem, PageStandardMapping, VisualizationRecommendation } from '../../types';

interface RightChecklistProps {
  selectedTocItem: TableOfContentsItem | null;
  relevantStandards: DisclosureStandard[];
  complianceMatches: ComplianceMatch[];
  pageStandardMappings: PageStandardMapping[];
  overallComplianceRate: number;
  visualizationRecommendations?: VisualizationRecommendation[];
}

/**
 * 오른쪽 체크리스트 컴포넌트
 * 공시 기준 준수 상태를 표시
 */
export function RightChecklist({
  selectedTocItem,
  relevantStandards,
  complianceMatches,
  pageStandardMappings,
  overallComplianceRate,
  visualizationRecommendations = [],
}: RightChecklistProps) {
  const getComplianceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplianceBgColor = (rate: number) => {
    if (rate >= 90) return 'bg-green-100';
    if (rate >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getMatchStatusSymbol = (status: 'matched' | 'partial' | 'unmatched') => {
    switch (status) {
      case 'matched': return <span className="text-green-600 font-bold">✓</span>;
      case 'partial': return <span className="text-yellow-600">◐</span>;
      default: return <span className="text-red-500">○</span>;
    }
  };

  const pageNum = selectedTocItem?.pageNumber;
  const mapping = pageNum ? pageStandardMappings.find(m => m.pageNumber === pageNum) : null;

  return (
    <div className="space-y-6">
      {/* 전체 준수율 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">전체 준수율</CardTitle>
          <CardDescription>
            {pageNum
              ? `페이지 (${String(pageNum).padStart(2, '0')})의 공시 기준 준수 상태`
              : '현재 페이지의 공시 기준 준수 상태'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-4">
            <div className={`text-4xl font-bold mb-2 ${getComplianceColor(overallComplianceRate)}`}>
              {overallComplianceRate}%
            </div>
            <Progress 
              value={overallComplianceRate} 
              className={`w-full ${getComplianceBgColor(overallComplianceRate)}`}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="font-semibold text-green-600">
                {complianceMatches.filter(m => m.complianceRate >= 90).length}
              </div>
              <div className="text-muted-foreground">준수 (90%↑)</div>
            </div>
            <div>
              <div className="font-semibold text-yellow-600">
                {complianceMatches.filter(m => m.complianceRate >= 60 && m.complianceRate < 90).length}
              </div>
              <div className="text-muted-foreground">부분 (60-89%)</div>
            </div>
            <div>
              <div className="font-semibold text-red-600">
                {complianceMatches.filter(m => m.complianceRate < 60).length}
              </div>
              <div className="text-muted-foreground">미준수 (59%↓)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 공시 기준 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">관련 공시 기준</CardTitle>
          <CardDescription>
            {selectedTocItem
              ? pageNum
                ? `페이지 (${String(pageNum).padStart(2, '0')}) ${selectedTocItem.title}와 관련된 기준`
                : `${selectedTocItem.title} 페이지와 관련된 기준`
              : '목차 항목을 선택하세요'}
          </CardDescription>
        </CardHeader>
        <CardContent>
  {selectedTocItem ? (
    <div className="space-y-4">
      {relevantStandards.map((standard) => {
        const match = complianceMatches.find(m => m.standardId === standard.id);
        const rate = match?.complianceRate || 0;
        const status = match?.matchStatus || 'unmatched';

        const isMapped = mapping?.standards.includes(standard.name) || false;
        const isAdditional = 
          (standard.name === 'IFRS S1-78' && pageNum && (pageNum === 36 || (pageNum >= 46 && pageNum <= 59))) ||
          (standard.name === 'ESRS BP-2' && pageNum && pageNum >= 130 && pageNum <= 138);

        return (
          <div
            key={standard.id}
            className={`p-4 rounded-xl border transition-all ${
              status === 'matched' ? 'bg-green-50/30 border-green-100' : 
              status === 'partial' ? 'bg-yellow-50/30 border-yellow-100' : 
              'bg-red-50/30 border-red-100'
            }`}
          >
            {/* 1. 상단: 제목과 준수율 (중복되던 코드명 텍스트 삭제) */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="shrink-0">{getMatchStatusSymbol(status)}</div>
                <span className="text-[11px] text-slate-500 mr-1">
                  {standard.required ? '● [필수]' : '○ [권장]'}
                </span>
                <h4 className="font-bold text-sm text-slate-800 truncate">{standard.name}</h4>
              </div>
              <Badge className={`shrink-0 text-[10px] font-bold border-0 shadow-none ${getComplianceBgColor(rate)} ${getComplianceColor(rate)}`}>
                {rate}%
              </Badge>
            </div>

            {/* 2. 연결 정보: 불필요한 바(Bar)를 없애고 텍스트 위주로 정리 */}
            {pageNum && (
              <div className="flex items-center justify-between gap-2 py-1.5 px-2 bg-white/60 rounded-lg border border-slate-100/40 mb-3">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className="w-1 h-1 bg-primary/40 rounded-full shrink-0" />
                  <span className="text-[11px] text-slate-500 font-medium truncate">
                    p.{String(pageNum).padStart(2, '0')} 연결됨
                  </span>
                </div>

                <div className="flex gap-1 shrink-0 ml-auto">
                  {isMapped && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 bg-green-50 text-green-600 border-green-200">
                      매핑됨
                    </Badge>
                  )}
                  {isAdditional && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 bg-yellow-50 text-yellow-600 border-yellow-200">
                      보완 추천
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* 3. 본문: "GRI ... 기준" 같은 중복 멘트 삭제 및 실제 설명만 노출 */}
            <div className="text-[12px] text-slate-500 leading-relaxed">
              {standard.description && !standard.description.includes(standard.name) 
                ? standard.description 
                : `${standard.name} 공시 요구사항을 확인하세요.`}
            </div>

            {/* 4. 하단: 제안 사항 */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {match && match.suggestions.length > 0 && (
                <div className="flex flex-col gap-1 w-full mt-1 border-t border-slate-100 pt-2">
                  {match.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="text-[11px] text-slate-400 flex items-start gap-1">
                      <span className="shrink-0 opacity-70">·</span>
                      <span className="leading-tight">{suggestion}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">목차 항목을 선택하세요</p>
          )}
        </CardContent>
      </Card>

      {/* 시각화 추천 (SR_PAGE_IMPLEMENTATION F-04) */}
      {visualizationRecommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">시각화 추천</CardTitle>
            <CardDescription>이 섹션에 어울리는 자료</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {visualizationRecommendations.map((rec) => (
              <div key={rec.id} className="rounded-lg border p-3 space-y-1">
                <p className="text-sm font-medium text-foreground">{rec.title}</p>
                <p className="text-xs text-muted-foreground">{rec.description}</p>
                <Link
                  href={`/charts?type=${encodeURIComponent(rec.chartType)}&data=${encodeURIComponent(rec.dataKey)}&page_id=${selectedTocItem?.pageNumber ?? ''}`}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  도표 생성으로 이동 →
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
