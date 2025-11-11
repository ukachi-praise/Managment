'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { handleGenerateSoftSkills, FormState } from '@/app/lib/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Wand2, Loader2 } from 'lucide-react';
import type { Student } from '@/lib/data';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Wand2 className="mr-2 h-4 w-4" />
      )}
      Generate with AI
    </Button>
  );
}

export function SoftSkillsGenerator({ student }: { student: Student }) {
  const { toast } = useToast();
  const initialState: FormState = {
    status: 'idle',
    message: '',
    data: null,
  };

  const [state, formAction] = useFormState(handleGenerateSoftSkills, initialState);

  useEffect(() => {
    if (state.status === 'error') {
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: state.message,
      });
    } else if (state.status === 'success') {
       toast({
        title: 'Generation Successful',
        description: state.message,
      });
    }
  }, [state, toast]);

  return (
    <Card className="no-print">
      <form action={formAction}>
        <CardHeader>
          <CardTitle>Soft Skill & Remark Generation</CardTitle>
          <CardDescription>
            Use AI to automatically generate soft skill assessments and remarks based on student data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="academicPerformance">Academic Performance</Label>
              <Input
                id="academicPerformance"
                name="academicPerformance"
                defaultValue="Generally good, excels in Mathematics."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance">Attendance</Label>
              <Input
                id="attendance"
                name="attendance"
                defaultValue={student.attendance}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>AI Generated Soft Skills Assessment</Label>
            <Textarea
              readOnly
              value={state.data?.softSkillsAssessment ?? ''}
              placeholder="AI assessment will appear here..."
              className="min-h-[100px] bg-secondary"
            />
          </div>
          <div className="space-y-2">
            <Label>AI Generated Remarks</Label>
            <Textarea
              readOnly
              value={state.data?.remarks ?? ''}
              placeholder="AI remarks will appear here..."
              className="min-h-[100px] bg-secondary"
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
