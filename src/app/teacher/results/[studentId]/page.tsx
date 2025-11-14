
'use client';

import { useParams } from 'next/navigation';
import { useState, useMemo, useEffect, useCallback } from 'react';
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
  getDoc,
  DocumentReference,
  DocumentData,
} from 'firebase/firestore';

// Define types based on backend.json
type Student = { id: string; name: string; admissionNumber: string };
type ScoreableSubject = { id: string; name: string; };
type Enrollment = { id: string; studentId: string; classroomId: string };
type SchoolSettings = { currentSession: string; currentTermId: string; }
type Result = {
  id?: string; 
  studentId: string;
  subjectId: string;
  classroomId: string;
  sessionId: string;
  termId: string;
  ca1: number | null;
  ca2: number | null;
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
  const [isLoading, setIsLoading] = useState(true);

  // --- Data Fetching ---
  const studentRef = useMemoFirebase(() => (firestore ? doc(firestore, 'students', studentId) : null), [firestore, studentId]);
  const { data: student, isLoading: studentLoading } = useDoc<Student>(studentRef);
  
  const enrollmentsQuery = useMemoFirebase(
    () => (firestore && studentId ? query(collection(firestore, 'enrollments'), where('studentId', '==', studentId)) : null),
    [firestore, studentId]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const classroomId = useMemo(() => enrollments?.[0]?.classroomId, [enrollments]);

  const classroomSubjectsQuery = useMemoFirebase(() =>
      classroomId && firestore ? query(collection(firestore, 'classroomSubjects'), where('classroomId', '==', classroomId)) : null
  , [firestore, classroomId]);
  const { data: classroomSubjects, isLoading: classSubjectsLoading } = useCollection(classroomSubjectsQuery);

  const subjectsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'subjects') : null), [firestore]);
  const { data: individualSubjects, isLoading: subjectsLoading } = useCollection<ScoreableSubject>(subjectsQuery);
  const combinedSubjectsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'combinedSubjects') : null), [firestore]);
  const { data: combinedSubjects, isLoading: combinedSubjectsLoading } = useCollection<ScoreableSubject>(combinedSubjectsQuery);

  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: schoolSettings, isLoading: settingsLoading } = useDoc<SchoolSettings>(settingsRef);
  
  
  const subjectsForClass = useMemo(() => {
    if (!classroomSubjects || (!individualSubjects && !combinedSubjects)) return [];
    
    const allScoreableSubjects = new Map<string, ScoreableSubject>();
    individualSubjects?.forEach(s => allScoreableSubjects.set(s.id, s));
    combinedSubjects?.forEach(cs => allScoreableSubjects.set(cs.id, cs));

    const subjectIdsForClass = new Set(classroomSubjects.map(cs => cs.subjectId));
    
    return Array.from(subjectIdsForClass)
        .map(id => allScoreableSubjects.get(id))
        .filter((s): s is ScoreableSubject => !!s)
        .sort((a,b) => a.name.localeCompare(b.name));

  }, [classroomSubjects, individualSubjects, combinedSubjects]);

  const handleScoreChange = (
    subjectId: string,
    field: 'ca1' | 'ca2' | 'exam',
    value: string
  ) => {
    const numericValue = value === '' ? null : Number(value);

    setResults((prevResults) => ({
      ...prevResults,
      [subjectId]: {
        ...prevResults[subjectId],
        [field]: numericValue,
      },
    }));
  };
  
  const handleSave = async () => {
    if (!classroomId || !schoolSettings || !firestore || !user) {
        toast({ variant: 'destructive', title: 'Save Error', description: 'Could not save. Missing critical information.' });
        return;
    }

    setIsSaving(true);
    
    for (const subjectId in results) {
        const result = results[subjectId];
        // Use a composite key to ensure a unique document per student-subject-term-session
        const resultId = `${studentId}-${subjectId}-${schoolSettings.currentSession.replace('/', '-')}-${schoolSettings.currentTermId}`; 
        const resultRef = doc(firestore, 'results', resultId);
        
        // Ensure all required fields are present before saving
        const resultToSave: Result = {
            studentId: studentId,
            subjectId: subjectId,
            classroomId: classroomId,
            sessionId: schoolSettings.currentSession,
            termId: schoolSettings.currentTermId,
            ca1: result.ca1 ?? null,
            ca2: result.ca2 ?? null,
            exam: result.exam ?? null,
        };

        setDocumentNonBlocking(resultRef, resultToSave, { merge: true });
    }
    
    setTimeout(() => { 
        setIsSaving(false);
        toast({
          title: 'Scores Saved!',
          description: `Scores for ${student?.name} have been updated.`,
        });
        router.push(`/results/${studentId}`);
    }, 1500);
  };

  useEffect(() => {
    const areDependenciesLoaded = 
      !studentLoading &&
      !enrollmentsLoading &&
      !classSubjectsLoading &&
      !subjectsLoading &&
      !combinedSubjectsLoading &&
      !settingsLoading &&
      subjectsForClass.length > 0 &&
      schoolSettings &&
      classroomId &&
      firestore;

    if (!areDependenciesLoaded) {
      setIsLoading(true);
      return;
    }

    const fetchInitialResults = async () => {
      const initialResultsState: Record<string, Result> = {};
      
      for (const subject of subjectsForClass) {
        const resultId = `${studentId}-${subject.id}-${schoolSettings.currentSession.replace('/', '-')}-${schoolSettings.currentTermId}`;
        const resultRef = doc(firestore, 'results', resultId);
        
        const docSnap = await getDoc(resultRef);

        if (docSnap.exists()) {
          initialResultsState[subject.id] = { id: docSnap.id, ...docSnap.data() } as Result;
        } else {
          initialResultsState[subject.id] = {
            studentId: studentId,
            subjectId: subject.id,
            classroomId: classroomId,
            sessionId: schoolSettings.currentSession,
            termId: schoolSettings.currentTermId,
            ca1: null,
            ca2: null,
            exam: null,
          };
        }
      }
      setResults(initialResultsState);
      setIsLoading(false);
    };

    fetchInitialResults();
  
  }, [
      studentId, 
      classroomId, 
      schoolSettings, 
      firestore, 
      subjectsForClass, 
      studentLoading, 
      enrollmentsLoading, 
      classSubjectsLoading, 
      subjectsLoading, 
      combinedSubjectsLoading, 
      settingsLoading
  ]);
  
  const pageIsLoading = studentLoading || isLoading;

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
        {pageIsLoading ? (
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
                    <TableHead>CA1 (20)</TableHead>
                    <TableHead>CA2 (20)</TableHead>
                    <TableHead>Exam (60)</TableHead>
                    <TableHead>Total (100)</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjectsForClass.length === 0 && (
                     <TableRow><TableCell colSpan={6} className="text-center h-24">No subjects assigned to this class.</TableCell></TableRow>
                  )}
                  {subjectsForClass.map((subject) => {
                      const result = results[subject.id] || { ca1: null, ca2: null, exam: null };
                      const total = (result.ca1 || 0) + (result.ca2 || 0) + (result.exam || 0);
                      const { grade: finalGrade } = calculateGrade(total);

                      return (
                        <TableRow key={subject.id}>
                          <TableCell className="font-medium">{subject.name}</TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="h-8 w-20 text-sm"
                              value={result.ca1 ?? ''}
                              onChange={(e) => handleScoreChange(subject.id, 'ca1', e.target.value)}
                              max={20}
                            />
                          </TableCell>
                           <TableCell>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="h-8 w-20 text-sm"
                              value={result.ca2 ?? ''}
                              onChange={(e) => handleScoreChange(subject.id, 'ca2', e.target.value)}
                              max={20}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="h-8 w-20 text-sm"
                              value={result.exam ?? ''}
                              onChange={(e) => handleScoreChange(subject.id, 'exam', e.target.value)}
                              max={60}
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
              <Button onClick={handleSave} disabled={isSaving || pageIsLoading || subjectsForClass.length === 0}>
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
