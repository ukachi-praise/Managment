import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseProvider } from '@/firebase/provider';

export const metadata: Metadata = {
  metadataBase: new URL('https://justvision-management.netlify.app'),
  title: 'JustVision Kiddies School',
  description: 'Database & Result Management System',
  keywords: ['school management', 'result portal', 'education', 'JustVision Kiddies School', 'student database', 'JustVision Kiddies', 'JustVision'],
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
        <FirebaseProvider>
          {children}
        </FirebaseProvider>
        <Toaster />
      </body>
    </html>
  );
}
