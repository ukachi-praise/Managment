export type ImportedStudentRow = {
  rowNumber: number;
  originalName: string;
  name: string;
  gender: string;
  originalClass: string;
  reviewNotes: string;
  crossedOut: boolean;
};

export type ImportStatus = 'valid' | 'duplicate' | 'missing' | 'class-not-found' | 'ambiguous' | 'review';

export const REQUIRED_COLUMNS = ['Student Name', 'Gender', 'Class'];

export function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function normalizeGender(value: unknown): string {
  const gender = clean(value).toLowerCase();
  if (['m', 'male', 'boy', 'b'].includes(gender)) return 'Male';
  if (['f', 'female', 'girl', 'g'].includes(gender)) return 'Female';
  return clean(value);
}

export function normalizeClassName(value: unknown): string {
  return clean(value).toLocaleLowerCase();
}

export function splitName(name: string): { name: string } {
  // ARMS stores the complete display name. Keeping it intact avoids silently
  // assigning parts of a name to the wrong profile field.
  return { name: clean(name) };
}

export function statusLabel(status: ImportStatus): string {
  return {
    valid: 'Valid', duplicate: 'Duplicate / possible match', missing: 'Missing information',
    'class-not-found': 'Class not found', ambiguous: 'Ambiguous class', review: 'Requires review',
  }[status];
}
