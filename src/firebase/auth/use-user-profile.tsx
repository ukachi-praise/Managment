'use client';

import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc } from '@/firebase';
import { useMemoFirebase } from '@/firebase/provider';

// Simplified profile type based on backend.json
export type UserProfile = {
  role?: 'Admin' | 'Teacher';
  name?: string;
  assignedClassroomId?: string;
};

/**
 * A hook to fetch a user's profile document from Firestore.
 * @param uid The user's ID.
 * @returns The result from the useDoc hook.
 */
export const useUserProfile = (uid: string | undefined) => {
  const firestore = useFirestore();

  const userProfileRef = useMemoFirebase(
    () => (firestore && uid ? doc(firestore, 'users', uid) : null),
    [firestore, uid]
  );

  return useDoc<UserProfile>(userProfileRef);
};
