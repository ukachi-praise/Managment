'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Users, Presentation, BookCopy, Loader2, TrendingUp, GraduationCap, ShieldCheck, Wallet } from 'lucide-react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase, useFirestore, useUser as useAppUser } from '@/firebase/provider';
import { collection, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

function StatCard({ title, value, icon: Icon, note, isLoading, colorClass }: { title: string, value: number | string, icon: React.ElementType, note: string, isLoading: boolean, colorClass: string }) {
  return (
    <Card className="overflow-hidden border-none shadow-md transition-all hover:shadow-lg">
      <div className={`h-1 w-full ${colorClass}`} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`rounded-full p-2 ${colorClass.replace('bg-', 'bg-opacity-10 text-')}`}>
           <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <>
            <div className="text-3xl font-bold tracking-tight">{value}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                {note}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const firestore = useFirestore();
  const { user } = useAppUser();

  const studentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'students')) : null),
    [firestore]
  );
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classrooms')) : null),
    [firestore]
  );
  const subjectsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'subjects')) : null),
    [firestore]
  );
  const usersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users')) : null),
    [firestore]
  );

  const { data: students, isLoading: studentsLoading } = useCollection(studentsQuery);
  const { data: classrooms, isLoading: classroomsLoading } = useCollection(classroomsQuery);
  const { data: subjects, isLoading: subjectsLoading } = useCollection(subjectsQuery);
  const { data: users, isLoading: usersLoading } = useCollection(usersQuery);

  const totalStudents = students?.filter((s: any) => !s.isDeleted).length ?? 0;
  const totalClasses = classrooms?.length ?? 0;
  const totalSubjects = subjects?.length ?? 0;
  const totalTeachers = users?.filter((u: any) => u.role === 'Teacher').length ?? 0;
  
  const isLoading = studentsLoading || classroomsLoading || subjectsLoading || usersLoading;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Admin Overview
        </h1>
        <p className="text-muted-foreground">Welcome to the JustVision Management System. Here is your school's current status.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Students"
          value={totalStudents}
          icon={Users}
          note="Active enrollments"
          isLoading={isLoading}
          colorClass="bg-blue-500"
        />
        <StatCard 
          title="Total Classes"
          value={totalClasses}
          icon={GraduationCap}
          note="Nursery & Primary"
          isLoading={isLoading}
          colorClass="bg-purple-500"
        />
        <StatCard 
          title="Curriculum"
          value={totalSubjects}
          icon={BookCopy}
          note="Assigned subjects"
          isLoading={isLoading}
          colorClass="bg-orange-500"
        />
        <StatCard 
          title="Teaching Staff"
          value={totalTeachers}
          icon={Presentation}
          note="Active teachers"
          isLoading={isLoading}
          colorClass="bg-green-500"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
            <CardHeader>
                <CardTitle>School Pulse</CardTitle>
                <CardDescription>Recent updates and notifications will appear here.</CardDescription>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center border-t border-dashed">
                <div className="text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 opacity-20" />
                    <p>Live activity monitoring coming soon.</p>
                </div>
            </CardContent>
        </Card>

        <Card className="lg:col-span-3">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    Bursary Status
                </CardTitle>
                <CardDescription>Quick view of current term payments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Pending Payments</span>
                    <span className="font-bold text-destructive">Checking...</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Full Paid Pupils</span>
                    <span className="font-bold text-green-600">Calculating...</span>
                </div>
                <p className="text-xs italic text-muted-foreground text-center pt-2 border-t">
                    Use the Ledger for detailed financial reports.
                </p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
