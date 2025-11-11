
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Users, Presentation, BookCopy } from 'lucide-react';
import { useCollection, useUser } from '@/firebase';
import { useMemoFirebase, useFirestore } from '@/firebase/provider';
import { collection, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

function StatCard({ title, value, icon: Icon, note, isLoading }: { title: string, value: number | string, icon: React.ElementType, note: string, isLoading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-3/4 mt-1" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{note}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const firestore = useFirestore();
  const { user } = useUser();

  const studentsQuery = useMemoFirebase(
    () => (firestore && user ? query(collection(firestore, 'students')) : null),
    [firestore, user]
  );
  const classroomsQuery = useMemoFirebase(
    () => (firestore && user ? query(collection(firestore, 'classrooms')) : null),
    [firestore, user]
  );
  const subjectsQuery = useMemoFirebase(
    () => (firestore && user ? query(collection(firestore, 'subjects')) : null),
    [firestore, user]
  );
  const usersQuery = useMemoFirebase(
    () => (firestore && user ? query(collection(firestore, 'users')) : null),
    [firestore, user]
  );

  const { data: students, isLoading: studentsLoading } = useCollection(studentsQuery);
  const { data: classrooms, isLoading: classroomsLoading } = useCollection(classroomsQuery);
  const { data: subjects, isLoading: subjectsLoading } = useCollection(subjectsQuery);
  const { data: users, isLoading: usersLoading } = useCollection(usersQuery);

  const totalStudents = students?.length ?? 0;
  const totalClasses = classrooms?.length ?? 0;
  const totalSubjects = subjects?.length ?? 0;
  // This is a simplification. A real app would filter for users with the 'teacher' role.
  const totalTeachers = users?.filter(u => u.role === 'Teacher').length ?? 0;
  
  const isLoading = studentsLoading || classroomsLoading || subjectsLoading || usersLoading;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Students"
          value={totalStudents}
          icon={Users}
          note="Across all classes"
          isLoading={isLoading}
        />
        <StatCard 
          title="Total Classes"
          value={totalClasses}
          icon={Presentation}
          note="Nursery and Primary sections"
          isLoading={isLoading}
        />
        <StatCard 
          title="Total Subjects"
          value={totalSubjects}
          icon={BookCopy}
          note="Offered in the school"
          isLoading={isLoading}
        />
        <StatCard 
          title="Total Teachers"
          value={totalTeachers}
          icon={Users}
          note="Active teaching staff"
          isLoading={isLoading}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Activity feed will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
