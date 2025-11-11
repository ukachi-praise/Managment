import { students } from '@/lib/data';
import { notFound } from 'next/navigation';
import { ResultSheet } from '@/components/results/result-sheet';
import { SoftSkillsGenerator } from '@/components/results/soft-skills-generator';
import { Separator } from '@/components/ui/separator';

export default function StudentResultsPage({
  params,
}: {
  params: { studentId: string };
}) {
  const student = students.find((s) => s.id === params.studentId);

  if (!student) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{student.name}</h1>
        <p className="text-muted-foreground">
          Viewing detailed academic report and performance.
        </p>
      </div>

      <ResultSheet student={student} />

      <Separator />

      <SoftSkillsGenerator student={student} />
    </div>
  );
}
