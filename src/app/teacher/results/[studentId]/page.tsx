
'use client';

import { useParams } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { calculateGrade } from '@/lib/utils';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

import {
  useFirestore,
  useCollection,
  useDoc,
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
type Student = { id: string; name: string; admissionNumber: string };
type Subject = { id: string; name: string };
type Classroom = { id: string; name: string; teacherId?: string };
type Enrollment = { id: string; studentId: string; classroomId: string };
type SchoolSettings = { currentSession: string; currentTermId: string; }
type Result = {
  id?: string; // It will have an id when fetched
  studentId: string;
  subjectId: string;
  classroomId: string;
  sessionId: string;
  termId: string;
  ca1: number | null;
  ca2: number | null;
  ca3: number | null;
  exam: number | null;
};

export default function StudentResultEntryPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const router = useRouter();

  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const [results, setResults] = useState<Record<string, Result>>({}); // subjectId -> Result
  const [isSaving, setIsSaving] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // --- Data Fetching ---
  const studentRef = useMemoFirebase(() => doc(firestore, 'students', studentId), [firestore, studentId]);
  const { data: student, isLoading: studentLoading } = useDoc<Student>(studentRef);
  
  const enrollmentsQuery = useMemoFirebase(
    () => query(collection(firestore, 'enrollments'), where('studentId', '==', studentId)),
    [firestore, studentId]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const classroomId = useMemo(() => enrollments?.[0]?.classroomId, [enrollments]);

  const classroomSubjectsQuery = useMemoFirebase(() =>
      classroomId ? query(collection(firestore, 'classroomSubjects'), where('classroomId', '==', classroomId)) : null
  , [firestore, classroomId]);
  const { data: classroomSubjects, isLoading: classSubjectsLoading } = useCollection(classroomSubjectsQuery);

  const allSubjectsQuery = useMemoFirebase(() => collection(firestore, 'subjects'), [firestore]);
  const { data: allSubjects, isLoading: allSubjectsLoading } = useCollection<Subject>(allSubjectsQuery);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'schoolSettings', 'current'), [firestore]);
  const { data: schoolSettings, isLoading: settingsLoading } = useDoc<SchoolSettings>(settingsRef);
  
  const subjects = useMemo(() => {
    if (!classroomSubjects || !allSubjects) return [];
    const subjectIds = new Set(classroomSubjects.map(cs => cs.subjectId));
    return allSubjects.filter(s => subjectIds.has(s.id)).sort((a,b) => a.name.localeCompare(b.name));
  }, [classroomSubjects, allSubjects]);


  useEffect(() => {
    if (!classroomId || subjects.length === 0 || !schoolSettings || !firestore) {
      setResults({});
      setInitialFetchDone(false);
      return;
    };
    
    const fetchResults = async () => {
        setIsSaving(true);
        const resultsQuery = query(
            collection(firestore, 'results'),
            where('classroomId', '==', classroomId),
            where('studentId', '==', studentId),
            where('sessionId', '==', schoolSettings.currentSession),
            where('termId', '==', schoolSettings.currentTermId)
        );

        const querySnapshot = await getDocs(resultsQuery);
        const fetchedResults: Record<string, Result> = {};
        querySnapshot.forEach((doc) => {
            const data = doc.data() as Result;
            fetchedResults[data.subjectId] = { ...data, id: doc.id };
        });

        // Pre-fill results for subjects that don't have any yet
        subjects.forEach(subject => {
          if (!fetchedResults[subject.id]) {
            fetchedResults[subject.id] = {
              studentId: studentId,
              subjectId: subject.id,
              classroomId: classroomId,
              sessionId: schoolSettings.currentSession,
              termId: schoolSettings.currentTermId,
              ca1: null, ca2: null, ca3: null, exam: null
            };
          }
        });
        
        setResults(fetchedResults);
        setIsSaving(false);
        setInitialFetchDone(true);
    };

    fetchResults();
  }, [classroomId, studentId, subjects, schoolSettings, firestore]);

  const handleScoreChange = (
    subjectId: string,
    field: 'ca1' | 'ca2' | 'ca3' | 'exam',
    value: string
  ) => {
    const numericValue = value === '' ? null : Number(value);

    setResults((prevResults) => ({
      ...prevResults,
      [subjectId]: {
        ...(prevResults[subjectId] || {
            studentId: studentId,
            subjectId: subjectId,
            classroomId: classroomId!,
            sessionId: schoolSettings!.currentSession,
            termId: schoolSettings!.currentTermId,
        }),
        [field]: numericValue,
      },
    }));
  };
  
  const handleSave = () => {
    if (!classroomId || !schoolSettings || !firestore) return;
    setIsSaving(true);
    
    Object.values(results).forEach(result => {
        const hasAnyScore = result.ca1 !== null || result.ca2 !== null || result.ca3 !== null || result.exam !== null;
        
        if (hasAnyScore) {
             const resultWithIds = {
                ...result,
                studentId: studentId,
                classroomId: classroomId,
                sessionId: schoolSettings.currentSession,
                termId: schoolSettings.currentTermId,
            };
            // Use a predictable ID to ensure updates happen on the same doc
            const resultId = result.id || `${studentId}_${result.subjectId}_${schoolSettings.termId}`; 
            const resultRef = doc(firestore, 'results', resultId);
            setDocumentNonBlocking(resultRef, resultWithIds, { merge: true });
        }
    });
    
    // Give feedback after a short delay to allow for non-blocking writes to initiate
    setTimeout(() => { 
        setIsSaving(false);
        toast({
          title: 'Scores Saved!',
          description: `Scores for ${student?.name} have been updated.`,
        });
    }, 1500);
  };
  
  const isLoading = studentLoading || enrollmentsLoading || classSubjectsLoading || allSubjectsLoading || settingsLoading;
  const isDisplayingData = !isLoading && initialFetchDone;

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                Result Entry for {student?.name || '...'}
                </h1>
                <p className="text-muted-foreground">
                Enter CA and Exam scores for each subject below.
                </p>
            </div>
            <Button onClick={() => router.back()} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Student List
            </Button>
      </div>

    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle>Enter Scores</CardTitle>
            <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">Session: <span className="font-semibold text-foreground">{schoolSettings?.currentSession || '...'}</span></span>
                <span className="text-muted-foreground">Term: <span className="font-semibold text-foreground">{schoolSettings?.currentTermId ? schoolSettings.currentTermId.replace('term', '') : '...'}</span></span>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Subject</TableHead>
                    <TableHead>CA1 (10)</TableHead>
                    <TableHead>CA2 (10)</TableHead>
                    <TableHead>CA3 (10)</TableHead>
                    <TableHead>Exam (70)</TableHead>
                    <TableHead>Total (100)</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.length === 0 && (
                     <TableRow><TableCell colSpan={7} className="text-center h-24">No subjects assigned to this class.</TableCell></TableRow>
                  )}
                  {subjects.map((subject) => {
                      const result = results[subject.id] || { ca1: null, ca2: null, ca3: null, exam: null };
                      const total = (result.ca1 || 0) + (result.ca2 || 0) + (result.ca3 || 0) + (result.exam || 0);
                      const { grade: finalGrade } = calculateGrade(total);

                      return (
                        <TableRow key={subject.id}>
                          <TableCell className="font-medium">{subject.name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20"
                              value={result.ca1 ?? ''}
                              onChange={(e) => handleScoreChange(subject.id, 'ca1', e.target.value)}
                              max={10}
                            />
                          </TableCell>
                           <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20"
                              value={result.ca2 ?? ''}
                              onChange={(e) => handleScoreChange(subject.id, 'ca2', e.target.value)}
                              max={10}
                            />
                          </TableCell>
                           <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20"
                              value={result.ca3 ?? ''}
                              onChange={(e) => handleScoreChange(subject.id, 'ca3', e.target.value)}
                              max={10}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-20"
                              value={result.exam ?? ''}
                              onChange={(e) => handleScoreChange(subject.id, 'exam', e.target.value)}
                              max={70}
                            />
                          </TableCell>
                          <TableCell className="font-semibold">{total}</TableCell>
                          <TableCell className="font-semibold">{finalGrade}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave} disabled={isSaving || subjects.length === 0}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save All Scores
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

