
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Save, RotateCcw, Upload, Settings, CaseUpper, CaseLower, BookOpenCheck, PanelLeft, PanelRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import Image from 'next/image';


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

type TemplateElement = 'header' | 'studentInfo' | 'subjectsTable' | 'summary' | 'softSkills' | 'remarks' | 'footer' | 'schoolName' | null;

type TemplateSettings = {
  studentInfo: {
    fontSize: number;
    visible: boolean;
  };
  header: {
    visible: boolean;
  };
  subjectsTable: {
    visible: boolean;
  };
  summary: {
    visible: boolean;
  };
  softSkills: {
    visible: boolean;
  };
  gradingKey: {
    visible: boolean;
  };
  remarks: {
    visible: boolean;
  };
  signatures: {
    visible: boolean;
  };
};

const initialSettings: TemplateSettings = {
  studentInfo: {
    fontSize: 12,
    visible: true,
  },
  header: {
    visible: true,
  },
  subjectsTable: {
    visible: true,
  },
  summary: {
    visible: true,
  },
  softSkills: {
    visible: true,
  },
  gradingKey: {
    visible: true,
  },
  remarks: {
    visible: true,
  },
  signatures: {
    visible: true,
  },
};


export default function TemplatesPage() {
  const [templateName, setTemplateName] = useState('New Result Template');
  const [schoolName, setSchoolName] = useState('JustVision Kiddies School');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [settings, setSettings] = useState<TemplateSettings>(initialSettings);
  const [selectedElement, setSelectedElement] = useState<TemplateElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  const handleElementClick = (e: React.MouseEvent, elementName: TemplateElement) => {
    e.stopPropagation();
    setSelectedElement(elementName);
  };
  
  const handleSettingsChange = (element: keyof TemplateSettings, property: string, value: any) => {
    setSettings(prev => ({
        ...prev,
        [element]: {
            ...prev[element],
            [property]: value,
        }
    }));
  };

  const resetSettings = () => setSettings(initialSettings);

  const renderSettingsPanel = () => {
    if (!selectedElement) {
        return (
            <div className="p-4">
                <h3 className="font-semibold text-lg mb-2">Template Settings</h3>
                <p className="text-sm text-muted-foreground mb-4">Click on an element in the preview to edit its properties.</p>
                <div className="space-y-3">
                    <h4 className="font-medium text-md border-b pb-2">Visible Sections</h4>
                    {Object.keys(settings).map((key) => (
                         <div key={key} className="flex items-center justify-between">
                            <Label htmlFor={`visible-${key}`} className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                            <Switch 
                                id={`visible-${key}`} 
                                checked={settings[key as keyof TemplateSettings].visible} 
                                onCheckedChange={(checked) => handleSettingsChange(key as keyof TemplateSettings, 'visible', checked)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (selectedElement === 'schoolName') {
      return (
        <div className="p-4">
            <h3 className="font-semibold text-lg mb-4 capitalize">School Name</h3>
             <div className="space-y-2">
                <Label htmlFor="school-name-input">School Name</Label>
                <Input 
                    id="school-name-input"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                />
            </div>
        </div>
      )
    }

    const currentSettings = settings[selectedElement as keyof TemplateSettings];

    return (
        <div className="p-4">
            <h3 className="font-semibold text-lg mb-4 capitalize">{selectedElement.replace(/([A-Z])/g, ' $1')} Settings</h3>
             <div className="space-y-4">
                {currentSettings && 'fontSize' in currentSettings && (
                    <div className="space-y-2">
                        <Label>Font Size: {currentSettings.fontSize}px</Label>
                        <Slider 
                            value={[currentSettings.fontSize]}
                            onValueChange={(value) => handleSettingsChange(selectedElement as keyof TemplateSettings, 'fontSize', value[0])}
                            min={8}
                            max={24}
                            step={1}
                        />
                    </div>
                )}
             </div>
        </div>
    )
  }

  const StudentInfoDetail = ({ label, value }: { label: string, value: string | React.ReactNode }) => (
    <div className="flex">
        <span className="font-semibold w-32 shrink-0">{label}:</span>
        <span className="flex-1 border-b border-dotted border-gray-400">{value}</span>
    </div>
  )

  return (
    <div className="h-full flex flex-col bg-muted print:bg-white no-print" onClick={() => setSelectedElement(null)}>
        {/* Main Content */}
        <header className="flex-shrink-0 bg-background border-b z-10 no-print">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
                    {sidebarOpen ? <PanelLeft /> : <PanelRight />}
                </Button>
                <div>
                <h1 className="text-2xl font-bold tracking-tight">
                    Result Template Builder
                </h1>
                <p className="text-sm text-muted-foreground">
                    Design and manage result templates.
                </p>
                </div>
                </div>
                <div className="flex items-center gap-4">
                    <Input placeholder="Template Name" className="w-48" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
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
                <Button variant="outline" onClick={resetSettings}>
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
        </header>

        <div className="flex-1 flex overflow-hidden">
            {/* Settings Sidebar */}
            <aside className={cn("border-r bg-background flex-shrink-0 transition-all duration-300 overflow-y-auto no-print", sidebarOpen ? "w-72" : "w-0")}>
                {sidebarOpen && renderSettingsPanel()}
            </aside>

            {/* Preview Area */}
            <main className="flex-1 p-4 sm:p-6 overflow-auto">
                 {/* A4 Preview Canvas */}
                <div className="relative mx-auto aspect-[210/297] w-full max-w-[210mm] bg-white p-8 shadow-lg print:shadow-none print:m-0 print:p-0 print:max-w-none print:h-full">
                    <div className="absolute inset-0 z-0 flex items-center justify-center">
                        <Image
                            src="/Logo.jpg"
                            alt="School Watermark"
                            width={400}
                            height={400}
                            className="opacity-10"
                        />
                    </div>
                    <div className="relative z-10 flex flex-col h-full">
                        {settings.header.visible && (
                            <header 
                                className={cn('mb-4 p-4 border editable-region', {'outline-blue-500 outline-dashed outline-2 outline-offset-2': selectedElement === 'header'})}
                                onClick={(e) => handleElementClick(e, 'header')}
                            >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="relative h-16 w-16">
                                        <Image src="/Logo.jpg" alt="School Logo" layout="fill" objectFit="contain" />
                                    </div>
                                    <div 
                                        className={cn('editable-region text-left', {'outline-blue-500 outline-dashed outline-2 outline-offset-2': selectedElement === 'schoolName'})}
                                        onClick={(e) => handleElementClick(e, 'schoolName')}
                                    >
                                        <div>
                                            <h1 className="font-headline text-2xl font-bold">{schoolName}</h1>
                                            <p className="text-sm">Katampe 2 Mpape Abuja</p>
                                            <p className="text-sm font-semibold">Motto: Exceeding Great</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                <h2 className="font-bold text-lg">Student Report Card</h2>
                                <p className="text-xs text-muted-foreground">
                                    First Term, 2023/2024
                                </p>
                                </div>
                            </div>
                            <Separator className="my-4" />
                        </header>
                        )}

                        {settings.studentInfo.visible && (
                            <div
                                className={cn('editable-region mb-4 p-4 border', {'outline-blue-500 outline-dashed outline-2 outline-offset-2': selectedElement === 'studentInfo'})}
                                onClick={(e) => handleElementClick(e, 'studentInfo')}
                                style={{ fontSize: `${settings.studentInfo.fontSize}px` }}
                            >
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                    <StudentInfoDetail label="Student Name" value="John Doe" />
                                    <StudentInfoDetail label="Admission No" value="JKS-00123" />
                                    <StudentInfoDetail label="Class" value={selectedClassroom?.name || 'Primary 5'} />
                                    <StudentInfoDetail label="Term" value="First" />
                                    <StudentInfoDetail label="Session" value="2023/2024" />
                                    <StudentInfoDetail label="No of times school open" value="65" />
                                    <StudentInfoDetail label="Days Attended" value="60" />
                                    <StudentInfoDetail label="Next term resumes" value="April 25, 2024" />
                                </div>
                            </div>
                        )}
                        
                        <main className="flex-grow flex flex-col mt-4">
                            {settings.subjectsTable.visible && (
                            <div 
                                className={cn('editable-region p-4 border flex-grow', {'outline-blue-500 outline-dashed outline-2 outline-offset-2': selectedElement === 'subjectsTable'})}
                                onClick={(e) => handleElementClick(e, 'subjectsTable')}
                            >
                                <Table>
                                    <TableHeader>
                                    <TableRow>
                                        <TableHead className="border">Subject</TableHead>
                                        <TableHead className="text-center border"><div>CA1</div><div>(10)</div></TableHead>
                                        <TableHead className="text-center border"><div>CA2</div><div>(10)</div></TableHead>
                                        <TableHead className="text-center border"><div>CA3</div><div>(10)</div></TableHead>
                                        <TableHead className="text-center border"><div>Exam</div><div>(70)</div></TableHead>
                                        <TableHead className="text-center border"><div>Total</div><div>(100)</div></TableHead>
                                        <TableHead className="border">Remark</TableHead>
                                    </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {subjectsLoading ? (
                                        <TableRow><TableCell colSpan={7} className="text-center border">Loading subjects...</TableCell></TableRow>
                                    ) : displayedSubjects.length > 0 ? (
                                        displayedSubjects.map(subject => (
                                        <TableRow key={subject.id}>
                                            <TableCell className="border">{subject.name}</TableCell>
                                            <TableCell className="text-center border">--</TableCell>
                                            <TableCell className="text-center border">--</TableCell>
                                            <TableCell className="text-center border">--</TableCell>
                                            <TableCell className="text-center border">--</TableCell>
                                            <TableCell className="text-center border">--</TableCell>
                                            <TableCell className="border">--</TableCell>
                                        </TableRow>
                                        ))
                                    ) : (
                                        Array.from({ length: 12 }).map((_, index) => (
                                            <TableRow key={`placeholder-${index}`}>
                                                <TableCell className="border">Subject Name</TableCell>
                                                <TableCell className="text-center border">--</TableCell>
                                                <TableCell className="text-center border">--</TableCell>
                                                <TableCell className="text-center border">--</TableCell>
                                                <TableCell className="text-center border">--</TableCell>
                                                <TableCell className="text-center border">--</TableCell>
                                                <TableCell className="border">--</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                    </TableBody>
                                </Table>
                            </div>
                            )}
                            {settings.summary.visible && (
                            <div 
                                className={cn('editable-region mt-4 flex justify-end', {'outline-blue-500 outline-dashed outline-2 outline-offset-2': selectedElement === 'summary'})}
                                onClick={(e) => handleElementClick(e, 'summary')}
                            >
                                <div className="w-1/3 rounded-md border p-2 text-sm space-y-1">
                                    <div className="flex justify-between">
                                        <span className="font-semibold">
                                        Overall Average:
                                        </span>
                                        <span>75.5%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-semibold">Overall Grade:</span>
                                        <span>B (Very Good)</span>
                                    </div>
                                </div>
                            </div>
                            )}
                        </main>
                        <footer 
                            className={cn('editable-region mt-auto pt-4 space-y-4 text-xs', {'outline-blue-500 outline-dashed outline-2 outline-offset-2': selectedElement === 'footer'})}
                            onClick={(e) => handleElementClick(e, 'footer')}
                        >
                            {settings.softSkills.visible && (
                            <div 
                                className="space-y-2 p-4 border"
                            >
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
                            
                            {settings.gradingKey.visible && (
                                <div className="grid grid-cols-2 gap-x-8 pt-4 p-4 border">
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
                            )}

                            {settings.remarks.visible && (
                            <div className="pt-4 space-y-4 p-4 border">
                                <div>
                                    <h3 className="font-bold">Teacher's Remarks:</h3>
                                    <p className="min-h-[40px] rounded-md border-b p-1">
                                    A brilliant student...
                                    </p>
                                </div>
                                <div>
                                    <h3 className="font-bold">Head Teacher's Remarks:</h3>
                                    <p className="min-h-[40px] rounded-md border-b p-1">
                                    Excellent performance...
                                    </p>
                                </div>
                            </div>
                            )}
                            {settings.signatures.visible && (
                            <div className="flex justify-between items-end pt-8 p-4 border">
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
                            )}
                        </footer>
                    </div>
                </div>
            </main>
        </div>
    </div>
  );
}
