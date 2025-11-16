
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { format } from 'date-fns';
import { generateStudentExcel } from '@/lib/generateExcel';

// Define types to match the expected data structure
type ScoreData = { subjectName: string; ca1: number | null; ca2: number | null; exam: number | null; total: number; grade: string; remark: string; };
type StudentData = { id: string; name: string; admissionNumber: string; };
type ClassroomData = { name: string; teacherName?: string; };
type TermResultData = { daysAttended?: number; };
type SchoolSettingsData = { currentSession: string; currentTermId: string; daysSchoolOpened: number; nextTermResumptionDate: any; };
type OverallData = { average: string; grade: string; };

const termNames: Record<string, string> = { term1: '1st Term', term2: '2nd Term', term3: '3rd Term' };

async function generateStudentPDF(
    student: StudentData,
    classroom: ClassroomData,
    termResult: TermResultData,
    schoolSettings: SchoolSettingsData,
    scores: ScoreData[],
    overall: OverallData,
    schoolName: string
) {
    const templatePath = path.join(process.cwd(), 'src', 'lib', 'result-template.html');
    let html = await fs.readFile(templatePath, 'utf8');

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
    
    const logoPath = path.join(process.cwd(), 'public', 'Logo.jpg');
    const logoBuffer = await fs.readFile(logoPath);
    const logoBase64 = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;

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

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' } });
    await browser.close();

    return pdfBuffer;
}


export async function POST(req: NextRequest) {
    try {
        const { students, classroom, schoolSettings, allSubjects, schoolName } = await req.json();

        if (!students || !Array.isArray(students) || students.length === 0) {
            return new NextResponse(JSON.stringify({ error: 'No student data provided.' }), { status: 400 });
        }
        
        const zip = new JSZip();
        const allSubjectsMap = new Map(allSubjects.map((s: any) => [s.id, s]));

        for (const studentData of students) {
            const { student, termResult, scores, overall } = studentData;
            
            // Generate PDF
            const pdfBuffer = await generateStudentPDF(
                student,
                classroom,
                termResult,
                schoolSettings,
                scores,
                overall,
                schoolName
            );
            
            // Generate Excel
            const excelBuffer = await generateStudentExcel(
                student,
                classroom,
                scores,
                overall,
                schoolSettings
            );

            // Add to zip
            const studentFolder = zip.folder(student.name.replace(/ /g, '_'));
            if(studentFolder){
                studentFolder.file(`${student.name.replace(/ /g, '_')}_Report.pdf`, pdfBuffer);
                studentFolder.file(`${student.name.replace(/ /g, '_')}_Report.xlsx`, excelBuffer);
            }
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        return new NextResponse(zipBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${classroom.name.replace(/ /g, '_')}_Results.zip"`,
            },
        });

    } catch (error) {
        console.error('ZIP Generation Error:', error);
        return new NextResponse(JSON.stringify({ error: 'Failed to generate ZIP file.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
