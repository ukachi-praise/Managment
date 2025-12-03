
export const runtime = "nodejs"; // IMPORTANT: Force Node.js runtime

import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';
import { generatePupilExcel } from '@/lib/generateExcel';
import { generateReportCardHtml } from '@/lib/render-result-template';

async function generatePupilPDF(pupilData: any) {
    const html = await generateReportCardHtml(pupilData);
    
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

        if (!body.pupils || !Array.isArray(body.pupils) || body.pupils.length === 0) {
            return new NextResponse(JSON.stringify({ error: 'No pupil data provided.' }), { status: 400 });
        }
        
        const { classroom } = body;
        const validPupils = body.pupils.filter(Boolean); // Filter out any null/undefined entries

        const zip = new JSZip();
        
        for (const pupilData of validPupils) {
            const { pupil, scores, overall } = pupilData;
            
            if (!pupil || !pupil.name || !scores) {
                console.warn("Skipping invalid pupil entry:", pupilData);
                continue;
            }

            const pupilFolder = zip.folder(pupil.name.replace(/[^a-z0-9]/gi, "_"));
            if(!pupilFolder) continue;

            // Generate PDF
            try {
                // Pass the whole pupilData object to the PDF generator
                const pdfBuffer = await generatePupilPDF(pupilData);
                pupilFolder.file(`${pupil.name.replace(/ /g, '_')}_Report.pdf`, pdfBuffer);
            } catch(err: any) {
                console.error(`PDF generation failed for ${pupil.name}:`, err.message);
                 // Optionally add a text file indicating the error
                pupilFolder.file('PDF_GENERATION_FAILED.txt', err.message);
            }
            
            // Generate Excel
            try {
                const excelBuffer = await generatePupilExcel(
                    pupil, classroom, scores, overall, body.schoolSettings
                );
                pupilFolder.file(`${pupil.name.replace(/ /g, '_')}_Report.xlsx`, excelBuffer);
            } catch (err: any) {
                 console.error(`Excel generation failed for ${pupil.name}:`, err.message);
                 pupilFolder.file('EXCEL_GENERATION_FAILED.txt', err.message);
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
