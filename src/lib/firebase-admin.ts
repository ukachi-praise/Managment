import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';

export function getFirebaseAdminApp() {
  const existing = getApps().find((candidate) => candidate.name === 'arms-admin');
  if (existing) return existing;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    const error = new Error('Firebase Admin project configuration is missing.');
    (error as Error & { code?: string }).code = 'admin-config-missing';
    throw error;
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const credential = clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey })
    : applicationDefault();

  return initializeApp({ credential, projectId }, 'arms-admin');
}
