
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
    // Don't do anything until the user's auth state is fully loaded
    if (isLoading) {
      return;
    }

    const userRole = user?.role;
    const isAllowed = userRole && allow.includes(userRole);
    
    const isAdminRoute = pathname.startsWith('/admin');
    const isTeacherRoute = pathname.startsWith('/teacher');
    
    // Determine target login page based on the route prefix
    const targetLogin = isAdminRoute ? '/admin/login' : '/login';

    // If user is not logged in, redirect them to the correct login page.
    if (!user) {
      if (pathname !== targetLogin) {
          router.replace(targetLogin);
      }
      return;
    }

    // If user is logged in but does not have the required role, redirect to unauthorized.
    if (!isAllowed) {
        // Prevent redirect loop if already on an auth page or unauthorized page
        if (pathname !== '/unauthorized' && !pathname.endsWith('/login')) {
            router.replace('/unauthorized');
        }
        return;
    }

    // If a logged-in and authorized user tries to access a login page,
    // redirect them to their respective dashboard.
    const isAuthPage = pathname === '/login' || pathname === '/admin/login';
    if (isAuthPage && isAllowed) {
        const dashboard = userRole === 'Admin' ? '/admin/dashboard' : '/teacher/dashboard';
        router.replace(dashboard);
        return;
    }

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
