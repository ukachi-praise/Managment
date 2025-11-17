
'use client';

import Image from 'next/image';
import { AdminLoginForm } from '@/components/auth/admin-login-form';
import { Logo } from '@/components/shared/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useAuth } from '@/firebase/provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';


export default function AdminLoginPage() {
  const { user, isLoggedIn, isLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (isLoading) {
      return; // Wait until user state is resolved
    }

    if (isLoggedIn) {
        if (user?.role === 'Admin') {
            // If user is already an admin, send them to the dashboard
            router.replace('/admin/dashboard');
        } else {
            // If a non-admin is logged in, log them out before showing the admin login form
            if(auth) {
                signOut(auth);
                toast({
                    variant: 'destructive',
                    title: 'Access Denied',
                    description: 'You have been logged out. Please sign in with an admin account.',
                });
            }
        }
    }
    // If not logged in, the component will render the login form below
  }, [isLoading, isLoggedIn, user, router, auth, toast]);

  // Show a loader while checking auth state or if a redirect is happening.
  if (isLoading || (isLoggedIn && user?.role === 'Admin')) {
    return (
       <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Loading...</span>
      </div>
    );
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
