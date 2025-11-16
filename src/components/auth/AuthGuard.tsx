
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase/provider';
import { Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';

export default function AuthGuard({
  children,
  allow,
}: {
  children: ReactNode;
  allow: ("admin" | "teacher")[];
}) {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (isUserLoading) {
      return; // Wait for user loading to complete
    }

    if (!user) {
      router.replace('/login');
      return;
    }

    // Hardcode the specified admin user
    if (user.uid === 'GOpbb9SsavhpATk1p0KNmPGGQ0S2') {
      if (allow.includes('admin')) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        router.replace('/unauthorized');
      }
      return;
    }

    // Hardcode the specified teacher user
    if (user.uid === 'u3krP4g02DgPJ6Avv1XhVNvvb8R2') {
        if (allow.includes('teacher')) {
            setIsAuthorized(true);
        } else {
            setIsAuthorized(false);
            router.replace('/unauthorized');
        }
        return;
    }

    // For all other users, check their role from Firestore
    const checkRole = async () => {
      if (!firestore) return;
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userRole = (userDoc.data().role as string)?.toLowerCase();
        if (allow.includes(userRole as "admin" | "teacher")) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
          router.replace('/unauthorized');
        }
      } else {
        // No role document found
        setIsAuthorized(false);
        router.replace('/unauthorized');
      }
    };

    checkRole();
  }, [user, isUserLoading, router, allow, firestore]);

  if (isAuthorized === null || isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthorized) {
    return <>{children}</>;
  }

  // Fallback while redirecting
  return (
    <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
