
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import {
  useFirestore,
  useDoc,
  useCollection,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, where, doc } from 'firebase/firestore';
import { ResultSheet } from '@/components/results/result-sheet';
import { Loader2, ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// --- TYPE DEFINITIONS ---
type Student = { id: string; name: string; admissionNumber: string; };
type Classroom = { id: string; name: string; teacherName?: string; };

export default function ResultSheetPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const firestore = useFirestore();

  // --- DATA FETCHING ---
  const studentRef = useMemoFirebase(
    () => (firestore && studentId ? doc(firestore, 'students', studentId) : null),
    [firestore, studentId]
  );
  const { data: student, isLoading: studentLoading } = useDoc<Student>(studentRef);
  
  const enrollmentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'enrollments'), where('studentId', '==', studentId)) : null),
    [firestore, studentId]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection(enrollmentsQuery);

  const classroomId = useMemo(() => enrollments?.[0]?.classroomId, [enrollments]);

  const classroomRef = useMemoFirebase(
    () => (firestore && classroomId ? doc(firestore, 'classrooms', classroomId) : null),
    [firestore, classroomId]
  );
  const { data: classroom, isLoading: classroomLoading } = useDoc<Classroom>(classroomRef);

  const isLoading = studentLoading || classroomLoading || enrollmentsLoading;
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!student || !classroom) {
    return (
        <div className="flex h-screen items-center justify-center bg-muted">
            <Card className="m-4">
                <CardContent className="p-8">
                     <h2 className="text-xl font-semibold text-destructive">Error Loading Report</h2>
                     <p className="text-muted-foreground mt-2">Could not find the required student or classroom data.</p>
                     <Button onClick={() => router.back()} className="mt-6">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                     </Button>
                </CardContent>
            </Card>
        </div>
    );
  }


  return (
    <div className="bg-muted min-h-screen py-8 px-4 no-print">
      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center">
        <Button onClick={() => router.back()} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Student List
        </Button>
        <Button onClick={() => window.print()} disabled={isLoading}>
          <Printer className="mr-2 h-4 w-4" />
          Print Report Card
        </Button>
      </div>
      <div className="max-w-4xl mx-auto space-y-4">
         <ResultSheet student={student} classroom={classroom} />
      </div>
    </div>
  );
}
