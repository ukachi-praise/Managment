
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

  const isAuthPage = pathname === '/login' || pathname === '/admin/login';

  useEffect(() => {
    // Don't do anything until the user's auth state is fully loaded
    if (isLoading) {
      return;
    }

    const userRole = user?.role;
    const isAllowed = userRole && allow.includes(userRole);

    // If user is not logged in, redirect them to the correct login page
    if (!user) {
      const targetLogin = allow.includes('Admin') ? '/admin/login' : '/login';
      // Only redirect if they aren't already on an auth page
      if (!isAuthPage) {
        router.replace(targetLogin);
      }
      return;
    }

    // If a logged-in user is on a login page, redirect them to their dashboard
    if (user && isAuthPage && isAllowed) {
      const dashboard = userRole === 'Admin' ? '/admin/dashboard' : '/teacher/dashboard';
      router.replace(dashboard);
      return;
    }
    
    // If user is logged in but not allowed for this route, redirect to unauthorized
    if (user && !isAllowed && !isAuthPage) {
        router.replace('/unauthorized');
    }

  }, [isLoading, user, pathname, router, allow, isAuthPage]);


  // While loading, show a full-screen loader to prevent content flashing
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Verifying permissions...</span>
      </div>
    );
  }

  // If we are on an auth page, render it while useEffect handles potential redirects.
  if (isAuthPage) {
    return <>{children}</>;
  }
  
  // For protected routes, only render children if user is fully loaded and allowed.
  // The useEffect handles the redirection, so we can conditionally render here.
  if (user && user.role && allow.includes(user.role)) {
    return <>{children}</>;
  }

  // In the moments before a redirect, show the loading screen
  // to prevent rendering a page the user shouldn't see.
  return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
  );
}
