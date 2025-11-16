
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
import { PlusCircle, Trash2, Loader2, Edit, X, ArrowLeft, MinusCircle } from 'lucide-react';
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
  useFirestore,
} from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, doc, getDocs, writeBatch, where, collectionGroup, FieldValue, updateDoc, deleteField } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

type Subject = {
  id: string;
  name: string;
  subSubjects?: string[];
};

type Classroom = {
  id: string;
  name: string;
};

type ClassroomSubject = {
  id: string;
  classroomId: string;
  subjectId: string;
};

export default function SubjectsClient() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  
  const [classToAssign, setClassToAssign] = useState<Classroom | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [subSubjectInputs, setSubSubjectInputs] = useState<string[]>(['']);
  const router = useRouter();


  const firestore = useFirestore();
  const { toast } = useToast();

  // --- Data Fetching ---
  const subjectsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'subjects')) : null),
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
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  const { data: classroomSubjects, isLoading: classroomSubjectsLoading } = useCollection<ClassroomSubject>(classroomSubjectsQuery);

  const isLoading = subjectsLoading || classroomsLoading || classroomSubjectsLoading;

  useEffect(() => {
    if (editingSubject) {
        setSubSubjectInputs(editingSubject.subSubjects || ['']);
    } else {
        setSubSubjectInputs(['']);
    }
  }, [editingSubject]);


  // --- Data Memoization ---
  const sortedSubjects = useMemo(() => {
    if (!subjects) return [];
    return [...subjects].sort((a, b) => a.name.localeCompare(b.name));
  }, [subjects]);

  const sortedClassrooms = useMemo(() => {
    if (!classrooms) return [];
    return [...classrooms].sort((a, b) => a.name.localeCompare(b.name));
  }, [classrooms]);

  const subjectMap = useMemo(
    () => subjects?.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, Subject>) || {},
    [subjects]
  );

  const classSubjectMap = useMemo(() => {
    const map: Record<string, { subjectId: string; name: string; assignmentId: string; subSubjects?: string[] }[]> = {};
    if (!classrooms || !classroomSubjects || !subjectMap) return map;

    classrooms.forEach(c => {
      map[c.id] = [];
    });

    classroomSubjects.forEach(cs => {
      const subject = subjectMap[cs.subjectId];
      if (map[cs.classroomId] && subject) {
        map[cs.classroomId].push({
          subjectId: cs.subjectId,
          name: subject.name,
          subSubjects: subject.subSubjects,
          assignmentId: cs.id,
        });
      }
    });

    return map;
  }, [classrooms, classroomSubjects, subjectMap]);


  // --- Dialog and Form Handling ---
  const handleSubjectSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const subjectName = formData.get('name') as string;
    const subSubjects = subSubjectInputs.map(input => input.trim()).filter(input => input !== '');

    const subjectData = { 
        name: subjectName, 
        subSubjects: subSubjects.length > 0 ? subSubjects : [],
    };

    if (editingSubject) {
      setDocumentNonBlocking(doc(firestore, 'subjects', editingSubject.id), subjectData, { merge: true });
      toast({ title: "Subject Updated", description: "The subject has been updated." });
    } else {
      addDocumentNonBlocking(collection(firestore, 'subjects'), subjectData);
      toast({ title: "Subject Added", description: `"${subjectName}" has been created.`});
    }

    setDialogOpen(false);
    setEditingSubject(null);
  };
  
  const handleDeleteSubject = async () => {
    if (!firestore || !subjectToDelete) return;

    const subjectIdToDelete = subjectToDelete.id;

    // Start a batch for atomic operations
    const batch = writeBatch(firestore);

    // 1. Delete the subject document itself
    const subjectRef = doc(firestore, 'subjects', subjectIdToDelete);
    batch.delete(subjectRef);

    // 2. Find and delete all assignments of this subject to classrooms
    const classroomSubjectsQuerySnapshot = await getDocs(
      query(collection(firestore, 'classroomSubjects'), where('subjectId', '==', subjectIdToDelete))
    );
    classroomSubjectsQuerySnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 3. Find all result documents across all students and remove the subject's score
    const allStudentResultsQuery = collectionGroup(firestore, 'results');
    const studentResultsSnapshot = await getDocs(allStudentResultsQuery);
    
    studentResultsSnapshot.forEach(resultDoc => {
        // Check if the score for the subject to be deleted exists in the document
        if (resultDoc.data().scores && resultDoc.data().scores[subjectIdToDelete]) {
            // Use update with deleteField to remove the map key
            batch.update(resultDoc.ref, {
                [`scores.${subjectIdToDelete}`]: deleteField()
            });
        }
    });


    try {
      await batch.commit();
      toast({ variant: 'destructive', title: 'Subject Deleted', description: `${subjectToDelete.name} and all associated scores have been removed.` });
    } catch (error) {
      console.error("Error deleting subject and its data:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the subject and its associated data.' });
    } finally {
        setDeleteDialogOpen(false);
        setSubjectToDelete(null);
    }
  };


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
    
    addDocumentNonBlocking(collection(firestore, 'classroomSubjects'), { 
        subjectId: subjectId, 
        classroomId: classToAssign.id,
    });
    const subject = subjectMap[subjectId];
    toast({ title: "Subject Assigned", description: `${subject.name} assigned to ${classToAssign.name}.`});
    setAssignDialogOpen(false);
  };

  const handleUnassignSubject = (assignmentId: string) => {
     if(!firestore) return;
     deleteDocumentNonBlocking(doc(firestore, 'classroomSubjects', assignmentId));
     toast({ variant: 'destructive', title: "Subject Unassigned"});
  }
  
  const openEditDialog = (subject: Subject) => {
    setEditingSubject(subject);
    setDialogOpen(true);
  }

  const openDeleteDialog = (subject: Subject) => {
    setSubjectToDelete(subject);
    setDeleteDialogOpen(true);
  }

  const openAddDialog = () => {
    setEditingSubject(null);
    setDialogOpen(true);
  }

  const handleSubSubjectChange = (index: number, value: string) => {
    const newInputs = [...subSubjectInputs];
    newInputs[index] = value;
    setSubSubjectInputs(newInputs);
  };

  const addSubSubjectInput = () => {
    setSubSubjectInputs([...subSubjectInputs, '']);
  };

  const removeSubSubjectInput = (index: number) => {
    const newInputs = subSubjectInputs.filter((_, i) => i !== index);
    setSubSubjectInputs(newInputs);
  };


  return (
    <div className="space-y-6">
      {/* Dialogs */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if(!open) setEditingSubject(null); }}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
              <DialogDescription>
                {editingSubject ? 'Update the subject details below.' : 'Add a new subject. You can add sub-subjects for display purposes on reports.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubjectSubmit} className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name</Label>
                <Input name="name" placeholder="e.g. B.S.T. (Basic Science & Tech)" defaultValue={editingSubject?.name} required />
              </div>
              
              <div className="space-y-3">
                <Label>Sub-Subjects (for display on reports)</Label>
                {subSubjectInputs.map((input, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <Input 
                            value={input}
                            onChange={(e) => handleSubSubjectChange(index, e.target.value)}
                            placeholder={`e.g. Basic Science`}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeSubSubjectInput(index)} disabled={subSubjectInputs.length === 1 && index === 0}>
                            <MinusCircle className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addSubSubjectInput}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Sub-subject
                </Button>
              </div>

              <DialogFooter className="mt-4">
                <Button type="submit">Save Subject</Button>
              </DialogFooter>
            </form>
          </DialogContent>
      </Dialog>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the subject <span className="font-semibold">{subjectToDelete?.name}</span> and all associated scores from every student's records.
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
                            {subjectsLoading ? (
                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : (
                            sortedSubjects.map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                {s.name}
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
      

      <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
                <p className="text-muted-foreground">Create, edit, and assign subjects to classrooms.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={openAddDialog}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Subject
            </Button>
          </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
            <Card className='md:col-span-2'>
                <CardHeader>
                <CardTitle>All Subjects</CardTitle>
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
                                    <TableHead>Sub-subjects</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedSubjects.length > 0 ? (
                                    sortedSubjects.map(subject => (
                                        <TableRow key={subject.id}>
                                            <TableCell className="font-medium">{subject.name}</TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {subject.subSubjects && subject.subSubjects.length > 0 
                                                    ? subject.subSubjects.join(', ') 
                                                    : 'N/A'}
                                            </TableCell>
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
                                        <TableCell colSpan={3} className="text-center h-24">
                                            No subjects created yet.
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
                                      classSubjectMap[classroom.id].map(({ name, assignmentId, subSubjects }) => (
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
