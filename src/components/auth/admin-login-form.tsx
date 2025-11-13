
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
import { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const ADMIN_UID = 'GOpbb9SsavhpATk1p0KNmPGGQ0S2';

export function AdminLoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (isUserLoading) {
      setIsLoading(true);
      return;
    }
    if (user) {
      const checkAdmin = async () => {
        if (!firestore) return;
        // Temporary: Hardcoded admin check
        if (user.uid === ADMIN_UID) {
          toast({
            title: 'Login Successful',
            description: 'Welcome, Admin! Redirecting...',
          });
          router.push('/admin/dashboard');
          return;
        }

        // Original logic
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        const adminDoc = await getDoc(adminRoleRef);
        if (adminDoc.exists()) {
          toast({
            title: 'Login Successful',
            description: 'Welcome, Admin! Redirecting...',
          });
          router.push('/admin/dashboard');
        } else {
           toast({
            variant: 'destructive',
            title: 'Permission Denied',
            description: 'You do not have admin privileges.',
          });
           setIsLoading(false);
        }
      };
      checkAdmin();
    } else {
      setIsLoading(false);
    }
  }, [user, isUserLoading, router, firestore]);
  

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (!auth) return;
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      // onAuthStateChanged will handle the redirect
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: 'Invalid credentials. Please check your email and password.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: error.message,
        });
      }
      setIsLoading(false);
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
                <Input placeholder="admin@example.com" {...field} />
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

    