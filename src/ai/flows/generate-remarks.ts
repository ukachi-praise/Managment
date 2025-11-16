// src/ai/flows/generate-remarks.ts
'use server';

/**
 * @fileOverview Generates teacher and head teacher remarks based on student performance.
 *
 * - generateRemarks - A function that handles the remark generation process.
 * - GenerateRemarksInput - The input type for the generateRemarks function.
 * - GenerateRemarksOutput - The return type for the generateRemarks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateRemarksInputSchema = z.object({
  studentName: z.string().describe("The student's name."),
  overallAverage: z.number().describe("The student's overall average score for the term."),
});

export type GenerateRemarksInput = z.infer<typeof GenerateRemarksInputSchema>;

const GenerateRemarksOutputSchema = z.object({
  teacherRemark: z.string().describe("A personalized remark from the class teacher. It should be encouraging and mention the student's performance based on their average. Keep it concise (1-2 sentences)."),
  headTeacherRemark: z.string().describe("A formal and concise remark from the head teacher, reflecting the student's overall performance. Keep it to one sentence."),
});

export type GenerateRemarksOutput = z.infer<typeof GenerateRemarksOutputSchema>;

export async function generateRemarks(input: GenerateRemarksInput): Promise<GenerateRemarksOutput> {
  return generateRemarksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRemarksPrompt',
  input: {schema: GenerateRemarksInputSchema},
  output: {schema: GenerateRemarksOutputSchema},
  prompt: `You are an experienced educator tasked with writing report card remarks.
  
  Student Name: {{{studentName}}}
  Overall Average Score: {{{overallAverage}}}

  Based on the student's average score, generate two remarks:
  1.  A Teacher's Remark: This should be warm, encouraging, and directly address the student's effort and potential.
  2.  A Head Teacher's Remark: This should be more formal, concise, and provide a summary of the student's academic standing.

  Example for a high score:
  - Teacher: "An excellent performance this term, {{{studentName}}}! Your hard work is clearly paying off. Keep up the brilliant effort."
  - Head Teacher: "An outstanding and impressive academic achievement."
  
  Example for an average score:
  - Teacher: "A satisfactory performance, {{{studentName}}}. With a bit more focus in class, you have the potential to achieve even better results."
  - Head Teacher: "A fair performance that shows potential for improvement."

  Example for a low score:
  - Teacher: "{{{studentName}}}, this result doesn't reflect your true capabilities. Let's work together next term to focus on your studies and improve these scores."
  - Head Teacher: "Significant improvement is required in academic performance."
  
  Generate new remarks in the same style.`,
});

const generateRemarksFlow = ai.defineFlow(
  {
    name: 'generateRemarksFlow',
    inputSchema: GenerateRemarksInputSchema,
    outputSchema: GenerateRemarksOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
