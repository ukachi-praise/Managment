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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  classrooms,
  subjects,
  students as allStudents,
  grades as initialGrades,
  Grade,
} from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { calculateGrade } from '@/lib/utils';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ResultInputTable() {
  const { toast } = useToast();
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [grades, setGrades] = useState<Grade[]>(initialGrades);
  const [isLoading, setIsLoading] = useState(false);

  const studentsInClass = useMemo(() => {
    return selectedClass ? allStudents.filter((s) => s.classId === selectedClass) : [];
  }, [selectedClass]);

  const handleScoreChange = (
    studentId: string,
    field: 'ca1' | 'ca2' | 'ca3' | 'exam',
    value: string
  ) => {
    const numericValue = value === '' ? null : Number(value);
    setGrades((prevGrades) => {
      const existingGradeIndex = prevGrades.findIndex(
        (g) => g.studentId === studentId && g.subjectId === selectedSubject
      );
      if (existingGradeIndex > -1) {
        const newGrades = [...prevGrades];
        newGrades[existingGradeIndex] = {
          ...newGrades[existingGradeIndex],
          [field]: numericValue,
        };
        return newGrades;
      } else {
        return [
          ...prevGrades,
          {
            studentId,
            subjectId: selectedSubject!,
            ca1: null,
            ca2: null,
            ca3: null,
            exam: null,
            [field]: numericValue,
          },
        ];
      }
    });
  };

  const handleSave = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: 'Results Saved!',
        description: 'All scores have been successfully updated.',
      });
    }, 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter Scores</CardTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Select onValueChange={setSelectedClass}>
            <SelectTrigger>
              <SelectValue placeholder="Select a Class" />
            </SelectTrigger>
            <SelectContent>
              {classrooms.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={setSelectedSubject} disabled={!selectedClass}>
            <SelectTrigger>
              <SelectValue placeholder="Select a Subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {selectedClass && selectedSubject ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Student Name</TableHead>
                    <TableHead>CA1 (10)</TableHead>
                    <TableHead>CA2 (10)</TableHead>
                    <TableHead>CA3 (10)</TableHead>
                    <TableHead>Exam (70)</TableHead>
                    <TableHead>Total (100)</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsInClass.map((student) => {
                    const grade = grades.find(
                      (g) =>
                        g.studentId === student.id &&
                        g.subjectId === selectedSubject
                    ) || { ca1: null, ca2: null, ca3: null, exam: null };
                    
                    const total = (grade.ca1 || 0) + (grade.ca2 || 0) + (grade.ca3 || 0) + (grade.exam || 0);
                    const { grade: finalGrade, remark } = calculateGrade(total);

                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-8 w-20"
                            value={grade.ca1 ?? ''}
                            onChange={(e) => handleScoreChange(student.id, 'ca1', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-8 w-20"
                            value={grade.ca2 ?? ''}
                            onChange={(e) => handleScoreChange(student.id, 'ca2', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-8 w-20"
                            value={grade.ca3 ?? ''}
                            onChange={(e) => handleScoreChange(student.id, 'ca3', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-8 w-20"
                            value={grade.exam ?? ''}
                            onChange={(e) => handleScoreChange(student.id, 'exam', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>{total}</TableCell>
                        <TableCell>{finalGrade}</TableCell>
                        <TableCell>{remark}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save All Scores
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            Please select a class and a subject to view student scores.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
