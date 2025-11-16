
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
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

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

  const handleSuccessfulLogin = async (user: User) => {
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'Database connection failed.' });
        setIsLoading(false);
        return;
    }

    const userDocRef = doc(firestore, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'Admin') {
            toast({ title: 'Admin Login Detected', description: 'Redirecting to admin login...' });
            router.push('/admin/login');
        } else if (userData.role === 'Teacher') {
            if (userData.assignedClassroomId) {
                 toast({ title: 'Login Successful', description: `Welcome, Teacher! Redirecting to your class...` });
                router.push(`/teacher/class/${userData.assignedClassroomId}`);
            } else {
                // This case is for a teacher who exists but has no class assigned.
                // The AuthGuard for the teacher layout will handle this by showing the dashboard page
                // which then explains that no class is assigned.
                toast({ title: 'Login Successful', description: `Welcome, Teacher! Redirecting...` });
                router.push('/teacher/dashboard');
            }
        } else {
            // User has a document but no valid role.
            toast({ variant: 'destructive', title: 'Login Failed', description: 'Your user role is not recognized.' });
            if(auth) await auth.signOut();
            setIsLoading(false);
        }
    } else {
       // User is authenticated in Firebase Auth, but has no corresponding user document in Firestore.
       toast({ variant: 'destructive', title: 'Login Failed', description: 'Your user profile is not configured. Please contact an administrator.' });
       if(auth) await auth.signOut();
       setIsLoading(false);
    }
  }


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (!auth) {
        toast({ variant: 'destructive', title: 'Error', description: 'Authentication service not ready.' });
        setIsLoading(false);
        return;
    };
    try {
        const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
        await handleSuccessfulLogin(userCredential.user);
    } catch (error: any) {
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
