'use client';

import { useState, useEffect } from 'react';
import { Navigation } from "@/components/Navigation";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('사용자 정보 파싱 실패:', e);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      <main>{children}</main>
    </div>
  );
}
