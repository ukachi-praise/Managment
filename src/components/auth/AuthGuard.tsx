
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
    // Don't do anything until the initial user loading is complete.
    if (isLoading) {
      return;
    }

    // Determine the correct login path based on the allowed roles for this route.
    const targetLogin = allow.includes('Admin') ? '/admin/login' : '/login';

    // If loading is finished and there's no user, they are not logged in.
    if (!user) {
      // *** FIX: Only redirect if we are NOT already on the target login page. ***
      if(pathname !== targetLogin) {
        router.replace(targetLogin);
      }
      return;
    }

    // At this point, user is not null. Check their role.
    const userRole = user?.role;

    if (userRole && allow.includes(userRole)) {
      // Role is allowed, user can stay.
      // If a logged-in user with the correct role somehow lands on a login page, send them to their dashboard.
      if (pathname === '/login' || pathname === '/admin/login') {
          const dashboard = userRole === 'Admin' ? '/admin/dashboard' : '/teacher/dashboard';
          router.replace(dashboard);
      }
    } else {
      // User is logged in, but their role is not allowed for this route.
      router.replace('/unauthorized');
    }
    
  }, [isLoading, user, allow, router, pathname]);


  // While the initial user state is loading, show a full-screen loader.
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Verifying permissions...</span>
      </div>
    );
  }
  
  // Render the protected children only if the user is logged in with the correct role.
  // This prevents a flash of incorrect content.
  if (user?.role && allow.includes(user.role)) {
    return <>{children}</>;
  }

  // Otherwise, show a loader while redirecting.
  return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
  );
}
