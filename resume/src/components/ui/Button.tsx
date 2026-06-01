import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "dangerOutline"
  | "ghost"
  | "warning"
  | "success"
  | "link";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

/**
 * Keyboard focus ring for elements that can't be a <Button> — toggle chips, segmented
 * controls, tabs — so they get the same visible focus the rest of the app now has.
 * Spread into the element's className (defaults to a blue ring on the gray-950 page bg).
 */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950";

// Shared by every variant. Includes the focus-visible ring the whole app was missing,
// plus a unified disabled treatment so callers stop re-declaring opacity/cursor each time.
const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white focus-visible:ring-blue-500",
  secondary:
    "border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white focus-visible:ring-gray-500",
  danger: "bg-red-600 hover:bg-red-500 text-white focus-visible:ring-red-500",
  dangerOutline:
    "border border-red-500/40 text-red-400 hover:bg-red-500/10 focus-visible:ring-red-500",
  ghost: "text-gray-300 hover:bg-gray-800 hover:text-white focus-visible:ring-gray-500",
  warning: "bg-amber-500 hover:bg-amber-400 text-gray-900 focus-visible:ring-amber-400",
  success: "bg-green-600 hover:bg-green-500 text-white focus-visible:ring-green-500",
  // Inline text action — no padding/background. Carries its own rounded for the focus ring.
  link: "text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline focus-visible:ring-blue-500 rounded",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5 rounded-lg",
  md: "text-sm px-4 py-2.5 rounded-xl",
  lg: "text-base px-5 py-3 rounded-xl",
  icon: "h-9 w-9 rounded-lg", // square; pass an icon as children
};

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to fill the parent (replaces ad-hoc `w-full`). */
  fullWidth?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

/**
 * The single source of truth for button styling across the app.
 * Use `buttonClasses()` directly when you need the look on an <a>/<Link> instead of a <button>.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, loading, disabled, className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      // Default to type="button": a bare <button> in a form submits by default, a common footgun.
      type={type ?? "button"}
      disabled={disabled || loading}
      className={cn(buttonClasses({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

export function buttonClasses(opts: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
} = {}): string {
  const { variant = "primary", size = "md", fullWidth } = opts;
  // `link` is padding-free: honor `size` for font-size only (keeps small inline links text-xs).
  const linkText = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
  const sizeClasses = variant === "link" ? linkText : SIZES[size];
  return cn(BASE, VARIANTS[variant], sizeClasses, fullWidth && "w-full");
}

export default Button;
