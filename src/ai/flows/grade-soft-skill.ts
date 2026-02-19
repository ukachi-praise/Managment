
'use server';

import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

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
  const validatedInput = GradeSoftSkillInputSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new Error('Invalid input for gradeSoftSkill');
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an experienced educator providing a brief remark for a pupil's report card. Based on the skill and score provided, write a single, concise sentence that summarizes the pupil's performance in this skill. Be encouraging for high scores and constructive for low scores. The output must be a valid JSON object with a single key "remark".`
        },
        {
          role: "user",
          content: `Skill: ${validatedInput.data.skillName}\nScore: ${validatedInput.data.score} (out of 5)`
        }
      ],
      response_format: { type: "json_object" },
    });

    const resultJson = completion.choices[0].message.content;
    if (!resultJson) {
      throw new Error('OpenAI returned an empty response.');
    }
    
    const parsedResult = JSON.parse(resultJson);
    const validatedOutput = GradeSoftSkillOutputSchema.safeParse(parsedResult);
    
    if (!validatedOutput.success) {
        console.error("OpenAI response did not match schema:", validatedOutput.error);
        throw new Error('AI response did not match the expected format.');
    }

    return validatedOutput.data;

  } catch (error: any) {
    console.error("🔥 OpenAI Error in gradeSoftSkill:", error);
    throw new Error(
      error?.response?.data?.error?.message ||
      error?.message ||
      "Unknown OpenAI error occurred in gradeSoftSkill"
    );
  }
}
