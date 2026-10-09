/**
 * `data-*` attributes a component passes straight to one of its inner elements: a test id, an
 * analytics hook, or `data-force="focus"` on the dev page. Nothing else gets through.
 */
export type DataAttributes = { [name: `data-${string}`]: string | undefined };
