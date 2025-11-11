import { BookOpenCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-lg font-bold',
        className
      )}
    >
      <BookOpenCheck className="h-6 w-6 text-accent" />
      <span className="font-headline">JustVision Kiddies</span>
    </div>
  );
}
