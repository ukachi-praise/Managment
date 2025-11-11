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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import {
  useCollection,
  useFirestore,
  useAuth,
  addDocumentNonBlocking,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createUserWithEmailAndPassword } from 'firebase/auth';

type User = {
  id: string;
  email: string;
  role: 'Admin' | 'Teacher';
  assignedClassroomId?: string;
};

type Classroom = {
  id: string;
  name: string;
};

export default function StaffPage() {
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('Teacher');
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  // --- Data Fetching ---
  const usersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users')) : null),
    [firestore]
  );
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classrooms')) : null),
    [firestore]
  );

  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);

  const isLoading = usersLoading || classroomsLoading;

  const classroomMap = useMemo(
    () =>
      classrooms?.reduce((acc, classroom) => {
        acc[classroom.id] = classroom.name;
        return acc;
      }, {} as Record<string, string>) || {},
    [classrooms]
  );

  const handleAddStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !auth) return;

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as 'Admin' | 'Teacher';
    const assignedClassroomId = formData.get('assignedClassroomId') as string | undefined;

    if (!email || !password || !role) {
        toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill in all required fields.' });
        return;
    }

    try {
        // 1. Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Add user document to Firestore
        const userDocData: Omit<User, 'id'> = {
            email,
            role,
            assignedClassroomId: role === 'Teacher' ? assignedClassroomId : undefined,
        };
        
        await addDocumentNonBlocking(collection(firestore, 'users'), userDocData);

        // 3. If teacher, update classroom with teacherId
        if (role === 'Teacher' && assignedClassroomId) {
            // This is a bit tricky with non-blocking. A better approach might be a cloud function.
            // For now, we assume this will mostly succeed.
            // setDocumentNonBlocking(doc(firestore, 'classrooms', assignedClassroomId), { teacherId: user.uid }, { merge: true });
        }

        toast({ title: 'Staff Added', description: `${email} has been added.` });
        setOpen(false);
        event.currentTarget.reset();

    } catch(error: any) {
        console.error("Error adding staff:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message || 'Failed to add new staff member.',
        });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
              <DialogDescription>
                Create a new user account and assign them a role.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddStaff} className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="staff@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="••••••••" required />
              </div>
               <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select name="role" required defaultValue={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Teacher">Teacher</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              {selectedRole === 'Teacher' && (
                <div className="space-y-2">
                    <Label htmlFor="assignedClassroomId">Assign to Classroom</Label>
                     <Select name="assignedClassroomId">
                        <SelectTrigger><SelectValue placeholder="Select a class (optional)" /></SelectTrigger>
                        <SelectContent>
                            {classroomsLoading ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : (
                                classrooms?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                            )}
                        </SelectContent>
                     </Select>
                </div>
              )}
              <DialogFooter className="mt-4">
                <Button type="submit">Create Staff</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff List</CardTitle>
          <CardDescription>
            A list of all staff members with access to the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned Class</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : users && users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell><Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>{user.role}</Badge></TableCell>
                    <TableCell>{user.role === 'Teacher' && user.assignedClassroomId ? classroomMap[user.assignedClassroomId] : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                 <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">No staff found.</TableCell>
                 </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}