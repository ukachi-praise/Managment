
import { format } from 'date-fns';
import path from 'path';
import fs from 'fs/promises';

// Define types to match the expected data structure from the client
type ScoreData = { subjectName: string; ca1: number | null; ca2: number | null; exam: number | null; total: number; grade: string; remark: string; subSubjects?: string[] };
type PupilData = { id: string; name: string; admissionNumber: string; };
type ClassroomData = { name: string; teacherName?: string; };
type TermResultData = { daysAttended?: number; };
type SchoolSettingsData = { currentSession: string; currentTermId: string; daysSchoolOpened: number; nextTermResumptionDate: any; };
type OverallData = { average: string; grade: string; };
type TemplateSettings = { studentInfo: { fontSize: number; visible: boolean; }; header: { visible: boolean; }; subjectsTable: { visible: boolean; }; summary: { visible: boolean; }; softSkills: { visible: boolean; }; gradingKey: { visible: boolean; }; remarks: { visible: boolean; }; signatures: { visible: boolean; }; };
type SavedTemplateData = { name: string; schoolName: string; settings: TemplateSettings; };

interface ReportCardPayload {
    pupil: PupilData;
    classroom: ClassroomData;
    termResult: TermResultData;
    schoolSettings: SchoolSettingsData;
    scores: ScoreData[];
    overall: OverallData;
    templateData?: SavedTemplateData;
}

const termNames: Record<string, string> = { term1: '1st Term', term2: '2nd Term', term3: '3rd Term' };

async function getLogoBase64(): Promise<string> {
    try {
        const logoPath = path.join(process.cwd(), 'public', 'Logo.jpg');
        const logoBuffer = await fs.readFile(logoPath);
        return `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;
    } catch (error) {
        console.error("Could not load logo file:", error);
        return ''; // Return an empty string or a default placeholder
    }
}

export async function generateReportCardHtml(payload: ReportCardPayload): Promise<string> {
    const { 
        pupil, classroom, termResult, schoolSettings, scores, overall, templateData 
    } = payload;

    const settings = templateData?.settings;
    const schoolName = templateData?.schoolName || 'JustVision Kiddies School';

    const subjectsHtml = scores.map((score: any) => `
        <tr>
            <td class="p-1 text-sm font-semibold border border-black">${score.subjectName}</td>
            <td class="p-1 text-sm text-center border border-black">${score.ca1 ?? '--'}</td>
            <td class="p-1 text-sm text-center border border-black">${score.ca2 ?? '--'}</td>
            <td class="p-1 text-sm text-center border border-black">${score.exam ?? '--'}</td>
            <td class="p-1 text-sm text-center font-bold border border-black">${score.total}</td>
            <td class="p-1 text-sm border border-black">${score.remark}</td>
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
    
    let resumptionDate;
    if (schoolSettings.nextTermResumptionDate) {
        const dateValue = schoolSettings.nextTermResumptionDate.seconds 
            ? new Date(schoolSettings.nextTermResumptionDate.seconds * 1000)
            : new Date(schoolSettings.nextTermResumptionDate);
        
        if (!isNaN(dateValue.getTime())) {
            resumptionDate = format(dateValue, 'PPP');
        } else {
            resumptionDate = 'N/A';
        }
    } else {
        resumptionDate = 'N/A';
    }
    
    const logoBase64 = await getLogoBase64();

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pupil Report Card</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap');
            body { font-family: 'PT Sans', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #f3f4f6; }
            .report-card-container { width: 210mm; margin: auto; background: white; }
            .report-page { min-height: 297mm; padding: 1.5rem; position: relative; display: flex; flex-direction: column; }
            .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.05; width: 60%; pointer-events: none; }
            .content-wrapper { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; }
            table { border-collapse: collapse; width: 100%; }
            .page-break { page-break-before: always; }
            ${settings?.studentInfo.fontSize ? `.student-info-table { font-size: ${settings.studentInfo.fontSize}px; }` : ''}
            @media print {
              body { background-color: white; }
              .report-card-container { box-shadow: none; margin: 0; }
            }
        </style>
    </head>
    <body>
        <div class="report-card-container shadow-lg">
            <!-- PAGE 1 -->
            <div class="report-page">
                <img src="${logoBase64}" class="watermark" alt="Watermark">
                <div class="content-wrapper">
                    ${settings?.header.visible ? `
                    <header id="header-section" class="mb-4 p-2 border border-black">
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-4">
                                <img src="${logoBase64}" alt="School Logo" class="h-20 w-20 object-contain">
                                <div class="text-black">
                                    <h1 class="text-xl font-bold">${schoolName}</h1>
                                    <p class="text-base">Katampe 2 Mpape Abuja</p>
                                    <p class="text-base font-semibold">Motto: Exceeding Great</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <h2 class="font-bold text-lg">Pupil Report Card</h2>
                                <p class="text-base text-zinc-600">${termNames[schoolSettings.currentTermId] || 'N/A'}, ${schoolSettings.currentSession || 'N/A'}</p>
                            </div>
                        </div>
                        <hr class="my-2 border-black">
                    </header>` : ''}
                    
                    ${settings?.studentInfo.visible ? `
                    <div id="student-info-section" class="mb-4 p-2 border border-black text-xs student-info-table">
                        <div class="grid grid-cols-3 gap-y-1 gap-x-4">
                            <div><span class="font-semibold w-[90px] inline-block">Pupil Name:</span><span class="flex-1 border-b border-dotted border-black">${pupil.name || 'N/A'}</span></div>
                            <div><span class="font-semibold w-[90px] inline-block">Admission No:</span><span class="flex-1 border-b border-dotted border-black">${pupil.admissionNumber || 'N/A'}</span></div>
                            <div><span class="font-semibold w-[90px] inline-block">Class:</span><span class="flex-1 border-b border-dotted border-black">${classroom.name || 'N/A'}</span></div>
                            <div><span class="font-semibold w-[90px] inline-block">Term:</span><span class="flex-1 border-b border-dotted border-black">${termNames[schoolSettings.currentTermId] || 'N/A'}</span></div>
                            <div><span class="font-semibold w-[90px] inline-block">Session:</span><span class="flex-1 border-b border-dotted border-black">${schoolSettings.currentSession || 'N/A'}</span></div>
                            <div><span class="font-semibold w-[90px] inline-block">Days Attended:</span><span class="flex-1 border-b border-dotted border-black">${termResult.daysAttended?.toString() || '--'}</span></div>
                            <div><span class="font-semibold w-[90px] inline-block">School Open:</span><span class="flex-1 border-b border-dotted border-black">${schoolSettings.daysSchoolOpened?.toString() || 'N/A'}</span></div>
                            <div><span class="font-semibold w-[90px] inline-block">Resumption:</span><span class="flex-1 border-b border-dotted border-black">${resumptionDate}</span></div>
                            <div><span class="font-semibold w-[90px] inline-block">Class Teacher:</span><span class="flex-1 border-b border-dotted border-black">${classroom.teacherName || 'N/A'}</span></div>
                        </div>
                    </div>` : ''}

                    <div class="flex-grow">
                        ${settings?.subjectsTable.visible ? `
                        <div id="subjects-table-section" class="border border-black">
                            <table>
                                <thead>
                                    <tr class="bg-gray-200">
                                        <th class="p-1 text-sm text-left border border-black">Subject</th>
                                        <th class="p-1 text-sm text-center border border-black">CA1 (20)</th>
                                        <th class="p-1 text-sm text-center border border-black">CA2 (20)</th>
                                        <th class="p-1 text-sm text-center border border-black">Exam (60)</th>
                                        <th class="p-1 text-sm text-center border border-black">Total (100)</th>
                                        <th class="p-1 text-sm text-left border border-black">Remark</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${subjectsHtml}
                                </tbody>
                            </table>
                        </div>` : ''}

                        ${settings?.summary.visible ? `
                        <div id="summary-section" class="mt-2 flex justify-end">
                            <div class="w-1/2 rounded-md border border-black p-2 text-sm space-y-1">
                                <div class="flex justify-between"><span class="font-semibold">Overall Average:</span><span>${overall.average}%</span></div>
                                <div class="flex justify-between"><span class="font-semibold">Overall Grade:</span><span>${overall.grade}</span></div>
                            </div>
                        </div>` : ''}
                    </div>
                </div>
            </div>

            <!-- PAGE 2 -->
            <div class="report-page page-break">
                <img src="${logoBase64}" class="watermark" alt="Watermark">
                <div class="content-wrapper">
                    <footer class="w-full">
                        <section class='border border-black p-2 flex flex-col gap-2'>
                            ${settings?.softSkills.visible ? `
                            <div id="soft-skills-section" class="space-y-1">
                                <h3 class="font-bold text-black text-sm">Soft Skills Assessment</h3>
                                <div class="grid grid-cols-3 gap-x-2 text-[10px]">
                                    ${softSkillsHtml}
                                </div>
                            </div>` : ''}
                            
                            ${settings?.gradingKey.visible ? `
                            <div id="grading-key-section" class="grid grid-cols-2 gap-x-4 pt-2 text-[10px]">
                                <div class="space-y-1">
                                    <h3 class="font-bold text-black">Grading Key</h3>
                                    <table>
                                        <thead><tr class="bg-gray-200"><th class="border border-black p-0.5">Score</th><th class="border border-black p-0.5">Grade</th><th class="border border-black p-0.5">Remark</th></tr></thead>
                                        <tbody>
                                            <tr><td class="border border-black p-0.5">80 – 100</td><td class="border border-black p-0.5">A</td><td class="border border-black p-0.5">Excellent</td></tr>
                                            <tr><td class="border border-black p-0.5">70 – 79</td><td class="border border-black p-0.5">B</td><td class="border border-black p-0.5">Very Good</td></tr>
                                            <tr><td class="border border-black p-0.5">60 – 69</td><td class="border border-black p-0.5">C</td><td class="border border-black p-0.5">Good</td></tr>
                                            <tr><td class="border border-black p-0.5">50 – 59</td><td class="border border-black p-0.5">D</td><td class="border border-black p-0.5">Fair</td></tr>
                                            <tr><td class="border border-black p-0.5">0 – 49</td><td class="border border-black p-0.5">F</td><td class="border border-black p-0.5">Fail</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="space-y-1">
                                    <h3 class="font-bold text-black">Skill Score Rating</h3>
                                    <table>
                                        <thead><tr class="bg-gray-200"><th class="border border-black p-0.5">Score</th><th class="border border-black p-0.5">Remark</th></tr></thead>
                                        <tbody>
                                            <tr><td class="border border-black p-0.5">5</td><td class="border border-black p-0.5">Excellent</td></tr>
                                            <tr><td class="border border-black p-0.5">4</td><td class="border border-black p-0.5">Very Good</td></tr>
                                            <tr><td class="border border-black p-0.5">3</td><td class="border border-black p-0.5">Good</td></tr>
                                            <tr><td class="border border-black p-0.5">2</td><td class="border border-black p-0.5">Fair</td></tr>
                                            <tr><td class="border border-black p-0.5">1</td><td class="border border-black p-0.5">Poor</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>` : ''}

                            ${settings?.remarks.visible ? `
                            <div id="remarks-section" class="pt-2 space-y-2 text-sm">
                                <div><h3 class="font-bold">Teacher's Remarks:</h3><p class="min-h-[25px] border-b border-black p-1">A brilliant student...</p></div>
                                <div><h3 class="font-bold">Head Teacher's Remarks:</h3><p class="min-h-[25px] border-b border-black p-1">Excellent performance...</p></div>
                            </div>` : ''}

                            ${settings?.signatures.visible ? `
                            <div id="signatures-section" class="flex justify-between items-end pt-4 text-sm mt-auto">
                                <div class="text-center w-48"><div class="border-t border-black pt-1">Class Teacher's Signature</div></div>
                                <div class="text-center w-48"><div class="border-t border-black pt-1">Head Teacher's Signature</div></div>
                            </div>` : ''}
                        </section>
                    </footer>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}
