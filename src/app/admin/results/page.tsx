'use client';

import { ResultViewTable } from '@/components/admin/result-view-table';

export default function ResultsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          View Student Results
        </h1>
        <p className="text-muted-foreground">
          Select a class to view all student scores for that class.
        </p>
      </div>

      <ResultViewTable />
    </div>
  );
}
