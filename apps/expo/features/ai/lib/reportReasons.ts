export const reportReasons = [
  'inappropriate_content',
  'harmful_advice',
  'inaccurate_information',
  'offensive_language',
  'safety_concern',
  'other',
] as const;

export type ReportReason = (typeof reportReasons)[number];

// Human-readable labels for report reasons
export const reportReasonLabels: Record<ReportReason, string> = {
  inappropriate_content: 'Inappropriate Content',
  harmful_advice: 'Harmful or Dangerous Advice',
  inaccurate_information: 'Inaccurate Information',
  offensive_language: 'Offensive Language',
  safety_concern: 'Safety Concern',
  other: 'Other',
};
