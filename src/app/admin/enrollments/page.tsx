
'use client';

import { useRouter } from "next/navigation";
import { useEffect } from "react";


// This page is a placeholder to redirect to the classrooms list.
// The actual enrollment view is a dynamic route /admin/enrollments/[classroomId]
export default function EnrollmentsRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/admin/classrooms');
    }, [router]);
    
    return null; // Render nothing while redirecting
}
