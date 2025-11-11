

'use client';

import { useState, useMemo } from 'react';
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
} from 'firebase/firestore';
import { calculateGrade, cn } from '@/lib/utils';
import Image from 'next/image';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

// --- TYPE DEFINITIONS ---
type StudentData = { id: string; name: string; admissionNumber: string };
type Subject = { id: string; name: string };
type Classroom = { id: string; name: string; teacherName?: string; };
type Result = { subjectId: string; ca1: number; ca2: number; ca3: number; exam: number; daysAttended: number; sessionId: string; termId: string; };
type SchoolSettingsData = { currentSession: string; currentTermId: string; daysSchoolOpened: number; nextTermResumptionDate: Timestamp | Date | string; };
type TemplateSettings = { studentInfo: { fontSize: number; visible: boolean; }; header: { visible: boolean; }; subjectsTable: { visible: boolean; }; summary: { visible: boolean; }; softSkills: { visible: boolean; }; gradingKey: { visible: boolean; }; remarks: { visible: boolean; }; signatures: { visible: boolean; }; };
type SavedTemplateData = { name: string; schoolName: string; settings: TemplateSettings; };
type ResultEntry = { subjectName: string; ca1: number; ca2: number; ca3: number; exam: number; total: number; grade: string; remark: string; };

const termNames: Record<string, string> = { term1: '1st Term', term2: '2nd Term', term3: '3rd Term' };

const initialSettings: TemplateSettings = { studentInfo: { fontSize: 10, visible: true }, header: { visible: true }, subjectsTable: { visible: true }, summary: { visible: true }, softSkills: { visible: true }, gradingKey: { visible: true }, remarks: { visible: true }, signatures: { visible: true } };

// --- HELPER COMPONENTS ---
const StudentInfoDetail = ({ label, value, isLoading = false }: { label: string, value?: string | React.ReactNode, isLoading?: boolean }) => (
    <div className="flex text-xs">
        <span className="font-semibold w-[80px] shrink-0">{label}:</span>
        <span className="flex-1 border-b border-dotted border-black">
            {isLoading ? <Skeleton className="h-4 w-24" /> : value}
        </span>
    </div>
);

interface ResultSheetProps {
  student: StudentData;
  classroom: Classroom;
}

// --- MAIN COMPONENT ---
export function ResultSheet({ student, classroom }: ResultSheetProps) {
  const firestore = useFirestore();
  const studentId = student.id;
  const classroomId = classroom.id;

  // --- DATA FETCHING ---
  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: schoolSettings, isLoading: settingsLoading } = useDoc<SchoolSettingsData>(settingsRef);
  
  const templateRef = useMemoFirebase(() => (firestore ? doc(firestore, 'resultTemplates', 'main-template') : null), [firestore]);
  const { data: savedTemplateData, isLoading: templateLoading } = useDoc<SavedTemplateData>(templateRef);

  const classroomSubjectsQuery = useMemoFirebase(() => (classroomId ? query(collection(firestore, 'classroomSubjects'), where('classroomId', '==', classroomId)) : null), [firestore, classroomId]);
  const { data: classroomSubjects, isLoading: classroomSubjectsLoading } = useCollection(classroomSubjectsQuery);
  
  const allSubjectsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'subjects') : null), [firestore]);
  const { data: allSubjects, isLoading: subjectsLoading } = useCollection<Subject>(allSubjectsQuery);

  const resultsQuery = useMemoFirebase(() => {
    // IMPORTANT: Wait for schoolSettings to be loaded before creating the query
    if (!firestore || !studentId || !schoolSettings?.currentSession || !schoolSettings?.currentTermId) {
      return null;
    }
    return query(
      collection(firestore, 'results'), 
      where('studentId', '==', studentId),
      where('sessionId', '==', schoolSettings.currentSession),
      where('termId', '==', schoolSettings.currentTermId)
    );
  }, [firestore, studentId, schoolSettings]); // Dependency on schoolSettings is crucial
  
  const { data: studentResults, isLoading: resultsLoading } = useCollection<Result>(resultsQuery);

  // --- DATA PROCESSING & MEMOIZATION ---
  const settings = savedTemplateData?.settings || initialSettings;
  const schoolName = savedTemplateData?.schoolName || 'JustVision Kiddies School';

  const subjectsMap = useMemo(() => allSubjects?.reduce((acc, subject) => ({ ...acc, [subject.id]: subject.name }), {} as Record<string, string>) || {}, [allSubjects]);
  const assignedSubjectIds = useMemo(() => new Set(classroomSubjects?.map(cs => cs.subjectId) || []), [classroomSubjects]);
  const resultsMap = useMemo(() => studentResults?.reduce((acc, result) => ({ ...acc, [result.subjectId]: result }), {} as Record<string, Result>) || {}, [studentResults]);

  const resultEntries: ResultEntry[] = useMemo(() => {
    if (!allSubjects || !classroomSubjects) return [];

    return Array.from(assignedSubjectIds)
      .map(subjectId => {
        const subjectName = subjectsMap[subjectId];
        if (!subjectName) return null;
        
        const result = resultsMap[subjectId] || { ca1: 0, ca2: 0, ca3: 0, exam: 0 };
        const total = (result.ca1 || 0) + (result.ca2 || 0) + (result.ca3 || 0) + (result.exam || 0);
        const { grade, remark } = calculateGrade(total);

        return {
          subjectName,
          ca1: result.ca1 || 0,
          ca2: result.ca2 || 0,
          ca3: result.ca3 || 0,
          exam: result.exam || 0,
          total,
          grade,
          remark,
        };
      })
      .filter((r): r is ResultEntry => r !== null)
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [assignedSubjectIds, subjectsMap, resultsMap, allSubjects, classroomSubjects]);

  const overall = useMemo(() => {
    if (resultEntries.length === 0) return { average: 0, grade: 'N/A' };
    const totalSum = resultEntries.reduce((sum, entry) => sum + entry.total, 0);
    const average = totalSum / resultEntries.length;
    const { grade } = calculateGrade(average);
    return { average: average.toFixed(2), grade };
  }, [resultEntries]);

  const formattedResumptionDate = useMemo(() => {
    if (!schoolSettings?.nextTermResumptionDate) return 'N/A';
    const date = schoolSettings.nextTermResumptionDate instanceof Timestamp
      ? schoolSettings.nextTermResumptionDate.toDate()
      : new Date(schoolSettings.nextTermResumptionDate);
    return format(date, 'PPP');
  }, [schoolSettings]);

  // The main loading state now correctly includes resultsLoading
  const isLoading = resultsLoading || subjectsLoading || settingsLoading || classroomSubjectsLoading || templateLoading;

  if (isLoading) {
    return (
        <div className="relative mx-auto aspect-[210/297] w-full max-w-[210mm] bg-white p-6 shadow-lg">
            <Skeleton className="h-full w-full" />
        </div>
    );
  }
  
  if (!student) {
      return <div className="rounded-lg border bg-card p-8">Student data could not be loaded.</div>
  }

  // --- RENDER ---
  return (
    <div className="relative mx-auto aspect-[210/297] w-full max-w-[210mm] bg-white p-6 shadow-lg print:shadow-none print:m-0 print:p-0 print:max-w-none print:h-full text-black">
      <div className="absolute inset-0 z-0 flex items-center justify-center">
          <Image src="/Logo.jpg" alt="School Watermark" width={400} height={400} className="opacity-10" />
      </div>
      <div className="relative z-10 flex flex-col h-full">
        {settings.header.visible && (
            <header className="mb-4 p-2 border border-black">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative h-16 w-16"><Image src="/Logo.jpg" alt="School Logo" layout="fill" objectFit="contain" /></div>
                        <div className="text-black">
                            <h1 className="font-headline text-xl font-bold text-black">{schoolName}</h1>
                            <p className="text-sm text-black">Katampe 2 Mpape Abuja</p>
                            <p className="text-sm font-semibold text-black">Motto: Exceeding Great</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="font-bold text-base text-black">Student Report Card</h2>
                        <p className="text-xs text-zinc-600">
                            {schoolSettings?.currentTermId ? termNames[schoolSettings.currentTermId] : 'N/A'}, {schoolSettings?.currentSession}
                        </p>
                    </div>
                </div>
                <Separator className="my-2 bg-black" />
            </header>
        )}

        {settings.studentInfo.visible && (
            <div className="mb-4 p-2 border border-black" style={{ fontSize: `${settings.studentInfo.fontSize}px` }}>
                <div className="flex flex-col gap-1">
                    <div className="flex gap-4">
                        <div className="w-1/3"><StudentInfoDetail label="Student Name" value={student.name} /></div>
                        <div className="w-1/3"><StudentInfoDetail label="Admission No" value={student.admissionNumber} /></div>
                        <div className="w-1/3"><StudentInfoDetail label="Class" value={classroom?.name} /></div>
                    </div>
                    <div className="flex gap-4">
                        <div className="w-1/3"><StudentInfoDetail label="Term" value={schoolSettings?.currentTermId ? termNames[schoolSettings.currentTermId] : undefined} /></div>
                        <div className="w-1/3"><StudentInfoDetail label="Session" value={schoolSettings?.currentSession} /></div>
                        <div className="w-1/3"><StudentInfoDetail label="Days Attended" value={studentResults?.[0]?.daysAttended?.toString() || '0'} /></div>
                    </div>
                    <div className="flex gap-4">
                        <div className="w-1/3"><StudentInfoDetail label="School Open" value={schoolSettings?.daysSchoolOpened.toString()} /></div>
                        <div className="w-1/3"><StudentInfoDetail label="Resumption" value={formattedResumptionDate} /></div>
                        <div className="w-1/3"><StudentInfoDetail label="Class Teacher" value={classroom?.teacherName || 'N/A'} /></div>
                    </div>
                </div>
            </div>
        )}
        
        <div className="flex-grow flex flex-col">
            {settings.subjectsTable.visible && (
                <div className="border border-black flex-grow">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="border border-black p-1 h-auto text-xs text-black">Subject</TableHead>
                                <TableHead className="text-center border border-black p-1 h-auto text-[10px] text-black"><div>CA1</div><div>(10)</div></TableHead>
                                <TableHead className="text-center border border-black p-1 h-auto text-[10px] text-black"><div>CA2</div><div>(10)</div></TableHead>
                                <TableHead className="text-center border border-black p-1 h-auto text-[10px] text-black"><div>CA3</div><div>(10)</div></TableHead>
                                <TableHead className="text-center border border-black p-1 h-auto text-[10px] text-black"><div>Exam</div><div>(70)</div></TableHead>
                                <TableHead className="text-center border border-black p-1 h-auto text-[10px] text-black"><div>Total</div><div>(100)</div></TableHead>
                                <TableHead className="border border-black p-1 h-auto text-xs text-black">Remark</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {resultEntries.map(entry => (
                                <TableRow key={entry.subjectName}>
                                    <TableCell className="border-b border-r border-black p-1 text-xs">{entry.subjectName}</TableCell>
                                    <TableCell className="text-center border-b border-r border-black p-1 text-xs">{entry.ca1}</TableCell>
                                    <TableCell className="text-center border-b border-r border-black p-1 text-xs">{entry.ca2}</TableCell>
                                    <TableCell className="text-center border-b border-r border-black p-1 text-xs">{entry.ca3}</TableCell>
                                    <TableCell className="text-center border-b border-r border-black p-1 text-xs">{entry.exam}</TableCell>
                                    <TableCell className="text-center border-b border-r border-black p-1 text-xs">{entry.total}</TableCell>
                                    <TableCell className="border-b border-black p-1 text-xs">{entry.remark}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
            {settings.summary.visible && (
                <div className="mt-2 flex justify-end">
                    <div className="w-1/2 rounded-md border border-black p-2 text-xs space-y-1">
                        <div className="flex justify-between"><span className="font-semibold text-black">Overall Average:</span><span className="text-black">{overall.average}%</span></div>
                        <div className="flex justify-between"><span className="font-semibold text-black">Overall Grade:</span><span className="text-black">{overall.grade}</span></div>
                    </div>
                </div>
            )}
        </div>
        
        <footer className="mt-auto pt-2 text-xs">
            <section className='border border-black p-2 flex flex-col gap-2'>
                {settings.softSkills.visible && (
                  <div className="space-y-1">
                    <h3 className="font-bold text-black">Soft Skills Assessment</h3>
                    <div className="grid grid-cols-3 gap-x-4">
                      {/* Placeholder data, replace with actual data */}
                      <div><Table><TableBody><TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Punctuality</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">5</TableCell></TableRow><TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Neatness</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">4</TableCell></TableRow></TableBody></Table></div>
                      <div><Table><TableBody><TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Honesty</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">5</TableCell></TableRow><TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Communication</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">5</TableCell></TableRow></TableBody></Table></div>
                      <div><Table><TableBody><TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Attentiveness</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">4</TableCell></TableRow><TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Self Control</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">5</TableCell></TableRow></TableBody></Table></div>
                    </div>
                  </div>
                )}
                {settings.gradingKey.visible && (
                    <div className="grid grid-cols-2 gap-x-4 pt-2">
                        <div className="space-y-1"><h3 className="font-bold text-black">Grading Key</h3><Table><TableHeader><TableRow><TableHead className="p-1 h-auto text-[10px] border border-black text-black">Score</TableHead><TableHead className="p-1 h-auto text-[10px] border border-black text-black">Grade</TableHead><TableHead className="p-1 h-auto text-[10px] border border-black text-black">Remark</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">80 – 100</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">A</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Excellent</TableCell></TableRow><TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">70 – 79</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">B</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Very Good</TableCell></TableRow><TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">60 – 69</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">C</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Good</TableCell></TableRow><TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">50 – 59</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">D</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Fair</TableCell></TableRow><TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">0 – 49</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">F</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Fail</TableCell></TableRow></TableBody></Table></div>
                        <div className="space-y-1"><h3 className="font-bold text-black">Skill Score Rating</h3><Table><TableHeader><TableRow><TableHead className="p-1 h-auto text-[10px] border border-black text-black">Score</TableHead><TableHead className="p-1 h-auto text-[10px] border border-black text-black">Remark</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">5</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Excellent</TableCell></TableRow><TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">4</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Very Good</TableCell></TableRow><TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">3</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Good</TableCell></TableRow><TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">2</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Fair</TableCell></TableRow><TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">1</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Poor</TableCell></TableRow></TableBody></Table></div>
                    </div>
                )}
                {settings.remarks.visible && (
                    <div className="pt-2 space-y-2">
                        <div><h3 className="font-bold text-black">Teacher's Remarks:</h3><p className="min-h-[25px] rounded-md border-b border-black p-1">A brilliant student...</p></div>
                        <div><h3 className="font-bold text-black">Head Teacher's Remarks:</h3><p className="min-h-[25px] rounded-md border-b border-black p-1">Excellent performance...</p></div>
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
  );
}
