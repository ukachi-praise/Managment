import {
  collection,
  documentId,
  Firestore,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

export type ActiveStudentRecord = {
  id: string;
  name: string;
  isDeleted?: boolean;
  [key: string]: unknown;
};

/** Fetch existing, non-deleted root student records for membership IDs. */
export async function fetchActiveStudentsByIds(
  firestore: Firestore,
  studentIds: string[]
): Promise<ActiveStudentRecord[]> {
  const uniqueIds = [...new Set(studentIds.filter((id) => typeof id === 'string' && id.length > 0))];
  const students: ActiveStudentRecord[] = [];

  // Firestore `in` queries accept at most 30 values, so split large classes.
  for (let index = 0; index < uniqueIds.length; index += 30) {
    const idBatch = uniqueIds.slice(index, index + 30);
    const snapshot = await getDocs(
      query(collection(firestore, 'students'), where(documentId(), 'in', idBatch))
    );

    snapshot.forEach((studentDoc) => {
      const data = studentDoc.data();
      if (data.isDeleted !== true && typeof data.name === 'string' && data.name.trim().length > 0) {
        students.push({ id: studentDoc.id, ...data, name: data.name });
      }
    });
  }

  return students;
}