
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const { user, isLoading, isLoggedIn } = useUser();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Don't do anything until the initial user loading is complete.
    if (isLoading) {
      return;
    }

    // If loading is finished and there's still no user, they are not logged in.
    if (!isLoggedIn) {
      router.replace('/login');
      return; // Stop execution
    }

    // At this point, user is not null. Check their role.
    const userRole = user?.role;

    if (userRole && allow.includes(userRole)) {
      // Role is allowed, authentication check is complete.
      setAuthChecked(true);
    } else {
      // User is logged in, but their role is not allowed for this route.
      router.replace('/unauthorized');
    }
    
  }, [isLoading, isLoggedIn, user, allow, router]);


  // While the initial user state is loading or we are waiting for the permission check to complete,
  // show a full-screen loader.
  if (!authChecked) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Verifying permissions...</span>
      </div>
    );
  }
  
  // Once auth is checked and permissions are verified, render the protected children.
  return <>{children}</>;
}
