
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
import { collection, query, where, doc, getDocs } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import AuthGuard from '@/components/auth/AuthGuard';
import { useToast } from '@/hooks/use-toast';

type Enrollment = { id: string; classroomId: string; studentId: string; createdAt: any };
type Student = { id: string; name: string; isDeleted?: boolean; };
type Classroom = { id: string; name: string; teacherId?: string };

function EnrollmentPageContent() {
  const params = useParams();
  const router = useRouter();
  const classroomId = params.classroomId as string;
  const firestore = useFirestore();
  const { toast } = useToast();

  const [studentDetails, setStudentDetails] = useState<Student[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);

  // --- Data Fetching ---
  const classroomRef = useMemoFirebase(
    () => (firestore && classroomId ? doc(firestore, 'classrooms', classroomId) : null),
    [firestore, classroomId]
  );
  const { data: classroom, isLoading: classroomLoading } = useDoc<Classroom>(classroomRef);

  const enrollmentsQuery = useMemoFirebase(
    () => classroomId && firestore ? query(collection(firestore, 'enrollments'), where('classroomId', '==', classroomId)) : null,
    [classroomId, firestore]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);

  
  useEffect(() => {
    const fetchStudentDetails = async () => {
      if (!firestore || !enrollments) {
        setStudentDetails([]);
        setDetailsLoading(false);
        return;
      }
      
      if (enrollments.length === 0) {
        setStudentDetails([]);
        setDetailsLoading(false);
        return;
      }

      setDetailsLoading(true);
      try {
        const studentIds = enrollments.map(e => e.studentId);
        
        const batches = [];
        for (let i = 0; i < studentIds.length; i += 30) {
          const batch = studentIds.slice(i, i + 30);
          if (batch.length > 0) {
            const q = query(collection(firestore, 'students'), where('__name__', 'in', batch));
            batches.push(getDocs(q));
          }
        }

        const results = await Promise.all(batches);
        const allStudents: Student[] = [];
        
        results.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            allStudents.push({ id: doc.id, ...doc.data() } as Student);
          });
        });

        setStudentDetails(allStudents);
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
  }, [firestore, enrollments, toast]);


  const combinedEnrollmentData = useMemo(() => {
    if (!enrollments || !studentDetails) return [];
    
    const detailsMap = new Map(studentDetails.map(s => [s.id, s]));
    
    return enrollments
      .map(enrollment => {
        const student = detailsMap.get(enrollment.studentId);
        if (!student || student.isDeleted) return null;
        return {
          enrollmentId: enrollment.id,
          studentName: student.name,
          enrollmentDate: enrollment.createdAt?.toDate ? format(enrollment.createdAt.toDate(), 'PPP') : 'N/A',
        };
      })
      .filter(item => item !== null);
  }, [enrollments, studentDetails]);


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
            {combinedEnrollmentData.length} student(s) enrolled.
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
              {combinedEnrollmentData.length > 0 ? (
                combinedEnrollmentData.map((item) => (
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
