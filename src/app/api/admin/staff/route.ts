import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

type StaffRole = 'Admin' | 'Teacher';
const PROTECTED_SUPERADMIN_UIDS = new Set(['GOpbb9SsavhpATk1p0KNmPGGQ0S2']);

function respond(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

export async function POST(request: Request) {
  try {
    const bearer = request.headers.get('authorization') || '';
    const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
    if (!token) return respond(401, 'unauthenticated', 'Sign in with a SuperAdmin account to manage staff.');

    const app = getFirebaseAdminApp();
    const adminAuth = getAuth(app);
    const caller = await adminAuth.verifyIdToken(token, true);
    const callerAccount = await adminAuth.getUser(caller.uid);
    if (callerAccount.disabled) return respond(403, 'forbidden', 'Disabled accounts cannot manage staff.');

    const firestore = getFirestore(app);
    const callerSnapshot = await firestore.collection('users').doc(caller.uid).get();
    const callerProfile = callerSnapshot.data();
    const callerRole = String(callerProfile?.role || '').trim().toLowerCase().replace(/\s+/g, '');
    const callerStatus = String(callerProfile?.status ?? callerProfile?.accountStatus ?? 'active').toLowerCase();
    if (!callerSnapshot.exists || callerRole !== 'superadmin' || ['disabled', 'inactive', 'suspended', 'pending'].includes(callerStatus)) {
      return respond(403, 'forbidden', 'Only an active SuperAdmin can assign staff roles.');
    }

    const payload = await request.json();
    if (payload.action === 'create') {
      const name = typeof payload.name === 'string' ? payload.name.trim() : '';
      const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
      const password = typeof payload.password === 'string' ? payload.password : '';
      const role: StaffRole | null = payload.role === 'Admin' || payload.role === 'Teacher' ? payload.role : null;
      const assignedClassroomId = role === 'Teacher' && typeof payload.assignedClassroomId === 'string'
        ? payload.assignedClassroomId.trim() || null
        : null;
      if (!name || !email || !password || password.length < 6 || !role) {
        return respond(400, 'invalid-input', 'Provide a name, email, password of at least 6 characters, and an Admin or Teacher role.');
      }
      let classroomRef: DocumentReference | null = null;
      if (assignedClassroomId) {
        classroomRef = firestore.collection('classrooms').doc(assignedClassroomId);
        const classroom = await classroomRef.get();
        if (!classroom.exists) return respond(404, 'classroom-not-found', 'Choose an existing classroom.');
        if (classroom.data()?.teacherId) return respond(409, 'classroom-unavailable', 'That classroom is already assigned to another teacher.');
      }

      let createdAccount;
      try {
        createdAccount = await adminAuth.createUser({ email, password, displayName: name, disabled: false });
      } catch (error) {
        if ((error as { code?: string }).code === 'auth/email-already-exists') {
          return respond(409, 'email-already-exists', 'A Firebase Auth account already uses this email. Use the existing account UID to assign its role.');
        }
        throw error;
      }

      const newProfileRef = firestore.collection('users').doc(createdAccount.uid);
      try {
        await firestore.runTransaction(async transaction => {
          if (classroomRef) {
            const classroomSnapshot = await transaction.get(classroomRef);
            if (!classroomSnapshot.exists || classroomSnapshot.data()?.teacherId) throw new Error('classroom-unavailable');
          }
          transaction.create(newProfileRef, {
            id: createdAccount.uid,
            name,
            email: createdAccount.email || email,
            phoneNumber: '',
            role,
            ...(assignedClassroomId ? { assignedClassroomId } : {}),
          });
          if (classroomRef) transaction.set(classroomRef, { teacherId: createdAccount.uid, teacherName: name }, { merge: true });
        });
      } catch (error) {
        // Avoid silently orphaning the new identity; the UID is returned for a retry/recovery.
        console.error('[admin/staff] account created but profile provisioning failed', { uid: createdAccount.uid, message: (error as Error).message });
        return respond(500, 'profile-provisioning-failed', `Auth account ${createdAccount.uid} was created, but its profile could not be saved. Retry with this UID or remove the Auth account in Firebase Console.`);
      }
      return NextResponse.json({ ok: true, uid: createdAccount.uid, role });
    }

    const uid = typeof payload.uid === 'string' ? payload.uid.trim() : '';
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const requestedRole = payload.role;
    const role: StaffRole | null = requestedRole === 'Admin' || requestedRole === 'Teacher' ? requestedRole : null;
    const requestedClassroom = typeof payload.assignedClassroomId === 'string' ? payload.assignedClassroomId.trim() : '';
    const assignedClassroomId = role === 'Teacher' && requestedClassroom && requestedClassroom !== 'unassigned' ? requestedClassroom : null;
    if (!uid || !role || (payload.name !== undefined && !name)) return respond(400, 'invalid-input', 'Provide a Firebase Auth UID, name, and either Admin or Teacher role.');

    const targetAccount = await adminAuth.getUser(uid);
    if (targetAccount.disabled) return respond(400, 'account-disabled', 'Enable the Firebase Auth account before assigning a role.');
    if (uid === caller.uid) return respond(400, 'self-role-change', 'You cannot change your own role from this screen.');

    const userRef = firestore.collection('users').doc(uid);
    const newClassroomRef = assignedClassroomId ? firestore.collection('classrooms').doc(assignedClassroomId) : null;
    await firestore.runTransaction(async (transaction) => {
      const latestUser = await transaction.get(userRef);
      const latestProfile = latestUser.data();
      if (typeof latestProfile?.id === 'string' && latestProfile.id !== uid) throw new Error('profile-uid-mismatch');
      if (String(latestProfile?.role || '').trim().toLowerCase().replace(/\s+/g, '') === 'superadmin') {
        throw new Error('protected-superadmin');
      }
      const targetStatuses = [latestProfile?.status, latestProfile?.accountStatus].map((value) => String(value ?? '').trim().toLowerCase());
      if (targetStatuses.some((status) => ['disabled', 'inactive', 'suspended'].includes(status))) throw new Error('account-disabled');
      const previousClassroomId = typeof latestProfile?.assignedClassroomId === 'string' ? latestProfile.assignedClassroomId : null;
      const oldClassroomRef = previousClassroomId ? firestore.collection('classrooms').doc(previousClassroomId) : null;
      const [newClassroom, oldClassroom] = await Promise.all([
        newClassroomRef ? transaction.get(newClassroomRef) : Promise.resolve(null),
        oldClassroomRef && oldClassroomRef.path !== newClassroomRef?.path ? transaction.get(oldClassroomRef) : Promise.resolve(null),
      ]);
      if (newClassroomRef && (!newClassroom?.exists || (newClassroom.data()?.teacherId && newClassroom.data()?.teacherId !== uid))) {
        throw new Error('classroom-unavailable');
      }

      const patch: Record<string, unknown> = {
        id: uid,
        name: name || latestProfile?.name || targetAccount.displayName || targetAccount.email?.split('@')[0] || 'Staff member',
        email: targetAccount.email || latestProfile?.email || null,
        role,
        phoneNumber: typeof latestProfile?.phoneNumber === 'string' ? latestProfile.phoneNumber : '',
        ...(assignedClassroomId ? { assignedClassroomId } : { assignedClassroomId: FieldValue.delete() }),
      };
      transaction.set(userRef, patch, { merge: true });

      if (oldClassroomRef && oldClassroomRef.path !== newClassroomRef?.path && oldClassroom?.exists && oldClassroom.data()?.teacherId === uid) {
        transaction.update(oldClassroomRef, { teacherId: FieldValue.delete(), teacherName: FieldValue.delete() });
      }
      if (newClassroomRef && newClassroom) {
        transaction.set(newClassroomRef, {
          teacherId: uid,
          teacherName: patch.name,
        }, { merge: true });
      }
    });

    return NextResponse.json({ ok: true, uid, role });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = (error as Error).message;
    if (message === 'protected-superadmin') return respond(403, message, 'SuperAdmin roles are protected.');
    if (message === 'profile-uid-mismatch') return respond(403, message, 'The stored staff ID does not match this Firebase Auth UID.');
    if (message === 'account-disabled') return respond(403, message, 'This Firebase account profile is disabled. Enable it through the account recovery process before assigning a role.');
    if (message === 'classroom-unavailable') return respond(409, message, 'That classroom does not exist or is already assigned to another teacher.');
    if (code === 'auth/user-not-found') return respond(404, 'auth-user-not-found', 'No Firebase Auth account exists for that UID.');
    if (code === 'auth/id-token-expired' || code === 'auth/argument-error') return respond(401, 'unauthenticated', 'Your session expired. Sign in again.');
    console.error('[admin/staff] role assignment failed', { code, message });
    return respond(500, 'staff-assignment-failed', 'The staff profile could not be saved. Try again or check the server configuration.');
  }
}

export async function DELETE(request: Request) {
  try {
    const bearer = request.headers.get('authorization') || '';
    const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
    if (!token) return respond(401, 'unauthenticated', 'Sign in with a SuperAdmin account to remove staff.');

    const app = getFirebaseAdminApp();
    const adminAuth = getAuth(app);
    const caller = await adminAuth.verifyIdToken(token, true);
    const callerAccount = await adminAuth.getUser(caller.uid);
    if (callerAccount.disabled) return respond(403, 'forbidden', 'Disabled accounts cannot manage staff.');

    const firestore = getFirestore(app);
    const callerSnapshot = await firestore.collection('users').doc(caller.uid).get();
    const callerProfile = callerSnapshot.data();
    const callerRole = String(callerProfile?.role || '').trim().toLowerCase().replace(/\s+/g, '');
    const callerStatus = String(callerProfile?.status ?? callerProfile?.accountStatus ?? 'active').toLowerCase();
    if (!callerSnapshot.exists || callerRole !== 'superadmin' || ['disabled', 'inactive', 'suspended', 'pending'].includes(callerStatus)) {
      return respond(403, 'forbidden', 'Only an active SuperAdmin can permanently delete staff.');
    }

    const payload = await request.json();
    const uid = typeof payload.uid === 'string' ? payload.uid.trim() : '';
    if (!uid) return respond(400, 'invalid-input', 'Provide the Firebase Auth UID to delete.');
    if (uid === caller.uid || PROTECTED_SUPERADMIN_UIDS.has(uid)) return respond(403, 'protected-account', 'SuperAdmin accounts cannot be deleted from Staff Accounts.');

    const profileRef = firestore.collection('users').doc(uid);
    const profileSnapshot = await profileRef.get();
    const profile = profileSnapshot.data();
    if (String(profile?.role || '').trim().toLowerCase().replace(/\s+/g, '') === 'superadmin') {
      return respond(403, 'protected-account', 'SuperAdmin accounts cannot be deleted from Staff Accounts.');
    }
    if (typeof profile?.id === 'string' && profile.id !== uid) return respond(403, 'profile-uid-mismatch', 'The stored staff ID does not match this Firebase Auth UID.');
    if (!profileSnapshot.exists || !profile) return respond(404, 'staff-not-found', 'No staff profile exists for this UID.');
    if (!['admin', 'teacher'].includes(String(profile?.role || '').trim().toLowerCase())) {
      return respond(400, 'not-staff', 'Only Admin and Teacher accounts can be deleted here.');
    }

    try {
      await adminAuth.deleteUser(uid);
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    }

    const assignedClassroomId = typeof profile.assignedClassroomId === 'string' ? profile.assignedClassroomId : null;
    const classroomRef = assignedClassroomId ? firestore.collection('classrooms').doc(assignedClassroomId) : null;
    await firestore.runTransaction(async transaction => {
      const [latestProfile, classroom] = await Promise.all([
        transaction.get(profileRef),
        classroomRef ? transaction.get(classroomRef) : Promise.resolve(null),
      ]);
      if (!latestProfile.exists) return;
      if (String(latestProfile.data()?.role || '').trim().toLowerCase().replace(/\s+/g, '') === 'superadmin') throw new Error('protected-account');
      transaction.delete(profileRef);
      if (classroomRef && classroom?.exists && classroom.data()?.teacherId === uid) {
        transaction.update(classroomRef, { teacherId: FieldValue.delete(), teacherName: FieldValue.delete() });
      }
    });

    return NextResponse.json({ ok: true, uid, deletedAuthAccount: true, deletedProfile: true });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = (error as Error).message;
    if (message === 'protected-account') return respond(403, message, 'SuperAdmin accounts cannot be deleted from Staff Accounts.');
    if (code === 'auth/id-token-expired' || code === 'auth/argument-error') return respond(401, 'unauthenticated', 'Your session expired. Sign in again.');
    console.error('[admin/staff] permanent deletion failed', { code, message });
    return respond(500, 'staff-deletion-failed', 'The staff account could not be fully deleted. Check Firebase Admin access and retry.');
  }
}
