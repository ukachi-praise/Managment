'use client';

import { Header } from '@/components/shared/header';
import { SidebarNav } from '@/components/shared/sidebar-nav';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useUser } from '@/firebase';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  
  // A simple check to redirect unauthenticated users
  useEffect(() => {
    if (!isUserLoading && !user) {
      redirect('/login');
    }
  }, [user, isUserLoading]);

  if (isUserLoading || !user) {
    return (
        <div className="flex min-h-screen">
          <div className="w-56 hidden md:block border-r p-4 space-y-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="flex-1 flex flex-col">
              <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
                <div className="flex-1" />
                <Skeleton className="h-9 w-9 rounded-full" />
              </header>
              <main className="flex-1 p-4 sm:p-6">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-64 w-full mt-6" />
              </main>
          </div>
        </div>
    );
  }

  return (
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
