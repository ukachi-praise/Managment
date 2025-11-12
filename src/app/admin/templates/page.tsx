
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Save, RotateCcw, Upload, Settings, CaseUpper, CaseLower, BookOpenCheck, PanelLeft, PanelRight, Loader2, Database } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCollection, useDoc, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, doc, Timestamp } from 'firebase/firestore';
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
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';


type Subject = {
  id: string;
  name: string;
};

type Classroom = {
  id: string;
  name: string;
  teacherName?: string;
};

type ClassroomSubject = {
  id: string;
  classroomId: string;
  subjectId: string;
};

type SchoolSettingsData = {
    currentSession: string;
    currentTermId: string;
    daysSchoolOpened: number;
    nextTermResumptionDate: Timestamp | Date | string;
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

type SavedTemplateData = {
  name: string;
  schoolName: string;
  settings: TemplateSettings;
}

const initialSettings: TemplateSettings = {
  studentInfo: {
    fontSize: 10,
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

const termNames: Record<string, string> = {
    term1: '1st Term',
    term2: '2nd Term',
    term3: '3rd Term',
};


export default function TemplatesPage() {
  const { toast } = useToast();
  const [templateName, setTemplateName] = useState('New Result Template');
  const [schoolName, setSchoolName] = useState('JustVision Kiddies School');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [settings, setSettings] = useState<TemplateSettings>(initialSettings);
  const [selectedElement, setSelectedElement] = useState<TemplateElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const firestore = useFirestore();

  // --- Data Fetching ---
  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: schoolSettings, isLoading: settingsLoading } = useDoc<SchoolSettingsData>(settingsRef);
  
  const templateRef = useMemoFirebase(() => (firestore ? doc(firestore, 'resultTemplates', 'main-template') : null), [firestore]);
  const { data: savedTemplateData, isLoading: templateLoading } = useDoc<SavedTemplateData>(templateRef);

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

  // --- Load Saved Template on Mount ---
  useEffect(() => {
    if (savedTemplateData) {
      setTemplateName(savedTemplateData.name || 'New Result Template');
      setSchoolName(savedTemplateData.schoolName || 'JustVision Kiddies School');
      setSettings(savedTemplateData.settings || initialSettings);
    }
  }, [savedTemplateData]);


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

  const resetSettings = () => {
    setSettings(initialSettings);
    setTemplateName('New Result Template');
    setSchoolName('JustVision Kiddies School');
    toast({
        title: 'Settings Reset',
        description: 'Template has been reset to the default configuration.',
    });
  }

  const loadSavedTemplate = () => {
    if (savedTemplateData) {
      setTemplateName(savedTemplateData.name || 'New Result Template');
      setSchoolName(savedTemplateData.schoolName || 'JustVision Kiddies School');
      setSettings(savedTemplateData.settings || initialSettings);
      toast({
        title: 'Template Loaded',
        description: 'Your saved template has been loaded into the editor.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'No Saved Template',
        description: 'Could not find a saved template to load.',
      });
    }
  };


  const handleSaveTemplate = () => {
    if (!firestore || !templateRef) return;
    setIsSaving(true);
    
    const templateData = {
      name: templateName,
      schoolName: schoolName,
      settings: settings,
    };

    setDocumentNonBlocking(templateRef, templateData, { merge: true });

    // Simulate save time and show feedback
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: 'Template Saved!',
        description: `${templateName} has been successfully saved.`,
      });
    }, 1500);
  };


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
    
    if (!currentSettings) return null;

    return (
        <div className="p-4">
            <h3 className="font-semibold text-lg mb-4 capitalize">{selectedElement.replace(/([A-Z])/g, ' $1')} Settings</h3>
             <div className="space-y-4">
                {'fontSize' in currentSettings && (
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

  const StudentInfoDetail = ({ label, value, isLoading = false }: { label: string, value?: string | React.ReactNode, isLoading?: boolean }) => (
    <div className="flex text-xs">
        <span className="font-semibold w-[80px] shrink-0">{label}:</span>
        <span className="flex-1 border-b border-dotted border-black">
            {isLoading ? <Skeleton className="h-4 w-24" /> : value}
        </span>
    </div>
  )

  const isLoading = settingsLoading || templateLoading || classroomsLoading || subjectsLoading || classroomSubjectsLoading;

  return (
    <div className="flex h-screen flex-col bg-muted print:bg-white no-print" onClick={() => setSelectedElement(null)}>
      <header className="flex-shrink-0 border-b bg-background z-10 no-print">
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
                <SelectValue placeholder="Select Class to Preview" />
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
            <Button variant="outline" onClick={loadSavedTemplate} disabled={templateLoading}>
              {templateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              View Saved Template
            </Button>
            <Button variant="outline" onClick={resetSettings}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Default
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Eye className="mr-2 h-4 w-4" />
              Preview PDF
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <aside className={cn("flex-shrink-0 bg-background border-r transition-all duration-300 overflow-y-auto no-print", sidebarOpen ? "w-72" : "w-0")}>
          {sidebarOpen && <div className="h-full">{renderSettingsPanel()}</div>}
        </aside>

        {/* Preview Area */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {/* A4 Preview Canvas */}
          <div className="relative mx-auto aspect-[210/297] w-full bg-white p-6 shadow-lg print:shadow-none print:m-0 print:p-0 print:max-w-none print:h-full text-black">
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
                  className={cn('mb-4 p-2 border border-black editable-region', { 'outline-blue-500 outline-dashed outline-2 outline-offset-2': selectedElement === 'header' })}
                  onClick={(e) => handleElementClick(e, 'header')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative h-16 w-16">
                        <Image src="/Logo.jpg" alt="School Logo" layout="fill" objectFit="contain" />
                      </div>
                      <div
                        className={cn('editable-region text-left', { 'outline-blue-500 outline-dashed outline-2 outline-offset-2': selectedElement === 'schoolName' })}
                        onClick={(e) => handleElementClick(e, 'schoolName')}
                      >
                        <div className="text-black">
                          <h1 className="font-headline text-xl font-bold text-black">{templateLoading ? <Skeleton className="h-6 w-48" /> : schoolName}</h1>
                          <p className="text-sm text-black">Katampe 2 Mpape Abuja</p>
                          <p className="text-sm font-semibold text-black">Motto: Exceeding Great</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <h2 className="font-bold text-base text-black">Student Report Card</h2>
                      {settingsLoading ? (
                        <Skeleton className="h-4 w-28 mt-1" />
                      ) : (
                        <p className="text-xs text-zinc-600">
                          {schoolSettings?.currentTermId ? termNames[schoolSettings.currentTermId] : 'N/A'}, {schoolSettings?.currentSession}
                        </p>
                      )}
                    </div>
                  </div>
                  <Separator className="my-2 bg-black" />
                </header>
              )}

              {settings.studentInfo.visible && (
                <div
                  className={cn('editable-region mb-4 p-2 border border-black', { 'outline-blue-500 outline-dashed outline-2 outline-offset-2': selectedElement === 'studentInfo' })}
                  onClick={(e) => handleElementClick(e, 'studentInfo')}
                  style={{ fontSize: `${settings.studentInfo.fontSize}px` }}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-4">
                      <div className="w-1/3"><StudentInfoDetail label="Student Name" value="John Doe" /></div>
                      <div className="w-1/3"><StudentInfoDetail label="Admission No" value="JKS-00123" /></div>
                      <div className="w-1/3"><StudentInfoDetail label="Class" value={selectedClassroom?.name || 'Primary 5'} /></div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-1/3"><StudentInfoDetail label="Term" value={schoolSettings?.currentTermId ? termNames[schoolSettings.currentTermId] : undefined} isLoading={settingsLoading} /></div>
                      <div className="w-1/3"><StudentInfoDetail label="Session" value={schoolSettings?.currentSession} isLoading={settingsLoading} /></div>
                      <div className="w-1/3"><StudentInfoDetail label="Days Attended" value="60" /></div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-1/3"><StudentInfoDetail label="School Open" value={schoolSettings?.daysSchoolOpened.toString()} isLoading={settingsLoading} /></div>
                      <div className="w-1/3"><StudentInfoDetail label="Resumption" value={formattedResumptionDate} isLoading={settingsLoading} /></div>
                      <div className="w-1/3"><StudentInfoDetail label="Class Teacher" value={selectedClassroom?.teacherName || 'Mrs. Doe'} /></div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col">
                {settings.subjectsTable.visible && (
                  <div
                    className={cn('editable-region border border-black', { 'outline-blue-500 outline-dashed outline-2 outline-offset-2': selectedElement === 'subjectsTable' })}
                    onClick={(e) => handleElementClick(e, 'subjectsTable')}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="border border-black p-1 h-auto text-sm text-black">Subject</TableHead>
                          <TableHead className="text-center border border-black p-1 h-auto text-sm text-black">CA1 (10)</TableHead>
                          <TableHead className="text-center border border-black p-1 h-auto text-sm text-black">CA2 (10)</TableHead>
                          <TableHead className="text-center border border-black p-1 h-auto text-sm text-black">CA3 (10)</TableHead>
                          <TableHead className="text-center border border-black p-1 h-auto text-sm text-black">Exam (70)</TableHead>
                          <TableHead className="text-center border border-black p-1 h-auto text-sm text-black">Total (100)</TableHead>
                          <TableHead className="border border-black p-1 h-auto text-sm text-black">Remark</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow><TableCell colSpan={7} className="text-center border-b border-black p-1 text-sm">Loading subjects...</TableCell></TableRow>
                        ) : displayedSubjects.length > 0 ? (
                          displayedSubjects.map(subject => (
                            <TableRow key={subject.id}>
                              <TableCell className="border-b border-r border-black p-1 text-sm">{subject.name}</TableCell>
                              <TableCell className="text-center border-b border-r border-black p-1 text-sm">--</TableCell>
                              <TableCell className="text-center border-b border-r border-black p-1 text-sm">--</TableCell>
                              <TableCell className="text-center border-b border-r border-black p-1 text-sm">--</TableCell>
                              <TableCell className="text-center border-b border-r border-black p-1 text-sm">--</TableCell>
                              <TableCell className="text-center border-b border-r border-black p-1 text-sm">--</TableCell>
                              <TableCell className="border-b border-black p-1 text-sm">--</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          Array.from({ length: 12 }).map((_, index) => (
                            <TableRow key={`placeholder-${index}`}>
                              <TableCell className="border-b border-r border-black p-1 text-sm">Subject Name</TableCell>
                              <TableCell className="text-center border-b border-r border-black p-1 text-sm">--</TableCell>
                              <TableCell className="text-center border-b border-r border-black p-1 text-sm">--</TableCell>
                              <TableCell className="text-center border-b border-r border-black p-1 text-sm">--</TableCell>
                              <TableCell className="text-center border-b border-r border-black p-1 text-sm">--</TableCell>
                              <TableCell className="text-center border-b border-r border-black p-1 text-sm">--</TableCell>
                              <TableCell className="border-b border-black p-1 text-sm">--</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {settings.summary.visible && (
                  <div
                    className={cn('editable-region mt-2 flex justify-end', { 'outline-blue-500 outline-dashed outline-2 outline-offset-2': selectedElement === 'summary' })}
                    onClick={(e) => handleElementClick(e, 'summary')}
                  >
                    <div className="w-1/2 rounded-md border border-black p-2 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-semibold text-black">
                          Overall Average:
                        </span>
                        <span className="text-black">75.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-black">Overall Grade:</span>
                        <span className="text-black">B (Very Good)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <footer
                className={cn('editable-region mt-auto pt-2 text-xs', { 'outline-blue-500 outline-dashed outline-2 outline-offset-2': selectedElement === 'footer' })}
                onClick={(e) => handleElementClick(e, 'footer')}
              >
                <section className='border border-black p-2 flex flex-col gap-2'>
                  {settings.softSkills.visible && (
                    <div className="space-y-1">
                      <h3 className="font-bold text-black">Soft Skills Assessment</h3>
                      <div className="grid grid-cols-3 gap-x-4">
                        <div>
                          <Table>
                            <TableBody>
                              <TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Punctuality</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">5</TableCell></TableRow>
                              <TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Neatness</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">4</TableCell></TableRow>
                              <TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Creativity</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">5</TableCell></TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        <div>
                          <Table>
                            <TableBody>
                              <TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Honesty</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">5</TableCell></TableRow>
                              <TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Communication</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">5</TableCell></TableRow>
                              <TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Teamwork</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">4</TableCell></TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        <div>
                          <Table>
                            <TableBody>
                              <TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Attentiveness</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">4</TableCell></TableRow>
                              <TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Self Control</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">5</TableCell></TableRow>
                              <TableRow><TableCell className="font-medium p-1 h-auto text-[10px] border border-black text-black">Leadership</TableCell><TableCell className="text-right p-1 h-auto text-[10px] border border-black">5</TableCell></TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  )}

                  {settings.gradingKey.visible && (
                    <div className="grid grid-cols-2 gap-x-4 pt-2">
                      <div className="space-y-1">
                        <h3 className="font-bold text-black">Grading Key</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="p-1 h-auto text-[10px] border border-black text-black">Score</TableHead>
                              <TableHead className="p-1 h-auto text-[10px] border border-black text-black">Grade</TableHead>
                              <TableHead className="p-1 h-auto text-[10px] border border-black text-black">Remark</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">80 – 100</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">A</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Excellent</TableCell></TableRow>
                            <TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">70 – 79</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">B</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Very Good</TableCell></TableRow>
                            <TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">60 – 69</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">C</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Good</TableCell></TableRow>
                            <TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">50 – 59</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">D</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Fair</TableCell></TableRow>
                            <TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">0 – 49</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">F</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Fail</TableCell></TableRow>
                          </TableBody>
                        </Table>
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-black">Skill Score Rating</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="p-1 h-auto text-[10px] border border-black text-black">Score</TableHead>
                              <TableHead className="p-1 h-auto text-[10px] border border-black text-black">Remark</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">5</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Excellent</TableCell></TableRow>
                            <TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">4</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Very Good</TableCell></TableRow>
                            <TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">3</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Good</TableCell></TableRow>
                            <TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">2</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Fair</TableCell></TableRow>
                            <TableRow><TableCell className="p-1 h-auto text-[10px] border border-black">1</TableCell><TableCell className="p-1 h-auto text-[10px] border border-black">Poor</TableCell></TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {settings.remarks.visible && (
                    <div className="pt-2 space-y-2">
                      <div>
                        <h3 className="font-bold text-black">Teacher's Remarks:</h3>
                        <p className="min-h-[25px] rounded-md border-b border-black p-1">
                          A brilliant student...
                        </p>
                      </div>
                      <div>
                        <h3 className="font-bold text-black">Head Teacher's Remarks:</h3>
                        <p className="min-h-[25px] rounded-md border-b border-black p-1">
                          Excellent performance...
                        </p>
                      </div>
                    </div>
                  )}
                  {settings.signatures.visible && (
                    <div className="flex justify-between items-end pt-4">
                      <div className="text-center w-36">
                        <div className="border-t border-black pt-1">
                          Class Teacher's Signature
                        </div>
                      </div>
                      <div className="text-center w-36">
                        <div className="border-t border-black pt-1">
                          Head Teacher's Signature
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </footer>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

    