'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, MapPin, Users, Target, Save, FileText, Globe, Activity } from 'lucide-react';
import { useReportStore, ReportStore } from '@/store/reportStore';

interface CompanyData {
  companyName: string;
  businessNumber: string;
  ceoName: string;
  industry: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  mission: string;
  vision: string;
  esgGoals: string;
  employees: string;
  shareholders: string;
  stakeholders: string;
  communication: string;
}

const initialData: CompanyData = {
  companyName: '',
  businessNumber: '',
  ceoName: '',
  industry: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  mission: '',
  vision: '',
  esgGoals: '',
  employees: '',
  shareholders: '',
  stakeholders: '',
  communication: '',
};

export default function CompanyInfoPage() {
  const setCompanyInfo = useReportStore((state: ReportStore) => state.setCompanyInfo);
  const savedCompanyInfo = useReportStore((state: ReportStore) => state.companyInfo);
  const submitCompanyInfoToFinal = useReportStore((state: ReportStore) => state.submitCompanyInfoToFinal);
  const _finalCompanyInfo = useReportStore((state: ReportStore) => state.finalCompanyInfo);
  
  // 저장된 데이터가 있으면 그것을 초기값으로, 없으면 빈 데이터 사용
  const [formData, setFormData] = useState<CompanyData>(savedCompanyInfo || initialData);
  const [errors, setErrors] = useState<Set<keyof CompanyData>>(new Set());
  const [hasLoadedFromStore, setHasLoadedFromStore] = useState(false);
  
  // 버튼 클릭 결과 메시지 상태
  const [validationMessage, setValidationMessage] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({ type: null, text: '' });
  
  const [submitMessage, setSubmitMessage] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({ type: null, text: '' });

  // 메시지 fade-out을 위한 상태
  const [isValidationFading, setIsValidationFading] = useState(false);
  const [isSubmitFading, setIsSubmitFading] = useState(false);

  // 필드명 한글 매핑
  const fieldLabels: Record<keyof CompanyData, string> = {
    companyName: '회사명',
    businessNumber: '사업자등록번호',
    ceoName: '대표자명',
    industry: '업종',
    address: '본사 주소',
    phone: '대표 전화번호',
    email: '대표 이메일',
    website: '웹사이트',
    mission: '미션',
    vision: '비전',
    esgGoals: 'ESG 핵심 목표',
    employees: '임직원 수',
    shareholders: '주요 주주',
    stakeholders: '기타 이해관계자',
    communication: '소통 채널',
  };

  // Zustand persist가 비동기로 로드되므로, 로드 완료 후 데이터 복원
  useEffect(() => {
    if (savedCompanyInfo && !hasLoadedFromStore) {
      console.log('✅ SessionStorage에서 회사정보 로드:', savedCompanyInfo);
      setFormData(savedCompanyInfo);
      setHasLoadedFromStore(true);
    }
  }, [savedCompanyInfo, hasLoadedFromStore]);

  // 페이지 마운트 시 디버깅 정보 출력
  useEffect(() => {
    console.log('=== CompanyInfoPage 마운트 ===');
    console.log('저장된 데이터:', savedCompanyInfo);
    console.log('현재 formData:', formData);
  }, []);

  const _updateCompanyInfo = useReportStore((state: ReportStore) => state.updateCompanyInfo);

  const handleChange = (field: keyof CompanyData, value: string) => {
    const newData = {
      ...formData,
      [field]: value,
    };
    setFormData(newData);
    
    // 실시간으로 임시 저장 (페이지 이동 후에도 입력 상태 유지)
    // 단, FinalReportPage로는 전달되지 않음 (finalCompanyInfo는 별도)
    setCompanyInfo(newData);
    console.log('✏️ 실시간 임시 저장:', field, '=', value);
    
    // 입력 시 해당 필드의 에러 제거
    if (errors.has(field)) {
      setErrors(prev => {
        const newErrors = new Set(prev);
        newErrors.delete(field);
        return newErrors;
      });
    }

    // 필드 변경 시 메시지 초기화
    if (validationMessage.type) {
      setValidationMessage({ type: null, text: '' });
      setIsValidationFading(false);
    }
    if (submitMessage.type) {
      setSubmitMessage({ type: null, text: '' });
      setIsSubmitFading(false);
    }
  };

  const handleSave = () => {
    const newErrors = new Set<keyof CompanyData>();
    
    // 모든 필드 검증
    Object.keys(formData).forEach((key) => {
      const field = key as keyof CompanyData;
      if (!formData[field] || formData[field].trim() === '') {
        newErrors.add(field);
      }
    });

    setErrors(newErrors);

    // 검증만 수행 (데이터는 이미 실시간으로 저장됨)
    if (newErrors.size === 0) {
      console.log('✅ 회사정보 검증 완료:', formData);
      setIsValidationFading(false);
      setValidationMessage({
        type: 'success',
        text: '✅ 모든 정보가 정상적으로 입력되었습니다! 이제 "최종 보고서에 제출" 버튼을 클릭하세요.'
      });
      
      // 2초 후 fade-out 시작
      setTimeout(() => {
        setIsValidationFading(true);
        // fade-out 애니메이션 완료 후 메시지 제거
        setTimeout(() => {
          setValidationMessage({ type: null, text: '' });
          setIsValidationFading(false);
        }, 500);
      }, 2000);
    } else {
      console.log('❌ 검증 실패: 모든 필드를 입력해주세요', Array.from(newErrors));
      const errorFieldNames = Array.from(newErrors).map(field => fieldLabels[field] || field);
      setIsValidationFading(false);
      setValidationMessage({
        type: 'error',
        text: `⚠️ ${newErrors.size}개 필드가 비어있습니다: ${errorFieldNames.join(', ')}`
      });
      
      // 2초 후 fade-out 시작
      setTimeout(() => {
        setIsValidationFading(true);
        // fade-out 애니메이션 완료 후 메시지 제거
        setTimeout(() => {
          setValidationMessage({ type: null, text: '' });
          setIsValidationFading(false);
        }, 500);
      }, 2000);
    }
  };

  const handleSubmitToFinal = () => {
    if (!savedCompanyInfo) {
      console.log('⚠️ 입력된 정보가 없습니다.');
      setIsSubmitFading(false);
      setSubmitMessage({
        type: 'error',
        text: '⚠️ 입력된 정보가 없습니다. 먼저 회사 정보를 입력해주세요.'
      });
      
      // 2초 후 fade-out 시작
      setTimeout(() => {
        setIsSubmitFading(true);
        setTimeout(() => {
          setSubmitMessage({ type: null, text: '' });
          setIsSubmitFading(false);
        }, 500);
      }, 2000);
      return;
    }

    // 모든 필드가 채워져 있는지 검증
    const newErrors = new Set<keyof CompanyData>();
    Object.keys(formData).forEach((key) => {
      const field = key as keyof CompanyData;
      if (!formData[field] || formData[field].trim() === '') {
        newErrors.add(field);
      }
    });

    if (newErrors.size > 0) {
      setErrors(newErrors);
      const errorFieldNames = Array.from(newErrors).map(field => fieldLabels[field] || field);
      console.log('⚠️ 최종 제출 불가 - 미입력 필드:', errorFieldNames);
      setIsSubmitFading(false);
      setSubmitMessage({
        type: 'error',
        text: `⚠️ 최종 제출 불가! ${newErrors.size}개 필드를 입력해주세요: ${errorFieldNames.join(', ')}`
      });
      
      // 2초 후 fade-out 시작
      setTimeout(() => {
        setIsSubmitFading(true);
        setTimeout(() => {
          setSubmitMessage({ type: null, text: '' });
          setIsSubmitFading(false);
        }, 500);
      }, 2000);
      return;
    }

    submitCompanyInfoToFinal();
    console.log('✅ 회사정보가 최종 보고서로 제출되었습니다!');
    setIsSubmitFading(false);
    setSubmitMessage({
      type: 'success',
      text: '✅ 회사정보가 최종 보고서로 제출되었습니다! 대시보드에서 PDF를 생성할 수 있습니다.'
    });
    
    // 3초 후 fade-out 시작
    setTimeout(() => {
      setIsSubmitFading(true);
      setTimeout(() => {
        setSubmitMessage({ type: null, text: '' });
        setIsSubmitFading(false);
      }, 500);
    }, 3000);
  };

  // 섹션별 필드 그룹화
  const fieldGroups = useMemo(() => {
    return {
      '기업 기본정보': [
        { id: 'companyName', label: '회사명', icon: Building2 },
        { id: 'businessNumber', label: '사업자등록번호', icon: FileText },
        { id: 'ceoName', label: '대표자명', icon: Users },
        { id: 'industry', label: '업종', icon: Activity },
      ],
      '연락처 정보': [
        { id: 'address', label: '본사 주소', icon: MapPin },
        { id: 'phone', label: '대표 전화번호', icon: MapPin },
        { id: 'email', label: '대표 이메일', icon: MapPin },
        { id: 'website', label: '웹사이트', icon: Globe },
      ],
      'ESG 목표 및 비전': [
        { id: 'mission', label: '미션', icon: Target },
        { id: 'vision', label: '비전', icon: Target },
        { id: 'esgGoals', label: 'ESG 핵심 목표', icon: Target },
      ],
      '이해관계자 정보': [
        { id: 'employees', label: '임직원 수', icon: Users },
        { id: 'shareholders', label: '주요 주주', icon: Users },
        { id: 'stakeholders', label: '기타 이해관계자', icon: Users },
        { id: 'communication', label: '소통 채널', icon: Users },
      ],
    };
  }, []);

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary rounded-2xl">
              <Building2 className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">회사정보 관리</h1>
          <p className="text-lg text-muted-foreground">
            지속가능경영 보고서 작성을 위한 기업 기본정보를 입력하세요
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 입력 폼 (왼쪽) */}
          <div className="lg:col-span-2 space-y-6">
            {Object.entries(fieldGroups).map(([sectionName, fields]) => {
              const sectionIcons: { [key: string]: typeof Building2 } = {
                '기업 기본정보': Building2,
                '연락처 정보': MapPin,
                'ESG 목표 및 비전': Target,
                '이해관계자 정보': Users,
              };
              const SectionIcon = sectionIcons[sectionName] || Building2;

              return (
                <Card key={sectionName} className="border-2 border-transparent hover:border-primary/20 transition-all duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <SectionIcon className="h-5 w-5 text-secondary" />
                      <span>{sectionName}</span>
                    </CardTitle>
                    <CardDescription>
                      {sectionName === '기업 기본정보' && '회사의 기본적인 정보를 입력해주세요'}
                      {sectionName === '연락처 정보' && '회사의 연락처와 주소 정보를 입력해주세요'}
                      {sectionName === 'ESG 목표 및 비전' && '회사의 지속가능경영 목표와 비전을 설정하세요'}
                      {sectionName === '이해관계자 정보' && '주요 이해관계자와 소통 방식을 정의하세요'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {fields.map((field) => {
                      const isTextarea = ['address', 'mission', 'vision', 'esgGoals', 'shareholders', 'stakeholders', 'communication'].includes(field.id);
                      const Icon = field.icon;

                      const fieldKey = field.id as keyof CompanyData;
                      const hasError = errors.has(fieldKey);

                      return (
                        <div key={field.id}>
                          <Label htmlFor={field.id} className="flex items-center space-x-2">
                            <Icon className="h-4 w-4 text-secondary" />
                            <span>{field.label}</span>
                          </Label>
                          {isTextarea ? (
                            <Textarea
                              id={field.id}
                              value={formData[fieldKey]}
                              onChange={(e) => handleChange(fieldKey, e.target.value)}
                              placeholder={
                                field.id === 'address' ? '서울특별시 강남구 테헤란로 123, 그린빌딩 10층' :
                                  field.id === 'mission' ? '지속가능한 기술혁신을 통해 더 나은 미래를 만들어갑니다' :
                                    field.id === 'vision' ? '2030년까지 탄소중립을 달성하는 글로벌 친환경 기업' :
                                      field.id === 'esgGoals' ? '• 환경: 2030년 탄소중립 달성\n• 사회: 지역사회 일자리 창출 1000개\n• 지배구조: 투명한 경영 시스템 구축' :
                                        field.id === 'shareholders' ? '• 창립자 및 경영진: 40%\n• 기관투자자: 35%\n• 일반 주주: 25%' :
                                          field.id === 'stakeholders' ? '고객, 협력업체, 지역사회, 정부기관, NGO 등' :
                                            '• 정기 주주총회\n• 분기별 실적발표\n• 지속가능경영 보고서\n• 홈페이지 및 SNS'
                              }
                              className={`mt-1 min-h-[80px] ${hasError ? 'border-red-500 border-2' : ''}`}
                            />
                          ) : (
                            <Input
                              id={field.id}
                              type={field.id === 'employees' ? 'number' : field.id === 'email' ? 'email' : 'text'}
                              value={formData[fieldKey]}
                              onChange={(e) => handleChange(fieldKey, e.target.value)}
                              placeholder={
                                field.id === 'companyName' ? '예: 그린테크 주식회사' :
                                  field.id === 'businessNumber' ? '000-00-00000' :
                                    field.id === 'ceoName' ? '홍길동' :
                                      field.id === 'industry' ? '예: 재생에너지, 제조업, IT서비스' :
                                        field.id === 'phone' ? '02-1234-5678' :
                                          field.id === 'email' ? 'info@greentech.co.kr' :
                                            field.id === 'website' ? 'https://www.greentech.co.kr' :
                                              '250'
                              }
                              className={`mt-1 ${hasError ? 'border-red-500 border-2' : ''}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 요약 미리보기 (오른쪽) */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8 border-l-4 border-secondary">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-secondary">
                  보고서 요약 미리보기
                </CardTitle>
                <CardDescription>
                  입력된 정보가 실시간으로 표시됩니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {Object.entries(fieldGroups).map(([sectionName, fields]) => (
                    <div key={sectionName} className="pb-4 border-b last:border-b-0">
                      <h3 className="text-lg font-bold text-secondary mb-3 pb-2 border-b">
                        {sectionName}
                      </h3>
                      <div className="space-y-3">
                        {fields.map((field) => {
                          const Icon = field.icon;
                          const fieldKey = field.id as keyof CompanyData;
                          const value = formData[fieldKey];
                          const hasError = errors.has(fieldKey);
                          const isEmpty = !value || value.trim() === '';
                          
                          return (
                            <div key={field.id} className="flex flex-col space-y-1">
                              <div className="flex items-center text-sm font-medium text-muted-foreground">
                                <Icon className="w-4 h-4 mr-1 opacity-70" />
                                {field.label}
                                {hasError && isEmpty && (
                                  <span className="ml-2 text-red-500 text-xs">을 입력해주세요</span>
                                )}
                              </div>
                              <div className={`text-sm text-foreground bg-muted/50 p-2 rounded-md min-h-[2rem] ${hasError && isEmpty ? 'border-2 border-red-500' : ''}`}>
                                {value || <span className="text-muted-foreground italic">N/A (데이터 없음)</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-xs text-muted-foreground italic p-3 border-t bg-muted/30 rounded">
                  * 이 요약 정보는 최종 보고서의 &apos;조직 개요&apos; 섹션에 사용되는 핵심 데이터입니다.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="mt-8">
          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              onClick={handleSave}
              className="bg-primary hover:bg-primary-glow text-white px-8 py-4 shadow-seed"
            >
              <Save className="mr-2 h-5 w-5" />
              정보 확인 및 검증
            </Button>

            <Button
              size="lg"
              onClick={handleSubmitToFinal}
              disabled={!savedCompanyInfo}
              className="bg-secondary hover:bg-secondary/90 text-white px-8 py-4 shadow-seed disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="mr-2 h-5 w-5" />
              최종 보고서에 제출
            </Button>
          </div>

          {/* 버튼 클릭 결과 메시지 */}
          <div className="mt-6 space-y-3 max-w-3xl mx-auto">
            {/* 검증 결과 메시지 */}
            {validationMessage.type && (
              <div
                className={`p-4 rounded-lg border-2 transition-all duration-500 ease-in-out ${
                  isValidationFading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
                } ${
                  validationMessage.type === 'success'
                    ? 'bg-green-50 border-green-500 text-green-800'
                    : 'bg-red-50 border-red-500 text-red-800'
                }`}
              >
                <p className="text-sm font-medium">{validationMessage.text}</p>
              </div>
            )}

            {/* 제출 결과 메시지 */}
            {submitMessage.type && (
              <div
                className={`p-4 rounded-lg border-2 transition-all duration-500 ease-in-out ${
                  isSubmitFading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
                } ${
                  submitMessage.type === 'success'
                    ? 'bg-green-50 border-green-500 text-green-800'
                    : 'bg-red-50 border-red-500 text-red-800'
                }`}
              >
                <p className="text-sm font-medium">{submitMessage.text}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
