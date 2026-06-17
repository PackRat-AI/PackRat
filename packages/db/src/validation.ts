export interface ValidationError {
  field: string;
  reason: string;
  value?: string | number | boolean | null | undefined;
}
