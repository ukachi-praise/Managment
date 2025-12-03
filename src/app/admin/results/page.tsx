
'use client';

import { ResultViewTable } from '@/components/admin/result-view-table';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ResultsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
             <Button onClick={() => router.back()} variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">
                View Pupil Results
                </h1>
                <p className="text-muted-foreground">
                    Select a class to view and export pupil report cards.
                </p>
            </div>
        </div>
      </div>

      <ResultViewTable />
    </div>
  );
}
