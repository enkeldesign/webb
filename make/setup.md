## Step 1: Install css

Add this line to the TOP of `/src/styles/index.css` (before any other imports):

```css
@import "<PACKAGE_NAME>/style.css";
```

This import defines all CSS custom properties (color tokens, spacing tokens,
radius tokens) used by this design system. Without it, var(--token-name)
references will resolve to nothing and the UI will have no styling.

## Step 2: Read the full design system stylesheet

After importing, read the full contents of the stylesheet to understand what
tokens are available:

```
cat node_modules/<PACKAGE_NAME>/dist/style.css
```

Do NOT use `head -100` or any truncated read. The file begins with Tailwind
preflight/reset CSS (box-sizing, margins, etc.) which is NOT the design system.
The actual token definitions (CSS custom properties like `--text-default`,
`--bg-brand`, `--spacer-*`, etc.) appear AFTER the preflight section.

Scan the full output for `:root` or `@theme` blocks containing `--` custom
property definitions. These are the tokens you must use in generated code.
