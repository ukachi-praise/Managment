

'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Save, RotateCcw, Upload, Settings, CaseUpper, CaseLower, BookOpenCheck, PanelLeft, PanelRight, Loader2, Database, ArrowLeft } from 'lucide-react';
import { useDoc, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { doc } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { ResultSheet } from '@/components/results/result-sheet';
import type { SavedTemplateData, TemplateSettings, Classroom, SchoolSettingsData, StudentData, TermResult, ResultEntry } from '@/components/results/result-sheet';


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
  const { toast } = useToast();
  const [templateName, setTemplateName] = useState('Primary School Template');
  const [schoolName, setSchoolName] = useState('JustVision Kiddies School');
  const [settings, setSettings] = useState<TemplateSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const firestore = useFirestore();

  // --- Data Fetching ---
  const templateRef = useMemoFirebase(() => (firestore ? doc(firestore, 'resultTemplates', 'main-template') : null), [firestore]);
  const { data: savedTemplateData, isLoading: templateLoading } = useDoc<SavedTemplateData>(templateRef);


  // --- Load Saved Template on Mount ---
  useEffect(() => {
    if (savedTemplateData) {
      setTemplateName(savedTemplateData.name || 'Primary School Template');
      setSchoolName(savedTemplateData.schoolName || 'JustVision Kiddies School');
      setSettings(savedTemplateData.settings || initialSettings);
    }
  }, [savedTemplateData]);


  const loadSavedTemplate = () => {
    if (savedTemplateData) {
      setTemplateName(savedTemplateData.name || 'Primary School Template');
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
  
    // Dummy data for previewing the ResultSheet component
  const dummyStudent: StudentData = { id: 'dummy-student', name: 'John Doe', admissionNumber: 'JKS-00123' };
  const dummyClassroom: Classroom = { id: 'dummy-class', name: 'Primary 5', teacherName: 'Mrs. Doe' };
  
  const dummyResultEntries: ResultEntry[] = Array.from({ length: 9 }).map((_, index) => ({
      subjectName: `Subject ${index + 1}`,
      ca1: 15,
      ca2: 18,
      exam: 45,
      total: 78,
      grade: 'B',
      remark: 'Very Good',
  }));

  const dummyOverall = { average: '78.00', grade: 'B' };


  return (
    <div className="flex h-screen flex-col bg-muted print:bg-white no-print">
      <header className="flex-shrink-0 border-b bg-background z-10 no-print">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-2">
            <Button onClick={() => router.back()} variant="outline" size="icon" className="md:hidden">
                <ArrowLeft className="h-4 w-4" />
            </Button>
             <Button onClick={() => router.back()} variant="outline" className="hidden md:flex">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
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
            <Input placeholder="School Name" className="w-64" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />

          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadSavedTemplate} disabled={templateLoading}>
              {templateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Load Saved
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

      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <ResultSheet
          student={dummyStudent}
          classroom={dummyClassroom}
          templateData={{ name: templateName, schoolName, settings }}
          isForTemplateBuilder={true}
          resultEntries={dummyResultEntries}
          overall={dummyOverall}
        />
      </main>
    </div>
  );
}
