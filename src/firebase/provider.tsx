'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo, DependencyList } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { initializeFirebase } from '@/firebase';
import { logAuthDiagnostic, logAuthDiagnosticError } from '@/lib/auth-diagnostics';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

async function fetchTrustedProfile(authUser: User): Promise<Record<string, unknown>> {
  const token = await authUser.getIdToken();
  const response = await fetch('/api/auth/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || 'Unable to resolve the account profile.');
    (error as { code?: string }).code = body.code || `profile/${response.status}`;
    throw error;
  }
  return body.profile as Record<string, unknown>;
}

interface FirebaseContextState {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  user: AppUser | null;
  isLoading: boolean;
  profileError: string | null;
}

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
        <p className="text-sm">The application cannot connect to Firebase because its configuration is incomplete.</p>
      </CardContent>
    </Card>
  </div>
);

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
    logAuthDiagnostic('auth-state-listener-initialized', {
      projectId: firestore.app.options.projectId,
      database: '(default)',
    });

    let unsubscribeProfile: (() => void) | undefined;
    let profileRequestId = 0;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (authUser) => {
        const requestId = ++profileRequestId;
        unsubscribeProfile?.();
        unsubscribeProfile = undefined;

        if (!authUser) {
          setUser(null);
          setProfileError(null);
          setIsLoading(false);
          return;
        }

        logAuthDiagnostic('user-authenticated', { uidPresent: true });
        logAuthDiagnostic('authenticated-uid-obtained', { uidPresent: true });
        setUser(null);
        setProfileError(null);
        setIsLoading(true);

        const baseProfile: UserProfile = { email: authUser.email };
        const userDocRef = doc(firestore, 'users', authUser.uid);

        logAuthDiagnostic('profile-document-path-constructed', {
          path: 'users/{authenticatedUid}',
          collection: userDocRef.parent.id,
          documentIdPresent: Boolean(userDocRef.id),
        });

        const applyProfile = (profileData: Record<string, unknown>) => {
          const profileUid = typeof profileData.uid === 'string' ? profileData.uid : profileData.id;
          if (typeof profileUid === 'string' && profileUid !== authUser.uid) {
            setUser(null);
            setProfileError('The account profile UID does not match your signed-in account. Contact an administrator.');
            setIsLoading(false);
            return;
          }
          const role = normalizeRole(profileData.role);
          const statuses = [profileData.status, profileData.accountStatus]
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim().toLowerCase());
          if (!role) {
            setUser(null);
            setProfileError('Your account profile is incomplete or has an unsupported role. Contact an administrator.');
            setIsLoading(false);
            return;
          }
          if (statuses.some((status) => ['disabled', 'inactive', 'suspended'].includes(status))) {
            setUser(null);
            setProfileError('This account is disabled. Contact your administrator.');
            setIsLoading(false);
            return;
          }
          if (statuses.includes('pending')) {
            setUser(null);
            setProfileError('This account is waiting for administrator approval.');
            setIsLoading(false);
            return;
          }
          const finalProfile: UserProfile = {
            ...baseProfile,
            ...profileData,
            role,
          };
          setUser({ ...authUser, ...finalProfile });
          setProfileError(null);
          setIsLoading(false);
        };

        const subscribeToProfile = () => {
          logAuthDiagnostic('profile-listener-started', {
            operation: 'onSnapshot',
            path: 'users/{authenticatedUid}',
          });
          unsubscribeProfile = onSnapshot(userDocRef, (snapshot) => {
            if (requestId !== profileRequestId || auth.currentUser?.uid !== authUser.uid || !snapshot.exists()) return;
            applyProfile(snapshot.data());
          }, (error) => {
            logAuthDiagnosticError('profile-listener-failed', error, {
              operation: 'onSnapshot',
              path: 'users/{authenticatedUid}',
            });
          });
        };

        void (async () => {
          try {
            let profileData: Record<string, unknown>;
            try {
              logAuthDiagnostic('profile-read-started', {
                operation: 'getDoc',
                path: 'users/{authenticatedUid}',
                projectId: firestore.app.options.projectId,
              });
              const profileSnapshot = await getDoc(userDocRef);
              if (requestId !== profileRequestId || auth.currentUser?.uid !== authUser.uid) return;
              if (!profileSnapshot.exists()) throw Object.assign(new Error('Profile document is missing.'), { code: 'profile/not-found' });
              profileData = profileSnapshot.data();
              logAuthDiagnostic('profile-read-completed', { operation: 'getDoc', documentExists: true });
            } catch (readError) {
              const code = (readError as { code?: string }).code;
              const mayBeMissingProfile = code === 'profile/not-found' || code === 'permission-denied' || code === 'firestore/permission-denied';
              if (!mayBeMissingProfile) throw readError;
              logAuthDiagnostic('trusted-profile-resolution-started', { reason: code === 'profile/not-found' ? 'missing-profile' : 'profile-read-denied' });
              profileData = await fetchTrustedProfile(authUser);
            }
            if (requestId !== profileRequestId || auth.currentUser?.uid !== authUser.uid) return;
            logAuthDiagnostic('trusted-profile-resolution-completed', { profileResolved: true });
            const role = normalizeRole(profileData.role);
            logAuthDiagnostic('role-validation-completed', {
              valid: Boolean(role),
              role: role || null,
            });
            applyProfile(profileData);
            logAuthDiagnostic('teacher-assignment-lookup-completed', {
              status: role === 'Teacher' ? 'resolved-after-authentication' : 'not-applicable',
              resolvedClassroomIdPresent: Boolean(profileData.assignedClassroomId),
            });
            subscribeToProfile();
          } catch (error: any) {
            if (requestId !== profileRequestId || auth.currentUser?.uid !== authUser.uid) return;
            const code = error?.code || 'unknown';
            const message = error?.message || (code === 'admin-config-missing'
              ? 'Server profile provisioning is not configured for this environment.'
              : code === 'unavailable' || code === 'deadline-exceeded'
                ? 'The profile service is temporarily unavailable. Please try again.'
                : 'Unable to load your account profile.');
            logAuthDiagnosticError('profile-read-failed', error, {
              operation: 'trusted-profile-resolution',
              path: 'users/{authenticatedUid}',
              projectId: firestore.app.options.projectId,
            });
            setProfileError(message);
            setUser({ ...authUser, ...baseProfile });
            setIsLoading(false);
          }
        })();
      },
      (error) => {
        profileRequestId++;
        unsubscribeProfile?.();
        unsubscribeProfile = undefined;
        logAuthDiagnosticError('auth-state-listener-failed', error, { operation: 'onAuthStateChanged' });
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

  if (!services) return <MissingConfigErrorDisplay />;

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

export const useFirebase = (): { app: FirebaseApp; auth: Auth; firestore: Firestore } => {
  const context = useContext(FirebaseContext);
  if (context === undefined) throw new Error('useFirebase must be used within a FirebaseProvider.');
  if (!context.app || !context.auth || !context.firestore) throw new Error('Firebase has not been initialized.');
  return { app: context.app, auth: context.auth, firestore: context.firestore };
};

export const useUser = (): { user: AppUser | null; isLoading: boolean; isLoggedIn: boolean; profileError: string | null } => {
  const context = useContext(FirebaseContext);
  if (context === undefined) throw new Error('useUser must be used within a FirebaseProvider.');
  return {
    user: context.user,
    isLoading: context.isLoading,
    isLoggedIn: !context.isLoading && !!context.user,
    profileError: context.profileError,
  };
};

export const useAuth = (): Auth => {
  const context = useContext(FirebaseContext);
  if (context === undefined || !context.auth) throw new Error('Firebase Auth is not initialized.');
  return context.auth;
};

export const useFirestore = (): Firestore => {
  const context = useContext(FirebaseContext);
  if (context === undefined || !context.firestore) throw new Error('Firestore is not initialized.');
  return context.firestore;
};

export const useFirebaseApp = (): FirebaseApp => {
  const context = useContext(FirebaseContext);
  if (context === undefined || !context.app) throw new Error('Firebase App is not initialized.');
  return context.app;
};

type MemoFirebase<T> = T & { __memo?: boolean };

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | MemoFirebase<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoized = useMemo(factory, deps);
  if (memoized && typeof memoized === 'object' && !('__memo' in memoized)) {
    try {
      (memoized as MemoFirebase<T>).__memo = true;
    } catch {}
  }
  return memoized;
}
