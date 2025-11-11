
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
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const ADMIN_UID = 'GOpbb9SsavhpATk1p0KNmPGGQ0S2';

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
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
      const checkRole = async () => {
        // Temporary: Hardcoded admin check
        if (user.uid === ADMIN_UID) {
          toast({
            title: 'Admin Login',
            description: 'Redirecting to admin login...',
          });
          router.push('/admin/login');
          return;
        }

        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role === 'Admin') {
                toast({
                    title: 'Admin Login',
                    description: 'Redirecting to admin dashboard...',
                });
                router.push('/admin/dashboard');
            } else if (userData.role === 'Teacher') {
                if (userData.assignedClassroomId) {
                     toast({
                        title: 'Login Successful',
                        description: `Welcome, Teacher! Redirecting to your class...`,
                    });
                    router.push(`/teacher/class/${userData.assignedClassroomId}`);
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'Login Failed',
                        description: 'You have not been assigned to a classroom. Please contact an administrator.',
                    });
                    setIsLoading(false);
                }
            }
        } else {
           toast({
                variant: 'destructive',
                title: 'Login Failed',
                description: 'Your user role is not configured. Please contact an administrator.',
            });
           setIsLoading(false);
        }
      };
      checkRole();
    } else {
      setIsLoading(false);
    }
  }, [user, isUserLoading, router, firestore]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
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
                  className="text-sm text-primary-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
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
