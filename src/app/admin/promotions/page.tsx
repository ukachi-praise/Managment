
'use client';

import { useState, useMemo, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, getDocs, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Loader2, ArrowLeft, ArrowRight, UserCheck, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type Classroom = { id: string; name: string };
type Student = { id: string; name: string; isDeleted?: boolean; admissionNumber: string };
type StudentInClass = { id: string; studentId: string; name: string };
type Enrollment = { id: string; studentId: string; classroomId: string };

export default function PromotionsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [sourceClassId, setSourceClassId] = useState<string | null>(null);
  const [targetClassId, setTargetClassId] = useState<string | null>(null);
  const [studentsInSource, setStudentsInSource] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

  // --- Data Fetching ---
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classrooms')) : null),
    [firestore]
  );
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);

  const sortedClassrooms = useMemo(() => {
    if (!classrooms) return [];
    return [...classrooms].sort((a, b) => a.name.localeCompare(b.name));
  }, [classrooms]);

  // Fetch students when source class changes
  useEffect(() => {
    const fetchStudents = async () => {
      if (!sourceClassId || !firestore) {
        setStudentsInSource([]);
        return;
      }

      setIsFetching(true);
      try {
        const studentsInClassRef = collection(firestore, 'classrooms', sourceClassId, 'students');
        const studentsInClassSnap = await getDocs(studentsInClassRef);
        const studentIds = studentsInClassSnap.docs.map(d => (d.data() as StudentInClass).studentId);

        if (studentIds.length === 0) {
          setStudentsInSource([]);
          setIsFetching(false);
          return;
        }

        const studentDetails: Student[] = [];
        for (let i = 0; i < studentIds.length; i += 30) {
          const batchIds = studentIds.slice(i, i + 30);
          const q = query(collection(firestore, 'students'), where('__name__', 'in', batchIds));
          const snapshot = await getDocs(q);
          snapshot.forEach(doc => {
            const data = doc.data() as Omit<Student, 'id'>;
            if (!data.isDeleted) {
                studentDetails.push({ id: doc.id, ...data });
            }
          });
        }

        setStudentsInSource(studentDetails.sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedSelectedStudentIds(new Set()); // Reset selection
      } catch (error) {
        console.error("Error fetching students:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load pupils for the source class.' });
      } finally {
        setIsFetching(false);
      }
    };

    fetchStudents();
  }, [sourceClassId, firestore, toast]);

  const toggleStudentSelection = (studentId: string) => {
    const newSelection = new Set(selectedStudentIds);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedSelectedStudentIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedStudentIds.size === studentsInSource.length) {
      setSelectedSelectedStudentIds(new Set());
    } else {
      setSelectedSelectedStudentIds(new Set(studentsInSource.map(s => s.id)));
    }
  };

  const handlePromote = async () => {
    if (!firestore || !sourceClassId || !targetClassId || selectedStudentIds.size === 0) {
        toast({ variant: 'destructive', title: 'Invalid Operation', description: 'Please select classes and at least one pupil.' });
        return;
    }

    if (sourceClassId === targetClassId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Source and Target classes must be different.' });
        return;
    }

    setIsPromoting(true);
    toast({ title: 'Processing Promotions...', description: `Moving ${selectedStudentIds.size} student(s) to the new class.` });

    try {
        const batch = writeBatch(firestore);
        const selectedIdsArray = Array.from(selectedStudentIds);

        // 1. Update root /enrollments for each student
        const enrollmentsRef = collection(firestore, 'enrollments');
        // We need to find the specific enrollment doc for each student
        // This can be slow if we do it one by one, but batches are capped at 500 operations.
        // For safety, let's fetch them first.
        const enrollmentsQuery = query(enrollmentsRef, where('studentId', 'in', selectedIdsArray));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        
        enrollmentsSnapshot.forEach(enrollmentDoc => {
            batch.update(enrollmentDoc.ref, { classroomId: targetClassId });
        });

        // 2. Move records in the classroom subcollections
        for (const studentId of selectedIdsArray) {
            const student = studentsInSource.find(s => s.id === studentId);
            if (!student) continue;

            // Delete from source class
            const sourceRef = doc(firestore, 'classrooms', sourceClassId, 'students', studentId);
            batch.delete(sourceRef);

            // Add to target class
            const targetRef = doc(firestore, 'classrooms', targetClassId, 'students', studentId);
            batch.set(targetRef, {
                studentId: studentId,
                name: student.name,
                createdAt: serverTimestamp()
            });
        }

        await batch.commit();

        toast({ title: 'Success!', description: `Successfully promoted ${selectedStudentIds.size} student(s).` });
        
        // Refresh local state by clearing source class selection or re-fetching
        setSourceClassId(null);
        setTargetClassId(null);
        setStudentsInSource([]);
        setSelectedSelectedStudentIds(new Set());

    } catch (error: any) {
        console.error("Promotion Error:", error);
        toast({ variant: 'destructive', title: 'Promotion Failed', description: error.message || 'An error occurred while moving students.' });
    } finally {
        setIsPromoting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={() => router.back()} variant="outline" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Promotion Wizard</h1>
          <p className="text-muted-foreground">Batch transfer pupils from one class to another.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Class Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Select Source Class</CardTitle>
            <CardDescription>Pick the class the pupils are moving FROM.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSourceClassId} value={sourceClassId || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select Source Class" />
              </SelectTrigger>
              <SelectContent>
                {sortedClassrooms.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Target Class Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Select Target Class</CardTitle>
            <CardDescription>Pick the class the pupils are moving TO.</CardDescription>
          </CardHeader>
          <CardContent>
             <Select onValueChange={setTargetClassId} value={targetClassId || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select Target Class" />
              </SelectTrigger>
              <SelectContent>
                 {sortedClassrooms.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Pupil Selection Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Step 3: Select Pupils</CardTitle>
            <CardDescription>Choose which pupils to move to the target class.</CardDescription>
          </div>
          {selectedStudentIds.size > 0 && (
             <div className="flex items-center gap-4">
                <span className="text-sm font-medium">{selectedStudentIds.size} Pupil(s) Selected</span>
                <Button onClick={handlePromote} disabled={isPromoting || !targetClassId}>
                   {isPromoting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                   Promote Selected
                   <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
             </div>
          )}
        </CardHeader>
        <CardContent>
          {!sourceClassId ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-muted/50 rounded-lg border-2 border-dashed">
                <AlertTriangle className="h-8 w-8 mb-2 opacity-20" />
                <p>Please select a source class to view pupils.</p>
            </div>
          ) : isFetching ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : studentsInSource.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                        checked={selectedStudentIds.size === studentsInSource.length && studentsInSource.length > 0}
                        onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Pupil Name</TableHead>
                  <TableHead>Admission Number</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsInSource.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                       <Checkbox 
                        checked={selectedStudentIds.has(student.id)}
                        onCheckedChange={() => toggleStudentSelection(student.id)}
                       />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{student.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span>{student.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{student.admissionNumber}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <p>No pupils found in this class.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
