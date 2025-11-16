import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';

export const metadata: Metadata = {
  metadataBase: new URL('https://justvision.netlify.app'),
  title: 'JustVision Kiddies School',
  description: 'Database & Result Management System',
  keywords: ['school management', 'result portal', 'education', 'JustVision Kiddies School', 'student database', 'JustVision Kiddies', 'JustVision'],
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
        <FirebaseClientProvider>{children}</FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
