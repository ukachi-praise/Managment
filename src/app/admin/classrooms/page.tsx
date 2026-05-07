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
import { PlusCircle, Edit, Trash2, Loader2, ArrowLeft, Users, MoreVertical, Presentation } from 'lucide-react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { collection, query, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';


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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Classrooms</h1>
                <p className="text-muted-foreground hidden sm:block">Manage school sections and tuition fees.</p>
            </div>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto shadow-md">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Classroom
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Classroom</DialogTitle>
              <DialogDescription>
                Create a new section and set its term fees.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddClassroom} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" placeholder="e.g. Nursery 1" className="col-span-3 h-11" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fees" className="text-right">Fees (₦)</Label>
                <Input id="fees" name="fees" type="number" placeholder="e.g. 50000" className="col-span-3 h-11" required />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-11">Create Classroom</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Classroom</DialogTitle>
              <DialogDescription>Update settings for {editingClassroom?.name}.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateClassroom} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" defaultValue={editingClassroom?.name} className="col-span-3 h-11" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fees" className="text-right">Fees (₦)</Label>
                <Input id="fees" name="fees" type="number" defaultValue={editingClassroom?.fees} className="col-span-3 h-11" required />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-11">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
      </Dialog>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently remove <span className="font-bold text-foreground">{classroomToDelete?.name}</span> from the system. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteClassroom} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirm Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>


      <Card className="shadow-lg border-none overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="flex items-center gap-2">
            <Presentation className="h-5 w-5 text-primary" />
            Class List
          </CardTitle>
          <CardDescription>A complete list of registered classrooms and assigned fees.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="pl-6">Class Name</TableHead>
                  <TableHead>Term Fees</TableHead>
                  <TableHead>Teacher Assigned</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classrooms?.sort((a,b) => a.name.localeCompare(b.name)).map((classroom) => (
                    <TableRow key={classroom.id} className="hover:bg-muted/20">
                      <TableCell className="font-bold pl-6 text-base">{classroom.name}</TableCell>
                      <TableCell>
                        <span className="font-black text-green-600">₦{(classroom.fees || 0).toLocaleString()}</span>
                      </TableCell>
                      <TableCell>
                        {classroom.teacherName ? (
                            <Badge variant="secondary" className="font-medium px-2 py-0.5">{classroom.teacherName}</Badge>
                        ) : (
                            <span className="text-muted-foreground text-xs italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                         <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 shadow-xl border-none p-1">
                            <DropdownMenuItem asChild>
                               <Link href={`/admin/enrollments/${classroom.id}`} className="cursor-pointer flex items-center p-2 rounded-sm hover:bg-muted">
                                    <Users className="mr-2 h-4 w-4 text-primary" /> Enrollments
                               </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(classroom)} className="cursor-pointer flex items-center p-2 rounded-sm hover:bg-muted">
                              <Edit className="mr-2 h-4 w-4 text-primary" /> Edit Class
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setClassroomToDelete(classroom); setDeleteDialogOpen(true); }} className="cursor-pointer flex items-center p-2 rounded-sm text-destructive hover:bg-destructive/10">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Class
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {classrooms?.length === 0 && (
                      <TableRow>
                          <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">No classrooms registered yet.</TableCell>
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
