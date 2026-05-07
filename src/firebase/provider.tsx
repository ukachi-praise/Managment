
'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo, DependencyList } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { initializeFirebase } from '@/firebase'; // SAFE IMPORT
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';


// --- PROFILE TYPE ---
export type UserProfile = {
  role?: 'SuperAdmin' | 'Admin' | 'Teacher';
  name?: string;
  email?: string;
  assignedClassroomId?: string;
  phoneNumber?: string;
};
export type AppUser = User & UserProfile;

// --- CONTEXT STATE ---
interface FirebaseContextState {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  user: AppUser | null;
  isLoading: boolean;
}

// --- CONTEXT ---
const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);


const MissingConfigErrorDisplay = () => (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-lg border-destructive">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-6 w-6" />
                    Firebase Configuration Error
                </CardTitle>
                <CardDescription className="text-destructive/90">
                    Your Firebase credentials are not configured correctly.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm">
                    The application cannot connect to Firebase because the required environment variables are missing. Please add the following keys to your <code className="bg-muted-foreground/20 p-1 rounded-sm text-xs">.env</code> file:
                </p>
                <pre className="mt-4 w-full overflow-x-auto rounded-md bg-slate-950 p-4">
                    <code className="text-white text-xs">
                        NEXT_PUBLIC_FIREBASE_API_KEY=...<br />
                        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...<br />
                        NEXT_PUBLIC_FIREBASE_PROJECT_ID=...<br />
                        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...<br />
                        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...<br />
                        NEXT_PUBLIC_FIREBASE_APP_ID=...<br />
                        GEMINI_API_KEY=...
                    </code>
                </pre>
                 <p className="mt-4 text-xs text-muted-foreground">
                    After adding the variables, you may need to restart the development server for the changes to take effect.
                </p>
            </CardContent>
        </Card>
    </div>
);


// --- PROVIDER COMPONENT ---
export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const services = useMemo(() => initializeFirebase(), []);

  useEffect(() => {
    if (!services) {
      setIsLoading(false);
      return;
    }

    const { auth, firestore } = services;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (authUser) => {
        if (authUser) {
          try {
            let baseProfile: UserProfile = {};
            // --- Hardcoded Access Logic ---
            if (authUser.uid === 'GOpbb9SsavhpATk1p0KNmPGGQ0S2') {
                baseProfile = { role: 'SuperAdmin', name: 'Super Admin', email: authUser.email || 'admin@example.com' };
            } else if (authUser.uid === 'WRbg0T3XA7eIpFFb9amDgvii12x1') {
                baseProfile = { role: 'Admin', name: 'School Admin', email: authUser.email || 'staff@example.com' };
            } else if (authUser.uid === 'u3krP4g02DgPJ6Avv1XhVNvvb8R2') {
                baseProfile = { role: 'Teacher', name: 'Primary 4 Teacher', email: authUser.email, assignedClassroomId: '9C0VNAZOmArOqXUrK7M1' };
            } else if (authUser.uid === 'YAemjwMFEAOnvp6RL6STw3GJK0I2') {
                baseProfile = { role: 'Teacher', name: 'Pre-Nursery Teacher', email: authUser.email, assignedClassroomId: 'VSR3ERyCrmmCxGrgBMjp' };
            } else if (authUser.uid === 'VEjzC6td3HNfWBg4CjNnCtSlC7g1') {
                baseProfile = { role: 'Teacher', name: 'Nursery 1b Teacher', email: authUser.email, assignedClassroomId: '65H3TTmH4qnrASE28Vhr' };
            } else if (authUser.uid === 'vhyAkcnmE2OD9cheoDeXdsdUL1a2') {
                baseProfile = { role: 'Teacher', name: 'Nursery 1a Teacher', email: authUser.email, assignedClassroomId: 'v96bogkVQBnAc8MRkQ03' };
            } else if (authUser.uid === 'UJ71VwEZhhVclFS8FdeVEL1jH1C3') {
                baseProfile = { role: 'Teacher', name: 'Primary 1a Teacher', email: authUser.email, assignedClassroomId: 'zpSkbUkTvjLCKgqtq2ty' };
            } else if (authUser.uid === 'lqMDWRYrbugIlhVBA083OVpJO3p1') {
                baseProfile = { role: 'Teacher', name: 'Primary 1b Teacher', email: authUser.email, assignedClassroomId: 'j10edcHHi18zdtbFLmPd' };
            } else if (authUser.uid === 'Z1yDssDNRshnMOcnKlxK7wSmhpE3') {
                baseProfile = { role: 'Teacher', name: 'Nursery 2 Teacher', email: authUser.email, assignedClassroomId: 'eTjWpIGq67tOAQkf4ErA' };
            } else if (authUser.uid === '0wYNrCqR0ZTJgEykZ9R1mqvDO5o2') {
                baseProfile = { role: 'Teacher', name: 'Primary 3 Teacher', email: authUser.email, assignedClassroomId: 'ZLq6vszAGuUbLKhwADAJ' };
            } else if (authUser.uid === 'vzT4PhW7g5SipKPScj89DGodBZF2') {
                baseProfile = { role: 'Teacher', name: 'Creche Teacher', email: authUser.email, assignedClassroomId: 'BNy5qe8cbkes4dfKRZLv' };
            } else if (authUser.uid === 'pRcRHW1mSsT49pB5EXjTaB6ID002') {
                baseProfile = { role: 'Teacher', name: 'Primary 2 Teacher', email: 'anitahemba@gmail.com', assignedClassroomId: 'uljYiyQYSZa5acHFakRB' };
            } else if (authUser.uid === 'xM6L5fJj7vUMbT3p4qN2rWcZ8yG2') {
                baseProfile = { role: 'Teacher', name: 'Primary 5 Teacher', email: authUser.email, assignedClassroomId: 'nrmeHRqY7TtrkDxLAGnB' };
            }
            
            const userDocRef = doc(firestore, 'users', authUser.uid);
            const userDoc = await getDoc(userDocRef);
            let firestoreProfile: UserProfile = {};
            if (userDoc.exists()) {
              firestoreProfile = userDoc.data() as UserProfile;
            }

            const finalProfile = { ...baseProfile, ...firestoreProfile };
            
            setUser({ ...authUser, ...finalProfile });

          } catch (e) {
            console.error("Error fetching user profile:", e);
            setUser(authUser as AppUser); // Fallback to authUser without profile
          }
        } else {
          setUser(null);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Auth State Error:", error);
        setUser(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [services]); 

  if (!services) {
    return <MissingConfigErrorDisplay />;
  }

  const value = {
    app: services.firebaseApp,
    auth: services.auth,
    firestore: services.firestore,
    user,
    isLoading,
  };

  return (
    <FirebaseContext.Provider value={value}>
        <FirebaseErrorListener />
        {children}
    </FirebaseContext.Provider>
  );
}


// --- HOOKS ---
export const useFirebase = (): { app: FirebaseApp; auth: Auth; firestore: Firestore; } => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  if (!context.app || !context.auth || !context.firestore) {
    throw new Error('Firebase has not been initialized. Please check your environment variables in the .env file.');
  }
  return { 
    app: context.app, 
    auth: context.auth, 
    firestore: context.firestore,
  };
};

export const useUser = (): { user: AppUser | null, isLoading: boolean, isLoggedIn: boolean } => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a FirebaseProvider.');
    }
    return { user: context.user, isLoading: context.isLoading, isLoggedIn: !context.isLoading && !!context.user };
}

export const useAuth = (): Auth => {
    const context = useContext(FirebaseContext);
    if (context === undefined || !context.auth) {
        throw new Error('useAuth must be used within a FirebaseProvider and Auth must be initialized. Check your .env file.');
    }
    return context.auth;
}

export const useFirestore = (): Firestore => {
    const context = useContext(FirebaseContext);
    if (context === undefined || !context.firestore) {
        throw new Error('useFirestore must be used within a FirebaseProvider and Firestore must be initialized. Check your .env file.');
    }
    return context.firestore;
}

export const useFirebaseApp = (): FirebaseApp => {
    const context = useContext(FirebaseContext);
    if (context === undefined || !context.app) {
        throw new Error('useFirebaseApp must be used within a FirebaseProvider and Firebase App must be initialized. Check your .env file.');
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
