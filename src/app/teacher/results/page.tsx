import { ResultInputTable } from '@/components/teacher/result-input-table';

export default function ResultsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Student Result Entry
        </h1>
        <p className="text-muted-foreground">
          Select a class and subject to begin entering scores.
        </p>
      </div>

      <ResultInputTable />
    </div>
  );
}
