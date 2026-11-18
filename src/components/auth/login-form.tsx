
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useAuth, useFirestore } from '@/firebase/provider';
import { signInWithSessionPersistence } from '@/firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { logAuthDiagnostic, logAuthDiagnosticError } from '@/lib/auth-diagnostics';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const auth = useAuth();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (!auth || !firestore) {
        toast({ variant: 'destructive', title: 'Firebase not initialized.'});
        setIsLoading(false);
        return;
    }

    try {
        logAuthDiagnostic('email-password-authentication-started', { entryPoint: 'staff-login' });
        const userCredential = await signInWithSessionPersistence(auth, values.email, values.password);
        logAuthDiagnostic('email-password-authentication-succeeded', { entryPoint: 'staff-login', uidPresent: true });
        const profileRef = doc(firestore, 'users', userCredential.user.uid);
        logAuthDiagnostic('login-profile-path-constructed', { entryPoint: 'staff-login', path: 'users/{authenticatedUid}' });
        logAuthDiagnostic('login-profile-read-started', { entryPoint: 'staff-login', operation: 'getDocFromServer', path: 'users/{authenticatedUid}' });
        const profileSnapshot = await getDocFromServer(profileRef);
        logAuthDiagnostic('login-profile-read-completed', { entryPoint: 'staff-login', documentExists: profileSnapshot.exists() });
        const roleValue = profileSnapshot.exists() && typeof profileSnapshot.data().role === 'string'
          ? profileSnapshot.data().role.trim().toLowerCase()
          : '';
        const role = roleValue === 'teacher' ? 'Teacher' : roleValue === 'admin' ? 'Admin' : roleValue === 'superadmin' || roleValue === 'super admin' ? 'SuperAdmin' : null;
        logAuthDiagnostic('login-role-validation-completed', { entryPoint: 'staff-login', valid: Boolean(role), role });
        if (!profileSnapshot.exists() || !role) {
          logAuthDiagnosticError('login-profile-validation-failed', {
            code: !profileSnapshot.exists() ? 'not-found' : 'invalid-profile',
            message: !profileSnapshot.exists() ? 'Profile document does not exist.' : 'Profile role is not authorized.',
          }, { entryPoint: 'staff-login', path: 'users/{authenticatedUid}', documentExists: profileSnapshot.exists() });
          await auth.signOut();
          throw new Error('Your account profile is missing or does not have an authorized staff role.');
        }
        toast({ title: 'Login Successful', description: 'Redirecting...' });
        const destination = role === 'Teacher' ? '/teacher/dashboard' : '/admin/dashboard';
        logAuthDiagnostic('final-redirect-decision', { entryPoint: 'staff-login', decision: 'redirect', destination, role });
        router.push(destination);

    } catch (error: any) {
        logAuthDiagnosticError('staff-login-failed', error, { entryPoint: 'staff-login' });
        setIsLoading(false);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            toast({
                variant: 'destructive',
                title: 'Login Failed',
                description: 'Invalid credentials. Please check your email and password.',
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Login Error',
                description: error.message,
            });
        }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
               <div className="relative">
                <FormControl>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...field}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>
    </Form>
  );
}
