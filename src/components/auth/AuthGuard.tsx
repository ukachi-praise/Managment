
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

  // **STEP 1: PERMANENT FIX - HALT EXECUTION ON LOGIN PAGE**
  // If we are on an authentication page and the user state is still loading,
  // or if there is no user, we should just render the page itself and stop.
  // This prevents a loading screen from flashing or a redirect loop from starting.
  if (isAuthPage && (isLoading || !user)) {
    return <>{children}</>;
  }

  // **STEP 2: Handle Loading State (for all other pages)**
  // If we are not on an auth page and still loading, show a full-screen loader.
  // This protects protected routes from flashing their content.
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Verifying permissions...</span>
      </div>
    );
  }

  // **STEP 3: Handle Redirects (now that loading is complete)**
  if (!user) {
    // If there's no user AND we are not on an auth page, redirect to the correct login.
    // This is safe because the isLoading check has passed.
    const targetLogin = allow.includes('Admin') ? '/admin/login' : '/login';
    if (!isAuthPage) {
        router.replace(targetLogin);
    }
    return null; // Do not render children while redirecting.
  }

  // At this point, we have a user.
  const userRole = user?.role;
  const isAllowed = userRole && allow.includes(userRole);

  if (isAuthPage && isAllowed) {
    // If the user is on a login page but is already logged in and allowed,
    // redirect them to their dashboard.
    const dashboard = userRole === 'Admin' ? '/admin/dashboard' : '/teacher/dashboard';
    router.replace(dashboard);
    return null; // Do not render the login page while redirecting.
  }
  
  if (!isAllowed && !isAuthPage) {
    // If the user is not allowed for this route, and it's not a login page,
    // send them to the unauthorized page.
    router.replace('/unauthorized');
    return null;
  }
  
  // **STEP 4: Render the content if all checks pass**
  return <>{children}</>;
}
