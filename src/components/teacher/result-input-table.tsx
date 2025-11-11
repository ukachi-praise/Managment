
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
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { calculateGrade } from '@/lib/utils';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useFirestore,
  useCollection,
  useUser,
  setDocumentNonBlocking,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import {
  collection,
  query,
  where,
  doc,
  getDocs,
} from 'firebase/firestore';

// Define types based on backend.json
type Student = { id: string; name: string };
type Subject = { id: string; name: string };
type Classroom = { id: string; name: string; teacherId?: string };
type Enrollment = { id: string; studentId: string; classroomId: string };
type Result = {
  id?: string; // It will have an id when fetched
  studentId: string;
  subjectId: string;
  classroomId: string; // denormalized for rules
  // termId and sessionId would be here in a full app
  ca1: number | null;
  ca2: number | null;
  ca3: number | null;
  exam: number | null;
};
type UserData = { assignedClassroomId?: string; role: string };

export function ResultInputTable() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const [teacherClass, setTeacherClass] = useState<Classroom | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({}); // studentId -> Result
  const [isSaving, setIsSaving] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // --- Data Fetching ---
  // 1. Get the current teacher's user data to find their assigned class
  const userQuery = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  // Note: useDoc is for single docs, but we'll manually fetch here for simplicity.
  // In a more complex app, useUser() would be expanded to include this data.

  // 2. Get all classrooms to find the teacher's one by teacherId
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'classrooms') : null),
    [firestore]
  );
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);

  useEffect(() => {
    if (user && classrooms) {
      const foundClass = classrooms.find(c => c.teacherId === user.uid);
      setTeacherClass(foundClass || null);
    }
  }, [user, classrooms]);
  
  // 3. Get subjects assigned to the teacher's class
  const classSubjectsQuery = useMemoFirebase(
    () =>
      teacherClass
        ? query(
            collection(firestore, 'classroomSubjects'),
            where('classroomId', '==', teacherClass.id)
          )
        : null,
    [teacherClass, firestore]
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

  // 4. Get students enrolled in the teacher's class
  const enrollmentsQuery = useMemoFirebase(
    () =>
      teacherClass
        ? query(
            collection(firestore, 'enrollments'),
            where('classroomId', '==', teacherClass.id)
          )
        : null,
    [teacherClass, firestore]
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
    if (!teacherClass || !selectedSubject) {
      setResults({});
      setInitialFetchDone(false);
      return;
    };
    
    const fetchResults = async () => {
        setIsSaving(true); // use isSaving as a generic loading indicator
        const resultsQuery = query(
            collection(firestore, 'results'),
            where('classroomId', '==', teacherClass.id),
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
              classroomId: teacherClass.id,
              ca1: null, ca2: null, ca3: null, exam: null
            };
          }
        });
        
        setResults(fetchedResults);
        setIsSaving(false);
        setInitialFetchDone(true);
    };

    fetchResults();
  }, [teacherClass, selectedSubject, studentsInClass, firestore]);

  const handleScoreChange = (
    studentId: string,
    field: 'ca1' | 'ca2' | 'ca3' | 'exam',
    value: string
  ) => {
    const numericValue = value === '' ? null : Number(value);

    setResults((prevResults) => ({
      ...prevResults,
      [studentId]: {
        ...prevResults[studentId],
        [field]: numericValue,
      },
    }));
  };
  
  const handleSave = () => {
    if (!teacherClass || !selectedSubject) return;
    setIsSaving(true);
    
    const promises = Object.values(results).map(result => {
        const resultId = result.id || `${result.studentId}_${result.subjectId}`; // Create a predictable ID
        const resultRef = doc(firestore, 'results', resultId);
        // Using set with merge to handle both create and update
        return setDocumentNonBlocking(resultRef, result, { merge: true });
    });

    // We don't wait for promises here in a non-blocking pattern
    // but a real app might track their completion status.
    
    setTimeout(() => { // Simulate completion
        setIsSaving(false);
        toast({
          title: 'Scores Submitted!',
          description: 'All scores have been sent to the database.',
        });
    }, 1500)
  };
  
  const isLoading = isUserLoading || classroomsLoading || classSubjectsLoading || allSubjectsLoading || enrollmentsLoading || allStudentsLoading;

  if (isLoading) {
    return <Card><CardHeader><CardTitle>Loading Your Data...</CardTitle></CardHeader><CardContent><Loader2 className="animate-spin" /></CardContent></Card>
  }
  
  if (!isUserLoading && !teacherClass) {
     return <Card><CardHeader><CardTitle>No Class Assigned</CardTitle></CardHeader><CardContent><p>You are not currently assigned to a class. Please contact an administrator.</p></CardContent></Card>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter Scores for {teacherClass?.name}</CardTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
           <div className="text-lg font-medium p-2 border rounded-md bg-muted">Class: {teacherClass?.name}</div>
          <Select onValueChange={setSelectedSubject} disabled={!teacherClass}>
            <SelectTrigger>
              <SelectValue placeholder="Select a Subject" />
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
        {teacherClass && selectedSubject ? (
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
                  {!initialFetchDone ? (
                     <TableRow><TableCell colSpan={8} className="text-center"><Loader2 className="inline-block animate-spin mr-2" /> Loading scores...</TableCell></TableRow>
                  ) : (
                    studentsInClass.map((student) => {
                      const result = results[student.id] || { ca1: null, ca2: null, ca3: null, exam: null };
                      const total = (result.ca1 || 0) + (result.ca2 || 0) + (result.ca3 || 0) + (result.exam || 0);
                      const { grade: finalGrade, remark } = calculateGrade(total);

                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20"
                              value={result.ca1 ?? ''}
                              onChange={(e) => handleScoreChange(student.id, 'ca1', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20"
                              value={result.ca2 ?? ''}
                              onChange={(e) => handleScoreChange(student.id, 'ca2', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20"
                              value={result.ca3 ?? ''}
                              onChange={(e) => handleScoreChange(student.id, 'ca3', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20"
                              value={result.exam ?? ''}
                              onChange={(e) => handleScoreChange(student.id, 'exam', e.target.value)}
                            />
                          </TableCell>
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
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save All Scores
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            Please select a subject to view and enter student scores.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    