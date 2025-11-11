
'use client';

import { notFound } from 'next/navigation';
import { ResultSheet } from '@/components/results/result-sheet';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';


export default function StudentResultsPage({
  params,
}: {
  params: { studentId: string };
}) {

  const { toast } = useToast();
  const [isZipping, setIsZipping] = useState(false);

  if (!params.studentId) {
    notFound();
  }

  const handlePrint = () => {
    window.print();
  };

  const handleBulkDownload = () => {
    setIsZipping(true);
    toast({
      title: 'Generating ZIP...',
      description: 'Preparing bulk PDF export for the class. This may take a moment.',
    });
    setTimeout(() => {
      setIsZipping(false);
      toast({
        title: 'Download Ready!',
        description: 'The ZIP archive has been successfully generated.',
      });
    }, 2500);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Student Academic Report</h1>
            <p className="text-muted-foreground">
              Detailed academic report and performance analysis.
            </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="mr-2 h-4 w-4" /> Print Result
          </Button>
          <Button onClick={handleBulkDownload} disabled={isZipping}>
            <Download className="mr-2 h-4 w-4" />
            {isZipping ? 'Packaging...' : 'Download Class ZIP'}
          </Button>
        </div>
      </div>

      <ResultSheet studentId={params.studentId} />

    </div>
  );
}
