
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { PlusCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import {
  useCollection,
  useFirestore,
  setDocumentNonBlocking,
  deleteDocumentNonBlocking,
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

type User = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Teacher';
  assignedClassroomId?: string;
};

type Classroom = {
  id: string;
  name: string;
};

export default function StaffPage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('Teacher');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firestore = useFirestore();
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
  
  useEffect(() => {
    if (editingUser) {
        setSelectedRole(editingUser.role);
    }
  }, [editingUser]);


  const handleOpenEditDialog = (user: User) => {
    setEditingUser(user);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditingUser(null);
    setEditDialogOpen(false);
  };
  
  const handleAddStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Firebase not initialized.' });
        setIsSubmitting(false);
        return;
    }

    const formData = new FormData(event.currentTarget);
    const userId = formData.get('userId') as string;
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const role = formData.get('role') as 'Admin' | 'Teacher';
    const assignedClassroomId = formData.get('assignedClassroomId') as string | undefined;

    if (!userId || !email || !role || !name) {
        toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all required fields.' });
        setIsSubmitting(false);
        return;
    }

    try {
      const userDocRef = doc(firestore, 'users', userId);
      await setDocumentNonBlocking(userDocRef, {
          name,
          email,
          role,
          assignedClassroomId: role === 'Teacher' ? assignedClassroomId : undefined,
      }, {merge: false});

      toast({ title: 'Staff Added', description: `${name} has been added to the staff list.` });
      setAddDialogOpen(false);
      event.currentTarget.reset();

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error Adding Staff', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };


  const handleUpdateStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !editingUser) return;
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const role = formData.get('role') as 'Admin' | 'Teacher';
    const name = formData.get('name') as string;
    const assignedClassroomId = formData.get('assignedClassroomId') as string | undefined;

    const userDocRef = doc(firestore, 'users', editingUser.id);
    
    const updatedData = {
        name,
        role,
        assignedClassroomId: role === 'Teacher' && assignedClassroomId !== 'unassigned' ? assignedClassroomId : undefined,
    };
    
    setDocumentNonBlocking(userDocRef, updatedData, { merge: true });
    
    // Also update the classroom with the teacherId if it has changed
    if (role === 'Teacher' && assignedClassroomId && assignedClassroomId !== 'unassigned') {
        const classroomDocRef = doc(firestore, 'classrooms', assignedClassroomId);
        setDocumentNonBlocking(classroomDocRef, { teacherId: editingUser.id }, { merge: true });
    }

    toast({ title: 'Staff Updated', description: `${editingUser.email} has been updated.` });
    handleCloseEditDialog();
    setIsSubmitting(false);
  };
  
    const handleDeleteStaff = (user: User) => {
        if (!firestore) return;

        // Optionally, add a confirmation dialog here
        
        deleteDocumentNonBlocking(doc(firestore, 'users', user.id));
        
        toast({
            variant: 'destructive',
            title: 'Staff Removed',
            description: `${user.email} has been removed from the staff list.`,
        });
    };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Staff
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add New Staff</DialogTitle>
                    <DialogDescription>Add an existing Firebase user to the staff list by providing their User ID and Email.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddStaff} className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="userId">User ID</Label>
                        <Input name="userId" type="text" placeholder="Firebase User ID (uid)" required />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input name="name" type="text" placeholder="Jane Doe" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input name="email" type="email" placeholder="staff@example.com" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select name="role" required defaultValue="Teacher" onValueChange={setSelectedRole}>
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
                                <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
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
                        <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add Staff
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </div>

      {/* Edit Staff Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Staff Member</DialogTitle>
              <DialogDescription>
                Update the role and classroom assignment for {editingUser?.name}.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateStaff} className="grid gap-4 py-4">
               <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input name="name" type="text" defaultValue={editingUser?.name} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editingUser?.email} disabled />
              </div>
               <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select name="role" required defaultValue={editingUser?.role} onValueChange={setSelectedRole}>
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
                     <Select name="assignedClassroomId" defaultValue={editingUser?.assignedClassroomId}>
                        <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                        <SelectContent>
                             <SelectItem value="unassigned">Unassign</SelectItem>
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
                <Button type="button" variant="outline" onClick={handleCloseEditDialog}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

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
                <TableHead>Name</TableHead>
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
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell><Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>{user.role}</Badge></TableCell>
                    <TableCell>{user.role === 'Teacher' && user.assignedClassroomId ? classroomMap[user.assignedClassroomId] || 'N/A' : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteStaff(user)}>
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
