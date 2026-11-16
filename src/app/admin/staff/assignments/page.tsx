'use client';

import { useMemo, useState } from 'react';
import { collection, doc, query, runTransaction, deleteField } from 'firebase/firestore';
import { ArrowLeft, Check, Loader2, UserCog, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type Staff = { id: string; name?: string; email?: string; role?: string; assignedClassroomId?: string };
type Classroom = { id: string; name: string; teacherId?: string; teacherName?: string };
type PendingAction = { type: 'assign' | 'remove'; staff: Staff; classroomId?: string; classroomName?: string; conflict?: string };

export default function StaffAssignmentsPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [saving, setSaving] = useState(false);
  const usersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]);
  const classroomsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'classrooms')) : null, [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<Staff>(usersQuery);
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  const staff = useMemo(() => [...(users || [])].filter(user => user.role === 'Teacher').sort((a, b) => (a.name || '').localeCompare(b.name || '')), [users]);
  const sortedClassrooms = useMemo(() => [...(classrooms || [])].sort((a, b) => a.name.localeCompare(b.name)), [classrooms]);
  const classroomMap = useMemo(() => new Map(sortedClassrooms.map(classroom => [classroom.id, classroom])), [sortedClassrooms]);
  const staffMap = useMemo(() => new Map(staff.map(user => [user.id, user])), [staff]);
  const assignments = sortedClassrooms.filter(classroom => classroom.teacherId || classroom.teacherName);

  const requestAssign = () => {
    const teacher = staffMap.get(selectedStaffId);
    const classroom = classroomMap.get(selectedClassroomId);
    if (!teacher || !classroom) { toast({ variant: 'destructive', title: 'Select both fields', description: 'Choose a teacher and an existing classroom.' }); return; }
    const currentClassroom = teacher.assignedClassroomId ? classroomMap.get(teacher.assignedClassroomId) : undefined;
    const occupant = classroom.teacherId && classroom.teacherId !== teacher.id ? staffMap.get(classroom.teacherId) : undefined;
    const conflict = occupant ? `${classroom.name} is currently assigned to ${occupant.name || occupant.email || classroom.teacherId}.` : currentClassroom && currentClassroom.id !== classroom.id ? `${teacher.name || teacher.email} is currently assigned to ${currentClassroom.name}.` : undefined;
    setPending({ type: 'assign', staff: teacher, classroomId: classroom.id, classroomName: classroom.name, conflict });
  };

  const requestRemove = (teacher: Staff) => {
    const classroom = teacher.assignedClassroomId ? classroomMap.get(teacher.assignedClassroomId) : undefined;
    setPending({ type: 'remove', staff: teacher, classroomId: classroom?.id, classroomName: classroom?.name });
  };

  const saveAssignment = async () => {
    if (!firestore || !pending) return;
    setSaving(true);
    try {
      await runTransaction(firestore, async transaction => {
        const teacherRef = doc(firestore, 'users', pending.staff.id);
        const teacherSnapshot = await transaction.get(teacherRef);
        if (!teacherSnapshot.exists() || teacherSnapshot.data().role !== 'Teacher') throw new Error('This user is no longer an eligible teacher.');
        const teacherData = teacherSnapshot.data();
        const oldClassroomId = teacherData.assignedClassroomId as string | undefined;
        if (pending.type === 'remove') {
          // Complete the read phase before starting the write phase.
          const oldRef = oldClassroomId ? doc(firestore, 'classrooms', oldClassroomId) : null;
          const oldSnapshot = oldRef ? await transaction.get(oldRef) : null;
          transaction.update(teacherRef, { assignedClassroomId: deleteField() });
          if (oldRef && oldSnapshot?.exists() && oldSnapshot.data().teacherId === pending.staff.id) transaction.update(oldRef, { teacherId: deleteField(), teacherName: deleteField() });
          return;
        }
        if (!pending.classroomId) throw new Error('Select an existing classroom.');
        const targetRef = doc(firestore, 'classrooms', pending.classroomId);
        const targetSnapshot = await transaction.get(targetRef);
        if (!targetSnapshot.exists()) throw new Error('The selected classroom no longer exists.');
        const targetData = targetSnapshot.data();
        const occupantId = targetData.teacherId as string | undefined;
        const oldRef = oldClassroomId && oldClassroomId !== pending.classroomId ? doc(firestore, 'classrooms', oldClassroomId) : null;
        const oldSnapshot = oldRef ? await transaction.get(oldRef) : null;
        const occupantRef = occupantId && occupantId !== pending.staff.id ? doc(firestore, 'users', occupantId) : null;
        const occupantSnapshot = occupantRef ? await transaction.get(occupantRef) : null;

        // All documents needed for validation have now been read. Writes begin below.
        if (occupantId && occupantId !== pending.staff.id) {
          if (occupantRef && occupantSnapshot?.exists() && occupantSnapshot.data().assignedClassroomId === pending.classroomId) transaction.update(occupantRef, { assignedClassroomId: deleteField() });
        }
        if (oldRef && oldSnapshot?.exists() && oldSnapshot.data().teacherId === pending.staff.id) transaction.update(oldRef, { teacherId: deleteField(), teacherName: deleteField() });
        transaction.update(teacherRef, { assignedClassroomId: pending.classroomId });
        transaction.update(targetRef, { teacherId: pending.staff.id, teacherName: teacherData.name || pending.staff.name || '' });
      });
      toast({ title: pending.type === 'remove' ? 'Assignment removed' : 'Assignment saved', description: pending.type === 'remove' ? `${pending.staff.name || pending.staff.email} is no longer assigned.` : `${pending.staff.name || pending.staff.email} is assigned to ${pending.classroomName}.` });
      setSelectedStaffId(''); setSelectedClassroomId(''); setPending(null);
    } catch (error) { toast({ variant: 'destructive', title: 'Assignment failed', description: error instanceof Error ? error.message : 'Could not save the assignment.' }); }
    finally { setSaving(false); }
  };

  const loading = usersLoading || classroomsLoading;
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex items-center gap-4"><Button onClick={() => router.back()} variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button><div><h1 className="text-3xl font-bold tracking-tight">Staff Assignment</h1><p className="text-muted-foreground">Assign eligible teachers to existing classrooms.</p></div></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" />Assign a teacher</CardTitle><CardDescription>Classroom IDs are managed internally; only existing classrooms can be selected.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><div className="space-y-2"><label className="text-sm font-medium">Teacher</label><Select value={selectedStaffId} onValueChange={setSelectedStaffId}><SelectTrigger><SelectValue placeholder={loading ? 'Loading…' : 'Select teacher'} /></SelectTrigger><SelectContent>{staff.map(user => <SelectItem key={user.id} value={user.id}>{user.name || user.email || user.id}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><label className="text-sm font-medium">Classroom</label><Select value={selectedClassroomId} onValueChange={setSelectedClassroomId}><SelectTrigger><SelectValue placeholder="Select classroom" /></SelectTrigger><SelectContent>{sortedClassrooms.map(classroom => <SelectItem key={classroom.id} value={classroom.id}>{classroom.name}</SelectItem>)}</SelectContent></Select></div><Button onClick={requestAssign} disabled={loading || saving}>Assign teacher</Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Current assignments</CardTitle><CardDescription>{assignments.length ? 'Each classroom has at most one assigned teacher.' : 'No classroom assignments exist yet.'}</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Teacher</TableHead><TableHead>Email</TableHead><TableHead>Classroom</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{assignments.map(classroom => { const teacher = classroom.teacherId ? staffMap.get(classroom.teacherId) : undefined; return <TableRow key={classroom.id}><TableCell className="font-medium">{teacher?.name || classroom.teacherName || 'Unknown teacher'}</TableCell><TableCell>{teacher?.email || '—'}</TableCell><TableCell>{classroom.name}</TableCell><TableCell><Badge variant="secondary"><Check className="mr-1 h-3 w-3" />Assigned</Badge></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => teacher && requestRemove(teacher)} disabled={!teacher}>Remove</Button></TableCell></TableRow>; })}</TableBody></Table></CardContent></Card>
    <AlertDialog open={Boolean(pending)} onOpenChange={open => !open && !saving && setPending(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pending?.type === 'remove' ? 'Remove classroom assignment?' : pending?.conflict ? 'Confirm assignment change' : 'Confirm classroom assignment'}</AlertDialogTitle><AlertDialogDescription>{pending?.type === 'remove' ? `${pending.staff.name || pending.staff.email} will be removed from ${pending.classroomName || 'their classroom'}. The staff account will remain active.` : pending?.conflict ? `${pending.conflict} Continuing will replace the existing association and clear the previous classroom assignment.` : `Assign ${pending?.staff.name || pending?.staff.email} to ${pending?.classroomName}?`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel><AlertDialogAction onClick={saveAssignment} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
