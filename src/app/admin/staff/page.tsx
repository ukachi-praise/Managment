
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import {
  useCollection,
  useFirestore,
  setDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useAuth,
  useUser,
} from '@/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, doc, where, getDocs, writeBatch } from 'firebase/firestore';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('Teacher');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  // --- Data Fetching ---
  const usersQuery = useMemoFirebase(
    () => (firestore && user ? query(collection(firestore, 'users')) : null),
    [firestore, user]
  );
  const classroomsQuery = useMemoFirebase(
    () => (firestore && user ? query(collection(firestore, 'classrooms')) : null),
    [firestore, user]
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
  
  const handleOpenDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleOpenResetDialog = (user: User) => {
    setUserToReset(user);
    setResetDialogOpen(true);
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
          id: userId,
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
    
    const updatedData: Partial<User> = {
        name,
        role,
        assignedClassroomId: role === 'Teacher' && assignedClassroomId !== 'unassigned' ? assignedClassroomId : undefined,
    };
    
    setDocumentNonBlocking(userDocRef, updatedData, { merge: true });
    
    // Also update the classroom with the teacherId and teacherName if it has changed
    if (role === 'Teacher' && assignedClassroomId && assignedClassroomId !== 'unassigned') {
        const classroomDocRef = doc(firestore, 'classrooms', assignedClassroomId);
        setDocumentNonBlocking(classroomDocRef, { teacherId: editingUser.id, teacherName: name }, { merge: true });
    }

    toast({ title: 'Staff Updated', description: `${editingUser.name} has been updated.` });
    handleCloseEditDialog();
    setIsSubmitting(false);
  };
  
  const handleDeleteStaff = () => {
      if (!firestore || !userToDelete) return;
      
      deleteDocumentNonBlocking(doc(firestore, 'users', userToDelete.id));
      
      toast({
          variant: 'destructive',
          title: 'Staff Removed',
          description: `${userToDelete.name} has been removed from the staff list.`,
      });

      setDeleteDialogOpen(false);
      setUserToDelete(null);
  };

  const handlePasswordReset = async () => {
    if (!auth || !userToReset) return;

    try {
      await sendPasswordResetEmail(auth, userToReset.email);
      toast({
        title: 'Reset Email Sent',
        description: `A password reset link has been sent to ${userToReset.email}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Sending Email',
        description: error.message,
      });
    } finally {
      setResetDialogOpen(false);
      setUserToReset(null);
    }
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

        {/* Password Reset Dialog */}
        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will send a password reset link to <span className="font-semibold">{userToReset?.email}</span>.
                        The user will be able to set a new password by following the link.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePasswordReset}>Continue</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the staff member <span className="font-semibold">{userToDelete?.name}</span>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteStaff} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>


      <Card>
        <CardHeader>
          <CardTitle>Staff List</CardTitle>
          <CardDescription>
            A list of all staff members with access to the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned Class</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users && users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell><Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>{user.role}</Badge></TableCell>
                      <TableCell>{user.role === 'Teacher' && user.assignedClassroomId ? classroomMap[user.assignedClassroomId] || 'N/A' : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenResetDialog(user)}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleOpenDeleteDialog(user)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                   <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">No staff found.</TableCell>
                   </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    
    
    
