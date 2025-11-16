
export const runtime = "nodejs"; // IMPORTANT: Force Node.js runtime

import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { format } from 'date-fns';
import { generateReportCardHtml } from '@/lib/render-result-template';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // --- 1. Generate the full HTML for the report card ---
    const html = await generateReportCardHtml(body);

    // --- 2. Launch Puppeteer and Generate PDF ---
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

    // --- 3. Send PDF as Response ---
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${body.student.name.replace(/ /g, '_')}-Report.pdf"`,
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
