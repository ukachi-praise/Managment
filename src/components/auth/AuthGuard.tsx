
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase/provider';
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
  const { auth, firestore, isCoreLoading, user, isUserLoading } = useFirebase();
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    // Exclude login pages from the auth guard logic
    if (pathname.endsWith('/login')) {
      setLoading(false);
      return;
    }

    // Don't do anything until Firebase is ready and the initial user state is known.
    if (isCoreLoading || isUserLoading) {
      return;
    }

    const checkPermissions = async () => {
      if (!user) {
        setLoading(false); // Stop loader before redirect
        // Depending on the route, redirect to the correct login page
        const loginPath = pathname.startsWith('/admin') ? '/admin/login' : '/login';
        router.replace(loginPath);
        return;
      }

      if (!firestore) {
         console.error("Firestore is not available for permission check.");
         setLoading(false); // Stop loader before redirect
         router.replace("/unauthorized");
         return;
      }

      const snap = await getDoc(doc(firestore, "users", user.uid));

      if (!snap.exists()) {
        console.error("User document not found for uid:", user.uid);
        setLoading(false); // Stop loader before redirect
        router.replace("/unauthorized");
        return;
      }

      const role = (snap.data().role as "Admin" | "Teacher")?.toLowerCase();

      if (!role || !allow.includes(role as "admin" | "teacher")) {
        setLoading(false); // Stop loader before redirect
        router.replace("/unauthorized");
        return;
      }

      // If all checks pass, user is allowed
      setLoading(false);
    };

    checkPermissions();

  }, [router, allow, auth, firestore, user, isCoreLoading, isUserLoading, pathname]);


  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Checking permissions...</span>
      </div>
    );
  }

  // If we are not loading and on a login page, we shouldn't render children
  // as the redirect should have already been queued. This prevents flicker.
  // The main check handles the redirect itself. We render children only when loading is done AND it's not a login page.
  if (pathname.endsWith('/login')) {
    return null;
  }
  
  return <>{children}</>;
}
