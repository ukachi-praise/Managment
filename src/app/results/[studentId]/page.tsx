
'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import { ResultSheet } from '@/components/results/result-sheet';
import { Button } from '@/components/ui/button';
import { Download, Loader2, ArrowLeft } from 'lucide-react';
import { useDoc, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { doc, collection, query, where } from 'firebase/firestore';
import { useMemo, useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

type Student = { id: string; name: string };
type Classroom = { id: string; name: string };
type SchoolSettings = { currentSession: string; currentTermId: string; };
type TermResult = { classroomId: string };


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
  const { data: student, isLoading: studentLoading } = useDoc<Student>(studentRef);

  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: schoolSettings, isLoading: settingsLoading } = useDoc<SchoolSettings>(settingsRef);
  
  const termResultId = useMemo(() => {
    if (!schoolSettings) return null;
    return `${schoolSettings.currentSession.replace('/', '-')}-${schoolSettings.currentTermId}`;
  }, [schoolSettings]);

  const termResultRef = useMemoFirebase(
    () => (firestore && studentId && termResultId ? doc(firestore, 'students', studentId, 'results', termResultId) : null),
    [firestore, studentId, termResultId]
  );
  const { data: termResult, isLoading: termResultLoading } = useDoc<TermResult>(termResultRef);

  const classroomId = useMemo(() => termResult?.classroomId, [termResult]);

  const classroomRef = useMemoFirebase(
    () => (firestore && classroomId ? doc(firestore, 'classrooms', classroomId) : null),
    [firestore, classroomId]
  );
  const { data: classroom, isLoading: classroomLoading } = useDoc<Classroom>(classroomRef);
  
  const isLoading = studentLoading || settingsLoading || termResultLoading || classroomLoading;
  const isDataReady = !isLoading && student && classroom;

  if (!isLoading && (!student || !termResult)) {
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
          <Button onClick={handleDownload} variant="default" disabled={!isDataReady}>
            {!isDataReady ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" /> }
            {!isDataReady ? 'Loading...' : 'Download Result'}
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="relative mx-auto aspect-[210/297] w-full max-w-[210mm] bg-white p-6 shadow-lg">
          <Skeleton className="h-full w-full" />
        </div>
      ) : isDataReady ? (
        <ResultSheet student={student} classroom={classroom} />
      ) : (
        <div className="text-center text-muted-foreground py-12">
            Could not load all required data. Ensure school settings are correct and results have been entered for this term.
        </div>
      )}

    </div>
  );
}
