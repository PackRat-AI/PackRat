import type { MDXComponents } from "mdx/types";
import Image from "next/image";
import Link from "next/link";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Use custom components
    img: (props) => (
      <Image
        src={props.src || "/placeholder.svg"}
        alt={props.alt || "Image"}
        width={800}
        height={400}
        className="rounded-md"
      />
    ),
    a: (props) => <Link {...props} className="text-primary hover:underline" />,
    // Add default components
    ...components,
  };
}
