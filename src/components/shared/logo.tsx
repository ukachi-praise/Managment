import Image from 'next/image';
import { cn } from '@/lib/utils';
import { SCHOOL_NAME } from '@/lib/school';

export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-lg font-bold',
        className
      )}
    >
      <Image
        src="/Logo.jpg"
        alt={`${SCHOOL_NAME} logo`}
        width={36}
        height={36}
        className="h-8 w-8 shrink-0 object-contain"
        priority
      />
      <span className="max-w-40 font-headline text-sm leading-tight sm:max-w-none sm:text-base">{SCHOOL_NAME}</span>
    </div>
  );
}
