const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const JSZip = require('jszip');
const { jsPDF } = require('jspdf');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 });
  module._compile(output, filename);
};
const { launchPdfBrowser } = require('../src/lib/server/pdf-browser.ts');
const { RESULT_PDF_LAYOUT } = require('../src/lib/result-pdf-layout.ts');

function reportHtml(studentName) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
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
  </style></head><body><article id="report">
    <header><div><h1>ARMS</h1><div>Katampe 2 Mpape Abuja · Motto: Exceeding Great</div></div><div style="text-align:right"><h2>Pupil Report Card</h2>1st Term, 2026/2027</div></header>
    <section class="student"><div>Pupil Name: ${studentName}</div><div>Admission No: A001</div><div>Class: Nursery 1</div><div>Days Attended: 60</div><div>School Open: 65</div><div>Class Teacher: Test Teacher</div></section>
    <section class="subjects"><table><thead><tr><th>Subject</th><th>CA1 (20)</th><th>CA2 (20)</th><th>Exam (60)</th><th>Total (100)</th><th>Remark</th></tr></thead><tbody><tr><td>Mathematics</td><td>18</td><td>17</td><td>55</td><td>90</td><td>Excellent</td></tr></tbody></table><div class="summary">Overall Average: 90%<br>Overall Grade: A</div></section>
    <footer><div class="footer-cols"><div>Grading Key<table><tr><td>80–100</td><td>A</td><td>Excellent</td></tr><tr><td>70–79</td><td>B</td><td>Very Good</td></tr></table></div><div>Skill Score Rating<table><tr><td>5</td><td>Excellent</td></tr></table></div><div>Soft Skills Assessment<table><tr><td>Neatness</td><td>5</td></tr></table></div></div><p>Teacher's Remarks: Good work</p><div class="signatures"><span>Class Teacher's Signature</span><span>Head Teacher's Signature</span></div></footer>
  </article></body></html>`;
}

function assertOneA4Page(pdfBuffer, description) {
  assert.ok(pdfBuffer.length > 1000, `${description}: PDF is empty`);
  assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF', `${description}: invalid PDF header`);
  assert.ok(pdfBuffer.includes(Buffer.from('%%EOF')), `${description}: PDF has no EOF marker`);
  const pdfText = pdfBuffer.toString('latin1');
  const pageCount = (pdfText.match(/\/Type\s*\/Page\b/g) || []).length;
  assert.equal(pageCount, 1, `${description}: expected exactly one page, got ${pageCount}`);
  const mediaBox = pdfText.match(/\/MediaBox\s*\[([^\]]+)\]/)?.[1];
  assert.ok(mediaBox, `${description}: missing page dimensions`);
  const [left, bottom, right, top] = mediaBox.trim().split(/\s+/).map(Number);
  assert.ok(Math.abs((right - left) - 595.28) < 1 && Math.abs((top - bottom) - 841.89) < 1, `${description}: page is not A4 (${mediaBox})`);
}

async function main() {
  const browser = await launchPdfBrowser();
  try {
    const individualPage = await browser.newPage();
    await individualPage.setViewport({
      width: Math.round(RESULT_PDF_LAYOUT.contentWidthMm * 96 / 25.4),
      height: Math.round(RESULT_PDF_LAYOUT.contentHeightMm * 96 / 25.4),
      deviceScaleFactor: 2,
    });
    await individualPage.setContent(reportHtml('Individual Student'), { waitUntil: 'networkidle0' });
    const reportElement = await individualPage.$('#report');
    assert.ok(reportElement);
    const reportImage = await reportElement.screenshot({ type: 'png' });
    const previewPath = path.join(os.tmpdir(), 'arms-result-pdf-preview.png');
    fs.writeFileSync(previewPath, reportImage);
    const individualPdf = new jsPDF('p', 'mm', 'a4');
    individualPdf.addImage(
      `data:image/png;base64,${reportImage.toString('base64')}`,
      'PNG',
      RESULT_PDF_LAYOUT.marginMm,
      RESULT_PDF_LAYOUT.marginMm,
      RESULT_PDF_LAYOUT.contentWidthMm,
      RESULT_PDF_LAYOUT.contentHeightMm,
      undefined,
      'FAST'
    );
    const individualBuffer = Buffer.from(individualPdf.output('arraybuffer'));
    assertOneA4Page(individualBuffer, 'Individual export');

    const zip = new JSZip();
    const classFolder = zip.folder('Nursery_1');
    assert.ok(classFolder);
    const batchPdfSizes = [];
    for (const studentName of ['Batch Student 1', 'Batch Student 2']) {
      const page = await browser.newPage();
      try {
        await page.setContent(reportHtml(studentName), { waitUntil: 'networkidle0' });
        const pdfBuffer = Buffer.from(await page.pdf({
          format: 'A4',
          printBackground: true,
          scale: 1,
          displayHeaderFooter: false,
          margin: RESULT_PDF_LAYOUT.margin,
        }));
        assertOneA4Page(pdfBuffer, `${studentName} batch export`);
        classFolder.file(`${studentName.replaceAll(' ', '_')}_Report.pdf`, pdfBuffer);
        batchPdfSizes.push(pdfBuffer.length);
      } finally {
        await page.close();
      }
    }
    zip.file('Export_Summary.txt', 'Generated PDFs: 2');
    const archive = await zip.generateAsync({ type: 'nodebuffer' });
    const opened = await JSZip.loadAsync(archive);
    const entries = Object.keys(opened.files);
    assert.ok(entries.includes('Nursery_1/Batch_Student_1_Report.pdf'));
    assert.ok(entries.includes('Nursery_1/Batch_Student_2_Report.pdf'));
    assert.ok(entries.includes('Export_Summary.txt'));
    console.log(JSON.stringify({
      individual: { bytes: individualBuffer.length, pages: 1, paper: 'A4 portrait', margins: RESULT_PDF_LAYOUT.margin },
      batch: { studentCount: batchPdfSizes.length, pdfBytes: batchPdfSizes, pagesPerStudent: 1, paper: 'A4 portrait', margins: RESULT_PDF_LAYOUT.margin },
      zipBytes: archive.length,
      entries,
      previewPath,
    }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
