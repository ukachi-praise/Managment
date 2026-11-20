const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const JSZip = require('jszip');
require.extensions['.ts'] = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  loadedModule._compile(ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }), filename);
};
const { launchPdfBrowser } = require('../src/lib/server/pdf-browser.ts');

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
const puppeteerMock = {
  launch: async () => {
    const browser = await launchPdfBrowser();
    return {
    newPage: async () => {
      const page = await browser.newPage();
      const state = { url: '', print: false, authStorage: null, pdfOptions: null, waits: 0 };
      renderedPages.push(state);
      return {
        setDefaultNavigationTimeout: timeout => page.setDefaultNavigationTimeout(timeout),
        setDefaultTimeout: timeout => page.setDefaultTimeout(timeout),
        setViewport: options => page.setViewport(options),
        on: (...args) => page.on(...args),
        async evaluateOnNewDocument(_callback, origin, storageKey, serializedUser) {
          state.authStorage = { origin, storageKey, serializedUser };
        },
        async goto(url) {
          state.url = url;
          const studentId = new URL(url).pathname.split('/').pop();
          await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            #report { width: 200mm; height: 287mm; min-height: 287mm; padding: 6mm; border: 2px solid #111; background: white; color: #111; display: flex; flex-direction: column; }
            header, .student, .subjects, footer { border: 1px solid #111; padding: 8px; margin-bottom: 12px; }
            header { display: flex; justify-content: space-between; align-items: center; }
            h1 { font-size: 22px; margin: 0; } h2 { font-size: 18px; margin: 0 0 8px; }
            .student { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { border: 1px solid #111; padding: 5px; text-align: left; }
            .summary { margin-left: auto; width: 50%; padding: 8px; }
            footer { margin-top: auto; padding: 8px; }
            .footer-cols { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 8px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 18px; }
            @media print { html, body { width: 200mm; height: 287mm; } }
          </style></head><body><div data-report-page-ready="true"><article id="report" data-report-card-ready="true">
            <header><div><h1>ARMS</h1><div>Katampe 2 Mpape Abuja · Motto: Exceeding Great</div></div><div style="text-align:right"><h2>Pupil Report Card</h2>1st Term, 2026/2027</div></header>
            <section class="student"><div>Pupil Name: Test Student ${studentId}</div><div>Admission No: A${studentId}</div><div>Class: Nursery 1</div><div>Days Attended: 60</div><div>School Open: 65</div><div>Class Teacher: Test Teacher</div></section>
            <section class="subjects"><table><thead><tr><th>Subject</th><th>CA1 (20)</th><th>CA2 (20)</th><th>Exam (60)</th><th>Total (100)</th><th>Remark</th></tr></thead><tbody><tr><td>Mathematics</td><td>18</td><td>17</td><td>55</td><td>90</td><td>Excellent</td></tr></tbody></table><div class="summary">Overall Average: 90%<br>Overall Grade: A</div></section>
            <footer><div class="footer-cols"><div>Grading Key<table><tr><td>80–100</td><td>A</td><td>Excellent</td></tr><tr><td>70–79</td><td>B</td><td>Very Good</td></tr></table></div><div>Skill Score Rating<table><tr><td>5</td><td>Excellent</td></tr></table></div><div>Soft Skills Assessment<table><tr><td>Neatness</td><td>5</td></tr></table></div></div><p>Teacher's Remarks: Good work</p><div class="signatures"><span>Class Teacher's Signature</span><span>Head Teacher's Signature</span></div></footer>
          </article></div></body></html>`, { waitUntil: 'domcontentloaded' });
          return { status: () => 200 };
        },
        url() { return state.url; },
        async waitForFunction(...args) {
          state.waits += 1;
          return page.waitForFunction(...args);
        },
        async $eval(...args) { return page.$eval(...args); },
        async evaluate(...args) { return page.evaluate(...args); },
        async emulateMediaType(mediaType) { state.print = mediaType === 'print'; return page.emulateMediaType(mediaType); },
        async pdf(options) { state.pdfOptions = options; return page.pdf(options); },
        async close() { return page.close(); },
      };
    },
    close: () => browser.close(),
  };
  },
};
const route = loadTypeScriptModule('src/app/api/export-class-zip/route.ts', {
  '@/lib/utils': reportUtils,
  '@/lib/server/pdf-browser': { launchPdfBrowser: puppeteerMock.launch },
  '@/lib/result-pdf-layout': { RESULT_PDF_LAYOUT: { margin: { top: '5mm', right: '5mm', bottom: '5mm', left: '5mm' } } },
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
  enrollments: [
    firestoreDoc('enrollments/e1', { studentId: str('s1'), classroomId: str('c1') }),
    firestoreDoc('enrollments/e2', { studentId: str('s2'), classroomId: str('c1') }),
  ],
  classrooms: [firestoreDoc('classrooms/c1', { name: str('Nursery 1'), teacherName: str('Test Teacher') })],
  subjects: [firestoreDoc('subjects/math', { name: str('Mathematics'), subSubjects: { arrayValue: { values: [] } } })],
};
let profileRole = 'Admin';
let resultAvailable = true;

function mockFirestoreDocument(pathName) {
  if (!resultAvailable && pathName === 'students/s1/results/session1-term1') return null;
  const studentId = pathName.match(/^students\/(s[12])(?:\/results\/session1-term1)?$/)?.[1];
  const studentNumber = studentId === 's2' ? '002' : '001';
  const docs = {
    'users/admin1': firestoreDoc('users/admin1', { role: str(profileRole) }),
    'schoolSettings/current': firestoreDoc('schoolSettings/current', {
      daysSchoolOpened: num(65),
      nextTermResumptionDate: { nullValue: 'NULL_VALUE' },
    }),
    'sessions/session1': firestoreDoc('sessions/session1', { name: str('2026/2027') }),
    'sessions/session1/terms/term1': firestoreDoc('sessions/session1/terms/term1', { name: str('1st'), sessionId: str('session1') }),
    [`students/${studentId}`]: studentId ? firestoreDoc(`students/${studentId}`, { name: str(`Test Student ${studentNumber}`), admissionNumber: str(`A${studentNumber}`), isDeleted: bool(false) }) : null,
    [`students/${studentId}/results/session1-term1`]: studentId ? firestoreDoc(`students/${studentId}/results/session1-term1`, {
      studentId: str(studentId), classroomId: str('c1'), sessionId: str('session1'), termId: str('term1'), daysAttended: num(60),
      scores: map({ math: map({ ca1: num(18), ca2: num(17), exam: num(55) }) }),
    }) : null,
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
      assert.equal(response.headers.get('x-export-pdf-count'), '2');
      assert.equal(response.headers.get('x-export-skipped-count'), '0');
      const zipBuffer = Buffer.from(await response.arrayBuffer());
      assert.equal(zipBuffer.subarray(0, 2).toString(), 'PK');
      const zip = await JSZip.loadAsync(zipBuffer);
      for (const [pdfPath, pageState] of [
        ['Nursery_1/Test_Student_001_A001_s1_Report.pdf', renderedPages.at(-2)],
        ['Nursery_1/Test_Student_002_A002_s2_Report.pdf', renderedPages.at(-1)],
      ]) {
        const pdfFile = zip.file(pdfPath);
        assert.ok(pdfFile, `Expected ${pdfPath}; archive entries: ${Object.keys(zip.files).join(', ')}`);
        const pdf = await pdfFile.async('nodebuffer');
        assert.ok(pdf.length > 1000, 'Generated PDF is empty');
        assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
        assert.ok(pdf.includes(Buffer.from('%%EOF')));
        const pdfText = pdf.toString('latin1');
        const pageCount = (pdfText.match(/\/Type\s*\/Page\b/g) || []).length;
        assert.equal(pageCount, 1, `Expected one report page, got ${pageCount}`);
        const mediaBox = pdfText.match(/\/MediaBox\s*\[([^\]]+)\]/)?.[1];
        assert.ok(mediaBox);
        const dimensions = mediaBox.trim().split(/\s+/).map(Number);
        assert.ok(Math.abs(dimensions[2] - 595) < 1 && Math.abs(dimensions[3] - 842) < 1, `PDF page is not A4: ${mediaBox}`);
        assert.deepEqual(pageState.pdfOptions.margin, { top: '5mm', right: '5mm', bottom: '5mm', left: '5mm' });
      }
      const renderState = renderedPages.at(-1);
      assert.match(renderState.url, /\/admin\/results\/s[12]\?session=session1&term=term1/);
      assert.equal(renderState.print, true, 'Puppeteer must use the existing report print styles.');
      assert.ok(renderState.waits >= 2, 'Puppeteer must wait for actual page and stylesheet readiness markers.');
      assert.equal(renderState.pdfOptions.printBackground, true);
      assert.equal(renderState.pdfOptions.format, 'A4');
      assert.equal(renderState.authStorage.serializedUser.stsTokenManager.accessToken, 'refreshed-id-token');
      const summary = await zip.file('Export_Summary.txt').async('string');
      assert.match(summary, /Generated PDFs: 2/);
      assert.match(summary, /Skipped reports: 0/);
      verifiedExports.push({ mode, zipBytes: zipBuffer.length, pdfCount: 2, pageCountPerPdf: 1, entries: Object.keys(zip.files) });
    }

    profileRole = 'Teacher';
    response = await route.POST(makeRequest('term'));
    assert.equal(response.status, 403, 'A teacher must not be allowed to export school-wide result archives.');
    verifiedExports.push({ mode: 'teacher-denied', status: response.status });
    profileRole = 'Admin';
    resultAvailable = false;
    response = await route.POST(makeRequest('term'));
    assert.equal(response.status, 200, 'Available reports should export while missing results are skipped.');
    assert.equal(response.headers.get('x-export-pdf-count'), '1');
    assert.equal(response.headers.get('x-export-skipped-count'), '1');
    const skippedZip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    const skippedSummary = await skippedZip.file('Export_Summary.txt').async('string');
    assert.match(skippedSummary, /Generated PDFs: 1/);
    assert.match(skippedSummary, /Skipped reports: 1/);
    verifiedExports.push({ mode: 'missing-result-skipped', status: response.status, pdfCount: 1, skippedCount: 1 });
    console.log(JSON.stringify(verifiedExports));
  } finally {
    global.fetch = originalFetch;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
