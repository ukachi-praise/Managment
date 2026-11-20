import jsPDF from 'jspdf';
import { RESULT_PDF_LAYOUT } from './result-pdf-layout';

export function createA4ResultPdfFromImage(imageDataUrl: string): jsPDF {
  const pdf = new jsPDF('p', 'mm', 'a4');
  pdf.addImage(
    imageDataUrl,
    'PNG',
    RESULT_PDF_LAYOUT.marginMm,
    RESULT_PDF_LAYOUT.marginMm,
    RESULT_PDF_LAYOUT.contentWidthMm,
    RESULT_PDF_LAYOUT.contentHeightMm,
    undefined,
    'FAST'
  );
  return pdf;
}
