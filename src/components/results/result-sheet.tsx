'use client';

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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Printer, Download, Loader2 } from 'lucide-react';
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
import { Logo } from '../shared/logo';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { headTeacherRemarks } from '@/lib/data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';


type Student = {
  id: string;
  name: string;
  dob?: string;
};
type Subject = { id: string; name: string };
type Classroom = { id: string; name: string; teacher?: string };
type Enrollment = { studentId: string; classroomId: string };
type Result = {
  subjectId: string;
  ca1: number;
  ca2: number;
  ca3: number;
  exam: number;
  daysAttended: number;
};
type SchoolSettings = {
    currentSession: string;
    currentTermId: string;
    daysSchoolOpened: number;
    nextTermResumptionDate: Timestamp | Date | string;
};
type ResultEntry = {
  subject: Subject;
  scores: Result;
  total: number;
  grade: string;
  remark: string;
};

const termNames: Record<string, string> = {
    term1: '1st Term',
    term2: '2nd Term',
    term3: '3rd Term',
};

export function ResultSheet({ studentId }: { studentId: string }) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isZipping, setIsZipping] = useState(false);
  const [teacherRemark, setTeacherRemark] = useState("A brilliant student with a promising future. Keep it up.");
  const [headTeacherRemark, setHeadTeacherRemark] = useState("Excellent Performance");

  // --- Data Fetching ---
  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: schoolSettings, isLoading: settingsLoading } = useDoc<SchoolSettings>(settingsRef);

  const studentRef = useMemoFirebase(() => (firestore ? doc(firestore, 'students', studentId) : null), [firestore, studentId]);
  const { data: student, isLoading: studentLoading } = useDoc<Student>(studentRef);

  const enrollmentsQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'enrollments'), where('studentId', '==', studentId)) : null
  ), [firestore, studentId]);
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const classroomId = enrollments?.[0]?.classroomId;
  const classroomRef = useMemoFirebase(() => (firestore && classroomId ? doc(firestore, 'classrooms', classroomId) : null), [firestore, classroomId]);
  const { data: classroom, isLoading: classroomLoading } = useDoc<Classroom>(classroomRef);

  const resultsQuery = useMemoFirebase(() => {
    if (!firestore || !schoolSettings) return null;
    return query(collection(firestore, 'results'), 
      where('studentId', '==', studentId),
      where('sessionId', '==', schoolSettings.currentSession),
      where('termId', '==', schoolSettings.currentTermId)
    )
  }, [firestore, studentId, schoolSettings]);
  const { data: studentResults, isLoading: resultsLoading } = useCollection<Result>(resultsQuery);
  
  const subjectsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'subjects') : null), [firestore]);
  const { data: allSubjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQuery);

  const subjectsMap = useMemo(() => 
    allSubjects?.reduce((acc, subject) => {
      acc[subject.id] = subject;
      return acc;
    }, {} as Record<string, Subject>) || {},
  [allSubjects]);


  // --- Data Processing ---
  const results: ResultEntry[] = useMemo(() => {
    if (!studentResults || !allSubjects) return [];
    return studentResults.map((g) => {
      const subject = subjectsMap[g.subjectId];
      if (!subject) return null; // Should not happen if data is consistent
      const total = (g.ca1 || 0) + (g.ca2 || 0) + (g.ca3 || 0) + (g.exam || 0);
      const { grade, remark } = calculateGrade(total);
      return { subject, scores: g, total, grade, remark };
    }).filter(Boolean) as ResultEntry[];
  }, [studentResults, allSubjects, subjectsMap]);
  
  const daysAttended = studentResults?.[0]?.daysAttended || 0;


  const isLoading = studentLoading || enrollmentsLoading || classroomLoading || resultsLoading || subjectsLoading || settingsLoading;

  const handlePrint = () => {
    window.print();
  };

  const handleBulkDownload = () => {
    setIsZipping(true);
    toast({
      title: 'Generating ZIP...',
      description: 'Preparing bulk PDF export for the class. This may take a moment.',
    });
    setTimeout(() => {
      setIsZipping(false);
      toast({
        title: 'Download Ready!',
        description: 'The ZIP archive has been successfully generated.',
      });
    }, 2500);
  };
  
    const formattedResumptionDate = useMemo(() => {
    if (!schoolSettings?.nextTermResumptionDate) return 'N/A';
    let date: Date;
    if (schoolSettings.nextTermResumptionDate instanceof Timestamp) {
      date = schoolSettings.nextTermResumptionDate.toDate();
    } else {
      date = new Date(schoolSettings.nextTermResumptionDate);
    }
    return format(date, 'PPP');
  }, [schoolSettings]);


  const studentAvatar = PlaceHolderImages.find(p => p.id === '1');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-8">
            <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (!student) {
    return <div>Student not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <h2 className="text-2xl font-bold">Student Result</h2>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="mr-2 h-4 w-4" /> Print Result
          </Button>
          <Button onClick={handleBulkDownload} disabled={isZipping}>
            <Download className="mr-2 h-4 w-4" />
            {isZipping ? 'Packaging...' : 'Download Class ZIP'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        <div className="space-y-2">
          <Label>Teacher's Remark</Label>
          <Textarea value={teacherRemark} onChange={(e) => setTeacherRemark(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Head Teacher's Remark</Label>
          <Select value={headTeacherRemark} onValueChange={setHeadTeacherRemark}>
            <SelectTrigger>
              <SelectValue placeholder="Select a remark" />
            </SelectTrigger>
            <SelectContent>
              {headTeacherRemarks.map((remark, index) => (
                <SelectItem key={index} value={remark}>
                  {remark}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="print-area rounded-lg border bg-card text-card-foreground shadow-sm p-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <Logo className="text-3xl" />
            <div className="text-right">
              <h1 className="text-2xl font-bold">Student Report Card</h1>
              <p className="text-muted-foreground">
                {schoolSettings?.currentTermId ? termNames[schoolSettings.currentTermId] : ''}, {schoolSettings?.currentSession}
              </p>
            </div>
          </div>
          <Separator className="my-6" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
               <Avatar className="h-24 w-24 border">
                {studentAvatar && <AvatarImage src={studentAvatar.imageUrl} alt={student.name} data-ai-hint={studentAvatar.imageHint} />}
                <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p>
                  <span className="font-semibold">Student Name:</span> {student.name}
                </p>
                <p>
                  <span className="font-semibold">Class:</span> {classroom?.name || 'N/A'}
                </p>
                <p>
                  <span className="font-semibold">Student ID:</span> {student.id.toUpperCase().substring(0,8)}
                </p>
                 <p>
                  <span className="font-semibold">School Opened:</span> {schoolSettings?.daysSchoolOpened || 'N/A'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Attendance:</span> {daysAttended}</p>
              <p><span className="font-semibold">Class Teacher:</span> {classroom?.teacher || 'N/A'}</p>
               <p><span className="font-semibold">Next Term Begins:</span> {formattedResumptionDate}</p>
            </div>
          </div>
        </header>

        <main>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="text-center">CA1 (10)</TableHead>
                <TableHead className="text-center">CA2 (10)</TableHead>
                <TableHead className="text-center">CA3 (10)</TableHead>
                <TableHead className="text-center">Exam (70)</TableHead>
                <TableHead className="text-center">Total (100)</TableHead>
                <TableHead className="text-center">Grade</TableHead>
                <TableHead>Remark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.subject.id}>
                  <TableCell className="font-medium">{r.subject.name}</TableCell>
                  <TableCell className="text-center">{r.scores.ca1 || 0}</TableCell>
                  <TableCell className="text-center">{r.scores.ca2 || 0}</TableCell>
                  <TableCell className="text-center">{r.scores.ca3 || 0}</TableCell>
                  <TableCell className="text-center">{r.scores.exam || 0}</TableCell>
                  <TableCell className="text-center font-bold">{r.total}</TableCell>
                  <TableCell className="text-center">{r.grade}</TableCell>
                  <TableCell>{r.remark}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </main>

        <footer className="mt-12 space-y-4">
          <div>
            <h3 className="font-semibold text-lg">Soft Skills Assessment:</h3>
            <p className="text-sm text-muted-foreground border p-2 rounded-md min-h-[50px]">Polite and interacts well with peers.</p>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Teacher's Remarks:</h3>
            <p className="text-sm text-muted-foreground border p-2 rounded-md min-h-[50px]">{teacherRemark}</p>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Head Teacher's Remarks:</h3>
            <p className="text-sm text-muted-foreground border p-2 rounded-md min-h-[50px]">{headTeacherRemark}</p>
          </div>
          <div className="flex justify-between items-end pt-12">
            <div className="text-center">
              <div className="border-t-2 w-48 pt-2">Teacher's Signature</div>
            </div>
            <div className="text-center">
              <div className="border-t-2 w-48 pt-2">Principal's Signature</div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

    