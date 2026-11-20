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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, MoreVertical, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useCollection,
} from '@/firebase/firestore/use-collection';
import { useAuth, useFirestore, useMemoFirebase } from '@/firebase/provider';
import { collection, query } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type User = {
  id: string;
  name: string;
  email: string;
  role: 'SuperAdmin' | 'Admin' | 'Teacher';
  assignedClassroomId?: string;
};

type Classroom = {
  id: string;
  name: string;
};

export default function StaffPage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('Teacher');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const usersQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'users')) : null), [firestore]);
  const classroomsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classrooms')) : null), [firestore]);

  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  
  const isLoading = usersLoading || classroomsLoading;

  const classroomMap = useMemo(() =>
      classrooms?.reduce((acc, classroom) => { acc[classroom.id] = classroom.name; return acc; }, {} as Record<string, string>) || {},
    [classrooms]
  );
  
  useEffect(() => { if (editingUser) setSelectedRole(editingUser.role); }, [editingUser]);

  const saveStaffProfile = async (payload: { uid: string; name?: string; role: 'Admin' | 'Teacher'; assignedClassroomId?: string }) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Your session expired. Sign in again.');
    const response = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || 'Unable to save the staff profile.');
  };

  const handleAddStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    if (!firestore) { setIsSubmitting(false); return; }

    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as 'Admin' | 'Teacher';
    const assignedClassroomId = formData.get('assignedClassroomId') as string | undefined;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Your session expired. Sign in again.');
      const response = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name, email, password, role, assignedClassroomId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Unable to create the staff account.');

      toast({ title: 'Staff created', description: `${name} can now sign in with ${email}.` });
      setAddDialogOpen(false);
      event.currentTarget.reset();
    } catch (error: any) { toast({ variant: 'destructive', title: 'Error', description: error.message }); } finally { setIsSubmitting(false); }
  };

  const deleteStaff = async () => {
    if (!staffToDelete) return;
    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Your session expired. Sign in again.');
      const response = await fetch('/api/admin/staff', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: staffToDelete.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Unable to delete the staff account.');
      toast({ title: 'Staff account permanently deleted', description: `${staffToDelete.name || staffToDelete.email} and their sign-in account were removed.` });
      setStaffToDelete(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Deletion failed', description: error instanceof Error ? error.message : 'Could not delete this staff account.' });
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

    try {
      await saveStaffProfile({ uid: editingUser.id, name, role, assignedClassroomId });
      toast({ title: 'Staff Updated', description: `${name} has been updated.` });
      setEditDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
        <Button onClick={() => setAddDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Staff
        </Button>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add New Staff</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddStaff} className="grid gap-4 py-4">
                    <div className="space-y-2"><Label>Full Name</Label><Input name="name" placeholder="Jane Doe" required /></div>
                    <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" placeholder="jane@example.com" required /></div>
                    <div className="space-y-2"><Label>Temporary Password</Label><Input name="password" type="password" minLength={6} required /><p className="text-xs text-muted-foreground">Give the staff member this password securely; they can change it after signing in.</p></div>
                    <div className="space-y-2"><Label>Role</Label>
                        <Select name="role" defaultValue="Teacher" onValueChange={setSelectedRole}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Teacher">Teacher</SelectItem>
                                <SelectItem value="Admin">Admin (Ledger/Students)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedRole === 'Teacher' && (
                        <div className="space-y-2">
                            <Label>Assign to Classroom</Label>
                            <Select name="assignedClassroomId">
                                <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                                <SelectContent>{classrooms?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                    <DialogFooter><Button type="submit" disabled={isSubmitting}>Add Staff</Button></DialogFooter>
                </form>
            </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Edit Staff Member</DialogTitle></DialogHeader>
            <form onSubmit={handleUpdateStaff} className="grid gap-4 py-4">
               <div className="space-y-2"><Label>Full Name</Label><Input name="name" defaultValue={editingUser?.name} required /></div>
               <div className="space-y-2"><Label>Role</Label>
                <Select name="role" defaultValue={editingUser?.role} onValueChange={setSelectedRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Teacher">Teacher</SelectItem>
                        <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              {selectedRole === 'Teacher' && (
                <div className="space-y-2"><Label>Assign to Classroom</Label>
                     <Select name="assignedClassroomId" defaultValue={editingUser?.assignedClassroomId}>
                        <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                        <SelectContent>
                             <SelectItem value="unassigned">Unassign</SelectItem>
                             {classrooms?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                     </Select>
                </div>
              )}
              <DialogFooter><Button type="submit" disabled={isSubmitting}>Save Changes</Button></DialogFooter>
            </form>
          </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
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
                {users?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell><Badge variant={user.role === 'SuperAdmin' ? 'default' : 'secondary'}>{user.role}</Badge></TableCell>
                      <TableCell>{user.role === 'Teacher' && user.assignedClassroomId ? classroomMap[user.assignedClassroomId] || 'N/A' : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.role !== 'SuperAdmin' && <>
                              <DropdownMenuItem onClick={() => { setEditingUser(user); setEditDialogOpen(true); }} className="cursor-pointer"><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setStaffToDelete(user)} className="cursor-pointer text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete permanently</DropdownMenuItem>
                            </>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
      <AlertDialog open={Boolean(staffToDelete)} onOpenChange={open => !open && !isSubmitting && setStaffToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this staff account?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes {staffToDelete?.name || staffToDelete?.email} from Firebase Authentication and removes their user profile and classroom assignment. Student, result, and other school records are kept. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteStaff} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
