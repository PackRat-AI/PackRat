import { z } from 'zod';

function parseWithMessage<T>(
  schema: z.ZodType<T>,
  value: unknown,
  flagName: string,
  expected: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid ${flagName}: "${String(value)}". Expected ${expected}.`);
  }
  return parsed.data;
}

const positiveInteger = z.coerce.number().int().positive();
const nonNegativeNumber = z.coerce.number().nonnegative();
const percentage = z.coerce.number().min(0).max(100);
const confidence = z.coerce.number().min(0).max(1);
const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') return undefined;
    return Number(value);
  })
  .pipe(z.number().finite().optional());

export function parsePositiveIntArg(value: unknown, flagName: string): number {
  return parseWithMessage(positiveInteger, value, flagName, 'a positive integer');
}

export function parseNonNegativeNumberArg(value: unknown, flagName: string): number {
  return parseWithMessage(nonNegativeNumber, value, flagName, 'a non-negative number');
}

export function parseOptionalNumberArg(value: unknown, flagName: string): number | undefined {
  return parseWithMessage(optionalNumber, value, flagName, 'a valid number');
}

export function parsePercentageArg(value: unknown, flagName: string): number {
  return parseWithMessage(percentage, value, flagName, 'a percentage between 0 and 100');
}

export function parseConfidenceArg(value: unknown, flagName: string): number {
  return parseWithMessage(confidence, value, flagName, 'a value between 0 and 1');
}

export function parseCsvArg(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parsed = value
    .split(',')
    .map((site) => site.trim())
    .filter((site) => site.length > 0);
  return parsed.length > 0 ? parsed : undefined;
}
