
'use client';

import { useUser, useFirestore } from '@/firebase/provider';
import { doc, getDoc } from 'firebase/firestore';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';


// This page now primarily acts as a loading/fallback page.
// The main sidebar navigation logic will attempt to link directly to the class page.
// This page is a fallback if that link is clicked before the classroom ID is resolved,
// or if the user is truly not assigned to a class.
export default function TeacherDashboard() {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If we're still loading user info or don't have firestore, wait.
    if (isUserLoading || !firestore) {
      return;
    }
    // If no user, send to login.
    if (!user) {
      redirect('/login');
      return;
    }

    const fetchUserClass = async () => {
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists() && userDoc.data().assignedClassroomId) {
        // If a class is assigned, redirect immediately.
        redirect(`/teacher/class/${userDoc.data().assignedClassroomId}`);
      } else {
        // If not, stop loading and show the 'No Class' message.
        setLoading(false);
      }
    };

    fetchUserClass();

  }, [user, isUserLoading, firestore]);

  // While fetching, show a skeleton loader.
  if (loading) {
    return (
       <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  // If loading is finished and we are still on this page, it means no class was found.
  return (
    <div className="p-6">
        <h1 className="text-2xl font-bold">No Class Assigned</h1>
        <p className="text-muted-foreground">You are not currently assigned to a classroom. Please contact an administrator.</p>
    </div>
  );
}
