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
  teacherRemark: z.string().describe("A personalized remark from the class teacher. It should be encouraging and based on their average. Must be a single sentence and must NOT mention the student's name."),
  headTeacherRemark: z.string().describe("A formal and concise remark from the head teacher, reflecting the student's overall performance. Must be one sentence and must NOT mention the student's name."),
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

  Based on the student's average score, generate two remarks. CRITICAL: Do NOT mention the student's name in either remark.

  1.  A Teacher's Remark: This should be a warm, encouraging, and direct single sentence.
  2.  A Head Teacher's Remark: This should be a formal, concise single sentence summarizing academic standing.

  Example for a high score:
  - Teacher: "An excellent performance this term, your hard work is clearly paying off!"
  - Head Teacher: "An outstanding and impressive academic achievement."
  
  Example for an average score:
  - Teacher: "A satisfactory performance that shows clear potential for even better results."
  - Head Teacher: "A fair performance that shows potential for improvement."

  Example for a low score:
  - Teacher: "This result doesn't reflect true capabilities, and we will work together to improve next term."
  - Head Teacher: "Significant improvement is required in academic performance."
  
  Generate new, single-sentence remarks in the same style. Do not use the student's name.`,
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
