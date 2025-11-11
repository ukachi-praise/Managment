'use client';

import { useState } from 'react';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Eye, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  useCollection,
  useFirestore,
  addDocumentNonBlocking,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, addDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Student = {
  id: string;
  name: string;
};

type Classroom = {
  id: string;
  name: string;
};

type Enrollment = {
  id: string;
  studentId: string;
  classroomId: string;
  // sessionId would be here in a full implementation
};

export default function StudentsPage() {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();

  // --- Data Fetching ---
  const studentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'students')) : null),
    [firestore]
  );
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classrooms')) : null),
    [firestore]
  );
  const enrollmentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'enrollments')) : null),
    [firestore]
  );

  const { data: students, isLoading: studentsLoading } = useCollection<Student>(studentsQuery);
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const isLoading = studentsLoading || classroomsLoading || enrollmentsLoading;

  // --- Data Mapping for Display ---
  const classroomMap = useMemo(
    () =>
      classrooms?.reduce((acc, classroom) => {
        acc[classroom.id] = classroom.name;
        return acc;
      }, {} as Record<string, string>) || {},
    [classrooms]
  );

  const studentClassroomMap = useMemo(
    () =>
      enrollments?.reduce((acc, enrollment) => {
        acc[enrollment.studentId] = enrollment.classroomId;
        return acc;
      }, {} as Record<string, string>) || {},
    [enrollments]
  );

  // --- Event Handlers ---
  const handleAddStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const studentName = formData.get('name') as string;
    const classroomId = formData.get('classroomId') as string;

    if (!studentName || !classroomId) return;

    // 1. Create the student
    const studentRef = await addDocumentNonBlocking(
      collection(firestore, 'students'),
      { name: studentName }
    );

    if (studentRef) {
      // 2. Create the enrollment
      await addDocumentNonBlocking(collection(firestore, 'enrollments'), {
        studentId: studentRef.id,
        classroomId: classroomId,
        // In a real app, you'd also have sessionId and termId
      });
    }

    setOpen(false);
    event.currentTarget.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Students</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>
                Enter the student's details and assign them to a class.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStudent} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Full Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. John Doe"
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="classroomId" className="text-right">
                  Classroom
                </Label>
                <Select name="classroomId" required>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a classroom" />
                  </SelectTrigger>
                  <SelectContent>
                    {classroomsLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                      classrooms?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit">Save Student</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
          <CardDescription>
            A list of all students enrolled in the school.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
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
                      <Skeleton className="h-9 w-32 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : students && students.length > 0 ? (
                students.map((student) => {
                  const classroomId = studentClassroomMap[student.id];
                  const classroomName = classroomId ? classroomMap[classroomId] : 'N/A';
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {student.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{classroomName}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/students/${student.id}/results`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Results
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    No students found.
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
