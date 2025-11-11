'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function InfoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Information</h1>
      <Card>
        <CardHeader>
          <CardTitle>About This Page</CardTitle>
          <CardDescription>
            This page can be used to display important information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>You can add any relevant information for administrators here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
