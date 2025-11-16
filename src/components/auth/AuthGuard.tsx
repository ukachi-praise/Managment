'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
        // This can happen briefly on initial load.
        // The useAuth hook will trigger a re-render once auth is available.
        return;
    };
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Redirect to the appropriate login page based on the path
        const loginPath = pathname.startsWith('/admin') ? '/admin/login' : '/login';
        router.replace(loginPath);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, auth, pathname]);

  if (loading) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return <>{children}</>;
}
