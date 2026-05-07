
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
import { PlusCircle, Edit, Trash2, Loader2, KeyRound, ArrowLeft, MoreVertical } from 'lucide-react';
import {
  useCollection,
} from '@/firebase/firestore/use-collection';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useAuth, useUser, useFirestore, useMemoFirebase } from '@/firebase/provider';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('Teacher');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const firestore = useFirestore();
  const auth = useAuth();
  const { user: currentUser } = useUser();
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

  const handleAddStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    if (!firestore) { setIsSubmitting(false); return; }

    const formData = new FormData(event.currentTarget);
    const userId = formData.get('userId') as string;
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const role = formData.get('role') as any;
    const assignedClassroomId = formData.get('assignedClassroomId') as string | undefined;

    try {
      const userDocRef = doc(firestore, 'users', userId);
      await setDocumentNonBlocking(userDocRef, {
          name, email, role, id: userId,
          assignedClassroomId: role === 'Teacher' ? assignedClassroomId : undefined,
      }, {merge: false});

      if (role === 'Teacher' && assignedClassroomId) {
        const classroomDocRef = doc(firestore, 'classrooms', assignedClassroomId);
        setDocumentNonBlocking(classroomDocRef, { teacherId: userId, teacherName: name }, { merge: true });
      }

      toast({ title: 'Staff Added', description: `${name} has been added.` });
      setAddDialogOpen(false);
      event.currentTarget.reset();
    } catch (error: any) { toast({ variant: 'destructive', title: 'Error', description: error.message }); } finally { setIsSubmitting(false); }
  };

  const handleUpdateStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !editingUser) return;
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const role = formData.get('role') as any;
    const name = formData.get('name') as string;
    const assignedClassroomId = formData.get('assignedClassroomId') as string | undefined;

    const userDocRef = doc(firestore, 'users', editingUser.id);
    const updatedData: Partial<User> = {
        name, role,
        assignedClassroomId: role === 'Teacher' && assignedClassroomId !== 'unassigned' ? assignedClassroomId : undefined,
    };
    
    setDocumentNonBlocking(userDocRef, updatedData, { merge: true });
    toast({ title: 'Staff Updated', description: `${name} has been updated.` });
    setEditDialogOpen(false);
    setIsSubmitting(false);
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
                    <div className="space-y-2"><Label>User ID</Label><Input name="userId" placeholder="Firebase UID" required /></div>
                    <div className="space-y-2"><Label>Full Name</Label><Input name="name" placeholder="Jane Doe" required /></div>
                    <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" placeholder="staff@example.com" required /></div>
                    <div className="space-y-2"><Label>Role</Label>
                        <Select name="role" defaultValue="Teacher" onValueChange={setSelectedRole}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Teacher">Teacher</SelectItem>
                                <SelectItem value="Admin">Admin (Ledger/Students)</SelectItem>
                                <SelectItem value="SuperAdmin">SuperAdmin (Master)</SelectItem>
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
                        <SelectItem value="SuperAdmin">SuperAdmin</SelectItem>
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
                            <DropdownMenuItem onClick={() => { setEditingUser(user); setEditDialogOpen(true); }} className="cursor-pointer"><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
