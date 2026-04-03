'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { FilterState, EMSData } from '../types/ghg.types';
import { LOADING_MESSAGE, LOADING_NO_DATA_MESSAGE } from '../constants/emptyState';

interface EMSDataLoaderProps {
  /** 현재 필터 상태 */
  filters: FilterState;
  /** 데이터 로드 완료 콜백 */
  onDataLoad: (data: EMSData[]) => void;
  /** Scope 타입 */
  scope: 'scope1' | 'scope2' | 'scope3';
}

/**
 * EMS 데이터 로더 컴포넌트
 * 내부 EMS API를 호출하여 현재 필터 조건에 맞는 데이터를 가져옴
 */
export function EMSDataLoader({ filters, onDataLoad, scope }: EMSDataLoaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastLoadResult, setLastLoadResult] = useState<{
    success: boolean;
    count: number;
    message?: string;
  } | null>(null);

  // EMS API 호출 함수
  const fetchEMSData = async (): Promise<EMSData[]> => {
    // TODO: 실제 EMS API 엔드포인트로 변경 필요
    // 예시: const response = await axios.get('/api/ems/data', { params: filters });
    
    // 임시 구현 (실제 API 연동 전)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 필터 조건 검증
        if (!filters.year && !filters.yearRange) {
          reject(new Error('년도를 선택해주세요.'));
          return;
        }

        // 시뮬레이션 데이터 생성
        const mockData: EMSData[] = [];
        const year = filters.year || filters.yearRange?.start || new Date().getFullYear();
        const startMonth = filters.month || filters.monthRange?.start || 1;
        const endMonth = filters.month || filters.monthRange?.end || 12;

        filters.facilities.forEach((facility) => {
          filters.energySources.forEach((source) => {
            for (let month = startMonth; month <= endMonth; month++) {
              mockData.push({
                id: `${facility}-${source}-${year}-${month}`,
                year,
                month,
                facility,
                energySource: source,
                amount: Math.random() * 1000 + 100, // 임의의 사용량
                unit: 'kWh', // 기본 단위
              });
            }
          });
        });

        resolve(mockData);
      }, 1500); // 1.5초 지연 (로딩 시뮬레이션)
    });
  };

  // EMS 데이터 가져오기
  const handleLoadEMSData = async () => {
    // 필터 조건 검증
    if (!filters.year && !filters.yearRange) {
      toast.error('년도를 선택해주세요.');
      return;
    }

    if (filters.facilities.length === 0) {
      toast.warning('최소 하나의 사업장을 선택해주세요.');
      return;
    }

    if (filters.energySources.length === 0) {
      toast.warning('최소 하나의 에너지원을 선택해주세요.');
      return;
    }

    setIsLoading(true);
    setLastLoadResult(null);

    try {
      const data = await fetchEMSData();
      
      if (data.length === 0) {
        setLastLoadResult({
          success: true,
          count: 0,
          message: '조건에 맞는 데이터가 없습니다.',
        });
        toast.info('조건에 맞는 데이터가 없습니다.');
      } else {
        setLastLoadResult({
          success: true,
          count: data.length,
        });
        onDataLoad(data);
        toast.success(`${data.length}개의 데이터를 불러왔습니다.`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'EMS 데이터 로드 실패';
      setLastLoadResult({
        success: false,
        count: 0,
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">EMS 데이터 가져오기</CardTitle>
        </div>
        <CardDescription className="text-xs">
          내부 EMS 시스템에서 데이터를 자동으로 가져옵니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* 필터 조건 요약 */}
        <div className="p-2.5 bg-muted rounded-md space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">필터 조건</p>
          <div className="text-xs space-y-0.5 text-muted-foreground">
            <div>
              년도:{' '}
              {filters.year
                ? `${filters.year}년`
                : filters.yearRange
                ? `${filters.yearRange.start}년 ~ ${filters.yearRange.end}년`
                : '미선택'}
            </div>
            <div>
              월:{' '}
              {filters.month
                ? `${filters.month}월`
                : filters.monthRange
                ? `${filters.monthRange.start}월 ~ ${filters.monthRange.end}월`
                : '전체'}
            </div>
            <div>사업장: {filters.facilities.length}개 선택</div>
            <div>에너지원: {filters.energySources.length}개 선택</div>
          </div>
        </div>

        {/* 로드 결과 표시 */}
        {lastLoadResult && (
          <Alert
            variant={lastLoadResult.success ? 'default' : 'destructive'}
          >
            {lastLoadResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {lastLoadResult.success ? (
                <div>
                  <p className="font-semibold">
                    {lastLoadResult.count}개의 데이터를 불러왔습니다.
                  </p>
                  {lastLoadResult.message && (
                    <p className="text-sm mt-1">{lastLoadResult.message}</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="font-semibold">데이터 로드 실패</p>
                  {lastLoadResult.message && (
                    <p className="text-sm mt-1">{lastLoadResult.message}</p>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* 로드 버튼 */}
        <Button
          onClick={handleLoadEMSData}
          disabled={isLoading}
          size="sm"
          className="w-full h-9 text-xs"
          title={isLoading ? LOADING_MESSAGE : undefined}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 mr-2 animate-spin" aria-hidden />
              로드 중...
            </>
          ) : (
            <>
              <Database className="h-3 w-3 mr-2" />
              EMS 데이터 가져오기
            </>
          )}
        </Button>

        {/* §2-6 3단계: 로딩 시 스켈레톤 — 플랫폼 공통 패턴 */}
        {isLoading && (
          <div className="space-y-2 mt-3" aria-hidden>
            <Skeleton className="h-3 w-full max-w-[90%]" />
            <Skeleton className="h-3 w-full max-w-[70%]" />
            <Skeleton className="h-3 w-full max-w-[85%]" />
          </div>
        )}

        {/* 안내 메시지 */}
        <div className="p-2 bg-blue-50/50 border border-blue-200/50 rounded-md">
          <p className="text-[10px] text-blue-700 leading-relaxed">
            필터 조건 설정 후 버튼을 클릭하면 데이터가 자동으로 폼에 채워집니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
