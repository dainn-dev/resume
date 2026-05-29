"use client";

import { forwardRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

/**
 * Whether the reCAPTCHA widget is active. When the public site key is not configured
 * (e.g. local dev), the widget renders nothing and forms must NOT block submission.
 */
export const RECAPTCHA_ENABLED = SITE_KEY.length > 0;

interface RecaptchaProps {
  /** Receives the verification token, or null when the user clears / the token expires. */
  onChange: (token: string | null) => void;
  className?: string;
}

/**
 * Google reCAPTCHA v2 checkbox, themed for the app's dark UI.
 * Forward a ref to call `.reset()` after a submission (v2 tokens are single-use).
 */
const Recaptcha = forwardRef<ReCAPTCHA, RecaptchaProps>(function Recaptcha({ onChange, className }, ref) {
  if (!SITE_KEY) return null;
  return (
    <div className={className}>
      <ReCAPTCHA
        ref={ref}
        sitekey={SITE_KEY}
        theme="dark"
        onChange={onChange}
        onExpired={() => onChange(null)}
        onErrored={() => onChange(null)}
      />
    </div>
  );
});

export default Recaptcha;
