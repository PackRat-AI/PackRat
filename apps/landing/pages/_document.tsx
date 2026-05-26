// Custom _document so the Pages Router static-exported 404/500 pages get
// `<html lang="en">` (Lighthouse "html-has-lang" + accessibility). The App
// Router routes set this via app/layout.tsx; this only affects pages/* output.
import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
