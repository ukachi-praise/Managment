
'use client';

import { useState, useMemo, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { collection, query, doc, getDocs, onSnapshot, setDoc, Timestamp, where } from 'firebase/firestore';
import { Search, PlusCircle, History, WalletCards, Loader2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type Student = { id: string; name: string; admissionNumber: string; isDeleted?: boolean; classroomId?: string };
type Classroom = { id: string; name: string; fees?: number };
type SchoolSettings = { currentSessionId: string; currentTermId: string };

type Installment = {
    amount: number;
    date: any;
    note: string;
};

type TermPayment = {
    id: string;
    studentId: string;
    sessionId: string;
    termId: string;
    expectedAmount: number;
    installments: Installment[];
    totalPaid: number;
};

export default function LedgerPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentHistoryStudent, setPaymentHistoryStudent] = useState<Student | null>(null);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Data Fetching ---
  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: settings } = useDoc<SchoolSettings>(settingsRef);

  const classroomsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classrooms')) : null), [firestore]);
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);

  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Record<string, TermPayment>>({});
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch Students and their Enrollments
  useEffect(() => {
    if (!firestore) return;

    const unsubStudents = onSnapshot(collection(firestore, 'students'), (snap) => {
        const studentList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)).filter(s => !s.isDeleted);
        setStudents(studentList);
    });

    const unsubEnrollments = onSnapshot(collection(firestore, 'enrollments'), (snap) => {
        const enrollmentMap: Record<string, string> = {};
        snap.docs.forEach(d => {
            const data = d.data();
            enrollmentMap[data.studentId] = data.classroomId;
        });
        setStudents(prev => prev.map(s => ({ ...s, classroomId: enrollmentMap[s.id] })));
    });

    return () => { unsubStudents(); unsubEnrollments(); };
  }, [firestore]);

  // 2. Fetch Payments for Current Session/Term
  useEffect(() => {
    if (!firestore || !settings) return;

    const q = query(
        collection(firestore, 'termPayments'),
        where('sessionId', '==', settings.currentSessionId),
        where('termId', '==', settings.currentTermId)
    );

    const unsub = onSnapshot(q, (snap) => {
        const paymentMap: Record<string, TermPayment> = {};
        snap.docs.forEach(d => {
            const data = d.data() as TermPayment;
            paymentMap[data.studentId] = data;
        });
        setPayments(paymentMap);
        setIsLoading(false);
    });

    return () => unsub();
  }, [firestore, settings]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = selectedClassId === 'all' || s.classroomId === selectedClassId;
        return matchesSearch && matchesClass;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, searchTerm, selectedClassId]);

  const classroomMap = useMemo(() => {
    return (classrooms || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {} as Record<string, Classroom>);
  }, [classrooms]);

  const handleAddPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !selectedStudent || !settings) return;

    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get('amount'));
    const note = formData.get('note') as string;

    const classroom = classroomMap[selectedStudent.classroomId || ''];
    const expected = classroom?.fees || 0;
    
    const paymentId = `${selectedStudent.id}_${settings.currentSessionId}_${settings.currentTermId}`;
    const existingPayment = payments[selectedStudent.id];

    const newInstallment: Installment = {
        amount,
        date: Timestamp.now(),
        note
    };

    const installments = existingPayment ? [...existingPayment.installments, newInstallment] : [newInstallment];
    const totalPaid = installments.reduce((sum, inst) => sum + inst.amount, 0);

    try {
        await setDoc(doc(firestore, 'termPayments', paymentId), {
            id: paymentId,
            studentId: selectedStudent.id,
            sessionId: settings.currentSessionId,
            termId: settings.currentTermId,
            expectedAmount: expected,
            installments,
            totalPaid,
            balance: expected - totalPaid
        });

        toast({ title: "Payment Recorded", description: `Successfully added ${amount} to ${selectedStudent.name}'s account.` });
        setIsAddingPayment(false);
        setSelectedStudent(null);
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const getStatusBadge = (studentId: string, classId?: string) => {
    const payment = payments[studentId];
    const classroom = classId ? classroomMap[classId] : null;
    const expected = classroom?.fees || 0;

    if (!payment || payment.totalPaid === 0) return <Badge variant="destructive">Owing</Badge>;
    if (payment.totalPaid >= expected) return <Badge className="bg-green-600">Paid</Badge>;
    return <Badge variant="secondary" className="bg-yellow-500 text-white">Partial</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Fee Ledger</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-2">
              <CardContent className="pt-6">
                  <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search student name or admission number..." 
                        className="pl-10" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>
              </CardContent>
          </Card>
          <Card>
              <CardContent className="pt-6">
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                      <SelectTrigger>
                          <SelectValue placeholder="All Classes" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">All Classes</SelectItem>
                          {classrooms?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-primary font-semibold">
                      <WalletCards className="h-5 w-5" />
                      <span>{filteredStudents.length} Students List</span>
                  </div>
              </CardContent>
          </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fee Tracking - {settings ? 'Current Term' : 'Loading...'}</CardTitle>
          <CardDescription>Update and analyze student fee payments for the current term.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Total Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredStudents.map((s) => {
                        const classroom = classroomMap[s.classroomId || ''];
                        const payment = payments[s.id];
                        const expected = classroom?.fees || 0;
                        const paid = payment?.totalPaid || 0;
                        const balance = expected - paid;

                        return (
                        <TableRow key={s.id}>
                            <TableCell className="font-medium">
                                <div>{s.name}</div>
                                <div className="text-xs text-muted-foreground">{s.admissionNumber}</div>
                            </TableCell>
                            <TableCell>{classroom?.name || 'N/A'}</TableCell>
                            <TableCell>₦{expected.toLocaleString()}</TableCell>
                            <TableCell className="text-green-600 font-medium">₦{paid.toLocaleString()}</TableCell>
                            <TableCell className={balance > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                                ₦{balance.toLocaleString()}
                            </TableCell>
                            <TableCell>{getStatusBadge(s.id, s.classroomId)}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedStudent(s)}>
                                    <PlusCircle className="mr-1 h-3 w-3" /> Pay
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setPaymentHistoryStudent(s)} disabled={!payment}>
                                    <History className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                        );
                    })}
                </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Add Fee Payment</DialogTitle>
                <DialogDescription>Recording batch payment for <span className="font-semibold text-primary">{selectedStudent?.name}</span>.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddPayment} className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="amount">Payment Amount (₦)</Label>
                    <Input id="amount" name="amount" type="number" placeholder="e.g. 50000" required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="note">Note / Ref (Optional)</Label>
                    <Input id="note" name="note" placeholder="e.g. Cash payment / 1st Batch" />
                </div>
                <div className="rounded-lg bg-muted p-3 text-sm">
                    <div className="flex justify-between">
                        <span>Total Fees:</span>
                        <span className="font-semibold">₦{(classroomMap[selectedStudent?.classroomId || '']?.fees || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                        <span>Current Paid:</span>
                        <span className="text-green-600 font-semibold">₦{(payments[selectedStudent?.id || '']?.totalPaid || 0).toLocaleString()}</span>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setSelectedStudent(null)}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Record Payment
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={!!paymentHistoryStudent} onOpenChange={(open) => !open && setPaymentHistoryStudent(null)}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Payment History</DialogTitle>
                <DialogDescription>Recent installments for {paymentHistoryStudent?.name}.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Note</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paymentHistoryStudent && payments[paymentHistoryStudent.id]?.installments.map((inst, i) => (
                            <TableRow key={i}>
                                <TableCell className="text-xs">
                                    {inst.date?.toDate ? format(inst.date.toDate(), 'PPP p') : 'N/A'}
                                </TableCell>
                                <TableCell className="font-medium">₦{inst.amount.toLocaleString()}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{inst.note || '--'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <DialogFooter>
                <Button onClick={() => setPaymentHistoryStudent(null)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
