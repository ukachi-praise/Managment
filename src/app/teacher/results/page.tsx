'use client';

import { ResultInputTable } from '@/components/teacher/result-input-table';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';

// This page might still be useful, but the primary entry point for a teacher
// is now their classroom page. We can keep this for direct access.
// Let's add a check here as well to ensure the teacher has a class.
export default function ResultsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [classId, setClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading || !firestore) return;

    if (!user) {
      redirect('/login');
      return;
    }

    const fetchUserClass = async () => {
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists() && userDoc.data().assignedClassroomId) {
        setClassId(userDoc.data().assignedClassroomId);
      }
      setLoading(false);
    };

    fetchUserClass();
  }, [user, isUserLoading, firestore]);

  if (loading) {
    return <div>Loading...</div>; // Or a skeleton loader
  }

  if (!classId) {
    return <div>You are not assigned to any class. Please contact an administrator.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Student Result Entry
        </h1>
        <p className="text-muted-foreground">
          Select a subject to begin entering scores for your class.
        </p>
      </div>

      <ResultInputTable />
    </div>
  );
}
