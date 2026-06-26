type FeatureFlags = Record<string, boolean>;

const NON_IDENTIFIER_RE = /[^A-Za-z0-9_]/g;

export function swiftBool(value: boolean): string {
  return value ? 'true' : 'false';
}

export function swiftIdentifier(raw: string): string {
  const sanitized = raw.replace(NON_IDENTIFIER_RE, '');
  if (!sanitized) {
    throw new Error(`Unable to turn "${raw}" into a Swift identifier.`);
  }
  return sanitized.charAt(0).toLowerCase() + sanitized.slice(1);
}

export function renderSwiftFeatureFlags({
  enumName,
  featureFlags,
  sourceDescription,
}: {
  enumName: string;
  featureFlags: FeatureFlags;
  sourceDescription: string;
}): string {
  const fields = Object.entries(featureFlags)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `    static let ${swiftIdentifier(key)} = ${swiftBool(value)}`)
    .join('\n');

  return `// @generated - DO NOT EDIT
// Run \`bun swift:config\` to regenerate from ${sourceDescription}.

import Foundation

enum ${enumName} {
${fields}
}
`;
}
