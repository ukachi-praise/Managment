
import Image from 'next/image';
import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/shared/logo';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function LoginPage() {
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
      <div className="flex w-full flex-col items-center justify-center bg-background p-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo className="text-2xl text-foreground" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">
            Welcome Back!
          </h1>
          <p className="mb-8 text-muted-foreground">
            Enter your credentials to access your account.
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
