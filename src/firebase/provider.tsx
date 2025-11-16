
'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo, DependencyList } from 'react';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Firestore, doc, getFirestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, getAuth } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};


// --- PROFILE TYPE ---
export type UserProfile = {
  role?: 'Admin' | 'Teacher';
  name?: string;
  email?: string;
  assignedClassroomId?: string;
};
export type AppUser = User & UserProfile;

// --- CONTEXT STATE ---
interface FirebaseContextState {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  user: AppUser | null;
  isLoading: boolean;
  isLoggedIn: boolean; // True only after auth state is confirmed and user exists
  error: Error | null;
}

// --- CONTEXT ---
const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);


// --- PROVIDER COMPONENT ---
export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const services = useMemo(() => {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    return { app, auth, firestore };
  }, []);

  useEffect(() => {
    const { auth, firestore } = services;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (authUser) => {
        setIsLoading(true);
        if (authUser) {
          // User is signed in, now fetch their profile
          try {
            const userDocRef = doc(firestore, 'users', authUser.uid);
            const userDoc = await (await import('firebase/firestore')).getDoc(userDocRef);

            if (userDoc.exists()) {
              const profile = userDoc.data() as UserProfile;
              setUser({ ...authUser, ...profile });
            } else {
              // Authenticated user has no profile doc. Treat as a partial user.
               // Check for hardcoded users
              if (authUser.uid === 'GOpbb9SsavhpATk1p0KNmPGGQ0S2') {
                setUser({ ...authUser, role: 'Admin', name: 'Admin User', email: authUser.email || 'admin@example.com' });
              } else if (authUser.uid === 'u3krP4g02DgPJ6Avv1XhVNvvb8R2') {
                 setUser({ ...authUser, role: 'Teacher', name: 'Primary 4 Teacher', email: authUser.email || 'teacher@example.com', assignedClassroomId: 'mG24k9p8T7y0r5B3s1A9' });
              } else {
                setUser(authUser as AppUser);
              }
            }
            setIsLoggedIn(true);
          } catch (e) {
            console.error("Error fetching user profile:", e);
            setUser(authUser as AppUser); // Fallback to auth user only
            setIsLoggedIn(true); // Still logged in, even if profile fails
          }
        } else {
          // User is signed out
          setUser(null);
          setIsLoggedIn(false);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Auth State Error:", error);
        setError(error);
        setUser(null);
        setIsLoggedIn(false);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [services]);

  const value = {
    app: services.app,
    auth: services.auth,
    firestore: services.firestore,
    user,
    isLoading,
    isLoggedIn,
    error,
  };

  if (isLoading && !user && !isLoggedIn) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <FirebaseContext.Provider value={value}>
        <FirebaseErrorListener />
        {children}
    </FirebaseContext.Provider>
  );
}


// --- HOOKS ---
export const useFirebase = (): Omit<FirebaseContextState, 'user' | 'isLoading' | 'error' | 'isLoggedIn'> => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  if (!context.app || !context.auth || !context.firestore) {
    throw new Error("Firebase services are not available. Check your configuration.");
  }
  return { app: context.app, auth: context.auth, firestore: context.firestore };
};

export const useUser = (): { user: AppUser | null, isLoading: boolean, isLoggedIn: boolean, error: Error | null } => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a FirebaseProvider.');
    }
    return { user: context.user, isLoading: context.isLoading, isLoggedIn: context.isLoggedIn, error: context.error };
}

export const useAuth = (): Auth => {
    const context = useContext(FirebaseContext);
    if (context === undefined || !context.auth) {
        throw new Error('useAuth must be used within a FirebaseProvider and Auth must be initialized.');
    }
    return context.auth;
}

export const useFirestore = (): Firestore => {
    const context = useContext(FirebaseContext);
    if (context === undefined || !context.firestore) {
        throw new Error('useFirestore must be used within a FirebaseProvider and Firestore must be initialized.');
    }
    return context.firestore;
}

export const useFirebaseApp = (): FirebaseApp => {
    const context = useContext(FirebaseContext);
    if (context === undefined || !context.app) {
        throw new Error('useFirebaseApp must be used within a FirebaseProvider and Firebase App must be initialized.');
    }
    return context.app;
}


// --- MEMOIZATION HOOK ---
type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoized = useMemo(factory, deps);
  
  if(memoized && typeof memoized === 'object' && !('__memo' in memoized)) {
     try {
        (memoized as MemoFirebase<T>).__memo = true;
     } catch (e) {
        // This can fail if the object is frozen, which is fine.
     }
  }
  
  return memoized;
}
