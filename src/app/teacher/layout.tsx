
'use client';

import { Header } from '@/components/shared/header';
import { SidebarNav } from '@/components/shared/sidebar-nav';
import { SidebarProvider } from '@/components/ui/sidebar';
import AuthGuard from '@/components/auth/AuthGuard';
import { usePathname } from 'next/navigation';


export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Login pages should not have the main layout
  if (pathname === '/login' || pathname === '/admin/login') {
      return <>{children}</>;
  }

  return (
    <AuthGuard>
      <SidebarProvider>
        <div className="flex min-h-screen">
          <SidebarNav role="teacher" />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
