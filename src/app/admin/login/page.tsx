
'use client';

import Image from 'next/image';
import { AdminLoginForm } from '@/components/auth/admin-login-form';
import { Logo } from '@/components/shared/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase/provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';


export default function AdminLoginPage() {
  const { user, isLoggedIn, isLoading, profileError } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return; // Wait until user state is resolved
    }

    if (isLoggedIn && !profileError) {
      const destination = user?.role === 'Admin' || user?.role === 'SuperAdmin'
        ? '/admin/dashboard'
        : user?.role === 'Teacher'
        ? '/teacher/dashboard'
        : '/unauthorized';
      router.replace(destination);
    }
    }, [isLoading, isLoggedIn, user, profileError, router]);

  // Show a loader while checking auth state or if a redirect is happening.
  if (isLoading || (isLoggedIn && !profileError)) {
    return (
       <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (profileError) {
    return <div className="flex min-h-screen items-center justify-center p-6 text-center"><div><h1 className="text-xl font-semibold text-destructive">Account profile unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Your account is authenticated, but its school profile could not be loaded. Please contact an administrator.</p></div></div>;
  }

  // Render the login form if not logged in, or if a non-admin was just logged out.
  return (
    <div className="relative min-h-screen w-full bg-muted">
      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="text-center">
                <div className="mb-4 flex justify-center">
                    <Logo className="text-2xl text-primary" />
                </div>
                <CardTitle className="text-2xl">Admin Access</CardTitle>
                <CardDescription>Enter your credentials to access the admin dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
                <AdminLoginForm />
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
