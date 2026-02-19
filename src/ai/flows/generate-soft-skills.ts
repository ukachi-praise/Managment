
'use server';

import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});


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
  const validatedInput = GenerateSoftSkillsInputSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new Error('Invalid input for generateSoftSkills');
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an API that generates pupil assessments. Based on the data provided, return a JSON object with two keys: "softSkillsAssessment" and "remarks". Generate a concise and informative soft skills assessment and a general remark. The output must be a valid JSON object.`
        },
        {
          role: "user",
          content: `Pupil Information:\n- Academic Performance: ${validatedInput.data.academicPerformance}\n- Attendance: ${validatedInput.data.attendance}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const resultJson = completion.choices[0].message.content;
    if (!resultJson) {
      throw new Error('OpenAI returned an empty response.');
    }
    
    const parsedResult = JSON.parse(resultJson);
    const validatedOutput = GenerateSoftSkillsOutputSchema.safeParse(parsedResult);

    if (!validatedOutput.success) {
        console.error("OpenAI response did not match schema:", validatedOutput.error);
        throw new Error('AI response did not match the expected format.');
    }

    return validatedOutput.data;

  } catch (error) {
    console.error("Error calling OpenAI for soft skills:", error);
    throw new Error('Failed to generate soft skills from OpenAI.');
  }
}
