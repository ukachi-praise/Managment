
'use client';

import { useState, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  useCollection,
} from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import {
  useFirestore,
  useMemoFirebase,
} from '@/firebase/provider';
import { collection, query, doc, serverTimestamp, writeBatch, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

type Classroom = {
  id: string;
  name: string;
};

type SchoolSettings = {
    admissionNumberPrefix?: string;
    totalPupilCapacity?: number;
}

type Enrollment = {
    id: string;
    classroomId: string;
    pupilId: string;
}

type Pupil = {
    id: string;
    isDeleted?: boolean;
}


export default function PupilsPage() {
  const [open, setOpen] = useState(false);
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  // --- Data Fetching ---
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classrooms')) : null),
    [firestore]
  );
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  
  const enrollmentsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'enrollments')) : null),
    [firestore]
  );
  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);
  
  const allPupilsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'pupils')) : null),
    [firestore]
  );
  const { data: allPupils, isLoading: pupilsLoading } = useCollection<Pupil>(allPupilsQuery);
  
  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: settings, isLoading: settingsLoading } = useDoc<SchoolSettings>(settingsRef);

  const pupilCounts = useMemo(() => {
    if (!enrollments || !allPupils) return {};
    
    // Create a set of active pupil IDs for quick lookup
    const activePupilIds = new Set(
      allPupils.filter(pupil => !pupil.isDeleted).map(pupil => pupil.id)
    );

    // Count enrollments only if the pupil is active
    return enrollments.reduce((acc, enrollment) => {
      if (activePupilIds.has(enrollment.pupilId)) {
        acc[enrollment.classroomId] = (acc[enrollment.classroomId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [enrollments, allPupils]);

  // --- Event Handlers ---
  const handleAddPupil = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;
    
    const form = event.currentTarget;
    const formData = new FormData(form);
    
    const pupilName = formData.get('name') as string;
    const classroomId = formData.get('classroomId') as string;
    const gender = formData.get('gender') as string;
    const dob = formData.get('dob') as string;
    const parentName = formData.get('parentName') as string;
    const contact = formData.get('contact') as string;

    if (!pupilName || !classroomId || !gender) {
        toast({variant: 'destructive', title: 'Missing fields', description: 'Please fill out all fields.'});
        return;
    };

    // Auto-generate admission number
    const allPupilsSnapshot = await getDocs(collection(firestore, 'pupils'));
    const prefix = settings?.admissionNumberPrefix || 'JKS';
    const capacity = settings?.totalPupilCapacity || 500;
    const padding = String(capacity).length;
    const nextPupilNumber = allPupilsSnapshot.size + 1;
    const admissionNumber = `${prefix}-${String(nextPupilNumber).padStart(padding, '0')}`;

    try {
        const batch = writeBatch(firestore);

        // 1. Create the pupil in the root /pupils collection
        const newPupilRef = doc(collection(firestore, 'pupils'));
        batch.set(newPupilRef, {
            name: pupilName,
            admissionNumber: admissionNumber,
            gender: gender,
            dob: dob,
            parentName: parentName,
            contact: contact,
            isDeleted: false,
        });

        // 2. Create an enrollment document in the root /enrollments collection
        const enrollmentRef = doc(collection(firestore, 'enrollments'));
        batch.set(enrollmentRef, {
            pupilId: newPupilRef.id,
            classroomId: classroomId,
            createdAt: serverTimestamp()
        });

        // 3. (FIX) Create a reference document in the classrooms/{id}/pupils subcollection
        const classPupilRef = doc(collection(firestore, 'classrooms', classroomId, 'pupils'), newPupilRef.id);
        batch.set(classPupilRef, {
            name: pupilName,
            pupilId: newPupilRef.id,
            createdAt: serverTimestamp()
        });


        await batch.commit();

        toast({ title: 'Pupil Added', description: `${pupilName} has been added to the class.` });
        form.reset();
        setOpen(false);

    } catch (error) {
        console.error("Error adding pupil:", error);
        toast({variant: 'destructive', title: 'Error', description: 'Could not add the pupil.'});
    }

  };
  
    const sortedClassrooms = useMemo(() => {
        if (!classrooms) return [];
        return [...classrooms].sort((a, b) => a.name.localeCompare(b.name));
    }, [classrooms]);

  const isLoading = classroomsLoading || settingsLoading || enrollmentsLoading || pupilsLoading;


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Pupils</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Pupil
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Add New Pupil</DialogTitle>
              <DialogDescription>
                Enter the pupil's details and assign them to a class. An admission number will be generated automatically.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddPupil} className="grid gap-4 py-4">
               <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Pupil Name</Label>
                  <Input id="name" name="name" placeholder="John Doe" required />
                </div>
                 <div className="space-y-2">
                   <Label htmlFor="classroomId">Classroom</Label>
                    <Select name="classroomId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a classroom" />
                      </SelectTrigger>
                      <SelectContent>
                        {classroomsLoading ? (
                          <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : (
                          sortedClassrooms?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                 </div>
                <div className="space-y-2">
                   <Label htmlFor="gender">Gender</Label>
                    <Select name="gender" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" name="dob" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentName">Parent / Guardian Name</Label>
                    <Input id="parentName" name="parentName" placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">Contact Number</Label>
                    <Input id="contact" name="contact" placeholder="08012345678" />
                  </div>
               </div>
              <DialogFooter className="mt-4">
                <Button type="submit">Save Pupil</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

        {isLoading ? (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
            </Card>
        ) : (
             <Card>
                <CardHeader>
                <CardTitle>Pupil List by Class</CardTitle>
                <CardDescription>
                    Select a class to view the pupils enrolled in it.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Class Name</TableHead>
                                <TableHead>Number of Pupils</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedClassrooms.length > 0 ? sortedClassrooms.map((classroom) => (
                                <TableRow key={classroom.id}>
                                    <TableCell className="font-medium">{classroom.name}</TableCell>
                                    <TableCell>{pupilCounts[classroom.id] || 0}</TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="outline" size="sm">
                                            <Link href={`/admin/students/${classroom.id}`}>
                                                View Pupils
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No classrooms found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
             </Card>
        )}
    </div>
  );
}

    