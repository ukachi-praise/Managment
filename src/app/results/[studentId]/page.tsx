
'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import { ResultSheet } from '@/components/results/result-sheet';
import { Button } from '@/components/ui/button';
import { Download, Loader2, ArrowLeft } from 'lucide-react';
import { useDoc, useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { doc, collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';


export default function StudentResultsPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const firestore = useFirestore();

  // --- Data Fetching ---
  const studentRef = useMemoFirebase(
    () => (firestore && studentId ? doc(firestore, 'students', studentId) : null),
    [firestore, studentId]
  );
  const { data: student, isLoading: studentLoading } = useDoc(studentRef);

  const enrollmentsQuery = useMemoFirebase(
    () => (studentId ? query(collection(firestore, 'enrollments'), where('studentId', '==', studentId)) : null),
    [firestore, studentId]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection(enrollmentsQuery);
  const classroomId = useMemo(() => enrollments?.[0]?.classroomId, [enrollments]);

  const classroomRef = useMemoFirebase(
    () => (firestore && classroomId ? doc(firestore, 'classrooms', classroomId) : null),
    [firestore, classroomId]
  );
  const { data: classroom, isLoading: classroomLoading } = useDoc(classroomRef);
  
  const isLoading = studentLoading || enrollmentsLoading || classroomLoading;

  if (!isLoading && !student) {
    notFound();
  }

  const handleDownload = () => {
    if (!student || !classroom) return;

    const originalTitle = document.title;
    document.title = `${student.name} - ${classroom.name} - Report`;
    window.print();
    document.title = originalTitle;
  };
  
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between no-print">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Student Academic Report</h1>
            <p className="text-muted-foreground">
              Detailed academic report and performance analysis.
            </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button onClick={handleDownload} variant="default" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" /> }
            {isLoading ? 'Loading...' : 'Download Result'}
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="relative mx-auto aspect-[210/297] w-full max-w-[210mm] bg-white p-6 shadow-lg">
          <Skeleton className="h-full w-full" />
        </div>
      ) : student && classroom ? (
        <ResultSheet student={student} classroom={classroom} />
      ) : (
        <div className="text-center text-muted-foreground py-12">
            Could not load student or classroom data.
        </div>
      )}

    </div>
  );
}

