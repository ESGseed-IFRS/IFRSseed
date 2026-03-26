import { Lock, Mail, MessageCircle, Globe, BadgeCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginPage() {
  const handleGoogleLogin = async () => {
    try {
      const response = await fetch("http://localhost:8080/api/user/google/login", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        // 구글 로그인 페이지로 리다이렉트
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          console.error('구글 인증 URL을 받지 못했습니다.');
          alert('로그인에 실패했습니다. 다시 시도해주세요.');
        }
      } else {
        console.error('구글 로그인 URL 요청 실패:', response.statusText);
        alert('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('구글 로그인 에러:', error);
      alert('로그인 중 오류가 발생했습니다.');
    }
  };

  const handleKakaoLogin = async () => {
    try {
      const response = await fetch("http://localhost:8080/api/user/kakao/login", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        // 카카오 로그인 페이지로 리다이렉트
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          console.error('카카오 인증 URL을 받지 못했습니다.');
          alert('로그인에 실패했습니다. 다시 시도해주세요.');
        }
      } else {
        console.error('카카오 로그인 URL 요청 실패:', response.statusText);
        alert('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('카카오 로그인 에러:', error);
      alert('로그인 중 오류가 발생했습니다.');
    }
  };

  const handleNaverLogin = async () => {
    try {
      const response = await fetch("http://localhost:8080/api/user/naver/login", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        // 네이버 로그인 페이지로 리다이렉트
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          console.error('네이버 인증 URL을 받지 못했습니다.');
          alert('로그인에 실패했습니다. 다시 시도해주세요.');
        }
      } else {
        console.error('네이버 로그인 URL 요청 실패:', response.statusText);
        alert('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('네이버 로그인 에러:', error);
      alert('로그인 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background">
      <div className="w-full max-w-2xl px-8">
        <Card className="shadow-seed py-6 px-8">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Lock className="h-7 w-7 text-primary" />
              <span>로그인</span>
            </CardTitle>
            <CardDescription className="text-base mt-2">
              이메일과 비밀번호 또는 소셜 계정으로 IFRSseed에 접속하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-medium">이메일</Label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </span>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className="pl-9 h-11 text-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="password" className="text-sm font-medium">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                className="h-11 text-sm"
              />
            </div>

            <Button className="w-full h-11 text-sm font-semibold seed-grow">
              이메일로 로그인
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs text-muted-foreground">
                <span className="bg-card px-2">또는 소셜 계정으로 시작하기</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Google 로그인 */}
              <Button
                variant="outline"
                className="w-full h-11 text-sm justify-start border border-border bg-white hover:bg-muted"
                onClick={handleGoogleLogin}
              >
                <Globe className="mr-3 h-5 w-5 text-[#4285F4]" />
                <span className="mx-auto text-sm font-medium">Google로 시작하기</span>
              </Button>

              {/* Kakao 로그인 */}
              <Button
                className="w-full h-11 text-sm justify-start bg-[#FEE500] hover:bg-[#FADA0A] text-black"
                onClick={handleKakaoLogin}
              >
                <MessageCircle className="mr-3 h-5 w-5 text-black" />
                <span className="mx-auto text-sm font-medium">카카오로 시작하기</span>
              </Button>

              {/* Naver 로그인 */}
              <Button
                className="w-full h-11 text-sm justify-start bg-[#03C75A] hover:bg-[#02b350] text-white"
                onClick={handleNaverLogin}
              >
                <BadgeCheck className="mr-3 h-5 w-5 text-white" />
                <span className="mx-auto text-sm font-medium">네이버로 시작하기</span>
              </Button>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <button className="hover:text-primary transition-colors">
                비밀번호를 잊으셨나요?
              </button>
              <button className="hover:text-primary transition-colors">
                아직 계정이 없으신가요?
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


