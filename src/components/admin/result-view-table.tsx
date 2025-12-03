
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Download, FileArchive } from 'lucide-react';
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
  Timestamp
} from 'firebase/firestore';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { calculateGrade } from '@/lib/utils';
import { saveAs } from 'file-saver';


// --- TYPE DEFINITIONS ---
type Pupil = { id: string; name: string; admissionNumber: string; isDeleted?: boolean; };
type Classroom = { id: string; name: string; teacherName?: string; };
type Enrollment = { id: string; pupilId: string; classroomId: string };
type Subject = { id: string; name: string; subSubjects?: string[] };
type SchoolSettingsData = { currentSession: string; currentTermId: string; daysSchoolOpened: number; nextTermResumptionDate: Timestamp | Date | string; };
type TemplateSettings = { studentInfo: { fontSize: number; visible: boolean; }; header: { visible: boolean; }; subjectsTable: { visible: boolean; }; summary: { visible: boolean; }; softSkills: { visible: boolean; }; gradingKey: { visible: boolean; }; remarks: { visible: boolean; }; signatures: { visible: boolean; }; };
type SavedTemplateData = { name: string; schoolName: string; settings: TemplateSettings; };
type SubjectScore = { ca1: number | null; ca2: number | null; exam: number | null; };
type TermResult = { scores: Record<string, SubjectScore>; pupilId: string; termId: string; sessionId: string; classroomId: string; daysAttended?: number; };
const termNames: Record<string, string> = { term1: '1st Term', term2: '2nd Term', term3: '3rd Term' };


export function ResultViewTable() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  
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

  const allPupilsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'pupils')) : null),
    [firestore]
  );
  const { data: allPupils, isLoading: allPupilsLoading } = useCollection<Pupil>(allPupilsQuery);

  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: schoolSettings } = useDoc<SchoolSettingsData>(settingsRef);
  
  const templateRef = useMemoFirebase(() => (firestore ? doc(firestore, 'resultTemplates', 'main-template') : null), [firestore]);
  const { data: savedTemplateData } = useDoc<SavedTemplateData>(templateRef);
  
  const subjectsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'subjects') : null), [firestore]);
  const { data: allSubjects } = useCollection<Subject>(subjectsQuery);
  
  const pupilsInClass = useMemo(() => {
      if (!enrollments || !allPupils) return [];
      const pupilIds = new Set(enrollments.map(e => e.pupilId));
      return allPupils.filter(s => pupilIds.has(s.id) && !s.isDeleted).sort((a,b) => a.name.localeCompare(b.name));
  }, [enrollments, allPupils]);


  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
  }

  const handleBulkDownload = async () => {
    if (!pupilsInClass || pupilsInClass.length === 0) return;

    setIsDownloading(true);
    toast({
        title: "Pop-ups Required",
        description: `Your browser may block pop-ups. Please allow pop-ups for this site to download all ${pupilsInClass.length} reports.`,
        duration: 10000,
    });
    
    // Stagger the window opening to reduce the chance of browser blocking
    for (let i = 0; i < pupilsInClass.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay between opening each tab
      window.open(`/admin/results/${pupilsInClass[i].id}`, '_blank');
    }
    
    setIsDownloading(false);
  };
  
    const handleBulkZip = async () => {
    if (!pupilsInClass || pupilsInClass.length === 0 || !firestore || !schoolSettings || !allSubjects) return;
    setIsZipping(true);
    toast({
      title: 'Initiating ZIP Export...',
      description: `Preparing to export reports for ${pupilsInClass.length} pupil(s). This may take a moment.`,
    });

    try {
        const classroom = classrooms?.find(c => c.id === selectedClass);
        if(!classroom) throw new Error("Classroom not found");

        const pupilDataForApi = await Promise.all(pupilsInClass.map(async (pupil) => {
            const resultDocSnap = await getDocs(query(collection(firestore, 'pupils', pupil.id, 'results'), where('termId', '==', schoolSettings.currentTermId), where('sessionId', '==', schoolSettings.currentSession)));
            
            if (resultDocSnap.empty) return null;

            const termResult = resultDocSnap.docs[0].data() as TermResult;
            
            const scores = Object.entries(termResult.scores).map(([subjectId, score]) => {
                const subject = allSubjects.find(s => s.id === subjectId);
                const total = (score.ca1 || 0) + (score.ca2 || 0) + (score.exam || 0);
                const { grade, remark } = calculateGrade(total);
                return { subjectName: subject?.name || 'Unknown', subSubjects: subject?.subSubjects || [], ca1: score.ca1, ca2: score.ca2, exam: score.exam, total, grade, remark };
            });

            const totalSum = scores.reduce((sum, entry) => sum + entry.total, 0);
            const average = scores.length > 0 ? (totalSum / scores.length) : 0;
            const overall = { average: average.toFixed(2), grade: calculateGrade(average).grade };

            return { pupil, termResult, scores, overall };
        }));

        const validPupilData = pupilDataForApi.filter(data => data !== null);

        if (validPupilData.length === 0) {
            toast({ variant: "destructive", title: "No Data", description: "No result data found for any pupil in this class for the current term." });
            setIsZipping(false);
            return;
        }

        const payload = {
            pupils: validPupilData,
            classroom,
            schoolSettings,
            templateData: savedTemplateData, // Pass the template data
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


  const isLoading = classroomsLoading;
  const isFetchingPupils = enrollmentsLoading || allPupilsLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>View & Export Results</CardTitle>
        <CardDescription>
            Select a class to view the pupil list and export their report cards.
        </CardDescription>
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <Select onValueChange={handleClassChange} value={selectedClass || ''}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Select a Class" />
            </SelectTrigger>
            <SelectContent>
              {classrooms?.sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
           {selectedClass && (
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <Button onClick={handleBulkDownload} disabled={isDownloading || isZipping || isFetchingPupils || pupilsInClass.length === 0} className="w-full">
                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Export PDFs (Multi-Tab)
                </Button>
                <Button onClick={handleBulkZip} disabled={isDownloading || isZipping || isFetchingPupils || pupilsInClass.length === 0} className="w-full">
                    {isZipping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileArchive className="mr-2 h-4 w-4" />}
                    Export All as ZIP
                </Button>
            </div>
           )}
        </div>
      </CardHeader>
      <CardContent>
        {selectedClass ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Click &quot;Export PDFs&quot; to open each report in a new tab (allow pop-ups), or &quot;Export All as ZIP&quot; to get a single file with all reports. You can also view an individual report by clicking the button in the table.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pupil Name</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFetchingPupils ? (
                     <TableRow><TableCell colSpan={2} className="text-center"><Loader2 className="inline-block animate-spin mr-2" /> Loading pupils...</TableCell></TableRow>
                  ) : pupilsInClass.length > 0 ? (
                    pupilsInClass.map((pupil) => (
                        <TableRow key={pupil.id}>
                          <TableCell className="font-medium">
                              {pupil.name}
                          </TableCell>
                           <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/admin/results/${pupil.id}`}>
                                View Report
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={2} className="text-center h-24">
                           No pupils found for this class.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            Please select a class to view the list of pupils.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    

    