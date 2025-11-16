
'use client';

import { ReactNode } from 'react';
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

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // If done loading and still no user, redirect to login
    router.replace('/login');
    return ( // Return loader while redirecting
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  const userRole = (user.role as string)?.toLowerCase();
  if (!allow.includes(userRole as "admin" | "teacher")) {
    // User has a role, but it's not allowed for this route
    router.replace('/unauthorized');
    return ( // Return loader while redirecting
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  // If all checks pass, render the children
  return <>{children}</>;
}
