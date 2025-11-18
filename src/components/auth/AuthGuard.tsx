
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Loader2 } from 'lucide-react';
import { doc } from 'firebase/firestore';


type AuthGuardProps = {
  children: React.ReactNode;
  allow: ("Admin" | "Teacher")[];
  specificClassroomId?: string; // New optional prop
};

type Classroom = { id: string; name: string; teacherId?: string; };

export default function AuthGuard({
  children,
  allow,
  specificClassroomId,
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();

  // Fetch the classroom doc if a specificClassroomId is provided
  const classroomRef = useMemoFirebase(
    () => (firestore && specificClassroomId ? doc(firestore, 'classrooms', specificClassroomId) : null),
    [firestore, specificClassroomId]
  );
  const { data: classroom, isLoading: isClassroomLoading } = useDoc<Classroom>(classroomRef);

  const isLoading = isUserLoading || (specificClassroomId ? isClassroomLoading : false);

  useEffect(() => {
    // Only run checks once all data is loaded
    if (isLoading) {
      return;
    }

    const userRole = user?.role;
    const isAdminRoute = pathname.startsWith('/admin');

    // 1. If user is not logged in, redirect to the correct login page.
    if (!user) {
      const targetLogin = isAdminRoute ? '/admin/login' : '/login';
      if (pathname !== targetLogin) {
        router.replace(targetLogin);
      }
      return;
    }

    // 2. If user IS logged in:
    // If they are on a login page, redirect them away.
    if (pathname.endsWith('/login')) {
      const dashboard = userRole === 'Admin' ? '/admin/dashboard' : '/teacher/dashboard';
      router.replace(dashboard);
      return;
    }

    // --- Role and Specific Document Access Check ---
    let isAllowed = false;

    // A. Check basic role permission first
    if (userRole && allow.includes(userRole)) {
      isAllowed = true;
    }

    // B. If a specificClassroomId is provided, perform a more detailed check
    if (specificClassroomId) {
      // An Admin is always allowed to see a specific classroom page
      if (userRole === 'Admin') {
        isAllowed = true;
      }
      // A teacher is only allowed if their UID matches the teacherId on the classroom document
      else if (userRole === 'Teacher' && classroom) {
        isAllowed = user.uid === classroom.teacherId;
      }
      // If the classroom data is still loading or not found, they are not allowed yet.
      else {
        isAllowed = false;
      }
    }


    // 3. Handle routing based on permission
    // If they are on a page for a different role (e.g., Teacher on /admin), redirect them.
    if ((pathname.startsWith('/admin') && userRole === 'Teacher') || (pathname.startsWith('/teacher') && userRole === 'Admin')) {
       const correctDashboard = userRole === 'Admin' ? '/admin/dashboard' : '/teacher/dashboard';
       router.replace(correctDashboard);
       return;
    }

    // If, after all checks, the user is not allowed, send to unauthorized.
    if (!isAllowed) {
      router.replace('/unauthorized');
      return;
    }
    
    // If all checks pass, they are allowed to see the page.

  }, [isLoading, user, classroom, pathname, router, allow, specificClassroomId]);


  // While loading auth state or specific classroom data, show a loader.
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Verifying permissions...</span>
      </div>
    );
  }

  // Determine if children should be rendered based on final permission state.
  const canRenderChildren = () => {
    // This now only runs after isLoading is false.
    if (!user || !user.role) return false;
    
    if (allow.includes(user.role)) {
        if(specificClassroomId) {
            // If it's a specific page, we need the classroom data to be present and match
            return user.role === 'Admin' || (classroom && classroom.teacherId === user.uid);
        }
        return true; // It's a general page, role is enough
    }
    return false;
  }
  
  if (canRenderChildren()) {
    return <>{children}</>;
  }
  
  // As a fallback, show the loader. This covers edge cases during redirects.
  return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
  );
}
