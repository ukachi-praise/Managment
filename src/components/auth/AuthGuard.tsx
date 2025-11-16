
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
  allow: ("Admin" | "Teacher")[];
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
        setLoading(false); 
        const loginPath = pathname.startsWith('/admin') ? '/admin/login' : '/login';
        router.replace(loginPath);
        return;
      }

      if (!firestore) {
         console.error("Firestore is not available for permission check.");
         setLoading(false);
         router.replace("/unauthorized");
         return;
      }

      try {
        const snap = await getDoc(doc(firestore, "users", user.uid));
        if (!snap.exists() || !allow.includes(snap.data().role as "Admin" | "Teacher")) {
          setLoading(false);
          router.replace("/unauthorized");
          return;
        }

        setLoading(false); // auth + role OK
      } catch (e) {
          console.error("Permission check failed:", e);
          setLoading(false);
          router.replace('/login');
      }
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
  
  return <>{children}</>;
}
