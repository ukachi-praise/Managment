import type { ImagePlaceholder } from './placeholder-images';
import { PlaceHolderImages } from './placeholder-images';

export type Student = {
  id: string;
  name: string;
  classId: string;
  avatar: ImagePlaceholder;
  attendance: string;
};

export type Classroom = {
  id: string;
  name: string;
  teacher: string;
};

export type Subject = {
  id: string;
  name: string;
};

export type Grade = {
  studentId: string;
  subjectId: string;
  ca1: number | null;
  ca2: number | null;
  ca3: number | null;
  exam: number | null;
};

export const classrooms: Classroom[] = [
  { id: 'c1', name: 'Nursery 1', teacher: 'Mrs. Ade' },
  { id: 'c2', name: 'Nursery 2', teacher: 'Mr. John' },
  { id: 'c3', name: 'Primary 1', teacher: 'Ms. Eze' },
  { id: 'c4', name: 'Primary 2', teacher: 'Mrs. Bola' },
];

export const subjects: Subject[] = [
  { id: 's1', name: 'Mathematics' },
  { id: 's2', name: 'English Studies' },
  { id: 's3', name: 'Basic Science' },
  { id: 's4', name: 'Social Studies' },
  { id: 's5', name: 'Computer Science' },
  { id: 's6', name: 'Art' },
];

export const students: Student[] = [
  { id: 'st1', name: 'Ada Lovelace', classId: 'c1', avatar: PlaceHolderImages[0], attendance: '95%' },
  { id: 'st2', name: 'Charles Babbage', classId: 'c1', avatar: PlaceHolderImages[1], attendance: '98%' },
  { id: 'st3', name: 'Grace Hopper', classId: 'c2', avatar: PlaceHolderImages[2], attendance: '92%' },
  { id: 'st4', name: 'Alan Turing', classId: 'c2', avatar: PlaceHolderImages[3], attendance: '100%' },
  { id: 'st5', name: 'Tim Berners-Lee', classId: 'c3', avatar: PlaceHolderImages[4], attendance: '96%' },
  { id: 'st6', name: 'Hedy Lamarr', classId: 'c3', avatar: PlaceHolderImages[5], attendance: '97%' },
  { id: 'st7', name: 'Vint Cerf', classId: 'c4', avatar: PlaceHolderImages[6], attendance: '94%' },
  { id: 'st8', name: 'Radia Perlman', classId: 'c4', avatar: PlaceHolderImages[7], attendance: '99%' },
];

export const grades: Grade[] = [
  // Ada Lovelace
  { studentId: 'st1', subjectId: 's1', ca1: 10, ca2: 9, ca3: 8, exam: 55 },
  { studentId: 'st1', subjectId: 's2', ca1: 8, ca2: 9, ca3: 9, exam: 60 },
  // Charles Babbage
  { studentId: 'st2', subjectId: 's1', ca1: 9, ca2: 9, ca3: 9, exam: 65 },
  { studentId: 'st2', subjectId: 's2', ca1: 7, ca2: 8, ca3: 8, exam: 50 },
  // Grace Hopper
  { studentId: 'st3', subjectId: 's3', ca1: 10, ca2: 10, ca3: 10, exam: 68 },
  { studentId: 'st3', subjectId: 's4', ca1: 8, ca2: 7, ca3: 9, exam: 55 },
  // Alan Turing
  { studentId: 'st4', subjectId: 's3', ca1: 9, ca2: 10, ca3: 9, exam: 62 },
  { studentId: 'st4', subjectId: 's4', ca1: 9, ca2: 8, ca3: 8, exam: 58 },
];
