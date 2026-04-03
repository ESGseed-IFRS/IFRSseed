"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function NaverCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('로그인 처리 중...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (!code || !state) {
      setStatus('인증 코드가 없습니다.');
      setTimeout(() => router.push('/'), 2000);
      return;
    }

    // 백엔드로 code와 state 전송 (POST)
    const loginWithNaver = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/user/naver/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ code, state }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('네이버 로그인 성공:', data);
          
          // 토큰을 sessionStorage에 저장
          if (data.accessToken) {
            sessionStorage.setItem('accessToken', data.accessToken);
            sessionStorage.setItem('user', JSON.stringify({
              email: data.email,
              name: data.name,
              nickname: data.nickname,
              profileImage: data.profileImage,
            }));
          }
          
          setStatus('로그인 성공! 홈으로 이동합니다...');
          setTimeout(() => router.push('/'), 1000);
        } else {
          const error = await response.json();
          console.error('네이버 로그인 실패:', error);
          setStatus('로그인에 실패했습니다.');
          setTimeout(() => router.push('/'), 2000);
        }
      } catch (error) {
        console.error('네이버 로그인 에러:', error);
        setStatus('로그인 중 오류가 발생했습니다.');
        setTimeout(() => router.push('/'), 2000);
      }
    };

    loginWithNaver();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}

