'use client';

import { useState, useMemo, useEffect, forwardRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import {
  useFirestore,
} from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/firebase/provider';
import {
  collection,
  query,
  where,
  doc,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { calculateGrade } from '@/lib/utils';
import Image from 'next/image';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

// --- TYPE DEFINITIONS ---
export type PupilData = { id: string; name: string; admissionNumber: string; isDeleted?: boolean; };
export type Classroom = { id: string; name: string; };
export type SchoolSettingsData = { currentSession: string; currentTermId: string; daysSchoolOpened: number; nextTermResumptionDate: Timestamp | Date | string; termEndingDate?: Timestamp | Date | string; };
export type TemplateSettings = { studentInfo: { fontSize: number; visible: boolean; }; header: { visible: boolean; }; subjectsTable: { visible: boolean; }; summary: { visible: boolean; }; softSkills: { visible: boolean; }; gradingKey: { visible: boolean; }; remarks: { visible: boolean; }; signatures: { visible: boolean; }; };
export type SavedTemplateData = { name: string; schoolName: string; settings: TemplateSettings; };
export type ResultEntry = { subjectName: string; ca1: number | null; ca2: number | null; exam: number | null; total: number; grade: string; remark: string; subSubjects?: string[] };
type Subject = { id:string; name: string; subSubjects?: string[] };
type AcademicSession = { id: string; name: string; };
type Term = { id: string; name: "1st" | "2nd" | "3rd"; };

// Represents the entire result document for a term
export type TermResult = {
  scores: Record<string, { ca1: number | null; ca2: number | null; exam: number | null }>;
  studentId: string;
  termId: string;
  sessionId: string;
  classroomId: string;
  daysAttended?: number;
  teacherRemark?: string;
  headTeacherRemark?: string;
};

const termNames: Record<string, string> = { "1st": '1st Term', "2nd": '2nd Term', "3rd": '3rd Term' };

const initialSettings: TemplateSettings = { 
    studentInfo: { fontSize: 12, visible: true }, 
    header: { visible: true }, 
    subjectsTable: { visible: true }, 
    summary: { visible: true }, 
    softSkills: { visible: true }, 
    gradingKey: { visible: true }, 
    remarks: { visible: true }, 
    signatures: { visible: true } 
};

// --- HELPER COMPONENTS ---
const StudentInfoDetail = ({ label, value, isLoading = false }: { label: string, value?: string, isLoading?: boolean }) => (
    <div className="flex text-xs items-center gap-2">
        <span className="font-bold text-[11px] uppercase text-muted-foreground w-[90px] shrink-0">{label}:</span>
        <span className="flex-1 border-b border-black font-semibold min-h-[1.2rem]">
            {isLoading ? <Skeleton className="h-3 w-20" /> : value}
        </span>
    </div>
);

interface ResultSheetProps {
  student: PupilData;
  classroom: Classroom;
  teacherName?: string;
  classPopulation?: number | null;
  sessionId: string | null;
  termId: string | null;
  templateData?: SavedTemplateData; 
  isForTemplateBuilder?: boolean; 
  resultEntries?: ResultEntry[];
  overall?: { average: string, grade: string };
}

export const ResultSheet = forwardRef<HTMLDivElement, ResultSheetProps>(({ 
  student, 
  classroom,
  teacherName,
  classPopulation,
  sessionId,
  termId,
  templateData,
  isForTemplateBuilder = false,
  resultEntries: templateResultEntries,
  overall: templateOverall,
}, ref) => {
  const firestore = useFirestore();
  const studentId = student.id;
  
  const [termResult, setTermResult] = useState<TermResult | null>(null);
  const [termResultLoading, setTermResultLoading] = useState(true);

  // --- DATA FETCHING ---
  const settingsRef = useMemoFirebase(() => (!isForTemplateBuilder && firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore, isForTemplateBuilder]);
  const { data: schoolSettings, isLoading: settingsLoading } = useDoc<SchoolSettingsData>(settingsRef);
  
  const sessionDocRef = useMemoFirebase(() => (firestore && sessionId ? doc(firestore, 'sessions', sessionId) : null), [firestore, sessionId]);
  const { data: sessionDoc, isLoading: sessionLoading } = useDoc<AcademicSession>(sessionDocRef);

  const termDocRef = useMemoFirebase(() => (firestore && sessionId && termId ? doc(firestore, 'sessions', sessionId, 'terms', termId) : null), [firestore, sessionId, termId]);
  const { data: termDoc, isLoading: termLoading } = useDoc<Term>(termDocRef);

  const templateRef = useMemoFirebase(() => (!isForTemplateBuilder && firestore ? doc(firestore, 'resultTemplates', 'main-template') : null), [firestore, isForTemplateBuilder]);
  const { data: savedTemplateData, isLoading: templateLoading } = useDoc<SavedTemplateData>(templateRef);
  
  const subjectsQuery = useMemoFirebase(() => (!isForTemplateBuilder && firestore ? collection(firestore, 'subjects') : null), [firestore, isForTemplateBuilder]);
  const { data: allSubjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQuery);

  const termResultRef = useMemoFirebase(() => {
      if (isForTemplateBuilder || !firestore || !studentId || !sessionId || !termId) return null;
      const termResultId = `${sessionId}-${termId}`;
      return doc(firestore, 'students', studentId, 'results', termResultId);
  }, [firestore, studentId, sessionId, termId, isForTemplateBuilder]);
  
  useEffect(() => {
    if (isForTemplateBuilder || !termResultRef) {
        setTermResult(null);
        setTermResultLoading(false);
        return;
    };
    setTermResultLoading(true);
    const unsubscribe = onSnapshot(termResultRef, (snap) => {
      if (snap.exists()) {
        setTermResult(snap.data() as TermResult);
      } else {
        setTermResult(null);
      }
      setTermResultLoading(false);
    }, (error) => {
        console.error("Error fetching term result:", error);
        setTermResult(null);
        setTermResultLoading(false);
    });
    return () => unsubscribe();
  }, [termResultRef, isForTemplateBuilder]);


  // --- DATA PROCESSING ---
  const finalTemplateData = templateData || savedTemplateData;
  const settings = finalTemplateData?.settings || initialSettings;
  const schoolName = finalTemplateData?.schoolName || 'JustVision Kiddies School';

  const allSubjectsMap = useMemo(() => {
    if (!allSubjects) return new Map();
    return new Map(allSubjects.map(s => [s.id, s]));
  }, [allSubjects]);

  const liveResultEntries: ResultEntry[] = useMemo(() => {
    if (isForTemplateBuilder || !termResult || !termResult.scores || !allSubjectsMap.size) return [];
    return Object.entries(termResult.scores)
      .map(([subjectId, score]) => {
        const subject = allSubjectsMap.get(subjectId);
        if (!subject) return null;
        const total = (score.ca1 || 0) + (score.ca2 || 0) + (score.exam || 0);
        const { grade, remark } = calculateGrade(total);
        return { subjectName: subject.name, subSubjects: subject.subSubjects, ca1: score.ca1, ca2: score.ca2, exam: score.exam, total, grade, remark };
      })
      .filter((r): r is ResultEntry => r !== null)
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [termResult, allSubjectsMap, isForTemplateBuilder]);
  
  const resultEntries = isForTemplateBuilder ? templateResultEntries : liveResultEntries;
  
  const overall = useMemo(() => {
    if (!resultEntries || resultEntries.length === 0) return { average: '0.00', grade: 'N/A' };
    const totalSum = resultEntries.reduce((sum, entry) => sum + entry.total, 0);
    const average = totalSum / resultEntries.length;
    const { grade } = calculateGrade(average);
    return { average: average.toFixed(2), grade };
  }, [resultEntries]);

  const scoreTotals = useMemo(() => {
    if (!resultEntries || resultEntries.length === 0) return { ca1: 0, ca2: 0, exam: 0, total: 0 };
    return resultEntries.reduce((acc, entry) => {
      acc.ca1 += entry.ca1 || 0;
      acc.ca2 += entry.ca2 || 0;
      acc.exam += entry.exam || 0;
      acc.total += entry.total || 0;
      return acc;
    }, { ca1: 0, ca2: 0, exam: 0, total: 0 });
  }, [resultEntries]);

  const parseAndFormatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';
    const date = dateValue instanceof Timestamp ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(date.getTime())) return 'N/A';
    return format(date, 'PPP');
  };

  const formattedResumptionDate = useMemo(() => {
    if (isForTemplateBuilder) return format(new Date(), 'PPP');
    return parseAndFormatDate(schoolSettings?.nextTermResumptionDate);
  }, [schoolSettings, isForTemplateBuilder]);

  const formattedTermEndingDate = useMemo(() => {
    if (isForTemplateBuilder) return format(new Date(), 'PPP');
    return parseAndFormatDate(schoolSettings?.termEndingDate);
  }, [schoolSettings, isForTemplateBuilder]);

  const reportSession = isForTemplateBuilder ? '2024/2025' : (sessionDoc?.name || '...');
  const reportTermName = isForTemplateBuilder ? '1st Term' : (termDoc ? termNames[termDoc.name] : 'N/A');

  const isLoading = !isForTemplateBuilder && (settingsLoading || templateLoading || subjectsLoading || sessionLoading || termLoading || termResultLoading);

  if (isLoading && !isForTemplateBuilder) {
    return (
      <div className="relative mx-auto w-full max-w-[794px] aspect-[210/297] bg-white p-8 shadow-lg">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center bg-muted py-8 print:p-0 no-print">
      <div ref={ref} className="relative w-[210mm] min-h-[297mm] bg-white text-black shadow-lg print:shadow-none p-8 flex flex-col border border-zinc-300">
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-5">
            <Image src="/Logo.jpg" alt="School Watermark" width={400} height={400} />
        </div>
        
        <div className="relative z-10 flex flex-col h-full flex-1">
            {settings.header.visible && (
                <header className="mb-6 p-4 border-2 border-black flex items-center gap-6">
                    <div className="relative h-24 w-24"><Image src="/Logo.jpg" alt="School Logo" layout="fill" objectFit="contain" /></div>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold uppercase tracking-tight">{schoolName}</h1>
                        <p className="text-sm">Katampe 2 Mpape Abuja</p>
                        <p className="text-sm font-semibold text-primary">Motto: Exceeding Great</p>
                    </div>
                    <div className="text-right border-l-2 border-black pl-6">
                        <h2 className="font-bold text-xl uppercase">Report Card</h2>
                        <p className="text-sm font-medium">{reportTermName}</p>
                        <p className="text-xs font-bold">{reportSession} SESSION</p>
                    </div>
                </header>
            )}

            <div className="flex-grow flex flex-col">
                {settings.studentInfo.visible && (
                    <div className="mb-6 p-4 border border-black bg-zinc-50/30">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-2 gap-x-6">
                            <StudentInfoDetail label="Pupil Name" value={student.name.toUpperCase()} />
                            <StudentInfoDetail label="Admission No" value={student.admissionNumber} />
                            <StudentInfoDetail label="Class" value={classroom?.name} />
                            <StudentInfoDetail label="Class Size" value={classPopulation ? classPopulation.toString() : 'N/A'} />
                            <StudentInfoDetail label="School Open" value={isForTemplateBuilder ? '65' : schoolSettings?.daysSchoolOpened?.toString()} />
                            <StudentInfoDetail label="Days Present" value={isForTemplateBuilder ? '--' : termResult?.daysAttended?.toString() || '--'} />
                            <StudentInfoDetail label="Term Ends" value={formattedTermEndingDate} />
                            <StudentInfoDetail label="Next Term" value={formattedResumptionDate} />
                            <StudentInfoDetail label="Teacher" value={teacherName || '...'} />
                        </div>
                    </div>
                )}
                
                {settings.subjectsTable.visible && (
                    <div className="border border-black mb-6">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent bg-zinc-100">
                                    <TableHead className="border border-black p-2 h-auto text-xs font-bold text-black uppercase">Subject</TableHead>
                                    <TableHead className="text-center border border-black p-2 h-auto text-xs font-bold text-black uppercase">CA1</TableHead>
                                    <TableHead className="text-center border border-black p-2 h-auto text-xs font-bold text-black uppercase">CA2</TableHead>
                                    <TableHead className="text-center border border-black p-2 h-auto text-xs font-bold text-black uppercase">Exam</TableHead>
                                    <TableHead className="text-center border border-black p-2 h-auto text-xs font-bold text-black uppercase">Total</TableHead>
                                    <TableHead className="border border-black p-2 h-auto text-xs font-bold text-black uppercase">Grade</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {resultEntries && resultEntries.length > 0 ? (
                                    resultEntries.map((entry, index) => (
                                        <TableRow key={index} className="hover:bg-transparent h-8">
                                            <TableCell className="border border-black p-2 text-xs font-medium">
                                                {entry.subjectName}
                                                {entry.subSubjects && entry.subSubjects.length > 0 && (
                                                    <span className="text-[9px] block text-muted-foreground italic">({entry.subSubjects.join(', ')})</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center border border-black p-2 text-xs">{entry.ca1 ?? '--'}</TableCell>
                                            <TableCell className="text-center border border-black p-2 text-xs">{entry.ca2 ?? '--'}</TableCell>
                                            <TableCell className="text-center border border-black p-2 text-xs">{entry.exam ?? '--'}</TableCell>
                                            <TableCell className="text-center border border-black p-2 text-xs font-bold">{entry.total}</TableCell>
                                            <TableCell className="border border-black p-2 text-xs font-bold text-center">{entry.grade}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                      <TableCell colSpan={6} className="h-48 text-center border border-black p-2 text-muted-foreground italic">
                                        No results recorded for this term.
                                      </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                             <TableFooter>
                                <TableRow className="bg-zinc-50 font-bold">
                                  <TableCell className="border border-black p-2 text-xs uppercase">Totals</TableCell>
                                  <TableCell className="text-center border border-black p-2 text-xs">{scoreTotals.ca1}</TableCell>
                                  <TableCell className="text-center border border-black p-2 text-xs">{scoreTotals.ca2}</TableCell>
                                  <TableCell className="text-center border border-black p-2 text-xs">{scoreTotals.exam}</TableCell>
                                  <TableCell className="text-center border border-black p-2 text-xs">{scoreTotals.total}</TableCell>
                                  <TableCell className="border border-black bg-zinc-100"></TableCell>
                                </TableRow>
                              </TableFooter>
                        </Table>
                    </div>
                )}

                {settings.summary.visible && (
                    <div className="flex justify-end mb-6">
                        <div className="w-64 border border-black p-3 space-y-1 bg-zinc-50">
                            <div className="flex justify-between items-center border-b border-black/10 pb-1">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground">Average</span>
                                <span className="font-bold">{(templateOverall || overall)?.average}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground">Overall Grade</span>
                                <span className="text-xl font-black">{(templateOverall || overall)?.grade}</span>
                            </div>
                        </div>
                    </div>
                )}
                
                <footer className="mt-auto">
                    <div className="grid grid-cols-2 gap-8 mb-6">
                        {settings.remarks.visible && (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Teacher's Remark</h3>
                                    <p className="border-b border-black p-2 text-sm italic min-h-[40px]">
                                        "{termResult?.teacherRemark || 'No remark recorded.'}"
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Head Teacher's Remark</h3>
                                    <p className="border-b border-black p-2 text-sm italic min-h-[40px]">
                                        "{termResult?.headTeacherRemark || 'No remark recorded.'}"
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        {settings.gradingKey.visible && (
                             <div className="border border-black p-3 text-[10px] bg-zinc-50/50">
                                <h3 className="font-bold uppercase mb-2 border-b border-black pb-1">Grading Key</h3>
                                <div className="grid grid-cols-2 gap-x-4">
                                    <div className="space-y-0.5">
                                        <div className="flex justify-between"><span>80 – 100</span><span className="font-bold">A (Excellent)</span></div>
                                        <div className="flex justify-between"><span>70 – 79</span><span className="font-bold">B (V. Good)</span></div>
                                        <div className="flex justify-between"><span>60 – 69</span><span className="font-bold">C (Good)</span></div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex justify-between"><span>50 – 59</span><span className="font-bold">D (Fair)</span></div>
                                        <div className="flex justify-between"><span>0 – 49</span><span className="font-bold">F (Fail)</span></div>
                                    </div>
                                </div>
                             </div>
                        )}
                    </div>

                    {settings.signatures.visible && (
                        <div className="flex justify-between pt-8 border-t border-black/10">
                            <div className="text-center w-48">
                                <div className="border-t border-black pt-1 text-[10px] font-bold uppercase">Class Teacher</div>
                            </div>
                            <div className="text-center w-48">
                                <div className="border-t border-black pt-1 text-[10px] font-bold uppercase">Principal / Proprietor</div>
                            </div>
                        </div>
                    )}
                </footer>
            </div>
        </div>
      </div>
    </div>
  );
});

ResultSheet.displayName = 'ResultSheet';
