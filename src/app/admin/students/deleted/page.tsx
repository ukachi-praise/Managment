
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
import { ArrowLeft, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import {
  useCollection,
} from '@/firebase/firestore/use-collection';
import {
  useFirestore,
  useMemoFirebase,
} from '@/firebase/provider';
import { collection, query, doc, writeBatch, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';


type Student = {
  id: string;
  name: string;
  admissionNumber: string;
  isDeleted?: boolean;
};


export default function DeletedStudentsPage() {
  const [studentToRestore, setStudentToRestore] = useState<Student | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const deletedStudentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'students'), where('isDeleted', '==', true)) : null),
    [firestore]
  );
  const { data: deletedStudents, isLoading } = useCollection<Student>(deletedStudentsQuery);

  const handleRestoreStudent = () => {
    if (!firestore || !studentToRestore) return;
    
    setIsRestoring(true);
    const studentRef = doc(firestore, 'students', studentToRestore.id);
    
    setDocumentNonBlocking(studentRef, { isDeleted: false }, { merge: true });

    toast({
        title: 'Student Restored',
        description: `${studentToRestore.name} has been restored. You will need to re-enroll them into a class.`,
    });
    setStudentToRestore(null);
    setIsRestoring(false);
  }

  const openRestoreDialog = (student: Student) => {
    setStudentToRestore(student);
  }

  const sortedStudents = useMemo(() => {
    if (!deletedStudents) return [];
    return [...deletedStudents].sort((a, b) => a.name.localeCompare(b.name));
  }, [deletedStudents]);


  return (
    <div className="space-y-6">
      <AlertDialog open={!!studentToRestore} onOpenChange={(open) => !open && setStudentToRestore(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Restore Student?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will restore <span className="font-semibold">{studentToRestore?.name}</span>. They will be marked as active, but you will need to manually enroll them back into a class.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRestoreStudent} disabled={isRestoring}>
                  {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4" />}
                  Restore Student
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Recycle Bin</h1>
        </div>
      </div>

        <Card>
            <CardHeader>
            <CardTitle>Deleted Students</CardTitle>
            <CardDescription>
                This is a list of all students who have been removed from classes. You can restore them from here.
            </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-48">
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
                            {sortedStudents.length > 0 ? sortedStudents.map((student) => (
                                <TableRow key={student.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarFallback>{student.name.charAt(0).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <span>{student.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{student.admissionNumber}</TableCell>
                                    <TableCell className="text-right">
                                        <Button onClick={() => openRestoreDialog(student)} variant="outline" size="sm">
                                            <RotateCcw className="mr-2 h-4 w-4" />
                                            Restore
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        The recycle bin is empty.
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
