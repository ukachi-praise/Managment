import { notFound } from 'next/navigation';
import { ResultSheet } from '@/components/results/result-sheet';

export default function StudentResultsPage({
  params,
}: {
  params: { studentId: string };
}) {

  if (!params.studentId) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Student Academic Report</h1>
        <p className="text-muted-foreground">
          Detailed academic report and performance analysis.
        </p>
      </div>

      <ResultSheet studentId={params.studentId} />

    </div>
  );
}

    