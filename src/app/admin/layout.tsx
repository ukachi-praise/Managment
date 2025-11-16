
'use client';

import { Header } from '@/components/shared/header';
import { SidebarNav } from '@/components/shared/sidebar-nav';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
    <div className="flex min-h-screen">
        <SidebarNav role="admin" />
        <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
    </div>
    </SidebarProvider>
  );
}
