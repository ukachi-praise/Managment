
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useEffect } from 'react';
import {
  useFirestore,
} from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, where, doc, getDocs } from 'firebase/firestore';
import { ResultSheet } from '@/components/results/result-sheet';
import { Loader2, ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';


// --- TYPE DEFINITIONS ---
type Student = { id: string; name: string; admissionNumber: string; isDeleted?: boolean; };
type Classroom = { id: string; name: string; teacherId?: string; };
type Enrollment = { id: string; studentId: string; classroomId: string };
type User = { id: string; name: string; };


export default function ResultSheetPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const firestore = useFirestore();
  const resultSheetRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  
  // --- Data Fetching ---
  const studentRef = useMemoFirebase(
    () => (firestore && studentId ? doc(firestore, 'students', studentId) : null),
    [firestore, studentId]
  );
  const { data: student, isLoading: studentLoading } = useDoc<Student>(studentRef);
  
  const enrollmentsQuery = useMemoFirebase(
    () => (firestore && studentId ? query(collection(firestore, 'enrollments'), where('studentId', '==', studentId)) : null),
    [firestore, studentId]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  const classroomId = useMemo(() => enrollments?.[0]?.classroomId, [enrollments]);

  const classroomRef = useMemoFirebase(
    () => (firestore && classroomId ? doc(firestore, 'classrooms', classroomId) : null),
    [firestore, classroomId]
  );
  const { data: classroom, isLoading: classroomLoading } = useDoc<Classroom>(classroomRef);

  const teacherId = useMemo(() => classroom?.teacherId, [classroom]);

  const teacherRef = useMemoFirebase(
    () => (firestore && teacherId ? doc(firestore, 'users', teacherId) : null),
    [firestore, teacherId]
  );
  // Fetch teacher separately to not block main loading state
  const { data: teacher } = useDoc<User>(teacherRef);
  
  
  const isLoading = studentLoading || classroomLoading || enrollmentsLoading;
  
  const exportA4PDF = async () => {
    const node = resultSheetRef.current;
    if (!node || !student) {
        toast({
            variant: "destructive",
            title: "Export Error",
            description: "Could not find the result sheet content to export.",
        });
        return;
    }

    setIsExporting(true);
    toast({
        title: "Generating PDF...",
        description: "Please wait while the report card is being created.",
    });

    try {
        // Convert HTML to image
        const dataUrl = await htmlToImage.toPng(node, { quality: 1.0, pixelRatio: 2 });

        // Create PDF
        const pdf = new jsPDF("p", "mm", "a4");

        // Get image properties
        const img = new Image();
        img.src = dataUrl;

        img.onload = () => {
            const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
            const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm

            const imgWidth = img.width;
            const imgHeight = img.height;

            // Scale image to fit A4 page while maintaining aspect ratio
            const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);

            const renderWidth = imgWidth * ratio;
            const renderHeight = imgHeight * ratio;

            // Center image on the page
            const x = (pageWidth - renderWidth) / 2;
            const y = (pageHeight - renderHeight) / 2;

            pdf.addImage(dataUrl, "PNG", x, y, renderWidth, renderHeight, undefined, "FAST");
            pdf.save(`${student.name.replace(/ /g, '_')}_Report.pdf`);
            
            toast({
                title: "Download Started",
                description: "Your PDF has been successfully generated.",
            });
        };
        img.onerror = () => {
            throw new Error("Failed to load the generated image for PDF creation.");
        }
    } catch (error: any) {
        console.error("PDF Export Error:", error);
        toast({
            variant: "destructive",
            title: "Export Failed",
            description: error.message || "An unexpected error occurred during PDF generation.",
        });
    } finally {
        setIsExporting(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!student || !classroom) {
    return (
        <div className="flex h-screen items-center justify-center bg-muted">
            <Card className="m-4">
                <CardContent className="p-8">
                     <h2 className="text-xl font-semibold text-destructive">Error Loading Report</h2>
                     <p className="text-muted-foreground mt-2">Could not find the required student or classroom data.</p>
                     <Button onClick={() => router.back()} className="mt-6">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                     </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="bg-muted min-h-screen py-4 sm:py-8 px-2 sm:px-4 no-print">
      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center">
        <Button onClick={() => router.back()} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={exportA4PDF} disabled={isLoading || isExporting}>
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
          Export PDF
        </Button>
      </div>
      <div className="max-w-4xl mx-auto space-y-4">
         <ResultSheet ref={resultSheetRef} student={student} classroom={classroom} teacherName={teacher?.name} />
      </div>
    </div>
  );
}
