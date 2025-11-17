
'use client';

import { useUser, useFirestore } from '@/firebase/provider';
import { doc, getDoc } from 'firebase/firestore';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';


// This page now primarily acts as a loading/fallback page.
// The main sidebar navigation logic will attempt to link directly to the class page.
// This page is a fallback if that link is clicked before the classroom ID is resolved,
// or if the user is truly not assigned to a class.
export default function TeacherDashboard() {
  const { user, isLoading: isUserLoading } = useUser();
  const [message, setMessage] = useState('Checking your classroom assignment...');

  useEffect(() => {
    // If we're still loading user info, wait.
    if (isUserLoading) {
      return;
    }
    
    // If no user, this page should not be reachable due to AuthGuard, but as a fallback:
    if (!user) {
      redirect('/login');
      return;
    }

    // The user object from the provider already contains the classroomId if it exists.
    if (user.assignedClassroomId) {
        redirect(`/teacher/class/${user.assignedClassroomId}`);
    } else {
        // If not, stop loading and show the 'No Class' message.
        setMessage('You are not currently assigned to a classroom. Please contact an administrator.');
    }

  }, [user, isUserLoading]);

  // While fetching, show a skeleton loader.
  if (isUserLoading || !message.includes('not currently assigned')) {
    return (
       <div className="flex flex-col h-full items-center justify-center gap-4 p-6">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    )
  }

  // If loading is finished and we are still on this page, it means no class was found.
  return (
    <div className="p-6">
        <h1 className="text-2xl font-bold">No Class Assigned</h1>
        <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
