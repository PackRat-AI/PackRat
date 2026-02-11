export const reportReasons = [
  'inappropriate_content',
  'harmful_advice',
  'inaccurate_information',
  'offensive_language',
  'safety_concern',
  'other',
] as const;

export type ReportReason = (typeof reportReasons)[number];

// Translation keys for report reasons
// These map to ai.reportReasons.* in the i18n translations
export const reportReasonTranslationKeys: Record<ReportReason, string> = {
  inappropriate_content: 'ai.reportReasons.inappropriateContent',
  harmful_advice: 'ai.reportReasons.harmfulAdvice',
  inaccurate_information: 'ai.reportReasons.inaccurateInformation',
  offensive_language: 'ai.reportReasons.offensiveLanguage',
  safety_concern: 'ai.reportReasons.safetyConcern',
  other: 'ai.reportReasons.other',
};
