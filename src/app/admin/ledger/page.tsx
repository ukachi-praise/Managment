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
import { collection, query, doc, onSnapshot, setDoc, Timestamp, where } from 'firebase/firestore';
import { Search, PlusCircle, History, WalletCards, Loader2, ArrowLeft, ReceiptText, Download, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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
    balance: number;
};

type PaymentStatus = 'all' | 'paid' | 'partial' | 'owing';

export default function LedgerPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatus>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentHistoryStudent, setPaymentHistoryStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // --- Data Fetching ---
  const settingsRef = useMemoFirebase(() => (firestore ? doc(firestore, 'schoolSettings', 'current') : null), [firestore]);
  const { data: settings } = useDoc<SchoolSettings>(settingsRef);

  const classroomsQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'classrooms')) : null), [firestore]);
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);

  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Record<string, TermPayment>>({});
  const [isLoading, setIsLoading] = useState(true);

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

  const classroomMap = useMemo(() => {
    return (classrooms || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {} as Record<string, Classroom>);
  }, [classrooms]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = selectedClassId === 'all' || s.classroomId === selectedClassId;
        
        const payment = payments[s.id];
        const expected = classroomMap[s.classroomId || '']?.fees || 0;
        const paid = payment?.totalPaid || 0;
        
        let matchesStatus = true;
        if (selectedStatus === 'paid') matchesStatus = paid >= expected && expected > 0;
        else if (selectedStatus === 'partial') matchesStatus = paid > 0 && paid < expected;
        else if (selectedStatus === 'owing') matchesStatus = paid === 0;

        return matchesSearch && matchesClass && matchesStatus;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, searchTerm, selectedClassId, selectedStatus, payments, classroomMap]);


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

        toast({ title: "Payment Recorded", description: `Successfully added ₦${amount.toLocaleString()} to ${selectedStudent.name}'s account.` });
        setSelectedStudent(null);
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleExportToExcel = async () => {
    if (filteredStudents.length === 0) {
        toast({ variant: 'destructive', title: 'Export Failed', description: 'No data to export.' });
        return;
    }

    setIsExporting(true);
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Fee Ledger');

        sheet.addRow(['JustVision Kiddies School - Fee Ledger']);
        sheet.addRow([`Report Date: ${format(new Date(), 'PPP')}`]);
        sheet.addRow([]);

        const headerRow = sheet.addRow(['S/N', 'Student Name', 'Admission No', 'Class', 'Expected Fee', 'Total Paid', 'Balance', 'Status']);
        headerRow.font = { bold: true };
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D3D3D3' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        filteredStudents.forEach((s, index) => {
            const classroom = classroomMap[s.classroomId || ''];
            const payment = payments[s.id];
            const expected = classroom?.fees || 0;
            const paid = payment?.totalPaid || 0;
            const balance = expected - paid;
            
            let status = 'Owing';
            if (paid >= expected && expected > 0) status = 'Paid';
            else if (paid > 0) status = 'Partial';

            const row = sheet.addRow([
                index + 1,
                s.name,
                s.admissionNumber,
                classroom?.name || 'N/A',
                expected,
                paid,
                balance,
                status
            ]);

            row.eachCell(cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        });

        sheet.getColumn(2).width = 30;
        sheet.getColumn(3).width = 20;
        sheet.getColumn(4).width = 15;
        sheet.getColumn(5).width = 15;
        sheet.getColumn(6).width = 15;
        sheet.getColumn(7).width = 15;
        sheet.getColumn(8).width = 15;

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Fee_Ledger_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

        toast({ title: 'Export Successful', description: 'Your ledger report has been downloaded.' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Export Failed', description: error.message });
    } finally {
        setIsExporting(false);
    }
  };

  const getStatusBadge = (studentId: string, classId?: string) => {
    const payment = payments[studentId];
    const classroom = classId ? classroomMap[classId] : null;
    const expected = classroom?.fees || 0;

    if (!payment || payment.totalPaid === 0) return <Badge variant="destructive">Owing</Badge>;
    if (payment.totalPaid >= expected && expected > 0) return <Badge className="bg-green-600 hover:bg-green-700">Paid</Badge>;
    return <Badge variant="secondary" className="bg-yellow-500 text-white hover:bg-yellow-600">Partial</Badge>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Fee Ledger</h1>
                <p className="text-muted-foreground hidden sm:block">Track and manage student school fees for the current term.</p>
            </div>
        </div>
        <Button onClick={handleExportToExcel} disabled={isExporting} variant="outline" className="w-full sm:w-auto shadow-sm">
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export to Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search name or admission number..." 
                className="pl-10 h-11 shadow-sm" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
          <div className="lg:col-span-3">
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="h-11 shadow-sm">
                      <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classrooms?.sort((a,b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
              </Select>
          </div>
          <div className="lg:col-span-3">
              <Select value={selectedStatus} onValueChange={(val: any) => setSelectedStatus(val)}>
                  <SelectTrigger className="h-11 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 opacity-50" />
                        <SelectValue placeholder="All Status" />
                      </div>
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid (Full)</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="owing">Owing</SelectItem>
                  </SelectContent>
              </Select>
          </div>
      </div>

      <Card className="shadow-lg border-none">
        <CardHeader className="border-b bg-muted/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <ReceiptText className="h-5 w-5 text-primary" />
                Enrollment Ledger
            </CardTitle>
            <div className="text-sm font-medium text-muted-foreground">
                Displaying {filteredStudents.length} Students
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">Loading ledger data...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
                <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                    <TableHead className="w-[30%]">Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Total Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
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
                        <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-medium pl-6">
                                <div className="text-base">{s.name}</div>
                                <div className="text-xs text-muted-foreground tracking-wide">{s.admissionNumber}</div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="font-normal">{classroom?.name || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell className="font-semibold tabular-nums">₦{expected.toLocaleString()}</TableCell>
                            <TableCell className="text-green-600 font-bold tabular-nums">₦{paid.toLocaleString()}</TableCell>
                            <TableCell className={balance > 0 ? "text-destructive font-bold tabular-nums" : "text-muted-foreground tabular-nums opacity-40"}>
                                ₦{balance.toLocaleString()}
                            </TableCell>
                            <TableCell>{getStatusBadge(s.id, s.classroomId)}</TableCell>
                            <TableCell className="text-right pr-6 space-x-2">
                                <Button size="sm" onClick={() => setSelectedStudent(s)} className="h-8 shadow-sm">
                                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> Pay
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setPaymentHistoryStudent(s)} 
                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    title="View Payment History"
                                >
                                    <History className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                        );
                    })}
                    {filteredStudents.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">
                                No records found matching your filters.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="sm:max-w-md border-none shadow-2xl">
            <DialogHeader>
                <DialogTitle className="text-2xl">Record Payment</DialogTitle>
                <DialogDescription>Add a new installment for <span className="font-bold text-foreground">{selectedStudent?.name}</span>.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddPayment} className="space-y-6 py-4">
                <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Payment Amount (₦)</Label>
                    <Input id="amount" name="amount" type="number" placeholder="0.00" required autoFocus className="h-12 text-lg font-bold" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="note" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Note / Reference</Label>
                    <Input id="note" name="note" placeholder="e.g. Bank Transfer, Cash, etc." className="h-10" />
                </div>
                <div className="rounded-xl bg-muted/40 p-4 space-y-3 border">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Term Fees:</span>
                        <span className="font-bold">₦{(classroomMap[selectedStudent?.classroomId || '']?.fees || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Paid to Date:</span>
                        <span className="text-green-600 font-bold">₦{(payments[selectedStudent?.id || '']?.totalPaid || 0).toLocaleString()}</span>
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="ghost" onClick={() => setSelectedStudent(null)} className="flex-1">Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="flex-1">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Record Transaction
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={!!paymentHistoryStudent} onOpenChange={(open) => !open && setPaymentHistoryStudent(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col border-none shadow-2xl p-0">
            <DialogHeader className="p-6 pb-0">
                <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-full bg-primary/10 p-2">
                        <History className="h-6 w-6 text-primary" />
                    </div>
                    <DialogTitle className="text-2xl font-bold">Payment History</DialogTitle>
                </div>
                <DialogDescription className="text-base">
                    Transaction breakdown for <span className="font-bold text-foreground">{paymentHistoryStudent?.name}</span>
                </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto px-6 py-4">
                {paymentHistoryStudent && payments[paymentHistoryStudent.id]?.installments.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Date & Time</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Reference</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments[paymentHistoryStudent.id].installments.map((inst, i) => (
                                    <TableRow key={i} className="hover:bg-muted/20">
                                        <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                                            {inst.date?.toDate ? format(inst.date.toDate(), 'PPP p') : 'N/A'}
                                        </TableCell>
                                        <TableCell className="font-bold text-green-700">₦{inst.amount.toLocaleString()}</TableCell>
                                        <TableCell className="text-sm italic">{inst.note || <span className="text-muted-foreground opacity-30">—</span>}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-muted/20 rounded-lg border-2 border-dashed">
                        <WalletCards className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-muted-foreground font-medium">No payment history found for this pupil.</p>
                    </div>
                )}
            </div>
            <div className="p-6 pt-2 border-t bg-muted/10">
                 <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 rounded-lg bg-background border shadow-sm">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">Total Expected</span>
                        <span className="text-xl font-black">₦{((paymentHistoryStudent && classroomMap[paymentHistoryStudent.classroomId || '']?.fees) || (paymentHistoryStudent && payments[paymentHistoryStudent.id]?.expectedAmount) || 0).toLocaleString()}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-background border shadow-sm">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">Outstanding</span>
                        <span className="text-xl font-black text-destructive">₦{(paymentHistoryStudent ? (
                            (classroomMap[paymentHistoryStudent.classroomId || '']?.fees || payments[paymentHistoryStudent.id]?.expectedAmount || 0) - (payments[paymentHistoryStudent.id]?.totalPaid || 0)
                        ) : 0).toLocaleString()}</span>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => setPaymentHistoryStudent(null)} className="w-full sm:w-auto h-11">Close Report</Button>
                </DialogFooter>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
