
// src/ai/flows/generate-soft-skills.ts
'use server';

/**
 * @fileOverview Generates soft skill assessments and remarks based on pupil data.
 *
 * - generateSoftSkills - A function that handles the soft skill generation process.
 * - GenerateSoftSkillsInput - The input type for the generateSoftSkills function.
 * - GenerateSoftSkillsOutput - The return type for the generateSoftSkills function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSoftSkillsInputSchema = z.object({
  academicPerformance: z.string().describe('Description of the pupil\'s academic performance.'),
  attendance: z.string().describe('Description of the pupil\'s attendance record.'),
});

export type GenerateSoftSkillsInput = z.infer<typeof GenerateSoftSkillsInputSchema>;

const GenerateSoftSkillsOutputSchema = z.object({
  softSkillsAssessment: z.string().describe('AI-generated assessment of the pupil\'s soft skills.'),
  remarks: z.string().describe('AI-generated remarks about the pupil.'),
});

export type GenerateSoftSkillsOutput = z.infer<typeof GenerateSoftSkillsOutputSchema>;

export async function generateSoftSkills(input: GenerateSoftSkillsInput): Promise<GenerateSoftSkillsOutput> {
  return generateSoftSkillsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSoftSkillsPrompt',
  input: {schema: GenerateSoftSkillsInputSchema},
  output: {schema: GenerateSoftSkillsOutputSchema},
  model: 'googleai/gemini-1.5-pro-latest',
  prompt: `You are an API that generates pupil assessments. Based on the data provided, return a JSON object with two keys: "softSkillsAssessment" and "remarks".

  Pupil Information:
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
