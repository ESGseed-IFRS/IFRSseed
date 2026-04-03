'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { FileText, Sparkles, Send, CheckCircle2, Clock, XCircle, Bot, Save, Trash2 } from 'lucide-react';
import { useReportStore, PreviewSection } from '@/store/reportStore';
import { mcpApi, type SentenceSuggestion, type ValidationIssue } from '@/lib/api';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';

interface ChecklistItem {
  id: string;
  label: string;
  status: 'completed' | 'in-progress' | 'pending';
  issues?: ValidationIssue[];
}

interface Message {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
}

// UI용 PreviewSection (Date 필드 제외)
type PreviewSectionUI = Omit<PreviewSection, 'createdAt' | 'updatedAt'>;

// 초기 체크리스트
const initialChecklistItems: ChecklistItem[] = [
  { id: 's2-5', label: 'S2-5: 거버넌스 (감독 주체)', status: 'pending' },
  { id: 's2-7', label: 'S2-7: 리스크 및 기회 (전략 우선순위)', status: 'pending' },
  { id: 's2-15', label: 'S2-15: 시나리오 분석 (기준 연도)', status: 'pending' },
  { id: 'scope', label: 'Scope 1, 2, 3 배출량', status: 'pending' },
];

// 초기 환영 메시지
const initialWelcomeMessage: Message = {
  id: '1',
  role: 'ai',
  content: 'IFRS S2 Navigator에 오신 것을 환영합니다. 분석할 ESG/TCFD 텍스트를 입력창에 넣어주세요.',
  timestamp: new Date(),
};

export default function ContentGenerationPage() {
  const {
    contentSections,
    addContentSection,
    removeContentSection,
    checklistItems: storedChecklistItems,
    chatMessages: storedChatMessages,
    setChecklistItems: setChecklistItemsStore,
    setChatMessages: setChatMessagesStore,
  } = useReportStore();
  
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(
    storedChecklistItems.length > 0
      ? storedChecklistItems.map(
          (item: { id: string; label: string; status: 'completed' | 'in-progress' | 'pending' }) => ({
            ...item,
          })
        )
      : initialChecklistItems
  );

  const [messages, setMessages] = useState<Message[]>(() =>
    storedChatMessages.length > 0
      ? storedChatMessages.map(
          (m: { id: string; role: 'ai' | 'user'; content: string; timestamp: string }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp),
          })
        )
      : [initialWelcomeMessage]
  );

  const [inputMessage, setInputMessage] = useState('');
  
  // store의 contentSections를 UI용으로 변환 (Date 필드 제외)
  const [previewSections, setPreviewSections] = useState<PreviewSectionUI[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [rawText, setRawText] = useState('');
  const [isAnalyzed, setIsAnalyzed] = useState(() => contentSections.length > 0);
  const [_currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [_currentParagraph, setCurrentParagraph] = useState<string>('');
  const [sentenceSuggestions, setSentenceSuggestions] = useState<SentenceSuggestion[]>([]);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null);

  const progress = useMemo(() => {
    const completed = checklistItems.filter(item => item.status === 'completed').length;
    return Math.round((completed / checklistItems.length) * 100);
  }, [checklistItems]);

  // 체크리스트 상태를 전역 store에 동기화 (탭 이동 후에도 유지)
  useEffect(() => {
    setChecklistItemsStore(
      checklistItems.map((item) => ({
        id: item.id,
        label: item.label,
        status: item.status,
      }))
    );
  }, [checklistItems, setChecklistItemsStore]);

  // 채팅 메시지를 전역 store에 동기화 (탭 이동 후에도 유지)
  useEffect(() => {
    setChatMessagesStore(
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }))
    );
  }, [messages, setChatMessagesStore]);

  // store의 contentSections 변경 시 UI state 동기화 (텍스트 분석 후에만)
  useEffect(() => {
    if (isAnalyzed) {
      setPreviewSections(
        contentSections.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...rest }: PreviewSection) => rest)
      );
    } else {
      setPreviewSections([]);
    }
  }, [contentSections, isAnalyzed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentMessage = inputMessage;
    setInputMessage('');

    try {
      const result = await mcpApi.mapText({
        raw_text: currentMessage,
        industry: '제조',
        mode: 'auto',
      });

      // AI 응답 메시지
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: result.coverage_comment,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);

      // 첫 번째 후보 선택 (fallback: "14")
      if (result.candidates.length === 0) {
        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'ai',
          content: 'IFRS S2 코드를 찾을 수 없습니다. 다시 시도해주세요.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }

      const topCandidate = result.candidates[0];
      const ifrsCode = topCandidate.code || "14";
      const sectionId = ifrsCode.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // === 기존 문단 통합 확인 로직 ===
      // NOTE: IFRS S2 보고서의 각 코드는 유일한 문단(섹션)을 가져야 하므로,
      // 동일한 IFRS 코드가 이미 저장되어 있다면 해당 문단을 업데이트합니다.
      let targetParagraph: string;
      let targetIfrsCode: string;

      // ✅ 1. 저장소에서 동일한 IFRS 코드를 가진 기존 섹션 찾기
      const existingSection = contentSections.find((s: PreviewSection) => s.ifrsCode === ifrsCode);
      const isUpdateMode = !!existingSection; // 기존 섹션이 존재하면 업데이트 모드

      if (isUpdateMode) {
        // ✅ 2. 업데이트 모드: 기존 문단 내용과 새로운 메시지를 병합 요청
        // AI에게 기존 문단과 새 메시지를 모두 전달하여 통합하도록 유도합니다.
        targetParagraph = existingSection.content; // 기존 문단 전체
        targetIfrsCode = existingSection.ifrsCode;

        // 채팅 메시지에 기존 문단을 포함하여 AI에게 통합을 요청합니다.
        const aiIntegrationRequest: Message = {
          id: (Date.now() + 1.5).toString(),
          role: 'ai',
          content: `[자동 통합 요청] 기존 문단에 '${currentMessage}' 내용을 통합하여 재작성합니다.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiIntegrationRequest]);
      } else {
        // 3. 신규 생성 모드: 원문 그대로 사용
        targetParagraph = currentMessage;
        targetIfrsCode = ifrsCode;
      }
      // === 기존 문단 통합 확인 로직 끝 ===

      // enhance-paragraph 호출
      try {
        // enhanceParagraph 호출 시, 기존 문단 내용(targetParagraph)과
        // 새로운 사용자 입력(currentMessage)을 user_message로 함께 전달합니다.
        const enhanced = await mcpApi.enhanceParagraph({
          // 기존 문단 내용 (통합 대상)
          paragraph: targetParagraph,
          ifrs_code: targetIfrsCode,
          industry: '제조',
          // 새로운 입력(currentMessage)을 user_message로 전달하여 통합을 요청
          user_message: isUpdateMode ? `[기존 문단 통합 요청] 기존 문단에 '${currentMessage}' 내용을 논리적으로 통합하여 하나의 문단으로 재작성해 주세요.` : undefined,
        });

        // 섹션 생성 또는 업데이트
        addContentSection({
          // 기존 섹션의 ID 사용 (덮어쓰기)
          id: isUpdateMode ? existingSection!.id : sectionId,
          title: enhanced.ifrs_title || `IFRS S2-${ifrsCode}`,
          content: enhanced.completed_paragraph, // AI가 통합한 최종 문단 내용
          ifrsCode: targetIfrsCode,
          aiComment: topCandidate.reason + (enhanced.missing_elements.length > 0
            ? `\n\n누락된 요소: ${enhanced.missing_elements.filter(e => !e.present).map(e => e.label).join(', ')}`
            : ''),
          commentType: result.confidence >= 0.7 ? 'info' : 'warning',
        });

        // currentParagraph와 currentSectionId 업데이트
        setCurrentParagraph(enhanced.completed_paragraph);
        setCurrentSectionId(isUpdateMode ? existingSection!.id : sectionId);

        // 체크리스트 업데이트 (코드 매칭)
        const codeNumber = ifrsCode.replace(/[^0-9]/g, '');
        setChecklistItems(prev =>
          prev.map(item => {
            const itemCode = item.id.replace(/[^0-9]/g, '');
            if (itemCode === codeNumber || item.id.includes(codeNumber)) {
              return { ...item, status: 'completed' };
            }
            return item;
          })
        );
      } catch (enhanceError) {
        // enhance 실패 시 토스트 메시지 표시
        toast.error('AI 문단 개선에 실패했어요. 잠시 후 다시 시도해 주세요.');
        console.error('Enhance paragraph error:', enhanceError);
        // currentParagraph는 유지 (이전 상태 보존)
      }
    } catch (error) {
      // 에러 처리
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: 'MCP 서버 연결 오류가 발생했습니다. 서버가 실행 중인지 확인해주세요.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      console.error('MCP API error:', error);
    }
  };

  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveToFinalReport = () => {
    // contentSections는 store에 그대로 유지 (변경 없음)
    // 세션 상태만 초기화
    setIsAnalyzed(false);
    setRawText('');
    setMessages([initialWelcomeMessage]);
    setChecklistItems(initialChecklistItems);
    setPreviewSections([]);
    setCurrentSectionId(null);
    setCurrentParagraph('');
    setSentenceSuggestions([]);
    setActiveSentenceIndex(null);
    setInputMessage('');
    
    // 성공 토스트 메시지
    toast.success('최종보고서에 저장되었습니다. 새로운 분석을 시작할 수 있습니다.');
  };

  const handleDeleteSection = (id: string) => {
    removeContentSection(id);
    // 마지막 한 개를 삭제하는 경우, 분석 완료 화면을 닫고 온보딩 화면으로 되돌립니다.
    if (contentSections.length <= 1) {
      setIsAnalyzed(false);
    }
  };

  const handleAnalyzeText = async () => {
    if (!rawText.trim()) {
      toast.error('분석할 텍스트를 입력해주세요.');
      return;
    }
    
    // 이전 섹션 데이터는 유지 (탭 이동 시 데이터 보존)
    setCurrentSectionId(null);
    setCurrentParagraph('');
    setMessages([]); // 메시지 초기화
    
    try {
      // analyzePdf 대신 analyzeText 호출
      const data = await mcpApi.analyzeText(rawText); 
      setIsAnalyzed(true); // 분석 완료
      
      // 문장별 제안 상태 저장
      setSentenceSuggestions(data.sentence_suggestions ?? []);
      setActiveSentenceIndex(null);
      // 체크리스트를 서버 응답으로 업데이트
      const newChecklist: ChecklistItem[] = data.checklist.map((item) => ({
        id: item.code.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        label: `${item.code}: ${item.title}`,
        status: item.status === 'pass' ? 'completed' : item.status === 'partial' ? 'in-progress' : 'pending',
        issues: item.issues,
      }));
      setChecklistItems(newChecklist);

      // 메시지에 분석 완료 알림 추가
      const suggestionCount = data.sentence_suggestions?.length ?? 0;
      
      // 자동 완성 조건 확인: suggestionCount === 0일 때 자동으로 문단 생성 시도
      if (suggestionCount === 0) {
        try {
          // mapText 호출하여 IFRS 코드 매핑 시도
          const mapResult = await mcpApi.mapText({
            raw_text: rawText,
            industry: '제조',
            mode: 'auto',
          });
          
          if (mapResult.candidates.length > 0) {
            const topCandidate = mapResult.candidates[0];
            
            // IFRS 코드 매핑 성공 확인
            if (topCandidate.code && topCandidate.code !== '(검토 필요)') {
              const ifrsCode = topCandidate.code;
              const sectionId = ifrsCode.toLowerCase().replace(/[^a-z0-9]/g, '-');
              
              // enhanceParagraph 호출
              const enhanced = await mcpApi.enhanceParagraph({
                paragraph: rawText,
                ifrs_code: ifrsCode,
                industry: '제조',
              });
              
              // 섹션 저장
              addContentSection({
                id: sectionId,
                title: enhanced.ifrs_title || `IFRS S2-${ifrsCode}`,
                content: enhanced.completed_paragraph,
                ifrsCode: ifrsCode,
                aiComment: topCandidate.reason + (enhanced.missing_elements.length > 0
                  ? `\n\n누락된 요소: ${enhanced.missing_elements.filter(e => !e.present).map(e => e.label).join(', ')}`
                  : ''),
                commentType: mapResult.confidence >= 0.7 ? 'info' : 'warning',
              });
              
              // 체크리스트 업데이트
              const codeNumber = ifrsCode.replace(/[^0-9]/g, '');
              setChecklistItems(prev =>
                prev.map(item => {
                  const itemCode = item.id.replace(/[^0-9]/g, '');
                  if (itemCode === codeNumber || item.id.includes(codeNumber)) {
                    return { ...item, status: 'completed' };
                  }
                  return item;
                })
              );
              
              // 성공 메시지 추가
              setMessages([{
                id: Date.now().toString(),
                role: 'ai',
                content: `입력된 텍스트가 IFRS S2 요구사항을 충족하여 자동으로 문단을 생성하고 저장했습니다. (IFRS S2-${ifrsCode})`,
                timestamp: new Date(),
              }]);
              
              toast.success('문단이 자동으로 생성되어 저장되었습니다.');
              return; // 자동 완성 성공 시 함수 종료
            }
          }
        } catch (autoError) {
          // 자동 완성 실패 시 기존 플로우 계속 진행
          console.error('자동 완성 실패:', autoError);
        }
      }
      
      // 기존 메시지 설정 로직 (자동 완성이 실행되지 않았거나 실패한 경우)
      const baseMessages: Message[] = [
        {
          id: Date.now().toString(),
          role: 'ai',
          content: `입력된 텍스트(${rawText.length}자) 분석이 완료되었습니다. IFRS S2 체크리스트를 생성했습니다.`,
          timestamp: new Date(),
        },
      ];

      if (suggestionCount > 0) {
        baseMessages.push({
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: `총 ${suggestionCount}개의 문장에서 IFRS S2 관점에서 보완이 필요한 것으로 분석되었습니다. 왼쪽 카드에서 수정이 필요한 문장을 선택해 주세요.`,
          timestamp: new Date(),
        });
      } else {
        baseMessages.push({
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: `입력된 텍스트에 IFRS S2 필수 요소가 대부분 포함되어 있는 것으로 보입니다. AI에게 추가 질문을 하거나 문장을 개선해 보세요.`,
          timestamp: new Date(),
        });
      }

      setMessages(baseMessages);
    } catch (error) {
      console.error('Text 분석 오류:', error);
      toast.error('텍스트 분석 중 오류가 발생했습니다. 서버가 실행 중인지 확인해주세요.');
      setMessages([
        {
          id: Date.now().toString(),
          role: 'ai',
          content: '텍스트 분석 중 오류가 발생했습니다. 서버가 실행 중인지 확인해주세요.',
          timestamp: new Date(),
        },
      ]);
    } 
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8">
        

        {/* 초기 온보딩 화면 - 텍스트 입력 안내 */}
        {!isAnalyzed && (
          <div className="mb-8">
            <Card className="max-w-2xl mx-auto">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2">분석할 텍스트를 입력하세요</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      TCFD 보고서의 문단이나 섹션 텍스트를 입력하면 AI가 IFRS S2 요구사항에 맞춰 분석합니다.
                    </p>
                    <Textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="예시: 이사회 산하 지속가능경영위원회가 기후 리스크를 분기별로 감독하며, 2030년까지 Scope 1, 2 배출량을 40% 감축 목표로 설정하였습니다."
                      className="min-h-[120px] mb-4 resize-none"
                    />
                    <Button onClick={handleAnalyzeText} size="lg">
                      <FileText className="h-4 w-4 mr-2" />
                      텍스트 분석 시작
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2.5fr_1.5fr] gap-6">
          {/* 왼쪽: IFRS S2 필수 정보 체크리스트 */}
          <div className="lg:col-span-1 space-y-4">
            <Card className={!isAnalyzed ? 'opacity-50 pointer-events-none' : ''}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  {!isAnalyzed && <Lock className="h-4 w-4 text-muted-foreground" />}
                  <span>IFRS S2 필수 정보 체크리스트</span>
                </CardTitle>
                <CardDescription>
                  {isAnalyzed ? `진행률 ${progress}%` : '텍스트 분석 후 확인할 수 있습니다'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isAnalyzed ? (
                  <>
                    <Progress value={progress} className="mb-4" />
                    <div className="space-y-3">
                      {checklistItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(item.status)}
                            <span className="flex-1 text-sm font-medium">{item.label}</span>
                          </div>
                          {item.status !== 'completed' && item.issues && item.issues.length > 0 && item.issues[0]?.suggestion && (
                            <div className="mt-2 ml-8 text-xs text-muted-foreground">
                              💡 {item.issues[0].suggestion}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">텍스트 분석이 필요합니다</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 중앙: AI ESG Consultant 채팅 */}
          {isAnalyzed && (
            <div className="lg:col-span-1 space-y-4">
              {/* 수정이 필요한 문장 리스트 카드 */}
              {sentenceSuggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      수정이 필요한 문장 & 부족 정보
                    </CardTitle>
                    <CardDescription>
                      문장을 선택하면 아래 채팅에서 해당 문장을 어떻게 보완할지 안내합니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-64 overflow-y-auto">
                    {sentenceSuggestions.map((s, idx) => {
                      const isActive = activeSentenceIndex === idx;
                      const mainIssue = s.issues[0];
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setActiveSentenceIndex(idx);
                            // 선택 시: 채팅창에 "이 문장이 이런 정보가 부족합니다" 안내 메시지 추가
                            setMessages(prev => [
                              ...prev,
                              {
                                id: `${Date.now()}`,
                                role: 'ai',
                                content:
                                  `문장 ${idx + 1}이(가) ${s.ifrs_codes.join(', ')} 요구사항과 관련하여 보완이 필요합니다.\n\n` +
                                  `▶ 원문: ${s.sentence_text}\n\n` +
                                  (mainIssue?.suggestion
                                    ? `부족한 정보: ${mainIssue.suggestion}`
                                    : mainIssue?.title
                                    ? `부족한 정보: ${mainIssue.title}`
                                    : '필요한 정보를 구체적으로 입력해 주세요.'),
                                timestamp: new Date(),
                              },
                            ]);
                            // 입력창 placeholder처럼: 사용자가 바로 채울 수 있도록 힌트 세팅 (선택)
                            if (mainIssue?.suggestion) {
                              setInputMessage(mainIssue.suggestion);
                            }
                          }}
                          className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                            isActive ? 'border-blue-500 bg-blue-50' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium">
                              문장 {idx + 1}{' '}
                              {s.ifrs_codes.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  ({s.ifrs_codes.join(', ')})
                                </span>
                              )}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              s.overall_status === 'fail'
                                ? 'bg-red-100 text-red-700'
                                : s.overall_status === 'partial'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {s.overall_status === 'fail'
                                ? '부족'
                                : s.overall_status === 'partial'
                                ? '부분 충족'
                                : '충족'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {s.sentence_text}
                          </p>
                          {s.issues.length > 0 && (
                            <p className="mt-1 text-xs text-foreground">
                              {s.issues[0].suggestion ?? s.issues[0].title}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
              <Card className="flex flex-col h-[calc(100vh-200px)]">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Bot className="h-5 w-5 text-secondary" />
                    <span>AI ESG Consultant</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${message.role === 'user'
                            ? 'bg-secondary text-white'
                            : 'bg-muted text-foreground'
                            }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex space-x-2">
                      <Textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="AI의 질문에 답변하거나 질문을 입력하세요... (예: S2-7 문장이 맞나요?)"
                        className="min-h-[80px] resize-none"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!inputMessage.trim()}
                        className="bg-secondary hover:bg-secondary/90 text-white"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 오른쪽: 실시간 보고서 문단 프리뷰 */}
          <div className={`lg:col-span-1 space-y-4 ${!isAnalyzed ? 'lg:col-span-2' : ''}`}>
            <Card className={`h-[calc(100vh-200px)] overflow-y-auto ${!isAnalyzed ? 'opacity-50 pointer-events-none' : ''}`}>
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    {!isAnalyzed && <Lock className="h-4 w-4 text-muted-foreground" />}
                    <span>실시간 보고서 문단 프리뷰</span>
                  </CardTitle>
                  {isAnalyzed && previewSections.length > 0 && (
                    <Button
                      onClick={handleSaveToFinalReport}
                      size="sm"
                      className="bg-secondary hover:bg-secondary/90 text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      최종보고서에 저장
                    </Button>
                  )}
                </div>
                <CardDescription>
                  {isAnalyzed 
                    ? '생성된 문단을 실시간으로 확인하세요'
                    : '텍스트 분석 후 확인할 수 있습니다'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isAnalyzed ? (
                  <>
                    {previewSections.map((section) => (
                      <div key={section.id} className="border-b pb-6 last:border-b-0">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-bold text-primary">{section.title}</h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteSection(section.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg mb-3">
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {section.content}
                          </p>
                        </div>
                        {section.aiComment && (
                          <div
                            className={`p-3 rounded-lg text-sm ${section.commentType === 'warning'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                          >
                            <div className="font-semibold mb-1">AI 코멘트</div>
                            <p>{section.aiComment}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    {previewSections.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>생성된 문단이 여기에 표시됩니다</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">텍스트 분석이 필요합니다</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
