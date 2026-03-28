import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Sprout, Leaf, TreePine, ArrowRight, BarChart3, Building2, FileText } from 'lucide-react';

interface HomePageProps {
  onNavigate: (tab: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const mainPanels = [
    {
      id: 'company',
      title: '회사정보 관리',
      description: '지속가능경영을 위한 기업 기본정보와 ESG 데이터를 체계적으로 관리하세요',
      icon: Building2,
      color: 'primary',
      features: ['기업 프로필 설정', 'ESG 목표 수립', '이해관계자 정보']
    },
    {
      id: 'content',
      title: '스마트 문단생성',
      description: 'AI 기반으로 전문적이고 일관성 있는 지속가능경영 보고서 문단을 자동 생성합니다',
      icon: FileText,
      color: 'secondary',
      features: ['AI 문단 생성', '템플릿 활용', '다국어 지원']
    },
  ];

  const esgPanels = [
    {
      id: 'charts-environmental',
      title: 'Environmental',
      description: '환경 데이터를 직관적인 차트와 테이블로 시각화하여 관리하세요',
      icon: BarChart3,
      color: 'accent',
      features: ['온실가스 배출량', '에너지 소비', '재생에너지 현황'],
      esgTab: 'environmental' as const,
    },
    {
      id: 'charts-social',
      title: 'Social',
      description: '사회적 임팩트 데이터를 체계적으로 시각화하고 분석하세요',
      icon: BarChart3,
      color: 'accent',
      features: ['임직원 현황', '안전보건', '사회공헌'],
      esgTab: 'social' as const,
    },
    {
      id: 'charts-governance',
      title: 'Governance',
      description: '거버넌스 데이터를 명확하게 시각화하여 투명성을 높이세요',
      icon: BarChart3,
      color: 'accent',
      features: ['이사회 구성', '윤리경영', '컴플라이언스'],
      esgTab: 'governance' as const,
    },
  ];

  const ambitionCards = [
    {
      tabId: 'company',
      letter: '1',
      heroTitle: 'Company Info',
      title: '회사정보',
      subtitle: '기업 기본정보와 ESG 데이터를 체계적으로 관리하세요',
      image:
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80',
    },
    {
      tabId: 'content',
      letter: '2',
      heroTitle: 'Smart Draft',
      title: 'IFRS 문단생성',
      subtitle: 'AI로 일관성 있는 보고서 문단을 빠르게 생성합니다',
      image:
        'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=1600&q=80',
    },
    {
      tabId: 'charts',
      letter: '3',
      heroTitle: 'ESG DATA',
      title: 'ESG DATA',
      subtitle: '복잡한 ESG 데이터를 직관적인 차트로 변환하세요',
      image:
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
    },
    {
      tabId: 'cdp',
      letter: '4',
      heroTitle: 'CDP Response',
      title: 'CDP 대응',
      subtitle: 'CDP 질문에 대한 전문적인 답변을 생성합니다',
      image:
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80',
    },
    {
      tabId: 'ghg',
      letter: '5',
      heroTitle: 'GHG Protocol',
      title: '온실가스배출량 산정',
      subtitle: 'Scope 1, 2, 3 온실가스 배출량을 체계적으로 산정합니다',
      image:
        'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1600&q=80',
    },
    {
      tabId: 'report',
      letter: '6',
      heroTitle: 'Final Report',
      title: '최종보고서',
      subtitle: '작성한 모든 내용을 통합하여 최종 보고서를 생성합니다',
      image:
        'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1600&q=80',
    },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-seed-light/5">
        <div className="max-w-[1580px] mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Sprout className="h-20 w-20 text-secondary leaf-sway" />
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full animate-pulse flex items-center justify-center">
                  <Leaf className="h-3 w-3 text-secondary" />
                </div>
              </div>
            </div>

            <h1 className="text-5xl font-bold mb-6">
              <span className="text-primary">
                지속가능한 미래를 위한
              </span>
              <br />
              <span className="text-foreground">스마트 보고서 플랫폼</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              IFRSseed와 함께 ESG 경영의 새로운 기준을 만들어보세요.
              AI 기반 문서 생성부터 데이터 시각화까지, 전문적인 지속가능경영 보고서를 쉽고 빠르게 작성할 수 있습니다.
            </p>

            <Button
              onClick={() => onNavigate('company')}
              size="lg"
              className="bg-primary hover:bg-primary-glow text-white px-8 py-4 text-lg font-semibold shadow-seed seed-grow"
            >
              지금 시작하기
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-20 left-10 opacity-20">
          <Leaf className="h-12 w-12 text-secondary leaf-sway" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="absolute top-40 right-20 opacity-20">
          <Sprout className="h-8 w-8 text-secondary leaf-sway" style={{ animationDelay: '1s' }} />
        </div>
        <div className="absolute bottom-20 left-1/4 opacity-20">
          <TreePine className="h-10 w-10 text-secondary leaf-sway" style={{ animationDelay: '1.5s' }} />
        </div>
      </div>

      {/* Area & Ambition (moved to come right after Hero) */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center px-8 py-2 rounded-full border-2 border-primary/60 text-primary font-semibold">
              Area &amp; Ambition
            </div>
          </div>
          <div className="text-center mb-14">
            <p className="text-xl font-semibold text-foreground">
              “IFRSseed는 ESG 보고서 작성을 위한 6개의 핵심 기능으로 구성되어 있습니다.”
            </p>
            <div className="w-48 h-[3px] bg-primary/20 mx-auto mt-4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {ambitionCards.map((c) => (
              <div
                key={c.tabId}
                className="group cursor-pointer"
                onClick={() => onNavigate(c.tabId)}
              >
                <div className="rounded-2xl overflow-hidden shadow-sm border border-border">
                  <div className="relative h-56">
                    <Image
                      src={c.image}
                      alt={c.title}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      priority={false}
                    />
                    <div className="absolute inset-0 bg-black/25" />
                    <div className="absolute top-4 left-4 text-white text-4xl font-black drop-shadow">
                      {c.letter}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <div className="text-white text-2xl font-bold drop-shadow">
                        {c.heroTitle}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-border rounded-2xl -mt-6 mx-4 p-6 shadow-sm group-hover:shadow-md transition-shadow">
                  <div className="text-xl font-bold text-foreground">
                    {c.title}
                  </div>
                  <div className="text-muted-foreground mt-2">
                    {c.subtitle}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Panels */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            통합 솔루션으로 완성하는 ESG 보고서
          </h2>
          <p className="text-lg text-muted-foreground">
            핵심 기능으로 전문적인 지속가능경영 보고서를 완성하세요
          </p>
        </div>

        {/* 첫 번째 섹션: 회사정보, 스마트 문단생성 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {mainPanels.map((panel, index) => {
            const Icon = panel.icon;
            return (
              <Card
                key={panel.id}
                className="group relative overflow-hidden border border-border hover:border-primary/25 transition-all duration-300 hover:shadow-seed cursor-pointer bg-muted/40"
                onClick={() => onNavigate(panel.id)}
              >
                <CardHeader className="relative z-10 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-primary text-white group-hover:scale-110 transition-transform duration-300 shadow-sm">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="text-2xl font-bold text-muted-foreground/30">
                      0{index + 1}
                    </div>
                  </div>

                  <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                    {panel.title}
                  </CardTitle>

                  <CardDescription className="leading-relaxed text-muted-foreground">
                    {panel.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="relative z-10">
                  <ul className="space-y-2 mb-6">
                    {panel.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 bg-secondary rounded-full mr-3 group-hover:bg-accent transition-colors duration-300"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant="outline"
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300"
                  >
                    시작하기
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 두 번째 섹션: ESG 시각화 도구 (E, S, G) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {esgPanels.map((panel) => {
            const Icon = panel.icon;
            return (
              <Card
                key={panel.id}
                className="group relative overflow-hidden border border-border hover:border-primary/25 transition-all duration-300 hover:shadow-seed cursor-pointer bg-muted/40"
                onClick={() => {
                  sessionStorage.setItem('chartsInitialTab', panel.esgTab);
                  onNavigate('charts');
                }}
              >
                <CardHeader className="relative z-10 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-primary text-white group-hover:scale-110 transition-transform duration-300 shadow-sm">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="text-2xl font-bold text-muted-foreground/30">
                      {panel.esgTab === 'environmental' ? 'E' : panel.esgTab === 'social' ? 'S' : 'G'}
                    </div>
                  </div>

                  <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                    {panel.title}
                  </CardTitle>

                  <CardDescription className="leading-relaxed text-muted-foreground">
                    {panel.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="relative z-10">
                  <ul className="space-y-2 mb-6">
                    {panel.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 bg-secondary rounded-full mr-3 group-hover:bg-accent transition-colors duration-300"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant="outline"
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300"
                  >
                    시작하기
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}