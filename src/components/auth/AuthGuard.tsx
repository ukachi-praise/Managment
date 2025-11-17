
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
    // Wait until the initial loading is complete before doing any checks.
    if (isLoading) {
      return;
    }

    const isAuthPage = pathname === '/login' || pathname === '/admin/login';
    const userRole = user?.role;

    if (!user) {
      // If user is not logged in and not on an auth page, redirect them.
      const targetLogin = allow.includes('Admin') ? '/admin/login' : '/login';
       if (pathname !== targetLogin) {
         router.replace(targetLogin);
      }
    } else {
      // User is logged in.
      if (userRole && allow.includes(userRole)) {
        // If user has the correct role and is on a login page, redirect to their dashboard.
        if (isAuthPage) {
          const dashboard = userRole === 'Admin' ? '/admin/dashboard' : '/teacher/dashboard';
          router.replace(dashboard);
        }
      } else {
        // If user's role is not allowed for this route, send them to unauthorized page.
        router.replace('/unauthorized');
      }
    }
  }, [isLoading, user, allow, router, pathname]);

  // While loading, show a full-screen loader to prevent flash of content.
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Verifying permissions...</span>
      </div>
    );
  }
  
  // If user has the correct role OR if it's an authentication page (and user is not logged in), render children.
  // This prevents the login page from being blank while AuthGuard logic runs.
  if ((user?.role && allow.includes(user.role)) || (!user && (pathname === '/login' || pathname === '/admin/login'))) {
      return <>{children}</>;
  }

  // In all other cases (e.g., redirecting), show a loader.
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
