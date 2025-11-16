
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Unauthorized() {
  return (
    <div className="h-screen flex flex-col items-center justify-center text-center p-4">
      <h1 className="text-3xl font-bold text-destructive mb-4">Access Denied</h1>
      <p className="text-lg text-muted-foreground mb-8">You are not authorized to access this page.</p>
      <Button asChild>
        <Link href="/login">Return to Login</Link>
      </Button>
    </div>
  );
}
