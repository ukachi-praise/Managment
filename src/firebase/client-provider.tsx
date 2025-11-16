
'use client';

import React, { type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { Loader2 } from 'lucide-react';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

// Get the singleton instances of Firebase services
const { firebaseApp, auth, firestore } = initializeFirebase();

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  
  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore}
    >
        {({ isCoreLoading }) => {
            if (isCoreLoading) {
                return (
                    <div className="flex h-screen w-full items-center justify-center">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    </div>
                );
            }
            return children;
        }}
    </FirebaseProvider>
  );
}
