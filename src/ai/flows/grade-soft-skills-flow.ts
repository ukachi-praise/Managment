'use server';
/**
 * @fileOverview Generates scores for a list of soft skills based on a student's overall academic average.
 *
 * - gradeSoftSkills - A function that handles the soft skill grading.
 * - GradeSoftSkillsInput - The input type for the gradeSoftSkills function.
 * - GradeSoftSkillsOutput - The return type for the gradeSoftSkills function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GradeSoftSkillsInputSchema = z.object({
  overallAverage: z.number().min(0).max(100).describe("The student's overall academic average for the term (a percentage from 0 to 100)."),
});

export type GradeSoftSkillsInput = z.infer<typeof GradeSoftSkillsInputSchema>;

const SoftSkillScoreSchema = z.object({
    skillName: z.string().describe("The name of the soft skill."),
    score: z.number().min(1).max(5).describe("The AI-generated score for the skill, from 1 (poor) to 5 (excellent)."),
});

const GradeSoftSkillsOutputSchema = z.object({
  softSkills: z.array(SoftSkillScoreSchema).describe("An array of all soft skills with their AI-generated scores."),
});

export type GradeSoftSkillsOutput = z.infer<typeof GradeSoftSkillsOutputSchema>;


export async function gradeSoftSkills(input: GradeSoftSkillsInput): Promise<GradeSoftSkillsOutput> {
  return gradeSoftSkillsFlow(input);
}

const allSoftSkills = [
    "Punctuality", "Neatness", "Creativity", "Honesty", 
    "Communication", "Teamwork", "Attentiveness", 
    "Self Control", "Leadership", "Initiative"
];

const prompt = ai.definePrompt({
  name: 'gradeSoftSkillsPrompt',
  input: {schema: GradeSoftSkillsInputSchema},
  output: {schema: GradeSoftSkillsOutputSchema},
  config: {
    retries: 3,
  },
  prompt: `You are an expert educator who needs to assess a student's soft skills based on their academic performance.
  
  Student's Overall Average: {{{overallAverage}}}%

  Based on this average, you must grade the student on the following soft skills: ${allSoftSkills.join(', ')}.
  
  The grading scale is from 1 to 5, where 1 is poor and 5 is excellent.

  - A high academic average (e.g., 80%+) should generally correlate with high scores (4s and 5s) in skills like Attentiveness, Self Control, and Punctuality.
  - An average score (e.g., 50-79%) should result in a mix of scores (mostly 3s and 4s).
  - A low score (e.g., below 50%) should correlate with lower scores (1s, 2s, and 3s).
  
  You MUST return an assessment for every single skill in the list. Structure your response as a JSON object containing a "softSkills" array, where each element is an object with "skillName" and "score".`,
});

const gradeSoftSkillsFlow = ai.defineFlow(
  {
    name: 'gradeSoftSkillsFlow',
    inputSchema: GradeSoftSkillsInputSchema,
    outputSchema: GradeSoftSkillsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
