import type { MDXComponents as MDXComponentsType } from 'mdx/types';
import Image, { type ImageProps } from 'next/image';
import Link, { type LinkProps } from 'next/link';

export function useMDXComponents(components: MDXComponentsType): MDXComponentsType {
  return {
    // Use custom components
    img: (props: ImageProps) => (
      <Image
        src={props.src || '/placeholder.svg'}
        alt={props.alt || 'Image'}
        width={800}
        height={400}
        className="rounded-md"
      />
    ),
    a: (props: LinkProps) => <Link {...props} className="text-primary hover:underline" />,
    // Add default components
    ...components,
  };
}
