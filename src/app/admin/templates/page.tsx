'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          Result Template Builder
        </h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create New Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template Designer</CardTitle>
          <CardDescription>
            Design and manage result templates for different classes or terms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] w-full items-center justify-center rounded-lg border-2 border-dashed bg-muted">
            <p className="text-muted-foreground">
              Drag-and-drop template builder will be implemented here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
