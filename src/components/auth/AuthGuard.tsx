'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
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
  const auth = useAuth();
  const firestore = useFirestore();
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading');

  useEffect(() => {
    if (!auth || !firestore) {
      // Services not ready, wait.
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        // Not logged in, redirect to appropriate login page
        const loginPath = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
        router.replace(loginPath);
        // No need to set status, redirect will unmount this component
        return;
      }

      try {
        const userDocRef = doc(firestore, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userRole = (userDoc.data().role as string)?.toLowerCase();
          if (allow.includes(userRole as "admin" | "teacher")) {
            setStatus('allowed');
          } else {
            // User has a role, but it's not allowed for this route
            setStatus('denied');
            router.replace("/unauthorized");
          }
        } else {
          // User is authenticated but has no role document in Firestore
          setStatus('denied');
          router.replace("/unauthorized");
        }
      } catch (error) {
        console.error("Error checking user role:", error);
        setStatus('denied');
        router.replace("/login"); // Redirect to login on error
      }
    });

    return () => unsub();
  }, [router, allow, auth, firestore]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Checking permissions...</span>
      </div>
    );
  }

  if (status === 'allowed') {
      return <>{children}</>;
  }

  // If status is 'denied', we show a loader while redirecting.
  // This prevents flashing the 'denied' page content before the redirect happens.
  return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
  );
}
