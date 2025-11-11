
'use client';

import { notFound } from 'next/navigation';
import { ResultSheet } from '@/components/results/result-sheet';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';


export default function StudentResultsPage({
  params,
}: {
  params: { studentId: string };
}) {

  if (!params.studentId) {
    notFound();
  }

  const handlePrint = () => {
    window.print();
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
        </div>
      </div>

      <ResultSheet studentId={params.studentId} />

    </div>
  );
}
