
'use client';

import React, { type ReactNode, useState, useEffect } from 'react';
import { FirebaseProvider, useFirebase } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { Loader2 } from 'lucide-react';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

// Get the singleton instances of Firebase services
const { firebaseApp, auth, firestore } = initializeFirebase();

function FirebaseLoadingGate({ children }: { children: ReactNode }) {
    const { isUserLoading } = useFirebase();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (isClient && isUserLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return <>{children}</>;
}


export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore}
    >
      <FirebaseLoadingGate>
        {children}
      </FirebaseLoadingGate>
    </FirebaseProvider>
  );
}
