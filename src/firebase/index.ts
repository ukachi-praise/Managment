
// src/firebase/index.ts

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

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
  
  // Check for missing credentials.
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn(
      'Firebase config is missing. Please add your Firebase credentials to your .env file.'
    );
    initializationFailed = true;
    return null;
  }

  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    services = { 
      firebaseApp: app, 
      auth: getAuth(app), 
      firestore: getFirestore(app) 
    };
    return services;
  } catch (e) {
    console.error("Error initializing Firebase:", e);
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
