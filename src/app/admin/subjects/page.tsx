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
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [open, setOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<Record<string, boolean>>({});
  const firestore = useFirestore();

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
    const subjectsMap = useMemo(
    () => subjects?.reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>) || {},
    [subjects]
  );

  const classSubjectMap = useMemo(() => {
    const map: Record<string, Subject[]> = {};
    if (!classrooms || !subjects || !classroomSubjects) return map;

    classrooms.forEach(c => {
      map[c.id] = [];
    });

    classroomSubjects.forEach(cs => {
      const subject = subjects.find(s => s.id === cs.subjectId);
      if (subject && map[cs.classroomId]) {
        map[cs.classroomId].push(subject);
      }
    });

    return map;
  }, [classrooms, subjects, classroomSubjects]);

  const subjectAssignments = useMemo(() => {
    const assignments: Record<string, string[]> = {};
    if (!classroomSubjects) return assignments;

    for (const cs of classroomSubjects) {
      if (!assignments[cs.subjectId]) {
        assignments[cs.subjectId] = [];
      }
      assignments[cs.subjectId].push(cs.classroomId);
    }
    return assignments;
  }, [classroomSubjects]);


  // --- Dialog and Form Handling ---
  const handleOpenDialog = (subject: Subject | null = null) => {
    setEditingSubject(subject);
    if (subject) {
      const initialSelected: Record<string, boolean> = {};
      (subjectAssignments[subject.id] || []).forEach(classId => {
        initialSelected[classId] = true;
      });
      setSelectedClasses(initialSelected);
    } else {
      setSelectedClasses({});
    }
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setOpen(false);
    setEditingSubject(null);
    setSelectedClasses({});
  };

  const handleCheckboxChange = (classroomId: string, checked: boolean | 'indeterminate') => {
      setSelectedClasses(prev => ({ ...prev, [classroomId]: !!checked }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const subjectName = formData.get('name') as string;

    let subjectId: string;

    if (editingSubject) {
      // Update existing subject
      subjectId = editingSubject.id;
      if (editingSubject.name !== subjectName) {
        const subjectRef = doc(firestore, 'subjects', subjectId);
        await setDocumentNonBlocking(subjectRef, { name: subjectName }, { merge: true });
      }
    } else {
      // Add new subject
      const newSubjectRef = await addDocumentNonBlocking(collection(firestore, 'subjects'), { name: subjectName });
      subjectId = newSubjectRef.id;
    }

    // Now handle assignments
    const existingAssignments = classroomSubjects?.filter(cs => cs.subjectId === subjectId) || [];
    const existingAssignmentMap = existingAssignments.reduce((acc, cs) => ({ ...acc, [cs.classroomId]: cs.id }), {} as Record<string, string>);

    for (const classroomId in selectedClasses) {
        const isSelected = selectedClasses[classroomId];
        const hasExisting = !!existingAssignmentMap[classroomId];
        
        if (isSelected && !hasExisting) {
            // Add new assignment
            addDocumentNonBlocking(collection(firestore, 'classroomSubjects'), { subjectId, classroomId });
        } else if (!isSelected && hasExisting) {
            // Delete old assignment
            deleteDocumentNonBlocking(doc(firestore, 'classroomSubjects', existingAssignmentMap[classroomId]));
        }
    }
    
    // Also check for classes that were deselected but not in the initial loop (if they were not in selectedClasses at all)
    existingAssignments.forEach(cs => {
        if (!selectedClasses.hasOwnProperty(cs.classroomId)) {
             deleteDocumentNonBlocking(doc(firestore, 'classroomSubjects', cs.id));
        }
    });
    
    handleCloseDialog();
  };

  const handleDelete = (subjectId: string) => {
    if(!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'subjects', subjectId));

    const assignmentsToDelete = classroomSubjects?.filter(cs => cs.subjectId === subjectId) || [];
    assignmentsToDelete.forEach(cs => {
        deleteDocumentNonBlocking(doc(firestore, 'classroomSubjects', cs.id));
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
        <Dialog open={open} onOpenChange={handleCloseDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add/Edit Subject
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSubject ? 'Edit' : 'Add New'} Subject</DialogTitle>
              <DialogDescription>
                {editingSubject 
                    ? 'Update the subject name and its class assignments.' 
                    : 'Create a new subject and assign it to one or more classes.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Subject Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingSubject?.name || ''}
                  placeholder="e.g. Creative Arts"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Assign to Classes</Label>
                <div className="space-y-2 rounded-md border p-4 max-h-60 overflow-y-auto">
                  {classroomsLoading ? (
                     <p className="text-sm text-muted-foreground">Loading classes...</p>
                  ) : (
                    classrooms?.map((c) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <Checkbox 
                          id={`class-${c.id}`} 
                          checked={selectedClasses[c.id] || false}
                          onCheckedChange={(checked) => handleCheckboxChange(c.id, checked)}
                        />
                        <Label htmlFor={`class-${c.id}`} className="font-normal">{c.name}</Label>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Save Subject</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

        {isLoading ? (
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                 {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-5 w-2/3" />
                                <Skeleton className="h-5 w-1/2" />
                            </div>
                        </CardContent>
                    </Card>
                 ))}
            </div>
        ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(classrooms || []).map((classroom) => (
            <Card key={classroom.id}>
              <CardHeader>
                <CardTitle>{classroom.name}</CardTitle>
                <CardDescription>Subjects taught in this class.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(classSubjectMap[classroom.id] || []).length > 0 ? (
                    (classSubjectMap[classroom.id]).map((subject) => (
                      <div key={subject.id} className="flex items-center justify-between rounded-md border p-2">
                         <span className="font-medium text-sm">{subject.name}</span>
                         <div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(subject)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(subject.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                         </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No subjects assigned.</p>
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
