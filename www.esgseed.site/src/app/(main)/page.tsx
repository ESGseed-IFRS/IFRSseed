'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sprout, Leaf, TreePine, ArrowRight, Sparkles, Target, BarChart } from 'lucide-react';

export default function Home() {
  const mainPanels = [
    {
      id: 'company',
      title: '회사정보 관리',
      description: '지속가능경영을 위한 기업 기본정보와 ESG 데이터를 체계적으로 관리하세요',
      icon: TreePine,
      color: 'primary',
      href: '/company-info',
      features: ['기업 프로필 설정', 'ESG 목표 수립', '이해관계자 정보']
    },
    {
      id: 'content',
      title: '스마트 문단생성',
      description: 'AI 기반으로 전문적이고 일관성 있는 지속가능경영 보고서 문단을 자동 생성합니다',
      icon: Sparkles,
      color: 'secondary',
      href: '/content',
      features: ['AI 문단 생성', '템플릿 활용', '다국어 지원']
    },
    {
      id: 'charts',
      title: '시각화 도구',
      description: '복잡한 ESG 데이터를 직관적인 차트와 인포그래픽으로 변환하여 임팩트를 극대화하세요',
      icon: BarChart,
      color: 'accent',
      href: '/charts',
      features: ['데이터 시각화', '차트 생성', '인포그래픽 제작']
    }
  ];

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

            <Link href="/company-info">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary-glow text-white px-8 py-4 text-lg font-semibold shadow-seed seed-grow"
              >
                지금 시작하기
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
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

      {/* Main Panels */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            통합 솔루션으로 완성하는 ESG 보고서
          </h2>
          <p className="text-lg text-muted-foreground">
            세 가지 핵심 기능으로 전문적인 지속가능경영 보고서를 완성하세요
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {mainPanels.map((panel, index) => {
            const Icon = panel.icon;
            return (
              <Link key={panel.id} href={panel.href}>
                <Card
                  className="group relative overflow-hidden border-2 border-transparent hover:border-primary/20 transition-all duration-500 hover:shadow-seed cursor-pointer"
                >
                  <div className={`absolute inset-0 bg-primary opacity-5 group-hover:opacity-10 transition-opacity duration-500`}></div>

                  <CardHeader className="relative z-10 pb-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-xl bg-primary text-white group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="text-2xl font-bold text-muted-foreground/30">
                        0{index + 1}
                      </div>
                    </div>

                    <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                      {panel.title}
                    </CardTitle>

                    <CardDescription className="text-muted-foreground leading-relaxed">
                      {panel.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="relative z-10">
                    <ul className="space-y-2 mb-6">
                      {panel.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center text-sm text-muted-foreground">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 group-hover:bg-accent transition-colors duration-300"></div>
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
              </Link>
            );
          })}
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-seed-light/10 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-4">
              왜 IFRSseed를 선택해야 할까요?
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">정확성</h4>
              <p className="text-muted-foreground">IFRS 기준에 맞는 정확하고 신뢰할 수 있는 보고서 작성</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">효율성</h4>
              <p className="text-muted-foreground">AI 기반 자동화로 보고서 작성 시간을 90% 단축</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <Leaf className="h-8 w-8 text-white" />
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">지속가능성</h4>
              <p className="text-muted-foreground">ESG 경영의 핵심 가치를 반영한 미래지향적 솔루션</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
