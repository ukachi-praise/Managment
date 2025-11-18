
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/firebase/provider';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow: ("Admin" | "Teacher")[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (isLoading) {
      return; // Wait until authentication state is resolved.
    }

    const userRole = user?.role;
    const isAdminRoute = pathname.startsWith('/admin');
    const isTeacherRoute = pathname.startsWith('/teacher');

    // 1. If user is not logged in, redirect to the correct login page.
    if (!user) {
      const targetLogin = isAdminRoute ? '/admin/login' : '/login';
      if (pathname !== targetLogin) {
        router.replace(targetLogin);
      }
      return;
    }

    // 2. If user IS logged in:
    const isAllowed = userRole && allow.includes(userRole);

    // If they are on a login page, redirect them to their correct dashboard.
    if (pathname.endsWith('/login')) {
      const dashboard = userRole === 'Admin' ? '/admin/dashboard' : '/teacher/dashboard';
      router.replace(dashboard);
      return;
    }

    // If they are on a page for a different role (e.g., Teacher on /admin), redirect them.
    if ((isAdminRoute && userRole === 'Teacher') || (isTeacherRoute && userRole === 'Admin')) {
       const correctDashboard = userRole === 'Admin' ? '/admin/dashboard' : '/teacher/dashboard';
       router.replace(correctDashboard);
       return;
    }
    
    // If they are on a protected page but don't have an allowed role, send to unauthorized.
    if (!isAllowed) {
      router.replace('/unauthorized');
      return;
    }
    
    // If all checks pass, they are allowed to see the page.

  }, [isLoading, user, pathname, router, allow]);


  // While loading, show a full-screen loader.
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Verifying permissions...</span>
      </div>
    );
  }

  // If user is loaded and has the correct role, render the children.
  // The useEffect handles all redirection logic.
  if (user && user.role && allow.includes(user.role)) {
    return <>{children}</>;
  }
  
  // As a fallback, show the loader. This covers edge cases during redirects.
  return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
  );
}
