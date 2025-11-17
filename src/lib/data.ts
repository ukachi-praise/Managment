
export type Student = {
  id: string;
  name: string;
  classId: string;
  attendance: string;
};

export type Classroom = {
  id: string;
  name: string;
  teacher?: string;
};

export type Subject = {
  id: string;
  name:string;
};

export type Grade = {
  studentId: string;
  subjectId: string;
  ca1: number | null;
  ca2: number | null;
  ca3: number | null;
  exam: number | null;
};

export const headTeacherRemarks: string[] = [
    "Excellent Performance",
    "Very Good Effort",
    "Good Performance",
    "Satisfactory Progress",
    "Needs Improvement",
    "Requires More Attention",
    "Outstanding Achievement",
    "Consistent Performer",
    "Shows Great Potential",
    "Attention Required in Some Areas",
    "Exceptional Improvement",
    "Can Do Better",
    "Excellent Conduct and Discipline",
    "Very Good Conduct",
    "Needs to Improve Behaviour",
];
