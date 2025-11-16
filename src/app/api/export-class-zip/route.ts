
export const runtime = "nodejs"; // IMPORTANT: Force Node.js runtime

import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';
import { generateStudentExcel } from '@/lib/generateExcel';
import { generateReportCardHtml } from '@/lib/render-result-template';

async function generateStudentPDF(studentData: any) {
    const html = await generateReportCardHtml(studentData);
    
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' } });
    await browser.close();

    return pdfBuffer;
}


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (!body.students || !Array.isArray(body.students) || body.students.length === 0) {
            return new NextResponse(JSON.stringify({ error: 'No student data provided.' }), { status: 400 });
        }
        
        const { classroom } = body;
        const validStudents = body.students.filter(Boolean); // Filter out any null/undefined entries

        const zip = new JSZip();
        
        for (const studentData of validStudents) {
            const { student, scores, overall } = studentData;
            
            if (!student || !student.name || !scores) {
                console.warn("Skipping invalid student entry:", studentData);
                continue;
            }

            const studentFolder = zip.folder(student.name.replace(/[^a-z0-9]/gi, "_"));
            if(!studentFolder) continue;

            // Generate PDF
            try {
                // Pass the whole studentData object to the PDF generator
                const pdfBuffer = await generateStudentPDF(studentData);
                studentFolder.file(`${student.name.replace(/ /g, '_')}_Report.pdf`, pdfBuffer);
            } catch(err: any) {
                console.error(`PDF generation failed for ${student.name}:`, err.message);
                 // Optionally add a text file indicating the error
                studentFolder.file('PDF_GENERATION_FAILED.txt', err.message);
            }
            
            // Generate Excel
            try {
                const excelBuffer = await generateStudentExcel(
                    student, classroom, scores, overall, body.schoolSettings
                );
                studentFolder.file(`${student.name.replace(/ /g, '_')}_Report.xlsx`, excelBuffer);
            } catch (err: any) {
                 console.error(`Excel generation failed for ${student.name}:`, err.message);
                 studentFolder.file('EXCEL_GENERATION_FAILED.txt', err.message);
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

    } catch (error: any) {
        console.error('ZIP Generation Error:', error.message);
        return new NextResponse(JSON.stringify({ error: 'Failed to generate ZIP file.', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
