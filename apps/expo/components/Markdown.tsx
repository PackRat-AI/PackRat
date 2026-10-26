import RNMarkdown, { openUrl, type RenderRules } from '@ronradtke/react-native-markdown-display';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import type { ComponentProps } from 'react';
import { StyleSheet, Text } from 'react-native';

type MarkdownStyles = NonNullable<ComponentProps<typeof RNMarkdown>['style']>;
type LinkRuleArgs = Parameters<NonNullable<RenderRules['link']>>;

/** `styles` entries are merged over the defaults per rule, so callers override only what differs. */
export function Markdown({ children, styles }: { children: string; styles?: MarkdownStyles }) {
  const { colors } = useColorScheme();

  const markdownStyles = {
    body: {
      color: colors.foreground,
      fontSize: 16,
    },
    heading1: {
      color: colors.foreground,
      fontSize: 28,
      fontWeight: '700',
      marginTop: 24,
      marginBottom: 16,
    },
    heading2: {
      color: colors.foreground,
      fontSize: 24,
      fontWeight: '600',
      marginTop: 20,
      marginBottom: 12,
    },
    heading3: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: '600',
      marginTop: 16,
      marginBottom: 8,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 16,
    },
    strong: {
      fontWeight: '600' as const,
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'underline' as const,
    },
    blockquote: {
      backgroundColor: colors.grey6,
      borderLeftColor: colors.primary,
      borderLeftWidth: 4,
      paddingLeft: 16,
    },
  };

  const merged: MarkdownStyles = { ...markdownStyles };
  for (const [rule, style] of Object.entries(styles ?? {})) {
    merged[rule] = StyleSheet.flatten([merged[rule], style]);
  }

  return (
    <RNMarkdown
      style={merged}
      rules={{
        // The library renders a link as a `Pressable` (a View) inside the paragraph's Text, so an
        // inline link becomes a box that cannot wrap with the sentence: it floats beside the text
        // and the next line overlaps it. A pressable nested Text stays in the text flow.
        link: (...[node, children, , linkStyles]: LinkRuleArgs) => (
          <Text
            key={node.key}
            accessibilityRole="link"
            style={linkStyles.link}
            onPress={() => openUrl(node.attributes.href)}
          >
            {children}
          </Text>
        ),
      }}
    >
      {children}
    </RNMarkdown>
  );
}
