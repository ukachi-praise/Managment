
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
  useCollection,
  useDoc,
  useFirestore,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import {
  collection,
  query,
  where,
  doc,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { calculateGrade, cn } from '@/lib/utils';
import Image from 'next/image';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

// --- TYPE DEFINITIONS ---
export type StudentData = { id: string; name: string; admissionNumber: string };
export type Classroom = { id: string; name: string; teacherName?: string; };
export type SchoolSettingsData = { currentSession: string; currentTermId: string; daysSchoolOpened: number; nextTermResumptionDate: Timestamp | Date | string; };
export type TemplateSettings = { studentInfo: { fontSize: number; visible: boolean; }; header: { visible: boolean; }; subjectsTable: { visible: boolean; }; summary: { visible: boolean; }; softSkills: { visible: boolean; }; gradingKey: { visible: boolean; }; remarks: { visible: boolean; }; signatures: { visible: boolean; }; };
export type SavedTemplateData = { name: string; schoolName: string; settings: TemplateSettings; };
export type ResultEntry = { subjectName: string; ca1: number | null; ca2: number | null; exam: number | null; total: number; grade: string; remark: string; subSubjects?: string[] };
type Subject = { id: string; name: string; subSubjects?: string[] };

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
};


const termNames: Record<string, string> = { term1: '1st Term', term2: '2nd Term', term3: '3rd Term' };

const initialSettings: TemplateSettings = { studentInfo: { fontSize: 12, visible: true }, header: { visible: true }, subjectsTable: { visible: true }, summary: { visible: true }, softSkills: { visible: true }, gradingKey: { visible: true }, remarks: { visible: true }, signatures: { visible: true } };

// --- HELPER COMPONENTS ---
const StudentInfoDetail = ({ label, value, isLoading = false }: { label: string, value?: string | React.ReactNode, isLoading?: boolean }) => (
    <div className="flex text-xs">
        <span className="font-semibold w-[90px] shrink-0">{label}:</span>
        <span className="flex-1 border-b border-dotted border-black">
            {isLoading ? <Skeleton className="h-4 w-24" /> : value}
        </span>
    </div>
);

interface ResultSheetProps {
  student: StudentData;
  classroom: Classroom;
  templateData?: SavedTemplateData; // Optional, for template builder
  isForTemplateBuilder?: boolean; // Flag to indicate context
  resultEntries?: ResultEntry[]; // Optional, for template builder
  overall?: { average: string, grade: string }; // Optional, for template builder
}

// --- MAIN COMPONENT ---
export function ResultSheet({ 
  student, 
  classroom, 
  templateData,
  isForTemplateBuilder = false,
  resultEntries: templateResultEntries, // Renamed to avoid conflict
  overall: templateOverall // Renamed to avoid conflict
}: ResultSheetProps) {
  const firestore = useFirestore();
  const studentId = student.id;
  
  const [termResult, setTermResult] = useState<TermResult | null>(null);

  // --- DATA FETCHING ---
  const settingsRef = useMemoFirebase(() => (!isForTemplateBuilder && firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore, isForTemplateBuilder]);
  const { data: schoolSettings, isLoading: settingsLoading } = useDoc<SchoolSettingsData>(settingsRef);
  
  const templateRef = useMemoFirebase(() => (!isForTemplateBuilder && firestore ? doc(firestore, 'resultTemplates', 'main-template') : null), [firestore, isForTemplateBuilder]);
  const { data: savedTemplateData, isLoading: templateLoading } = useDoc<SavedTemplateData>(templateRef);
  
  const subjectsQuery = useMemoFirebase(() => (!isForTemplateBuilder && firestore ? collection(firestore, 'subjects') : null), [firestore, isForTemplateBuilder]);
  const { data: allSubjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQuery);

  const termResultRef = useMemoFirebase(() => {
      if (isForTemplateBuilder || !firestore || !studentId || !schoolSettings) return null;
      const termResultId = `${schoolSettings.currentSession.replace('/', '-')}-${schoolSettings.currentTermId}`;
      return doc(firestore, 'students', studentId, 'results', termResultId);
  }, [firestore, studentId, schoolSettings, isForTemplateBuilder]);
  
  useEffect(() => {
    if (isForTemplateBuilder || !termResultRef) {
        setTermResult(null);
        return;
    };
    const unsubscribe = onSnapshot(termResultRef, (snap) => {
      if (snap.exists()) setTermResult(snap.data() as TermResult);
      else setTermResult(null);
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
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [termResult, allSubjectsMap, isForTemplateBuilder]);

  const liveOverall = useMemo(() => {
    if (isForTemplateBuilder || liveResultEntries.length === 0) return { average: '0.00', grade: 'N/A' };
    const totalSum = liveResultEntries.reduce((sum, entry) => sum + entry.total, 0);
    const average = totalSum / liveResultEntries.length;
    const { grade } = calculateGrade(average);
    return { average: average.toFixed(2), grade };
  }, [liveResultEntries, isForTemplateBuilder]);

  const resultEntries = isForTemplateBuilder ? templateResultEntries : liveResultEntries;
  const overall = isForTemplateBuilder ? templateOverall : liveOverall;

  const formattedResumptionDate = useMemo(() => {
    if (isForTemplateBuilder) return format(new Date(), 'PPP');
    if (!schoolSettings?.nextTermResumptionDate) return 'N/A';
    const date = schoolSettings.nextTermResumptionDate instanceof Timestamp
      ? schoolSettings.nextTermResumptionDate.toDate()
      : new Date(schoolSettings.nextTermResumptionDate);
    return format(date, 'PPP');
  }, [schoolSettings, isForTemplateBuilder]);

  const reportSession = isForTemplateBuilder ? '2023/2024' : (termResult?.sessionId || schoolSettings?.currentSession);
  const reportTermId = isForTemplateBuilder ? 'term1' : (termResult?.termId || schoolSettings?.currentTermId);
  const reportTermName = reportTermId ? termNames[reportTermId] : 'N/A';

  const isLoading = !isForTemplateBuilder && (settingsLoading || templateLoading || subjectsLoading || !termResultRef);


  if (isLoading) {
    return <div className="relative mx-auto w-full aspect-[210/297] bg-white p-6 shadow-lg"><Skeleton className="h-full w-full" /></div>;
  }
  
  if (!isForTemplateBuilder && !student) {
      return <div className="rounded-lg border bg-card p-8">Student data could not be loaded.</div>
  }

  // --- RENDER ---
  return (
    <>
    {/* Page 1 */}
    <div className="relative w-full aspect-[210/297] bg-white text-black print:shadow-none print:m-0 print:p-0 print:max-w-none print:h-full print:break-after-page">
      <div className="absolute inset-0 z-0 flex items-center justify-center">
          <Image src="/Logo.jpg" alt="School Watermark" width={400} height={400} className="opacity-10" />
      </div>
      <div className="relative z-10 flex h-full flex-col p-6">
        {settings.header.visible && (
            <header className="mb-4 p-2 border border-black">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative h-20 w-20"><Image src="/Logo.jpg" alt="School Logo" layout="fill" objectFit="contain" /></div>
                        <div className="text-black">
                            <h1 className="font-headline text-2xl font-bold text-black">{schoolName}</h1>
                            <p className="text-base text-black">Katampe 2 Mpape Abuja</p>
                            <p className="text-base font-semibold text-black">Motto: Exceeding Great</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="font-bold text-lg text-black">Student Report Card</h2>
                        <p className="text-base text-zinc-600">
                            {reportTermName}, {reportSession}
                        </p>
                    </div>
                </div>
                <Separator className="my-2 bg-black" />
            </header>
        )}

        <div className="flex-grow overflow-hidden">
            <div className="overflow-auto h-full">
                {settings.studentInfo.visible && (
                    <div className="mb-4 p-2 border border-black" style={{ fontSize: `${settings.studentInfo.fontSize}px` }}>
                        <div className="flex flex-col gap-1">
                            <div className="flex gap-4">
                                <div className="w-1/3"><StudentInfoDetail label="Student Name" value={student.name} /></div>
                                <div className="w-1/3"><StudentInfoDetail label="Admission No" value={student.admissionNumber} /></div>
                                <div className="w-1/3"><StudentInfoDetail label="Class" value={classroom?.name} /></div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-1/3"><StudentInfoDetail label="Term" value={reportTermName} /></div>
                                <div className="w-1/3"><StudentInfoDetail label="Session" value={reportSession} /></div>
                                <div className="w-1/3"><StudentInfoDetail label="Days Attended" value={isForTemplateBuilder ? '--' : termResult?.daysAttended?.toString() || '--'} /></div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-1/3"><StudentInfoDetail label="School Open" value={isForTemplateBuilder ? '65' : schoolSettings?.daysSchoolOpened?.toString()} /></div>
                                <div className="w-1/3"><StudentInfoDetail label="Resumption" value={formattedResumptionDate} /></div>
                                <div className="w-1/3"><StudentInfoDetail label="Class Teacher" value={classroom?.teacherName || 'N/A'} /></div>
                            </div>
                        </div>
                    </div>
                )}
                
                {settings.subjectsTable.visible && (
                    <div className="border border-black">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="border border-black p-2 h-auto text-base text-black">Subject</TableHead>
                                    <TableHead className="text-center border border-black p-2 h-auto text-base text-black">CA1 (20)</TableHead>
                                    <TableHead className="text-center border border-black p-2 h-auto text-base text-black">CA2 (20)</TableHead>
                                    <TableHead className="text-center border border-black p-2 h-auto text-base text-black">Exam (60)</TableHead>
                                    <TableHead className="text-center border border-black p-2 h-auto text-base text-black">Total (100)</TableHead>
                                    <TableHead className="border border-black p-2 h-auto text-base text-black">Remark</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {resultEntries && resultEntries.length > 0 ? (
                                    resultEntries.map((entry, index) => (
                                        <TableRow key={entry.subjectName + index}>
                                            <TableCell className="border-b border-r border-black p-2 text-base">
                                                <div className="font-semibold">{entry.subjectName}</div>
                                                {entry.subSubjects && entry.subSubjects.length > 0 && (
                                                    <div className="pl-2 text-sm text-muted-foreground">
                                                        {entry.subSubjects.map((sub, index) => (
                                                            <div key={index}>{sub}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center border-b border-r border-black p-2 text-base">{entry.ca1 ?? '--'}</TableCell>
                                            <TableCell className="text-center border-b border-r border-black p-2 text-base">{entry.ca2 ?? '--'}</TableCell>
                                            <TableCell className="text-center border-b border-r border-black p-2 text-base">{entry.exam ?? '--'}</TableCell>
                                            <TableCell className="text-center border-b border-r border-black p-2 text-base font-semibold">{entry.total}</TableCell>
                                            <TableCell className="border-b border-black p-2 text-base">{entry.remark}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                      <TableCell colSpan={6} className="h-24 text-center border-b border-black p-2 text-base">
                                        {isForTemplateBuilder ? 'Subjects will be shown here.' : 'No scores entered for this term.'}
                                      </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
                 {settings.summary.visible && (
                    <div className="mt-2 flex justify-end">
                        <div className="w-1/2 rounded-md border border-black p-2 text-sm space-y-1">
                            <div className="flex justify-between"><span className="font-semibold text-black">Overall Average:</span><span className="text-black">{overall?.average}%</span></div>
                            <div className="flex justify-between"><span className="font-semibold text-black">Overall Grade:</span><span className="text-black">{overall?.grade}</span></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
    
    {/* Page 2 */}
    <div className="relative w-full aspect-[210/297] bg-white text-black print:shadow-none print:m-0 print:p-0 print:max-w-none print:h-full">
         <div className="absolute inset-0 z-0 flex items-center justify-center">
          <Image src="/Logo.jpg" alt="School Watermark" width={400} height={400} className="opacity-10" />
      </div>
       <div className="relative z-10 flex h-full flex-col justify-start p-6">
            <footer className="pt-2 text-xs">
                <section className='border border-black p-2 flex flex-col gap-2'>
                    {settings.softSkills.visible && (
                    <div className="space-y-1">
                        <h3 className="font-bold text-black text-[10px]">Soft Skills Assessment</h3>
                        <div className="grid grid-cols-3 gap-x-2">
                            {[
                                ["Punctuality", "Neatness", "Creativity"],
                                ["Honesty", "Communication", "Teamwork"],
                                ["Attentiveness", "Self Control", "Leadership"]
                            ].map((column, colIndex) => (
                                <div key={colIndex}>
                                    <Table>
                                        <TableBody>
                                            {column.map((skill, skillIndex) => (
                                                <TableRow key={skillIndex}>
                                                    <TableCell className="font-medium p-0.5 h-auto text-[9px] border border-black text-black">{skill}</TableCell>
                                                    <TableCell className="text-right p-0.5 h-auto text-[9px] border border-black w-[20px]">5</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))}
                        </div>
                    </div>
                    )}
                    {settings.gradingKey.visible && (
                        <div className="grid grid-cols-2 gap-x-4 pt-2 text-[10px]">
                            <div className="space-y-1">
                                <h3 className="font-bold text-black">Grading Key</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow><TableHead className="p-0.5 h-auto text-[9px] border border-black text-black">Score</TableHead><TableHead className="p-0.5 h-auto text-[9px] border border-black text-black">Grade</TableHead><TableHead className="p-0.5 h-auto text-[9px] border border-black text-black">Remark</TableHead></TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow><TableCell className="p-0.5 h-auto text-[9px] border border-black">80 – 100</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">A</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">Excellent</TableCell></TableRow>
                                        <TableRow><TableCell className="p-0.5 h-auto text-[9px] border border-black">70 – 79</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">B</TableCell><TableCell className="p-0.5 h-auto text-[9px] border-black">Very Good</TableCell></TableRow>
                                        <TableRow><TableCell className="p-0.5 h-auto text-[9px] border border-black">60 – 69</TableCell><TableCell className="p-0.5 h-auto text-[9px] border-black">C</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">Good</TableCell></TableRow>
                                        <TableRow><TableCell className="p-0.5 h-auto text-[9px] border border-black">50 – 59</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">D</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">Fair</TableCell></TableRow>
                                        <TableRow><TableCell className="p-0.5 h-auto text-[9px] border border-black">0 – 49</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">F</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">Fail</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-black">Skill Score Rating</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow><TableHead className="p-0.5 h-auto text-[9px] border border-black text-black">Score</TableHead><TableHead className="p-0.5 h-auto text-[9px] border border-black text-black">Remark</TableHead></TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow><TableCell className="p-0.5 h-auto text-[9px] border border-black">5</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">Excellent</TableCell></TableRow>
                                        <TableRow><TableCell className="p-0.5 h-auto text-[9px] border border-black">4</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">Very Good</TableCell></TableRow>
                                        <TableRow><TableCell className="p-0.5 h-auto text-[9px] border border-black">3</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">Good</TableCell></TableRow>
                                        <TableRow><TableCell className="p-0.5 h-auto text-[9px] border border-black">2</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">Fair</TableCell></TableRow>
                                        <TableRow><TableCell className="p-0.5 h-auto text-[9px] border border-black">1</TableCell><TableCell className="p-0.5 h-auto text-[9px] border border-black">Poor</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                    {settings.remarks.visible && (
                        <div className="pt-2 space-y-2">
                            <div><h3 className="font-bold text-black">Teacher's Remarks:</h3><p className="min-h-[25px] rounded-md border-b border-black p-1">A brilliant student...</p></div>
                            <div><h3 className="font-bold text-black">Head Teacher's Remarks:</h3><p className="min-h-2-5px] rounded-md border-b border-black p-1">Excellent performance...</p></div>
                        </div>
                    )}
                    {settings.signatures.visible && (
                        <div className="flex justify-between items-end pt-4">
                            <div className="text-center w-36"><div className="border-t border-black pt-1">Class Teacher's Signature</div></div>
                            <div className="text-center w-36"><div className="border-t border-black pt-1">Head Teacher's Signature</div></div>
                        </div>
                    )}
                </section>
            </footer>
        </div>
    </div>
    </>
  );
}
