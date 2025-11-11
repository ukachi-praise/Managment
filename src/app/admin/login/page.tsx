
import Image from 'next/image';
import { AdminLoginForm } from '@/components/auth/admin-login-form';
import { Logo } from '@/components/shared/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';


export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col items-center justify-center bg-primary p-12 text-primary-foreground lg:flex">
        <div className="space-y-4">
           <Logo className="text-4xl" />
          <p className="text-center text-lg">
            Database & Result Management System
          </p>
        </div>
        <Image
          src="/Logo.jpg"
          alt="School Logo"
          width={400}
          height={400}
          className="mt-8 rounded-xl object-contain"
        />
      </div>
      <div className="flex w-full flex-col items-center justify-center bg-background p-6 text-foreground lg:w-1/2">
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
