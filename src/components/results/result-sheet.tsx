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
  getDocs,
} from 'firebase/firestore';
import { calculateGrade, cn } from '@/lib/utils';
import Image from 'next/image';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

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


// Represents a single subject's scores within the main result document
type SubjectScore = {
  ca1: number | null;
  ca2: number | null;
  exam: number | null;
};

// Represents the entire result document for a term
export type TermResult = {
  scores: Record<string, SubjectScore>; // subjectId -> SubjectScore
  studentId: string;
  termId: string;
  sessionId: string;
  classroomId: string;
  daysAttended?: number;
  teacherRemark?: string;
  headTeacherRemark?: string;
};

type SoftSkillScore = {
    skillName: string;
    score: number;
};


const termNames: Record<string, string> = { "1st": '1st Term', "2nd": '2nd Term', "3rd": '3rd Term' };

const initialSettings: TemplateSettings = { studentInfo: { fontSize: 12, visible: true }, header: { visible: true }, subjectsTable: { visible: true }, summary: { visible: true }, softSkills: { visible: true }, gradingKey: { visible: true }, remarks: { visible: true }, signatures: { visible: true } };

// --- HELPER COMPONENTS ---
const StudentInfoDetail = ({ label, value, isLoading = false }: { label: string, value?: string | React.ReactNode, isLoading?: boolean }) => (
    <div className="flex text-xs items-center gap-1 min-h-[1.5rem]">
        <span className="font-bold text-[10px] uppercase text-zinc-500 w-[85px] shrink-0">{label}:</span>
        <span className="flex-1 border-b border-black font-semibold text-black overflow-hidden truncate">
            {isLoading ? <Skeleton className="h-4 w-24" /> : value}
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

// --- MAIN COMPONENT ---
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
  const [softSkillScores, setSoftSkillScores] = useState<SoftSkillScore[]>([]);
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


  // --- DATA PROCESSING & MEMOIZATION ---
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
      .sort((a, b) => {
        const aHasSub = a.subSubjects && a.subSubjects.length > 0;
        const bHasSub = b.subSubjects && b.subSubjects.length > 0;
        if (aHasSub && !bHasSub) return -1;
        if (!aHasSub && bHasSub) return 1;
        return a.subjectName.localeCompare(b.subjectName);
      });
  }, [termResult, allSubjectsMap, isForTemplateBuilder]);
  
  const resultEntries = isForTemplateBuilder ? templateResultEntries : liveResultEntries;
  
  const overall = useMemo(() => {
    if (!resultEntries || resultEntries.length === 0) return { average: '0.00', grade: 'N/A' };
    const totalSum = resultEntries.reduce((sum, entry) => sum + entry.total, 0);
    const average = totalSum / resultEntries.length;
    const { grade } = calculateGrade(average);
    return { average: average.toFixed(2), grade };
  }, [resultEntries]);

  useEffect(() => {
    const allSoftSkills = ["Punctuality", "Neatness", "Creativity", "Honesty", "Communication", "Teamwork", "Attentiveness", "Self Control", "Leadership", "Initiative"];
    if (isForTemplateBuilder) {
      setSoftSkillScores(allSoftSkills.map(skill => ({ skillName: skill, score: 5 })));
      return;
    }
    const scores = [3, 4, 5];
    const generatedScores = allSoftSkills.map(skill => ({ skillName: skill, score: scores[Math.floor(Math.random() * scores.length)] }));
    setSoftSkillScores(generatedScores);
  }, [isForTemplateBuilder, student.id]);
  
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

  const reportSession = isForTemplateBuilder ? '2023/2024' : (sessionDoc?.name || '...');
  const reportTermName = isForTemplateBuilder ? '1st Term' : (termDoc ? termNames[termDoc.name] : 'N/A');

  const isLoading = !isForTemplateBuilder && (settingsLoading || templateLoading || subjectsLoading || sessionLoading || termLoading || termResultLoading);
  
  const daysAbsent = useMemo(() => {
    if (isForTemplateBuilder) return '--';
    const attended = termResult?.daysAttended;
    const opened = schoolSettings?.daysSchoolOpened;
    if (typeof attended === 'number' && typeof opened === 'number' && attended >= 0 && opened >= 0) {
      const absent = opened - attended;
      return absent >= 0 ? absent.toString() : 'N/A';
    }
    return '--';
  }, [isForTemplateBuilder, termResult, schoolSettings]);


  if (isLoading && !isForTemplateBuilder) {
    return <div className="relative mx-auto w-full max-w-[794px] aspect-[210/297] bg-white p-6 shadow-lg"><Skeleton className="h-full w-full" /></div>;
  }
  
  if (!isForTemplateBuilder && !student) {
      return <div className="rounded-lg border bg-card p-8 text-center text-destructive font-bold">Student data could not be loaded.</div>
  }
  
  const allSoftSkillsList = ["Punctuality", "Neatness", "Creativity", "Honesty", "Communication", "Teamwork", "Attentiveness", "Self Control", "Leadership", "Initiative"];
  const softSkillsMap = new Map(softSkillScores.map(s => [s.skillName, s.score]));
  const softSkillsCol1 = allSoftSkillsList.slice(0, 5);
  const softSkillsCol2 = allSoftSkillsList.slice(5);


  return (
    <div className="w-full flex justify-center bg-zinc-200 py-10 print:bg-white print:p-0 no-print">
    <div ref={ref} className="relative w-full max-w-[794px] min-h-[1123px] bg-white text-black shadow-2xl print:shadow-none print:m-0 print:p-0 print:w-full print:h-auto flex flex-col p-8 border-[6px] border-black">
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
            <Image src="/Logo.jpg" alt="School Watermark" width={600} height={600} className="opacity-[0.03] scale-150 rotate-[-25deg]" />
        </div>
        <div className="relative z-10 flex flex-col h-full flex-1">
            {settings.header.visible && (
                <header className="mb-6 p-4 border-2 border-black bg-zinc-50">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-6">
                            <div className="relative h-28 w-28 drop-shadow-sm"><Image src="/Logo.jpg" alt="School Logo" layout="fill" objectFit="contain" /></div>
                            <div className="text-black">
                                <h1 className="text-3xl font-black text-black leading-tight uppercase tracking-tighter">{schoolName}</h1>
                                <p className="text-base font-bold text-zinc-700">Katampe 2 Mpape Abuja</p>
                                <p className="text-base font-black text-primary mt-1">Motto: Exceeding Great</p>
                            </div>
                        </div>
                        <div className="text-right border-l-2 border-black pl-6 flex flex-col justify-center">
                            <h2 className="font-black text-2xl text-black uppercase tracking-widest">Report Card</h2>
                            <p className="text-lg font-bold text-zinc-600 italic">
                                {reportTermName}
                            </p>
                            <p className="text-sm font-black text-zinc-900">
                                {reportSession} SESSION
                            </p>
                        </div>
                    </div>
                </header>
            )}

            <div className="flex-grow flex flex-col">
                {settings.studentInfo.visible && (
                    <div className="mb-6 p-4 border border-black bg-white" style={{ fontSize: `12px` }}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-3 gap-x-8">
                            <StudentInfoDetail label="Name" value={student.name.toUpperCase()} />
                            <StudentInfoDetail label="Admission No" value={student.admissionNumber} />
                            <StudentInfoDetail label="Class" value={classroom?.name} />
                            <StudentInfoDetail label="Roll No." value={classPopulation ? classPopulation.toString() : 'N/A'} />
                            <StudentInfoDetail label="Days Absent" value={daysAbsent} />
                            <StudentInfoDetail label="Attendance" value={isForTemplateBuilder ? '--' : termResult?.daysAttended?.toString() || '--'} />
                            <StudentInfoDetail label="School Open" value={isForTemplateBuilder ? '65' : schoolSettings?.daysSchoolOpened?.toString()} />
                            <StudentInfoDetail label="Term Ending" value={formattedTermEndingDate} />
                            <StudentInfoDetail label="Resumption" value={formattedResumptionDate} />
                        </div>
                    </div>
                )}
                
                {settings.subjectsTable.visible && (
                    <div className="border-[2px] border-black shadow-sm mb-4">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent bg-zinc-900">
                                    <TableHead className="border border-black p-2 h-auto text-sm font-bold text-white uppercase tracking-wider">Subject</TableHead>
                                    <TableHead className="text-center border border-black p-2 h-auto text-sm font-bold text-white uppercase tracking-wider">CA1</TableHead>
                                    <TableHead className="text-center border border-black p-2 h-auto text-sm font-bold text-white uppercase tracking-wider">CA2</TableHead>
                                    <TableHead className="text-center border border-black p-2 h-auto text-sm font-bold text-white uppercase tracking-wider">Exam</TableHead>
                                    <TableHead className="text-center border border-black p-2 h-auto text-sm font-bold text-white uppercase tracking-wider">Total</TableHead>
                                    <TableHead className="border border-black p-2 h-auto text-sm font-bold text-white uppercase tracking-wider">Grade</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {resultEntries && resultEntries.length > 0 ? (
                                    resultEntries.map((entry, index) => (
                                        <TableRow key={entry.subjectName + index} className="hover:bg-transparent transition-none">
                                            <TableCell className="border-b border-r border-black p-2 text-sm font-bold">
                                                <div className="font-bold">{entry.subjectName}</div>
                                                {entry.subSubjects && entry.subSubjects.length > 0 && (
                                                    <div className="pl-3 text-[10px] text-zinc-600 italic">
                                                        {entry.subSubjects.join(', ')}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center border-b border-r border-black p-2 text-base font-medium tabular-nums">{entry.ca1 ?? '--'}</TableCell>
                                            <TableCell className="text-center border-b border-r border-black p-2 text-base font-medium tabular-nums">{entry.ca2 ?? '--'}</TableCell>
                                            <TableCell className="text-center border-b border-r border-black p-2 text-base font-medium tabular-nums">{entry.exam ?? '--'}</TableCell>
                                            <TableCell className="text-center border-b border-r border-black p-2 text-base font-black tabular-nums">{entry.total}</TableCell>
                                            <TableCell className="border-b border-black p-2 text-base font-black text-center">{entry.grade}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                      <TableCell colSpan={6} className="h-48 text-center border-b border-black p-2 text-lg italic text-zinc-400">
                                        {isForTemplateBuilder ? 'Subjects will be shown here.' : 'No scores recorded for this term yet.'}
                                      </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                             <TableFooter>
                                <TableRow className="bg-zinc-50">
                                  <TableCell className="border-b border-r border-black p-2 text-sm font-black uppercase">Grand Total</TableCell>
                                  <TableCell className="text-center border-b border-r border-black p-2 text-sm font-black tabular-nums">{scoreTotals.ca1}</TableCell>
                                  <TableCell className="text-center border-b border-r border-black p-2 text-sm font-black tabular-nums">{scoreTotals.ca2}</TableCell>
                                  <TableCell className="text-center border-b border-r border-black p-2 text-sm font-black tabular-nums">{scoreTotals.exam}</TableCell>
                                  <TableCell className="text-center border-b border-r border-black p-2 text-base font-black tabular-nums">{scoreTotals.total}</TableCell>
                                  <TableCell className="border-b border-black p-2 text-sm bg-black"></TableCell>
                                </TableRow>
                              </TableFooter>
                        </Table>
                    </div>
                )}
                {settings.summary.visible && (
                    <div className="mt-2 flex justify-end">
                        <div className="w-[300px] border-4 border-black p-4 bg-zinc-900 text-white space-y-2 rounded-sm shadow-md">
                            <div className="flex justify-between items-center border-b border-white/20 pb-1">
                                <span className="font-bold text-xs uppercase tracking-widest text-zinc-400">Overall Average</span>
                                <span className="text-2xl font-black tabular-nums">{(templateOverall || overall)?.average}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-xs uppercase tracking-widest text-zinc-400">Overall Grade</span>
                                <span className="text-3xl font-black">{(templateOverall || overall)?.grade}</span>
                            </div>
                        </div>
                    </div>
                )}
                 <div className="flex-grow min-h-0"></div>
                
                 {/* Second Page Content Style */}
                <footer className="mt-8 text-base print:break-before-page">
                    <section className='border-[2px] border-black p-4 flex flex-col gap-4 bg-zinc-50/30'>
                        <div className="grid grid-cols-[1.5fr_1.5fr_3fr] gap-x-6">
                            {settings.gradingKey.visible && (
                                <div className="space-y-2">
                                <h3 className="font-black text-black text-xs uppercase tracking-widest border-b border-black pb-1">Grading Key</h3>
                                <Table>
                                    <TableBody>
                                        <TableRow className="h-6"><TableCell className="p-1 text-[10px] font-bold border border-black uppercase bg-zinc-100">80 – 100</TableCell><TableCell className="p-1 text-[10px] font-black border border-black text-center">A</TableCell></TableRow>
                                        <TableRow className="h-6"><TableCell className="p-1 text-[10px] font-bold border border-black uppercase bg-zinc-100">70 – 79</TableCell><TableCell className="p-1 text-[10px] font-black border border-black text-center">B</TableCell></TableRow>
                                        <TableRow className="h-6"><TableCell className="p-1 text-[10px] font-bold border border-black uppercase bg-zinc-100">60 – 69</TableCell><TableCell className="p-1 text-[10px] font-black border border-black text-center">C</TableCell></TableRow>
                                        <TableRow className="h-6"><TableCell className="p-1 text-[10px] font-bold border border-black uppercase bg-zinc-100">50 – 59</TableCell><TableCell className="p-1 text-[10px] font-black border border-black text-center">D</TableCell></TableRow>
                                        <TableRow className="h-6"><TableCell className="p-1 text-[10px] font-bold border border-black uppercase bg-zinc-100">0 – 49</TableCell><TableCell className="p-1 text-[10px] font-black border border-black text-center">F</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                                </div>
                            )}
                            
                            {settings.softSkills.visible && (
                                <div className="space-y-2">
                                    <h3 className="font-black text-black text-xs uppercase tracking-widest border-b border-black pb-1">Skill Rating</h3>
                                    <Table>
                                        <TableBody>
                                            <TableRow className="h-6"><TableCell className="p-1 text-[10px] font-black border border-black text-center">5</TableCell><TableCell className="p-1 text-[10px] font-bold border border-black uppercase bg-zinc-100">Excellent</TableCell></TableRow>
                                            <TableRow className="h-6"><TableCell className="p-1 text-[10px] font-black border border-black text-center">4</TableCell><TableCell className="p-1 text-[10px] font-bold border border-black uppercase bg-zinc-100">V. Good</TableCell></TableRow>
                                            <TableRow className="h-6"><TableCell className="p-1 text-[10px] font-black border border-black text-center">3</TableCell><TableCell className="p-1 text-[10px] font-bold border border-black uppercase bg-zinc-100">Good</TableCell></TableRow>
                                            <TableRow className="h-6"><TableCell className="p-1 text-[10px] font-black border border-black text-center">2</TableCell><TableCell className="p-1 text-[10px] font-bold border border-black uppercase bg-zinc-100">Fair</TableCell></TableRow>
                                            <TableRow className="h-6"><TableCell className="p-1 text-[10px] font-black border border-black text-center">1</TableCell><TableCell className="p-1 text-[10px] font-bold border border-black uppercase bg-zinc-100">Poor</TableCell></TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {settings.softSkills.visible && (
                               <div className="space-y-2 p-2 border-2 border-black bg-white shadow-sm">
                                    <h3 className="font-black text-black text-xs uppercase tracking-tighter">Behavioral Assessment</h3>
                                    <div className="grid grid-cols-2 gap-x-4">
                                        <Table>
                                            <TableBody>
                                                {softSkillsCol1.map((skill, index) => (
                                                    <TableRow key={index} className="h-6">
                                                        <TableCell className="font-bold p-1 text-[10px] border border-black text-black uppercase tracking-tighter">{skill}</TableCell>
                                                        <TableCell className="text-center p-1 text-xs font-black border border-black w-[25px] bg-zinc-50">{softSkillsMap.get(skill) || '--'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <Table>
                                            <TableBody>
                                                {softSkillsCol2.map((skill, index) => (
                                                    <TableRow key={index} className="h-6">
                                                        <TableCell className="font-bold p-1 text-[10px] border border-black text-black uppercase tracking-tighter">{skill}</TableCell>
                                                        <TableCell className="text-center p-1 text-xs font-black border border-black w-[25px] bg-zinc-50">{softSkillsMap.get(skill) || '--'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {settings.remarks.visible && (
                             <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <h3 className="font-black text-black text-[10px] uppercase tracking-widest">Class Teacher's Remarks</h3>
                                    <p className="min-h-[50px] border-2 border-black p-3 text-sm font-bold bg-white italic italic leading-relaxed">
                                        "{termResult?.teacherRemark || 'No remark recorded.'}"
                                    </p>
                                    <p className="text-[10px] font-black uppercase text-zinc-500 mt-1">Signed: {teacherName || 'CLASS TEACHER'}</p>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-black text-black text-[10px] uppercase tracking-widest">Head Teacher's Remarks</h3>
                                     <p className="min-h-[50px] border-2 border-black p-3 text-sm font-bold bg-white italic leading-relaxed">
                                        "{termResult?.headTeacherRemark || 'No remark recorded.'}"
                                    </p>
                                    <p className="text-[10px] font-black uppercase text-zinc-500 mt-1">Signed: SCHOOL PROPRIETOR</p>
                                </div>
                            </div>
                        )}
                        
                        {settings.signatures.visible && (
                            <div className="flex justify-between items-end pt-8 mt-4">
                                <div className="text-center w-52 flex flex-col items-center">
                                    <div className="h-10 w-full mb-1 flex items-center justify-center">
                                        <span className="text-[10px] uppercase font-black text-zinc-300">STAMP HERE</span>
                                    </div>
                                    <div className="w-full border-t-2 border-black pt-1 text-[10px] font-black uppercase">Teacher Signature</div>
                                </div>
                                <div className="text-center w-52 flex flex-col items-center">
                                     <div className="h-10 w-full mb-1 flex items-center justify-center">
                                        <span className="text-[10px] uppercase font-black text-zinc-300">STAMP HERE</span>
                                    </div>
                                    <div className="w-full border-t-2 border-black pt-1 text-[10px] font-black uppercase">Principal Signature</div>
                                </div>
                            </div>
                        )}
                    </section>
                </footer>
            </div>
        </div>
    </div>
    </div>
  );
});

ResultSheet.displayName = 'ResultSheet';
