
'use server';

import OpenAI from 'openai';
import { z } from 'zod';
import { headTeacherRemarks } from '@/lib/data';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Input schema remains the same
const GenerateRemarksInputSchema = z.object({
  studentName: z.string().describe("The student's name."),
  overallAverage: z.number().describe("The student's overall average score for the term."),
});
export type GenerateRemarksInput = z.infer<typeof GenerateRemarksInputSchema>;

// Output schema also remains the same
const GenerateRemarksOutputSchema = z.object({
  teacherRemark: z.string().describe("A personalized remark from the class teacher. It should be encouraging and based on their average. Must be a single sentence and must NOT mention the student's name."),
  headTeacherRemark: z.string().describe("A formal and concise remark from the head teacher, reflecting the student's overall performance. This MUST be one of the options provided in the tool functions."),
});
export type GenerateRemarksOutput = z.infer<typeof GenerateRemarksOutputSchema>;

// The main function that will be called from the component
export async function generateRemarks(input: GenerateRemarksInput): Promise<GenerateRemarksOutput> {
  const validatedInput = GenerateRemarksInputSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new Error('Invalid input for generateRemarks');
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an experienced educator writing report card remarks. You will receive student data and must return a JSON object with two keys: "teacherRemark" and "headTeacherRemark".
          
          CRITICAL: Do NOT mention the student's name in either remark.
          
          1.  For "teacherRemark", generate a new, short, warm, and encouraging single sentence based on the student's average score.
          2.  For "headTeacherRemark", you MUST SELECT the most appropriate remark from the following list: ${JSON.stringify(headTeacherRemarks)}
          
          Example for a high score:
          - teacherRemark: "Wonderful performance, keep it up!"
          - headTeacherRemark: "An outstanding and impressive academic achievement."
          
          Example for an average score:
          - teacherRemark: "A good effort, continue to work hard."
          - headTeacherRemark: "A fair performance that shows potential for improvement."

          Example for a low score:
          - teacherRemark: "More focus is required to improve your results."
          - headTeacherRemark: "Significant improvement is required in academic performance."
          
          The output MUST be a valid JSON object matching the requested schema.`
        },
        {
          role: "user",
          content: `Generate remarks for a student named ${validatedInput.data.studentName} with an overall average score of ${validatedInput.data.overallAverage}.`
        }
      ],
      response_format: { type: "json_object" }, // Request JSON output
    });

    const resultJson = completion.choices[0].message.content;
    if (!resultJson) {
      throw new Error('OpenAI returned an empty response.');
    }

    // Parse and validate the response from OpenAI
    const parsedResult = JSON.parse(resultJson);
    const validatedOutput = GenerateRemarksOutputSchema.safeParse(parsedResult);
    
    if (!validatedOutput.success) {
        console.error("OpenAI response did not match schema:", validatedOutput.error);
        throw new Error('AI response did not match the expected format.');
    }

    return validatedOutput.data;

  } catch (error) {
    console.error("Error calling OpenAI:", error);
    throw new Error('Failed to generate remarks from OpenAI.');
  }
}
