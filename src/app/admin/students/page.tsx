
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
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  useCollection,
} from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import {
  useFirestore,
  useMemoFirebase,
} from '@/firebase/provider';
import { collection, query, doc, serverTimestamp, writeBatch, getDocs } from 'firebase/firestore';
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
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

type Classroom = {
  id: string;
  name: string;
};

type SchoolSettings = {
    admissionNumberPrefix?: string;
    totalStudentCapacity?: number;
}

type Enrollment = {
    id: string;
    classroomId: string;
    studentId: string;
}

type Student = {
    id: string;
    isDeleted?: boolean;
}


export default function StudentsPage() {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  // --- Data Fetching ---
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classrooms')) : null),
    [firestore]
  );
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  
  const enrollmentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'enrollments')) : null),
    [firestore]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);
  
  const allStudentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'students')) : null),
    [firestore]
  );
  const { data: allStudents, isLoading: studentsLoading } = useCollection<Student>(allStudentsQuery);
  
  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: settings, isLoading: settingsLoading } = useDoc<SchoolSettings>(settingsRef);

  const studentCounts = useMemo(() => {
    if (!enrollments || !allStudents) return {};
    
    // Create a set of active student IDs for quick lookup
    const activeStudentIds = new Set(
      allStudents.filter(student => !student.isDeleted).map(student => student.id)
    );

    // Count enrollments only if the student is active
    return enrollments.reduce((acc, enrollment) => {
      if (activeStudentIds.has(enrollment.studentId)) {
        acc[enrollment.classroomId] = (acc[enrollment.classroomId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [enrollments, allStudents]);

  // --- Event Handlers ---
  const handleAddStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;
    
    const form = event.currentTarget;
    const formData = new FormData(form);
    
    const studentName = formData.get('name') as string;
    const classroomId = formData.get('classroomId') as string;
    const gender = formData.get('gender') as string;
    const dob = formData.get('dob') as string;
    const parentName = formData.get('parentName') as string;
    const contact = formData.get('contact') as string;

    if (!studentName || !classroomId || !gender) {
        toast({variant: 'destructive', title: 'Missing fields', description: 'Please fill out all fields.'});
        return;
    };

    // Auto-generate admission number
    const allStudentsSnapshot = await getDocs(collection(firestore, 'students'));
    const prefix = settings?.admissionNumberPrefix || 'JKS';
    const capacity = settings?.totalStudentCapacity || 500;
    const padding = String(capacity).length;
    const nextStudentNumber = allStudentsSnapshot.size + 1;
    const admissionNumber = `${prefix}-${String(nextStudentNumber).padStart(padding, '0')}`;

    try {
        const batch = writeBatch(firestore);

        // 1. Create the student in the root /students collection
        const newStudentRef = doc(collection(firestore, 'students'));
        batch.set(newStudentRef, {
            name: studentName,
            admissionNumber: admissionNumber,
            gender: gender,
            dob: dob,
            parentName: parentName,
            contact: contact,
            isDeleted: false,
        });

        // 2. Create an enrollment document in the root /enrollments collection
        const enrollmentRef = doc(collection(firestore, 'enrollments'));
        batch.set(enrollmentRef, {
            studentId: newStudentRef.id,
            classroomId: classroomId,
            createdAt: serverTimestamp()
        });

        // 3. (FIX) Create a reference document in the classrooms/{id}/students subcollection
        const classStudentRef = doc(collection(firestore, 'classrooms', classroomId, 'students'), newStudentRef.id);
        batch.set(classStudentRef, {
            name: studentName,
            studentId: newStudentRef.id,
            createdAt: serverTimestamp()
        });


        await batch.commit();

        toast({ title: 'Student Added', description: `${studentName} has been added to the class.` });
        form.reset();
        setOpen(false);

    } catch (error) {
        console.error("Error adding student:", error);
        toast({variant: 'destructive', title: 'Error', description: 'Could not add the student.'});
    }

  };
  
    const sortedClassrooms = useMemo(() => {
        if (!classrooms) return [];
        return [...classrooms].sort((a, b) => a.name.localeCompare(b.name));
    }, [classrooms]);

  const isLoading = classroomsLoading || settingsLoading || enrollmentsLoading || studentsLoading;


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Students</h1>
        </div>
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
                Enter the student's details and assign them to a class. An admission number will be generated automatically.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStudent} className="grid gap-4 py-4">
               <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Student Name</Label>
                  <Input id="name" name="name" placeholder="John Doe" required />
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
                          sortedClassrooms?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
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
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" name="dob" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentName">Parent / Guardian Name</Label>
                    <Input id="parentName" name="parentName" placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">Contact Number</Label>
                    <Input id="contact" name="contact" placeholder="08012345678" />
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
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
            </Card>
        ) : (
             <Card>
                <CardHeader>
                <CardTitle>Student List by Class</CardTitle>
                <CardDescription>
                    Select a class to view the students enrolled in it.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Class Name</TableHead>
                                <TableHead>Number of Students</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedClassrooms.length > 0 ? sortedClassrooms.map((classroom) => (
                                <TableRow key={classroom.id}>
                                    <TableCell className="font-medium">{classroom.name}</TableCell>
                                    <TableCell>{studentCounts[classroom.id] || 0}</TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="outline" size="sm">
                                            <Link href={`/admin/students/${classroom.id}`}>
                                                View Students
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No classrooms found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
             </Card>
        )}
    </div>
  );
}
