
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  useAuth,
  useUser,
} from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/firebase/provider';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
} from 'firebase/firestore';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveAs } from 'file-saver';
import { fetchActiveStudentsByIds } from '@/lib/student-membership';


// --- TYPE DEFINITIONS ---
type Student = { id: string; name: string; admissionNumber: string; isDeleted?: boolean; };
type Classroom = { id: string; name: string; teacherName?: string; };
type AcademicSession = { id: string; name: string; }
type Term = { id: string; name: "1st" | "2nd" | "3rd"; }

const termNames: Record<string, string> = { "1st": '1st Term', "2nd": '2nd Term', "3rd": '3rd Term' };


export function ResultViewTable() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { toast } = useToast();
  const { user } = useUser();

  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<'class' | 'term'>('class');

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

  const settingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'schoolSettings', 'current') : null),
    [firestore]
  );
  const { data: schoolSettings } = useDoc<{ currentSessionId?: string; currentTermId?: string }>(settingsRef);
  const requestedClassId = searchParams.get('classroomId');

  useEffect(() => {
    if (!selectedSession && schoolSettings?.currentSessionId) setSelectedSession(schoolSettings.currentSessionId);
    if (!selectedTerm && schoolSettings?.currentTermId) setSelectedTerm(schoolSettings.currentTermId);
    if (!selectedClass && requestedClassId && classrooms?.some(classroom => classroom.id === requestedClassId)) {
      setSelectedClass(requestedClassId);
    }
  }, [selectedSession, selectedTerm, selectedClass, schoolSettings, requestedClassId, classrooms]);
  
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
            // Read current class membership from root enrollment records.
            const enrollmentsSnap = await getDocs(query(
              collection(firestore, 'enrollments'),
              where('classroomId', '==', selectedClass)
            ));
            const studentIds = [...new Set(enrollmentsSnap.docs.map(d => d.data().studentId).filter(Boolean))];

            if (studentIds.length === 0) {
                setStudentsInClass([]);
                setIsFetchingStudents(false);
                return;
            }

            const studentDetails = await fetchActiveStudentsByIds(firestore, studentIds) as Student[];
            
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
    if (exportMode !== 'class' || !studentsInClass || studentsInClass.length === 0 || !selectedSession || !selectedTerm) return;

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
    if (!user || !selectedSession || !selectedTerm || (exportMode === 'class' && !selectedClass)) {
        toast({ variant: 'destructive', title: 'Missing Info', description: 'Please select a session and term, and a class for class export.' });
        return;
    }

    setIsZipping(true);
    toast({
      title: 'Initiating ZIP Export...',
      description: exportMode === 'class' ? 'Preparing current class reports.' : 'Preparing reports across all classes for this term.',
    });

    try {
        const authUser = auth.currentUser;
        if (!authUser || authUser.uid !== user.uid) {
          throw new Error('Your sign-in is no longer available. Please sign in again and retry the export.');
        }
        const idToken = await authUser.getIdToken();
        const response = await fetch('/api/export-class-zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({
              mode: exportMode,
              sessionId: selectedSession,
              termId: selectedTerm,
              classroomId: selectedClass || undefined,
              firebaseUser: authUser.toJSON(),
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            const skippedDetail = Array.isArray(errorData.skipped) && errorData.skipped.length
              ? ` ${errorData.skipped.length} student(s) were skipped; see the error details.`
              : '';
            throw new Error(`${errorData.error || `ZIP generation failed with status ${response.status}`}${skippedDetail}`);
        }

        const blob = await response.blob();
        if (blob.size < 100) throw new Error('The server returned an empty ZIP archive.');
        const sessionName = sessions?.find(item => item.id === selectedSession)?.name || 'Session';
        const termName = terms?.find(item => item.id === selectedTerm)?.name || 'Term';
        const className = classrooms?.find(item => item.id === selectedClass)?.name || 'Class';
        const filename = exportMode === 'class'
          ? `${className.replace(/[^a-z0-9]/gi, '_')}_Results_${sessionName.replace(/[^a-z0-9]/gi, '_')}_${termName.replace(/[^a-z0-9]/gi, '_')}.zip`
          : `Results_${sessionName.replace(/[^a-z0-9]/gi, '_')}_${termName.replace(/[^a-z0-9]/gi, '_')}.zip`;
        saveAs(blob, filename);

        const pdfCount = response.headers.get('X-Export-PDF-Count') || '0';
        const skippedCount = response.headers.get('X-Export-Skipped-Count') || '0';
        toast({ title: 'Success', description: `Downloaded ${pdfCount} PDF(s). ${skippedCount} report(s) skipped; details are included in Export_Summary.txt.` });

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
          Export student report cards as individual PDFs, by class or across the entire term.
        </CardDescription>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select value={exportMode} onValueChange={(value: 'class' | 'term') => setExportMode(value)}>
            <SelectTrigger><SelectValue placeholder="Export Mode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="class">Export by Class</SelectItem>
              <SelectItem value="term">Export Entire Term</SelectItem>
            </SelectContent>
          </Select>
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
            
            {exportMode === 'class' ? (
              <Select onValueChange={handleClassChange} value={selectedClass || ''}>
                <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                <SelectContent>
                {classrooms?.sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center rounded-md border px-3 text-sm text-muted-foreground">
                All current classes
              </div>
            )}
        </div>
         <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-end">
            <Button onClick={handleBulkDownload} disabled={exportMode !== 'class' || !selectedSession || !selectedTerm || isDownloading || isZipping || isFetchingStudents || studentsInClass.length === 0} className="w-full sm:w-auto">
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export PDFs (Multi-Tab)
            </Button>
            <Button onClick={handleBulkZip} disabled={!selectedSession || !selectedTerm || (exportMode === 'class' && (!selectedClass || studentsInClass.length === 0)) || isDownloading || isZipping || isFetchingStudents} className="w-full sm:w-auto">
                {isZipping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileArchive className="mr-2 h-4 w-4" />}
                {exportMode === 'class' ? 'Export Class as ZIP' : 'Export Term as ZIP'}
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {selectedSession && selectedTerm && (exportMode === 'term' || selectedClass) ? (
          <>
            {exportMode === 'term' ? (
              <p className="text-sm text-muted-foreground mb-4">
                The archive will contain eligible saved results from every class, organized into class folders. Missing, unpublished, or invalid results are listed in Export_Summary.txt.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                Export PDFs opens each report in a new tab. Export Class as ZIP creates a class folder containing each eligible report. Missing results are listed in Export_Summary.txt.
              </p>
            )}
            {exportMode === 'class' && <div className="overflow-x-auto">
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
            </div>}
          </>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            {exportMode === 'class' ? 'Please select a session, term, and class.' : 'Please select a session and term to export all classes.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    