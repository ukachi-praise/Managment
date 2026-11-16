
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
  const isReportPage = pathname.startsWith('/admin/results/') && !pathname.startsWith('/admin/results/entry/');

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <AuthGuard allow={['SuperAdmin', 'Admin']}>
      <SidebarProvider>
        <div className={`flex min-h-screen ${isReportPage ? 'print:block print:min-h-0' : ''}`}>
            <div className={isReportPage ? 'print:hidden' : undefined}>
              <SidebarNav role="admin" />
            </div>
            <div className="flex-1 flex flex-col">
            <div className={isReportPage ? 'print:hidden' : undefined}><Header /></div>
            <main className={`flex-1 p-4 sm:p-6 ${isReportPage ? 'print:p-0' : ''}`}>{children}</main>
            </div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
