
'use client';

import Image from 'next/image';
import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/shared/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase/provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { user, isLoggedIn, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // If the auth state is still loading, do nothing.
    if (isLoading) {
      return;
    }

    // Once loading is complete, if the user is logged in, redirect them.
    if (isLoggedIn && user) {
      const dashboard = user.role === 'Admin' ? '/admin/dashboard' : '/teacher/dashboard';
      router.replace(dashboard);
    }
  }, [isLoading, isLoggedIn, user, router]);

  // Show a loader while the auth state is being determined or if a redirect is in progress.
  if (isLoading || (isLoggedIn && user)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  // Only render the login form if not loading and not logged in.
  return (
    <div className="relative min-h-screen w-full">
      <Image
        src="/Logo.jpg"
        alt="Background"
        fill
        className="object-cover opacity-5"
      />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="text-center">
                 <div className="mb-4 flex justify-center">
                    <Logo className="text-2xl text-primary" />
                </div>
                <CardTitle className="text-2xl">Welcome Back!</CardTitle>
                <CardDescription>Enter your credentials to access your account.</CardDescription>
            </CardHeader>
            <CardContent>
                <LoginForm />
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
