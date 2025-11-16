
'use client';

import { redirect, usePathname } from 'next/navigation';
import { useUser } from '@/firebase/provider';

export default function TeacherResultsRedirectPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const pathname = usePathname();

  if (isUserLoading) {
    return <div>Loading...</div>; // Or a skeleton loader
  }

  if (!user) {
    // If not logged in, redirect to login page
    redirect('/login');
    return null;
  }
  
  if(user && pathname === '/teacher/results'){
     // If a teacher lands on the base /teacher/results page,
     // redirect them to their dashboard, which will then redirect
     // to their specific class page.
     redirect('/teacher/dashboard');
     return null;
  }

  // This part should ideally not be reached if redirects work correctly.
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Results</h1>
      <p className="text-muted-foreground">
        Please select a student from your class list to enter results.
      </p>
    </div>
  );
}
