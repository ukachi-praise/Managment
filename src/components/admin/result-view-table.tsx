
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download } from 'lucide-react';
import {
  useFirestore,
  useCollection,
  useUser,
  useDoc,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import {
  collection,
  query,
  where,
  doc,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { calculateGrade } from '@/lib/utils';


// --- TYPE DEFINITIONS ---
type Student = { id: string; name: string; admissionNumber: string };
type Classroom = { id: string; name: string; teacherName?: string; };
type Enrollment = { id: string; studentId: string; classroomId: string };
type Subject = { id: string; name: string; subSubjects?: string[] };
type SchoolSettingsData = { currentSession: string; currentTermId: string; daysSchoolOpened: number; nextTermResumptionDate: Timestamp | Date | string; };
type TemplateSettings = { studentInfo: { fontSize: number; visible: boolean; }; header: { visible: boolean; }; subjectsTable: { visible: boolean; }; summary: { visible: boolean; }; softSkills: { visible: boolean; }; gradingKey: { visible: boolean; }; remarks: { visible: boolean; }; signatures: { visible: boolean; }; };
type SavedTemplateData = { name: string; schoolName: string; settings: TemplateSettings; };
type SubjectScore = { ca1: number | null; ca2: number | null; exam: number | null; };
type TermResult = { scores: Record<string, SubjectScore>; studentId: string; termId: string; sessionId: string; classroomId: string; daysAttended?: number; };
const termNames: Record<string, string> = { term1: '1st Term', term2: '2nd Term', term3: '3rd Term' };


export function ResultViewTable() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // --- Data Fetching ---
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'classrooms') : null),
    [firestore]
  );
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  
  const enrollmentsQuery = useMemoFirebase(
    () =>
      selectedClass && firestore
        ? query(
            collection(firestore, 'enrollments'),
            where('classroomId', '==', selectedClass)
          )
        : null,
    [selectedClass, firestore]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const allStudentsQuery = useMemoFirebase(
    () => (firestore && user ? query(collection(firestore, 'students'), where('isDeleted', '!=', true)) : null),
    [firestore, user]
  );
  const { data: allStudents, isLoading: allStudentsLoading } = useCollection<Student>(allStudentsQuery);

  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: schoolSettings } = useDoc<SchoolSettingsData>(settingsRef);
  
  const templateRef = useMemoFirebase(() => (firestore ? doc(firestore, 'resultTemplates', 'main-template') : null), [firestore]);
  const { data: savedTemplateData } = useDoc<SavedTemplateData>(templateRef);
  
  const subjectsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'subjects') : null), [firestore]);
  const { data: allSubjects } = useCollection<Subject>(subjectsQuery);
  
  const studentsInClass = useMemo(() => {
      if (!enrollments || !allStudents) return [];
      const studentIds = new Set(enrollments.map(e => e.studentId));
      return allStudents.filter(s => studentIds.has(s.id)).sort((a,b) => a.name.localeCompare(b.name));
  }, [enrollments, allStudents]);


  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
  }

  const handleBulkDownload = async () => {
    if (!studentsInClass || studentsInClass.length === 0 || !firestore || !schoolSettings || !allSubjects) return;
    setIsExporting(true);
    toast({
      title: 'Initiating Bulk Export...',
      description: `Preparing to export ${studentsInClass.length} report(s).`,
    });

    const schoolName = savedTemplateData?.schoolName || 'JustVision Kiddies School';

    const allSubjectsMap = new Map(allSubjects.map(s => [s.id, s]));

    for (const student of studentsInClass) {
        try {
            // 1. Fetch the specific term result for the student
            const termResultId = `${schoolSettings.currentSession.replace('/', '-')}-${schoolSettings.currentTermId}`;
            const resultDocRef = doc(firestore, 'students', student.id, 'results', termResultId);
            const resultDocSnap = await getDocs(query(collection(firestore, 'students', student.id, 'results'), where('termId', '==', schoolSettings.currentTermId), where('sessionId', '==', schoolSettings.currentSession)));

            if (resultDocSnap.empty) {
                console.warn(`No result found for ${student.name} for the current term. Skipping.`);
                continue;
            }

            const termResult = resultDocSnap.docs[0].data() as TermResult;
            
            // 2. Process scores
            const scores = Object.entries(termResult.scores).map(([subjectId, score]) => {
                const subject = allSubjectsMap.get(subjectId);
                const total = (score.ca1 || 0) + (score.ca2 || 0) + (score.exam || 0);
                const { grade, remark } = calculateGrade(total);
                return {
                    subjectName: subject?.name || 'Unknown Subject',
                    subSubjects: subject?.subSubjects,
                    ca1: score.ca1,
                    ca2: score.ca2,
                    exam: score.exam,
                    total,
                    grade,
                    remark,
                };
            }).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

            const totalSum = scores.reduce((sum, entry) => sum + entry.total, 0);
            const average = scores.length > 0 ? (totalSum / scores.length) : 0;
            const overall = {
                average: average.toFixed(2),
                grade: calculateGrade(average).grade,
            };
            
            const classroom = classrooms?.find(c => c.id === selectedClass);
            
            // 3. Prepare payload for API
            const payload = {
                student,
                classroom: { ...classroom },
                termResult: { ...termResult, daysAttended: termResult.daysAttended || 0 },
                schoolSettings,
                scores,
                overall,
                schoolName: schoolName,
            };

            // 4. Call API route
            const response = await fetch('/api/export-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`PDF generation failed for ${student.name}`);
            }

            // 5. Trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${student.name.replace(/ /g, '_')}-Report_Card.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            toast({ title: 'Success', description: `Downloaded report for ${student.name}.` });
            
            // Stagger downloads slightly to prevent browser from blocking them
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error(`Failed to export for ${student.name}:`, error);
            toast({ variant: "destructive", title: "Export Error", description: `Could not generate PDF for ${student.name}.` });
        }
    }


    setIsExporting(false);
    toast({
      title: 'Bulk Export Complete',
      description: 'All student reports have been downloaded.',
    });
  };
  
  const isLoading = classroomsLoading;
  const isFetchingStudents = enrollmentsLoading || allStudentsLoading;
  const isDisplayingData = selectedClass;

  if (isLoading) {
    return <Card><CardHeader><CardTitle>Loading Data...</CardTitle></CardHeader><CardContent><Loader2 className="animate-spin" /></CardContent></Card>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>View Results by Class</CardTitle>
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <Select onValueChange={handleClassChange} value={selectedClass || ''}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder="Select a Class" />
            </SelectTrigger>
            <SelectContent>
              {classrooms?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
           {selectedClass && (
            <Button onClick={handleBulkDownload} disabled={isExporting || isFetchingStudents || studentsInClass.length === 0} className="w-full md:w-auto">
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isExporting ? 'Exporting...' : 'Export All as PDF'}
            </Button>
           )}
        </div>
      </CardHeader>
      <CardContent>
        {isDisplayingData ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Click &quot;Export All as PDF&quot; to download all report cards for the selected class. You can also view an individual report by clicking the button in the table.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFetchingStudents ? (
                     <TableRow><TableCell colSpan={2} className="text-center"><Loader2 className="inline-block animate-spin mr-2" /> Loading students...</TableCell></TableRow>
                  ) : studentsInClass.length > 0 ? (
                    studentsInClass.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">
                              {student.name}
                          </TableCell>
                           <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/admin/results/${student.id}`} target="_blank">
                                View Report
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={2} className="text-center h-24">
                           No students found for this class.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            Please select a class to view the list of students.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    