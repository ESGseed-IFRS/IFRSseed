'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { PageContent, TableOfContentsItem } from '../../types';

/** SR_PAGE_IMPLEMENTATION F-02: 직접 작성 / AI 문단 생성 탭 분리 */

interface SREditorProps {
  selectedTocItem: TableOfContentsItem | null;
  currentPageContent: PageContent | null;
  aiGeneratedText: string | null;
  aiLoading: boolean;
  /** 정량 데이터 연동 상태 (F-03: ERP/EMS) */
  quantitativeLinked: boolean;
  /** 생성 조건 요약: 회사정보, GHG, ERP */
  conditionSummary: { companyInfo: boolean; ghg: boolean; erp: boolean };
  onContentChange: (value: string) => void;
  onSave: () => void;
  onGenerateAi: () => void;
  onUseGeneratedContent: () => void;
  onRegenerateAi: () => void;
}

export function SREditor({
  selectedTocItem,
  currentPageContent,
  aiGeneratedText,
  aiLoading,
  quantitativeLinked,
  conditionSummary,
  onContentChange,
  onSave,
  onGenerateAi,
  onUseGeneratedContent,
  onRegenerateAi,
}: SREditorProps) {
  if (!selectedTocItem) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>목차 항목을 선택하여 페이지를 작성하세요</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {selectedTocItem.pageNumber != null && (
            <Badge variant="outline" className="text-sm">
              페이지 {String(selectedTocItem.pageNumber).padStart(2, '0')}
            </Badge>
          )}
          <CardTitle className="text-lg">{selectedTocItem.title}</CardTitle>
        </div>
        <CardDescription>직접 작성하거나 AI 문단 생성 후 편집해 저장하세요</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct">직접 작성</TabsTrigger>
            <TabsTrigger value="ai">AI 문단 생성</TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium">내용</label>
              <Textarea
                value={currentPageContent?.content ?? ''}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder="보고서 내용을 입력하세요. 50자 이상 권장..."
                className="min-h-[280px] mt-2 resize-y"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                30초마다 자동 임시저장 · 저장 시 준수율 재계산
              </span>
              <Button onClick={onSave}>저장</Button>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="mt-4 space-y-4">
            {/* 생성 전 조건 요약 (F-02) */}
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm font-semibold text-foreground mb-3">이 문단은 아래 정보를 바탕으로 생성됩니다.</p>
              <ul className="space-y-1.5 text-sm">
                <li className={conditionSummary.companyInfo ? 'text-green-600' : 'text-muted-foreground'}>
                  {conditionSummary.companyInfo ? '✓' : '✗'} 회사정보 입력됨
                </li>
                <li className={conditionSummary.ghg ? 'text-green-600' : 'text-muted-foreground'}>
                  {conditionSummary.ghg ? '✓' : '✗'} GHG 산정 데이터 연동됨
                </li>
                <li className={conditionSummary.erp ? 'text-green-600' : 'text-amber-600'}>
                  {conditionSummary.erp ? '✓' : '✗'} ERP 연동 데이터 {conditionSummary.erp ? '' : '(연동 시 더 정확한 문단 생성 가능)'}
                </li>
              </ul>
            </div>

            <Button onClick={onGenerateAi} disabled={aiLoading} className="w-full sm:w-auto">
              {aiLoading ? '생성 중...' : 'AI 문단 생성'}
            </Button>

            {aiGeneratedText && !aiLoading && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-semibold">생성된 문단 미리보기</p>
                <div className="text-sm text-foreground whitespace-pre-wrap border rounded p-3 bg-background min-h-[120px]">
                  {aiGeneratedText}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={onUseGeneratedContent}>
                    이 내용 사용
                  </Button>
                  <Button size="sm" variant="outline" onClick={onRegenerateAi}>
                    다시 생성
                  </Button>
                  <Button size="sm" variant="outline" onClick={onUseGeneratedContent}>
                    직접 수정
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 정량 데이터 연동 상태 (F-03: 수동 입력 폼 없음) */}
        <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
          정량 데이터: {quantitativeLinked ? '연동됨 (AI 생성 시 자동 반영)' : '미연동 (문단 생성은 가능하나 수치 미포함)'}
        </div>
      </CardContent>
    </Card>
  );
}
