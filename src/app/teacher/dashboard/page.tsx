
'use client';

import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';


// This page is the primary destination for teachers.
// It will now act as a redirector to get the teacher to their assigned class.
export default function TeacherDashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading || !firestore) {
      return;
    }
    if (!user) {
      redirect('/login');
      return;
    }

    const fetchUserClass = async () => {
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists() && userDoc.data().assignedClassroomId) {
        redirect(`/teacher/class/${userDoc.data().assignedClassroomId}`);
      } else {
        // Handle case where teacher has no assigned class
        setLoading(false);
      }
    };

    fetchUserClass();

  }, [user, isUserLoading, firestore]);

  if (loading) {
    // Or a more sophisticated skeleton loader
    return (
       <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  // If loading is false and we're still here, it means the user has no class assigned.
  return (
    <div className="p-6">
        <h1 className="text-2xl font-bold">No Class Assigned</h1>
        <p className="text-muted-foreground">You are not currently assigned to a classroom. Please contact an administrator.</p>
    </div>
  );
}
