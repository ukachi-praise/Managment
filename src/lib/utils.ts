import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateGrade(totalScore: number): { grade: string; remark: string } {
  if (totalScore >= 80) return { grade: 'A', remark: 'Excellent' };
  if (totalScore >= 70) return { grade: 'B', remark: 'Very Good' };
  if (totalScore >= 60) return { grade: 'C', remark: 'Good' };
  if (totalScore >= 50) return { grade: 'D', remark: 'Fair' };
  return { grade: 'F', remark: 'Fail' };
}
