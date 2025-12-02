
// src/ai/flows/generate-soft-skills.ts
'use server';

/**
 * @fileOverview Generates soft skill assessments and remarks based on student data.
 *
 * - generateSoftSkills - A function that handles the soft skill generation process.
 * - GenerateSoftSkillsInput - The input type for the generateSoftSkills function.
 * - GenerateSoftSkillsOutput - The return type for the generateSoftSkills function.
 */

import {ai} from '@/ai/genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';

const GenerateSoftSkillsInputSchema = z.object({
  academicPerformance: z.string().describe('Description of the student\'s academic performance.'),
  attendance: z.string().describe('Description of the student\'s attendance record.'),
});

export type GenerateSoftSkillsInput = z.infer<typeof GenerateSoftSkillsInputSchema>;

const GenerateSoftSkillsOutputSchema = z.object({
  softSkillsAssessment: z.string().describe('AI-generated assessment of the student\'s soft skills.'),
  remarks: z.string().describe('AI-generated remarks about the student.'),
});

export type GenerateSoftSkillsOutput = z.infer<typeof GenerateSoftSkillsOutputSchema>;

export async function generateSoftSkills(input: GenerateSoftSkillsInput): Promise<GenerateSoftSkillsOutput> {
  return generateSoftSkillsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSoftSkillsPrompt',
  input: {schema: GenerateSoftSkillsInputSchema},
  output: {schema: GenerateSoftSkillsOutputSchema},
  model: 'gemini-1.5-flash-preview-0514',
  prompt: `You are an API that generates student assessments. Based on the data provided, return a JSON object with two keys: "softSkillsAssessment" and "remarks".

  Student Information:
  - Academic Performance: {{{academicPerformance}}}
  - Attendance: {{{attendance}}}

  Generate a concise and informative soft skills assessment and a general remark.`,
});

const generateSoftSkillsFlow = ai.defineFlow(
  {
    name: 'generateSoftSkillsFlow',
    inputSchema: GenerateSoftSkillsInputSchema,
    outputSchema: GenerateSoftSkillsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
