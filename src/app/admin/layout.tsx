
'use client';

import { Header } from '@/components/shared/header';
import { SidebarNav } from '@/components/shared/sidebar-nav';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useUser } from '@/firebase';
import { redirect, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Only redirect on the client side after the initial loading is complete
    if (isClient && !isUserLoading && !user && pathname !== '/admin/login') {
      redirect('/admin/login');
    }
  }, [user, isUserLoading, isClient, pathname]);
  
  // Show a skeleton loader on the initial client render or while fetching the user
  if (!isClient || isUserLoading) {
     return (
        <div className="flex min-h-screen">
          <div className="w-56 hidden md:block border-r p-4 space-y-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
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

  // If we're done loading and there's no user, render nothing to allow redirect to complete
  if (!user) {
    return null;
  }

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
