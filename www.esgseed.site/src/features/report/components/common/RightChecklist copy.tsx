'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, AlertTriangle, Info, FileText } from 'lucide-react';
import type { DisclosureStandard, ComplianceMatch, TableOfContentsItem, PageStandardMapping } from '../../types';

interface RightChecklistProps {
  selectedTocItem: TableOfContentsItem | null;
  relevantStandards: DisclosureStandard[];
  complianceMatches: ComplianceMatch[];
  pageStandardMappings: PageStandardMapping[];
  overallComplianceRate: number;
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

  const getMatchStatusIcon = (status: 'matched' | 'partial' | 'unmatched') => {
    switch (status) {
      case 'matched':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
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
                    <div key={standard.id} className={`p-4 rounded-lg border ...`}>
                      {/* 헤더 섹션: 기준 이름과 백분율 뱃지 */}
                      <div className="flex items-start justify-between mb-2 gap-2"> {/* gap 추가 */}
                        <div className="flex items-center gap-2 min-w-0 flex-1"> {/* flex-1, min-w-0 추가: 텍스트 공간 확보 */}
                          {getMatchStatusIcon(status)}
                          <div className="min-w-0 flex-1"> {/* 한 번 더 감싸서 내부 텍스트 제어 */}
                            <div className="font-semibold text-sm truncate">{standard.name}</div> {/* truncate: 길면 ... 처리 */}
                            <div className="text-xs text-muted-foreground">{standard.code}</div>
                            
                            {pageNum && (
                            <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
                              {/* 1. 왼쪽: 텍스트 부분 (초록 바 제거, 텍스트 색상으로만 포인트) */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-1 h-1 rounded-full bg-primary/40 shrink-0" /> {/* 작은 점 하나로 세련되게 대체 */}
                                <span className="text-[11px] text-primary/80 font-medium truncate">
                                  페이지 ({String(pageNum).padStart(2, '0')}) → {standard.name} 연결
                                </span>
                              </div>

                              {/* 2. 오른쪽: 뱃지들 (한 줄로 나란히 고정) */}
                              <div className="flex gap-1 shrink-0">
                                {isAdditional && (
                                  <Badge variant="outline" className="text-[10px] py-0 h-4.5 bg-yellow-50 text-yellow-600 border-yellow-200">
                                    보완 추천
                                  </Badge>
                                )}
                                {isMapped && (
                                  <Badge variant="outline" className="text-[10px] py-0 h-4.5 bg-green-50 text-green-600 border-green-200">
                                    매핑됨
                                  </Badge>
                                )}
                              </div>
                            </div>
                            )}
                          </div>
                        </div>
                        
                        {/* 우측 상단 퍼센트 뱃지: 위치 고정 */}
                        <Badge className={`shrink-0 ${getComplianceBgColor(rate)} ${getComplianceColor(rate)} border-0`}>
                          {rate}%
                        </Badge>
                      </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {standard.description}
                    </div>
                    {match && match.suggestions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {match.suggestions.map((suggestion, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>{suggestion}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {standard.required && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        필수
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>목차 항목을 선택하여 공시 기준을 확인하세요</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
