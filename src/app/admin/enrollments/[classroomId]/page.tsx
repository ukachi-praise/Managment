
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
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { collection, query, where, doc, getDocs, Timestamp } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import AuthGuard from '@/components/auth/AuthGuard';
import { useToast } from '@/hooks/use-toast';

type StudentInClass = { studentId: string; name: string; createdAt: Timestamp };
type Student = { id: string; name: string; isDeleted?: boolean; };
type Classroom = { id: string; name: string; teacherId?: string };

type CombinedEnrollment = {
    enrollmentId: string;
    studentName: string;
    enrollmentDate: string;
}

function EnrollmentPageContent() {
  const params = useParams();
  const router = useRouter();
  const classroomId = params.classroomId as string;
  const firestore = useFirestore();
  const { toast } = useToast();

  const [combinedData, setCombinedData] = useState<CombinedEnrollment[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);

  // --- Data Fetching ---
  const classroomRef = useMemoFirebase(
    () => (firestore && classroomId ? doc(firestore, 'classrooms', classroomId) : null),
    [firestore, classroomId]
  );
  const { data: classroom, isLoading: classroomLoading } = useDoc<Classroom>(classroomRef);

  // 1. Fetch the list of student references from the subcollection. This is efficient.
  const studentsInClassQuery = useMemoFirebase(
    () => classroomId && firestore ? query(collection(firestore, 'classrooms', classroomId, 'students')) : null,
    [classroomId, firestore]
  );
  const { data: studentsInClass, isLoading: enrollmentsLoading } = useCollection<StudentInClass>(studentsInClassQuery);

  
  // 2. Once we have the student references, fetch their full details in batches.
  useEffect(() => {
    const fetchStudentDetails = async () => {
      if (!firestore || !studentsInClass) {
        setCombinedData([]);
        setDetailsLoading(false);
        return;
      }
      
      if (studentsInClass.length === 0) {
        setCombinedData([]);
        setDetailsLoading(false);
        return;
      }

      setDetailsLoading(true);
      try {
        const studentIds = studentsInClass.map(e => e.studentId);
        
        const studentDetailsMap = new Map<string, Student>();
        // Batch fetch student details
        for (let i = 0; i < studentIds.length; i += 30) {
          const batch = studentIds.slice(i, i + 30);
          if (batch.length > 0) {
            const q = query(collection(firestore, 'students'), where('__name__', 'in', batch));
            const snapshot = await getDocs(q);
             snapshot.docs.forEach(doc => {
                studentDetailsMap.set(doc.id, { id: doc.id, ...doc.data() } as Student);
             });
          }
        }
        
        // Combine the data
        const combined = studentsInClass
            .map(enrollment => {
                const student = studentDetailsMap.get(enrollment.studentId);
                if (!student || student.isDeleted) return null;
                return {
                    enrollmentId: student.id, // Using studentId as key since enrollment doc isn't fetched
                    studentName: student.name,
                    enrollmentDate: enrollment.createdAt?.toDate ? format(enrollment.createdAt.toDate(), 'PPP') : 'N/A',
                };
            })
            .filter((item): item is CombinedEnrollment => item !== null);

        setCombinedData(combined);

      } catch (error) {
        console.error('Error fetching student details:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load student details.'
        });
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchStudentDetails();
  }, [firestore, studentsInClass, toast]);


  const isLoading = classroomLoading || enrollmentsLoading || detailsLoading;

  if (isLoading) {
      return (
        <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Enrollments for {classroom?.name}
          </h1>
          <p className="text-muted-foreground">
            A list of all students enrolled in this class.
          </p>
        </div>
        <Button onClick={() => router.push('/admin/classrooms')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Classrooms
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
          <CardDescription>
            {combinedData.length} student(s) enrolled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Enrollment Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedData.length > 0 ? (
                combinedData.map((item) => (
                  <TableRow key={item.enrollmentId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {item.studentName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{item.studentName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{item.enrollmentDate}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="h-24 text-center">
                    No students found for this class.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


export default function GuardedEnrollmentPage() {
    const params = useParams();
    const classroomId = params.classroomId as string;

    return (
        <AuthGuard allow={['Admin']} specificClassroomId={classroomId}>
            <EnrollmentPageContent />
        </AuthGuard>
    )
}
