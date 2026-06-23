# Component Source — Claude Dark Design System

Exact source for every component (and props `.d.ts`). Code blocks only — recreate these in your codebase's framework. All styling is via the CSS custom properties in `design-system/tokens/`.

> Icons: see `design-system/assets/icons/icon-data.js` (the `{viewBox, body}` glyph map) and the `<Icon name size />` wrapper documented in the README. The UI-kit app source is under `design-system/ui_kits/claude-app/`.

---

## Brand

### `components/brand/Logo.jsx`

```jsx
import React from "react";

/**
 * Logo — Claude wordmark, Anthropic symbol, or Anthropic wordmark.
 * Renders inline SVG so it inherits `currentColor`.
 */
export function Logo({ variant = "claude", height = 16, color, style = {}, ...rest }) {
  const base = { display: "inline-block", color: color || "var(--text-primary)", lineHeight: 0, ...style };

  if (variant === "anthropic-symbol") {
    return (
      <span style={{ ...base, height }} {...rest}>
        <svg height={height} viewBox="0 0 19.714 13.929" fill="none" style={{ display: "block" }}>
          <path d="M 14.286 0 L 11.214 0 L 16.714 13.929 L 19.714 13.929 L 14.286 0 Z M 5.429 0 L 0 13.929 L 3.071 13.929 L 4.286 11 L 10 11 L 11.143 13.857 L 14.214 13.857 L 8.643 0 L 5.5 0 L 5.429 0 Z M 5.143 8.429 L 7 3.5 L 8.929 8.429 L 5.214 8.429 L 5.143 8.429 Z" fill="currentColor" fillRule="nonzero" />
        </svg>
      </span>
    );
  }

  // claude wordmark (default)
  return (
    <span style={{ ...base, height }} {...rest}>
      <svg height={height} viewBox="0 0 67.419 16" fill="none" style={{ display: "block" }}>
        <path fill="currentColor" d="M 8.427 14.703 C 5.949 14.703 4.251 13.321 3.452 11.194 C 3.035 10.084 2.831 8.905 2.85 7.719 C 2.85 4.151 4.444 1.678 7.978 1.678 C 10.357 1.678 11.818 2.715 12.657 5.183 L 13.674 5.183 L 13.535 1.777 C 12.114 0.859 10.337 0.39 8.17 0.39 C 5.13 0.39 2.539 1.757 1.093 4.21 C 0.348 5.511 -0.029 6.991 0.002 8.489 C 0.002 11.219 1.285 13.632 3.704 14.98 C 5.029 15.688 6.515 16.038 8.017 15.997 C 10.377 15.997 12.247 15.548 13.906 14.763 L 14.335 11.002 L 13.299 11.002 C 12.677 12.719 11.936 13.751 10.707 14.299 C 10.105 14.57 9.345 14.708 8.427 14.708 L 8.427 14.703 Z M 19.113 1.673 L 19.212 0 L 18.511 0 L 15.386 0.938 L 15.386 1.441 L 16.768 2.083 L 16.768 13.825 C 16.768 14.625 16.364 14.802 15.288 14.935 L 15.288 15.794 L 20.594 15.794 L 20.594 14.935 C 19.522 14.802 19.113 14.625 19.113 13.825 L 19.113 1.678 L 19.113 1.673 Z M 40.213 15.987 L 40.623 15.987 L 44.211 15.306 L 44.211 14.427 L 43.703 14.393 C 42.863 14.314 42.651 14.136 42.651 13.455 L 42.651 7.196 L 42.75 5.187 L 42.182 5.187 L 38.792 5.676 L 38.792 6.53 L 39.122 6.589 C 40.035 6.727 40.307 6.984 40.307 7.626 L 40.307 13.203 C 39.438 13.884 38.599 14.314 37.607 14.314 C 36.491 14.314 35.81 13.746 35.81 12.438 L 35.81 7.196 L 35.909 5.187 L 35.322 5.187 L 31.931 5.676 L 31.931 6.53 L 32.281 6.589 C 33.199 6.727 33.471 6.984 33.471 7.626 L 33.471 12.774 C 33.471 14.955 34.7 15.992 36.669 15.992 C 38.17 15.992 39.399 15.192 40.317 14.077 L 40.218 15.992 L 40.213 15.987 Z M 30.342 9.047 C 30.342 6.258 28.861 5.187 26.196 5.187 C 23.831 5.187 22.114 6.16 22.114 7.779 C 22.114 8.272 22.291 8.638 22.642 8.889 L 24.438 8.657 C 24.359 8.114 24.32 7.779 24.32 7.645 C 24.32 6.727 24.809 6.263 25.801 6.263 C 27.267 6.263 28.007 7.295 28.007 8.948 L 28.007 9.496 L 24.3 10.607 C 23.071 10.938 22.37 11.234 21.901 11.915 C 21.651 12.331 21.529 12.812 21.551 13.297 C 21.551 14.876 22.642 15.992 24.498 15.992 C 25.84 15.992 27.03 15.385 28.066 14.235 C 28.436 15.385 29.004 15.992 30.016 15.992 C 30.835 15.992 31.477 15.671 32.04 15.054 L 32.04 14.215 L 31.749 14.215 C 31.061 14.215 30.342 13.964 30.342 12.379 L 30.342 9.047 Z M 28.007 13.247 C 27.405 13.964 26.685 14.354 25.939 14.354 C 25.022 14.354 24.399 13.79 24.399 12.812 C 24.399 11.717 25.061 11.273 26.45 10.829 L 28.007 10.31 L 28.007 13.247 Z M 53.864 5.187 C 52.363 5.187 51.193 5.834 50.275 7.078 L 50.275 0 L 49.574 0 L 46.184 0.938 L 46.184 1.441 L 47.566 2.083 L 47.566 13.825 C 47.566 14.625 47.162 14.802 46.085 14.935 L 46.085 15.794 L 51.391 15.794 L 51.391 14.935 C 50.319 14.802 49.911 14.625 49.911 13.825 L 49.911 8.291 C 50.601 7.43 51.391 6.984 52.323 6.984 C 53.587 6.984 54.357 7.917 54.357 9.673 L 54.357 13.825 C 54.357 14.625 53.948 14.802 52.876 14.935 L 52.876 15.794 L 58.182 15.794 L 58.182 14.935 C 57.11 14.802 56.701 14.625 56.701 13.825 L 56.701 9.224 C 56.701 6.658 55.598 5.187 53.864 5.187 Z M 67.419 13.737 L 67.117 13.594 C 66.358 14.057 65.638 14.255 64.799 14.255 C 62.835 14.255 61.591 12.961 61.591 10.464 L 61.591 10.107 L 67.143 10.107 C 67.143 7.078 65.638 5.187 62.954 5.187 C 60.13 5.187 58.379 7.196 58.379 10.31 C 58.379 13.554 60.249 15.992 63.359 15.992 C 65.262 15.992 66.689 15.108 67.419 13.737 Z M 62.835 6.066 C 64.063 6.066 64.661 7.078 64.701 9.244 L 61.61 9.388 C 61.749 7.276 62.034 6.066 62.835 6.066 Z" />
      </svg>
    </span>
  );
}
export default Logo;

```

### `components/brand/Logo.d.ts`

```ts
import * as React from "react";
export interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Which mark to render. */
  variant?: "claude" | "anthropic-symbol";
  /** Pixel height; SVG scales to it. */
  height?: number;
  /** Override color (defaults to currentColor / --text-primary). */
  color?: string;
}
export declare function Logo(props: LogoProps): JSX.Element;
export default Logo;

```

---

## Core

### `components/core/Button.jsx`

```jsx
import React from "react";

/**
 * Button — Claude's text buttons.
 * variant: "primary" (clay fill) | "secondary" (dim) | "outline" (hairline ring)
 * size:    "sm" | "md"
 */
export function Button({
  variant = "primary",
  size = "md",
  icon = null,
  iconRight = null,
  disabled = false,
  children,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);

  const sizes = {
    sm: { padding: "6px 8px", fontSize: 13 },
    md: { padding: "6px 10px", fontSize: 16 },
  };

  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-1)",
    borderRadius: "var(--radius-lg)",
    border: "none",
    fontFamily: "var(--font-sans)",
    fontWeight: "var(--weight-medium)",
    letterSpacing: "var(--tracking-tight)",
    lineHeight: 1,
    color: "var(--text-on-accent)",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.45 : 1,
    whiteSpace: "nowrap",
    transition: "background-color 120ms ease, box-shadow 120ms ease",
    ...sizes[size],
  };

  const variants = {
    primary: {
      backgroundColor: hover ? "rgba(170,83,46,0.8)" : "var(--clay-fill)",
      boxShadow: "var(--shadow-clay)",
    },
    secondary: {
      backgroundColor: hover ? "var(--black-10)" : "var(--black-20)",
    },
    outline: {
      backgroundColor: hover ? "var(--black-40)" : "transparent",
      boxShadow: "inset 0 0 0 1px #373632",
    },
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...variants[variant], ...style }}
      {...rest}
    >
      {icon}
      {children != null && <span>{children}</span>}
      {iconRight}
    </button>
  );
}
export default Button;

```

### `components/core/Button.d.ts`

```ts
import * as React from "react";
/**
 * Claude's primary action button. Use `primary` (clay) for the single main
 * action, `secondary` for cancel/dismiss, `outline` for low-emphasis actions.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md";
  /** Leading element, usually an <Icon/>. */
  icon?: React.ReactNode;
  /** Trailing element. */
  iconRight?: React.ReactNode;
  disabled?: boolean;
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;
export default Button;

```

### `components/core/AddButton.jsx`

```jsx
import React from "react";
import { Icon } from "../../assets/icons/Icon.jsx";

/**
 * AddButton — ghost "+ Add …" affordance with blue label (e.g. "Add Context").
 */
export function AddButton({ children = "Add Context", style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "6px 8px",
        borderRadius: "var(--radius-lg)",
        border: "none",
        cursor: "pointer",
        backgroundColor: hover ? "var(--white-05)" : "transparent",
        color: "var(--ui-blue)",
        fontFamily: "var(--font-sans)",
        fontWeight: "var(--weight-regular)",
        fontSize: "var(--text-base)",
        lineHeight: 1,
        transition: "background-color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      <Icon name="HeroiconsMiniPlus" size={14} style={{ flexShrink: 0 }} />
      {children}
    </button>
  );
}
export default AddButton;

```

### `components/core/AddButton.d.ts`

```ts
import * as React from "react";
/** Ghost "+ Add …" affordance with a blue label (e.g. "Add Context"). */
export interface AddButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function AddButton(props: AddButtonProps): JSX.Element;
export default AddButton;

```

### `components/core/IconButton.jsx`

```jsx
import React from "react";

/**
 * IconButton — square, icon-only button. Sizes SM/MD/LG/XL.
 */
export function IconButton({
  size = "md",
  active = false,
  disabled = false,
  children,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);

  const dims = { sm: 24, md: 28, lg: 32, xl: 40 };
  const d = dims[size];

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: d,
        height: d,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        border: "none",
        borderRadius: "var(--radius-lg)",
        backgroundColor: active
          ? "var(--white-08)"
          : hover
          ? "var(--white-05)"
          : "transparent",
        color: hover || active ? "var(--text-secondary)" : "var(--text-tertiary)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background-color 120ms ease, color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
export default IconButton;

```

### `components/core/IconButton.d.ts`

```ts
import * as React from "react";
/** Square icon-only button (toolbar / sidebar affordances). Pass an <Icon/> as the child. */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg" | "xl";
  /** Sticky pressed/selected look. */
  active?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
export default IconButton;

```

### `components/core/ModelButton.jsx`

```jsx
import React from "react";

/**
 * ModelButton — the compact model-selector pill ("3.5 Sonnet ⌄").
 */
export function ModelButton({ children = "3.5 Sonnet", style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "4px 4px 4px 8px",
        borderRadius: "var(--radius-lg)",
        border: "none",
        backgroundColor: hover ? "var(--black-40)" : "transparent",
        color: "var(--white-60)",
        fontFamily: "var(--font-serif)",
        fontWeight: "var(--weight-medium)",
        fontSize: 13,
        lineHeight: 1,
        cursor: "pointer",
        transition: "background-color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      <span>{children}</span>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
export default ModelButton;

```

### `components/core/ModelButton.d.ts`

```ts
import * as React from "react";
/** Compact serif model-selector pill with a chevron, e.g. "3.5 Sonnet ⌄". */
export interface ModelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}
export declare function ModelButton(props: ModelButtonProps): JSX.Element;
export default ModelButton;

```

### `components/core/PrevNext.jsx`

```jsx
import React from "react";

/**
 * PrevNext — pager link with a directional arrow ("← All Projects").
 */
export function PrevNext({ direction = "prev", children = "All Projects", style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const color = hover ? "var(--ivory-light)" : "var(--white-60)";
  const Arrow = (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      {direction === "prev" ? (
        <path d="M12 4l-5 6 5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M8 4l5 6-5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color,
        fontFamily: "var(--font-sans)",
        fontWeight: "var(--weight-regular)",
        fontSize: "var(--text-base)",
        lineHeight: 1,
        transition: "color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      {direction === "prev" && Arrow}
      <span>{children}</span>
      {direction === "next" && Arrow}
    </button>
  );
}
export default PrevNext;

```

### `components/core/PrevNext.d.ts`

```ts
import * as React from "react";
/** Inline pager link with a leading/trailing arrow (breadcrumb-style back/forward). */
export interface PrevNextProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  direction?: "prev" | "next";
  children?: React.ReactNode;
}
export declare function PrevNext(props: PrevNextProps): JSX.Element;
export default PrevNext;

```

---

## Forms

### `components/forms/Input.jsx`

```jsx
import React from "react";

/**
 * Input — labelled single-line text field.
 */
export function Input({ label, value, onChange, placeholder = "", style = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", ...style }}>
      {label && (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", color: "var(--text-primary)", lineHeight: 1 }}>
          {label}
        </span>
      )}
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          height: 45,
          boxSizing: "border-box",
          padding: "12px",
          borderRadius: "var(--radius-xl)",
          border: "none",
          outline: "none",
          backgroundColor: "var(--white-08)",
          boxShadow: focus ? "inset 0 0 0 1px var(--state-focus)" : "var(--ring-input)",
          color: "var(--ivory-light)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-lg)",
          letterSpacing: "var(--tracking-tight)",
          lineHeight: 1,
          transition: "box-shadow 120ms ease",
        }}
        {...rest}
      />
    </label>
  );
}
export default Input;

```

### `components/forms/Input.d.ts`

```ts
import * as React from "react";
/**
 * Labelled single-line text field. Focus shows a blue ring.
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "style"> {
  label?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Input(props: InputProps): JSX.Element;
export default Input;

```

### `components/forms/Textarea.jsx`

```jsx
import React from "react";

/**
 * Textarea — labelled multi-line text field.
 */
export function Textarea({ label, value, onChange, placeholder = "", rows = 4, style = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", ...style }}>
      {label && (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", color: "var(--text-primary)", lineHeight: 1 }}>
          {label}
        </span>
      )}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          boxSizing: "border-box",
          padding: "12px",
          borderRadius: "var(--radius-xl)",
          border: "none",
          outline: "none",
          resize: "vertical",
          backgroundColor: "var(--white-08)",
          boxShadow: focus ? "inset 0 0 0 1px var(--state-focus)" : "var(--ring-input)",
          color: "var(--ivory-light)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-lg)",
          letterSpacing: "var(--tracking-tight)",
          lineHeight: 1.4,
          transition: "box-shadow 120ms ease",
        }}
        {...rest}
      />
    </label>
  );
}
export default Textarea;

```

### `components/forms/Textarea.d.ts`

```ts
import * as React from "react";
/** Labelled multi-line text field. Focus shows a blue ring. */
export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "style"> {
  label?: React.ReactNode;
  rows?: number;
  style?: React.CSSProperties;
}
export declare function Textarea(props: TextareaProps): JSX.Element;
export default Textarea;

```

### `components/forms/Select.jsx`

```jsx
import React from "react";

/**
 * Select — labelled select trigger (value + chevron). Visual only; wire onClick to open a menu.
 */
export function Select({ label, value, placeholder = "Select", style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const hasValue = value != null && value !== "";
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%", ...style }}>
      {label && (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", color: "var(--text-primary)", lineHeight: 1 }}>
          {label}
        </span>
      )}
      <button
        type="button"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          height: 45,
          boxSizing: "border-box",
          padding: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: "var(--radius-xl)",
          border: "none",
          cursor: "pointer",
          backgroundColor: hover ? "var(--white-10)" : "var(--white-08)",
          boxShadow: "var(--ring-input)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-lg)",
          letterSpacing: "var(--tracking-tight)",
          lineHeight: 1,
          color: hasValue ? "var(--ivory-light)" : "var(--text-secondary)",
          transition: "background-color 120ms ease",
        }}
        {...rest}
      >
        <span>{hasValue ? value : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: "var(--white-60)" }}>
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </label>
  );
}
export default Select;

```

### `components/forms/Select.d.ts`

```ts
import * as React from "react";
/** Labelled select trigger (value + chevron). Visual only — wire onClick to open your own menu/popover. */
export interface SelectProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  label?: React.ReactNode;
  value?: string;
  placeholder?: string;
  style?: React.CSSProperties;
}
export declare function Select(props: SelectProps): JSX.Element;
export default Select;

```

### `components/forms/Checkbox.jsx`

```jsx
import React from "react";

/**
 * Checkbox — 24px square. Checked = blue fill + white check.
 */
export function Checkbox({ checked = false, onChange, disabled = false, style = {}, ...rest }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange && onChange(!checked)}
      style={{
        width: 24,
        height: 24,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        padding: 0,
        borderRadius: "var(--radius-sm)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        backgroundColor: checked ? "var(--ui-blue)" : "var(--slate-light)",
        boxShadow: checked
          ? "inset 0 0 0 1px var(--cloud-dark)"
          : "inset 0 0 0 1px rgba(102,102,99,0.5)",
        transition: "background-color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      {checked && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
export default Checkbox;

```

### `components/forms/Checkbox.d.ts`

```ts
import * as React from "react";
/** 24px checkbox. Checked = blue fill + white check. Controlled via `checked` + `onChange(next)`. */
export interface CheckboxProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;
export default Checkbox;

```

### `components/forms/Toggle.jsx`

```jsx
import React from "react";

/**
 * Toggle — a selectable option row (used in dropdown/style menus).
 * Shows a check on the right when selected.
 */
export function Toggle({ selected = false, children = "Normal", onClick, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        padding: "4px 8px",
        borderRadius: "var(--radius-md)",
        border: "none",
        cursor: "pointer",
        backgroundColor: hover ? "var(--white-05)" : "transparent",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-lg)",
        lineHeight: 1,
        transition: "background-color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      <span>{children}</span>
      {selected && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
export default Toggle;

```

### `components/forms/Toggle.d.ts`

```ts
import * as React from "react";
/** Selectable option row (dropdown / style menus). Shows a check when `selected`. */
export interface ToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  selected?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Toggle(props: ToggleProps): JSX.Element;
export default Toggle;

```

### `components/forms/SearchInput.jsx`

```jsx
import React from "react";

/**
 * SearchInput — pill search field with a leading magnifier.
 */
export function SearchInput({ value, onChange, placeholder = "Search your chats...", style = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        height: 45,
        boxSizing: "border-box",
        padding: "12px",
        borderRadius: "var(--radius-xl)",
        backgroundColor: "var(--white-08)",
        boxShadow: focus ? "inset 0 0 0 1px var(--state-focus)" : "var(--ring-input)",
        transition: "box-shadow 120ms ease",
        ...style,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: "var(--text-secondary)" }}>
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--ivory-light)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-lg)",
          letterSpacing: "var(--tracking-tight)",
          lineHeight: 1,
        }}
        {...rest}
      />
    </div>
  );
}
export default SearchInput;

```

### `components/forms/SearchInput.d.ts`

```ts
import * as React from "react";
/** Pill search field with a leading magnifier. */
export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "style"> {
  style?: React.CSSProperties;
}
export declare function SearchInput(props: SearchInputProps): JSX.Element;
export default SearchInput;

```

---

## Navigation

### `components/navigation/Nav.jsx`

```jsx
import React from "react";

/**
 * Nav — the app sidebar shell. Variants:
 *  - "fixed"     : 280px, flush against content, sunken surface (default)
 *  - "temp"      : 280px floating overlay panel with a shadow (slides over content)
 *  - "collapsed" : 56px icon rail
 */
export function Nav({ variant = "fixed", children, style = {}, ...rest }) {
  const base = {
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    background: "var(--surface-sunken)",
    padding: variant === "collapsed" ? "16px 8px" : "16px 12px",
    gap: "var(--space-1)",
  };
  const variants = {
    fixed: { width: 280, flexShrink: 0, borderRight: "1px solid var(--white-05)" },
    temp: { width: 280, flexShrink: 0, borderRadius: "var(--radius-2xl)", boxShadow: "var(--shadow-popover), inset 0 0 0 1px var(--white-10)", margin: 8, height: "calc(100% - 16px)" },
    collapsed: { width: 56, flexShrink: 0, alignItems: "center", borderRight: "1px solid var(--white-05)" },
  };
  return (
    <aside style={{ ...base, ...variants[variant], ...style }} data-variant={variant} {...rest}>
      {children}
    </aside>
  );
}
export default Nav;

```

### `components/navigation/Nav.d.ts`

```ts
import * as React from "react";
/** App sidebar shell. `fixed` (flush rail), `temp` (floating overlay), `collapsed` (56px icon rail). */
export interface NavProps extends Omit<React.HTMLAttributes<HTMLElement>, "style"> {
  variant?: "fixed" | "temp" | "collapsed";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Nav(props: NavProps): JSX.Element;
export default Nav;

```

### `components/navigation/NavItem.jsx`

```jsx
import React from "react";

/**
 * NavItem — sidebar list row (serif label + optional leading icon).
 */
export function NavItem({ icon = null, selected = false, children, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "6px",
        borderRadius: "var(--radius-md)",
        border: "none",
        textAlign: "left",
        cursor: "pointer",
        backgroundColor: selected ? "var(--white-08)" : hover ? "var(--white-05)" : "transparent",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-serif)",
        fontWeight: "var(--weight-regular)",
        fontSize: "var(--text-base-sm)",
        lineHeight: 1,
        transition: "background-color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      {icon && <span style={{ display: "inline-flex", flexShrink: 0, color: "var(--cloud-light)" }}>{icon}</span>}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {children}
      </span>
    </button>
  );
}
export default NavItem;

```

### `components/navigation/NavItem.d.ts`

```ts
import * as React from "react";
/** Chat-list sidebar row: serif label, optional leading icon, sticky `selected` state. */
export interface NavItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  icon?: React.ReactNode;
  selected?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function NavItem(props: NavItemProps): JSX.Element;
export default NavItem;

```

### `components/navigation/TopNavItem.jsx`

```jsx
import React from "react";

/**
 * TopNavItem — primary sidebar nav row (sans label + icon).
 * Distinct from NavItem (chat list) — used for "Start new chat", "Projects", etc.
 */
export function TopNavItem({ icon = null, selected = false, children, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "7px 6px",
        borderRadius: "var(--radius-md)",
        border: "none",
        textAlign: "left",
        cursor: "pointer",
        backgroundColor: selected ? "var(--white-08)" : hover ? "var(--white-05)" : "transparent",
        color: selected ? "var(--text-primary)" : "var(--text-secondary)",
        fontFamily: "var(--font-sans)",
        fontWeight: "var(--weight-regular)",
        fontSize: "var(--text-base)",
        lineHeight: 1,
        transition: "background-color 120ms ease, color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      {icon && (
        <span style={{ display: "inline-flex", flexShrink: 0, color: selected ? "var(--cloud-light)" : "var(--cloud-medium)" }}>
          {icon}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {children}
      </span>
    </button>
  );
}
export default TopNavItem;

```

### `components/navigation/TopNavItem.d.ts`

```ts
import * as React from "react";
/** Primary sidebar nav row (sans label + icon) — "Start new chat", "Projects", "Recents". */
export interface TopNavItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  icon?: React.ReactNode;
  selected?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function TopNavItem(props: TopNavItemProps): JSX.Element;
export default TopNavItem;

```

### `components/navigation/Tab.jsx`

```jsx
import React from "react";

/**
 * Tab — compact filter tab. Selected = blue text + blue hairline ring.
 */
export function Tab({ selected = false, children, onClick, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const color = selected ? "var(--state-focus)" : hover ? "var(--text-secondary)" : "var(--text-tertiary)";
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 8px",
        borderRadius: "var(--radius-md)",
        border: "none",
        cursor: "pointer",
        backgroundColor: "transparent",
        boxShadow: selected ? "inset 0 0 0 1px var(--state-focus)" : "none",
        color,
        fontFamily: "var(--font-sans)",
        fontWeight: "var(--weight-regular)",
        fontSize: "var(--text-base)",
        lineHeight: 1,
        transition: "color 120ms ease, box-shadow 120ms ease",
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
export default Tab;

```

### `components/navigation/Tab.d.ts`

```ts
import * as React from "react";
/** Compact filter tab. Selected state = focus-blue text inside a blue hairline ring. */
export interface TabProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  selected?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Tab(props: TabProps): JSX.Element;
export default Tab;

```

### `components/navigation/TopBar.jsx`

```jsx
import React from "react";
import { Icon } from "../../assets/icons/Icon.jsx";
import { PrevNext } from "../core/PrevNext.jsx";
import { IconButton } from "../core/IconButton.jsx";

/**
 * TopBar — content header: a back/breadcrumb link on the left, icon actions on the right.
 */
export function TopBar({ crumb = "All Projects", onBack, actions, style = {}, ...rest }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxSizing: "border-box",
        height: 44,
        padding: "0 12px",
        ...style,
      }}
      {...rest}
    >
      <PrevNext direction="prev" onClick={onBack}>{crumb}</PrevNext>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
        {actions != null ? actions : (
          <>
            <IconButton size="lg"><Icon name="HeroiconsSolidStar" size={20} style={{ color: "var(--hero-manilla)" }} /></IconButton>
            <IconButton size="lg"><Icon name="HeroiconsOutlineEllipsisVertical" size={20} /></IconButton>
          </>
        )}
      </div>
    </div>
  );
}
export default TopBar;

```

### `components/navigation/TopBar.d.ts`

```ts
import * as React from "react";
/** Content header: back/breadcrumb link left, icon actions right (star, ellipsis by default). */
export interface TopBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style"> {
  crumb?: React.ReactNode;
  onBack?: () => void;
  /** Override the right-hand actions. */
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function TopBar(props: TopBarProps): JSX.Element;
export default TopBar;

```

---

## Display

### `components/display/Badge.jsx`

```jsx
import React from "react";

/**
 * Badge — small status label, e.g. a "Private" lock pill.
 */
export function Badge({ icon = null, children = "Private", style = {}, ...rest }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "4px 6px",
        borderRadius: "var(--radius-lg)",
        backgroundColor: "#1A1915",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)",
        fontWeight: "var(--weight-medium)",
        fontSize: "var(--text-sm)",
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {icon && <span style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span>}
      {children}
    </span>
  );
}
export default Badge;

```

### `components/display/Badge.d.ts`

```ts
import * as React from "react";
/** Small status label (lock pill, etc). Pass an optional leading icon. */
export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "style"> {
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Badge(props: BadgeProps): JSX.Element;
export default Badge;

```

### `components/display/Chip.jsx`

```jsx
import React from "react";

/**
 * Chip — two flavors:
 *  - "plan"   : serif, purple gradient capsule (e.g. "Professional Plan")
 *  - "preset" : tiny grey sans tag (e.g. "Preset")
 */
export function Chip({ variant = "plan", children, style = {}, ...rest }) {
  if (variant === "preset") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "6px 8px",
          borderRadius: "var(--radius-2xl)",
          backgroundColor: "var(--white-05)",
          color: "var(--text-secondary)",
          fontFamily: "var(--font-sans)",
          fontWeight: "var(--weight-medium)",
          fontSize: "var(--text-2xs)",
          lineHeight: 1,
          whiteSpace: "nowrap",
          ...style,
        }}
        {...rest}
      >
        {children || "Preset"}
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 12px",
        borderRadius: "var(--radius-pill)",
        background: "linear-gradient(180deg, rgba(155,135,245,0.08) 0%, rgba(90,79,143,0.08) 100%)",
        boxShadow: "inset 0 0 0 1px rgba(155,135,245,0.18)",
        color: "var(--ui-purple)",
        fontFamily: "var(--font-serif)",
        fontWeight: "var(--weight-regular)",
        fontSize: "var(--text-md)",
        letterSpacing: "var(--tracking-serif)",
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {children || "Professional Plan"}
    </span>
  );
}
export default Chip;

```

### `components/display/Chip.d.ts`

```ts
import * as React from "react";
/** Pill chip. `plan` = serif purple gradient capsule; `preset` = tiny grey sans tag. */
export interface ChipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "style"> {
  variant?: "plan" | "preset";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Chip(props: ChipProps): JSX.Element;
export default Chip;

```

### `components/display/CapacityBar.jsx`

```jsx
import React from "react";

/**
 * CapacityBar — thin progress track + caption (e.g. knowledge capacity used).
 */
export function CapacityBar({ percent = 10, label, showInfo = true, style = {}, ...rest }) {
  const pct = Math.max(0, Math.min(100, percent));
  const caption = label != null ? label : `${pct}% percent of knowledge capacity used`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", width: "100%", ...style }} {...rest}>
      <div
        style={{
          position: "relative",
          height: 8,
          borderRadius: "var(--radius-md)",
          backgroundColor: "var(--slate-medium)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 2,
            top: 2,
            bottom: 2,
            width: `calc(${pct}% - 4px)`,
            minWidth: 4,
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--ui-blue)",
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-2xs)", color: "var(--text-secondary)", lineHeight: 1 }}>
          {caption}
        </span>
        {showInfo && (
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: "var(--text-secondary)" }}>
            <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10 9v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="10" cy="6.5" r="0.9" fill="currentColor" />
          </svg>
        )}
      </div>
    </div>
  );
}
export default CapacityBar;

```

### `components/display/CapacityBar.d.ts`

```ts
import * as React from "react";
/** Thin progress track + caption, e.g. knowledge-capacity meter. */
export interface CapacityBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style"> {
  /** 0–100. */
  percent?: number;
  /** Override the auto caption. */
  label?: React.ReactNode;
  showInfo?: boolean;
  style?: React.CSSProperties;
}
export declare function CapacityBar(props: CapacityBarProps): JSX.Element;
export default CapacityBar;

```

### `components/display/Blankslate.jsx`

```jsx
import React from "react";

/**
 * Blankslate — dashed/empty-state panel with centered helper copy.
 */
export function Blankslate({ children = "Start a chat to keep conversation organized and re-use project knowledge.", style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 80px",
        borderRadius: "var(--radius-2xl)",
        boxShadow: "inset 0 0 0 1px var(--white-05)",
        backgroundColor: hover ? "rgba(148,148,138,0.06)" : "transparent",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)",
        fontWeight: "var(--weight-regular)",
        fontSize: "var(--text-base)",
        lineHeight: 1.4,
        textWrap: "pretty",
        transition: "background-color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
export default Blankslate;

```

### `components/display/Blankslate.d.ts`

```ts
import * as React from "react";
/** Empty-state panel with centered helper copy and a hairline ring. */
export interface BlankslateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style"> {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Blankslate(props: BlankslateProps): JSX.Element;
export default Blankslate;

```

### `components/display/ChatCard.jsx`

```jsx
import React from "react";
import { ProjectLabel } from "./ProjectLabel.jsx";

/**
 * ChatCard — a recent-chat tile: optional project label, serif title, timestamp.
 */
export function ChatCard({ title = "Strategies for Maximizing Interaction", project, time = "3 hours ago", style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        boxSizing: "border-box",
        padding: "15px 16px 15px 10px",
        borderRadius: 14,
        boxShadow: "inset 0 0 0 1px var(--white-05)",
        backgroundColor: hover ? "var(--white-05)" : "transparent",
        cursor: "pointer",
        transition: "background-color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      {project && <ProjectLabel>{project}</ProjectLabel>}
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: "var(--weight-regular)",
          fontSize: "var(--text-lg)",
          color: "var(--text-primary)",
          lineHeight: 1.15,
          textWrap: "pretty",
        }}
      >
        {title}
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--white-60)", lineHeight: 1 }}>
        {time}
      </span>
    </div>
  );
}
export default ChatCard;

```

### `components/display/ChatCard.d.ts`

```ts
import * as React from "react";
/**
 * Recent-chat tile: optional project label, serif title, relative timestamp.
 */
export interface ChatCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "title"> {
  title?: React.ReactNode;
  /** Project name; renders a ProjectLabel when set. */
  project?: string;
  time?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function ChatCard(props: ChatCardProps): JSX.Element;
export default ChatCard;

```

### `components/display/ChatEmpty.jsx`

```jsx
import React from "react";
import { Icon } from "../../assets/icons/Icon.jsx";
import { ModelButton } from "../core/ModelButton.jsx";

/**
 * ChatEmpty — the empty-chat composer: prompt line, model + style pills, attach + project row.
 * This is the big centered "How can Claude help you today?" input.
 */
export function ChatEmpty({ placeholder = "How can Claude help you today?", style = {}, ...rest }) {
  return (
    <div
      style={{
        width: "100%",
        borderRadius: 16,
        overflow: "hidden",
        background: "#393937",
        boxShadow: "inset 0 0 0 1px #52514A",
        ...style,
      }}
      {...rest}
    >
      <div style={{ padding: "16px 17px 9px" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--white-60)", lineHeight: 1.3, minHeight: 40 }}>
          {placeholder}
        </div>
        <div style={{ display: "flex", gap: 2, paddingTop: 8 }}>
          <ModelButton>3.5 Sonnet</ModelButton>
          <ModelButton>Choose Style</ModelButton>
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 10px 12px 19px", background: "#282624",
        boxShadow: "inset 0 0 0 1px #393831",
      }}>
        <Icon name="FiPlusCircle" size={20} style={{ color: "var(--white-60)" }} />
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 2, padding: "6px 8px",
          borderRadius: "var(--radius-lg)", boxShadow: "inset 0 0 0 1px #373632",
          color: "var(--white-60)", fontFamily: "var(--font-sans)", fontSize: 11, lineHeight: 1,
        }}>
          <Icon name="IconProject" size={12} />
          Use a project
          <Icon name="HeroiconsMiniChevronDown" size={16} />
        </span>
      </div>
    </div>
  );
}
export default ChatEmpty;

```

### `components/display/ChatEmpty.d.ts`

```ts
import * as React from "react";
/** Empty-chat composer card ("How can Claude help you today?") with model/style pills + project row. */
export interface ChatEmptyProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style"> {
  placeholder?: string;
  style?: React.CSSProperties;
}
export declare function ChatEmpty(props: ChatEmptyProps): JSX.Element;
export default ChatEmpty;

```

### `components/display/RecentChat.jsx`

```jsx
import React from "react";
import { Icon } from "../../assets/icons/Icon.jsx";

/**
 * RecentChat — compact recent-chat list row (icon + title + relative time), distinct
 * from the larger ChatCard tile. Used in lists and the recents rail.
 */
export function RecentChat({ title = "Strategies for Maximizing Interaction", time = "3 hours ago", selected = false, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        boxSizing: "border-box",
        padding: "8px 10px",
        borderRadius: "var(--radius-lg)",
        cursor: "pointer",
        backgroundColor: selected ? "var(--white-08)" : hover ? "var(--white-05)" : "transparent",
        transition: "background-color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      <Icon name="IconChat" size={15} style={{ flexShrink: 0, color: "var(--cloud-light)" }} />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-serif)", fontSize: "var(--text-base-sm)", color: "var(--text-secondary)", lineHeight: 1 }}>
        {title}
      </span>
      <span style={{ flexShrink: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--text-tertiary)", lineHeight: 1 }}>
        {time}
      </span>
    </div>
  );
}
export default RecentChat;

```

### `components/display/RecentChat.d.ts`

```ts
import * as React from "react";
/** Compact recent-chat list row (icon + serif title + relative time). Lighter than ChatCard. */
export interface RecentChatProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "title"> {
  title?: React.ReactNode;
  time?: React.ReactNode;
  selected?: boolean;
  style?: React.CSSProperties;
}
export declare function RecentChat(props: RecentChatProps): JSX.Element;
export default RecentChat;

```

### `components/display/ProjectLabel.jsx`

```jsx
import React from "react";
import { Icon } from "../../assets/icons/Icon.jsx";

/**
 * ProjectLabel — small pill marking which project a chat belongs to.
 */
export function ProjectLabel({ children = "How to use Claude", style = {}, ...rest }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "3px 6px",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--slate-medium)",
        maxWidth: "100%",
        boxSizing: "border-box",
        ...style,
      }}
      {...rest}
    >
      <Icon name="IconProject" size={12} style={{ flexShrink: 0, color: "var(--white-60)" }} />
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: "var(--weight-regular)",
          fontSize: "var(--text-xs)",
          color: "var(--text-primary)",
          opacity: 0.8,
          lineHeight: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
    </span>
  );
}
export default ProjectLabel;

```

### `components/display/ProjectLabel.d.ts`

```ts
import * as React from "react";
/** Small pill marking a chat's parent project (project glyph + serif name). */
export interface ProjectLabelProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "style"> {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function ProjectLabel(props: ProjectLabelProps): JSX.Element;
export default ProjectLabel;

```

### `components/display/ProjectCard.jsx`

```jsx
import React from "react";
import { Icon } from "../../assets/icons/Icon.jsx";

/**
 * ProjectCard — a project tile: icon, name, and optional description.
 */
export function ProjectCard({ name = "AI Career Prep", description, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        boxSizing: "border-box",
        padding: "16px",
        borderRadius: 14,
        boxShadow: "inset 0 0 0 1px var(--white-05)",
        backgroundColor: hover ? "var(--white-05)" : "transparent",
        cursor: "pointer",
        transition: "background-color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      <Icon name="IconProject" size={20} style={{ color: "var(--cloud-light)" }} />
      <span style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-xl)", color: "var(--text-primary)", lineHeight: 1.1, textWrap: "pretty" }}>
        {name}
      </span>
      {description && (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", color: "var(--text-secondary)", lineHeight: 1.4, textWrap: "pretty" }}>
          {description}
        </span>
      )}
    </div>
  );
}
export default ProjectCard;

```

### `components/display/ProjectCard.d.ts`

```ts
import * as React from "react";
/** Project tile: project glyph, serif name, optional description. */
export interface ProjectCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style"> {
  name?: React.ReactNode;
  description?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function ProjectCard(props: ProjectCardProps): JSX.Element;
export default ProjectCard;

```

### `components/display/ProjectInstructions.jsx`

```jsx
import React from "react";

/**
 * ProjectInstructions — dashed row showing the saved instructions snippet + Edit link.
 * Empty state shows placeholder + "Add" affordance.
 */
export function ProjectInstructions({ content, onEdit, style = {}, ...rest }) {
  const hasContent = content != null && content !== "";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-6)",
        boxSizing: "border-box",
        padding: "10px 12px 10px 8px",
        borderRadius: "var(--radius-xl)",
        outline: "1px dashed rgba(206,204,197,0.15)",
        outlineOffset: "-1px",
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-base)",
          color: hasContent ? "var(--text-secondary)" : "var(--text-tertiary)",
          lineHeight: 1,
        }}
      >
        {hasContent ? content : "Set instructions for how Claude should respond"}
      </span>
      <button
        type="button"
        onClick={onEdit}
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-base)",
          color: "var(--ui-blue)",
          lineHeight: 1,
        }}
      >
        {hasContent ? "Edit" : "Add"}
      </button>
    </div>
  );
}
export default ProjectInstructions;

```

### `components/display/ProjectInstructions.d.ts`

```ts
import * as React from "react";
/** Dashed instructions row: snippet + Edit (or placeholder + Add when empty). */
export interface ProjectInstructionsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "content"> {
  content?: string;
  onEdit?: () => void;
  style?: React.CSSProperties;
}
export declare function ProjectInstructions(props: ProjectInstructionsProps): JSX.Element;
export default ProjectInstructions;

```

### `components/display/StyleRow.jsx`

```jsx
import React from "react";

/**
 * StyleRow — draggable writing-style row with a preset tag + go arrow.
 * variant "active" tints blue; otherwise neutral hairline.
 */
export function StyleRow({ name = "Style name", preset = "Preset", active = false, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const on = active || hover;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxSizing: "border-box",
        padding: "14px 8px",
        borderRadius: "var(--radius-2xl)",
        cursor: "pointer",
        background: on
          ? "linear-gradient(180deg, rgba(32,127,222,0) 0%, rgba(32,127,222,0.08) 100%)"
          : "linear-gradient(180deg, rgba(38,38,37,0) 50%, var(--slate-medium) 100%)",
        boxShadow: on ? "inset 0 0 0 1px rgba(32,127,222,0.2)" : "inset 0 0 0 1px var(--slate-light)",
        transition: "background 120ms ease, box-shadow 120ms ease",
        ...style,
      }}
      {...rest}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: "var(--cloud-medium)" }}>
          <circle cx="7" cy="5" r="1.3" fill="currentColor" /><circle cx="7" cy="10" r="1.3" fill="currentColor" /><circle cx="7" cy="15" r="1.3" fill="currentColor" />
          <circle cx="13" cy="5" r="1.3" fill="currentColor" /><circle cx="13" cy="10" r="1.3" fill="currentColor" /><circle cx="13" cy="15" r="1.3" fill="currentColor" />
        </svg>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-lg)", letterSpacing: "var(--tracking-tight)", color: "var(--ivory-medium)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", flexShrink: 0 }}>
        {preset && (
          <span style={{ padding: "6px 8px", borderRadius: "var(--radius-2xl)", backgroundColor: "var(--white-05)", color: "var(--text-secondary)", fontFamily: "var(--font-sans)", fontWeight: "var(--weight-medium)", fontSize: "var(--text-2xs)", lineHeight: 1 }}>
            {preset}
          </span>
        )}
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: on ? "var(--ivory-light)" : "var(--cloud-medium)" }}>
          <path d="M5 10h10M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}
export default StyleRow;

```

### `components/display/StyleRow.d.ts`

```ts
import * as React from "react";
/** Draggable writing-style row with a preset tag + go arrow. `active` tints blue. */
export interface StyleRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style"> {
  name?: React.ReactNode;
  preset?: React.ReactNode;
  active?: boolean;
  style?: React.CSSProperties;
}
export declare function StyleRow(props: StyleRowProps): JSX.Element;
export default StyleRow;

```

### `components/display/Popover.jsx`

```jsx
import React from "react";

/**
 * Popover — floating panel surface (menus, style pickers).
 */
export function Popover({ title, children, style = {}, ...rest }) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        borderRadius: "var(--radius-2xl)",
        backgroundColor: "#2B2A27",
        boxShadow: "inset 0 0 0 1px var(--slate-light), 0 4px 4px 0 rgba(0,0,0,0.25)",
        ...style,
      }}
      {...rest}
    >
      {title && (
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: "var(--weight-medium)", fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1 }}>
          {title}
        </span>
      )}
      {children}
    </div>
  );
}
export default Popover;

```

### `components/display/Popover.d.ts`

```ts
import * as React from "react";
/** Floating panel surface for menus / pickers. Optional `title` header. */
export interface PopoverProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "title"> {
  title?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Popover(props: PopoverProps): JSX.Element;
export default Popover;

```

### `components/display/CharacterPopover.jsx`

```jsx
import React from "react";
import { Popover } from "./Popover.jsx";
import { Character } from "./Character.jsx";
import { AddButton } from "../core/AddButton.jsx";

/**
 * CharacterPopover — a popover that lists saved characters with a "new character" action.
 * `mode="new"` highlights the create row.
 */
export function CharacterPopover({ characters, mode = "default", onSelect, onNew, style = {}, ...rest }) {
  const list = characters || [
    { name: "The Editor", glyph: "IconCharacter" },
    { name: "Research Analyst", glyph: "IconDna" },
    { name: "Trip Planner", glyph: "IconSplat" },
  ];
  return (
    <Popover title="Talk to a character" style={{ width: 280, ...style }} {...rest}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {list.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect && onSelect(c)}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)",
              padding: "6px 8px", borderRadius: "var(--radius-md)", border: "none",
              background: "transparent", cursor: "pointer", textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--white-05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Character glyph={c.glyph} size={28} />
            <span style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-base)", color: "var(--text-primary)", lineHeight: 1 }}>{c.name}</span>
          </button>
        ))}
      </div>
      <div style={{ paddingTop: 4, borderTop: "1px solid var(--white-05)" }}>
        <AddButton onClick={onNew} style={{ color: mode === "new" ? "var(--ui-blue)" : "var(--ui-blue)" }}>New character</AddButton>
      </div>
    </Popover>
  );
}
export default CharacterPopover;

```

### `components/display/CharacterPopover.d.ts`

```ts
import * as React from "react";
/** Popover listing saved characters with a "new character" action. `mode="new"` for the create state. */
export interface CharacterPopoverProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style"> {
  characters?: Array<{ name: string; glyph?: string }>;
  mode?: "default" | "new";
  onSelect?: (c: { name: string; glyph?: string }) => void;
  onNew?: () => void;
  style?: React.CSSProperties;
}
export declare function CharacterPopover(props: CharacterPopoverProps): JSX.Element;
export default CharacterPopover;

```

### `components/display/KnowledgeUpload.jsx`

```jsx
import React from "react";
import { FileCard } from "./FileCard.jsx";

/**
 * KnowledgeUpload — an uploaded knowledge file row (thumbnail + name + remove).
 */
export function KnowledgeUpload({ name = "Newsletter writing sample", ext = "MD", onRemove, style = {}, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-5)",
        boxSizing: "border-box",
        padding: "8px 10px",
        borderRadius: "var(--radius-xl)",
        backgroundColor: hover ? "var(--white-05)" : "transparent",
        boxShadow: "inset 0 0 0 1px var(--white-05)",
        transition: "background-color 120ms ease",
        ...style,
      }}
      {...rest}
    >
      <FileCard ext={ext} size={32} />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", color: "var(--text-primary)", lineHeight: 1.2 }}>
        {name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          background: "none",
          cursor: "pointer",
          color: "var(--text-tertiary)",
          opacity: hover ? 1 : 0,
          transition: "opacity 120ms ease",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
export default KnowledgeUpload;

```

### `components/display/KnowledgeUpload.d.ts`

```ts
import * as React from "react";
/** Uploaded knowledge-file row: thumbnail + name + hover remove. */
export interface KnowledgeUploadProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style"> {
  name?: string;
  ext?: string;
  onRemove?: () => void;
  style?: React.CSSProperties;
}
export declare function KnowledgeUpload(props: KnowledgeUploadProps): JSX.Element;
export default KnowledgeUpload;

```

### `components/display/FileCard.jsx`

```jsx
import React from "react";

/**
 * FileCard — a small document thumbnail with a folded corner + extension label.
 */
export function FileCard({ ext = "MD", size = 40, style = {}, ...rest }) {
  const fold = size * 0.375;
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "var(--radius-sm)",
        backgroundColor: "var(--neutral-white)",
        boxShadow: "inset 0 0 0 0.5px rgba(206,204,197,0.6), 0 0 0 0.5px rgba(206,204,197,0.6), -2px 4px 4px 0 rgba(0,0,0,0.08)",
        ...style,
      }}
      {...rest}
    >
      {/* folded corner */}
      <svg
        width={fold}
        height={fold}
        viewBox="0 0 15 15"
        style={{ position: "absolute", right: 0, top: 0, display: "block" }}
      >
        <path d="M0 0 L15 15 L15 0 Z" fill="var(--slate-medium)" />
      </svg>
      <span
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: size * 0.28,
          textAlign: "center",
          fontFamily: "var(--font-sans)",
          fontWeight: "var(--weight-bold)",
          fontSize: size * 0.2,
          letterSpacing: "0.3px",
          color: "#4C4C4C",
          lineHeight: 1,
        }}
      >
        {ext}
      </span>
    </div>
  );
}
export default FileCard;

```

### `components/display/FileCard.d.ts`

```ts
import * as React from "react";
/** Document thumbnail with a folded corner + extension label. */
export interface FileCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style"> {
  ext?: string;
  size?: number;
  style?: React.CSSProperties;
}
export declare function FileCard(props: FileCardProps): JSX.Element;
export default FileCard;

```

### `components/display/Character.jsx`

```jsx
import React from "react";
import { Icon } from "../../assets/icons/Icon.jsx";

/**
 * Character — a character avatar (icon on a tinted squircle) with optional name.
 */
export function Character({ name, glyph = "IconCharacter", size = 40, style = {}, ...rest }) {
  const avatar = (
    <span
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-2xl)",
        background: "linear-gradient(180deg, rgba(155,135,245,0.18) 0%, rgba(90,79,143,0.12) 100%)",
        boxShadow: "inset 0 0 0 1px rgba(155,135,245,0.25)",
        color: "var(--ui-purple)",
      }}
    >
      <Icon name={glyph} size={Math.round(size * 0.5)} />
    </span>
  );
  if (name == null) return <span style={{ display: "inline-flex", ...style }} {...rest}>{avatar}</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-3)", ...style }} {...rest}>
      {avatar}
      <span style={{ fontFamily: "var(--font-serif)", fontSize: "var(--text-lg)", color: "var(--text-primary)", lineHeight: 1.1 }}>
        {name}
      </span>
    </span>
  );
}
export default Character;

```

### `components/display/Character.d.ts`

```ts
import * as React from "react";
/** Character avatar (icon on a tinted squircle) with optional serif name beside it. */
export interface CharacterProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "style"> {
  name?: React.ReactNode;
  /** Icon name from the icon set (default IconCharacter). */
  glyph?: string;
  size?: number;
  style?: React.CSSProperties;
}
export declare function Character(props: CharacterProps): JSX.Element;
export default Character;

```

### `components/display/NewCharacterForm.jsx`

```jsx
import React from "react";
import { Input } from "../forms/Input.jsx";
import { Textarea } from "../forms/Textarea.jsx";
import { Select } from "../forms/Select.jsx";
import { Button } from "../core/Button.jsx";
import { Character } from "./Character.jsx";

/**
 * NewCharacterForm — the "Create a character for Claude" form.
 * Pass `filled` to show the populated state.
 */
export function NewCharacterForm({ filled = false, style = {}, ...rest }) {
  const v = (s) => (filled ? s : "");
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-7)", width: "100%", maxWidth: 480, ...style }}
      {...rest}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
        <Character glyph="IconCharacter" size={48} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--text-primary)", lineHeight: 1.05 }}>
          Create a character for Claude
        </span>
      </div>
      <Input label="What do you want to call this character?" value={v("The Editor")} onChange={() => {}} placeholder="Name your character" />
      <Textarea label="What role should Claude play?" value={v("You are a sharp, encouraging line editor for long-form drafts.")} onChange={() => {}} placeholder="Describe Claude's role and how to act" rows={3} />
      <Select label="How should Claude write responses?" value={v("Reflective storyteller")} placeholder="Select a style" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
        <Button variant="secondary">Cancel</Button>
        <Button variant="primary">Create character</Button>
      </div>
    </div>
  );
}
export default NewCharacterForm;

```

### `components/display/NewCharacterForm.d.ts`

```ts
import * as React from "react";
/** "Create a character for Claude" form (name, role, style, actions). `filled` shows populated state. */
export interface NewCharacterFormProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "style"> {
  filled?: boolean;
  style?: React.CSSProperties;
}
export declare function NewCharacterForm(props: NewCharacterFormProps): JSX.Element;
export default NewCharacterForm;

```
