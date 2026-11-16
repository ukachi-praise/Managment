export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import puppeteer, { Browser } from 'puppeteer';

type FirestoreDocument = { id: string; [key: string]: any };
type BrowserAuthUser = {
  uid: string;
  apiKey: string;
  appName: string;
  email?: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  providerData: Array<Record<string, unknown>>;
  stsTokenManager: { accessToken: string; refreshToken: string; expirationTime: number };
  [key: string]: any;
};
type ExportRequest = { mode: 'class' | 'term'; sessionId: string; termId: string; classroomId?: string; firebaseUser?: BrowserAuthUser };
type SkippedReport = { student: string; classroom: string; reason: string };

const firestoreRoot = `https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const reportResultId = (sessionId: string, termId: string) => `${sessionId}-${termId}`;

function decodeValue(value: any): any {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) {
    return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decodeValue(child)]));
  }
  return null;
}

function decodeDocument(document: any): FirestoreDocument {
  const id = String(document.name || '').split('/').pop() || '';
  return {
    id,
    ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decodeValue(value)])),
  };
}

async function getFirestoreDocument(path: string, token: string): Promise<any | null> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${firestoreRoot}/${encodedPath}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed (${response.status}) for ${path}.`);
  return response.json();
}

async function listFirestoreCollection(collectionName: string, token: string): Promise<FirestoreDocument[]> {
  const documents: FirestoreDocument[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${firestoreRoot}/${encodeURIComponent(collectionName)}`);
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Firestore collection read failed (${response.status}) for ${collectionName}.`);
    const page = await response.json();
    documents.push(...(page.documents || []).map(decodeDocument));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return documents;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  }));
  return results;
}

function safeName(value: string): string {
  return value.trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'Unknown';
}

async function authenticateAdmin(req: NextRequest, browserUser?: BrowserAuthUser): Promise<{ token: string; browserUser: BrowserAuthUser }> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !apiKey || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    throw new Error('Authentication is required for report export.');
  }

  // Verify the Firebase ID token with Firebase Auth rather than trusting client-supplied identity data.
  const identityResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
    cache: 'no-store',
  });
  if (!identityResponse.ok) throw new Error('Your sign-in has expired. Sign in again to export reports.');
  const identity = await identityResponse.json();
  const account = identity.users?.[0];
  if (!account?.localId || account.disabled === true) throw new Error('This account is not permitted to export reports.');
  if (
    !browserUser || browserUser.uid !== account.localId ||
    browserUser.apiKey !== apiKey || browserUser.appName !== '[DEFAULT]' ||
    browserUser.stsTokenManager?.accessToken !== token ||
    typeof browserUser.stsTokenManager?.refreshToken !== 'string'
  ) {
    throw new Error('The authenticated browser session is incomplete. Sign in again and retry the export.');
  }

  const profileRaw = await getFirestoreDocument(`users/${account.localId}`, token);
  const profile = profileRaw ? decodeDocument(profileRaw) : null;
  const legacyAdminIds = new Set(['GOpbb9SsavhpATk1p0KNmPGGQ0S2', 'WRbg0T3XA7eIpFFb9amDgvii12x1']);
  if (profile?.role !== 'Admin' && profile?.role !== 'SuperAdmin' && !legacyAdminIds.has(account.localId)) {
    throw new Error('Only school administrators can export report archives.');
  }
  if (
    profile?.isActive === false || profile?.disabled === true || profile?.isDisabled === true ||
    ['disabled', 'inactive'].includes(String(profile?.status || '').toLowerCase())
  ) {
    throw new Error('This school account is inactive.');
  }

  // Validate that the session refresh token belongs to this same verified user,
  // then use the rotated tokens for long-running exports in the isolated page.
  const refreshResponse = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: browserUser.stsTokenManager.refreshToken }),
    cache: 'no-store',
  });
  if (!refreshResponse.ok) throw new Error('Could not establish a secure browser session for report rendering. Sign in again and retry.');
  const refreshed = await refreshResponse.json();
  if (refreshed.user_id !== account.localId || !refreshed.id_token || !refreshed.refresh_token) {
    throw new Error('The browser session identity did not match the authenticated administrator.');
  }

  const refreshedUser: BrowserAuthUser = {
    ...browserUser,
    stsTokenManager: {
      accessToken: refreshed.id_token,
      refreshToken: refreshed.refresh_token,
      expirationTime: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
    },
  };
  return { token: refreshed.id_token, browserUser: refreshedUser };
}

function hasRenderableResult(result: FirestoreDocument, subjects: Map<string, FirestoreDocument>): boolean {
  const rawScores = result.scores as Record<string, any> | undefined;
  if (!rawScores || typeof rawScores !== 'object' || Object.keys(rawScores).length === 0) return false;
  if (
    result.isPublished === false || result.published === false ||
    ['draft', 'unpublished'].includes(String(result.status || '').toLowerCase())
  ) return false;

  return Object.entries(rawScores).some(([subjectId, rawScore]) => {
    const subject = subjects.get(subjectId);
    if (!subject || !rawScore || typeof rawScore !== 'object') return false;
    const ca1 = typeof rawScore.ca1 === 'number' ? rawScore.ca1 : null;
    const ca2 = typeof rawScore.ca2 === 'number' ? rawScore.ca2 : null;
    const exam = typeof rawScore.exam === 'number' ? rawScore.exam : null;
    return ca1 !== null || ca2 !== null || exam !== null;
  });
}

async function generatePupilPDF(
  browser: Browser,
  appOrigin: string,
  studentId: string,
  sessionId: string,
  termId: string,
  apiKey: string,
  browserUser: BrowserAuthUser
): Promise<Buffer> {
  const page = await browser.newPage();
  const stylesheetFailures: string[] = [];
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });
  page.on('response', (response) => {
    if (response.request().resourceType() === 'stylesheet' && response.status() >= 400) {
      stylesheetFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'stylesheet') stylesheetFailures.push(request.url());
  });
  try {
    const authStorageKey = `firebase:authUser:${apiKey}:[DEFAULT]`;
    await page.evaluateOnNewDocument((origin, storageKey, serializedUser) => {
      if (window.location.origin === origin) {
        window.sessionStorage.setItem(storageKey, JSON.stringify(serializedUser));
      }
    }, appOrigin, authStorageKey, browserUser);

    const resultUrl = new URL(`/admin/results/${encodeURIComponent(studentId)}`, appOrigin);
    resultUrl.searchParams.set('session', sessionId);
    resultUrl.searchParams.set('term', termId);
    const navigation = await page.goto(resultUrl.toString(), { waitUntil: 'domcontentloaded' });
    if (!navigation || navigation.status() >= 400) {
      throw new Error(`Could not navigate to the actual report page (${navigation?.status() ?? 'no response'}).`);
    }
    if (!page.url().includes(`/admin/results/${encodeURIComponent(studentId)}`)) {
      throw new Error('The authenticated report page redirected before rendering.');
    }

    // Wait for the real React report and its Firestore-backed data, not a copied
    // HTML template. Both readiness markers are set by the actual report page.
    await page.waitForFunction(() =>
      document.querySelector('[data-report-page-ready="true"]') !== null &&
      document.querySelector('[data-report-card-ready="true"]') !== null,
    { timeout: 90000 });

    // Next.js CSS is delivered as linked assets. Do not print if those assets
    // failed or if the report's utility classes did not take effect.
    await page.waitForFunction(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
      return document.styleSheets.length > 0 && links.every((stylesheet) => stylesheet.sheet !== null);
    }, { timeout: 30000 });
    if (stylesheetFailures.length > 0) {
      throw new Error(`Report stylesheets failed to load: ${stylesheetFailures.join('; ')}`);
    }
    const styleCheck = await page.$eval('[data-report-card-ready="true"]', (element) => {
      const styles = getComputedStyle(element);
      return { display: styles.display, width: parseFloat(styles.width), padding: parseFloat(styles.paddingLeft) };
    });
    if (styleCheck.display === 'block' || styleCheck.width < 700 || styleCheck.padding < 10) {
      throw new Error('The report page loaded without its expected Next.js/Tailwind styling.');
    }

    await page.evaluate(() => {
      document.querySelectorAll('img').forEach((image) => { image.loading = 'eager'; });
    });
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0), { timeout: 30000 });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.emulateMediaType('print');

    const pdf = await page.pdf({
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      scale: 1,
      displayHeaderFooter: false,
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
    });
    const pdfBuffer = Buffer.from(pdf);
    if (pdfBuffer.length < 1000 || pdfBuffer.subarray(0, 4).toString() !== '%PDF') {
      throw new Error('Puppeteer returned an invalid or empty PDF.');
    }
    return pdfBuffer;
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function POST(req: NextRequest) {
  let browser: Browser | undefined;
  try {
    const body = await req.json() as ExportRequest;
    if (!body || !['class', 'term'].includes(body.mode) || !body.sessionId || !body.termId || (body.mode === 'class' && !body.classroomId)) {
      return NextResponse.json({ error: 'Select a session, term, and (for class export) classroom.' }, { status: 400 });
    }
    if (![body.sessionId, body.termId, body.classroomId].filter(Boolean).every(id => /^[A-Za-z0-9_-]+$/.test(String(id)))) {
      return NextResponse.json({ error: 'The selected session, term, or classroom identifier is invalid.' }, { status: 400 });
    }
    const { token, browserUser } = await authenticateAdmin(req, body.firebaseUser);
    const appOrigin = req.nextUrl.origin;

    const [enrollments, classrooms, subjectsRaw, sessionRaw, termRaw] = await Promise.all([
      listFirestoreCollection('enrollments', token),
      listFirestoreCollection('classrooms', token),
      listFirestoreCollection('subjects', token),
      getFirestoreDocument(`sessions/${body.sessionId}`, token),
      getFirestoreDocument(`sessions/${body.sessionId}/terms/${body.termId}`, token),
    ]);
    if (!sessionRaw || !termRaw) {
      return NextResponse.json({ error: 'The selected session or term could not be found.' }, { status: 404 });
    }

    const session = decodeDocument(sessionRaw);
    const term = decodeDocument(termRaw);
    if (term.sessionId && term.sessionId !== body.sessionId) {
      return NextResponse.json({ error: 'The selected term does not belong to this session.' }, { status: 400 });
    }

    // Current Firestore schema represents one school and has no schoolId/tenant field.
    // All reads use the verified administrator's Firebase ID token and school database.
    const classroomMap = new Map(classrooms.map(classroom => [classroom.id, classroom]));
    const membership = new Map<string, Set<string>>();
    for (const enrollment of enrollments) {
      if (body.mode === 'class' && enrollment.classroomId !== body.classroomId) continue;
      if (!enrollment.studentId || !enrollment.classroomId || !classroomMap.has(String(enrollment.classroomId))) continue;
      const currentClassIds = membership.get(String(enrollment.studentId)) || new Set<string>();
      currentClassIds.add(String(enrollment.classroomId));
      membership.set(String(enrollment.studentId), currentClassIds);
    }
    if (membership.size === 0) return NextResponse.json({ error: 'No enrolled students were found for this export.' }, { status: 404 });

    const skipped: SkippedReport[] = [];
    const studentRecords = await mapWithConcurrency([...membership.keys()], 8, async id => {
      const raw = await getFirestoreDocument(`students/${id}`, token);
      return { id, student: raw ? decodeDocument(raw) : null };
    });
    const activeStudents: FirestoreDocument[] = [];
    for (const { id, student } of studentRecords) {
      const currentClassIds = [...(membership.get(id) || [])];
      if (!student) {
        currentClassIds.forEach(classId => skipped.push({ student: id, classroom: String(classroomMap.get(classId)?.name || classId), reason: 'Student document is missing.' }));
      } else if (student.isDeleted === true) {
        currentClassIds.forEach(classId => skipped.push({ student: String(student.name || id), classroom: String(classroomMap.get(classId)?.name || classId), reason: 'Student is marked deleted.' }));
      } else if (typeof student.name !== 'string' || student.name.trim().length === 0) {
        currentClassIds.forEach(classId => skipped.push({ student: id, classroom: String(classroomMap.get(classId)?.name || classId), reason: 'Student record has no valid name.' }));
      } else {
        activeStudents.push(student);
      }
    }
    const subjects = new Map(subjectsRaw.map(subject => [subject.id, subject]));
    const reports: Array<{ folder: string; filename: string; studentId: string; studentName: string; classroomId: string }> = [];

    await mapWithConcurrency(activeStudents, 8, async student => {
      const currentClassIds = [...(membership.get(student.id) || [])];
      const resultRaw = await getFirestoreDocument(`students/${student.id}/results/${reportResultId(body.sessionId, body.termId)}`, token);
      if (!resultRaw) {
        currentClassIds.forEach(id => skipped.push({ student: String(student.name), classroom: String(classroomMap.get(id)?.name || id), reason: 'No saved result for this session and term.' }));
        return;
      }

      const result = decodeDocument(resultRaw);
      const resultClassId = String(result.classroomId || '');
      if (!resultClassId || !currentClassIds.includes(resultClassId)) {
        currentClassIds.forEach(id => skipped.push({ student: String(student.name), classroom: String(classroomMap.get(id)?.name || id), reason: 'Saved result does not match the student’s current class membership.' }));
        return;
      }
      if ((result.studentId && result.studentId !== student.id) || (result.sessionId && result.sessionId !== body.sessionId) || (result.termId && result.termId !== body.termId)) {
        skipped.push({ student: String(student.name), classroom: String(classroomMap.get(resultClassId)?.name || resultClassId), reason: 'Saved result identifiers do not match the selected student, session, and term.' });
        return;
      }
      if (body.mode === 'class' && resultClassId !== body.classroomId) {
        skipped.push({ student: String(student.name), classroom: String(classroomMap.get(resultClassId)?.name || resultClassId), reason: 'Saved result belongs to a different class.' });
        return;
      }

      const classroom = classroomMap.get(resultClassId);
      if (!classroom) {
        skipped.push({ student: String(student.name), classroom: resultClassId, reason: 'Classroom record is missing.' });
        return;
      }
      if (!hasRenderableResult(result, subjects)) {
        skipped.push({ student: String(student.name), classroom: String(classroom.name), reason: 'Result has no published score data.' });
        return;
      }
      const uniqueSuffix = `${student.admissionNumber ? safeName(String(student.admissionNumber)) : 'NoAdmission'}_${student.id.slice(-6)}`;
      reports.push({
        folder: safeName(String(classroom.name)),
        filename: `${safeName(String(student.name))}_${uniqueSuffix}_Report.pdf`,
        studentId: student.id,
        studentName: String(student.name),
        classroomId: classroom.id,
      });
    });

    if (reports.length === 0) return NextResponse.json({ error: 'No eligible saved results were found.', skipped }, { status: 422 });

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
    const zip = new JSZip();
    const generationErrors: SkippedReport[] = [];
    await mapWithConcurrency(reports, 2, async report => {
      try {
        const pdfBuffer = await generatePupilPDF(
          browser!, appOrigin, report.studentId, body.sessionId, body.termId, process.env.NEXT_PUBLIC_FIREBASE_API_KEY!, browserUser
        );
        zip.folder(report.folder)?.file(report.filename, pdfBuffer);
      } catch (error) {
        generationErrors.push({
          student: report.studentName,
          classroom: String(classroomMap.get(report.classroomId)?.name || report.classroomId),
          reason: error instanceof Error ? error.message : 'PDF generation failed.',
        });
      }
    });
    skipped.push(...generationErrors);

    const pdfPaths = Object.keys(zip.files).filter(path => path.endsWith('.pdf'));
    if (pdfPaths.length === 0) return NextResponse.json({ error: 'Puppeteer could not generate any valid PDFs.', skipped }, { status: 500 });
    zip.file('Export_Summary.txt', [
      `Mode: ${body.mode === 'class' ? 'Class export' : 'Entire term'}`,
      `Session: ${String(session.name || body.sessionId)}`,
      `Term: ${String(term.name || body.termId)}`,
      `Generated PDFs: ${pdfPaths.length}`,
      `Skipped reports: ${skipped.length}`,
      '',
      ...(skipped.length ? skipped.map(item => `${item.classroom} / ${item.student}: ${item.reason}`) : ['No reports were skipped.']),
    ].join('\n'));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    if (zipBuffer.length < 100 || zipBuffer.subarray(0, 2).toString() !== 'PK') throw new Error('ZIP generation returned an invalid archive.');
    const filename = body.mode === 'class'
      ? `${safeName(String(classroomMap.get(body.classroomId!)?.name || 'Class'))}_Results_${safeName(String(session.name))}_${safeName(String(term.name))}.zip`
      : `Results_${safeName(String(session.name))}_${safeName(String(term.name))}.zip`;

    const zipBody = Uint8Array.from(zipBuffer);
    return new NextResponse(zipBody, { status: 200, headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zipBuffer.length),
      'X-Export-PDF-Count': String(pdfPaths.length),
      'X-Export-Skipped-Count': String(skipped.length),
    } });
  } catch (error) {
    console.error('ZIP Generation Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate the report archive.';
    const status = /authentication is required|sign-in has expired/i.test(message)
      ? 401
      : /account is not permitted|only school administrators|school account is inactive/i.test(message)
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
