
'use client';

import { useState, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import {
  useCollection,
} from '@/firebase/firestore/use-collection';
import {
  useFirestore,
  useMemoFirebase,
} from '@/firebase/provider';
import { collection, query, doc, writeBatch, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';


type Pupil = {
  id: string;
  name: string;
  admissionNumber: string;
  isDeleted?: boolean;
};


export default function DeletedPupilsPage() {
  const [pupilToRestore, setPupilToRestore] = useState<Pupil | null>(null);
  const [pupilToDelete, setPupilToDelete] = useState<Pupil | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const deletedPupilsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'pupils'), where('isDeleted', '==', true)) : null),
    [firestore]
  );
  const { data: deletedPupils, isLoading } = useCollection<Pupil>(deletedPupilsQuery);

  const handleRestorePupil = () => {
    if (!firestore || !pupilToRestore) return;
    
    setIsRestoring(true);
    const pupilRef = doc(firestore, 'pupils', pupilToRestore.id);
    
    setDocumentNonBlocking(pupilRef, { isDeleted: false }, { merge: true });

    toast({
        title: 'Pupil Restored',
        description: `${pupilToRestore.name} has been restored. You will need to re-enroll them into a class.`,
    });
    setPupilToRestore(null);
    setIsRestoring(false);
  }
  
  const handlePermanentDelete = async () => {
    if (!firestore || !pupilToDelete) return;
    setIsDeleting(true);
    
    try {
        const batch = writeBatch(firestore);

        // 1. Delete main pupil doc
        const pupilRef = doc(firestore, 'pupils', pupilToDelete.id);
        batch.delete(pupilRef);

        // 2. Delete from enrollments
        const enrollmentsQuery = query(collection(firestore, 'enrollments'), where('pupilId', '==', pupilToDelete.id));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        enrollmentsSnapshot.forEach(doc => batch.delete(doc.ref));
        
        // 3. Delete all their results
        const resultsRef = collection(firestore, 'pupils', pupilToDelete.id, 'results');
        const resultsSnapshot = await getDocs(resultsRef);
        resultsSnapshot.forEach(doc => batch.delete(doc.ref));

        await batch.commit();

        toast({
            variant: 'destructive',
            title: 'Pupil Permanently Deleted',
            description: `${pupilToDelete.name} and all their associated data have been erased.`,
        });
    } catch(error: any) {
        toast({
            variant: 'destructive',
            title: 'Error Deleting Pupil',
            description: error.message || 'Could not permanently delete the pupil.',
        });
    } finally {
        setPupilToDelete(null);
        setIsDeleting(false);
    }
  }

  const openRestoreDialog = (pupil: Pupil) => {
    setPupilToRestore(pupil);
  }
  
  const openDeleteDialog = (pupil: Pupil) => {
    setPupilToDelete(pupil);
  }

  const sortedPupils = useMemo(() => {
    if (!deletedPupils) return [];
    return [...deletedPupils].sort((a, b) => a.name.localeCompare(b.name));
  }, [deletedPupils]);


  return (
    <div className="space-y-6">
      <AlertDialog open={!!pupilToRestore} onOpenChange={(open) => !open && setPupilToRestore(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Restore Pupil?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will restore <span className="font-semibold">{pupilToRestore?.name}</span>. They will be marked as active, but you will need to manually enroll them back into a class.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRestorePupil} disabled={isRestoring}>
                  {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4" />}
                  Restore Pupil
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={!!pupilToDelete} onOpenChange={(open) => !open && setPupilToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action is irreversible. This will permanently delete <span className="font-semibold">{pupilToDelete?.name}</span> and all of their associated data, including results and enrollment history.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete Permanently
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Recycle Bin</h1>
        </div>
      </div>

        <Card>
            <CardHeader>
            <CardTitle>Deleted Pupils</CardTitle>
            <CardDescription>
                This is a list of all pupils who have been removed from classes. You can restore them or permanently delete their records.
            </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pupil</TableHead>
                                <TableHead>Admission Number</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedPupils.length > 0 ? sortedPupils.map((pupil) => (
                                <TableRow key={pupil.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarFallback>{pupil.name.charAt(0).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <span>{pupil.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{pupil.admissionNumber}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button onClick={() => openRestoreDialog(pupil)} variant="outline" size="sm">
                                            <RotateCcw className="mr-2 h-4 w-4" />
                                            Restore
                                        </Button>
                                        <Button onClick={() => openDeleteDialog(pupil)} variant="destructive" size="sm">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Permanently
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        The recycle bin is empty.
                                    </TableCell>
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

    