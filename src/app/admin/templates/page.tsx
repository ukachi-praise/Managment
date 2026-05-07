'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Save, Loader2, Database, ArrowLeft } from 'lucide-react';
import { useFirestore } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useMemoFirebase } from '@/firebase/provider';
import { doc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { ResultSheet } from '@/components/results/result-sheet';
import type { SavedTemplateData, TemplateSettings, Classroom, PupilData, ResultEntry } from '@/components/results/result-sheet';

const initialSettings: TemplateSettings = {
  studentInfo: { fontSize: 12, visible: true },
  header: { visible: true },
  subjectsTable: { visible: true },
  summary: { visible: true },
  softSkills: { visible: true },
  gradingKey: { visible: true },
  remarks: { visible: true },
  signatures: { visible: true },
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
      toast({ title: 'Template Loaded' });
    } else {
      toast({ variant: 'destructive', title: 'No Saved Template' });
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

    setTimeout(() => {
      setIsSaving(false);
      toast({ title: 'Template Saved!' });
    }, 1000);
  };
  
  const dummyPupil: PupilData = { id: 'dummy-pupil', name: 'JOHN DOE', admissionNumber: 'JKS-00123' };
  const dummyClassroom: Classroom = { id: 'dummy-class', name: 'Primary 5' };
  
  const dummyResultEntries: ResultEntry[] = Array.from({ length: 8 }).map((_, index) => ({
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
      <header className="flex-shrink-0 border-b bg-background z-10 no-print px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">Template Builder</h1>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="School Name" className="w-64 h-9" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
            <Button variant="outline" size="sm" onClick={loadSavedTemplate} disabled={templateLoading}>
              <Database className="mr-2 h-4 w-4" /> Load
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Eye className="mr-2 h-4 w-4" /> Preview
            </Button>
            <Button size="sm" onClick={handleSaveTemplate} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </div>
      </header>

      <main className="flex-1 overflow-auto">
        <ResultSheet
          student={dummyPupil}
          classroom={dummyClassroom}
          teacherName="Mrs. Jane Doe"
          templateData={{ name: templateName, schoolName, settings }}
          isForTemplateBuilder={true}
          resultEntries={dummyResultEntries}
          overall={dummyOverall}
          sessionId="dummy"
          termId="dummy"
        />
      </main>
    </div>
  );
}
