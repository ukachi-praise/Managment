
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useFirestore, useFirebase } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';

export default function AuthGuard({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow: ("admin" | "teacher")[];
}) {
  const router = useRouter();
  const { auth, firestore, isCoreLoading, isUserLoading, user } = useFirebase();
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    // Exclude login pages from the auth guard logic
    if (pathname.endsWith('/login')) {
      setIsCheckingPermissions(false);
      return;
    }

    // Don't do anything until Firebase is ready and the initial user state is known.
    if (isCoreLoading || isUserLoading) {
      return;
    }

    const checkPermissions = async () => {
      if (!user) {
        // Depending on the route, redirect to the correct login page
        const loginPath = pathname.startsWith('/admin') ? '/admin/login' : '/login';
        router.replace(loginPath);
        return;
      }

      if (!firestore) {
         console.error("Firestore is not available for permission check.");
         router.replace("/unauthorized");
         return;
      }

      const snap = await getDoc(doc(firestore, "users", user.uid));

      if (!snap.exists()) {
        console.error("User document not found for uid:", user.uid);
        router.replace("/unauthorized");
        return;
      }

      const role = snap.data().role as "Admin" | "Teacher";
      const lowerCaseRole = role.toLowerCase() as "admin" | "teacher";

      if (!allow.includes(lowerCaseRole)) {
        router.replace("/unauthorized");
      } else {
        setIsCheckingPermissions(false);
      }
    };

    checkPermissions();

  }, [router, allow, auth, firestore, user, isCoreLoading, isUserLoading, pathname]);

  // If the page is a login page, render it directly without a loader.
  if (pathname.endsWith('/login')) {
    return <>{children}</>;
  }

  if (isCheckingPermissions) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Checking permissions...</span>
      </div>
    );
  }

  return <>{children}</>;
}
