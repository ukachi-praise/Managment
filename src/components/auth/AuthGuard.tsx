'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useUser } from '@/firebase/provider';
import { Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';

export default function AuthGuard({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow: ("Admin" | "Teacher")[];
}) {
  const router = useRouter();
  const { firestore, isCoreLoading } = useFirebase();
  const { user, isLoading: isUserLoading, isLoggedIn } = useUser();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Don't do anything until Firebase core services are ready and the initial user state has been resolved.
    if (isCoreLoading || isUserLoading) {
      return;
    }

    const checkPermissions = async () => {
      // If auth has finished loading and there's no user, redirect to login.
      if (!isLoggedIn) {
        router.replace('/login');
        return;
      }
      
      // If we have a user but firestore isn't ready for some reason, show an error.
      if (!firestore) {
         console.error("Firestore is not available for permission check.");
         router.replace("/unauthorized"); // Or a generic error page
         return;
      }

      try {
        const userDocRef = doc(firestore, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        const role = userDoc.data()?.role as "Admin" | "Teacher";

        // Also check hardcoded roles as a fallback
        const hardcodedRole = user.role;

        if (allow.includes(role) || allow.includes(hardcodedRole)) {
          // If all checks pass, mark auth as checked and allow rendering children
          setAuthChecked(true);
        } else {
          // If the role doesn't match, redirect.
          router.replace("/unauthorized");
        }
      } catch (e) {
          console.error("Permission check failed:", e);
          router.replace('/login');
      }
    };

    checkPermissions();

  }, [router, allow, firestore, user, isLoggedIn, isCoreLoading, isUserLoading]);


  // While the initial user state is loading, or we are waiting for the permission check to complete,
  // show a full-screen loader.
  if (isUserLoading || !authChecked) {
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
