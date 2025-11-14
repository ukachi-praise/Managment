
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
import { PlusCircle, Trash2, Loader2, Edit, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCollection,
  useFirestore,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  setDocumentNonBlocking,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, doc } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MultiSelect } from '@/components/ui/multi-select';

type Subject = {
  id: string;
  name: string;
};

type CombinedSubject = {
  id: string;
  name: string;
  subjectIds: string[];
};

type Classroom = {
  id: string;
  name: string;
};

// Represents an assignment. The subjectId can be for a regular or combined subject.
type ClassroomSubject = {
  id: string;
  classroomId: string;
  subjectId: string;
  isCombined: boolean; // Flag to distinguish
};

export default function SubjectsPage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [combinedSubjectDialogOpen, setCombinedSubjectDialogOpen] = useState(false);
  
  const [classToAssign, setClassToAssign] = useState<Classroom | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  const [editingCombinedSubject, setEditingCombinedSubject] = useState<CombinedSubject | null>(null);
  const [combinedSubjectToDelete, setCombinedSubjectToDelete] = useState<CombinedSubject | null>(null);
  const [deleteCombinedDialogOpen, setDeleteCombinedDialogOpen] = useState(false);


  const firestore = useFirestore();
  const { toast } = useToast();

  // --- Data Fetching ---
  const subjectsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'subjects')) : null),
    [firestore]
  );
  const combinedSubjectsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'combinedSubjects')) : null),
    [firestore]
  );
  const classroomsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classrooms')) : null),
    [firestore]
  );
  const classroomSubjectsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'classroomSubjects')) : null),
    [firestore]
  );

  const { data: subjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQuery);
  const { data: combinedSubjects, isLoading: combinedSubjectsLoading } = useCollection<CombinedSubject>(combinedSubjectsQuery);
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  const { data: classroomSubjects, isLoading: classroomSubjectsLoading } = useCollection<ClassroomSubject>(classroomSubjectsQuery);

  const isLoading = subjectsLoading || classroomsLoading || classroomSubjectsLoading || combinedSubjectsLoading;

  // --- Data Memoization ---
  const sortedSubjects = useMemo(() => {
    if (!subjects) return [];
    return [...subjects].sort((a, b) => a.name.localeCompare(b.name));
  }, [subjects]);

  const sortedClassrooms = useMemo(() => {
    if (!classrooms) return [];
    return [...classrooms].sort((a, b) => a.name.localeCompare(b.name));
  }, [classrooms]);

  // A map of all scoreable entities (individual and combined subjects)
  const allScoreableEntities = useMemo(() => {
    const all = new Map<string, {name: string, isCombined: boolean}>();
    subjects?.forEach(s => all.set(s.id, { name: s.name, isCombined: false }));
    combinedSubjects?.forEach(cs => all.set(cs.id, { name: cs.name, isCombined: true }));
    return all;
  }, [subjects, combinedSubjects]);

  const subjectMap = useMemo(
    () => subjects?.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, Subject>) || {},
    [subjects]
  );

  const classSubjectMap = useMemo(() => {
    const map: Record<string, { subjectId: string; name: string; assignmentId: string }[]> = {};
    if (!classrooms || !classroomSubjects || !allScoreableEntities) return map;

    classrooms.forEach(c => {
      map[c.id] = [];
    });

    classroomSubjects.forEach(cs => {
      if (map[cs.classroomId] && allScoreableEntities.has(cs.subjectId)) {
        map[cs.classroomId].push({
          subjectId: cs.subjectId,
          name: allScoreableEntities.get(cs.subjectId)!.name,
          assignmentId: cs.id,
        });
      }
    });

    return map;
  }, [classrooms, classroomSubjects, allScoreableEntities]);


  // --- Dialog and Form Handling ---
  const handleNewSubjectSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const subjectName = formData.get('name') as string;

    addDocumentNonBlocking(collection(firestore, 'subjects'), { name: subjectName });
    toast({ title: "Subject Added", description: `"${subjectName}" has been created.`});
    setAddDialogOpen(false);
    event.currentTarget.reset();
  };

  const handleEditSubjectSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !editingSubject) return;

    const formData = new FormData(event.currentTarget);
    const updatedName = formData.get('name') as string;

    setDocumentNonBlocking(doc(firestore, 'subjects', editingSubject.id), { name: updatedName }, { merge: true });
    toast({ title: "Subject Updated", description: "The subject name has been changed." });
    setEditDialogOpen(false);
    setEditingSubject(null);
  };
  
  const handleDeleteSubject = () => {
    if(!firestore || !subjectToDelete) return;
    deleteDocumentNonBlocking(doc(firestore, 'subjects', subjectToDelete.id));
    toast({ variant: 'destructive', title: 'Subject Deleted', description: `${subjectToDelete.name} has been removed.` });
    setDeleteDialogOpen(false);
    setSubjectToDelete(null);
  }

  const handleOpenAssignDialog = (classroom: Classroom) => {
    setClassToAssign(classroom);
    setAssignDialogOpen(true);
  };
  
  const handleAssignSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(!firestore || !classToAssign) return;

    const formData = new FormData(event.currentTarget);
    const subjectId = formData.get('subjectId') as string;

    if (!subjectId) {
        toast({ variant: 'destructive', title: "Assignment Failed", description: "Please select a subject."});
        return;
    }

    const alreadyAssigned = classSubjectMap[classToAssign.id]?.some(cs => cs.subjectId === subjectId);
    if(alreadyAssigned) {
         toast({ variant: 'destructive', title: "Already Assigned", description: `This subject is already assigned to ${classToAssign.name}.`});
        return;
    }
    
    const entity = allScoreableEntities.get(subjectId)!;

    addDocumentNonBlocking(collection(firestore, 'classroomSubjects'), { 
        subjectId: subjectId, 
        classroomId: classToAssign.id,
        isCombined: entity.isCombined,
    });
    toast({ title: "Subject Assigned", description: `${entity.name} assigned to ${classToAssign.name}.`});
    setAssignDialogOpen(false);
  };

  const handleUnassignSubject = (assignmentId: string) => {
     if(!firestore) return;
     deleteDocumentNonBlocking(doc(firestore, 'classroomSubjects', assignmentId));
     toast({ variant: 'destructive', title: "Subject Unassigned"});
  }
  
  const openEditDialog = (subject: Subject) => {
    setEditingSubject(subject);
    setEditDialogOpen(true);
  }

  const openDeleteDialog = (subject: Subject) => {
    setSubjectToDelete(subject);
    setDeleteDialogOpen(true);
  }

  const handleCombinedSubjectSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;
    const subjectIds = (formData.get('subjectIds') as string).split(',');

    if (!name || subjectIds.length < 2) {
      toast({ variant: 'destructive', title: "Invalid Input", description: "A combined subject must have a name and at least two subjects."});
      return;
    }
    
    const data = { name, subjectIds };

    if (editingCombinedSubject) {
      setDocumentNonBlocking(doc(firestore, 'combinedSubjects', editingCombinedSubject.id), data, { merge: true });
      toast({ title: "Combined Subject Updated" });
    } else {
      addDocumentNonBlocking(collection(firestore, 'combinedSubjects'), data);
      toast({ title: "Combined Subject Created" });
    }
    setCombinedSubjectDialogOpen(false);
    setEditingCombinedSubject(null);
  };

  const openCombinedSubjectDialog = (subject: CombinedSubject | null) => {
    setEditingCombinedSubject(subject);
    setCombinedSubjectDialogOpen(true);
  };

  const openDeleteCombinedDialog = (subject: CombinedSubject) => {
    setCombinedSubjectToDelete(subject);
    setDeleteCombinedDialogOpen(true);
  };

  const handleDeleteCombinedSubject = () => {
    if(!firestore || !combinedSubjectToDelete) return;
    deleteDocumentNonBlocking(doc(firestore, 'combinedSubjects', combinedSubjectToDelete.id));
    toast({ variant: 'destructive', title: 'Combined Subject Deleted' });
    setDeleteCombinedDialogOpen(false);
    setCombinedSubjectToDelete(null);
  };


  return (
    <div className="space-y-6">
      {/* Dialogs */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Subject</DialogTitle>
              <DialogDescription>
                Add a new subject to the list of available subjects.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleNewSubjectSubmit} className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name</Label>
                <Input name="name" placeholder="e.g. Creative Arts" required />
              </div>
              <DialogFooter>
                <Button type="submit">Save Subject</Button>
              </DialogFooter>
            </form>
          </DialogContent>
      </Dialog>
      
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Subject</DialogTitle>
              <DialogDescription>
                Update the subject name.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubjectSubmit} className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name</Label>
                <Input name="name" defaultValue={editingSubject?.name} required />
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
                    This action cannot be undone. This will permanently delete the subject <span className="font-semibold">{subjectToDelete?.name}</span> and unassign it from all classes.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSubject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-md">
             <DialogHeader>
                <DialogTitle>Assign Subject to {classToAssign?.name}</DialogTitle>
                <DialogDescription>
                    Select a subject from the list to assign it to this class.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignSubmit} className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="subjectId">Subject</Label>
                    <Select name="subjectId" required>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a subject to assign" />
                        </SelectTrigger>
                        <SelectContent>
                            {isLoading ? (
                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : (
                            Array.from(allScoreableEntities.entries()).map(([id, {name}]) => (
                                <SelectItem key={id} value={id}>
                                {name}
                                </SelectItem>
                            ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
                 <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Assign Subject</Button>
                </DialogFooter>
            </form>
          </DialogContent>
      </Dialog>
      
      {/* Combined Subject Dialogs */}
       <Dialog open={combinedSubjectDialogOpen} onOpenChange={setCombinedSubjectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCombinedSubject ? 'Edit' : 'Create'} Combined Subject</DialogTitle>
            <DialogDescription>
              Group multiple individual subjects into a single graded subject.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCombinedSubjectSubmit} className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Combined Subject Name</Label>
              <Input name="name" placeholder="e.g. Basic Science & Tech" defaultValue={editingCombinedSubject?.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subjectIds">Individual Subjects</Label>
              <MultiSelect
                name="subjectIds"
                options={sortedSubjects.map(s => ({ value: s.id, label: s.name }))}
                initialSelected={editingCombinedSubject?.subjectIds || []}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCombinedSubjectDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Combined Subject</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteCombinedDialogOpen} onOpenChange={setDeleteCombinedDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the combined subject <span className="font-semibold">{combinedSubjectToDelete?.name}</span>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteCombinedSubject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
            <p className="text-muted-foreground">Create, edit, and assign subjects to classrooms.</p>
          </div>
          <div className="flex gap-2">
             <Button onClick={() => openCombinedSubjectDialog(null)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Combine Subjects
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Subject
            </Button>
          </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                <CardTitle>All Individual Subjects</CardTitle>
                <CardDescription>
                    The master list of all subjects offered in the school.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Subject Name</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedSubjects.length > 0 ? (
                                    sortedSubjects.map(subject => (
                                        <TableRow key={subject.id}>
                                            <TableCell className="font-medium">{subject.name}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(subject)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDeleteDialog(subject)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center h-24">
                                            No subjects created yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                <CardTitle>Combined Subjects</CardTitle>
                <CardDescription>
                    Groups of subjects that are graded as a single entity.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    {combinedSubjectsLoading ? (
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Combined Name</TableHead>
                                    <TableHead>Includes</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {combinedSubjects && combinedSubjects.length > 0 ? (
                                    combinedSubjects.map(cs => (
                                        <TableRow key={cs.id}>
                                            <TableCell className="font-medium">{cs.name}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {cs.subjectIds.map(id => (
                                                        <Badge key={id} variant="secondary">{subjectMap[id]?.name || 'Unknown'}</Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => openCombinedSubjectDialog(cs)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDeleteCombinedDialog(cs)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24">
                                            No combined subjects created yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
      </div>


        {isLoading ? (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Subjects by Class</CardTitle>
              <CardDescription>Manage which subjects are taught in each classroom.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sortedClassrooms.map(classroom => (
                  <Card key={classroom.id} className="flex flex-col">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                          <CardTitle className="text-xl">{classroom.name}</CardTitle>
                          <Button size="sm" onClick={() => handleOpenAssignDialog(classroom)}>
                              <PlusCircle className="mr-2 h-4 w-4" />
                              Add Subject
                          </Button>
                      </CardHeader>
                      <CardContent className="flex-grow">
                          <p className="text-sm font-medium mb-2 text-muted-foreground">Assigned Subjects:</p>
                          <div className="flex flex-wrap gap-2 items-center min-h-[40px] p-2 border rounded-md bg-muted/50">
                                  {classSubjectMap[classroom.id]?.length > 0 ? (
                                      classSubjectMap[classroom.id].map(({ subjectId, name, assignmentId }) => (
                                          <Badge key={assignmentId} variant="secondary" className="pl-3 pr-1 text-sm">
                                              {name}
                                              <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className="ml-1 h-5 w-5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                                                  onClick={() => handleUnassignSubject(assignmentId)}
                                              >
                                                  <X className="h-3 w-3"/>
                                              </Button>
                                          </Badge>
                                      ))
                                  ) : (
                                      <p className="text-xs text-muted-foreground italic">No subjects assigned yet.</p>
                                  )}
                              </div>
                      </CardContent>
                  </Card>
              ))}
            </CardContent>
          </Card>
        )}
    </div>
  );
}
