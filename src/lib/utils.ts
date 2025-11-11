import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateGrade(totalScore: number): { grade: string; remark: string } {
  if (totalScore >= 90) return { grade: 'A+', remark: 'Excellent' };
  if (totalScore >= 80) return { grade: 'A', remark: 'Very Good' };
  if (totalScore >= 70) return { grade: 'B', remark: 'Good' };
  if (totalScore >= 60) return { grade: 'C', remark: 'Satisfactory' };
  if (totalScore >= 50) return { grade: 'D', remark: 'Needs Improvement' };
  if (totalScore >= 40) return { grade: 'E', remark: 'Poor' };
  return { grade: 'F', remark: 'Fail' };
}
