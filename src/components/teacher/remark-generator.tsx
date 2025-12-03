
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Wand2, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateRemarks, GenerateRemarksInput } from '@/ai/flows/generate-remarks';
import { DocumentReference } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

interface RemarkGeneratorProps {
  pupilName: string;
  overallAverage: number;
  resultRef: DocumentReference | null;
  initialTeacherRemark?: string;
  initialHeadTeacherRemark?: string;
}

export function RemarkGenerator({ 
    pupilName, 
    overallAverage, 
    resultRef,
    initialTeacherRemark,
    initialHeadTeacherRemark
}: RemarkGeneratorProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [teacherRemark, setTeacherRemark] = useState(initialTeacherRemark || '');
  const [headTeacherRemark, setHeadTeacherRemark] = useState(initialHeadTeacherRemark || '');

  useEffect(() => {
    setTeacherRemark(initialTeacherRemark || '');
    setHeadTeacherRemark(initialHeadTeacherRemark || '');
  }, [initialTeacherRemark, initialHeadTeacherRemark]);


  const handleGenerate = async () => {
    setIsGenerating(true);
    toast({ title: 'Generating Remarks...', description: 'The AI is crafting personalized remarks.' });

    try {
      const input: GenerateRemarksInput = { pupilName, overallAverage };
      const result = await generateRemarks(input);
      setTeacherRemark(result.teacherRemark);
      setHeadTeacherRemark(result.headTeacherRemark);
      toast({ title: 'Remarks Generated!', description: 'You can now review and save the remarks.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Generation Failed', description: 'Could not generate AI remarks.' });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleSave = () => {
    if (!resultRef) {
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Result document reference is missing.' });
        return;
    }
    setIsSaving(true);
    
    setDocumentNonBlocking(resultRef, {
        teacherRemark: teacherRemark || '',
        headTeacherRemark: headTeacherRemark || ''
    }, { merge: true });

    setTimeout(() => {
        setIsSaving(false);
        toast({ title: 'Remarks Saved!', description: 'The remarks have been saved successfully.' });
    }, 1000);

  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>AI-Powered Remarks</CardTitle>
        <CardDescription>
          Generate personalized teacher and head teacher remarks based on the pupil&apos;s overall performance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border bg-muted p-4">
            <div className='text-sm'>
                <span className="text-muted-foreground">Pupil: </span>
                <span className="font-semibold text-primary">{pupilName}</span>
                <span className="mx-4 text-slate-300">|</span>
                <span className="text-muted-foreground">Overall Average: </span>
                <span className="font-semibold text-primary">{overallAverage.toFixed(2)}%</span>
            </div>
            <Button onClick={handleGenerate} disabled={isGenerating || overallAverage === 0}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generate Remarks
            </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
                <Label htmlFor="teacherRemark">Teacher&apos;s Remark</Label>
                <Textarea
                    id="teacherRemark"
                    value={teacherRemark}
                    onChange={(e) => setTeacherRemark(e.target.value)}
                    placeholder="Generate or write the teacher's remark here."
                    className="min-h-[100px]"
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="headTeacherRemark">Head Teacher&apos;s Remark</Label>
                 <Textarea
                    id="headTeacherRemark"
                    value={headTeacherRemark}
                    onChange={(e) => setHeadTeacherRemark(e.target.value)}
                    placeholder="Generate or write the head teacher's remark here."
                    className="min-h-[100px]"
                />
            </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={handleSave} disabled={isSaving || !resultRef}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Remarks
        </Button>
      </CardFooter>
    </Card>
  );
}

    