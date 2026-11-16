'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo, DependencyList } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { initializeFirebase } from '@/firebase'; // SAFE IMPORT
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';


// --- PROFILE TYPE ---
export type UserProfile = {
  role?: 'SuperAdmin' | 'Admin' | 'Teacher';
  name?: string;
  email?: string | null;
  assignedClassroomId?: string;
  phoneNumber?: string | null;
};
export type AppUser = User & UserProfile;

function normalizeRole(value: unknown): UserProfile['role'] {
  const role = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (role === 'teacher') return 'Teacher';
  if (role === 'admin') return 'Admin';
  if (role === 'superadmin' || role === 'super admin') return 'SuperAdmin';
  return undefined;
}

// --- CONTEXT STATE ---
interface FirebaseContextState {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  user: AppUser | null;
  isLoading: boolean;
  profileError: string | null;
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
  const [profileError, setProfileError] = useState<string | null>(null);
  
  const services = useMemo(() => initializeFirebase(), []);

  useEffect(() => {
    if (!services) {
      setIsLoading(false);
      return;
    }

    const { auth, firestore } = services;

    let unsubscribeProfile: (() => void) | undefined;
    let profileRequestId = 0;

    // Keep one profile listener for the current identity; a listener created
    // inside an auth callback cannot be cleaned up by returning from that callback.
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (authUser) => {
        const requestId = ++profileRequestId;
        unsubscribeProfile?.();
        unsubscribeProfile = undefined;

        if (authUser) {
          setUser(null);
          setProfileError(null);
          setIsLoading(true);

          // Firestore is the source of truth for authorization and classroom
          // assignment. Do not fall back to stale UID-specific role or class data.
          const baseProfile: UserProfile = { email: authUser.email };

          const applyProfile = (profileData: Record<string, unknown>) => {
            const finalProfile: UserProfile = {
              ...baseProfile,
              ...profileData,
              role: normalizeRole(profileData.role),
            };
            setUser({ ...authUser, ...finalProfile });
            setProfileError(null);
            setIsLoading(false);
          };

          const userDocRef = doc(firestore, 'users', authUser.uid);
          void (async () => {
            try {
              console.info('[Firebase] Profile lookup started', { projectId: firestore.app.options.projectId, uid: authUser.uid });
              const initialSnapshot = await getDoc(userDocRef);
              if (requestId !== profileRequestId || auth.currentUser?.uid !== authUser.uid) return;
              if (!initialSnapshot.exists()) {
                const message = `No Firestore profile exists for authenticated user ${authUser.uid}.`;
                console.error(message);
                setProfileError(message);
                setUser({ ...authUser, ...baseProfile });
                setIsLoading(false);
                return;
              }
              console.info('[Firebase] Profile document found', { projectId: firestore.app.options.projectId, uid: authUser.uid });
              applyProfile(initialSnapshot.data());
              unsubscribeProfile = onSnapshot(userDocRef, (snapshot) => {
                if (requestId !== profileRequestId || auth.currentUser?.uid !== authUser.uid || !snapshot.exists()) return;
                applyProfile(snapshot.data());
              }, (error) => {
                // The authenticated profile is already usable. Keep it available
                // during transient listener/network failures and log the stage.
                console.error('[Firebase] Profile listener failed', { code: error.code, message: error.message });
              });
            } catch (error: any) {
              if (requestId !== profileRequestId || auth.currentUser?.uid !== authUser.uid) return;
              const code = error?.code || 'unknown';
              const message = code === 'permission-denied'
                ? 'Firestore denied access to the authenticated user profile.'
                : code === 'unavailable' || code === 'deadline-exceeded'
                  ? 'Firestore is temporarily unavailable while loading the user profile.'
                  : error?.message || 'Unable to load your Firestore profile.';
              console.error('[Firebase] Profile lookup failed', { code, message, projectId: firestore.app.options.projectId, uid: authUser.uid });
              setProfileError(message);
              setUser({ ...authUser, ...baseProfile });
              setIsLoading(false);
            }
          })();
        } else {
          setUser(null);
          setProfileError(null);
          setIsLoading(false);
        }
      },
      (error) => {
        profileRequestId++;
        unsubscribeProfile?.();
        unsubscribeProfile = undefined;
        console.error("Auth State Error:", error);
        setUser(null);
        setProfileError(error.message || 'Unable to verify your account profile.');
        setIsLoading(false);
      }
    );

    return () => {
      profileRequestId++;
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
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
    profileError,
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

export const useUser = (): { user: AppUser | null, isLoading: boolean, isLoggedIn: boolean, profileError: string | null } => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a FirebaseProvider.');
    }
    return { user: context.user, isLoading: context.isLoading, isLoggedIn: !context.isLoading && !!context.user, profileError: context.profileError };
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
