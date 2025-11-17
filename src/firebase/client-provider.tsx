
'use client';

import React, { type ReactNode } from 'react';
import { FirebaseProvider, useFirebase } from '@/firebase/provider';
import { Loader2 } from 'lucide-react';

function FirebaseGate({ children }: { children: ReactNode }) {
    const { isLoading: isUserLoading } = useFirebase();

    // The gate will show a loader only during the initial user check
    // or if core services are not yet available.
    if (isUserLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return <>{children}</>;
}


export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  // The main FirebaseProvider now handles the singleton initialization
  // so this component can be simplified or removed if not needed for other client-side logic.
  // For now, we will keep it to wrap the children with the provider.
  return (
    <FirebaseProvider>
      {children}
    </FirebaseProvider>
  );
}
