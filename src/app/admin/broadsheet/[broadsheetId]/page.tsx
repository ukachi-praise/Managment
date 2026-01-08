
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { collection, doc, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useCollection } from '@/firebase/firestore/use-collection';
import { generateBroadsheetExcel } from '@/lib/generateExcel';
import { saveAs } from 'file-saver';


type Broadsheet = { id: string; sessionId: string; termId: string; classroomId: string; classroomName: string; createdAt: any; results: any[] };
type Subject = { id: string; name: string };

const termNames: Record<string, string> = { term1: '1st Term', term2: '2nd Term', term3: '3rd Term' };

export default function BroadsheetViewPage() {
    const params = useParams();
    const router = useRouter();
    const broadsheetId = params.broadsheetId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isExporting, setIsExporting] = useState(false);

    const broadsheetRef = useMemoFirebase(() => (firestore && broadsheetId) ? doc(firestore, 'broadsheets', broadsheetId) : null, [firestore, broadsheetId]);
    const { data: broadsheet, isLoading: broadsheetLoading } = useDoc<Broadsheet>(broadsheetRef);

    const subjectsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'subjects') : null, [firestore]);
    const { data: allSubjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQuery);

    const subjectMap = useMemo(() => {
        if (!allSubjects) return new Map<string, string>();
        return new Map(allSubjects.map(s => [s.id, s.name]));
    }, [allSubjects]);
    
    const orderedSubjects = useMemo(() => {
        if (!broadsheet || !subjectMap.size) return [];
        const subjectIds = new Set<string>();
        broadsheet.results.forEach(result => {
            Object.keys(result.scores).forEach(subjectId => {
                subjectIds.add(subjectId);
            });
        });
        
        return Array.from(subjectIds).sort((a, b) => {
            const nameA = subjectMap.get(a) || '';
            const nameB = subjectMap.get(b) || '';
            return nameA.localeCompare(nameB);
        });

    }, [broadsheet, subjectMap]);

    const handleExport = async () => {
        if (!broadsheet || !orderedSubjects || !subjectMap.size) return;

        setIsExporting(true);
        toast({ title: "Generating Excel...", description: "Please wait while the broadsheet is being exported."});

        try {
            const subjectHeader = orderedSubjects.map(id => subjectMap.get(id) || 'Unknown Subject');
            const excelBuffer = await generateBroadsheetExcel(broadsheet, subjectHeader, orderedSubjects);
            
            saveAs(
                new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
                `${broadsheet.classroomName}_${broadsheet.sessionId.replace('/', '-')}_${broadsheet.termId}_Broadsheet.xlsx`
            );

            toast({ title: "Export Successful", description: "The broadsheet has been downloaded."});

        } catch (error: any) {
            console.error("Excel Export Error:", error);
            toast({ variant: 'destructive', title: 'Export Failed', description: error.message });
        } finally {
            setIsExporting(false);
        }
    };


    const isLoading = broadsheetLoading || subjectsLoading;

    if (isLoading) {
      return (
        <div className="flex h-screen items-center justify-center bg-muted">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      );
    }
    
    if (!broadsheet) {
       return (
        <div className="flex h-screen items-center justify-center bg-muted">
            <Card className="m-4">
                <CardContent className="p-8">
                     <h2 className="text-xl font-semibold text-destructive">Broadsheet Not Found</h2>
                     <p className="text-muted-foreground mt-2">Could not find the requested broadsheet data.</p>
                     <Button onClick={() => router.back()} className="mt-6">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                     </Button>
                </CardContent>
            </Card>
        </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Broadsheet for {broadsheet.classroomName}
                    </h1>
                    <p className="text-muted-foreground">
                        Showing results for {termNames[broadsheet.termId] || broadsheet.termId}, {broadsheet.sessionId} Session.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => router.back()} variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <Button onClick={handleExport} disabled={isExporting}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Export as Excel
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Result Summary</CardTitle>
                    <CardDescription>Generated on {broadsheet.createdAt ? format(broadsheet.createdAt.toDate(), 'PPP, p') : 'N/A'}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky left-0 bg-background/95 z-10 w-[200px]">Student Name</TableHead>
                                    {orderedSubjects.map(id => <TableHead key={id} className="text-center">{subjectMap.get(id)}</TableHead>)}
                                    <TableHead className="text-center font-bold">Total</TableHead>
                                    <TableHead className="text-center font-bold">Average</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {broadsheet.results.map(result => {
                                    let studentTotal = 0;
                                    const scores = orderedSubjects.map(subId => {
                                        const subjectScore = result.scores[subId];
                                        if (subjectScore) {
                                            const total = (subjectScore.ca1 || 0) + (subjectScore.ca2 || 0) + (subjectScore.exam || 0);
                                            studentTotal += total;
                                            return total;
                                        }
                                        return 0;
                                    });
                                    const studentAverage = studentTotal / orderedSubjects.length;

                                    return (
                                        <TableRow key={result.studentId}>
                                            <TableCell className="font-medium sticky left-0 bg-background/95 z-10">{result.studentName}</TableCell>
                                            {scores.map((score, index) => (
                                                <TableCell key={index} className="text-center">{score}</TableCell>
                                            ))}
                                            <TableCell className="text-center font-bold">{studentTotal.toFixed(2)}</TableCell>
                                            <TableCell className="text-center font-bold">{studentAverage.toFixed(2)}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
