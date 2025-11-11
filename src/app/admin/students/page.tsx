
'use client';

import { useState, useMemo } from 'react';
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
import {
  useCollection,
  useFirestore,
  addDocumentNonBlocking,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query } from 'firebase/firestore';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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
  
  // --- Data Grouping ---
  const studentsByClass = useMemo(() => {
    if (isLoading || !students || !classrooms || !enrollments) {
      return {};
    }

    const grouped: Record<string, { classroom: Classroom, students: Student[] }> = {};

    // Initialize with all classrooms
    classrooms.forEach(classroom => {
        grouped[classroom.id] = { classroom, students: [] };
    });

    // Map students to their IDs for quick lookup
    const studentMap = new Map(students.map(s => [s.id, s]));

    // Populate students into their classrooms
    enrollments.forEach(enrollment => {
      const student = studentMap.get(enrollment.studentId);
      if (student && grouped[enrollment.classroomId]) {
        grouped[enrollment.classroomId].students.push(student);
      }
    });

    // Sort students within each class
    Object.values(grouped).forEach(group => {
      group.students.sort((a, b) => a.name.localeCompare(b.name));
    });
    
    // Sort classrooms by name
    return Object.values(grouped).sort((a,b) => a.classroom.name.localeCompare(b.classroom.name));

  }, [isLoading, students, classrooms, enrollments]);

  // --- Event Handlers ---
  const handleAddStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const newStudentData = {
      name: formData.get('name') as string,
      admissionNumber: formData.get('admissionNumber') as string,
      dob: formData.get('dob') as string,
      gender: formData.get('gender') as string,
      parentName: formData.get('parentName') as string,
      contact: formData.get('contact') as string,
    };
    const classroomId = formData.get('classroomId') as string;

    if (!newStudentData.name || !classroomId || !newStudentData.admissionNumber) return;

    // 1. Create the student
    const studentRef = await addDocumentNonBlocking(
      collection(firestore, 'students'),
      newStudentData
    );

    if (studentRef) {
      // 2. Create the enrollment
      await addDocumentNonBlocking(collection(firestore, 'enrollments'), {
        studentId: studentRef.id,
        classroomId: classroomId,
        // In a real app, you'd also have sessionId (e.g. "2025/2026")
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
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>
                Enter the student's details and assign them to a class.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStudent} className="grid gap-4 py-4">
               <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Student Name</Label>
                  <Input id="name" name="name" placeholder="John Doe" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admissionNumber">Admission Number</Label>
                  <Input id="admissionNumber" name="admissionNumber" placeholder="JKS-00123" required />
                </div>
                 <div className="space-y-2">
                   <Label htmlFor="classroomId">Classroom</Label>
                    <Select name="classroomId" required>
                      <SelectTrigger>
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
                 <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input id="dob" name="dob" type="date" required />
                </div>
                <div className="space-y-2">
                   <Label htmlFor="gender">Gender</Label>
                    <Select name="gender" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                  <Label htmlFor="parentName">Parent / Guardian Name</Label>
                  <Input id="parentName" name="parentName" placeholder="Jane Doe" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact">Contact Number</Label>
                  <Input id="contact" name="contact" placeholder="+1234567890" required />
                </div>
               </div>
              <DialogFooter className="mt-4">
                <Button type="submit">Save Student</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

        {isLoading ? (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>
        ) : (
             <Card>
                <CardHeader>
                <CardTitle>Student List by Class</CardTitle>
                <CardDescription>
                    A list of all students enrolled in the school, grouped by their class.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        {studentsByClass.length > 0 ? studentsByClass.map(({ classroom, students: classStudents }) => (
                            <AccordionItem value={classroom.id} key={classroom.id}>
                                <AccordionTrigger className="text-lg font-medium hover:no-underline">
                                    {classroom.name} ({classStudents.length} students)
                                </AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                        {classStudents.length > 0 ? (
                                            classStudents.map((student) => (
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
                                                <TableCell className="text-right">
                                                <Button asChild variant="outline" size="sm">
                                                    <Link href={`/results/${student.id}`}>
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    View Results
                                                    </Link>
                                                </Button>
                                                </TableCell>
                                            </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={2} className="h-24 text-center">
                                                No students enrolled in this class.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        )) : (
                            <div className="text-center text-muted-foreground p-8">
                                No classrooms or students found.
                            </div>
                        )}
                    </Accordion>
                </CardContent>
             </Card>
        )}
    </div>
  );
}
