import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

type ApprovedAccount = {
  role: 'SuperAdmin' | 'Admin' | 'Teacher';
};

const APPROVED_ACCOUNT_PROFILES: Record<string, ApprovedAccount> = {
  GOpbb9SsavhpATk1p0KNmPGGQ0S2: { role: 'SuperAdmin' },
  WRbg0T3XA7eIpFFb9amDgvii12x1: { role: 'Admin' },
  vzT4PhW7g5SipKPScj89DGodBZF2: { role: 'Teacher' },
  Z1yDssDNRshnMOcnKlxK7wSmhpE3: { role: 'Teacher' },
  Ur1uMq0uIfWUQb6t26Nixmn1fM82: { role: 'Teacher' },
  YAemjwMFEAOnvp6RL6STw3GJK0I2: { role: 'Teacher' },
  G0WTyeJ3o6ejUQWeta5A5QAtwIu1: { role: 'Teacher' },
  UJ71VwEZhhVclFS8FdeVEL1jH1C3: { role: 'Teacher' },
  pRcRHW1mSsT49pB5EXjTaB6ID002: { role: 'Teacher' },
  zH3t6T3iwLWAerunaTpkBuXeoes2: { role: 'Teacher' },
  lqMDWRYrbugIlhVBA083OVpJO3p1: { role: 'Teacher' },
  prmWHCNPbde4mruYqBpkpQoaKd73: { role: 'Teacher' },
  W39EbzfNJCbK6xL07UnpOHNPgV82: { role: 'Teacher' },
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

function isInactive(profile: Record<string, unknown>) {
  const statuses = [profile.status, profile.accountStatus].filter((value): value is string => typeof value === 'string').map((value) => value.trim().toLowerCase());
  return statuses.some((status) => ['disabled', 'inactive', 'suspended'].includes(status));
}

function normalizeRole(value: unknown) {
  const role = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (role === 'superadmin') return 'SuperAdmin';
  if (role === 'admin') return 'Admin';
  if (role === 'teacher') return 'Teacher';
  return null;
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return errorResponse(401, 'unauthenticated', 'Authentication is required.');

    const app = getFirebaseAdminApp();
    const adminAuth = getAuth(app);
    const decodedToken = await adminAuth.verifyIdToken(token, true);
    const authRecord = await adminAuth.getUser(decodedToken.uid);
    if (authRecord.disabled) return errorResponse(403, 'account-disabled', 'This account is disabled. Contact your administrator.');
    const projectId = app.options.projectId;
    if (!projectId) return errorResponse(500, 'admin-config-missing', 'Firebase Admin project configuration is missing.');

    const firestore = getFirestore(app);
    const profileRef = firestore.collection('users').doc(decodedToken.uid);
    const profileSnapshot = await profileRef.get();
    const existingProfile = profileSnapshot.exists ? (profileSnapshot.data() as Record<string, unknown>) : null;

    if (existingProfile && isInactive(existingProfile)) {
      return errorResponse(403, 'account-disabled', 'This account is disabled. Contact your administrator.');
    }

    if ([existingProfile?.status, existingProfile?.accountStatus].some((status) => String(status ?? '').trim().toLowerCase() === 'pending'))
      return errorResponse(403, 'account-pending', 'This account is waiting for administrator approval.');

    const approvedAccount = APPROVED_ACCOUNT_PROFILES[decodedToken.uid];
    if (!existingProfile && !approvedAccount) {
      return errorResponse(404, 'profile-not-found', 'No approved profile exists for this account.');
    }

    const profileRole = normalizeRole(existingProfile?.role);

    let profile = existingProfile;
    if (!existingProfile) {
      profile = {
        id: decodedToken.uid,
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'Staff member',
        email: decodedToken.email || null,
        role: approvedAccount!.role,
        phoneNumber: '',
      };
      try {
        await profileRef.create(profile);
      } catch (error) {
        // Concurrent retries are safe: use the winner's complete profile.
        if ((error as { code?: number | string }).code !== 6 && (error as { code?: string }).code !== 'already-exists') throw error;
        const winner = await profileRef.get();
        if (!winner.exists) throw error;
        profile = winner.data() as Record<string, unknown>;
      }
      const created = await profileRef.get();
      if (created.exists) profile = created.data() as Record<string, unknown>;
    } else {
      const storedUid = typeof existingProfile.uid === 'string' ? existingProfile.uid
        : typeof existingProfile.id === 'string' ? existingProfile.id
          : decodedToken.uid;
      const actualUid = storedUid;
      if (actualUid !== decodedToken.uid) return errorResponse(403, 'profile-uid-mismatch', 'The account profile identity is invalid.');
      if (!profileRole && approvedAccount) {
        await profileRef.set({ role: approvedAccount.role, ...(!existingProfile.id ? { id: decodedToken.uid } : {}) }, { merge: true });
        profile = { ...existingProfile, role: approvedAccount.role, ...(!existingProfile.id ? { id: decodedToken.uid } : {}) };
      }
    }

    if (!profile) return errorResponse(500, 'profile-resolution-failed', 'The account profile could not be resolved.');
    const role = normalizeRole(profile.role);
    if (!role) return errorResponse(422, 'profile-invalid', 'The account profile is incomplete or has an unsupported role.');
    if (profile.status && !['active', 'approved'].includes(String(profile.status).trim().toLowerCase()))
      return errorResponse(403, 'account-pending', 'This account is not approved for access.');
    return NextResponse.json({ profile: { ...profile, role } });
  } catch (error) {
    const firebaseError = error as { code?: string; message?: string };
    const message = firebaseError.message || 'Unable to resolve the account profile.';
    const missingCredentials = /default credentials|credential.*configured|could not load/i.test(message);
    const code = missingCredentials ? 'admin-config-missing' : firebaseError.code || 'profile-resolution-failed';
    const status = code === 'auth/id-token-expired' || code === 'auth/argument-error'
      ? 401
      : code === 'admin-config-missing'
        ? 503
        : 500;
    return errorResponse(status, code, missingCredentials ? 'Firebase Admin credentials are not configured.' : message);
  }
}
