'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import {
  useFirestore,
  useCollection,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import {
  collection,
  query,
  where,
} from 'firebase/firestore';

// Define types based on backend.json
type Student = { id: string; name: string };
type Classroom = { id: string; name: string; };
type Enrollment = { id: string; studentId: string; classroomId: string };


export function ResultViewTable() {
  const firestore = useFirestore();

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  
  // --- Data Fetching ---
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'classrooms') : null),
    [firestore]
  );
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  
  const enrollmentsQuery = useMemoFirebase(
    () =>
      selectedClass
        ? query(
            collection(firestore, 'enrollments'),
            where('classroomId', '==', selectedClass)
          )
        : null,
    [selectedClass, firestore]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const allStudentsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'students') : null),
    [firestore]
  );
  const { data: allStudents, isLoading: allStudentsLoading } = useCollection<Student>(allStudentsQuery);
  
  const studentsInClass = useMemo(() => {
      if (!enrollments || !allStudents) return [];
      const studentIds = new Set(enrollments.map(e => e.studentId));
      return allStudents.filter(s => studentIds.has(s.id)).sort((a,b) => a.name.localeCompare(b.name));
  }, [enrollments, allStudents]);


  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
  }
  
  const isLoading = classroomsLoading;
  const isFetchingStudents = enrollmentsLoading || allStudentsLoading;
  const isDisplayingData = selectedClass;

  if (isLoading) {
    return <Card><CardHeader><CardTitle>Loading Data...</CardTitle></CardHeader><CardContent><Loader2 className="animate-spin" /></CardContent></Card>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>View Results by Class</CardTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Select onValueChange={handleClassChange} value={selectedClass || ''}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder="Select a Class" />
            </SelectTrigger>
            <SelectContent>
              {classrooms?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isDisplayingData ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFetchingStudents ? (
                     <TableRow><TableCell colSpan={1} className="text-center"><Loader2 className="inline-block animate-spin mr-2" /> Loading students...</TableCell></TableRow>
                  ) : studentsInClass.length > 0 ? (
                    studentsInClass.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">
                            <Link href={`/admin/students/${student.id}/results`} className="hover:underline">
                              {student.name}
                            </Link>
                          </TableCell>
                        </TableRow>
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={1} className="text-center h-24">
                           No students found for this class.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            Please select a class to view the list of students.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
