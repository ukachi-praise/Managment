
'use client';

import { useState } from 'react';
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
import { PlusCircle, Edit, Trash2, Loader2, ArrowLeft, Users, MoreVertical } from 'lucide-react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { collection, query, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


type Classroom = {
  id: string;
  name: string;
  teacherName?: string;
  fees?: number;
};

export default function ClassroomsPage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
  const [classroomToDelete, setClassroomToDelete] = useState<Classroom | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const firestore = useFirestore();

  const classroomsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classrooms')) : null),
    [firestore]
  );
  
  const { data: classrooms, isLoading } = useCollection<Classroom>(classroomsQuery);

  const handleAddClassroom = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const newClassroom = {
      name: formData.get('name') as string,
      fees: Number(formData.get('fees')) || 0,
    };
    
    addDocumentNonBlocking(collection(firestore, 'classrooms'), newClassroom);
    toast({ title: "Classroom Added", description: `${newClassroom.name} has been created.` });
    setAddDialogOpen(false);
    event.currentTarget.reset();
  };

  const handleUpdateClassroom = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !editingClassroom) return;

    const formData = new FormData(event.currentTarget);
    const updatedData = { 
        name: formData.get('name') as string,
        fees: Number(formData.get('fees')) || 0
    };
    
    setDocumentNonBlocking(doc(firestore, 'classrooms', editingClassroom.id), updatedData, { merge: true });
    toast({ title: "Classroom Updated", description: `${updatedData.name} details have been changed.` });
    setEditDialogOpen(false);
    setEditingClassroom(null);
  }

  const handleDeleteClassroom = () => {
    if (!firestore || !classroomToDelete) return;
    deleteDocumentNonBlocking(doc(firestore, 'classrooms', classroomToDelete.id));
    toast({ variant: 'destructive', title: "Classroom Deleted", description: `${classroomToDelete.name} has been removed.` });
    setDeleteDialogOpen(false);
    setClassroomToDelete(null);
  }

  const openEditDialog = (classroom: Classroom) => {
    setEditingClassroom(classroom);
    setEditDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Classrooms</h1>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Classroom
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Classroom</DialogTitle>
              <DialogDescription>
                Enter the details and set the term fees for the new classroom.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddClassroom} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" placeholder="e.g. Primary 3" className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fees" className="text-right">Fees (₦)</Label>
                <Input id="fees" name="fees" type="number" placeholder="e.g. 85000" className="col-span-3" required />
              </div>
              <DialogFooter>
                <Button type="submit">Save Classroom</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Classroom</DialogTitle>
              <DialogDescription>Update the classroom name and fees.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateClassroom} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" defaultValue={editingClassroom?.name} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fees" className="text-right">Fees (₦)</Label>
                <Input id="fees" name="fees" type="number" defaultValue={editingClassroom?.fees} className="col-span-3" required />
              </div>
              <DialogFooter>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
      </Dialog>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete <span className="font-semibold">{classroomToDelete?.name}</span>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteClassroom} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>


      <Card>
        <CardHeader>
          <CardTitle>Existing Classrooms</CardTitle>
          <CardDescription>A list of all classrooms and their corresponding fees.</CardDescription>
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
                  <TableHead>Class Name</TableHead>
                  <TableHead>Fees (₦)</TableHead>
                  <TableHead>Class Teacher</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classrooms?.sort((a,b) => a.name.localeCompare(b.name)).map((classroom) => (
                    <TableRow key={classroom.id}>
                      <TableCell className="font-medium">{classroom.name}</TableCell>
                      <TableCell className="font-semibold">₦{(classroom.fees || 0).toLocaleString()}</TableCell>
                      <TableCell>{classroom.teacherName || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                         <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                               <Link href={`/admin/enrollments/${classroom.id}`} className="cursor-pointer">
                                    <Users className="mr-2 h-4 w-4" /> View Enrollments
                               </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(classroom)} className="cursor-pointer">
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
