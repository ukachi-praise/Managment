'use client';

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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Eye, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

type Student = {
  id: string;
  name: string;
  // TODO: Add classroom and avatar info based on enrollment and image storage
};

export default function StudentsPage() {
  const firestore = useFirestore();
  
  const studentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'students')) : null),
    [firestore]
  );

  const { data: students, isLoading } = useCollection<Student>(studentsQuery);
  
  // TODO: Fetch classrooms to display names instead of IDs.
  // const { data: classrooms } = useCollection(collection(firestore, 'classrooms'));

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
           <Button disabled>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Student
            </Button>
       </div>
      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
          <CardDescription>
            A list of all students enrolled in the school.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-5 w-32" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right">
                       <Skeleton className="h-9 w-32" />
                    </TableCell>
                  </TableRow>
                ))
              ) : students && students.length > 0 ? (
                students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {/* Placeholder until avatar logic is implemented */}
                          <AvatarFallback>
                            {student.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{student.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {/* Placeholder until enrollment is implemented */}
                      <Badge variant="outline">N/A</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/students/${student.id}/results`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Results
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">No students found.</TableCell>
                 </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
