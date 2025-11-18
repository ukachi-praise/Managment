
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
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
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, where, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
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
import { DialogFooter } from '@/components/ui/dialog';

type Enrollment = { id: string; classroomId: string; studentId: string; };
type Student = { id: string; name: string; isDeleted?: boolean; admissionNumber: string; dob: string; gender: string; parentName: string; contact: string; };
type Classroom = { id: string; name: string };

export default function TeacherClassPage() {
  const params = useParams();
  const router = useRouter();
  const classroomId = params.classroomId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [classroomName, setClassroomName] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<Student[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);

  // Query the classrooms/{id}/students subcollection
  const studentsInClassQuery = useMemoFirebase(
    () => {
      if (!classroomId || !firestore) {
        return null;
      }
      return query(collection(firestore, 'classrooms', classroomId, 'students'));
    },
    [classroomId, firestore]
  );
  const { data: studentsInClass, isLoading: studentsLoading } = useCollection<{id: string; name: string; studentId: string}>(studentsInClassQuery);
  
  // Fetch full student details from the root /students collection
  useEffect(() => {
    const fetchStudentDetails = async () => {
      if (!firestore || !studentsInClass) {
        setStudentDetails([]);
        setDetailsLoading(false); // Stop loading if there's nothing to fetch
        return;
      }
      
      if (studentsInClass.length === 0) {
        setStudentDetails([]);
        setDetailsLoading(false);
        return;
      }

      setDetailsLoading(true);
      try {
        const studentIds = studentsInClass.map(e => e.studentId);
        
        if (studentIds.length === 0) {
            setStudentDetails([]);
            setDetailsLoading(false);
            return;
        }

        const batches = [];
        for (let i = 0; i < studentIds.length; i += 30) {
          const batch = studentIds.slice(i, i + 30);
          if (batch.length > 0) {
            const q = query(collection(firestore, 'students'), where('__name__', 'in', batch));
            batches.push(getDocs(q));
          }
        }

        const results = await Promise.all(batches);
        const allStudents: Student[] = [];
        
        results.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            allStudents.push({ id: doc.id, ...doc.data() } as Student);
          });
        });
        setStudentDetails(allStudents);
      } catch (error) {
        console.error('Error fetching student details:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load student details.'
        });
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchStudentDetails();
  }, [firestore, studentsInClass, toast]);
  
  const combinedStudentData = useMemo(() => {
    if (!studentsInClass || !studentDetails) return [];
    
    const detailsMap = new Map(studentDetails.map(d => [d.id, d]));
    
    return studentsInClass
      .map(e => {
        const details = detailsMap.get(e.studentId);
        if (!details || details.isDeleted) return null;
        return { ...details };
      })
      .filter((s): s is Student => s !== null)
      .sort((a,b) => a.name.localeCompare(b.name));

  }, [studentsInClass, studentDetails]);


  useEffect(() => {
    const fetchClassroomName = async () => {
        if (firestore && classroomId) {
            const docRef = doc(firestore, 'classrooms', classroomId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setClassroomName(docSnap.data().name);
            }
        }
    };
    fetchClassroomName();
  }, [firestore, classroomId]);


  const isLoading = studentsLoading || detailsLoading;
  
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
    const studentRef = doc(firestore, 'students', editingStudent.id);
    setDocumentNonBlocking(studentRef, updatedStudentData, { merge: true });

    toast({ title: "Student Updated", description: `${updatedStudentData.name}'s details have been updated.` });
    setEditingStudent(null);
  };


  const handleDeleteStudent = async () => {
    if (!firestore || !studentToDelete || !classroomId) return;
    
    try {
        const batch = writeBatch(firestore);

        // 1. Mark the main student record as deleted
        const studentRef = doc(firestore, 'students', studentToDelete.id);
        batch.update(studentRef, { isDeleted: true });

        // 2. Delete their reference from the classroom's subcollection
        const classStudentRef = doc(firestore, 'classrooms', classroomId, 'students', studentToDelete.id);
        batch.delete(classStudentRef);
        
        // 3. Delete from the root /enrollments collection
        const enrollmentsQuery = query(collection(firestore, 'enrollments'), where('studentId', '==', studentToDelete.id), where('classroomId', '==', classroomId));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        enrollmentsSnapshot.forEach(doc => batch.delete(doc.ref));

        await batch.commit();

        toast({
            variant: 'destructive',
            title: 'Student Removed',
            description: `${studentToDelete.name} has been moved to the Recycle Bin.`,
        });
    } catch(error: any) {
        toast({
            variant: 'destructive',
            title: 'Error Removing Student',
            description: error.message || 'Could not remove the student.',
        });
    } finally {
        setStudentToDelete(null);
    }
  }

  return (
    <div className="space-y-6">
      <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will remove <span className="font-semibold">{studentToDelete?.name}</span> from the class. This action moves the student to the recycle bin but does not permanently erase their data.
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
                  <Input id="dob" name="dob" type="date" defaultValue={editingStudent?.dob} />
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
                  <Input id="parentName" name="parentName" defaultValue={editingStudent?.parentName} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact">Contact Number</Label>
                  <Input id="contact" name="contact" defaultValue={editingStudent?.contact} />
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
            {classroomName || 'Loading...'}
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
          {isLoading && combinedStudentData.length === 0 ? (
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
                {combinedStudentData && combinedStudentData.length > 0 ? (
                  combinedStudentData.map((student) => (
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
                            <Link href={`/teacher/results/${student.id}`}>
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

    