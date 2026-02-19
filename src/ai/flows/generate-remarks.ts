
// src/ai/flows/generate-remarks.ts
'use server';

/**
 * @fileOverview Generates teacher and head teacher remarks based on pupil performance.
 *
 * - generateRemarks - A function that handles the remark generation process.
 * - GenerateRemarksInput - The input type for the generateRemarks function.
 * - GenerateRemarksOutput - The return type for the generateRemarks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { headTeacherRemarks } from '@/lib/data';

const GenerateRemarksInputSchema = z.object({
  pupilName: z.string().describe("The pupil's name."),
  overallAverage: z.number().describe("The pupil's overall average score for the term."),
});

export type GenerateRemarksInput = z.infer<typeof GenerateRemarksInputSchema>;

const GenerateRemarksOutputSchema = z.object({
  teacherRemark: z.string().describe("A personalized remark from the class teacher. It should be encouraging and based on their average. Must be a single sentence and must NOT mention the pupil's name."),
  headTeacherRemark: z.string().describe("A formal and concise remark from the head teacher, reflecting the pupil's overall performance. This MUST be one of the options provided by the getHeadTeacherRemarks tool."),
});

export type GenerateRemarksOutput = z.infer<typeof GenerateRemarksOutputSchema>;

const getHeadTeacherRemarks = ai.defineTool(
    {
      name: 'getHeadTeacherRemarks',
      description: 'Get the list of approved remarks for the head teacher.',
      inputSchema: z.object({}),
      outputSchema: z.array(z.string()),
    },
    async () => {
      return headTeacherRemarks;
    }
);

export async function generateRemarks(input: GenerateRemarksInput): Promise<GenerateRemarksOutput> {
  return generateRemarksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRemarksPrompt',
  input: {schema: GenerateRemarksInputSchema},
  output: {schema: GenerateRemarksOutputSchema},
  tools: [getHeadTeacherRemarks],
  prompt: `You are an experienced educator tasked with writing report card remarks.
  
  Pupil Name: {{{pupilName}}}
  Overall Average Score: {{{overallAverage}}}

  Based on the pupil's average score, you will perform two tasks. CRITICAL: Do NOT mention the pupil's name in either remark.

  1.  A Teacher's Remark: Generate a new, short, warm, and encouraging single sentence.
  2.  A Head Teacher's Remark: Use the 'getHeadTeacherRemarks' tool to see the list of approved remarks. From that list, SELECT the one that best summarizes the pupil's academic standing.

  Example for a high score:
  - Teacher: "Wonderful performance, keep it up!"
  - Head Teacher: "An outstanding and impressive academic achievement."
  
  Example for an average score:
  - Teacher: "A good effort, continue to work hard."
  - Head Teacher: "A fair performance that shows potential for improvement."

  Example for a low score:
  - Teacher: "More focus is required to improve your results."
  - Head Teacher: "Significant improvement is required in academic performance."
  
  Generate a new, single-sentence remark for the teacher and SELECT one for the head teacher. Do not use the pupil's name.`,
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
