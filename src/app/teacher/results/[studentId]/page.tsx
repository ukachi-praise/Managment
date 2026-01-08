
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
import { RemarkGenerator } from '@/components/teacher/remark-generator';
import { Label } from '@/components/ui/label';

import {
  useFirestore,
} from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

import { useMemoFirebase } from '@/firebase/provider';
import {
  collection,
  query,
  where,
  doc,
  DocumentReference,
  onSnapshot,
} from 'firebase/firestore';

// --- TYPE DEFINITIONS ---
type Student = { id: string; name: string; admissionNumber: string };
type Subject = { id: string; name: string; subSubjects?: string[] };
type Enrollment = { id: string; studentId: string; classroomId: string };
type AcademicSession = { id: string, name: string };
type Term = { id: string, name: string };
type SchoolSettings = { currentSessionId: string; currentTermId: string; }

// Represents a single subject's scores within the main result document
type SubjectScore = {
  ca1: number | null;
  ca2: number | null;
  exam: number | null;
};

// Represents the entire result document for a term
type TermResult = {
  scores: Record<string, SubjectScore>; // subjectId -> SubjectScore
  studentId: string;
  termId: string;
  sessionId: string;
  classroomId: string;
  teacherRemark?: string;
  headTeacherRemark?: string;
  daysAttended?: number;
};


export default function StudentResultEntryPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const router = useRouter();

  const { toast } = useToast();
  const firestore = useFirestore();

  const [termResult, setTermResult] = useState<TermResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // --- DATA FETCHING ---
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
  const { data: allSubjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQuery);

  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: schoolSettings, isLoading: settingsLoading } = useDoc<SchoolSettings>(settingsRef);
  
  const currentSessionRef = useMemoFirebase(() => (firestore && schoolSettings?.currentSessionId ? doc(firestore, 'sessions', schoolSettings.currentSessionId) : null), [firestore, schoolSettings]);
  const { data: currentSession, isLoading: currentSessionLoading } = useDoc<AcademicSession>(currentSessionRef);
  
  const currentTermRef = useMemoFirebase(() => (firestore && schoolSettings?.currentSessionId && schoolSettings.currentTermId ? doc(firestore, 'sessions', schoolSettings.currentSessionId, 'terms', schoolSettings.currentTermId) : null), [firestore, schoolSettings]);
  const { data: currentTerm, isLoading: currentTermLoading } = useDoc<Term>(currentTermRef);
  
  const subjectsForClass = useMemo(() => {
    if (!classroomSubjects || !allSubjects) return [];
    
    const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
    const subjectIdsForClass = new Set(classroomSubjects.map(cs => cs.subjectId));
    
    return Array.from(subjectIdsForClass)
        .map(id => subjectMap.get(id))
        .filter((s): s is Subject => !!s)
        .sort((a,b) => {
            const aHasSub = a.subSubjects && a.subSubjects.length > 0;
            const bHasSub = b.subSubjects && b.subSubjects.length > 0;

            if (aHasSub && !bHasSub) return -1;
            if (!aHasSub && bHasSub) return 1;

            return a.name.localeCompare(b.name);
        });

  }, [classroomSubjects, allSubjects]);

  const termResultRef = useMemoFirebase(() => {
      if (!firestore || !studentId || !schoolSettings) return null;
      // CRITICAL FIX: Use stable IDs, not names, for the document path.
      const termResultId = `${schoolSettings.currentSessionId}-${schoolSettings.currentTermId}`;
      return doc(firestore, 'students', studentId, 'results', termResultId);
  }, [firestore, studentId, schoolSettings]);

  // --- REAL-TIME DATA SUBSCRIPTION ---
  useEffect(() => {
    if (!termResultRef || !classroomId || !schoolSettings) return;

    const unsubscribe = onSnapshot(termResultRef, (snap) => {
      const existingData = snap.exists() ? snap.data() : null;
      
      const newScores: Record<string, SubjectScore> = {};
      subjectsForClass.forEach(subject => {
          newScores[subject.id] = { 
              ca1: existingData?.scores?.[subject.id]?.ca1 ?? null,
              ca2: existingData?.scores?.[subject.id]?.ca2 ?? null,
              exam: existingData?.scores?.[subject.id]?.exam ?? null,
           };
      });

      setTermResult({
          scores: newScores,
          studentId,
          termId: schoolSettings.currentTermId,
          sessionId: schoolSettings.currentSessionId,
          classroomId,
          teacherRemark: existingData?.teacherRemark,
          headTeacherRemark: existingData?.headTeacherRemark,
          daysAttended: existingData?.daysAttended,
      });

    }, (error) => {
        console.error("Error fetching student results:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not fetch student scores." });
    });

    return () => unsubscribe();
  }, [termResultRef, subjectsForClass, classroomId, studentId, schoolSettings, toast]);


  const handleScoreChange = (
    subjectId: string,
    field: 'ca1' | 'ca2' | 'exam',
    value: string
  ) => {
    const numericValue = value === '' ? null : Number(value);

    setTermResult(prevResult => {
      if (!prevResult) return null;
      
      const newScores = { ...prevResult.scores };
      newScores[subjectId] = {
        ...newScores[subjectId],
        [field]: numericValue
      };

      return { ...prevResult, scores: newScores };
    });
  };

  const handleDaysAttendedChange = (value: string) => {
    const numericValue = value === '' ? undefined : Number(value);
    setTermResult(prev => (prev ? { ...prev, daysAttended: numericValue } : null));
  }
  
  const handleSave = async () => {
    if (!termResultRef || !termResult) {
        toast({ variant: 'destructive', title: 'Save Error', description: 'Could not save. Missing critical information.' });
        return;
    }

    setIsSaving(true);
    
    // Create a clean data object for Firestore, ensuring no 'undefined' values
    const dataToSave = {
        ...termResult,
        daysAttended: termResult.daysAttended ?? null, // Convert undefined to null
        teacherRemark: termResult.teacherRemark ?? '',
        headTeacherRemark: termResult.headTeacherRemark ?? '',
        scores: Object.entries(termResult.scores).reduce((acc, [key, value]) => {
            acc[key] = {
                ca1: value.ca1 ?? null,
                ca2: value.ca2 ?? null,
                exam: value.exam ?? null,
            };
            return acc;
        }, {} as Record<string, SubjectScore>)
    };

    setDocumentNonBlocking(termResultRef, dataToSave, { merge: true });
    
    setTimeout(() => { 
        setIsSaving(false);
        toast({
          title: 'Scores Saved!',
          description: `Scores for ${student?.name} have been updated.`,
        });
        if(classroomId) {
            router.push(`/teacher/class/${classroomId}`);
        } else {
            router.push('/teacher/dashboard');
        }
    }, 1500);
  };
  
  const overallAverage = useMemo(() => {
    if (!termResult?.scores) return 0;

    const scoresArray = Object.values(termResult.scores);
    if (scoresArray.length === 0) return 0;
    
    const totalSum = scoresArray.reduce((sum, score) => {
        const subjectTotal = (score.ca1 || 0) + (score.ca2 || 0) + (score.exam || 0);
        return sum + subjectTotal;
    }, 0);
    
    return totalSum / scoresArray.length;
  }, [termResult]);


  const pageIsLoading = studentLoading || enrollmentsLoading || classSubjectsLoading || subjectsLoading || settingsLoading || !termResult || currentSessionLoading || currentTermLoading;

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                Result Entry for {student?.name || '...'}
                </h1>
                <p className="text-muted-foreground">
                Enter CA and Exam scores for each subject below.
                </p>
            </div>
          </div>
      </div>

    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle>Enter Scores</CardTitle>
            <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">Session: <span className="font-semibold text-foreground">{currentSession?.name || '...'}</span></span>
                <span className="text-muted-foreground">Term: <span className="font-semibold text-foreground">{currentTerm?.name ? `${currentTerm.name} Term` : '...'}</span></span>
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
                      const score = termResult?.scores?.[subject.id] || { ca1: null, ca2: null, exam: null };
                      const total = (score.ca1 || 0) + (score.ca2 || 0) + (score.exam || 0);
                      const { grade: finalGrade } = calculateGrade(total);

                      return (
                        <TableRow key={subject.id}>
                          <TableCell className="font-medium">
                            {subject.name}
                            {subject.subSubjects && subject.subSubjects.length > 0 && <span className="ml-2 text-muted-foreground text-xs">({subject.subSubjects.join(', ')})</span>}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="h-8 w-20 text-sm"
                              value={score.ca1 ?? ''}
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
                              value={score.ca2 ?? ''}
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
                              value={score.exam ?? ''}
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
            
            <div className="mt-6 border-t pt-6 space-y-4">
                <div className="w-full max-w-xs">
                    <Label htmlFor="daysAttended" className="font-semibold">Days Attended by Student</Label>
                     <Input
                        id="daysAttended"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="e.g. 60"
                        value={termResult?.daysAttended ?? ''}
                        onChange={(e) => handleDaysAttendedChange(e.target.value)}
                        className="mt-2"
                     />
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={isSaving || pageIsLoading || subjectsForClass.length === 0}>
                        {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                        <Save className="mr-2 h-4 w-4" />
                        )}
                        Save All
                    </Button>
                </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>

    {!pageIsLoading && student && (
        <RemarkGenerator 
            studentName={student.name}
            overallAverage={overallAverage}
            resultRef={termResultRef}
            initialTeacherRemark={termResult?.teacherRemark}
            initialHeadTeacherRemark={termResult?.headTeacherRemark}
        />
    )}

    </div>
  );
}

    

    