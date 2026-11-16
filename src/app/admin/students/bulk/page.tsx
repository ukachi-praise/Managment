'use client';

import { useMemo, useState } from 'react';
import * as ExcelJS from 'exceljs';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { clean, ImportedStudentRow, normalizeClassName, normalizeGender, statusLabel } from '@/lib/bulk-enrollment';

type Classroom = { id: string; name: string };
type Student = { id: string; name?: string; gender?: string; admissionNumber?: string; isDeleted?: boolean };
type Enrollment = { id: string; studentId: string; classroomId: string };
type Row = ImportedStudentRow & { classroomId: string; include: boolean; status: ReturnType<typeof getStatus>; error?: string };
type Status = 'valid' | 'duplicate' | 'missing' | 'class-not-found' | 'ambiguous' | 'review';
const getStatus = (row: Pick<Row, 'name'|'gender'|'classroomId'|'reviewNotes'|'crossedOut'>, classIds: Set<string>, duplicate: boolean): Status => {
  if (!row.name || !row.gender) return 'missing';
  if (!row.classroomId || !classIds.has(row.classroomId)) return 'class-not-found';
  if (row.crossedOut || row.reviewNotes) return 'review';
  if (duplicate) return 'duplicate';
  return 'valid';
};

function cellText(value: unknown): string {
  if (value && typeof value === 'object' && 'richText' in value) return ((value as { richText: { text: string }[] }).richText || []).map(item => item.text).join('');
  if (value && typeof value === 'object' && 'text' in value) return String((value as { text: string }).text);
  return clean(value);
}

function parseCsv(text: string): string[][] {
  const result: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && text[index + 1] === '"' && quoted) { cell += '"'; index++; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index++; row.push(cell); result.push(row); row = []; cell = ''; continue; }
    cell += char;
  }
  if (cell || row.length) { row.push(cell); result.push(row); }
  return result;
}

export default function BulkStudentEnrolmentPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [step, setStep] = useState<'upload'|'review'|'imported'>('upload');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, success: 0, skipped: 0, failed: 0, total: 0 });
  const [failures, setFailures] = useState<{ rowNumber: number; name: string; className: string; reason: string }[]>([]);
  const classroomsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'classrooms')) : null, [firestore]);
  const { data: classrooms, isLoading: classroomsLoading } = useCollection<Classroom>(classroomsQuery);
  const sortedClassrooms = useMemo(() => [...(classrooms || [])].sort((a, b) => a.name.localeCompare(b.name)), [classrooms]);
  const classIds = useMemo(() => new Set(sortedClassrooms.map(c => c.id)), [sortedClassrooms]);
  const classByName = useMemo(() => {
    const map = new Map<string, Classroom[]>();
    sortedClassrooms.forEach(classroom => {
      const key = normalizeClassName(classroom.name);
      map.set(key, [...(map.get(key) || []), classroom]);
    });
    return map;
  }, [sortedClassrooms]);

  const updateRow = (rowNumber: number, update: Partial<Row>) => setRows(current => current.map(row => row.rowNumber === rowNumber ? { ...row, ...update } : row));

  const parseFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) throw new Error('Choose an .xlsx, .xls, or .csv file.');
    if (/\.xls$/i.test(file.name)) throw new Error('Legacy .xls files are not supported by the browser parser. Save the file as .xlsx or .csv and upload it again.');
    const workbook = new ExcelJS.Workbook();
    const bytes = await file.arrayBuffer();
    let csvRows: string[][] | null = null;
    if (/\.csv$/i.test(file.name)) csvRows = parseCsv(new TextDecoder().decode(bytes));
    else await workbook.xlsx.load(bytes);
    const worksheet = workbook.worksheets[0];
    if (!csvRows && !worksheet) throw new Error('The spreadsheet has no worksheet.');
    const headerValues = csvRows ? csvRows[0] : (worksheet!.getRow(1).values as unknown[]).slice(1).map(cellText);
    const headers = new Map<string, number>();
    headerValues.forEach((value, index) => headers.set(clean(value).toLowerCase(), index + 1));
    const nameColumn = headers.get('student name') ?? headers.get('name');
    const genderColumn = headers.get('gender');
    const classColumn = headers.get('class') ?? headers.get('classroom');
    const notesColumn = headers.get('review notes') ?? headers.get('notes');
    if (!nameColumn || !genderColumn || !classColumn) throw new Error('Required columns are Student Name, Gender, and Class.');
    const parsed: Row[] = [];
    const sourceRows = csvRows ? csvRows.slice(1).map((values, index) => ({ rowNumber: index + 2, values })) : null;
    const consumeRow = (values: string[], rowNumber: number, crossedOut = false) => {
      const valueAt = (column: number) => values[column - 1] || '';
      const name = clean(valueAt(nameColumn!));
      const gender = normalizeGender(valueAt(genderColumn!));
      const originalClass = clean(valueAt(classColumn!));
      const reviewNotes = notesColumn ? clean(valueAt(notesColumn)) : '';
      if (!name && !gender && !originalClass && !reviewNotes) return;
      const matches = classByName.get(normalizeClassName(originalClass)) || [];
      const classroomId = matches.length === 1 ? matches[0].id : '';
      parsed.push({ rowNumber, originalName: name, name, gender, originalClass, reviewNotes, crossedOut, classroomId, include: !crossedOut, status: matches.length > 1 ? 'ambiguous' : getStatus({ name, gender, classroomId, reviewNotes, crossedOut }, classIds, false) });
    };
    if (sourceRows) sourceRows.forEach(item => consumeRow(item.values, item.rowNumber));
    else worksheet!.eachRow((sheetRow, rowNumber) => { if (rowNumber > 1) consumeRow((sheetRow.values as unknown[]).slice(1).map(cellText), rowNumber, [nameColumn!, genderColumn!, classColumn!].some(column => Boolean(sheetRow.getCell(column).font?.strike))); });
    if (!parsed.length) throw new Error('No student rows were found.');
    setRows(parsed); setFileName(file.name); setStep('review');
  };

  const refreshDuplicateStatuses = async (currentRows: Row[]) => {
    if (!firestore) return currentRows;
    const [studentsSnap, enrollmentsSnap] = await Promise.all([getDocs(collection(firestore, 'students')), getDocs(collection(firestore, 'enrollments'))]);
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
    const enrollments = enrollmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment));
    return currentRows.map(row => {
      const sameName = students.find(student => !student.isDeleted && clean(student.name).toLocaleLowerCase() === row.name.toLocaleLowerCase());
      const alreadyEnrolled = sameName && enrollments.some(enrollment => enrollment.studentId === sameName.id && enrollment.classroomId === row.classroomId);
      const duplicate = Boolean(alreadyEnrolled || sameName);
      return { ...row, status: getStatus(row, classIds, duplicate), error: alreadyEnrolled ? 'Already enrolled in this classroom.' : sameName ? 'Existing student with the same name; verify identity before importing.' : undefined };
    });
  };

  const prepareImport = async () => { setBusy(true); try { setRows(await refreshDuplicateStatuses(rows)); toast({ title: 'Validation complete', description: 'Review every flagged row before confirming.' }); } catch (error) { toast({ variant: 'destructive', title: 'Validation failed', description: error instanceof Error ? error.message : 'Could not validate rows.' }); } finally { setBusy(false); } };

  const confirmImport = async () => {
    if (!firestore) return;
    const eligible = rows.filter(row => row.include && (row.status === 'valid' || row.status === 'duplicate'));
    if (!eligible.length) { toast({ variant: 'destructive', title: 'Nothing to import', description: 'Resolve errors and include at least one valid row.' }); return; }
    setBusy(true); setFailures([]); setProgress({ processed: 0, success: 0, skipped: 0, failed: 0, total: eligible.length });
    try {
      const [studentsSnap, enrollmentsSnap] = await Promise.all([getDocs(collection(firestore, 'students')), getDocs(collection(firestore, 'enrollments'))]);
      const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      const activeEnrollments = enrollmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment));
      const settingsSnap = await getDoc(doc(firestore, 'schoolSettings', 'current'));
      const prefix = clean(settingsSnap.data()?.admissionNumberPrefix) || 'JKS';
      let nextNumber = students.reduce((max, student) => { const match = student.admissionNumber?.match(/(\d+)$/); return Math.max(max, match ? Number(match[1]) : 0); }, 0) + 1;
      let processed = 0, success = 0, skipped = 0, failed = 0;
      const errorRows: typeof failures = [];
      // Two writes are needed for a new student; keeping chunks below 500 protects the batch limit.
      for (let start = 0; start < eligible.length; start += 200) {
        const batch = writeBatch(firestore); let writes = 0;
        for (const row of eligible.slice(start, start + 200)) {
          const existing = students.find(student => !student.isDeleted && clean(student.name).toLocaleLowerCase() === row.name.toLocaleLowerCase());
          if (existing) {
            const enrolled = activeEnrollments.some(item => item.studentId === existing.id && item.classroomId === row.classroomId);
            if (enrolled) { skipped++; processed++; continue; }
            const enrollmentRef = doc(collection(firestore, 'enrollments'));
            batch.set(enrollmentRef, { studentId: existing.id, classroomId: row.classroomId, createdAt: serverTimestamp() }); writes++; success++; processed++; continue;
          }
          const studentRef = doc(collection(firestore, 'students'));
          const enrollmentRef = doc(collection(firestore, 'enrollments'));
          batch.set(studentRef, { name: row.name, admissionNumber: `${prefix}-${String(nextNumber++).padStart(3, '0')}`, gender: row.gender, dob: '', parentName: '', contact: '', isDeleted: false });
          batch.set(enrollmentRef, { studentId: studentRef.id, classroomId: row.classroomId, createdAt: serverTimestamp() }); writes += 2; success++; processed++;
        }
        if (writes) { try { await batch.commit(); } catch (error) { const message = error instanceof Error ? error.message : 'Batch commit failed.'; const batchRows = eligible.slice(start, start + 200); batchRows.forEach(row => errorRows.push({ rowNumber: row.rowNumber, name: row.name, className: row.originalClass, reason: message })); failed += batchRows.length; success -= batchRows.length; } }
        setProgress({ processed, success, skipped, failed, total: eligible.length });
      }
      setFailures(errorRows); setStep('imported'); toast({ title: 'Import finished', description: `${success} enrolled, ${skipped} skipped, ${failed} failed.` });
    } finally { setBusy(false); }
  };

  const downloadTemplate = () => { const blob = new Blob(['No.,Student Name,Gender,Class,Review Notes\n1.,Example Student,Male,Basic 3,\n'], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'ARMS_Student_Enrolment_Template.csv'; link.click(); URL.revokeObjectURL(url); };
  const downloadErrors = () => { const body = ['Row,Student Name,Class,Error', ...failures.map(item => `${item.rowNumber},"${item.name.replaceAll('"', '""')}","${item.className.replaceAll('"', '""')}","${item.reason.replaceAll('"', '""')}"`)].join('\n'); const blob = new Blob([body], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'ARMS_bulk_enrolment_errors.csv'; link.click(); URL.revokeObjectURL(url); };
  const counts = rows.reduce((acc, row) => { acc.total++; if (row.status === 'valid') acc.valid++; if (row.status === 'review') acc.review++; if (row.status === 'duplicate') acc.duplicate++; if (row.status === 'missing' || row.status === 'class-not-found' || row.status === 'ambiguous') acc.invalid++; if (!row.classroomId) acc.unmatched++; return acc; }, { total: 0, valid: 0, review: 0, duplicate: 0, invalid: 0, unmatched: 0 });

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-4"><Button onClick={() => router.push('/admin/students')} variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button><div><h1 className="text-3xl font-bold tracking-tight">Bulk Student Enrolment</h1><p className="text-muted-foreground">Import students into existing classrooms and review every row before saving.</p></div></div><Button variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Template</Button></div>
    {step === 'upload' && <Card><CardHeader><CardTitle>1. Upload spreadsheet</CardTitle><CardDescription>Use .xlsx, .xls, or .csv with Student Name, Gender, Class, and optional Review Notes columns.</CardDescription></CardHeader><CardContent><label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center hover:bg-muted/50"><FileSpreadsheet className="h-10 w-10 text-muted-foreground" /><span className="font-medium">Drop a file here or browse</span><span className="text-sm text-muted-foreground">Class names are matched to existing classroom document IDs.</span><Input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={event => event.target.files?.[0] && parseFile(event.target.files[0]).catch(error => toast({ variant: 'destructive', title: 'Could not read file', description: error.message }))} /></label></CardContent></Card>}
    {step === 'review' && <><Card><CardHeader><CardTitle>2. Review and match classrooms</CardTitle><CardDescription>{fileName} · {counts.total} rows. No Firestore writes happen until you confirm.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-6"><span>Total: {counts.total}</span><span>Valid: {counts.valid}</span><span>Review: {counts.review}</span><span>Duplicates: {counts.duplicate}</span><span>Invalid: {counts.invalid}</span><span>Unmatched: {counts.unmatched}</span></div><Button onClick={prepareImport} disabled={busy || classroomsLoading}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Check existing students</Button></CardContent></Card><Card><CardContent className="p-0"><div className="max-h-[60vh] overflow-auto"><Table><TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Student name</TableHead><TableHead>Gender</TableHead><TableHead>Spreadsheet class</TableHead><TableHead>Existing classroom</TableHead><TableHead>Status</TableHead><TableHead>Include</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.rowNumber}><TableCell>{row.rowNumber}</TableCell><TableCell><Input value={row.name} onChange={event => updateRow(row.rowNumber, { name: event.target.value, status: getStatus({ ...row, name: event.target.value }, classIds, row.status === 'duplicate') })} /></TableCell><TableCell><Select value={row.gender} onValueChange={gender => updateRow(row.rowNumber, { gender, status: getStatus({ ...row, gender }, classIds, row.status === 'duplicate') })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select></TableCell><TableCell>{row.originalClass}{row.reviewNotes && <div className="text-xs text-amber-600">{row.reviewNotes}</div>}</TableCell><TableCell><Select value={row.classroomId || 'unmatched'} onValueChange={classroomId => updateRow(row.rowNumber, { classroomId, status: getStatus({ ...row, classroomId }, classIds, row.status === 'duplicate') })}><SelectTrigger className="min-w-40"><SelectValue placeholder="Choose classroom" /></SelectTrigger><SelectContent><SelectItem value="unmatched" disabled>Select existing classroom</SelectItem>{sortedClassrooms.map(classroom => <SelectItem key={classroom.id} value={classroom.id}>{classroom.name} ({classroom.id})</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Badge variant={row.status === 'valid' ? 'default' : row.status === 'review' ? 'secondary' : 'destructive'}>{statusLabel(row.status)}</Badge>{row.error && <div className="max-w-48 text-xs text-muted-foreground">{row.error}</div>}</TableCell><TableCell><Checkbox checked={row.include} onCheckedChange={checked => updateRow(row.rowNumber, { include: Boolean(checked) })} /></TableCell></TableRow>)}</TableBody></Table></div></CardContent><div className="flex flex-wrap justify-end gap-2 border-t p-4"><Button variant="outline" onClick={() => { setRows([]); setStep('upload'); }}>Choose another file</Button><Button onClick={confirmImport} disabled={busy || rows.some(row => row.include && !['valid', 'duplicate'].includes(row.status))}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Confirm import</Button></div></Card></>}
    {step === 'imported' && <Card><CardHeader><CardTitle>3. Import results</CardTitle><CardDescription>{progress.total} eligible rows processed.</CardDescription></CardHeader><CardContent className="space-y-5"><Progress value={progress.total ? progress.processed / progress.total * 100 : 100} /><div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><div><CheckCircle2 className="text-green-600" />{progress.success} enrolled</div><div>{progress.skipped} skipped</div><div><XCircle className="text-red-600" />{progress.failed} failed</div><div>{rows.filter(row => !row.include).length} excluded</div></div>{failures.length > 0 && <Button variant="outline" onClick={downloadErrors}><Download className="mr-2 h-4 w-4" />Download error report</Button>}<div className="flex gap-2"><Button onClick={() => router.push('/admin/students')}>Return to students</Button><Button variant="outline" onClick={() => { setStep('upload'); setRows([]); }}>Import another file</Button></div></CardContent></Card>}
  </div>;
}
