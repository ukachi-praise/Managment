
'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PlusCircle,
  Eye,
  Save,
  RotateCcw,
  Upload,
  Bold,
  Italic,
  AlignCenter,
  AlignLeft,
  AlignRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const availableFields = {
  studentInfo: [
    'Student Name',
    'Admission Number',
    'Class / Level',
    'Academic Session',
    'Term',
    'Attendance',
    'Class Teacher',
  ],
  academicInfo: [
    'Subjects Table',
    'Soft Skills',
    'Overall Average',
    'Overall Grade',
  ],
  remarks: ['Class Teacher Remark', 'Head Teacher Remark'],
  otherInfo: ['Next Term Resumption Date', 'Next Term Fees'],
};

// Map field names to state keys for easier management
const fieldToStateKey: { [key: string]: string } = {
  'Student Name': 'studentName',
  'Admission Number': 'admissionNumber',
  'Class / Level': 'classLevel',
  'Academic Session': 'academicSession',
  Term: 'term',
  Attendance: 'attendance',
  'Class Teacher': 'classTeacher',
  'Subjects Table': 'subjectsTable',
  'Soft Skills': 'softSkills',
  'Overall Average': 'overallAverage',
  'Overall Grade': 'overallGrade',
  'Class Teacher Remark': 'teacherRemark',
  'Head Teacher Remark': 'headTeacherRemark',
  'Next Term Resumption Date': 'nextTermResumption',
  'Next Term Fees': 'nextTermFees',
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

    const handleFieldVisibilityChange = (field: string, checked: boolean) => {
        const stateKey = fieldToStateKey[field];
        if (stateKey) {
            setVisibleFields(prev => ({ ...prev, [stateKey]: checked }));
        }
    };

    const renderCheckboxes = (fields: string[]) => {
        return fields.map((field) => {
            const stateKey = fieldToStateKey[field] as keyof typeof visibleFields;
            return (
              <div key={field} className="flex items-center gap-2">
                <Checkbox 
                    id={field} 
                    checked={visibleFields[stateKey]}
                    onCheckedChange={(checked) => handleFieldVisibilityChange(field, !!checked)}
                />
                <Label htmlFor={field} className="font-normal">{field}</Label>
              </div>
            );
        });
    };


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
        <div className="flex gap-2">
          <Button variant="outline">
            <RotateCcw />
            Reset
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Eye />
            Preview PDF
          </Button>
          <Button>
            <Save />
            Save Template
          </Button>
        </div>
      </div>

      {/* Main Canvas: Preview */}
      <div className="flex-1">
          <Card className="h-full">
            <CardContent className="h-full overflow-auto rounded-lg bg-muted/50 p-4 sm:p-8">
              <div className="mx-auto aspect-[210/297] max-w-[210mm] bg-white p-8 shadow-md print:shadow-none print:p-0 print:m-0 print:max-w-none">
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
                        {(visibleFields.term || visibleFields.academicSession) && <p className="text-xs text-muted-foreground">First Term, 2023/2024</p>}
                        </div>
                    </div>
                     <Separator className="my-4" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20 border">
                            <AvatarFallback>SN</AvatarFallback>
                        </Avatar>
                        <div className="text-xs">
                            {visibleFields.studentName && <p><strong>Student Name:</strong> John Doe</p>}
                            {visibleFields.classLevel && <p><strong>Class:</strong> Primary 5</p>}
                            {visibleFields.admissionNumber && <p><strong>Admission No:</strong> JKS-00123</p>}
                        </div>
                        </div>
                        <div className="text-right text-xs">
                        {visibleFields.attendance && <p><strong>Attendance:</strong> 60/65 Days</p>}
                        {visibleFields.classTeacher && <p><strong>Class Teacher:</strong> Mrs. Ada</p>}
                        </div>
                    </div>
                </header>
                <main className="mt-4">
                    {visibleFields.subjectsTable &&
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
                                <TableRow><TableCell>Mathematics</TableCell><TableCell className="text-center">--</TableCell><TableCell className="text-center">--</TableCell><TableCell className="text-center">--</TableCell><TableCell className="text-center">--</TableCell><TableCell className="text-center">--</TableCell><TableCell>--</TableCell></TableRow>
                                <TableRow><TableCell>English</TableCell><TableCell className="text-center">--</TableCell><TableCell className="text-center">--</TableCell><TableCell className="text-center">--</TableCell><TableCell className="text-center">--</TableCell><TableCell className="text-center">--</TableCell><TableCell>--</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    }
                    {(visibleFields.overallAverage || visibleFields.overallGrade) && (
                        <div className="mt-4 flex justify-end">
                            <div className="w-1/3 rounded-md border p-2 text-sm">
                                {visibleFields.overallAverage && (
                                    <div className="flex justify-between">
                                        <span className="font-semibold">Overall Average:</span>
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
                    {visibleFields.softSkills && 
                        <div className="space-y-2">
                            <h3 className="font-bold">Soft Skills Assessment</h3>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Skill</TableHead>
                                        <TableHead className="text-right">Rating</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell>Punctuality</TableCell>
                                        <TableCell className="text-right">5/5</TableCell>
                                    </TableRow>
                                     <TableRow>
                                        <TableCell>Neatness</TableCell>
                                        <TableCell className="text-right">4/5</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Communication</TableCell>
                                        <TableCell className="text-right">5/5</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    }
                    {visibleFields.teacherRemark &&
                        <div>
                            <h3 className="font-bold">Teacher's Remarks:</h3>
                            <p className="min-h-[40px] rounded-md border-b p-1">A brilliant student...</p>
                        </div>
                    }
                    {visibleFields.headTeacherRemark &&
                        <div>
                            <h3 className="font-bold">Head Teacher's Remarks:</h3>
                            <p className="min-h-[40px] rounded-md border-b p-1">Excellent performance...</p>
                        </div>
                    }
                    <div className="flex justify-between items-end pt-8">
                        <div className="text-center w-36">
                        <div className="border-t pt-1">Class Teacher's Signature</div>
                        </div>
                        <div className="text-center w-36">
                        <div className="border-t pt-1">Head Teacher's Signature</div>
                        </div>
                    </div>
                </footer>
              </div>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
