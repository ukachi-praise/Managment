
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Loader2, ArrowLeft, Download, Save, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
  useFirestore,
  useMemoFirebase,
} from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { collection, query, where, doc, getDoc, getDocs, collectionGroup, serverTimestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { format } from 'date-fns';
import { generateBroadsheetExcel } from '@/lib/generateExcel';
import { saveAs } from 'file-saver';
import Link from 'next/link';


// --- TYPE DEFINITIONS ---
type Classroom = { id: string; name: string };
type Student = { id: string; name: string; isDeleted?: boolean };
type Subject = { id: string; name: string };
type SchoolSettings = { currentSession: string; currentTermId: string };
type TermResult = { studentId: string; termId: string; sessionId: string; scores: Record<string, any> };
type Broadsheet = { id: string; sessionId: string; termId: string; classroomName: string; createdAt: any; results: any[] };

const termNames: Record<string, string> = { term1: '1st Term', term2: '2nd Term', term3: '3rd Term' };


export default function BroadsheetPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // --- Data Fetching ---
  const classroomsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'classrooms')) : null, [firestore]);
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);

  const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'schoolSettings', 'current') : null, [firestore]);
  const { data: schoolSettings, isLoading: settingsLoading } = useDoc<SchoolSettings>(settingsRef);
  
  const broadsheetsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'broadsheets')) : null, [firestore]);
  const { data: broadsheets, isLoading: broadsheetsLoading } = useCollection<Broadsheet>(broadsheetsQuery);

  const groupedBroadsheets = useMemo(() => {
    if (!broadsheets) return {};
    return broadsheets.reduce((acc, sheet) => {
        const session = sheet.sessionId || 'Uncategorized';
        if (!acc[session]) {
            acc[session] = [];
        }
        acc[session].push(sheet);
        return acc;
    }, {} as Record<string, Broadsheet[]>);
  }, [broadsheets]);


  const handleGenerateBroadsheet = async () => {
    if (!firestore || !selectedClass || !schoolSettings) {
      toast({ variant: 'destructive', title: 'Error', description: 'Missing required data to generate broadsheet.' });
      return;
    }
    setIsGenerating(true);
    toast({ title: 'Generating Broadsheet...', description: 'Please wait while we compile the results.' });

    try {
      const { currentSession, currentTermId } = schoolSettings;
      const termResultId = `${currentSession.replace('/', '-')}-${currentTermId}`;

      // 1. Get all students in the selected class
      const studentsInClassQuery = query(collection(firestore, 'classrooms', selectedClass, 'students'));
      const studentsInClassSnap = await getDocs(studentsInClassQuery);
      const studentIds = studentsInClassSnap.docs.map(d => d.id);
      
      if (studentIds.length === 0) {
        throw new Error("No students found in this class.");
      }
      
      // 2. Fetch all student documents in batches to get their names
      const studentMap = new Map<string, Student>();
       for (let i = 0; i < studentIds.length; i += 30) {
        const batch = studentIds.slice(i, i + 30);
        if (batch.length === 0) continue;
        const studentsQuery = query(collection(firestore, "students"), where("__name__", "in", batch));
        const studentsSnap = await getDocs(studentsQuery);
        studentsSnap.forEach(doc => {
            if (!(doc.data() as Student).isDeleted) {
                studentMap.set(doc.id, doc.data() as Student);
            }
        });
      }


      // 3. Fetch all results for these students for the current term in batches
      const resultsByStudentId = new Map<string, TermResult>();
      for (const studentId of studentMap.keys()) {
        const resultDocRef = doc(firestore, 'students', studentId, 'results', termResultId);
        const resultSnap = await getDoc(resultDocRef);
        if (resultSnap.exists()) {
            resultsByStudentId.set(studentId, resultSnap.data() as TermResult);
        }
      }


      // 4. Compile the data
      const compiledResults = Array.from(studentMap.keys()).map(id => {
          const student = studentMap.get(id);
          const result = resultsByStudentId.get(id);
          return {
              studentId: id,
              studentName: student?.name || 'Unknown Student',
              scores: result?.scores || {}
          }
      });
      
      // 5. Save the broadsheet
      const classroomName = classrooms?.find(c => c.id === selectedClass)?.name || 'Unknown Class';
      const broadsheetData = {
          sessionId: currentSession,
          termId: currentTermId,
          classroomId: selectedClass,
          classroomName: classroomName,
          createdAt: serverTimestamp(),
          results: compiledResults
      };

      await addDocumentNonBlocking(collection(firestore, 'broadsheets'), broadsheetData);

      toast({ title: 'Broadsheet Saved!', description: `A result snapshot for ${classroomName} has been saved.` });

    } catch (error: any) {
      console.error("Broadsheet generation error:", error);
      toast({ variant: 'destructive', title: 'Generation Failed', description: error.message || 'An unexpected error occurred.' });
    } finally {
      setIsGenerating(false);
    }
  };
  
   const handleExport = async (sheet: Broadsheet) => {
        if (!firestore) return;
        setIsExporting(sheet.id);

        try {
            const subjectsSnapshot = await getDocs(collection(firestore, 'subjects'));
            const subjectMap = new Map(subjectsSnapshot.docs.map(doc => [doc.id, doc.data().name]));

            const subjectIds = new Set<string>();
            sheet.results.forEach(result => {
                Object.keys(result.scores).forEach(subjectId => subjectIds.add(subjectId));
            });

            const orderedSubjectIds = Array.from(subjectIds).sort((a,b) => (subjectMap.get(a) || '').localeCompare(subjectMap.get(b) || ''));
            const subjectHeader = orderedSubjectIds.map(id => subjectMap.get(id) || 'Unknown');
            
            const excelBuffer = await generateBroadsheetExcel(sheet, subjectHeader, orderedSubjectIds);

            saveAs(
                new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
                `${sheet.classroomName}_${sheet.sessionId.replace('/', '-')}_${sheet.termId}_Broadsheet.xlsx`
            );

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Export Failed', description: error.message });
        } finally {
            setIsExporting(null);
        }
    };
  
  const isLoading = classroomsLoading || settingsLoading || broadsheetsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={() => router.back()} variant="outline" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Results Broadsheet</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Term Broadsheet</CardTitle>
          <CardDescription>
            Select a class to generate and save a snapshot of all current student results for this term.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-24"> <Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
             <div className="flex flex-col sm:flex-row items-center gap-4">
              <Select onValueChange={setSelectedClass} value={selectedClass || ''}>
                <SelectTrigger className="w-full sm:w-[300px]">
                  <SelectValue placeholder="Select a Class" />
                </SelectTrigger>
                <SelectContent>
                  {classrooms?.sort((a,b) => a.name.localeCompare(b.name)).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleGenerateBroadsheet} disabled={!selectedClass || isGenerating} className="w-full sm:w-auto">
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Generate & Save Broadsheet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader>
              <CardTitle>Saved Broadsheets</CardTitle>
              <CardDescription>View and download previously generated result broadsheets grouped by academic session.</CardDescription>
          </CardHeader>
          <CardContent>
            {broadsheetsLoading ? (
                 <div className="flex justify-center items-center h-24"> <Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : Object.keys(groupedBroadsheets).length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                    {Object.entries(groupedBroadsheets).map(([session, sheets]) => (
                        <AccordionItem key={session} value={session}>
                            <AccordionTrigger className="text-lg font-semibold">Academic Session: {session}</AccordionTrigger>
                            <AccordionContent>
                                <div className="divide-y">
                                {sheets.sort((a, b) => a.termId.localeCompare(b.termId)).map(sheet => (
                                    <div key={sheet.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <p className="font-bold text-md">{sheet.classroomName} - {termNames[sheet.termId] || sheet.termId}</p>
                                            <p className="text-sm text-muted-foreground">Generated on: {sheet.createdAt ? format(sheet.createdAt.toDate(), 'PPP, p') : 'N/A'}</p>
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <Button asChild variant="outline" size="sm" className="flex-1">
                                                <Link href={`/admin/broadsheet/${sheet.id}`}>
                                                     <Eye className="mr-2 h-4 w-4" />
                                                     View
                                                </Link>
                                            </Button>
                                            <Button onClick={() => handleExport(sheet)} variant="outline" size="sm" disabled={isExporting === sheet.id} className="flex-1">
                                                {isExporting === sheet.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                                Download
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            ) : (
                <p className="text-center text-muted-foreground py-10">No broadsheets have been generated yet.</p>
            )}
          </CardContent>
      </Card>

    </div>
  );
}
