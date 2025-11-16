
'use client';

import { Header } from '@/components/shared/header';
import { SidebarNav } from '@/components/shared/sidebar-nav';
import { SidebarProvider } from '@/components/ui/sidebar';
<<<<<<< HEAD
import { usePathname } from 'next/navigation';

=======
import AuthGuard from '@/components/auth/AuthGuard';
>>>>>>> b047767e425d742f4ec4c87b1f5d03a30785ff8a

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
<<<<<<< HEAD
=======
    <AuthGuard allow={["Teacher", "Admin"]}>
>>>>>>> b047767e425d742f4ec4c87b1f5d03a30785ff8a
      <SidebarProvider>
        <div className="flex min-h-screen">
          <SidebarNav role="teacher" />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </SidebarProvider>
  );
}
