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
  const { user, isLoading: isUserLoading } = useUser();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Don't do anything until Firebase core services are ready and the user state has been resolved.
    if (isCoreLoading || isUserLoading) {
      return;
    }

    const checkPermissions = async () => {
      if (!user) {
        router.replace('/login');
        return;
      }

      if (!firestore) {
         console.error("Firestore is not available for permission check.");
         router.replace("/unauthorized");
         return;
      }

      try {
        const snap = await getDoc(doc(firestore, "users", user.uid));
        const role = snap.data()?.role as "Admin" | "Teacher";

        if (!snap.exists() || !allow.includes(role)) {
          router.replace("/unauthorized");
          return;
        }
        
        // If all checks pass, mark auth as checked
        setAuthChecked(true);

      } catch (e) {
          console.error("Permission check failed:", e);
          router.replace('/login');
      }
    };

    checkPermissions();

  }, [router, allow, firestore, user, isCoreLoading, isUserLoading]);


  // Show loader until auth check is complete and successful
  if (!authChecked) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Verifying permissions...</span>
      </div>
    );
  }
  
  // Once auth is checked, render the children
  return <>{children}</>;
}
