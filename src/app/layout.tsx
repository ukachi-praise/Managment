import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseProvider } from '@/firebase/provider';
import { SCHOOL_NAME } from '@/lib/school';

export const metadata: Metadata = {
  metadataBase: new URL('https://justvision-management.netlify.app'),
  title: SCHOOL_NAME,
  description: 'Database & Result Management System',
  keywords: ['school management', 'result portal', 'education', SCHOOL_NAME, 'student database'],
  icons: {
    icon: '/Logo.jpg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased')}>
        <div className="relative z-10 min-h-screen">
          <FirebaseProvider>
            {children}
          </FirebaseProvider>
          <Toaster />
        </div>
      </body>
    </html>
  );
}
