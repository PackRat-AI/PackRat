import Image, { type ImageProps } from 'next/image';
import Link, { type LinkProps } from 'next/link';

// Define MDXComponents type locally since mdx/types is not available
type MDXComponents = {
  [key: string]: React.ComponentType<any>;
};

export function useMDXComponents(components: MDXComponents): MDXComponents {
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
