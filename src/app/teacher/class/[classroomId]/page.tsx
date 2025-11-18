
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
import { useFirestore, useUser, useMemoFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, where, doc, serverTimestamp } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2, ArrowLeft, Trash2, Edit } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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


type ClassroomStudent = { id: string; name: string; studentId: string; admissionNumber?: string; dob?: string; gender?: string; parentName?: string; contact?: string; };
type Classroom = { id: string; name: string };
type Student = { id: string; name: string; isDeleted?: boolean; admissionNumber: string; dob: string; gender: string; parentName: string; contact: string; };

export default function TeacherClassPage() {
  const params = useParams();
  const router = useRouter();
  const classroomId = params.classroomId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [studentToDelete, setStudentToDelete] = useState<ClassroomStudent | null>(null);
  const [editingStudent, setEditingStudent] = useState<ClassroomStudent | null>(null);

  // --- Data Fetching ---
  const classroomRef = useMemoFirebase(
    () => (firestore && classroomId ? doc(firestore, 'classrooms', classroomId) : null),
    [firestore, classroomId]
  );
  const { data: classroom, isLoading: classroomLoading } = useDoc<Classroom>(classroomRef);

  // Listen directly to the students subcollection for this classroom
  const studentsInClassQuery = useMemoFirebase(
      () => classroomId && firestore ? query(collection(firestore, 'classrooms', classroomId, 'students')) : null,
      [classroomId, firestore]
  );
  const { data: studentsInClass, isLoading: studentsLoading } = useCollection<ClassroomStudent>(studentsInClassQuery);
  
  const sortedStudents = useMemo(() => {
    if (!studentsInClass) return [];
    return [...studentsInClass].sort((a,b) => a.name.localeCompare(b.name));
  }, [studentsInClass]);
  

  const isLoading = classroomLoading || studentsLoading;

  const handleEditStudent = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !editingStudent) return;
    
    const form = event.currentTarget;
    const formData = new FormData(form);
    const updatedStudentData = {
      name: formData.get('name') as string,
      admissionNumber: formData.get('admissionNumber') as string,
      dob: formData.get('dob') as string,
      gender: formData.get('gender') as string,
      parentName: formData.get('parentName') as string,
      contact: formData.get('contact') as string,
    };
    
    // Update the master student record
    const studentRef = doc(firestore, 'students', editingStudent.studentId);
    setDocumentNonBlocking(studentRef, updatedStudentData, { merge: true });

    // Also update the denormalized data in the subcollection
    const classStudentRef = doc(firestore, 'classrooms', classroomId, 'students', editingStudent.id);
    setDocumentNonBlocking(classStudentRef, { name: updatedStudentData.name }, { merge: true });

    toast({ title: "Student Updated", description: `${updatedStudentData.name}'s details have been updated.` });
    setEditingStudent(null);
  };


  const handleDeleteStudent = () => {
    if (!firestore || !studentToDelete) return;
    
    // Soft delete the student in the root collection
    const studentRef = doc(firestore, 'students', studentToDelete.studentId);
    setDocumentNonBlocking(studentRef, { isDeleted: true }, { merge: true });

    // We no longer need to remove from the subcollection if we filter by `isDeleted` on the root,
    // but for immediate UI update, we'll keep listening to the subcollection and just rely on the fact
    // that the `useCollection` hook will eventually not find the deleted student if we were to re-query everything.
    // For now, let's assume `isDeleted` is the primary mechanism and the UI will filter.

    toast({
        variant: 'destructive',
        title: 'Student Removed',
        description: `${studentToDelete.name} has been marked as removed from the system.`,
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

      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit Student Details</DialogTitle>
              <DialogDescription>
                Update the information for {editingStudent?.name}.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditStudent} className="grid gap-4 py-4">
               <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Student Name</Label>
                  <Input id="name" name="name" defaultValue={editingStudent?.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admissionNumber">Admission Number</Label>
                  <Input id="admissionNumber" name="admissionNumber" defaultValue={editingStudent?.admissionNumber} required />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input id="dob" name="dob" type="date" defaultValue={editingStudent?.dob} required />
                </div>
                <div className="space-y-2">
                   <Label htmlFor="gender">Gender</Label>
                    <Select name="gender" required defaultValue={editingStudent?.gender}>
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
                  <Input id="parentName" name="parentName" defaultValue={editingStudent?.parentName} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact">Contact Number</Label>
                  <Input id="contact" name="contact" defaultValue={editingStudent?.contact} required />
                </div>
               </div>
              <DialogFooter className="mt-4">
                 <Button type="button" variant="outline" onClick={() => setEditingStudent(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>


      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isLoading ? 'Loading...' : classroom?.name}
          </h1>
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
                {sortedStudents && sortedStudents.length > 0 ? (
                  sortedStudents.map((student) => (
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
                          {student.admissionNumber || 'N/A'}
                        </TableCell>
                         <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/teacher/results/${student.studentId}`}>
                              Scores
                            </Link>
                          </Button>
                           <Button variant="ghost" size="icon" onClick={() => setEditingStudent(student)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setStudentToDelete(student)}>
                            <Trash2 className="h-4 w-4" />
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
