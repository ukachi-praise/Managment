import { redirect } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

// This page is no longer the primary destination for teachers.
// It will now act as a redirector to get the teacher to their assigned class.
// We can't use `useUser` hook here as it's a server component.

export default async function TeacherDashboard() {
  // This is a server component, so we initialize a temporary client
  // to fetch the user's class assignment.
  // This is not ideal, but necessary for the redirect logic on the server.
  const { auth, firestore } = initializeFirebase();

  const user = auth.currentUser;

  if (user) {
    const userDocRef = doc(firestore, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.assignedClassroomId) {
        redirect(`/teacher/class/${userData.assignedClassroomId}`);
      }
    }
  }
  
  // Fallback if user isn't found or has no class.
  // A real app might show an error page.
  redirect('/login');
}
