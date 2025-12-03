
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, Timestamp, writeBatch, collection, getDocs, collectionGroup } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setDocumentNonBlocking as setDocNB } from '@/firebase/non-blocking-updates';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const formSchema = z.object({
  currentSession: z.string().min(1, 'Please enter a session name.'),
  currentTermId: z.string().min(1, 'Please select a term.'),
  daysSchoolOpened: z.coerce.number().min(0, 'Must be a positive number.'),
  nextTermResumptionDate: z.date({
    required_error: 'Resumption date is required.',
  }),
  termEndingDate: z.date({
    required_error: 'Term ending date is required.',
  }),
  admissionNumberPrefix: z.string().optional(),
  totalStudentCapacity: z.coerce.number().min(1, 'Must be greater than 0.'),
});

type SchoolSettings = z.infer<typeof formSchema>;

export default function InfoPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Data Fetching ---
  const settingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'schoolSettings', 'current') : null),
    [firestore]
  );
  const { data: settingsData, isLoading: settingsLoading } =
    useDoc<SchoolSettings>(settingsRef);


  const form = useForm<SchoolSettings>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        currentSession: '',
        currentTermId: '',
        daysSchoolOpened: 0,
        admissionNumberPrefix: 'JKS',
        totalStudentCapacity: 500,
    },
  });
  
  const parseTimestampToDate = (dateValue: any): Date | undefined => {
    if (!dateValue) return undefined;
    if (dateValue instanceof Timestamp) return dateValue.toDate();
    if (dateValue instanceof Date) return dateValue;
    try {
      const parsedDate = new Date(dateValue);
      if (!isNaN(parsedDate.getTime())) return parsedDate;
    } catch (e) {
      console.error("Could not parse date:", dateValue, e);
    }
    return undefined;
  };
  
  useEffect(() => {
    if (settingsData) {
      form.reset({
        ...settingsData,
        nextTermResumptionDate: parseTimestampToDate(settingsData.nextTermResumptionDate),
        termEndingDate: parseTimestampToDate(settingsData.termEndingDate),
      });
    }
  }, [settingsData, form]);


  const onSubmit = async (values: SchoolSettings) => {
    if (!settingsRef) return;
    setDocNB(settingsRef, values, { merge: true });
    toast({
      title: 'Settings Saved',
      description: 'The school settings have been updated successfully.',
    });
  };

  const handleDeleteAllStudents = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore not available.' });
      return;
    }

    setIsDeleting(true);
    toast({ title: 'Processing...', description: 'Deleting all student data. This may take a moment.' });

    try {
      const batch = writeBatch(firestore);
      
      // 1. Get all classrooms to find all student subcollections
      const classroomsSnapshot = await getDocs(collection(firestore, 'classrooms'));
      for (const classroomDoc of classroomsSnapshot.docs) {
        const studentsInClassRef = collection(firestore, 'classrooms', classroomDoc.id, 'students');
        const studentsInClassSnapshot = await getDocs(studentsInClassRef);
        studentsInClassSnapshot.forEach(doc => batch.delete(doc.ref));
      }
      
      // 2. Get all students to delete their root doc and results subcollection
      const studentsSnapshot = await getDocs(collection(firestore, 'students'));
      for (const studentDoc of studentsSnapshot.docs) {
          batch.delete(studentDoc.ref); // Delete the student from /students
          
          const resultsRef = collection(firestore, 'students', studentDoc.id, 'results');
          const resultsSnapshot = await getDocs(resultsRef);
          resultsSnapshot.forEach(doc => batch.delete(doc.ref));
      }
      
      // 3. Delete all from /enrollments
      const enrollmentsSnapshot = await getDocs(collection(firestore, 'enrollments'));
      enrollmentsSnapshot.forEach(doc => batch.delete(doc.ref));
      
      await batch.commit();

      toast({
        title: 'Success!',
        description: 'All student data, enrollments, and results have been permanently deleted.',
      });

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: error.message || 'An unexpected error occurred.',
      });
      console.error("Error deleting all students:", error);
    } finally {
      setIsDeleting(false);
    }
  };


  const isLoading = form.formState.isSubmitting || settingsLoading;

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">School Settings</h1>
        </div>
      <Card>
        <CardHeader>
          <CardTitle>Manage General Information</CardTitle>
          <CardDescription>
            Set the current academic session, term, and other school-wide
            information here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <FormField
                  control={form.control}
                  name="currentSession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Academic Session</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 2025/2026" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currentTermId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Term</FormLabel>
                       <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a term" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* Simplified: In a real app, these would be fetched based on session */}
                          <SelectItem value="term1">1st Term</SelectItem>
                          <SelectItem value="term2">2nd Term</SelectItem>
                          <SelectItem value="term3">3rd Term</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="daysSchoolOpened"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Days School Opened</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g. 65" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="admissionNumberPrefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admission Number Prefix</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. JKS" {...field} />
                      </FormControl>
                       <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="totalStudentCapacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Student Capacity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g. 800" {...field} />
                      </FormControl>
                       <FormMessage />
                    </FormItem>
                  )}
                />

                <div />

                <FormField
                  control={form.control}
                  name="termEndingDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Term Ending Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={'outline'}
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextTermResumptionDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Next Term Resumption Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={'outline'}
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Settings
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            These actions are permanent and cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4 gap-4">
                <div className="w-full sm:w-auto">
                    <h3 className="font-semibold text-destructive">Delete All Students</h3>
                    <p className="text-sm text-destructive/80">This will permanently delete all students, enrollments, and their results. This is useful for clearing test data.</p>
                </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDeleting} className="w-full sm:w-auto flex-shrink-0">
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                            Delete All Student Data
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action is irreversible. It will permanently delete ALL student data across the entire application, including their personal details, class enrollments, and all past results. Do you wish to proceed?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAllStudents} className="bg-destructive hover:bg-destructive/90">
                                Yes, delete everything
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </CardContent>
      </Card>

    </div>
  );
}

    