type DiagnosticDetails = Record<string, unknown>;

const prefix = '[ARMS Auth Diagnostics]';

export function logAuthDiagnostic(stage: string, details: DiagnosticDetails = {}) {
  console.info(prefix, stage, details);
}

export function logAuthDiagnosticError(
  stage: string,
  error: unknown,
  details: DiagnosticDetails = {}
) {
  const firebaseError = error as { code?: string; message?: string } | null;
  console.error(prefix, stage, {
    ...details,
    code: firebaseError?.code || 'unknown',
    message: firebaseError?.message || String(error),
  });
}
