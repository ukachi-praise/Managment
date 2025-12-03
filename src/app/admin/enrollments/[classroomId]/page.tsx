
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { collection, query, where, doc } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import AuthGuard from '@/components/auth/AuthGuard';

type Enrollment = { id: string; classroomId: string; studentId: string; createdAt: any };
type Student = { id: string; name: string; isDeleted?: boolean; };
type Classroom = { id: string; name: string; teacherId?: string };

function EnrollmentPageContent() {
  const params = useParams();
  const router = useRouter();
  const classroomId = params.classroomId as string;
  const firestore = useFirestore();

  // --- Data Fetching ---
  const classroomRef = useMemoFirebase(
    () => (firestore && classroomId ? doc(firestore, 'classrooms', classroomId) : null),
    [firestore, classroomId]
  );
  const { data: classroom, isLoading: classroomLoading } = useDoc<Classroom>(classroomRef);

  const enrollmentsQuery = useMemoFirebase(
    () => classroomId && firestore ? query(collection(firestore, 'enrollments'), where('classroomId', '==', classroomId)) : null,
    [classroomId, firestore]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const studentIds = useMemo(() => enrollments?.map(e => e.studentId) || [], [enrollments]);

  // Firestore 'in' queries are limited to 30 items. We might need to batch this in the future if a class has more students.
  const studentsQuery = useMemoFirebase(
    () => studentIds.length > 0 && firestore ? query(collection(firestore, 'students'), where('__name__', 'in', studentIds)) : null,
    [firestore, studentIds]
  );
  const { data: students, isLoading: studentsLoading } = useCollection<Student>(studentsQuery);

  const studentMap = useMemo(() => {
    if (!students) return new Map();
    return new Map(students.map(s => [s.id, s]));
  }, [students]);

  const combinedEnrollmentData = useMemo(() => {
    if (!enrollments) return [];
    return enrollments
      .map(enrollment => {
        const student = studentMap.get(enrollment.studentId);
        if (!student || student.isDeleted) return null;
        return {
          enrollmentId: enrollment.id,
          studentName: student.name,
          enrollmentDate: enrollment.createdAt?.toDate ? format(enrollment.createdAt.toDate(), 'PPP') : 'N/A',
        };
      })
      .filter(item => item !== null);
  }, [enrollments, studentMap]);

  const isLoading = classroomLoading || enrollmentsLoading || studentsLoading;

  if (isLoading) {
      return (
        <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Enrollments for {classroom?.name}
          </h1>
          <p className="text-muted-foreground">
            A list of all students enrolled in this class.
          </p>
        </div>
        <Button onClick={() => router.push('/admin/classrooms')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Classrooms
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
          <CardDescription>
            {combinedEnrollmentData.length} student(s) enrolled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Enrollment Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedEnrollmentData.length > 0 ? (
                combinedEnrollmentData.map((item) => (
                  <TableRow key={item.enrollmentId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {item.studentName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{item.studentName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{item.enrollmentDate}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="h-24 text-center">
                    No students found for this class.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


export default function GuardedEnrollmentPage() {
    const params = useParams();
    const classroomId = params.classroomId as string;

    return (
        <AuthGuard allow={['Admin']} specificClassroomId={classroomId}>
            <EnrollmentPageContent />
        </AuthGuard>
    )
}

    