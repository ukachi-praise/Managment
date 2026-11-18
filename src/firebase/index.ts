
// src/firebase/index.ts

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  Auth,
  browserSessionPersistence,
  getAuth,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { logAuthDiagnostic, logAuthDiagnosticError } from '@/lib/auth-diagnostics';

type FirebaseServices = {
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
}

let services: FirebaseServices | null = null;
let initializationFailed = false;

// This function ensures Firebase is initialized only once.
function initializeFirebase(): FirebaseServices | null {
  // If we already tried and failed, don't try again.
  if (initializationFailed) {
      return null;
  }
  // If we already succeeded, return the services.
  if (services) {
    return services;
  }
  
  // Define config inside the function to read env vars at call time
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Check for missing credentials.
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    logAuthDiagnosticError('firebase-initialization-failed', new Error('Required Firebase configuration is missing.'), {
      missingApiKey: !firebaseConfig.apiKey,
      missingProjectId: !firebaseConfig.projectId,
    });
    initializationFailed = true;
    return null;
  }

  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    // Session persistence is isolated to this browser tab and survives refreshes.
    // Initialize it before Auth can restore an older shared local-persistence user.
    const auth = typeof window === 'undefined'
      ? getAuth(app)
      : (() => {
          try {
            return initializeAuth(app, { persistence: browserSessionPersistence });
          } catch (error) {
            // Next.js Fast Refresh can re-run module initialization after Auth
            // has already been initialized in this browser context.
            if ((error as { code?: string })?.code === 'auth/already-initialized') {
              return getAuth(app);
            }
            throw error;
          }
        })();

    services = { 
      firebaseApp: app, 
      auth, 
      firestore: getFirestore(app) 
    };
    logAuthDiagnostic('firebase-initialized', {
      projectId: app.options.projectId,
      authDomainPresent: Boolean(app.options.authDomain),
      appIdPresent: Boolean(app.options.appId),
      database: '(default)',
    });
    return services;
  } catch (e) {
    logAuthDiagnosticError('firebase-initialization-failed', e);
    initializationFailed = true;
    return null;
  }
}

// Export the function for use in the provider
export { initializeFirebase };

// The barrel file exports can remain if they are used elsewhere,
// but the core initialization logic is now centralized and safe.
export { FirebaseProvider, useFirebase, useUser, useAuth, useFirestore, useFirebaseApp, useMemoFirebase } from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
