
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
        student, classroom, termResult, schoolSettings, scores, overall, schoolName 
    } = body;
    
    // --- 1. Load HTML Template ---
    const templatePath = path.join(process.cwd(), 'src', 'lib', 'result-template.html');
    let html = await fs.readFile(templatePath, 'utf8');

    // --- 2. Prepare Data and Inject into Template ---

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
    
    const resumptionDate = schoolSettings.nextTermResumptionDate.seconds
        ? format(new Date(schoolSettings.nextTermResumptionDate.seconds * 1000), 'PPP')
        : format(new Date(schoolSettings.nextTermResumptionDate), 'PPP');

    // Base64 encode the logo for embedding
    const logoPath = path.join(process.cwd(), 'public', 'Logo.jpg');
    const logoBuffer = await fs.readFile(logoPath);
    const logoBase64 = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;

    // Replace all placeholders
    html = html
      .replace(/{{logoUrl}}/g, logoBase64)
      .replace(/{{schoolName}}/g, schoolName || 'JustVision Kiddies School')
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
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
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

  } catch (error) {
    console.error('PDF Generation Error:', error);
    return new NextResponse(JSON.stringify({ error: 'Failed to generate PDF.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

    