'use server';

import {
  generateSoftSkills,
  GenerateSoftSkillsInput,
  GenerateSoftSkillsOutput,
} from '@/ai/flows/generate-soft-skills';
import { z } from 'zod';

const ActionInputSchema = z.object({
  academicPerformance: z.string(),
  attendance: z.string(),
});

export type FormState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  data: GenerateSoftSkillsOutput | null;
};

export async function handleGenerateSoftSkills(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validatedFields = ActionInputSchema.safeParse({
    academicPerformance: formData.get('academicPerformance'),
    attendance: formData.get('attendance'),
  });

  if (!validatedFields.success) {
    return {
      status: 'error',
      message: 'Invalid input. Please check the fields.',
      data: null,
    };
  }

  try {
    const result = await generateSoftSkills(validatedFields.data);
    return {
      status: 'success',
      message: 'Soft skills generated successfully.',
      data: result,
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'An error occurred while generating soft skills.',
      data: null,
    };
  }
}
