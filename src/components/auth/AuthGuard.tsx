
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
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
  const auth = useAuth();
  const firestore = useFirestore();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!auth || !firestore) {
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Depending on the route, redirect to the correct login page
        const loginPath = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
        router.replace(loginPath);
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
        setAllowed(true);
      }
    });

    return () => unsub();
  }, [router, allow, auth, firestore]);

  if (allowed === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Checking permissions...</span>
      </div>
    );
  }

  return <>{children}</>;
}
