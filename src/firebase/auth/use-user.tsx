'use client';

import { useFirebase } from '@/firebase/provider';
import { useUserProfile, type UserProfile } from './use-user-profile';
import type { User } from 'firebase/auth';

// Combine Firebase Auth user with Firestore profile
export type AppUser = User & UserProfile;

// Return type for useUser()
export interface UserHookResult {
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

/**
 * Hook specifically for accessing the authenticated user's state,
 * combined with their profile data from Firestore.
 * @returns {UserHookResult} Object with combined user data, loading, and error state.
 */
export const useUser = (): UserHookResult => {
  const { user: authUser, isUserLoading: isAuthLoading, userError: authError } = useFirebase();
  const { profile, isLoading: isProfileLoading, error: profileError } = useUserProfile(authUser?.uid);

  // If there's an auth user and we have their profile, combine them.
  const combinedUser = authUser && profile ? { ...authUser, ...profile } : null;

  return {
    user: combinedUser,
    isUserLoading: isAuthLoading || (!!authUser && isProfileLoading), // Loading if auth is loading, or if we have an auth user but are still fetching their profile.
    userError: authError || profileError,
  };
};
