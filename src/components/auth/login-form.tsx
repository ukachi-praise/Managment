
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
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const ADMIN_UID = 'GOpbb9SsavhpATk1p0KNmPGGQ0S2';
const TEACHER_UID = 'u3krP4g02DgPJ6Avv1XhVNvvb8R2';

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

    // Hardcoded redirect for specific Admin UID
    if (user.uid === ADMIN_UID) {
      toast({ title: 'Admin Login', description: 'Redirecting to admin login...' });
      router.push('/admin/login');
      return;
    }

    // Hardcoded redirect for specific Teacher UID
    if (user.uid === TEACHER_UID) {
        toast({ title: 'Login Successful', description: `Welcome, Teacher! Redirecting...` });
        const q = query(collection(firestore, 'classrooms'), where('name', '==', 'Primary 4'));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const classroomDoc = querySnapshot.docs[0];
            router.push(`/teacher/class/${classroomDoc.id}`);
        } else {
             toast({ variant: 'destructive', title: 'Login Failed', description: 'Could not find "Primary 4" classroom.' });
             setIsLoading(false);
        }
        return;
    }


    // Default logic for other users
    const userDocRef = doc(firestore, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'Admin') {
            toast({ title: 'Admin Login', description: 'Redirecting to admin dashboard...' });
            router.push('/admin/dashboard');
        } else if (userData.role === 'Teacher') {
            if (userData.assignedClassroomId) {
                 toast({ title: 'Login Successful', description: `Welcome, Teacher! Redirecting to your class...` });
                router.push(`/teacher/class/${userData.assignedClassroomId}`);
            } else {
                toast({ variant: 'destructive', title: 'Login Failed', description: 'You have not been assigned to a classroom. Please contact an administrator.' });
                setIsLoading(false);
            }
        }
    } else {
       toast({ variant: 'destructive', title: 'Login Failed', description: 'Your user role is not configured. Please contact an administrator.' });
       setIsLoading(false);
    }
  }


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (!auth) {
        setIsLoading(false);
        return;
    };
    try {
        const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
        await handleSuccessfulLogin(userCredential.user);
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
