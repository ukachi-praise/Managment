
'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import { Header } from '@/components/shared/header';
import { SidebarNav } from '@/components/shared/sidebar-nav';
import { SidebarProvider } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Don't apply the main layout to the login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <AuthGuard allow={['Admin']}>
      <SidebarProvider>
        <div className="flex min-h-screen">
            <SidebarNav role="admin" />
            <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-4 sm:p-6">{children}</main>
            </div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
