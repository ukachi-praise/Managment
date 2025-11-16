
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
import { CalendarIcon, Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  useFirestore,
  useDoc,
  setDocumentNonBlocking,
} from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';
import { doc, Timestamp } from 'firebase/firestore';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
});

type SchoolSettings = z.infer<typeof formSchema>;

export default function InfoPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();

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
    setDocumentNonBlocking(settingsRef, values, { merge: true });
    toast({
      title: 'Settings Saved',
      description: 'The school settings have been updated successfully.',
    });
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
    </div>
  );
}
