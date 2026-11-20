
export const runtime = "nodejs"; // IMPORTANT: Force Node.js runtime

import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import type { Browser } from 'puppeteer-core';
import { generateReportCardHtml } from '@/lib/render-result-template';
import { launchPdfBrowser } from '@/lib/server/pdf-browser';

async function generatePupilPDF(browser: Browser, pupilData: any) {
    const html = await generateReportCardHtml(pupilData);
    const page = await browser.newPage();
    try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = Buffer.from(await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' } }));
        if (pdfBuffer.length < 1000 || pdfBuffer.subarray(0, 4).toString() !== '%PDF') throw new Error('Puppeteer returned an invalid or empty PDF.');
        return pdfBuffer;
    } finally {
        await page.close().catch(() => undefined);
    }
}


export async function POST(req: NextRequest) {
    let browser: Browser | undefined;
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
        browser = await launchPdfBrowser();
        const generationErrors: string[] = [];

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
                const pdfBuffer = await generatePupilPDF(browser, fullPupilPayload);
                // Add the PDF to the single class folder
                classFolder.file(`${pupil.name.replace(/ /g, '_')}_Report.pdf`, pdfBuffer);
            } catch(err: any) {
                console.error(`PDF generation failed for ${pupil.name}:`, err.message);
                generationErrors.push(`${pupil.name}: ${err.message}`);
            }
        }

        if (generationErrors.length) {
            return NextResponse.json({ error: 'One or more PDFs could not be generated; no ZIP was created.', details: generationErrors }, { status: 500 });
        }
        if (!Object.keys(zip.files).some(path => path.endsWith('.pdf'))) {
            return NextResponse.json({ error: 'No valid PDF reports were generated.' }, { status: 500 });
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
    } finally {
        await browser?.close().catch(() => undefined);
    }
}
