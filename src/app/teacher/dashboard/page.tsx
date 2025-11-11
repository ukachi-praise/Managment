import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Book, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function TeacherDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, Teacher!</h1>
        <p className="text-muted-foreground">
          Here's a quick overview of your tasks.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Manage Results</CardTitle>
            <CardDescription>
              Input and update student scores for continuous assessments and
              exams.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex items-end">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/teacher/results">
                Go to Result Entry
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>My Classes</CardTitle>
            <CardDescription>
              View students and information for your assigned classes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Class list will be displayed here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
