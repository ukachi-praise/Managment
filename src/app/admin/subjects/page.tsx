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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, BookUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  useCollection,
  useFirestore,
  addDocumentNonBlocking,
  setDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type Subject = {
  id: string;
  name: string;
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

export default function SubjectsPage() {
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectToAssign, setSubjectToAssign] = useState<Subject | null>(null);
  
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

  // --- Data Mapping ---
  const classroomMap = useMemo(
    () => classrooms?.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>) || {},
    [classrooms]
  );

  const subjectAssignmentMap = useMemo(() => {
    const map: Record<string, { classroomId: string, assignmentId: string }[]> = {};
    if (!subjects || !classroomSubjects) return map;

    subjects.forEach(s => {
      map[s.id] = [];
    });

    classroomSubjects.forEach(cs => {
      if (map[cs.subjectId]) {
        map[cs.subjectId].push({ classroomId: cs.classroomId, assignmentId: cs.id });
      }
    });

    return map;
  }, [subjects, classroomSubjects]);

  // --- Dialog and Form Handling ---
  const handleOpenSubjectDialog = (subject: Subject | null = null) => {
    setEditingSubject(subject);
    setSubjectDialogOpen(true);
  };
  
  const handleCloseSubjectDialog = () => {
    setSubjectDialogOpen(false);
    setEditingSubject(null);
  };

  const handleOpenAssignDialog = (subject: Subject) => {
    setSubjectToAssign(subject);
    setAssignDialogOpen(true);
  };
  
  const handleCloseAssignDialog = () => {
    setAssignDialogOpen(false);
    setSubjectToAssign(null);
  };

  const handleSubjectSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const subjectName = formData.get('name') as string;

    if (editingSubject) {
      const subjectRef = doc(firestore, 'subjects', editingSubject.id);
      setDocumentNonBlocking(subjectRef, { name: subjectName }, { merge: true });
      toast({ title: "Subject Updated", description: `"${subjectName}" has been updated.`});
    } else {
      addDocumentNonBlocking(collection(firestore, 'subjects'), { name: subjectName });
      toast({ title: "Subject Added", description: `"${subjectName}" has been created.`});
    }
    
    handleCloseSubjectDialog();
  };
  
  const handleAssignSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(!firestore || !subjectToAssign) return;

    const formData = new FormData(event.currentTarget);
    const classroomId = formData.get('classroomId') as string;

    if (!classroomId) {
        toast({ variant: 'destructive', title: "Assignment Failed", description: "Please select a class."});
        return;
    }

    const alreadyAssigned = subjectAssignmentMap[subjectToAssign.id]?.some(a => a.classroomId === classroomId);
    if(alreadyAssigned) {
         toast({ variant: 'destructive', title: "Already Assigned", description: `This subject is already assigned to ${classroomMap[classroomId]}.`});
        return;
    }

    addDocumentNonBlocking(collection(firestore, 'classroomSubjects'), { subjectId: subjectToAssign.id, classroomId: classroomId });
    toast({ title: "Subject Assigned", description: `${subjectToAssign.name} assigned to ${classroomMap[classroomId]}.`});
    handleCloseAssignDialog();
  };

  const handleDeleteSubject = (subjectId: string) => {
    if(!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'subjects', subjectId));
    
    // Also delete all assignments for this subject
    const assignmentsToDelete = classroomSubjects?.filter(cs => cs.subjectId === subjectId) || [];
    assignmentsToDelete.forEach(cs => {
        deleteDocumentNonBlocking(doc(firestore, 'classroomSubjects', cs.id));
    });
    toast({ variant: 'destructive', title: "Subject Deleted"});
  };

  const handleUnassignSubject = (assignmentId: string) => {
     if(!firestore) return;
     deleteDocumentNonBlocking(doc(firestore, 'classroomSubjects', assignmentId));
     toast({ variant: 'destructive', title: "Subject Unassigned"});
  }

  return (
    <div className="space-y-6">
      {/* Add/Edit Subject Dialog */}
      <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSubject ? 'Edit' : 'Add New'} Subject</DialogTitle>
              <DialogDescription>
                {editingSubject ? 'Update the subject name.' : 'Create a new subject that can be assigned to classes.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubjectSubmit} className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingSubject?.name || ''}
                  placeholder="e.g. Creative Arts"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseSubjectDialog}>Cancel</Button>
                <Button type="submit">Save Subject</Button>
              </DialogFooter>
            </form>
          </DialogContent>
      </Dialog>
      
      {/* Assign Subject Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-md">
             <DialogHeader>
                <DialogTitle>Assign Subject</DialogTitle>
                <DialogDescription>
                    Assign "{subjectToAssign?.name}" to a classroom.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignSubmit} className="grid gap-4 py-4">
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
                            classrooms?.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                {c.name}
                                </SelectItem>
                            ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
                 <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCloseAssignDialog}>Cancel</Button>
                    <Button type="submit">Assign to Class</Button>
                </DialogFooter>
            </form>
          </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
        <Button onClick={() => handleOpenSubjectDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Subject
        </Button>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>All Subjects</CardTitle>
            <CardDescription>A list of all subjects offered in the school and their class assignments.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
            ) : (subjects && subjects.length > 0) ? (
                <Accordion type="single" collapsible className="w-full">
                {subjects.map(subject => (
                    <AccordionItem value={subject.id} key={subject.id}>
                        <AccordionTrigger className="font-medium text-base px-4">
                            {subject.name}
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pt-2 pb-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold">Assigned Classes:</h4>
                                 <div className="flex items-center gap-2">
                                     <Button size="sm" variant="outline" onClick={() => handleOpenAssignDialog(subject)}>
                                        <BookUp className="mr-2 h-4 w-4" />
                                        Assign to Class
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleOpenSubjectDialog(subject)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Edit Name
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleDeleteSubject(subject.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Subject
                                    </Button>
                                 </div>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center min-h-[30px]">
                                {subjectAssignmentMap[subject.id]?.length > 0 ? (
                                    subjectAssignmentMap[subject.id].map(({ classroomId, assignmentId }) => (
                                        <Badge key={assignmentId} variant="secondary" className="pl-3 pr-1 text-sm">
                                            {classroomMap[classroomId]}
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="ml-1 h-5 w-5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                                                onClick={() => handleUnassignSubject(assignmentId)}
                                            >
                                                <Trash2 className="h-3 w-3"/>
                                            </Button>
                                        </Badge>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground">Not assigned to any classes yet.</p>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
                </Accordion>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <p>No subjects found.</p>
                    <p>Click "Add Subject" to get started.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
