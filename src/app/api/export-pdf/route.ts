
export const runtime = "nodejs"; // IMPORTANT: Force Node.js runtime

import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { format } from 'date-fns';

const termNames: Record<string, string> = { term1: '1st Term', term2: '2nd Term', term3: '3rd Term' };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
        student, classroom, termResult, schoolSettings, scores, overall, templateData 
    } = body;
    
    // --- 1. Load HTML Template ---
    const templatePath = path.join(process.cwd(), 'src', 'lib', 'result-template.html');
    let html = await fs.readFile(templatePath, 'utf8');

    const settings = templateData?.settings;
    const schoolName = templateData?.schoolName || 'JustVision Kiddies School';

    // Subjects Table
    const subjectsHtml = scores.map((score: any) => `
        <tr>
            <td class="p-1 text-sm font-semibold">${score.subjectName}</td>
            <td class="p-1 text-sm text-center">${score.ca1 ?? '--'}</td>
            <td class="p-1 text-sm text-center">${score.ca2 ?? '--'}</td>
            <td class="p-1 text-sm text-center">${score.exam ?? '--'}</td>
            <td class="p-1 text-sm text-center font-bold">${score.total}</td>
            <td class="p-1 text-sm">${score.remark}</td>
        </tr>
    `).join('');

    // Soft Skills
    const softSkills = [
        ["Punctuality", "Neatness", "Creativity"],
        ["Honesty", "Communication", "Teamwork"],
        ["Attentiveness", "Self Control", "Leadership"]
    ];

    const softSkillsHtml = softSkills.map(column => `
        <div>
            <table>
                <tbody>
                    ${column.map(skill => `
                        <tr>
                            <td class="font-medium p-0.5 h-auto text-[9px] border border-black text-black">${skill}</td>
                            <td class="text-right p-0.5 h-auto text-[9px] border border-black w-[20px]">5</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('');
    
    // Robust date handling
    let resumptionDate;
    if (schoolSettings.nextTermResumptionDate) {
        // Handle both Timestamp-like objects and date strings
        const dateValue = schoolSettings.nextTermResumptionDate.seconds 
            ? new Date(schoolSettings.nextTermResumptionDate.seconds * 1000)
            : new Date(schoolSettings.nextTermResumptionDate);

        // Check if date is valid
        if (!isNaN(dateValue.getTime())) {
            resumptionDate = format(dateValue, 'PPP');
        } else {
            resumptionDate = 'N/A';
        }
    } else {
        resumptionDate = 'N/A';
    }


    // Base64 encode the logo for embedding
    const logoPath = path.join(process.cwd(), 'public', 'Logo.jpg');
    const logoBuffer = await fs.readFile(logoPath);
    const logoBase64 = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;

    // Replace all placeholders
    html = html
      .replace(/{{logoUrl}}/g, logoBase64)
      .replace(/{{schoolName}}/g, schoolName)
      .replace(/{{termName}}/g, termNames[schoolSettings.currentTermId] || 'N/A')
      .replace(/{{session}}/g, schoolSettings.currentSession || 'N/A')
      .replace(/{{student.name}}/g, student.name || 'N/A')
      .replace(/{{student.admissionNumber}}/g, student.admissionNumber || 'N/A')
      .replace(/{{classroom.name}}/g, classroom.name || 'N/A')
      .replace(/{{daysAttended}}/g, termResult.daysAttended?.toString() || '--')
      .replace(/{{daysSchoolOpened}}/g, schoolSettings.daysSchoolOpened?.toString() || 'N/A')
      .replace(/{{resumptionDate}}/g, resumptionDate)
      .replace(/{{classroom.teacherName}}/g, classroom.teacherName || 'N/A')
      .replace('{{subjects}}', subjectsHtml)
      .replace('{{softSkills}}', softSkillsHtml)
      .replace('{{overall.average}}', overall.average)
      .replace('{{overall.grade}}', overall.grade);


    // --- 3. Launch Puppeteer and Generate PDF ---
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    // Apply dynamic styles based on template settings
    let dynamicStyles = '';
    if (settings?.studentInfo.fontSize) {
      dynamicStyles += `.student-info-table { font-size: ${settings.studentInfo.fontSize}px; }`;
    }

    html = html.replace('/* DYNAMIC_STYLES */', dynamicStyles);

    // Conditionally remove elements
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);

    if (!settings?.header.visible) $('#header-section').remove();
    if (!settings?.studentInfo.visible) $('#student-info-section').remove();
    if (!settings?.subjectsTable.visible) $('#subjects-table-section').remove();
    if (!settings?.summary.visible) $('#summary-section').remove();
    if (!settings?.softSkills.visible) $('#soft-skills-section').remove();
    if (!settings?.gradingKey.visible) $('#grading-key-section').remove();
    if (!settings?.remarks.visible) $('#remarks-section').remove();
    if (!settings?.signatures.visible) $('#signatures-section').remove();

    await page.setContent($.html(), { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
    });

    await browser.close();

    // --- 4. Send PDF as Response ---
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${student.name.replace(/ /g, '_')}-Report.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('PDF Generation Error:', error.message);
    return new NextResponse(JSON.stringify({ error: 'Failed to generate PDF.', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
