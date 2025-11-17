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

// This function ensures Firebase is initialized only once.
function initializeFirebase() {
  const apps = getApps();
  if (apps.length > 0) {
    return {
      firebaseApp: apps[0],
      auth: getAuth(apps[0]),
      firestore: getFirestore(apps[0]),
    };
  }
  
  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  
  return { firebaseApp, auth, firestore };
}

// Export the singleton instances for use throughout the app
export { initializeFirebase };

// The barrel file exports can remain if they are used elsewhere,
// but the core initialization logic is now centralized and safe.
export { FirebaseProvider, useFirebase, useUser, useAuth, useFirestore, useFirebaseApp, useMemoFirebase } from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
