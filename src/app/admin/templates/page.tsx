
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Save, RotateCcw, Upload } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/shared/logo';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { collection } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

type Subject = {
  id: string;
  name: string;
};

type Classroom = {
  id: string;
  name: string;
};

type ClassroomSubject = {
  id: string;
  classroomId: string;
  subjectId: string;
};

export default function TemplatesPage() {
  const [visibleFields, setVisibleFields] = useState({
    studentName: true,
    admissionNumber: true,
    classLevel: true,
    academicSession: true,
    term: true,
    attendance: true,
    classTeacher: true,
    subjectsTable: true,
    softSkills: true,
    overallAverage: true,
    overallGrade: true,
    teacherRemark: true,
    headTeacherRemark: true,
    nextTermResumption: false,
    nextTermFees: false,
  });

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const firestore = useFirestore();

  // --- Data Fetching ---
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'classrooms') : null),
    [firestore]
  );
  const subjectsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'subjects') : null),
    [firestore]
  );
  const classroomSubjectsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'classroomSubjects') : null),
    [firestore]
  );

  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  const { data: allSubjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: classroomSubjects, isLoading: classroomSubjectsLoading } = useCollection<ClassroomSubject>(classroomSubjectsQuery);

  // --- Data Processing ---
  const subjectsMap = useMemo(
    () =>
      allSubjects?.reduce((acc, subject) => {
        acc[subject.id] = subject;
        return acc;
      }, {} as Record<string, Subject>) || {},
    [allSubjects]
  );

  const classSubjectMap = useMemo(() => {
    return classroomSubjects?.reduce((acc, cs) => {
      if (!acc[cs.classroomId]) {
        acc[cs.classroomId] = [];
      }
      const subject = subjectsMap[cs.subjectId];
      if(subject) {
        acc[cs.classroomId].push(subject);
      }
      return acc;
    }, {} as Record<string, Subject[]>);
  }, [classroomSubjects, subjectsMap]);


  const displayedSubjects = useMemo(() => {
    if (!selectedClassId || !classSubjectMap) return [];
    return classSubjectMap[selectedClassId] || [];
  }, [selectedClassId, classSubjectMap]);

  const selectedClassroom = useMemo(() => {
    if(!selectedClassId || !classrooms) return null;
    return classrooms.find(c => c.id === selectedClassId);
  }, [selectedClassId, classrooms]);


  return (
    <div className="flex h-full flex-col gap-6">
      {/* Top Section: Metadata and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Result Template Builder
          </h1>
          <p className="text-muted-foreground">
            Design and manage result templates for different classes.
          </p>
        </div>
        <div className="flex items-center gap-4">
             <Input placeholder="Template Name" className="w-48" />
             <Select onValueChange={setSelectedClassId} value={selectedClassId || ''}>
                <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                    {classroomsLoading ? (
                        <SelectItem value="loading" disabled>Loading classes...</SelectItem>
                    ) : (
                        classrooms?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                    )}
                </SelectContent>
             </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Eye className="mr-2 h-4 w-4" />
            Preview PDF
          </Button>
          <Button>
            <Save className="mr-2 h-4 w-4" />
            Save Template
          </Button>
        </div>
      </div>

      {/* Main Canvas: Preview */}
      <div className="flex-1">
        <Card className="h-full">
          <CardContent className="h-full overflow-auto rounded-lg bg-muted/50 p-4 sm:p-8">
            <div className="mx-auto aspect-[210/297] max-w-[210mm] bg-white p-8 shadow-md print:shadow-none print:m-0 print:p-0 print:max-w-none">
              <header className="mb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-gray-100">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <Logo className="text-xl" />
                  </div>
                  <div className="text-right">
                    <h1 className="font-bold text-lg">Student Report Card</h1>
                    {(visibleFields.term || visibleFields.academicSession) && (
                      <p className="text-xs text-muted-foreground">
                        First Term, 2023/2024
                      </p>
                    )}
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                    {visibleFields.studentName && <div className="flex"><p className="w-28 font-semibold">Student Name:</p><p>John Doe</p></div>}
                    {visibleFields.admissionNumber && <div className="flex"><p className="w-28 font-semibold">Admission No:</p><p>JKS-00123</p></div>}
                    {visibleFields.classLevel && <div className="flex"><p className="w-28 font-semibold">Class:</p><p>{selectedClassroom?.name || 'Primary 5'}</p></div>}
                    {visibleFields.attendance && <div className="flex"><p className="w-28 font-semibold">Attendance:</p><p>60/65 Days</p></div>}
                    {visibleFields.classTeacher && <div className="flex col-span-2"><p className="w-28 font-semibold">Class Teacher:</p><p>Mrs. Ada</p></div>}
                </div>
              </header>
              <main className="mt-4">
                {visibleFields.subjectsTable && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-center">CA1</TableHead>
                        <TableHead className="text-center">CA2</TableHead>
                        <TableHead className="text-center">CA3</TableHead>
                        <TableHead className="text-center">Exam</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead>Remark</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subjectsLoading ? (
                        <TableRow><TableCell colSpan={7} className="text-center">Loading subjects...</TableCell></TableRow>
                      ) : displayedSubjects.length > 0 ? (
                        displayedSubjects.map(subject => (
                           <TableRow key={subject.id}><TableCell>{subject.name}</TableCell><TableCell className="text-center">--</TableCell><TableCell className="text-center">--</TableCell><TableCell className="text-center">--</TableCell><TableCell className="text-center">--</TableCell><TableCell className="text-center">--</TableCell><TableCell>--</TableCell></TableRow>
                        ))
                      ) : (
                         <TableRow><TableCell colSpan={7} className="text-center h-24">{selectedClassId ? 'No subjects assigned to this class.' : 'Select a class to see subjects.'}</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
                {(visibleFields.overallAverage ||
                  visibleFields.overallGrade) && (
                  <div className="mt-4 flex justify-end">
                    <div className="w-1/3 rounded-md border p-2 text-sm">
                      {visibleFields.overallAverage && (
                        <div className="flex justify-between">
                          <span className="font-semibold">
                            Overall Average:
                          </span>
                          <span>75.5%</span>
                        </div>
                      )}
                      {visibleFields.overallGrade && (
                        <div className="flex justify-between">
                          <span className="font-semibold">Overall Grade:</span>
                          <span>B</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </main>
              <footer className="mt-8 space-y-4 text-xs">
                {visibleFields.softSkills && (
                  <div className="space-y-2">
                    <h3 className="font-bold">Soft Skills Assessment</h3>
                    <div className="grid grid-cols-2 gap-x-4">
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium p-1">
                              Punctuality
                            </TableCell>
                            <TableCell className="text-right p-1">5</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium p-1">
                              Neatness
                            </TableCell>
                            <TableCell className="text-right p-1">4</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium p-1">
                              Honesty
                            </TableCell>
                            <TableCell className="text-right p-1">5</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium p-1">
                              Communication
                            </TableCell>
                            <TableCell className="text-right p-1">5</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium p-1">
                              Attentiveness
                            </TableCell>
                            <TableCell className="text-right p-1">4</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium p-1">
                              Self Control
                            </TableCell>
                            <TableCell className="text-right p-1">5</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                 <div className="grid grid-cols-2 gap-x-8 pt-4">
                        <div className="space-y-2">
                            <h3 className="font-bold">Grading Key</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="p-1 h-auto">Score</TableHead>
                                        <TableHead className="p-1 h-auto">Grade</TableHead>
                                        <TableHead className="p-1 h-auto">Remark</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow><TableCell className="p-1">80 – 100</TableCell><TableCell className="p-1">A</TableCell><TableCell className="p-1">Excellent</TableCell></TableRow>
                                    <TableRow><TableCell className="p-1">70 – 79</TableCell><TableCell className="p-1">B</TableCell><TableCell className="p-1">Very Good</TableCell></TableRow>
                                    <TableRow><TableCell className="p-1">60 – 69</TableCell><TableCell className="p-1">C</TableCell><TableCell className="p-1">Good</TableCell></TableRow>
                                    <TableRow><TableCell className="p-1">50 – 59</TableCell><TableCell className="p-1">D</TableCell><TableCell className="p-1">Fair</TableCell></TableRow>
                                    <TableRow><TableCell className="p-1">0 – 49</TableCell><TableCell className="p-1">F</TableCell><TableCell className="p-1">Fail</TableCell></TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-bold">Skill Score Rating</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="p-1 h-auto">Score</TableHead>
                                        <TableHead className="p-1 h-auto">Remark</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow><TableCell className="p-1">5</TableCell><TableCell className="p-1">Excellent</TableCell></TableRow>
                                    <TableRow><TableCell className="p-1">4</TableCell><TableCell className="p-1">Very Good</TableCell></TableRow>
                                    <TableRow><TableCell className="p-1">3</TableCell><TableCell className="p-1">Good</TableCell></TableRow>
                                    <TableRow><TableCell className="p-1">2</TableCell><TableCell className="p-1">Fair</TableCell></TableRow>
                                    <TableRow><TableCell className="p-1">1</TableCell><TableCell className="p-1">Poor</TableCell></TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                {visibleFields.teacherRemark && (
                  <div className="pt-4">
                    <h3 className="font-bold">Teacher's Remarks:</h3>
                    <p className="min-h-[40px] rounded-md border-b p-1">
                      A brilliant student...
                    </p>
                  </div>
                )}
                {visibleFields.headTeacherRemark && (
                  <div>
                    <h3 className="font-bold">Head Teacher's Remarks:</h3>
                    <p className="min-h-[40px] rounded-md border-b p-1">
                      Excellent performance...
                    </p>
                  </div>
                )}
                <div className="flex justify-between items-end pt-8">
                  <div className="text-center w-36">
                    <div className="border-t pt-1">
                      Class Teacher's Signature
                    </div>
                  </div>
                  <div className="text-center w-36">
                    <div className="border-t pt-1">
                      Head Teacher's Signature
                    </div>
                  </div>
                </div>
              </footer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

    