
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
    // 1. Wait until authentication state is fully resolved.
    if (isLoading) {
      return;
    }

    const userRole = user?.role;
    const isLoginPage = pathname.endsWith('/login');

    // 2. If user is not logged in:
    if (!user) {
      const targetLogin = pathname.startsWith('/admin') ? '/admin/login' : '/login';
      // If not already on the correct login page, redirect.
      if (pathname !== targetLogin) {
        router.replace(targetLogin);
      }
      return;
    }

    // 3. If user IS logged in:
    const isAllowed = userRole && allow.includes(userRole);

    // If they try to access a login page, redirect to their dashboard.
    if (isLoginPage) {
      const dashboard = userRole === 'Admin' ? '/admin/dashboard' : '/teacher/dashboard';
      router.replace(dashboard);
      return;
    }
    
    // If they are on a protected page but don't have the role, send to unauthorized.
    if (!isAllowed) {
      router.replace('/unauthorized');
      return;
    }
    
    // If they are allowed, nothing happens, and the page renders.

  }, [isLoading, user, pathname, router, allow]);


  // While loading, show a full-screen loader to prevent content flashing
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Verifying permissions...</span>
      </div>
    );
  }

  // If user is loaded and has the correct role for the current section, render children.
  // The useEffect handles all redirection logic.
  if (user && user.role && allow.includes(user.role)) {
    return <>{children}</>;
  }
  
  // In the moments before a redirect, or if user state is indeterminate, show the loader.
  // This prevents rendering a page the user shouldn't see.
  return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
  );
}
