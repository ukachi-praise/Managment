
export const runtime = "nodejs"; // IMPORTANT: Force Node.js runtime

import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import puppeteer from 'puppeteer';
import { generateReportCardHtml } from '@/lib/render-result-template';

async function generatePupilPDF(pupilData: any) {
    const html = await generateReportCardHtml(pupilData);
    
    // The fix is to add the --no-sandbox argument for compatibility with the environment.
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
        
        const { classroom, schoolSettings, templateData } = body;
        const validPupils = body.pupils.filter(Boolean); // Filter out any null/undefined entries

        const zip = new JSZip();
        
        // Create one folder for the class
        const classFolder = zip.folder(classroom.name.replace(/[^a-z0-9]/gi, "_"));
        if (!classFolder) {
            throw new Error('Could not create zip folder for the class.');
        }

        for (const pupilData of validPupils) {
            const { pupil } = pupilData;
            
            if (!pupil || !pupil.name) {
                console.warn("Skipping invalid pupil entry:", pupilData);
                continue;
            }

            // Generate PDF
            try {
                // Construct the full payload required by the HTML generator
                const fullPupilPayload = {
                    ...pupilData,
                    schoolSettings,
                    templateData,
                };
                const pdfBuffer = await generatePupilPDF(fullPupilPayload);
                // Add the PDF to the single class folder
                classFolder.file(`${pupil.name.replace(/ /g, '_')}_Report.pdf`, pdfBuffer);
            } catch(err: any) {
                console.error(`PDF generation failed for ${pupil.name}:`, err.message);
                 // Add a text file indicating the error for this specific pupil
                classFolder.file(`${pupil.name}_PDF_GENERATION_FAILED.txt`, err.message);
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
