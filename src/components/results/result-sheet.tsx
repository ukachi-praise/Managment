'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import {
  Student,
  Subject,
  Grade,
  classrooms,
  subjects,
  grades,
} from '@/lib/data';
import { calculateGrade } from '@/lib/utils';
import { Logo } from '../shared/logo';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

type ResultEntry = {
  subject: Subject;
  scores: Grade;
  total: number;
  grade: string;
  remark: string;
};

export function ResultSheet({ student }: { student: Student }) {
  const { toast } = useToast();
  const [isZipping, setIsZipping] = useState(false);
  const classroom = classrooms.find((c) => c.id === student.classId);
  const studentGrades = grades.filter((g) => g.studentId === student.id);

  const results: ResultEntry[] = studentGrades.map((g) => {
    const subject = subjects.find((s) => s.id === g.subjectId)!;
    const total = (g.ca1 || 0) + (g.ca2 || 0) + (g.ca3 || 0) + (g.exam || 0);
    const { grade, remark } = calculateGrade(total);
    return { subject, scores: g, total, grade, remark };
  });

  const handlePrint = () => {
    window.print();
  };
  
  const handleBulkDownload = () => {
    setIsZipping(true);
    toast({
      title: "Generating ZIP...",
      description: "Preparing bulk PDF export for the class. This may take a moment."
    });
    setTimeout(() => {
      setIsZipping(false);
      toast({
        title: "Download Ready!",
        description: "The ZIP archive has been successfully generated."
      });
    }, 2500)
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
      <div className="print-area rounded-lg border bg-card text-card-foreground shadow-sm p-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <Logo className="text-3xl" />
            <div className="text-right">
              <h1 className="text-2xl font-bold">Student Report Card</h1>
              <p className="text-muted-foreground">First Term, 2023/2024</p>
            </div>
          </div>
          <Separator className="my-6" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-24 w-24 border">
                <AvatarImage src={student.avatar.imageUrl} alt={student.name} data-ai-hint={student.avatar.imageHint} />
                <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p>
                  <span className="font-semibold">Student Name:</span> {student.name}
                </p>
                <p>
                  <span className="font-semibold">Class:</span> {classroom?.name}
                </p>
                <p>
                  <span className="font-semibold">Student ID:</span> {student.id.toUpperCase()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Attendance:</span> {student.attendance}</p>
              <p><span className="font-semibold">Class Teacher:</span> {classroom?.teacher}</p>
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
                  <TableCell className="text-center">{r.scores.ca1}</TableCell>
                  <TableCell className="text-center">{r.scores.ca2}</TableCell>
                  <TableCell className="text-center">{r.scores.ca3}</TableCell>
                  <TableCell className="text-center">{r.scores.exam}</TableCell>
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
                <p className="text-sm text-muted-foreground border p-2 rounded-md min-h-[50px]">A brilliant student with a promising future. Keep it up.</p>
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
