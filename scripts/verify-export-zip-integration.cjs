const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const JSZip = require('jszip');

process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'route-test-project';
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'route-test-key';

function loadTypeScriptModule(relativePath, mockedModules = {}) {
  const filename = path.resolve(relativePath);
  const javascript = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mockedModules, request)) return mockedModules[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    loaded._compile(javascript, filename);
  } finally {
    Module._load = originalLoad;
  }
  return loaded.exports;
}

const reportUtils = loadTypeScriptModule('src/lib/utils.ts');
const renderedPages = [];
const fakePdf = Buffer.concat([
  Buffer.from('%PDF-1.4\n1 0 obj <</Type /Page /MediaBox [0 0 595 842]>>\n2 0 obj <</Type /Page /MediaBox [0 0 595 842]>>\n'),
  Buffer.alloc(1200, 32),
  Buffer.from('\n%%EOF'),
]);
const puppeteerMock = {
  launch: async () => ({
    newPage: async () => {
      const state = { url: '', print: false, authStorage: null, pdfOptions: null, waits: 0 };
      renderedPages.push(state);
      return {
        setDefaultNavigationTimeout() {},
        setDefaultTimeout() {},
        async setViewport() {},
        on() {},
        async evaluateOnNewDocument(_callback, origin, storageKey, serializedUser) {
          state.authStorage = { origin, storageKey, serializedUser };
        },
        async goto(url) {
          state.url = url;
          return { status: () => 200 };
        },
        url() { return state.url; },
        async waitForFunction() { state.waits += 1; },
        async $eval(_selector, callback) {
          global.getComputedStyle = () => ({ display: 'flex', width: '794px', paddingLeft: '24px' });
          return callback({});
        },
        async evaluate() {},
        async emulateMediaType(mediaType) { state.print = mediaType === 'print'; },
        async pdf(options) { state.pdfOptions = options; return fakePdf; },
        async close() {},
      };
    },
    async close() {},
  }),
};
const route = loadTypeScriptModule('src/app/api/export-class-zip/route.ts', {
  '@/lib/utils': reportUtils,
  puppeteer: { __esModule: true, default: puppeteerMock },
});

const str = stringValue => ({ stringValue });
const bool = booleanValue => ({ booleanValue });
const num = integerValue => ({ integerValue: String(integerValue) });
const map = fields => ({ mapValue: { fields } });
const firestoreDoc = (pathName, fields) => ({
  name: `projects/route-test-project/databases/(default)/documents/${pathName}`,
  fields,
});

const fixtureDocs = {
  enrollments: [firestoreDoc('enrollments/e1', { studentId: str('s1'), classroomId: str('c1') })],
  classrooms: [firestoreDoc('classrooms/c1', { name: str('Nursery 1'), teacherName: str('Test Teacher') })],
  subjects: [firestoreDoc('subjects/math', { name: str('Mathematics'), subSubjects: { arrayValue: { values: [] } } })],
};
let profileRole = 'Admin';
let resultAvailable = true;

function mockFirestoreDocument(pathName) {
  if (!resultAvailable && pathName === 'students/s1/results/session1-term1') return null;
  const docs = {
    'users/admin1': firestoreDoc('users/admin1', { role: str(profileRole) }),
    'schoolSettings/current': firestoreDoc('schoolSettings/current', {
      daysSchoolOpened: num(65),
      nextTermResumptionDate: { nullValue: 'NULL_VALUE' },
    }),
    'sessions/session1': firestoreDoc('sessions/session1', { name: str('2026/2027') }),
    'sessions/session1/terms/term1': firestoreDoc('sessions/session1/terms/term1', { name: str('1st'), sessionId: str('session1') }),
    'students/s1': firestoreDoc('students/s1', { name: str('Test Student'), admissionNumber: str('A001'), isDeleted: bool(false) }),
    'students/s1/results/session1-term1': firestoreDoc('students/s1/results/session1-term1', {
      studentId: str('s1'), classroomId: str('c1'), sessionId: str('session1'), termId: str('term1'), daysAttended: num(60),
      scores: map({ math: map({ ca1: num(18), ca2: num(17), exam: num(55) }) }),
    }),
  };
  return docs[pathName] || null;
}

const originalFetch = global.fetch;
global.fetch = async (input) => {
  const url = new URL(String(input));
  if (url.hostname === 'identitytoolkit.googleapis.com') return Response.json({ users: [{ localId: 'admin1', disabled: false }] });
  if (url.hostname === 'securetoken.googleapis.com') return Response.json({ user_id: 'admin1', id_token: 'refreshed-id-token', refresh_token: 'rotated-refresh-token', expires_in: '3600' });
  if (url.hostname === 'firestore.googleapis.com') {
    const pathName = decodeURIComponent(url.pathname.split('/documents/')[1] || '').replace(/^\/+/, '');
    if (['enrollments', 'classrooms', 'subjects'].includes(pathName)) return Response.json({ documents: fixtureDocs[pathName] || [] });
    const document = mockFirestoreDocument(pathName);
    return document ? Response.json(document) : new Response('', { status: 404 });
  }
  return originalFetch(input);
};

(async () => {
  let response;
  try {
    const makeRequest = mode => ({
      nextUrl: new URL('http://localhost:3000/api/export-class-zip'),
      headers: new Headers({ authorization: 'Bearer test-firebase-id-token' }),
      json: async () => ({
        mode,
        sessionId: 'session1',
        termId: 'term1',
        classroomId: mode === 'class' ? 'c1' : undefined,
        firebaseUser: {
          uid: 'admin1',
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          appName: '[DEFAULT]',
          email: 'admin@example.test',
          emailVerified: true,
          isAnonymous: false,
          providerData: [],
          stsTokenManager: { accessToken: 'test-firebase-id-token', refreshToken: 'test-refresh-token', expirationTime: Date.now() + 3600000 },
        },
      }),
    });
    const verifiedExports = [];
    for (const mode of ['term', 'class']) {
      response = await route.POST(makeRequest(mode));
      assert.equal(response.status, 200, await response.clone().text());
      assert.match(response.headers.get('content-type'), /application\/zip/);
      assert.equal(response.headers.get('x-export-pdf-count'), '1');
      assert.equal(response.headers.get('x-export-skipped-count'), '0');
      const zipBuffer = Buffer.from(await response.arrayBuffer());
      assert.equal(zipBuffer.subarray(0, 2).toString(), 'PK');
      const zip = await JSZip.loadAsync(zipBuffer);
      const pdfPath = 'Nursery_1/Test_Student_A001_s1_Report.pdf';
      const pdfFile = zip.file(pdfPath);
      assert.ok(pdfFile, `Expected ${pdfPath}; archive entries: ${Object.keys(zip.files).join(', ')}`);
      const pdf = await pdfFile.async('nodebuffer');
      assert.ok(pdf.length > 1000, 'Generated PDF is empty');
      assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
      assert.ok(pdf.includes(Buffer.from('%%EOF')));
      const pdfText = pdf.toString('latin1');
      const pageCount = (pdfText.match(/\/Type\s*\/Page\b/g) || []).length;
      assert.equal(pageCount, 2, `Expected two report pages, got ${pageCount}`);
      const mediaBox = pdfText.match(/\/MediaBox\s*\[([^\]]+)\]/)?.[1];
      assert.ok(mediaBox);
      const dimensions = mediaBox.trim().split(/\s+/).map(Number);
      assert.ok(Math.abs(dimensions[2] - 595) < 1 && Math.abs(dimensions[3] - 842) < 1, `PDF page is not A4: ${mediaBox}`);
      const renderState = renderedPages.at(-1);
      assert.match(renderState.url, /\/admin\/results\/s1\?session=session1&term=term1/);
      assert.equal(renderState.print, true, 'Puppeteer must use the existing report print styles.');
      assert.ok(renderState.waits >= 2, 'Puppeteer must wait for actual page and stylesheet readiness markers.');
      assert.equal(renderState.pdfOptions.printBackground, true);
      assert.equal(renderState.pdfOptions.format, 'A4');
      assert.equal(renderState.authStorage.serializedUser.stsTokenManager.accessToken, 'refreshed-id-token');
      const summary = await zip.file('Export_Summary.txt').async('string');
      assert.match(summary, /Generated PDFs: 1/);
      assert.match(summary, /Skipped reports: 0/);
      verifiedExports.push({ mode, zipBytes: zipBuffer.length, pdfBytes: pdf.length, pageCount, mediaBox, entries: Object.keys(zip.files) });
    }

    profileRole = 'Teacher';
    response = await route.POST(makeRequest('term'));
    assert.equal(response.status, 403, 'A teacher must not be allowed to export school-wide result archives.');
    verifiedExports.push({ mode: 'teacher-denied', status: response.status });
    profileRole = 'Admin';
    resultAvailable = false;
    response = await route.POST(makeRequest('term'));
    assert.equal(response.status, 422, 'Missing results must be skipped rather than producing blank PDFs.');
    const skippedResponse = await response.json();
    assert.match(skippedResponse.skipped[0].reason, /No saved result/);
    verifiedExports.push({ mode: 'missing-result-skipped', status: response.status, reason: skippedResponse.skipped[0].reason });
    console.log(JSON.stringify(verifiedExports));
  } finally {
    global.fetch = originalFetch;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
