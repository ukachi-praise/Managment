
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const SubjectsClient = dynamic(() => import('./client'), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-9" />
            <div>
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-72 mt-2" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
          </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full md:col-span-2" />
      </div>
       <Skeleton className="h-96 w-full" />
    </div>
  ),
});

export default function SubjectsPage() {
  return <SubjectsClient />;
}
