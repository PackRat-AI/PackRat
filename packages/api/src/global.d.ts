import 'typed-htmx';

// A demo of how to augment foreign types with htmx attributes.
// In this case, Hono sources its types from its own namespace, so we do the same
// and directly extend its namespace.
declare module 'hono/jsx' {
  namespace JSX {
    interface HTMLAttributes extends HtmxAttributes {}
  }
}
