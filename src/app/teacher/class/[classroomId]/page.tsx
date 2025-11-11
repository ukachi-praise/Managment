

'use client';

import { useParams } from 'next/navigation';
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
import {
  useFirestore,
  useCollection,
  useDoc,
  useUser,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, where, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type Student = { id: string; name: string };
type Classroom = { id: string; name: string };
type Enrollment = { studentId: string; classroomId: string };

export default function TeacherClassPage() {
  const params = useParams();
  const classroomId = params.classroomId as string;
  const firestore = useFirestore();
  const { user } = useUser();

  // --- Data Fetching ---
  const classroomRef = useMemoFirebase(
    () => (firestore && classroomId ? doc(firestore, 'classrooms', classroomId) : null),
    [firestore, classroomId]
  );
  const { data: classroom, isLoading: classroomLoading } = useDoc<Classroom>(classroomRef);

  const enrollmentsQuery = useMemoFirebase(
    () =>
      classroomId
        ? query(
            collection(firestore, 'enrollments'),
            where('classroomId', '==', classroomId)
          )
        : null,
    [classroomId, firestore]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const allStudentsQuery = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'students') : null),
    [firestore, user]
  );
  const { data: allStudents, isLoading: allStudentsLoading } = useCollection<Student>(allStudentsQuery);
  
  const studentsInClass = useMemo(() => {
      if (!enrollments || !allStudents) return [];
      const studentIds = new Set(enrollments.map(e => e.studentId));
      return allStudents.filter(s => studentIds.has(s.id)).sort((a,b) => a.name.localeCompare(b.name));
  }, [enrollments, allStudents]);

  const isLoading = classroomLoading || enrollmentsLoading || allStudentsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            {classroomLoading ? <Skeleton className="h-9 w-48" /> : <h1 className="text-3xl font-bold tracking-tight">{classroom?.name}</h1>}
            <p className="text-muted-foreground">
                Your assigned class dashboard. View students and manage results.
            </p>
        </div>
        <Button asChild>
            <Link href="/teacher/results">Enter/Edit Results</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
          <CardDescription>
            A list of all students enrolled in your class. Click a student's name to view their report card.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Admission Number</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-5 w-32" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                        <Skeleton className="h-8 w-24" />
                    </TableCell>
                  </TableRow>
                ))
              ) : studentsInClass && studentsInClass.length > 0 ? (
                studentsInClass.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <Link href={`/results/${student.id}`} className="flex items-center gap-3 hover:underline">
                          <Avatar>
                            <AvatarFallback>
                              {student.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{student.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        {/* This assumes admissionNumber is on the student doc */}
                        {(student as any).admissionNumber || 'N/A'}
                      </TableCell>
                       <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/results/${student.id}`}>
                            View Report
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    No students found in this class.
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
