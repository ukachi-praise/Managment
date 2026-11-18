
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Loader2 } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { logAuthDiagnostic } from '@/lib/auth-diagnostics';


type AuthGuardProps = {
  children: React.ReactNode;
  allow: ("SuperAdmin" | "Admin" | "Teacher")[];
  specificClassroomId?: string; 
};

type Classroom = { id: string; name: string; teacherId?: string; };

export default function AuthGuard({
  children,
  allow,
  specificClassroomId,
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: isUserLoading, profileError } = useUser();
  const firestore = useFirestore();

  const classroomRef = useMemoFirebase(
    () => (firestore && specificClassroomId ? doc(firestore, 'classrooms', specificClassroomId) : null),
    [firestore, specificClassroomId]
  );
  const { data: classroom, isLoading: isClassroomLoading } = useDoc<Classroom>(classroomRef);

  const isLoading = isUserLoading || (specificClassroomId ? isClassroomLoading : false);

  useEffect(() => {
    if (isLoading || profileError) return;

    const userRole = user?.role;
    const isAdminRoute = pathname.startsWith('/admin');

    if (!user) {
      const targetLogin = isAdminRoute ? '/admin/login' : '/login';
      if (pathname !== targetLogin) {
        logAuthDiagnostic('final-redirect-decision', { entryPoint: 'auth-guard', decision: 'redirect-to-login', destination: targetLogin, pathname });
        router.replace(targetLogin);
      }
      return;
    }

    if (pathname.endsWith('/login')) {
      const dashboard = (userRole === 'SuperAdmin' || userRole === 'Admin') ? '/admin/dashboard' : '/teacher/dashboard';
      logAuthDiagnostic('final-redirect-decision', { entryPoint: 'auth-guard', decision: 'redirect-from-login', destination: dashboard, role: userRole || null });
      router.replace(dashboard);
      return;
    }

    let isAllowed = false;
    if (userRole && allow.includes(userRole)) {
      isAllowed = true;
    }

    if (specificClassroomId) {
      if (userRole === 'SuperAdmin' || userRole === 'Admin') {
        isAllowed = true;
      }
      else if (userRole === 'Teacher' && classroom) {
        isAllowed = user.uid === classroom.teacherId;
      }
      else {
        isAllowed = false;
      }
    }

    const isAuthorizedForAdmin = (userRole === 'SuperAdmin' || userRole === 'Admin');
    if ((pathname.startsWith('/admin') && !isAuthorizedForAdmin) || (pathname.startsWith('/teacher') && isAuthorizedForAdmin)) {
       const correctDashboard = isAuthorizedForAdmin ? '/admin/dashboard' : '/teacher/dashboard';
       logAuthDiagnostic('final-redirect-decision', { entryPoint: 'auth-guard', decision: 'redirect-to-role-dashboard', destination: correctDashboard, role: userRole || null, pathname });
       router.replace(correctDashboard);
       return;
    }

    if (!isAllowed) {
      logAuthDiagnostic('final-redirect-decision', { entryPoint: 'auth-guard', decision: 'redirect-unauthorized', destination: '/unauthorized', role: userRole || null, pathname });
      router.replace('/unauthorized');
      return;
    }

    logAuthDiagnostic('final-redirect-decision', { entryPoint: 'auth-guard', decision: 'allow', role: userRole || null, pathname });

  }, [isLoading, profileError, user, classroom, pathname, router, allow, specificClassroomId]);


  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="sr-only">Verifying permissions...</span>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold text-destructive">Account profile unavailable</h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">We could not load your staff profile. Please contact an administrator and try again.</p>
        </div>
      </div>
    );
  }

  const canRenderChildren = () => {
    if (!user || !user.role) return false;
    
    if (allow.includes(user.role)) {
        if(specificClassroomId) {
            return (user.role === 'SuperAdmin' || user.role === 'Admin') || (classroom && classroom.teacherId === user.uid);
        }
        return true;
    }
    return false;
  }
  
  if (canRenderChildren()) {
    return <>{children}</>;
  }
  
  return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
  );
}
