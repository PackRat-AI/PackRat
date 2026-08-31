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
  const entries = Object.entries(featureFlags).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  const fields = entries
    .map(([key, value]) => `    static let ${swiftIdentifier(key)} = ${swiftBool(value)}`)
    .join('\n');

  // The same values keyed by their wire name, so the runtime store can resolve
  // a server response against the build's known key set. The static constants
  // above stay the compile-time-safe way to read a flag whose value cannot
  // change at runtime; `codedDefaults` is what FeatureFlagStore layers over.
  const defaultsEntries = entries
    .map(([key, value]) => `        "${key}": ${swiftBool(value)},`)
    .join('\n');

  return `// @generated - DO NOT EDIT
// Run \`bun swift:config\` to regenerate from ${sourceDescription}.

import Foundation

enum ${enumName} {
${fields}

    /// Coded defaults keyed by wire name. Defines the known key set that
    /// \`FeatureFlagResolution\` normalizes a fetched or cached map against.
    static let codedDefaults: [String: Bool] = [
${defaultsEntries}
    ]
}
`;
}
