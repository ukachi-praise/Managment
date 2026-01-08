
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

type ScoreData = {
    subjectName: string;
    ca1: number | null;
    ca2: number | null;
    exam: number | null;
    total: number;
    grade: string;
    remark: string;
};

type PupilInfo = {
    name: string;
    admissionNumber: string;
};

type ClassroomInfo = {
    name: string;
};

type SchoolSettingsInfo = {
    currentSession: string;
    currentTermId: string;
};

type BroadsheetData = {
    classroomName: string;
    sessionId: string;
    termId: string;
    results: Array<{
        studentName: string;
        scores: Record<string, { ca1: number; ca2: number; exam: number }>;
    }>;
};


const termNames: Record<string, string> = { term1: '1st Term', term2: '2nd Term', term3: '3rd Term' };


export async function generatePupilExcel(
    pupil: PupilInfo, 
    classroom: ClassroomInfo, 
    scores: ScoreData[],
    overall: { average: string, grade: string },
    schoolSettings: SchoolSettingsInfo
) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`${pupil.name} Result`);

    // --- Header ---
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Pupil Report Card';
    titleCell.font = { name: 'Arial Black', size: 16, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    // --- Pupil Info ---
    sheet.addRow([]); // Spacer
    sheet.addRow(['Pupil Name:', pupil.name, '', 'Admission No:', pupil.admissionNumber]);
    sheet.addRow(['Class:', classroom.name, '', 'Session:', schoolSettings.currentSession]);
    sheet.addRow(['Term:', termNames[schoolSettings.currentTermId] || 'N/A']);
    sheet.getRow(3).font = { bold: true };
    sheet.getRow(4).font = { bold: true };
    sheet.getRow(5).font = { bold: true };

    // --- Scores Table ---
    sheet.addRow([]); // Spacer
    const headerRow = sheet.addRow(['Subject', 'CA1 (20)', 'CA2 (20)', 'Exam (60)', 'Total (100)', 'Grade', 'Remark']);
    headerRow.font = { bold: true };
    headerRow.eachCell(cell => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'D3D3D3' } // Light Grey
        };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });


    scores.forEach(score => {
        const row = sheet.addRow([
            score.subjectName,
            score.ca1,
            score.ca2,
            score.exam,
            score.total,
            score.grade,
            score.remark
        ]);
        row.eachCell(cell => {
             cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
    });
    
    // --- Summary ---
    sheet.addRow([]); // Spacer
    sheet.mergeCells(scores.length + 9, 4, scores.length + 9, 5); // Merge D and E
    const overallAvgLabel = sheet.getCell(scores.length + 9, 4);
    overallAvgLabel.value = 'Overall Average:';
    overallAvgLabel.font = { bold: true };
    
    const overallAvgValue = sheet.getCell(scores.length + 9, 6);
    overallAvgValue.value = `${overall.average}%`;

    sheet.mergeCells(scores.length + 10, 4, scores.length + 10, 5); // Merge D and E
    const overallGradeLabel = sheet.getCell(scores.length + 10, 4);
    overallGradeLabel.value = 'Overall Grade:';
    overallGradeLabel.font = { bold: true };

    const overallGradeValue = sheet.getCell(scores.length + 10, 6);
    overallGradeValue.value = overall.grade;


    // --- Column Widths ---
    sheet.getColumn('A').width = 30;
    sheet.getColumn('B').width = 15;
    sheet.getColumn('C').width = 15;
    sheet.getColumn('D').width = 15;
    sheet.getColumn('E').width = 15;
    sheet.getColumn('F').width = 15;
    sheet.getColumn('G').width = 20;


    return await workbook.xlsx.writeBuffer();
}

export async function generateBroadsheetExcel(broadsheet: BroadsheetData, subjectHeaders: string[], orderedSubjectIds: string[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`${broadsheet.classroomName} Broadsheet`);

    // --- Header ---
    sheet.mergeCells('A1:D1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${broadsheet.classroomName} - ${termNames[broadsheet.termId]} Broadsheet`;
    titleCell.font = { name: 'Arial Black', size: 16, bold: true };

    sheet.mergeCells('A2:D2');
    const sessionCell = sheet.getCell('A2');
    sessionCell.value = `Academic Session: ${broadsheet.sessionId}`;
    sessionCell.font = { size: 12 };
    
    sheet.addRow([]); // Spacer

    // --- Table Headers ---
    const headerRow = sheet.addRow(['S/N', 'Student Name', ...subjectHeaders, 'Total', 'Average']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(cell => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF000080' } // Navy Blue
        };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });


    // --- Table Body ---
    broadsheet.results.forEach((result, index) => {
        let studentTotal = 0;
        const studentScores = orderedSubjectIds.map(subId => {
            const subjectScore = result.scores[subId];
            if (subjectScore) {
                const total = (subjectScore.ca1 || 0) + (subjectScore.ca2 || 0) + (subjectScore.exam || 0);
                studentTotal += total;
                return total;
            }
            return 0;
        });

        const studentAverage = orderedSubjectIds.length > 0 ? studentTotal / orderedSubjectIds.length : 0;
        
        const row = sheet.addRow([
            index + 1,
            result.studentName,
            ...studentScores,
            studentTotal,
            Number(studentAverage.toFixed(2))
        ]);

        row.eachCell((cell, colNumber) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            if (colNumber > 2) {
                 cell.alignment = { horizontal: 'center' };
            }
        });
    });

    // --- Column Widths ---
    sheet.getColumn('A').width = 5;
    sheet.getColumn('B').width = 35;
    subjectHeaders.forEach((_, index) => {
        sheet.getColumn(3 + index).width = 15;
    });
    sheet.getColumn(3 + subjectHeaders.length).width = 12;
    sheet.getColumn(4 + subjectHeaders.length).width = 12;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
