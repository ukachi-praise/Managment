
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
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
  setDocumentNonBlocking,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, where, doc } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';


type Student = { id: string; name: string; isDeleted?: boolean; admissionNumber: string };
type Classroom = { id: string; name: string };
type Enrollment = { studentId: string; classroomId: string };

export default function TeacherClassPage() {
  const params = useParams();
  const router = useRouter();
  const classroomId = params.classroomId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // --- Data Fetching ---
  const classroomRef = useMemoFirebase(
    () => (firestore && classroomId ? doc(firestore, 'classrooms', classroomId) : null),
    [firestore, classroomId]
  );
  const { data: classroom, isLoading: classroomLoading } = useDoc<Classroom>(classroomRef);

  const enrollmentsQuery = useMemoFirebase(
    () =>
      classroomId && firestore
        ? query(
            collection(firestore, 'enrollments'),
            where('classroomId', '==', classroomId)
          )
        : null,
    [classroomId, firestore]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const allStudentsQuery = useMemoFirebase(
    () => (firestore && user ? query(collection(firestore, 'students')) : null),
    [firestore, user]
  );
  const { data: allStudents, isLoading: allStudentsLoading } = useCollection<Student>(allStudentsQuery);
  
  const studentsInClass = useMemo(() => {
      if (!enrollments || !allStudents) return [];
      const studentIds = new Set(enrollments.map(e => e.studentId));
      return allStudents.filter(s => studentIds.has(s.id) && !s.isDeleted).sort((a,b) => a.name.localeCompare(b.name));
  }, [enrollments, allStudents]);

  const isLoading = classroomLoading || enrollmentsLoading || allStudentsLoading;

  const handleDeleteStudent = () => {
    if (!firestore || !studentToDelete) return;
    
    const studentRef = doc(firestore, 'students', studentToDelete.id);
    setDocumentNonBlocking(studentRef, { isDeleted: true }, { merge: true });

    toast({
        variant: 'destructive',
        title: 'Student Removed',
        description: `${studentToDelete.name} has been removed from the class.`,
    });
    setStudentToDelete(null);
  }

  return (
    <div className="space-y-6">
      <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will remove <span className="font-semibold">{studentToDelete?.name}</span> from the class. This action marks the student as deleted but does not permanently erase their data.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteStudent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Continue
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div>
            {classroomLoading ? <h1 className="text-3xl font-bold tracking-tight">Loading...</h1> : <h1 className="text-3xl font-bold tracking-tight">{classroom?.name}</h1>}
            <p className="text-muted-foreground">
                Your assigned class dashboard. View students and manage results.
            </p>
        </div>
        <Button onClick={() => router.back()} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
          <CardDescription>
            A list of all students enrolled in your class. Click a student's name to enter their scores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission Number</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsInClass && studentsInClass.length > 0 ? (
                  studentsInClass.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          <Link href={`/teacher/results/${student.id}`} className="flex items-center gap-3 hover:underline">
                            <Avatar>
                              <AvatarFallback>
                                {student.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{student.name}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          {student.admissionNumber || 'N/A'}
                        </TableCell>
                         <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/teacher/results/${student.id}`}>
                              Enter/View Scores
                            </Link>
                          </Button>
                          {/* Only show delete for admins. A proper role check from a user hook would be better. */}
                          {user?.email?.includes('admin') && (
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setStudentToDelete(student)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
