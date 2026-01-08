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
import { PlusCircle, Loader2, ArrowLeft, Building2 } from 'lucide-react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { addDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
import { collection, query, doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

type AcademicSession = {
  id: string;
  name: string; // e.g., "2024/2025"
};

type Term = {
    id: string;
    sessionId: string;
    name: "1st" | "2nd" | "3rd";
}

export default function SessionsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const firestore = useFirestore();

  const sessionsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'sessions')) : null),
    [firestore]
  );
  const { data: sessions, isLoading } = useCollection<AcademicSession>(sessionsQuery);

  const sortedSessions = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort((a, b) => b.name.localeCompare(a.name)); // Sort descending
  }, [sessions]);


  const handleAddSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore) return;

    const formData = new FormData(event.currentTarget);
    const sessionName = formData.get('name') as string;

    if (!/^\d{4}\/\d{4}$/.test(sessionName)) {
        toast({ variant: 'destructive', title: 'Invalid Format', description: 'Session name must be in YYYY/YYYY format.' });
        return;
    }
    
    try {
        const batch = writeBatch(firestore);

        // 1. Create the session document
        const sessionRef = doc(collection(firestore, 'sessions'));
        batch.set(sessionRef, { name: sessionName });

        // 2. Create the three term documents inside the session
        const terms: Term['name'][] = ['1st', '2nd', '3rd'];
        terms.forEach(termName => {
            const termRef = doc(collection(firestore, 'sessions', sessionRef.id, 'terms'));
            batch.set(termRef, { sessionId: sessionRef.id, name: termName });
        });
        
        await batch.commit();

        toast({ title: "Session Created", description: `Academic session ${sessionName} and its terms have been created.` });
        setDialogOpen(false);

    } catch (error) {
        console.error("Error creating session:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to create academic session.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Academic Sessions</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Session
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Academic Session</DialogTitle>
              <DialogDescription>
                Enter the name for the new session (e.g., 2024/2025). This will automatically create 1st, 2nd, and 3rd terms for it.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSession} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Session Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="YYYY/YYYY"
                  className="col-span-3"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit">Save Session</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Academic Sessions</CardTitle>
          <CardDescription>
            A list of all academic sessions. Use the "School Settings" page to set the current session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session Name</TableHead>
                  <TableHead>Terms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSessions && sortedSessions.length > 0 ? (
                  sortedSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium text-lg">{session.name}</TableCell>
                      <TableCell>
                          <div className="flex gap-2">
                             <Badge variant="secondary">1st Term</Badge>
                             <Badge variant="secondary">2nd Term</Badge>
                             <Badge variant="secondary">3rd Term</Badge>
                          </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                   <TableRow>
                      <TableCell colSpan={2} className="text-center h-24">No academic sessions found.</TableCell>
                   </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
