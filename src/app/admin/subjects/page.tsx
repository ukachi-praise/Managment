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
import { PlusCircle, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  useCollection,
  useFirestore,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { collection, query, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
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
  const [newSubjectDialogOpen, setNewSubjectDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [classToAssign, setClassToAssign] = useState<Classroom | null>(null);

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
  const subjectMap = useMemo(
    () => subjects?.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, Subject>) || {},
    [subjects]
  );

  const classSubjectMap = useMemo(() => {
    const map: Record<string, { subject: Subject; assignmentId: string }[]> = {};
    if (!classrooms || !classroomSubjects || !subjects) return map;

    classrooms.forEach(c => {
      map[c.id] = [];
    });

    classroomSubjects.forEach(cs => {
      if (map[cs.classroomId] && subjectMap[cs.subjectId]) {
        map[cs.classroomId].push({
          subject: subjectMap[cs.subjectId],
          assignmentId: cs.id,
        });
      }
    });

    return map;
  }, [classrooms, classroomSubjects, subjectMap, subjects]);


  // --- Dialog and Form Handling ---
  const handleOpenAssignDialog = (classroom: Classroom) => {
    setClassToAssign(classroom);
    setAssignDialogOpen(true);
  };
  
  const handleCloseAssignDialog = () => {
    setAssignDialogOpen(false);
    setClassToAssign(null);
  };

  const handleNewSubjectSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const subjectName = formData.get('name') as string;

    addDocumentNonBlocking(collection(firestore, 'subjects'), { name: subjectName });
    toast({ title: "Subject Added", description: `"${subjectName}" has been created.`});
    
    setNewSubjectDialogOpen(false);
    event.currentTarget.reset();
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

    const alreadyAssigned = classSubjectMap[classToAssign.id]?.some(cs => cs.subject.id === subjectId);
    if(alreadyAssigned) {
         toast({ variant: 'destructive', title: "Already Assigned", description: `This subject is already assigned to ${classToAssign.name}.`});
        return;
    }

    addDocumentNonBlocking(collection(firestore, 'classroomSubjects'), { subjectId: subjectId, classroomId: classToAssign.id });
    toast({ title: "Subject Assigned", description: `${subjectMap[subjectId].name} assigned to ${classToAssign.name}.`});
    handleCloseAssignDialog();
  };


  const handleUnassignSubject = (assignmentId: string) => {
     if(!firestore) return;
     deleteDocumentNonBlocking(doc(firestore, 'classroomSubjects', assignmentId));
     toast({ variant: 'destructive', title: "Subject Unassigned"});
  }

  return (
    <div className="space-y-6">
      {/* Create New Subject Dialog */}
      <Dialog open={newSubjectDialogOpen} onOpenChange={setNewSubjectDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Subject</DialogTitle>
              <DialogDescription>
                Create a new subject that can be assigned to classes.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleNewSubjectSubmit} className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Creative Arts"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewSubjectDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Create Subject</Button>
              </DialogFooter>
            </form>
          </DialogContent>
      </Dialog>
      
      {/* Assign Subject Dialog */}
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
                            subjects?.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                {s.name}
                                </SelectItem>
                            ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
                 <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCloseAssignDialog}>Cancel</Button>
                    <Button type="submit">Assign Subject</Button>
                </DialogFooter>
            </form>
          </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Subjects by Class</h1>
            <p className="text-muted-foreground">Manage which subjects are taught in each classroom.</p>
        </div>
        <Button onClick={() => setNewSubjectDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create New Subject
        </Button>
      </div>

        {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                     <Card key={i}>
                        <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
                        <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                     </Card>
                ))}
            </div>
        ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(classrooms || []).map(classroom => (
                <Card key={classroom.id}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <CardTitle className="text-xl">{classroom.name}</CardTitle>
                        <Button size="sm" onClick={() => handleOpenAssignDialog(classroom)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Subject
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm font-medium mb-2 text-muted-foreground">Assigned Subjects:</p>
                        <div className="flex flex-wrap gap-2 items-center min-h-[40px] p-2 border rounded-md bg-muted/50">
                                {classSubjectMap[classroom.id]?.length > 0 ? (
                                    classSubjectMap[classroom.id].map(({ subject, assignmentId }) => (
                                        <Badge key={assignmentId} variant="secondary" className="pl-3 pr-1 text-sm">
                                            {subject.name}
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
                                    <p className="text-xs text-muted-foreground italic">No subjects assigned yet.</p>
                                )}
                            </div>
                    </CardContent>
                </Card>
            ))}
            </div>
        )}
    </div>
  );
}
