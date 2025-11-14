
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { headTeacherRemarks as initialRemarks } from '@/lib/data';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function RemarksPage() {
  const [remarks, setRemarks] = useState<string[]>(initialRemarks);
  const [open, setOpen] = useState(false);
  const [editingRemark, setEditingRemark] = useState<string | null>(null);
  const [currentRemarkValue, setCurrentRemarkValue] = useState('');
  const { toast } = useToast();

  const handleAddOrUpdateRemark = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const remarkText = formData.get('remark') as string;

    if (!remarkText) return;

    if (editingRemark) {
      // Update
      setRemarks(
        remarks.map((r) => (r === editingRemark ? remarkText : r))
      );
      toast({ title: 'Remark updated successfully!' });
    } else {
      // Add new
      setRemarks([...remarks, remarkText]);
      toast({ title: 'Remark added successfully!' });
    }
    handleCloseDialog();
  };

  const handleDeleteRemark = (remarkToDelete: string) => {
    setRemarks(remarks.filter((r) => r !== remarkToDelete));
    toast({
      variant: 'destructive',
      title: 'Remark deleted.',
    });
  };
  
  const handleOpenDialog = (remarkToEdit: string | null = null) => {
    setEditingRemark(remarkToEdit);
    setCurrentRemarkValue(remarkToEdit || '');
    setOpen(true);
  }
  
  const handleCloseDialog = () => {
    setOpen(false);
    setEditingRemark(null);
    setCurrentRemarkValue('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Remarks</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
             <Button onClick={() => handleOpenDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Remark
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingRemark ? 'Edit' : 'Add New'} Remark</DialogTitle>
              <DialogDescription>
                {editingRemark ? 'Update the remark text below.' : 'Enter a new predefined remark for head teachers.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddOrUpdateRemark} className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="remark">
                  Remark Text
                </Label>
                <Textarea
                  id="remark"
                  name="remark"
                  value={currentRemarkValue}
                  onChange={(e) => setCurrentRemarkValue(e.target.value)}
                  placeholder="e.g. An outstanding performance, keep up the great work."
                  className="min-h-[100px]"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                <Button type="submit">Save Remark</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Head Teacher Remarks</CardTitle>
          <CardDescription>
            A list of predefined remarks for the head teacher to use.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Remark Text</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remarks.map((remark, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium whitespace-pre-wrap">{remark}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(remark)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteRemark(remark)}
                    >
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

    