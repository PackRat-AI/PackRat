import { Text } from '@packrat/ui/src/text';
import type { ComponentProps } from 'react';
import type { PostAuthor } from '../types';
import { mentionSegments } from '../utils/mentions';

/** Caption or comment text with each tagged person's `@Name` set in bold primary. */
export function MentionText({
  text,
  people,
  ...props
}: { text: string; people: PostAuthor[] } & ComponentProps<typeof Text>) {
  return (
    <Text {...props}>
      {mentionSegments({ text, people }).map((segment, index) =>
        segment.person ? (
          <Text key={index} className="font-semibold text-primary">
            {segment.text}
          </Text>
        ) : (
          segment.text
        ),
      )}
    </Text>
  );
}
