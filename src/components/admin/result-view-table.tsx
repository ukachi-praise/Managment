'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { calculateGrade } from '@/lib/utils';
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
  getDocs,
} from 'firebase/firestore';

// Define types based on backend.json
type Student = { id: string; name: string };
type Subject = { id: string; name: string };
type Classroom = { id: string; name: string; };
type Enrollment = { id: string; studentId: string; classroomId: string };
type Result = {
  id?: string;
  studentId: string;
  subjectId: string;
  classroomId: string;
  ca1: number | null;
  ca2: number | null;
  ca3: number | null;
  exam: number | null;
};

type StudentResults = {
    studentName: string;
    scores: Record<string, { total: number; grade: string }>; // subjectId -> score
};


export function ResultViewTable() {
  const firestore = useFirestore();

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [studentResults, setStudentResults] = useState<StudentResults[]>([]);
  const [isFetchingResults, setIsFetchingResults] = useState(false);
  

  // --- Data Fetching ---
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'classrooms') : null),
    [firestore]
  );
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  
  const classSubjectsQuery = useMemoFirebase(
    () =>
      selectedClass
        ? query(
            collection(firestore, 'classroomSubjects'),
            where('classroomId', '==', selectedClass)
          )
        : null,
    [selectedClass, firestore]
  );
  const { data: classSubjects, isLoading: classSubjectsLoading } = useCollection(classSubjectsQuery);

  const allSubjectsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'subjects') : null),
    [firestore]
  );
  const { data: allSubjects, isLoading: allSubjectsLoading } = useCollection<Subject>(allSubjectsQuery);

  const assignedSubjects = useMemo(() => {
    if (!classSubjects || !allSubjects) return [];
    const subjectIds = new Set(classSubjects.map(cs => cs.subjectId));
    return allSubjects.filter(s => subjectIds.has(s.id)).sort((a,b) => a.name.localeCompare(b.name));
  }, [classSubjects, allSubjects]);

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

  // --- Fetch existing results when class is selected ---
  useEffect(() => {
    if (!selectedClass) {
      setStudentResults([]);
      return;
    };
    
    const fetchResults = async () => {
        if (studentsInClass.length === 0) {
            setStudentResults([]);
            return;
        }
        setIsFetchingResults(true);
        const resultsQuery = query(
            collection(firestore, 'results'),
            where('classroomId', '==', selectedClass),
            // would also filter by termId and sessionId
        );

        const querySnapshot = await getDocs(resultsQuery);
        const allResultDocs = querySnapshot.docs.map(doc => ({ ...doc.data() as Result, id: doc.id }));

        const processedResults = studentsInClass.map(student => {
            const studentScores: Record<string, { total: number, grade: string }> = {};

            assignedSubjects.forEach(subject => {
                const result = allResultDocs.find(r => r.studentId === student.id && r.subjectId === subject.id);
                if (result) {
                    const total = (result.ca1 || 0) + (result.ca2 || 0) + (result.ca3 || 0) + (result.exam || 0);
                    const { grade } = calculateGrade(total);
                    studentScores[subject.id] = { total, grade };
                } else {
                    studentScores[subject.id] = { total: 0, grade: 'N/A' };
                }
            });

            return { studentName: student.name, scores: studentScores };
        });
        
        setStudentResults(processedResults);
        setIsFetchingResults(false);
    };

    fetchResults();
  }, [selectedClass, studentsInClass, assignedSubjects, firestore]);

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    setStudentResults([]);
  }
  
  const isLoading = classroomsLoading || allSubjectsLoading;
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
            <SelectTrigger>
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
                    <TableHead className="w-[250px] font-bold sticky left-0 bg-background z-10">Student Name</TableHead>
                    {classSubjectsLoading ? (
                        <TableHead>Loading Subjects...</TableHead>
                    ) : (
                        assignedSubjects.map(subject => (
                            <TableHead key={subject.id} className="text-center">{subject.name}</TableHead>
                        ))
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFetchingResults || enrollmentsLoading || allStudentsLoading ? (
                     <TableRow><TableCell colSpan={assignedSubjects.length + 1} className="text-center"><Loader2 className="inline-block animate-spin mr-2" /> Loading scores...</TableCell></TableRow>
                  ) : studentResults.length > 0 ? (
                    studentResults.map((studentResult) => (
                        <TableRow key={studentResult.studentName}>
                          <TableCell className="font-medium sticky left-0 bg-background z-10">{studentResult.studentName}</TableCell>
                          {assignedSubjects.map(subject => (
                              <TableCell key={subject.id} className="text-center">
                                  {studentResult.scores[subject.id]?.total ?? '--'}
                              </TableCell>
                          ))}
                        </TableRow>
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={assignedSubjects.length + 1} className="text-center h-24">
                           No students or results found for this class.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            Please select a class to view student scores.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
