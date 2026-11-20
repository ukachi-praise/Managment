type DiagnosticDetails = Record<string, unknown>;

const prefix = '[ARMS Auth Diagnostics]';
const diagnosticsEnabled = process.env.NEXT_PUBLIC_AUTH_DIAGNOSTICS === 'true';

export function logAuthDiagnostic(stage: string, details: DiagnosticDetails = {}) {
  if (!diagnosticsEnabled) return;
  console.info(prefix, stage, details);
}

export function logAuthDiagnosticError(
  stage: string,
  error: unknown,
  details: DiagnosticDetails = {}
) {
  if (!diagnosticsEnabled) return;
  const firebaseError = error as { code?: string; message?: string } | null;
  console.error(prefix, stage, {
    ...details,
    code: firebaseError?.code || 'unknown',
    message: firebaseError?.message || String(error),
  });
}
