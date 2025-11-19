
'use client';

import { useState, useMemo, useEffect } from 'react';
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
export type StudentData = { id: string; name: string; admissionNumber: string; isDeleted?: boolean; };
export type Classroom = { id: string; name: string; teacherName?: string; };
export type SchoolSettingsData = { currentSession: string; currentTermId: string; daysSchoolOpened: number; nextTermResumptionDate: Timestamp | Date | string; termEndingDate?: Timestamp | Date | string; };
export type TemplateSettings = { studentInfo: { fontSize: number; visible: boolean; }; header: { visible: boolean; }; subjectsTable: { visible: boolean; }; summary: { visible: boolean; }; softSkills: { visible: boolean; }; gradingKey: { visible: boolean; }; remarks: { visible: boolean; }; signatures: { visible: boolean; }; };
export type SavedTemplateData = { name: string; schoolName: string; settings: TemplateSettings; };
export type ResultEntry = { subjectName: string; ca1: number | null; ca2: number | null; exam: number | null; total: number; grade: string; remark: string; subSubjects?: string[] };
type Subject = { id:string; name: string; subSubjects?: string[] };

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
  const [classPopulation, setClassPopulation] = useState<number | null>(null);


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

  useEffect(() => {
    const fetchClassPopulation = async () => {
      if (isForTemplateBuilder || !firestore || !classroom?.id) {
        setClassPopulation(isForTemplateBuilder ? 25 : null);
        return;
      }
      
      const studentsInClassRef = collection(firestore, 'classrooms', classroom.id, 'students');
      const studentsInClassSnapshot = await getDocs(studentsInClassRef);
      
      if (studentsInClassSnapshot.empty) {
        setClassPopulation(0);
        return;
      }
      
      const studentIds = studentsInClassSnapshot.docs.map(d => d.data().studentId);
      
      if (studentIds.length === 0) {
        setClassPopulation(0);
        return;
      }
      
      // Now query the root students collection to check the `isDeleted` flag
      const q = query(collection(firestore, 'students'), where('__name__', 'in', studentIds), where('isDeleted', '!=', true));
      const activeStudentsSnapshot = await getDocs(q);

      setClassPopulation(activeStudentsSnapshot.size);
    };

    fetchClassPopulation();
  }, [firestore, classroom?.id, isForTemplateBuilder]);


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

  const liveOverall = useMemo(() => {
    if (isForTemplateBuilder || liveResultEntries.length === 0) return { average: '0.00', grade: 'N/A' };
    const totalSum = liveResultEntries.reduce((sum, entry) => sum + entry.total, 0);
    const average = totalSum / liveResultEntries.length;
    const { grade } = calculateGrade(average);
    return { average: average.toFixed(2), grade };
  }, [liveResultEntries, isForTemplateBuilder]);
  
  const scoreTotals = useMemo(() => {
    const entries = isForTemplateBuilder ? templateResultEntries : liveResultEntries;
    if (!entries || entries.length === 0) {
      return { ca1: 0, ca2: 0, exam: 0, total: 0 };
    }
    return entries.reduce(
      (acc, entry) => {
        acc.ca1 += entry.ca1 || 0;
        acc.ca2 += entry.ca2 || 0;
        acc.exam += entry.exam || 0;
        acc.total += entry.total || 0;
        return acc;
      },
      { ca1: 0, ca2: 0, exam: 0, total: 0 }
    );
  }, [isForTemplateBuilder, templateResultEntries, liveResultEntries]);


  const resultEntries = isForTemplateBuilder ? templateResultEntries : liveResultEntries;
  const overall = isForTemplateBuilder ? templateOverall : liveOverall;

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

  const reportSession = isForTemplateBuilder ? '2023/2024' : (termResult?.sessionId || schoolSettings?.currentSession);
  const reportTermName = isForTemplateBuilder ? '1st Term' : (schoolSettings?.currentTermId ? termNames[schoolSettings.currentTermId] : 'N/A');

  const isLoading = !isForTemplateBuilder && (settingsLoading || templateLoading || subjectsLoading || !termResultRef || classPopulation === null);
  
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


  if (isLoading) {
    return <div className="relative mx-auto w-full aspect-[210/297] bg-white p-6 shadow-lg"><Skeleton className="h-full w-full" /></div>;
  }
  
  if (!isForTemplateBuilder && !student) {
      return <div className="rounded-lg border bg-card p-8">Student data could not be loaded.</div>
  }
  
  const allSoftSkills = [
    "Punctuality", "Neatness", "Creativity",
    "Honesty", "Communication", "Teamwork",
    "Attentiveness", "Self Control", "Leadership", "Initiative"
  ];
  const softSkillsCol1 = allSoftSkills.slice(0, 6);
  const softSkillsCol2 = allSoftSkills.slice(6);


  // --- RENDER ---
  return (
    <div className="relative w-[794px] min-h-[1250px] bg-white text-black print:shadow-none print:m-0 print:p-0 print:w-full print:h-auto flex flex-col p-6 border-4 border-black">
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
            <Image src="/Logo.jpg" alt="School Watermark" width={400} height={400} className="opacity-10" />
        </div>
        <div className="relative z-10 flex flex-col h-full">
            {settings.header.visible && (
                <header className="mb-4 p-2 border-2 border-black">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="relative h-24 w-24"><Image src="/Logo.jpg" alt="School Logo" layout="fill" objectFit="contain" /></div>
                            <div className="text-black">
                                <h1 className="text-2xl font-bold text-black">{schoolName}</h1>
                                <p className="text-base text-black">Katampe 2 Mpape Abuja</p>
                                <p className="text-base font-semibold text-black">Motto: Exceeding Great</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="font-bold text-xl text-black">Student Report Card</h2>
                            <p className="text-base text-zinc-600">
                                {reportTermName}, {reportSession}
                            </p>
                        </div>
                    </div>
                    <Separator className="my-2 bg-black" />
                </header>
            )}

            <div className="flex-grow overflow-hidden flex flex-col">
                {settings.studentInfo.visible && (
                    <div className="mb-4 p-2 border border-black" style={{ fontSize: `${settings.studentInfo.fontSize}px` }}>
                        <div className="flex flex-col gap-1">
                            <div className="flex gap-4">
                                <div className="w-1/3"><StudentInfoDetail label="Student Name" value={student.name} /></div>
                                <div className="w-1/3"><StudentInfoDetail label="Admission No" value={student.admissionNumber} /></div>
                                <div className="w-1/3"><StudentInfoDetail label="Class" value={classroom?.name} /></div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-1/3"><StudentInfoDetail label="No. in class" value={classPopulation?.toString() ?? '...'} /></div>
                                <div className="w-1/3"><StudentInfoDetail label="Days Absent" value={daysAbsent} /></div>
                                <div className="w-1/3"><StudentInfoDetail label="Days Attended" value={isForTemplateBuilder ? '--' : termResult?.daysAttended?.toString() || '--'} /></div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-1/3"><StudentInfoDetail label="School Open" value={isForTemplateBuilder ? '65' : schoolSettings?.daysSchoolOpened?.toString()} /></div>
                                <div className="w-1/3"><StudentInfoDetail label="Term Ending" value={formattedTermEndingDate} /></div>
                                <div className="w-1/3"><StudentInfoDetail label="Resumption" value={formattedResumptionDate} /></div>
                            </div>
                        </div>
                    </div>
                )}
                
                {settings.subjectsTable.visible && (
                    <div className="border border-black overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="border border-black p-1 h-auto text-lg text-black">Subject</TableHead>
                                    <TableHead className="text-center border border-black p-1 h-auto text-lg text-black">CA1 (20)</TableHead>
                                    <TableHead className="text-center border border-black p-1 h-auto text-lg text-black">CA2 (20)</TableHead>
                                    <TableHead className="text-center border border-black p-1 h-auto text-lg text-black">Exam (60)</TableHead>
                                    <TableHead className="text-center border border-black p-1 h-auto text-lg text-black">Total (100)</TableHead>
                                    <TableHead className="border border-black p-1 h-auto text-lg text-black">Remark</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {resultEntries && resultEntries.length > 0 ? (
                                    resultEntries.map((entry, index) => (
                                        <TableRow key={entry.subjectName + index}>
                                            <TableCell className="border-b border-r border-black p-1 text-lg font-semibold">
                                                <div className="font-semibold">{entry.subjectName}</div>
                                                {entry.subSubjects && entry.subSubjects.length > 0 && (
                                                    <div className="pl-2 text-xs text-muted-foreground">
                                                        {entry.subSubjects.map((sub, i) => (
                                                            <div key={i}>{sub}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center border-b border-r border-black p-1 text-lg">{entry.ca1 ?? '--'}</TableCell>
                                            <TableCell className="text-center border-b border-r border-black p-1 text-lg">{entry.ca2 ?? '--'}</TableCell>
                                            <TableCell className="text-center border-b border-r border-black p-1 text-lg">{entry.exam ?? '--'}</TableCell>
                                            <TableCell className="text-center border-b border-r border-black p-1 text-lg font-semibold">{entry.total}</TableCell>
                                            <TableCell className="border-b border-black p-1 text-lg">{entry.remark}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                      <TableCell colSpan={6} className="h-24 text-center border-b border-black p-1 text-base">
                                        {isForTemplateBuilder ? 'Subjects will be shown here.' : 'No scores entered for this term.'}
                                      </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                             <TableFooter>
                                <TableRow>
                                  <TableCell className="border-b border-r border-black p-1 text-sm font-bold">Total</TableCell>
                                  <TableCell className="text-center border-b border-r border-black p-1 text-sm font-bold">{scoreTotals.ca1}</TableCell>
                                  <TableCell className="text-center border-b border-r border-black p-1 text-sm font-bold">{scoreTotals.ca2}</TableCell>
                                  <TableCell className="text-center border-b border-r border-black p-1 text-sm font-bold">{scoreTotals.exam}</TableCell>
                                  <TableCell className="text-center border-b border-r border-black p-1 text-sm font-bold">{scoreTotals.total}</TableCell>
                                  <TableCell className="border-b border-black p-1 text-sm"></TableCell>
                                </TableRow>
                              </TableFooter>
                        </Table>
                    </div>
                )}
                {settings.summary.visible && (
                    <div className="mt-1 flex justify-end">
                        <div className="w-1/2 rounded-md border border-black p-1 text-sm space-y-1">
                            <div className="flex justify-between"><span className="font-semibold text-black">Overall Average:</span><span className="text-black">{overall?.average}%</span></div>
                            <div className="flex justify-between"><span className="font-semibold text-black">Overall Grade:</span><span className="text-black">{overall?.grade}</span></div>
                        </div>
                    </div>
                )}
                 <div className="flex-grow min-h-0"></div>
                
                 {/* This footer now acts as the second page content */}
                <footer className="text-sm print:break-before-page" style={{ pageBreakBefore: 'always' }}>
                    <section className='border border-black p-1 flex flex-col gap-1'>
                        <div className="grid grid-cols-[1fr_1fr_2fr] gap-x-2 pt-1">
                            {settings.gradingKey.visible && (
                                <div className="space-y-1">
                                <h3 className="font-bold text-black text-sm">Grading Key</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow><TableHead className="p-0.5 h-auto text-xs border border-black text-black">Score</TableHead><TableHead className="p-0.5 h-auto text-xs border border-black text-black">Grade</TableHead><TableHead className="p-0.5 h-auto text-xs border border-black text-black">Remark</TableHead></TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow><TableCell className="p-0.5 h-auto text-xs border border-black">80 – 100</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">A</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">Excellent</TableCell></TableRow>
                                        <TableRow><TableCell className="p-0.5 h-auto text-xs border border-black">70 – 79</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">B</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">Very Good</TableCell></TableRow>
                                        <TableRow><TableCell className="p-0.5 h-auto text-xs border border-black">60 – 69</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">C</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">Good</TableCell></TableRow>
                                        <TableRow><TableCell className="p-0.5 h-auto text-xs border border-black">50 – 59</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">D</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">Fair</TableCell></TableRow>
                                        <TableRow><TableCell className="p-0.5 h-auto text-xs border border-black">0 – 49</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">F</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">Fail</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                                </div>
                            )}
                            
                            {settings.softSkills.visible && (
                                <div className="space-y-1">
                                    <h3 className="font-bold text-black text-sm">Skill Score Rating</h3>
                                    <Table>
                                        <TableHeader>
                                            <TableRow><TableHead className="p-0.5 h-auto text-xs border border-black text-black">Score</TableHead><TableHead className="p-0.5 h-auto text-xs border border-black text-black">Remark</TableHead></TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow><TableCell className="p-0.5 h-auto text-xs border border-black">5</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">Excellent</TableCell></TableRow>
                                            <TableRow><TableCell className="p-0.5 h-auto text-xs border border-black">4</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">Very Good</TableCell></TableRow>
                                            <TableRow><TableCell className="p-0.5 h-auto text-xs border border-black">3</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">Good</TableCell></TableRow>
                                            <TableRow><TableCell className="p-0.5 h-auto text-xs border border-black">2</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">Fair</TableCell></TableRow>
                                            <TableRow><TableCell className="p-0.5 h-auto text-xs border border-black">1</TableCell><TableCell className="p-0.5 h-auto text-xs border border-black">Poor</TableCell></TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {settings.softSkills.visible && (
                               <div className="space-y-1 p-1 border border-black">
                                    <h3 className="font-bold text-black text-sm">Soft Skills Assessment</h3>
                                    <div className="grid grid-cols-2 gap-x-2">
                                        <Table>
                                            <TableBody>
                                                {softSkillsCol1.map((skill, skillIndex) => (
                                                    <TableRow key={skillIndex}>
                                                        <TableCell className="font-medium p-0.5 h-auto text-xs border border-black text-black">{skill}</TableCell>
                                                        <TableCell className="text-right p-0.5 h-auto text-xs border border-black w-[20px]">5</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <Table>
                                            <TableBody>
                                                {softSkillsCol2.map((skill, skillIndex) => (
                                                    <TableRow key={skillIndex}>
                                                        <TableCell className="font-medium p-0.5 h-auto text-xs border border-black text-black">{skill}</TableCell>
                                                        <TableCell className="text-right p-0.5 h-auto text-xs border border-black w-[20px]">5</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {settings.remarks.visible && (
                            <div className="pt-2 space-y-1">
                                <div><h3 className="font-bold text-black text-sm">Teacher's Remarks:</h3><p className="min-h-[20px] rounded-md border-b border-black p-1 text-xs">{termResult?.teacherRemark || ' '}</p></div>
                                <div><h3 className="font-bold text-black text-sm">Head Teacher's Remarks:</h3><p className="min-h-[20px] rounded-md border-b border-black p-1 text-xs">{termResult?.headTeacherRemark || ' '}</p></div>
                            </div>
                        )}
                        {settings.signatures.visible && (
                            <div className="flex justify-between items-end pt-4">
                                <div className="text-center w-36"><div className="border-t border-black pt-1 text-sm">Class Teacher's Signature</div></div>
                                <div className="text-center w-36"><div className="border-t border-black pt-1 text-sm">Head Teacher's Signature</div></div>
                            </div>
                        )}
                    </section>
                </footer>
            </div>
        </div>
    </div>
  );
}
