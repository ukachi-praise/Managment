import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// This file is being deprecated in favor of initializing Firebase directly
// within the provider to ensure environment variables are handled correctly.
// The config values will be sourced from there. You can remove the contents
// of this file or leave it as is. For now, we will leave the old config
// for reference but it is no longer actively used by the provider.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// The following exports are being deprecated and should not be used.
// They are left here to prevent breaking changes in other files that have not been updated yet.
let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

try {
    if (typeof window !== 'undefined') {
        app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        auth = getAuth(app);
        firestore = getFirestore(app);
    }
} catch (e) {
    console.error("Firebase initialization in config.ts failed. This is expected if the provider is initializing Firebase.");
}


export { app, auth, firestore };
