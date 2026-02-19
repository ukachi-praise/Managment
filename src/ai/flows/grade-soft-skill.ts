
'use server';
/**
 * @fileOverview Generates a remark for a soft skill based on a score.
 *
 * - gradeSoftSkill - A function that handles the soft skill grading.
 * - GradeSoftSkillInput - The input type for the gradeSoftSkill function.
 * - GradeSoftSkillOutput - The return type for the gradeSoftSkill function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GradeSoftSkillInputSchema = z.object({
  skillName: z.string().describe('The name of the soft skill being assessed (e.g., "Punctuality", "Creativity").'),
  score: z.number().min(1).max(5).describe('The score given to the pupil for the skill, on a scale of 1 to 5.'),
});

export type GradeSoftSkillInput = z.infer<typeof GradeSoftSkillInputSchema>;

const GradeSoftSkillOutputSchema = z.object({
  remark: z.string().describe("A concise, one-sentence remark that reflects the pupil's performance for that skill based on the score. E.g., for a score of 5 in Punctuality, it could be 'Always on time and ready to learn.' For a score of 2, it could be 'Improvement is needed in being on time.'"),
});

export type GradeSoftSkillOutput = z.infer<typeof GradeSoftSkillOutputSchema>;


export async function gradeSoftSkill(input: GradeSoftSkillInput): Promise<GradeSoftSkillOutput> {
  return gradeSoftSkillFlow(input);
}

const prompt = ai.definePrompt({
  name: 'gradeSoftSkillPrompt',
  input: {schema: GradeSoftSkillInputSchema},
  output: {schema: GradeSoftSkillOutputSchema},
  model: 'googleai/gemini-1.0-pro',
  prompt: `You are an experienced educator providing a brief remark for a pupil's report card.
  
  Skill: {{{skillName}}}
  Score: {{{score}}} (out of 5)

  Based on the score, write a single, concise sentence that summarizes the pupil's performance in this skill. Be encouraging for high scores and constructive for low scores.`,
});

const gradeSoftSkillFlow = ai.defineFlow(
  {
    name: 'gradeSoftSkillFlow',
    inputSchema: GradeSoftSkillInputSchema,
    outputSchema: GradeSoftSkillOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
