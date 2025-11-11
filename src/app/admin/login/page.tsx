
import Image from 'next/image';
import { AdminLoginForm } from '@/components/auth/admin-login-form';
import { Logo } from '@/components/shared/logo';

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col items-center justify-center bg-background p-12 text-foreground lg:flex">
        <div className="space-y-4">
           <Logo className="text-4xl text-primary" />
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
      <div className="flex w-full flex-col items-center justify-center bg-primary p-6 text-primary-foreground lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo className="text-2xl text-primary-foreground" />
          </div>
          <h1 className="mb-2 text-2xl font-bold md:text-3xl">
            Admin Access
          </h1>
          <p className="mb-8 text-primary-foreground/80">
            Enter your credentials to access the admin dashboard.
          </p>
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
