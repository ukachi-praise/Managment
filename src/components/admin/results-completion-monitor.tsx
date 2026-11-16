'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CircleCheck, CircleAlert, ClipboardList } from 'lucide-react';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';

type Classroom = { id: string; name: string };
type Enrollment = { studentId: string; classroomId: string };
type Student = { id: string; name?: string; isDeleted?: boolean };
type ClassroomSubject = { classroomId: string; subjectId: string };
type ResultScore = { ca1?: unknown; ca2?: unknown; exam?: unknown };
type TermResult = {
  id: string;
  studentId?: string;
  classroomId?: string;
  sessionId?: string;
  termId?: string;
  scores?: Record<string, ResultScore>;
  isPublished?: boolean;
  published?: boolean;
  status?: string;
};
type SchoolSettings = { currentSessionId?: string; currentTermId?: string };
type AcademicSession = { name?: string };
type AcademicTerm = { name?: string };

type CompletionStats = {
  classroom: Classroom;
  completed: number;
  incomplete: number;
  eligible: number;
  percentage: number;
};

function hasCompleteResult(result: TermResult | undefined, subjectIds: string[]): boolean {
  if (!result || subjectIds.length === 0) return false;
  if (result.isPublished === false || result.published === false || ['draft', 'unpublished'].includes(String(result.status || '').toLowerCase())) {
    return false;
  }

  return subjectIds.every((subjectId) => {
    const score = result.scores?.[subjectId];
    return !!score &&
      typeof score.ca1 === 'number' && Number.isFinite(score.ca1) && score.ca1 >= 0 && score.ca1 <= 20 &&
      typeof score.ca2 === 'number' && Number.isFinite(score.ca2) && score.ca2 >= 0 && score.ca2 <= 20 &&
      typeof score.exam === 'number' && Number.isFinite(score.exam) && score.exam >= 0 && score.exam <= 60;
  });
}

export function ResultsCompletionMonitor({
  classrooms,
  isLoading: isClassroomsLoading,
}: {
  classrooms: Classroom[] | null;
  isLoading: boolean;
}) {
  const firestore = useFirestore();
  const settingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'schoolSettings', 'current') : null),
    [firestore]
  );
  const { data: settings, isLoading: settingsLoading } = useDoc<SchoolSettings>(settingsRef);
  const sessionRef = useMemoFirebase(
    () => (firestore && settings?.currentSessionId ? doc(firestore, 'sessions', settings.currentSessionId) : null),
    [firestore, settings?.currentSessionId]
  );
  const termRef = useMemoFirebase(
    () => (firestore && settings?.currentSessionId && settings.currentTermId
      ? doc(firestore, 'sessions', settings.currentSessionId, 'terms', settings.currentTermId)
      : null),
    [firestore, settings?.currentSessionId, settings?.currentTermId]
  );
  const { data: session, isLoading: sessionLoading } = useDoc<AcademicSession>(sessionRef);
  const { data: term, isLoading: termLoading } = useDoc<AcademicTerm>(termRef);

  const enrollmentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'enrollments')) : null),
    [firestore]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const studentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'students')) : null),
    [firestore]
  );
  const { data: students, isLoading: studentsLoading } = useCollection<Student>(studentsQuery);

  const classroomSubjectsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classroomSubjects')) : null),
    [firestore]
  );
  const { data: classroomSubjects, isLoading: assignmentsLoading } = useCollection<ClassroomSubject>(classroomSubjectsQuery);

  const currentSessionId = settings?.currentSessionId;
  const currentTermId = settings?.currentTermId;
  const activeStudentIds = useMemo(() => {
    if (!students || !enrollments) return [];
    const activeIds = new Set(
      students
        .filter((student) => student.isDeleted !== true && typeof student.name === 'string' && student.name.trim().length > 0)
        .map((student) => student.id)
    );
    return [...new Set(enrollments.map(({ studentId }) => studentId).filter((studentId) => activeIds.has(studentId)))];
  }, [students, enrollments]);

  // Subscribe to each eligible student's current term result document directly.
  // This avoids a collection-group query, which may be denied by deployments
  // that have not yet published collection-group rules.
  const [resultsByStudent, setResultsByStudent] = useState<Map<string, TermResult>>(new Map());
  const [resultsLoading, setResultsLoading] = useState(false);
  useEffect(() => {
    if (!firestore || !currentSessionId || !currentTermId || !students || !enrollments) {
      setResultsByStudent(new Map());
      setResultsLoading(false);
      return;
    }

    if (activeStudentIds.length === 0) {
      setResultsByStudent(new Map());
      setResultsLoading(false);
      return;
    }

    let isCurrentSubscription = true;
    const resultMap = new Map<string, TermResult>();
    let initialSnapshotsRemaining = activeStudentIds.length;
    const initialSnapshotReceived = new Set<string>();
    setResultsByStudent(new Map());
    setResultsLoading(true);

    const unsubscribers = activeStudentIds.map((studentId) => onSnapshot(
      doc(firestore, 'students', studentId, 'results', `${currentSessionId}-${currentTermId}`),
      (snapshot) => {
        if (!isCurrentSubscription) return;
        const data = snapshot.exists() ? snapshot.data() as Omit<TermResult, 'id'> : null;
        if (
          data && data.studentId === studentId &&
          data.sessionId === currentSessionId && data.termId === currentTermId
        ) {
          resultMap.set(studentId, { ...data, id: snapshot.id });
        } else {
          resultMap.delete(studentId);
        }
        setResultsByStudent(new Map(resultMap));

        if (!initialSnapshotReceived.has(studentId)) {
          initialSnapshotReceived.add(studentId);
          initialSnapshotsRemaining -= 1;
          if (initialSnapshotsRemaining === 0) setResultsLoading(false);
        }
      },
      (error) => {
        console.error(`Could not read the current result for student ${studentId}:`, error);
        if (!isCurrentSubscription) return;
        resultMap.delete(studentId);
        setResultsByStudent(new Map(resultMap));
        if (!initialSnapshotReceived.has(studentId)) {
          initialSnapshotReceived.add(studentId);
          initialSnapshotsRemaining -= 1;
          if (initialSnapshotsRemaining === 0) setResultsLoading(false);
        }
      }
    ));

    return () => {
      isCurrentSubscription = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [firestore, currentSessionId, currentTermId, activeStudentIds, students, enrollments]);

  const stats = useMemo<CompletionStats[]>(() => {
    if (!classrooms || !enrollments || !students || !classroomSubjects || !currentSessionId || !currentTermId) return [];

    const activeStudentIds = new Set(
      students
        .filter((student) => student.isDeleted !== true && typeof student.name === 'string' && student.name.trim().length > 0)
        .map((student) => student.id)
    );
    const studentsByClass = new Map<string, Set<string>>();
    enrollments.forEach(({ classroomId, studentId }) => {
      if (!classroomId || !studentId || !activeStudentIds.has(studentId)) return;
      const classStudents = studentsByClass.get(classroomId) || new Set<string>();
      classStudents.add(studentId);
      studentsByClass.set(classroomId, classStudents);
    });

    const subjectsByClass = new Map<string, Set<string>>();
    classroomSubjects.forEach(({ classroomId, subjectId }) => {
      if (!classroomId || !subjectId) return;
      const subjectIds = subjectsByClass.get(classroomId) || new Set<string>();
      subjectIds.add(subjectId);
      subjectsByClass.set(classroomId, subjectIds);
    });

    return classrooms
      .map((classroom) => {
        const classStudentIds = studentsByClass.get(classroom.id) || new Set<string>();
        const subjectIds = [...(subjectsByClass.get(classroom.id) || new Set<string>())];
        let completed = 0;
        classStudentIds.forEach((studentId) => {
          const result = resultsByStudent.get(studentId);
          if (result?.classroomId !== classroom.id) return;
          if (hasCompleteResult(result, subjectIds)) completed += 1;
        });
        const eligible = classStudentIds.size;
        const incomplete = eligible - completed;
        return {
          classroom,
          completed,
          incomplete,
          eligible,
          percentage: eligible > 0 ? Math.round((completed / eligible) * 100) : 0,
        };
      })
      .sort((a, b) => a.classroom.name.localeCompare(b.classroom.name));
  }, [classrooms, enrollments, students, classroomSubjects, resultsByStudent, currentSessionId, currentTermId]);

  const isLoading = isClassroomsLoading || settingsLoading || (!!settings?.currentSessionId && sessionLoading) || (!!settings?.currentTermId && termLoading) || enrollmentsLoading || studentsLoading || assignmentsLoading || (!!currentSessionId && resultsLoading);
  const totalEligible = stats.reduce((sum, item) => sum + item.eligible, 0);

  return (
    <Card className="lg:col-span-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          Results Completion Monitor
        </CardTitle>
        <CardDescription>
          {settingsLoading || !currentSessionId || !currentTermId
            ? 'Live completion for the active academic session and term. All assigned subjects need CA1, CA2, and exam scores.'
            : `Live completion for ${session?.name || currentSessionId} · ${term?.name ? `${term.name} Term` : currentTermId}. All assigned subjects need CA1, CA2, and exam scores.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="border-t pt-4">
        {isLoading ? (
          <div className="space-y-3" aria-label="Loading result completion">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-16 w-full" />)}
          </div>
        ) : !currentSessionId || !currentTermId ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Set the active session and term in School Settings to monitor results.
          </div>
        ) : stats.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No classes are available to monitor.</div>
        ) : totalEligible === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No eligible students are currently enrolled in any class.</div>
        ) : (
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {stats.map(({ classroom, completed, incomplete, eligible, percentage }) => {
              const isComplete = eligible > 0 && incomplete === 0;
              const isEmpty = eligible === 0;
              return (
                <Link
                  key={classroom.id}
                  href={`/admin/results?classroomId=${encodeURIComponent(classroom.id)}`}
                  className={`block rounded-lg border p-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${incomplete > 0 ? 'border-amber-500/40' : isEmpty ? 'border-border' : 'border-green-600/30'}`}
                  aria-label={`${classroom.name}: ${completed} completed, ${incomplete} incomplete, ${eligible} students`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{classroom.name}</span>
                        {isComplete ? <CircleCheck className="h-4 w-4 shrink-0 text-green-600" aria-label="All results complete" /> : incomplete > 0 ? <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-label="Results incomplete" /> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isEmpty ? 'No eligible students enrolled' : <><span className="font-medium text-foreground">{completed} completed</span>{' · '}{incomplete} incomplete{' · '}{eligible} students</>}
                      </p>
                    </div>
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${classroom.name} results complete`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
                      <div className={`h-full rounded-full transition-[width] ${isComplete ? 'bg-green-600' : 'bg-primary'}`} style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs font-medium tabular-nums">{percentage}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
