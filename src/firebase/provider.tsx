
'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo, DependencyList } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { initializeFirebase } from '@/firebase'; // SAFE IMPORT

// Get the singleton instances of Firebase services
const { firebaseApp, auth, firestore } = initializeFirebase();

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
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  user: AppUser | null;
  isLoading: boolean;
}

// --- CONTEXT ---
const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

// --- PROVIDER COMPONENT ---
export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const services = { app: firebaseApp, auth, firestore };

  useEffect(() => {
    const { auth, firestore } = services;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (authUser) => {
        if (authUser) {
          try {
            const userDocRef = doc(firestore, 'users', authUser.uid);
            const userDoc = await getDoc(userDocRef);

            let profile: UserProfile = {};
            if (userDoc.exists()) {
              profile = userDoc.data() as UserProfile;
            } else {
              // Handle hardcoded users as a fallback
              if (authUser.uid === 'GOpbb9SsavhpATk1p0KNmPGGQ0S2') {
                profile = { role: 'Admin', name: 'Admin User', email: authUser.email || 'admin@example.com' };
              } else if (authUser.uid === 'u3krP4g02DgPJ6Avv1XhVNvvb8R2') {
                profile = { role: 'Teacher', name: 'Primary 4 Teacher', email: authUser.email || 'teacher@example.com', assignedClassroomId: 'mG24k9p8T7y0r5B3s1A9' };
              } else if (authUser.uid === 'YAemjwMFEAOnvp6RL6STw3GJK0I2') {
                profile = { role: 'Teacher', name: 'Pre-Nursery Teacher', email: authUser.email || 'teacher.prenursery@example.com', assignedClassroomId: 'pre-nursery-id' };
              } else if (authUser.uid === 'VEjzC6td3HNfWBg4CjNnCtSlC7g1') {
                profile = { role: 'Teacher', name: 'Nursery 1b Teacher', email: authUser.email || 'teacher.nursery1b@example.com', assignedClassroomId: 'nursery-1b-id' };
              } else if (authUser.uid === 'vhyAkcnmE2OD9cheoDeXdsdUL1a2') {
                profile = { role: 'Teacher', name: 'Nursery 1a Teacher', email: authUser.email || 'teacher.nursery1a@example.com', assignedClassroomId: 'nursery-1a-id' };
              } else if (authUser.uid === 'lqMDWRYrbugIlhVBA083OVpJO3p1') {
                profile = { role: 'Teacher', name: 'Primary 1b Teacher', email: authUser.email || 'teacher.primary1b@example.com', assignedClassroomId: 'primary-1b-id' };
              } else if (authUser.uid === 'Z1yDssDNRshnMOcnKlxK7wSmhpE3') {
                profile = { role: 'Teacher', name: 'Nursery 2 Teacher', email: authUser.email || 'teacher.nursery2@example.com', assignedClassroomId: 'nursery-2-id' };
              }
            }
            setUser({ ...authUser, ...profile });
          } catch (e) {
            console.error("Error fetching user profile:", e);
            setUser(authUser as AppUser); // Fallback to authUser without profile
          }
        } else {
          // User is signed out
          setUser(null);
        }
        // This is the key: loading is false only after all auth logic is complete.
        setIsLoading(false);
      },
      (error) => {
        console.error("Auth State Error:", error);
        setUser(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const value = {
    app: services.app,
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
export const useFirebase = (): Omit<FirebaseContextState, 'user' | 'isLoading' > => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
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
