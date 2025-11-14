
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
  errorEmitter,
  FirestorePermissionError,
  useAuth,
} from '@/firebase';
import { sendEmailVerification, User } from 'firebase/auth';
import { useMemoFirebase } from '@/firebase/provider';
import {
  collection,
  query,
  where,
  doc,
  getDocs,
  getDoc,
} from 'firebase/firestore';

// Define types based on backend.json
type Student = { id: string; name: string; admissionNumber: string };
// This now includes both individual and combined subjects
type ScoreableSubject = { id: string; name: string; };
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
  exam: number | null;
};
type UserData = { assignedClassroomId?: string; };

export default function StudentResultEntryPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const router = useRouter();

  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const auth = useAuth();

  const [results, setResults] = useState<Record<string, Result>>({}); // subjectId -> Result
  const [isSaving, setIsSaving] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [teacherData, setTeacherData] = useState<UserData | null>(null);

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

  // Fetch both individual and combined subjects
  const subjectsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'subjects') : null), [firestore]);
  const { data: individualSubjects, isLoading: subjectsLoading } = useCollection<ScoreableSubject>(subjectsQuery);
  const combinedSubjectsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'combinedSubjects') : null), [firestore]);
  const { data: combinedSubjects, isLoading: combinedSubjectsLoading } = useCollection<ScoreableSubject>(combinedSubjectsQuery);

  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: schoolSettings, isLoading: settingsLoading } = useDoc<SchoolSettings>(settingsRef);
  
  useEffect(() => {
    if (user && firestore) {
      const userDocRef = doc(firestore, 'users', user.uid);
      getDoc(userDocRef).then(docSnap => {
        if (docSnap.exists()) {
          setTeacherData(docSnap.data() as UserData);
        }
      });
    }
  }, [user, firestore]);
  
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


  useEffect(() => {
    if (!classroomId || !schoolSettings || !firestore || !teacherData || !studentId ) {
      return;
    }
    
    if (teacherData.assignedClassroomId !== classroomId) {
        toast({ variant: 'destructive', title: 'Unauthorized', description: 'You are not assigned to this classroom.' });
        return;
    }
    
    const fetchResults = async () => {
        setIsSaving(true);
        const resultsQuery = query(
            collection(firestore, 'results'),
            where('classroomId', '==', classroomId),
            where('studentId', '==', studentId),
            where('sessionId', '==', schoolSettings.currentSession),
            where('termId', '==', schoolSettings.currentTermId)
        );

        try {
          const querySnapshot = await getDocs(resultsQuery);
          const fetchedResults: Record<string, Result> = {};
          querySnapshot.forEach((doc) => {
              const data = doc.data() as Result;
              fetchedResults[data.subjectId] = { ...data, id: doc.id };
          });
          
          const initialResultsState: Record<string, Result> = {};
          subjectsForClass.forEach(subject => {
            if (fetchedResults[subject.id]) {
               initialResultsState[subject.id] = fetchedResults[subject.id];
            } else {
              initialResultsState[subject.id] = {
                studentId: studentId,
                subjectId: subject.id,
                classroomId: classroomId,
                sessionId: schoolSettings.currentSession,
                termId: schoolSettings.currentTermId,
                ca1: null, ca2: null, exam: null
              };
            }
          });
          
          setResults(initialResultsState);
        } catch (error) {
           const permissionError = new FirestorePermissionError({
            path: `results`,
            operation: 'list'
          });
          errorEmitter.emit('permission-error', permissionError);
        } finally {
            setIsSaving(false);
            setInitialFetchDone(true);
        }
    };

    fetchResults();
  }, [classroomId, studentId, schoolSettings, firestore, toast, teacherData, subjectsForClass]);

  const handleScoreChange = (
    subjectId: string,
    field: 'ca1' | 'ca2' | 'exam',
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
  
  const handleSave = async () => {
    if (!classroomId || !schoolSettings || !firestore || !user) {
        toast({ variant: 'destructive', title: 'Save Error', description: 'Could not save. Missing critical information.' });
        return;
    }

    setIsSaving(true);
    
    for (const result of Object.values(results)) {
        // Save if any score has been entered for this subject.
        if (result.ca1 !== null || result.ca2 !== null || result.exam !== null) {
             const resultWithIds = {
                ...result,
                studentId: studentId,
                classroomId: classroomId,
                sessionId: schoolSettings.currentSession,
                termId: schoolSettings.currentTermId,
            };
            const resultId = result.id || `${studentId}_${result.subjectId}_${schoolSettings.currentTermId}`; 
            const resultRef = doc(firestore, 'results', resultId);
            setDocumentNonBlocking(resultRef, resultWithIds, { merge: true });
        }
    }
    
    setTimeout(() => { 
        setIsSaving(false);
        toast({
          title: 'Scores Saved!',
          description: `Scores for ${student?.name} have been updated.`,
        });
    }, 1500);
  };
  
  const isLoading = studentLoading || enrollmentsLoading || classSubjectsLoading || subjectsLoading || combinedSubjectsLoading || settingsLoading;

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
        {isLoading && !initialFetchDone ? (
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
                              className="h-8 w-20"
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
                              className="h-8 w-20"
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
                              className="h-8 w-20"
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
              <Button onClick={handleSave} disabled={isSaving || subjectsForClass.length === 0}>
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

    