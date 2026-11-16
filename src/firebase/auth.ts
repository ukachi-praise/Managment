'use client';

import {
  Auth,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  UserCredential,
} from 'firebase/auth';

/** Sign in only after configuring persistence for this browser tab. */
export async function signInWithSessionPersistence(
  auth: Auth,
  email: string,
  password: string
): Promise<UserCredential> {
  await setPersistence(auth, browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}
