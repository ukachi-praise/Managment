'use client';

import { Header } from '@/components/shared/header';
import { SidebarNav } from '@/components/shared/sidebar-nav';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { redirect, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const params = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (isUserLoading || !firestore) return;

    if (!user) {
      redirect('/login');
      return;
    }

    const checkAuthorization = async () => {
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userClassId = userData.assignedClassroomId;
        const pageClassId = params.classroomId;

        // A teacher can only view their own class page.
        if (userClassId && pageClassId === userClassId) {
          setIsAuthorized(true);
        } else if (userClassId) {
            // If they try to access a different class, redirect them to their own.
            redirect(`/teacher/class/${userClassId}`);
        } else {
            // If they have no assigned class, they are unauthorized.
            setIsAuthorized(false);
        }
      } else {
        setIsAuthorized(false);
      }
      setIsLoading(false);
    };

    checkAuthorization();
  }, [user, isUserLoading, firestore, params]);

  if (isLoading) {
    return (
        <div className="flex min-h-screen">
          <div className="w-56 hidden md:block border-r p-4 space-y-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="flex-1 flex flex-col">
              <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
                <div className="flex-1" />
                <Skeleton className="h-9 w-9 rounded-full" />
              </header>
              <main className="flex-1 p-4 sm:p-6">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-64 w-full mt-6" />
              </main>
          </div>
        </div>
    );
  }
  
  if (!isAuthorized) {
      // You can replace this with a proper "Unauthorized" component
      return (
        <div className="flex min-h-screen items-center justify-center">
            <p>You are not authorized to view this page. Please contact an administrator.</p>
        </div>
      );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <SidebarNav role="teacher" />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
