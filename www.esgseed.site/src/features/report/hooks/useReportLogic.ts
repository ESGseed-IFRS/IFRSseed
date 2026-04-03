'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import type {
  TableOfContentsItem,
  PageContent,
  DisclosureStandard,
  ComplianceMatch,
  QuantitativeValidation,
  PageStandardMapping,
  VisualizationRecommendation,
} from '../types';
/**
 * Report 페이지의 핵심 로직을 관리하는 hook
 * 토큰 절약을 위해 별도 파일로 분리
 */
export function useReportLogic(
  tableOfContents: TableOfContentsItem[],
  pageStandardMappings: PageStandardMapping[],
  disclosureStandards: DisclosureStandard[]
) {
  const [selectedTocId, setSelectedTocId] = useState<string | null>(tableOfContents[0]?.id || null);
  const [pageContents, setPageContents] = useState<Map<string, PageContent>>(new Map());
  const [complianceMatches, setComplianceMatches] = useState<ComplianceMatch[]>([]);
  const [quantitativeValidations, setQuantitativeValidations] = useState<QuantitativeValidation[]>([]);
  const [crawledSuggestions, setCrawledSuggestions] = useState<string[]>([]);
  const [aiGeneratedText, setAiGeneratedText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const lastSavedContentRef = useRef<string>('');
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentPageContent = selectedTocId ? (pageContents.get(selectedTocId) ?? null) : null;
  const selectedTocItem = selectedTocId ? (tableOfContents.find(t => t.id === selectedTocId) ?? null) : null;

  // 현재 페이지와 관련된 공시 기준 필터링
  const relevantStandards = useMemo(() => {
    if (!selectedTocId) return [];

    const tocItem = tableOfContents.find(t => t.id === selectedTocId);
    if (!tocItem) return [];

    const pageNum = tocItem.pageNumber;
    if (!pageNum) return [];

    const mapping = pageStandardMappings.find(m => m.pageNumber === pageNum);
    
    if (mapping) {
      const mappedStandards = mapping.standards
        .map(code => disclosureStandards.find(s => s.name === code))
        .filter((s): s is DisclosureStandard => s !== undefined);

      const additionalStandards: DisclosureStandard[] = [];
      
      if (pageNum === 36 || (pageNum >= 46 && pageNum <= 59)) {
        const s1_78 = disclosureStandards.find(s => s.name === 'IFRS S1-78');
        if (s1_78 && !mappedStandards.find(s => s.id === s1_78.id)) {
          additionalStandards.push(s1_78);
        }
      }

      if (pageNum >= 130 && pageNum <= 138) {
        const bp2 = disclosureStandards.find(s => s.name === 'ESRS BP-2');
        if (bp2 && !mappedStandards.find(s => s.id === bp2.id)) {
          additionalStandards.push(bp2);
        }
      }

      return [...mappedStandards, ...additionalStandards];
    }

    return [];
  }, [selectedTocId, tableOfContents, disclosureStandards, pageStandardMappings]);

  // 일치도 계산 (값이 실제로 변했을 때만 setState하여 무한 루프 방지)
  useEffect(() => {
    if (!currentPageContent || !selectedTocId) {
      setComplianceMatches(prev => (prev.length === 0 ? prev : []));
      return;
    }

    const tocItem = tableOfContents.find(t => t.id === selectedTocId);
    const pageNum = tocItem?.pageNumber;
    const mapping = pageNum ? pageStandardMappings.find(m => m.pageNumber === pageNum) : null;

    const content = currentPageContent.content.toLowerCase();
    const matches: ComplianceMatch[] = relevantStandards.map(standard => {
      const isMappedStandard = mapping?.standards.includes(standard.name) || false;
      const isAdditionalStandard = 
        (standard.name === 'IFRS S1-78' && pageNum && (pageNum === 36 || (pageNum >= 46 && pageNum <= 59))) ||
        (standard.name === 'ESRS BP-2' && pageNum && pageNum >= 130 && pageNum <= 138);

      const standardKeywords = [
        standard.description.toLowerCase(),
        standard.code.toLowerCase(),
        standard.name.toLowerCase(),
        ...standard.code.split(/[-.]/).map(s => s.trim().toLowerCase()),
      ];

      let matchCount = 0;
      const missingItems: string[] = [];
      const suggestions: string[] = [];

      standardKeywords.forEach(keyword => {
        if (keyword && content.includes(keyword)) {
          matchCount++;
        } else if (keyword) {
          missingItems.push(keyword);
        }
      });

      let complianceRate = Math.min(100, (matchCount / standardKeywords.length) * 100);
      
      if (isMappedStandard && matchCount === 0) {
        complianceRate = 0;
      }

      if (isAdditionalStandard && matchCount === 0) {
        suggestions.push(`⚠️ 빠진 부분 보완: ${standard.name}을 이 페이지에 추가하는 것을 추천합니다.`);
      }
      
      let matchStatus: 'matched' | 'partial' | 'unmatched';
      if (complianceRate >= 90) {
        matchStatus = 'matched';
      } else if (complianceRate >= 60) {
        matchStatus = 'partial';
        if (!isAdditionalStandard) {
          suggestions.push(`${standard.name} 관련 내용을 더 구체화하세요.`);
        }
      } else {
        matchStatus = 'unmatched';
        if (!isAdditionalStandard) {
          suggestions.push(`${standard.name} (${standard.code}): ${standard.description} 내용을 추가하세요.`);
        }
      }

      return {
        standardId: standard.id,
        matchStatus,
        complianceRate: Math.round(complianceRate),
        missingItems,
        suggestions,
      };
    });

    setComplianceMatches(prev => {
      if (prev.length !== matches.length) return matches;
      const isSame = prev.every(
        (p, i) =>
          matches[i] &&
          p.standardId === matches[i].standardId &&
          p.complianceRate === matches[i].complianceRate &&
          p.matchStatus === matches[i].matchStatus
      );
      return isSame ? prev : matches;
    });
  }, [currentPageContent, relevantStandards, selectedTocId, tableOfContents, pageStandardMappings]);

  // 전체 준수율 계산
  const overallComplianceRate = useMemo(() => {
    if (complianceMatches.length === 0) return 0;
    const total = complianceMatches.reduce((sum, m) => sum + m.complianceRate, 0);
    return Math.round(total / complianceMatches.length);
  }, [complianceMatches]);

  // 정량 데이터 검증
  const validateQuantitativeData = (field: string, value: number, previousValue?: number): QuantitativeValidation | null => {
    if (value < 0) {
      return {
        field,
        value,
        isValid: false,
        warning: '음수 값은 허용되지 않습니다.',
        severity: 'error',
      };
    }

    if (previousValue !== undefined && previousValue > 0) {
      const changeRate = ((value - previousValue) / previousValue) * 100;
      if (Math.abs(changeRate) > 50) {
        return {
          field,
          value,
          previousValue,
          isValid: true,
          warning: `전년대비 ${changeRate > 0 ? '+' : ''}${changeRate.toFixed(1)}% 변동. 데이터 오류 가능성이 있습니다. 확인하세요.`,
          severity: 'warning',
        };
      }
    }

    return null;
  };

  // 30초 자동 임시저장 (SR_PAGE_IMPLEMENTATION F-02)
  const performSave = useCallback(() => {
    if (!selectedTocId) return;
    const content = currentPageContent?.content || '';
    if (content === lastSavedContentRef.current) return;
    lastSavedContentRef.current = content;
    const existingContent = pageContents.get(selectedTocId);
    const updatedContent: PageContent = {
      id: selectedTocId,
      tocId: selectedTocId,
      content,
      quantitativeData: existingContent?.quantitativeData || {},
    };
    const newContents = new Map(pageContents);
    newContents.set(selectedTocId, updatedContent);
    setPageContents(newContents);
  }, [selectedTocId, currentPageContent?.content, pageContents]);

  useEffect(() => {
    autoSaveIntervalRef.current = setInterval(performSave, 30000);
    return () => {
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    };
  }, [performSave]);

  // 페이지 내용 저장 (50자 미만 시 경고)
  const handleSavePageContent = () => {
    if (!selectedTocId) return;

    const content = (currentPageContent?.content || '').trim();
    if (content.length > 0 && content.length < 50) {
      toast.warning('내용이 너무 짧습니다. 50자 이상 입력 후 저장해 주세요.');
      return;
    }

    lastSavedContentRef.current = content;
    const existingContent = pageContents.get(selectedTocId);
    const updatedContent: PageContent = {
      id: selectedTocId,
      tocId: selectedTocId,
      content,
      quantitativeData: existingContent?.quantitativeData || {},
    };

    const newContents = new Map(pageContents);
    newContents.set(selectedTocId, updatedContent);
    setPageContents(newContents);
    toast.success('페이지 내용이 저장되었습니다.');
  };

  // 페이지 내용 업데이트
  const handleContentChange = (value: string) => {
    if (!selectedTocId) return;

    const existingContent = pageContents.get(selectedTocId);
    const updatedContent: PageContent = {
      id: selectedTocId,
      tocId: selectedTocId,
      content: value,
      quantitativeData: existingContent?.quantitativeData || {},
    };

    const newContents = new Map(pageContents);
    newContents.set(selectedTocId, updatedContent);
    setPageContents(newContents);
  };

  // 정량 데이터 입력
  const handleQuantitativeInput = (field: string, value: string) => {
    if (!selectedTocId) return;

    const numValue = parseFloat(value);
    if (isNaN(numValue) && value !== '') return;

    const existingContent = pageContents.get(selectedTocId);
    const previousValue = existingContent?.quantitativeData[field] 
      ? parseFloat(String(existingContent.quantitativeData[field])) 
      : undefined;

    if (!isNaN(numValue)) {
      const validation = validateQuantitativeData(field, numValue, previousValue);
      if (validation) {
        const existing = quantitativeValidations.filter(v => v.field !== field);
        setQuantitativeValidations([...existing, validation]);
        
        if (validation.severity === 'error') {
          toast.error(validation.warning);
          return;
        } else if (validation.severity === 'warning') {
          toast.warning(validation.warning);
        }
      } else {
        setQuantitativeValidations(quantitativeValidations.filter(v => v.field !== field));
      }
    }

    const updatedContent: PageContent = {
      id: selectedTocId,
      tocId: selectedTocId,
      content: existingContent?.content || '',
      quantitativeData: {
        ...existingContent?.quantitativeData,
        [field]: value === '' ? '' : numValue,
      },
    };

    const newContents = new Map(pageContents);
    newContents.set(selectedTocId, updatedContent);
    setPageContents(newContents);
  };

  // AI 문단 생성 (SR_PAGE_IMPLEMENTATION F-02)
  const handleGenerateCrawledContent = async () => {
    if (!selectedTocId) {
      toast.info('목차 항목을 선택해 주세요.');
      return;
    }

    const tocItem = tableOfContents.find(t => t.id === selectedTocId);
    const pageNum = tocItem?.pageNumber;
    const title = tocItem?.title || '';
    const mapping = pageNum ? pageStandardMappings.find(m => m.pageNumber === pageNum) : null;

    setAiLoading(true);
    setAiGeneratedText(null);

    await new Promise((r) => setTimeout(r, 1500));

    const parts: string[] = [];
    if (mapping && mapping.standards.length > 0) {
      mapping.standards.slice(0, 3).forEach((standardCode) => {
        const standard = disclosureStandards.find((s) => s.name === standardCode);
        if (standard) {
          if (standard.type === 'GRI' && standard.code.startsWith('305')) {
            parts.push(
              `당사는 IPCC AR6 보고서에 따라 온실가스 배출량을 관리하고 있습니다. ${standardCode}에 따라 Scope 1·2·3 배출 현황을 공시합니다.`
            );
          } else if (standard.type === 'IFRS' && standard.code.includes('S1-78')) {
            parts.push(`IFRS S1-78 기준에 따라 광범위 적용을 공시합니다.`);
          } else {
            parts.push(`${standardCode}: ${standard.description}에 따라 내용을 반영하였습니다.`);
          }
        }
      });
    } else if (pageNum === 36 && title.includes('온실가스')) {
      parts.push(
        '당사는 IPCC AR6 보고서에 따라 온실가스 감축 목표를 설정하였습니다. 직접 배출(Scope 1), 에너지 간접(Scope 2), 기타 간접(Scope 3) 배출량을 관리하고 있습니다.'
      );
    } else {
      parts.push(`${title} 섹션에 맞는 공시 기준을 반영한 문단입니다. 필요 시 직접 수정하여 저장해 주세요.`);
    }

    setAiGeneratedText(parts.join('\n\n'));
    setAiLoading(false);
    toast.success('AI 문단이 생성되었습니다.');
  };

  const handleUseGeneratedContent = () => {
    if (aiGeneratedText) {
      const existingContent = pageContents.get(selectedTocId || '');
      const newContent = (existingContent?.content || '') + (existingContent?.content ? '\n\n' : '') + aiGeneratedText;
      handleContentChange(newContent);
      setAiGeneratedText(null);
      toast.success('에디터에 삽입되었습니다. 직접 작성 탭에서 수정 후 저장해 주세요.');
    }
  };

  const handleRegenerateAi = () => {
    setAiGeneratedText(null);
    handleGenerateCrawledContent();
  };

  // 시각화 추천 (SR_PAGE_IMPLEMENTATION F-04) — 페이지별 추천
  const visualizationRecommendations = useMemo((): VisualizationRecommendation[] => {
    const pageNum = selectedTocItem?.pageNumber;
    if (!pageNum) return [];
    const items: VisualizationRecommendation[] = [];
    if (pageNum === 36 || (pageNum >= 32 && pageNum <= 41)) {
      items.push(
        { id: 'ghg-bar', title: '온실가스 배출량 막대 그래프', description: 'Scope 1·2·3 연도별 비교', chartType: 'stacked_bar', dataKey: 'ghg_scope' },
        { id: 'ghg-table', title: '배출량 현황 테이블', description: '항목별 수치 및 전년 대비', chartType: 'table', dataKey: 'ghg_scope' }
      );
    }
    if (pageNum === 33 || pageNum === 36) {
      items.push(
        { id: 'energy-donut', title: '에너지 믹스 도넛 차트', description: '재생에너지 비율', chartType: 'donut', dataKey: 'energy_mix' }
      );
    }
    if (items.length === 0) {
      items.push(
        { id: 'generic-table', title: '데이터 테이블', description: '항목별 수치 나열', chartType: 'table', dataKey: 'generic' }
      );
    }
    return items;
  }, [selectedTocItem?.pageNumber]);

  return {
    selectedTocId,
    setSelectedTocId,
    currentPageContent: currentPageContent ?? null,
    selectedTocItem: selectedTocItem ?? null,
    relevantStandards,
    complianceMatches,
    quantitativeValidations,
    crawledSuggestions,
    overallComplianceRate,
    aiGeneratedText,
    aiLoading,
    visualizationRecommendations,
    handleContentChange,
    handleQuantitativeInput,
    handleSavePageContent,
    handleGenerateCrawledContent,
    handleUseGeneratedContent,
    handleRegenerateAi,
  };
}
