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

  const classroomMap = useMemo(
    () => classrooms?.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>) || {},
    [classrooms]
  );

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
        updateDocumentNonBlocking(subjectRef, { name: subjectName });
      }
    } else {
      // Add new subject
      const newSubjectRef = await addDocumentNonBlocking(collection(firestore, 'subjects'), { name: subjectName });
      subjectId = newSubjectRef.id;
    }

    // Now handle assignments
    // This is a simplified approach. A more robust solution would use batched writes.
    const existingAssignments = classroomSubjects?.filter(cs => cs.subjectId === subjectId) || [];

    // Delete assignments that are no longer selected
    existingAssignments.forEach(cs => {
      if (!selectedClasses[cs.classroomId]) {
        deleteDocumentNonBlocking(doc(firestore, 'classroomSubjects', cs.id));
      }
    });

    // Add new assignments
    for (const classroomId in selectedClasses) {
      if (selectedClasses[classroomId] && !existingAssignments.some(cs => cs.classroomId === classroomId)) {
        addDocumentNonBlocking(collection(firestore, 'classroomSubjects'), { subjectId, classroomId });
      }
    }
    
    handleCloseDialog();
  };

  const handleDelete = (subjectId: string) => {
    if(!firestore) return;
    // This is a simplified delete. In a real app, you might want to confirm this action.
    deleteDocumentNonBlocking(doc(firestore, 'subjects', subjectId));

    // Also delete related assignments
    const assignmentsToDelete = classroomSubjects?.filter(cs => cs.subjectId === subjectId) || [];
    assignmentsToDelete.forEach(cs => {
        deleteDocumentNonBlocking(doc(firestore, 'classroomSubjects', cs.id));
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingSubject ? 'Edit' : 'Add New'} Subject</DialogTitle>
              <DialogDescription>
                Enter the details for the subject and assign it to classes.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingSubject?.name || ''}
                  placeholder="e.g. Creative Arts"
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Classes</Label>
                <div className="col-span-3 space-y-2">
                  {classroomsLoading ? (
                     <p>Loading classes...</p>
                  ) : (
                    classrooms?.map((c) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <Checkbox 
                          id={`class-${c.id}`} 
                          checked={selectedClasses[c.id] || false}
                          onCheckedChange={(checked) => handleCheckboxChange(c.id, checked)}
                        />
                        <Label htmlFor={`class-${c.id}`}>{c.name}</Label>
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

      <Card>
        <CardHeader>
          <CardTitle>Existing Subjects</CardTitle>
          <CardDescription>A list of all subjects offered.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject Name</TableHead>
                <TableHead>Assigned Classes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : subjects && subjects.length > 0 ? (
                subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(subjectAssignments[subject.id] || []).map((classId) => (
                           <Badge key={classId} variant="secondary">{classroomMap[classId] || '...'}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(subject)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(subject.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">No subjects found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
