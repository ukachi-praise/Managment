
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Download, FileArchive, Edit } from 'lucide-react';
import {
  useFirestore,
  useUser,
} from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/firebase/provider';
import {
  collection,
  query,
  where,
  doc,
  getDocs,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { calculateGrade } from '@/lib/utils';
import { saveAs } from 'file-saver';


// --- TYPE DEFINITIONS ---
type Student = { id: string; name: string; admissionNumber: string; isDeleted?: boolean; };
type Classroom = { id: string; name: string; teacherName?: string; };
type StudentInClass = { studentId: string; name: string; };
type Subject = { id: string; name: string; subSubjects?: string[] };
type SchoolSettingsData = { currentSessionId: string; currentTermId: string; daysSchoolOpened: number; nextTermResumptionDate: Timestamp | Date | string; };
type TemplateSettings = { studentInfo: { fontSize: number; visible: boolean; }; header: { visible: boolean; }; subjectsTable: { visible: boolean; }; summary: { visible: boolean; }; softSkills: { visible: boolean; }; gradingKey: { visible: boolean; }; remarks: { visible: boolean; }; signatures: { visible: boolean; }; };
type SavedTemplateData = { name: string; schoolName: string; settings: TemplateSettings; };
type SubjectScore = { ca1: number | null; ca2: number | null; exam: number | null; };
type TermResult = { scores: Record<string, SubjectScore>; studentId: string; termId: string; sessionId: string; classroomId: string; daysAttended?: number; };
type AcademicSession = { id: string; name: string; }
type Term = { id: string; name: "1st" | "2nd" | "3rd"; }

const termNames: Record<string, string> = { "1st": '1st Term', "2nd": '2nd Term', "3rd": '3rd Term' };


export function ResultViewTable() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const [studentsInClass, setStudentsInClass] = useState<Student[]>([]);
  const [isFetchingStudents, setIsFetchingStudents] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  
  // --- Data Fetching ---
  const sessionsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'sessions') : null), [firestore]);
  const { data: sessions, isLoading: sessionsLoading } = useCollection<AcademicSession>(sessionsQuery);
  
  const termsQuery = useMemoFirebase(() => (firestore && selectedSession ? collection(firestore, 'sessions', selectedSession, 'terms') : null), [firestore, selectedSession]);
  const { data: terms, isLoading: termsLoading } = useCollection<Term>(termsQuery);
  
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'classrooms') : null),
    [firestore]
  );
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  
  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: schoolSettings } = useDoc<SchoolSettingsData>(settingsRef);
  
  const templateRef = useMemoFirebase(() => (firestore ? doc(firestore, 'resultTemplates', 'main-template') : null), [firestore]);
  const { data: savedTemplateData } = useDoc<SavedTemplateData>(templateRef);
  
  const subjectsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'subjects') : null), [firestore]);
  const { data: allSubjects } = useCollection<Subject>(subjectsQuery);

  const sortedSessions = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort((a,b) => b.name.localeCompare(a.name));
  }, [sessions]);
  
  useEffect(() => {
    const fetchStudents = async () => {
        if (!selectedClass || !firestore) {
            setStudentsInClass([]);
            return;
        }

        setIsFetchingStudents(true);
        try {
            // 1. Get student references from the subcollection
            const studentsInClassRef = collection(firestore, 'classrooms', selectedClass, 'students');
            const studentsInClassSnap = await getDocs(studentsInClassRef);
            const studentIds = studentsInClassSnap.docs.map(d => d.id);

            if (studentIds.length === 0) {
                setStudentsInClass([]);
                setIsFetchingStudents(false);
                return;
            }

            // 2. Fetch student documents in batches of 30
            const studentDetails: Student[] = [];
            for (let i = 0; i < studentIds.length; i += 30) {
                const batchIds = studentIds.slice(i, i + 30);
                if (batchIds.length === 0) continue;

                const studentsQuery = query(collection(firestore, 'students'), where('__name__', 'in', batchIds));
                const studentsSnap = await getDocs(studentsQuery);
                studentsSnap.forEach(doc => {
                    const studentData = doc.data() as Omit<Student, 'id'>;
                    if (!studentData.isDeleted) {
                        studentDetails.push({ id: doc.id, ...studentData });
                    }
                });
            }
            
            setStudentsInClass(studentDetails.sort((a, b) => a.name.localeCompare(b.name)));

        } catch (error) {
            console.error("Error fetching students for class:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch students for the selected class.' });
        } finally {
            setIsFetchingStudents(false);
        }
    };

    fetchStudents();
  }, [selectedClass, firestore, toast]);


  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
  }

  const handleBulkDownload = async () => {
    if (!studentsInClass || studentsInClass.length === 0 || !selectedSession || !selectedTerm) return;

    setIsDownloading(true);
    toast({
        title: "Pop-ups Required",
        description: `Your browser may block pop-ups. Please allow pop-ups for this site to download all ${studentsInClass.length} reports.`,
        duration: 10000,
    });
    
    for (let i = 0; i < studentsInClass.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const url = `/admin/results/${studentsInClass[i].id}?session=${selectedSession}&term=${selectedTerm}`;
      window.open(url, '_blank');
    }
    
    setIsDownloading(false);
  };
  
    const handleBulkZip = async () => {
    if (!studentsInClass || studentsInClass.length === 0 || !firestore || !schoolSettings || !allSubjects || !selectedSession || !selectedTerm) {
        toast({ variant: "destructive", title: "Missing Info", description: "Please select a session, term, and class." });
        return;
    }

    setIsZipping(true);
    toast({
      title: 'Initiating ZIP Export...',
      description: `Preparing to export reports for ${studentsInClass.length} student(s). This may take a moment.`,
    });

    try {
        const classroom = classrooms?.find(c => c.id === selectedClass);
        if(!classroom) throw new Error("Classroom not found");
        
        const sessionDoc = sessions?.find(s => s.id === selectedSession);
        if(!sessionDoc) throw new Error("Session not found");


        const studentDataForApi = await Promise.all(studentsInClass.map(async (student) => {
            const termResultId = `${selectedSession}-${selectedTerm}`;
            const resultDocRef = doc(firestore, 'students', student.id, 'results', termResultId);
            const resultDocSnap = await getDoc(resultDocRef);

            if (!resultDocSnap.exists()) return null;

            const termResult = resultDocSnap.data() as TermResult;
            
            const scores = Object.entries(termResult.scores).map(([subjectId, score]) => {
                const subject = allSubjects.find(s => s.id === subjectId);
                const total = (score.ca1 || 0) + (score.ca2 || 0) + (score.exam || 0);
                const { grade, remark } = calculateGrade(total);
                return { subjectName: subject?.name || 'Unknown', subSubjects: subject?.subSubjects || [], ca1: score.ca1, ca2: score.ca2, exam: score.exam, total, grade, remark };
            });

            const totalSum = scores.reduce((sum, entry) => sum + entry.total, 0);
            const average = scores.length > 0 ? (totalSum / scores.length) : 0;
            const overall = { average: average.toFixed(2), grade: calculateGrade(average).grade };

            return { pupil: student, classroom: { name: classroom.name, teacherName: classroom.teacherName }, termResult, scores, overall };
        }));

        const validStudentData = studentDataForApi.filter(data => data !== null);

        if (validStudentData.length === 0) {
            toast({ variant: "destructive", title: "No Data", description: "No result data found for any student in this class for the selected term." });
            setIsZipping(false);
            return;
        }

        const payload = {
            pupils: validStudentData,
            classroom,
            schoolSettings: {
                ...schoolSettings,
                currentSession: sessionDoc.name,
                currentTermId: selectedTerm,
            },
            templateData: savedTemplateData,
        };

        const response = await fetch('/api/export-class-zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || `ZIP generation failed with status ${response.status}`);
        }

        const blob = await response.blob();
        saveAs(blob, `${classroom.name.replace(/ /g, '_')}_Results.zip`);

        toast({ title: 'Success', description: `Downloaded ZIP file for ${classroom.name}.` });

    } catch (error: any) {
        console.error("Failed to generate ZIP:", error);
        toast({ variant: "destructive", title: "ZIP Export Error", description: error.message || "Could not generate the ZIP file." });
    } finally {
        setIsZipping(false);
    }
  };

  const isLoading = classroomsLoading || sessionsLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>View & Export Results</CardTitle>
        <CardDescription>
            Select a session, term, and class to view student results and export their report cards.
        </CardDescription>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select onValueChange={setSelectedSession} value={selectedSession || ''}>
                <SelectTrigger><SelectValue placeholder="Select Session" /></SelectTrigger>
                <SelectContent>
                    {sortedSessions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
            </Select>

            <Select onValueChange={setSelectedTerm} value={selectedTerm || ''} disabled={!selectedSession || termsLoading}>
                <SelectTrigger><SelectValue placeholder={termsLoading ? "Loading..." : "Select Term"} /></SelectTrigger>
                <SelectContent>
                    {terms?.map(t => <SelectItem key={t.id} value={t.id}>{termNames[t.name]}</SelectItem>)}
                </SelectContent>
            </Select>
            
            <Select onValueChange={handleClassChange} value={selectedClass || ''}>
                <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                <SelectContent>
                {classrooms?.sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    </SelectItem>
                ))}
                </SelectContent>
            </Select>
        </div>
         <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-end">
            <Button onClick={handleBulkDownload} disabled={isDownloading || isZipping || isFetchingStudents || studentsInClass.length === 0} className="w-full sm:w-auto">
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export PDFs (Multi-Tab)
            </Button>
            <Button onClick={handleBulkZip} disabled={isDownloading || isZipping || isFetchingStudents || studentsInClass.length === 0} className="w-full sm:w-auto">
                {isZipping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileArchive className="mr-2 h-4 w-4" />}
                Export All as ZIP
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {selectedClass && selectedSession && selectedTerm ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Click &quot;Export PDFs&quot; to open each report in a new tab (allow pop-ups), or &quot;Export All as ZIP&quot; to get a single file with all reports. You can also view an individual report by clicking the button in the table.
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
                           <TableCell className="text-right space-x-2">
                             <Button asChild variant="outline" size="sm">
                              <Link href={`/admin/results/entry/${student.id}`}>
                                 <Edit className="mr-2 h-4 w-4" />
                                 Enter/Edit Scores
                              </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/admin/results/${student.id}?session=${selectedSession}&term=${selectedTerm}`}>
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
            Please select a session, term, and class to view the list of students.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    