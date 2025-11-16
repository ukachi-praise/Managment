
'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/provider';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({
  children,
  allow,
}: {
  children: ReactNode;
  allow: ("admin" | "teacher")[];
}) {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // If finished loading and there's no user, redirect to login
    if (!isLoading && !user) {
      router.replace('/login');
      return; // Stop execution
    }

    // If user is loaded, check their role
    if (user) {
      const userRole = (user.role as string)?.toLowerCase();
      if (!allow.includes(userRole as "admin" | "teacher")) {
        // Role is not allowed, redirect to unauthorized
        router.replace('/unauthorized');
      }
    }
    // If still loading, do nothing and wait for user state to resolve.
    // If user is loaded and role is allowed, do nothing and let content render.

  }, [user, isLoading, router, allow]);


  // Show loading indicator while checking auth state
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If user is loaded and has a valid role, show the children
  if (user && allow.includes((user.role as string)?.toLowerCase() as any)) {
      return <>{children}</>;
  }

  // Fallback loader while redirecting
  return (
    <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
