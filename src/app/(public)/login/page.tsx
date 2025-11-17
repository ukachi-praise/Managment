
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
  // This page should be simple. Its only job is to show the login form.
  // Redirection logic for logged-in users should be handled by AuthGuards on protected pages.
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // If a logged-in user lands here, the AuthGuard on their dashboard will handle the redirect.
    // This prevents this page from causing conflicting redirects.
    if (!isLoading && user) {
        // A user is logged in, redirect them away from the generic login page.
        const dashboardPath = user.role === 'Admin' ? '/admin/dashboard' : '/teacher/dashboard';
        router.replace(dashboardPath);
    }
  }, [user, isLoading, router]);


  // Show a loader while checking auth state or if a redirect is in progress.
  if (isLoading || user) {
      return (
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
  }

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
