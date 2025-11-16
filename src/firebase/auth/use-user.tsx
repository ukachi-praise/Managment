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

  // Determine the combined loading state. Loading is true if:
  // 1. The initial auth state is still being determined (covered by useFirebase's gate).
  // 2. We have an authenticated user, but their Firestore profile is still loading.
  const isUserLoading = isAuthLoading || (!!authUser && isProfileLoading);
  
  // If we are still loading, or if there's no authenticated user, the user is null.
  if (isUserLoading || !authUser) {
    return {
      user: null,
      isUserLoading: isUserLoading,
      userError: authError || profileError,
    };
  }
  
  // If we have an authUser but are done loading the profile (and it might be null/non-existent),
  // we can now construct the final user object.
  const combinedUser = profile ? { ...authUser, ...profile } : authUser;

  return {
    user: combinedUser as AppUser,
    isUserLoading: false,
    userError: authError || profileError,
  };
};
