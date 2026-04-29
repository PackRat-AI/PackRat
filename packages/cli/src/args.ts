import { isString } from '@packrat/guards';
import { z } from 'zod';

const preprocessRequiredNumber = (value: unknown) =>
  isString(value) && value.trim() === '' ? Number.NaN : value;

function parseWithMessage<T>(options: {
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  value: unknown;
  argName: string;
  expected: string;
}): T {
  const parsed = options.schema.safeParse(options.value);
  if (!parsed.success) {
    throw new Error(
      `Invalid ${options.argName}: "${String(options.value)}". Expected ${options.expected}.`,
    );
  }
  return parsed.data;
}

const positiveInteger = z.preprocess(
  preprocessRequiredNumber,
  z.coerce.number().finite().int().positive(),
);
const nonNegativeNumber = z.preprocess(
  preprocessRequiredNumber,
  z.coerce.number().finite().nonnegative(),
);
const percentage = z.preprocess(
  preprocessRequiredNumber,
  z.coerce.number().finite().min(0).max(100),
);
const confidence = z.preprocess(preprocessRequiredNumber, z.coerce.number().finite().min(0).max(1));
const optionalNumber = z.preprocess(
  (value) => (isString(value) && value.trim() === '' ? undefined : value),
  z.coerce.number().finite().optional(),
);

export function parsePositiveIntArg(value: unknown, argName: string): number {
  return parseWithMessage({
    schema: positiveInteger,
    value,
    argName,
    expected: 'a positive integer',
  });
}

export function parseNonNegativeNumberArg(value: unknown, argName: string): number {
  return parseWithMessage({
    schema: nonNegativeNumber,
    value,
    argName,
    expected: 'a non-negative number',
  });
}

export function parseOptionalNumberArg(value: unknown, argName: string): number | undefined {
  return parseWithMessage({
    schema: optionalNumber,
    value,
    argName,
    expected: 'a valid number',
  });
}

export function parsePercentageArg(value: unknown, argName: string): number {
  return parseWithMessage({
    schema: percentage,
    value,
    argName,
    expected: 'a percentage between 0 and 100',
  });
}

export function parseConfidenceArg(value: unknown, argName: string): number {
  return parseWithMessage({
    schema: confidence,
    value,
    argName,
    expected: 'a value between 0 and 1',
  });
}

export function parseCsvArg(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parsed = value
    .split(',')
    .map((site) => site.trim())
    .filter((site) => site.length > 0);
  return parsed.length > 0 ? parsed : undefined;
}
