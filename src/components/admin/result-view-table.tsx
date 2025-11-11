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

export function ResultViewTable() {
  const firestore = useFirestore();

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({}); // studentId -> Result
  const [isFetchingResults, setIsFetchingResults] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

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
    return allSubjects.filter(s => subjectIds.has(s.id));
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
      return allStudents.filter(s => studentIds.has(s.id));
  }, [enrollments, allStudents]);

  // --- Fetch existing results when class and subject are selected ---
  useEffect(() => {
    if (!selectedClass || !selectedSubject) {
      setResults({});
      setInitialFetchDone(false);
      return;
    };
    
    const fetchResults = async () => {
        setIsFetchingResults(true);
        const resultsQuery = query(
            collection(firestore, 'results'),
            where('classroomId', '==', selectedClass),
            where('subjectId', '==', selectedSubject)
            // would also filter by termId and sessionId
        );

        const querySnapshot = await getDocs(resultsQuery);
        const fetchedResults: Record<string, Result> = {};
        querySnapshot.forEach((doc) => {
            const data = doc.data() as Result;
            fetchedResults[data.studentId] = { ...data, id: doc.id };
        });

        // Pre-fill results for students who don't have any yet
        studentsInClass.forEach(student => {
          if (!fetchedResults[student.id]) {
            fetchedResults[student.id] = {
              studentId: student.id,
              subjectId: selectedSubject,
              classroomId: selectedClass,
              ca1: null, ca2: null, ca3: null, exam: null
            };
          }
        });
        
        setResults(fetchedResults);
        setIsFetchingResults(false);
        setInitialFetchDone(true);
    };

    fetchResults();
  }, [selectedClass, selectedSubject, studentsInClass, firestore]);

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    setSelectedSubject(null);
    setResults({});
    setInitialFetchDone(false);
  }
  
  const isLoading = classroomsLoading || allSubjectsLoading;
  const isDisplayingData = selectedClass && selectedSubject;

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
          <Select onValueChange={setSelectedSubject} value={selectedSubject || ''} disabled={!selectedClass || classSubjectsLoading}>
            <SelectTrigger>
              <SelectValue placeholder={classSubjectsLoading ? "Loading..." : "Select a Subject"} />
            </SelectTrigger>
            <SelectContent>
              {assignedSubjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
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
                    <TableHead className="w-[250px]">Student Name</TableHead>
                    <TableHead>CA1 (10)</TableHead>
                    <TableHead>CA2 (10)</TableHead>
                    <TableHead>CA3 (10)</TableHead>
                    <TableHead>Exam (70)</TableHead>
                    <TableHead>Total (100)</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFetchingResults || enrollmentsLoading || allStudentsLoading ? (
                     <TableRow><TableCell colSpan={8} className="text-center"><Loader2 className="inline-block animate-spin mr-2" /> Loading scores...</TableCell></TableRow>
                  ) : (
                    studentsInClass.map((student) => {
                      const result = results[student.id] || { ca1: 0, ca2: 0, ca3: 0, exam: 0 };
                      const total = (result.ca1 || 0) + (result.ca2 || 0) + (result.ca3 || 0) + (result.exam || 0);
                      const { grade: finalGrade, remark } = calculateGrade(total);

                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>{result.ca1 || '--'}</TableCell>
                          <TableCell>{result.ca2 || '--'}</TableCell>
                          <TableCell>{result.ca3 || '--'}</TableCell>
                          <TableCell>{result.exam || '--'}</TableCell>
                          <TableCell>{total}</TableCell>
                          <TableCell>{finalGrade}</TableCell>
                          <TableCell>{remark}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            Please select a class and subject to view student scores.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
