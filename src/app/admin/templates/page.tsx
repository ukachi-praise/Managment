
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
        overallAverage: false,
        overallGrade: false,
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
      <div className="flex flex-wrap items-center justify-between gap-4">
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
          <Button variant="outline">
            <Eye />
            Preview PDF
          </Button>
          <Button>
            <Save />
            Save Template
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., Primary Section Template"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-level">Class/Level</Label>
              <Select>
                <SelectTrigger id="class-level">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary-5">Primary 5</SelectItem>
                  <SelectItem value="primary-4">Primary 4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="session">Academic Session</Label>
              <Select defaultValue="2023-2024">
                <SelectTrigger id="session">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2023-2024">2023/2024</SelectItem>
                  <SelectItem value="2024-2025">2024/2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="term">Term</Label>
              <Select defaultValue="first">
                <SelectTrigger id="term">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">First Term</SelectItem>
                  <SelectItem value="second">Second Term</SelectItem>
                  <SelectItem value="third">Third Term</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Designer: 3-column layout */}
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Sidebar: Available Fields */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Available Fields</CardTitle>
              <CardDescription>
                Select fields to add to the template.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" defaultValue={['studentInfo', 'academicInfo']} className="w-full">
                <AccordionItem value="studentInfo">
                  <AccordionTrigger>Student Info</AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {renderCheckboxes(availableFields.studentInfo)}
                  </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="academicInfo">
                  <AccordionTrigger>Academic Info</AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {renderCheckboxes(availableFields.academicInfo)}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="remarks">
                  <AccordionTrigger>Remarks & Other</AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {renderCheckboxes([...availableFields.remarks, ...availableFields.otherInfo])}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Main Canvas: Preview */}
        <div className="lg:col-span-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Template Preview</CardTitle>
            </CardHeader>
            <CardContent className="h-full overflow-auto rounded-lg border bg-muted/50 p-4">
              <div className="aspect-[210/297] w-full bg-white p-6 shadow-md">
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
                <main>
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
                </main>
                 <footer className="mt-8 space-y-4 text-xs">
                    {visibleFields.softSkills && 
                        <div>
                            <h3 className="font-bold">Soft Skills:</h3>
                            <p className="min-h-[40px] rounded-md border-b p-1">Punctuality: 5/5, Neatness: 4/5</p>
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

        {/* Right Sidebar: Properties */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
              <CardDescription>
                Edit properties for the selected field.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Selected Field</Label>
                <Input readOnly value="Student Name" className="bg-muted" />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="field-label">Label</Label>
                <Input id="field-label" value="Student Name" />
              </div>
              <div className="space-y-2">
                <Label>Font Style</Label>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon"><Bold className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon"><Italic className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="font-size">Font Size</Label>
                    <Input id="font-size" type="number" defaultValue="12" />
                 </div>
                  <div className="space-y-2">
                    <Label htmlFor="font-color">Font Color</Label>
                    <Input id="font-color" type="color" defaultValue="#000000" className="p-1"/>
                 </div>
              </div>
               <div className="space-y-2">
                <Label>Alignment</Label>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon"><AlignLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon"><AlignCenter className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon"><AlignRight className="h-4 w-4" /></Button>
                </div>
              </div>
               <div className="space-y-2">
                <Label htmlFor="placeholder">Placeholder</Label>
                <Input id="placeholder" value="{{student.name}}" />
              </div>
               <div className="flex items-center space-x-2 pt-2">
                    <Checkbox id="conditional-visibility" />
                    <Label htmlFor="conditional-visibility" className="font-normal">
                      Hide if empty
                    </Label>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
