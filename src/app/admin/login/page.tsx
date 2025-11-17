
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
  const { user, isLoggedIn, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isLoggedIn && user?.role === 'Admin') {
      router.replace('/admin/dashboard');
    }
  }, [isLoading, isLoggedIn, user, router]);

  if (isLoading || (!isLoading && isLoggedIn && user?.role === 'Admin')) {
    return (
       <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

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
