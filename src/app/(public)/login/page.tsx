
'use client';

import Image from 'next/image';
import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/shared/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  // This page should be simple. Its only job is to show the login form.
  // Redirection logic should be handled by AuthGuards on protected pages.
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
