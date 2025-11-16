
'use client';

import React, { type ReactNode, useState, useEffect } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { Loader2 } from 'lucide-react';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

// Get the singleton instances of Firebase services
const { firebaseApp, auth, firestore } = initializeFirebase();

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after the initial render
    setIsClient(true);
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore}
    >
        {({ isCoreLoading }) => {
            // Only show the loading spinner on the client side when core services are loading.
            // On the server, or before the client has mounted, render the children directly.
            if (isClient && isCoreLoading) {
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
