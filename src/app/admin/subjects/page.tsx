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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { subjects as initialSubjects, Subject, classrooms } from '@/lib/data';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

// In a real app, this would be part of the subject data model
const subjectAssignments: { [subjectId: string]: string[] } = {
  s1: ['c1', 'c2', 'c3', 'c4'],
  s2: ['c1', 'c2', 'c3', 'c4'],
  s3: ['c1', 'c2'],
  s4: ['c3', 'c4'],
  s5: ['c3', 'c4'],
  s6: ['c1', 'c2', 'c3', 'c4'],
};

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [open, setOpen] = useState(false);

  const handleAddSubject = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newSubject: Subject = {
      id: `s${subjects.length + 1}`,
      name: formData.get('name') as string,
    };
    setSubjects([...subjects, newSubject]);
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Subject</DialogTitle>
              <DialogDescription>
                Enter the details for the new subject and assign it to classes.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSubject} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Creative Arts"
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Classes</Label>
                <div className="col-span-3 space-y-2">
                  {classrooms.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox id={`class-${c.id}`} />
                      <Label htmlFor={`class-${c.id}`}>{c.name}</Label>
                    </div>
                  ))}
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
              {subjects.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(subjectAssignments[subject.id] || []).map((classId) => {
                        const classroom = classrooms.find(c => c.id === classId);
                        return classroom ? <Badge key={classId} variant="secondary">{classroom.name}</Badge> : null;
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
