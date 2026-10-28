/**
 * InsecureShield — Runtime Environment Variables
 *
 * NOTE: no secret literals live in this source file. Each value below is
 * replaced at BUILD time by the bundler's define step (path P4), pulling the
 * real value from .env (VITE_* vars). The COMPILED bundle shipped to the
 * browser therefore contains the inlined secrets — which is the whole point:
 * a shift-left scan of this source sees nothing.
 */

window.ENV = {
    NODE_ENV:               "production",

    // Payment processing — Stripe
    STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
    STRIPE_SECRET_KEY:      import.meta.env.VITE_STRIPE_SECRET_KEY,

    // Email delivery — SendGrid
    SENDGRID_API_KEY:       import.meta.env.VITE_SENDGRID_API_KEY,
    SENDGRID_FROM:          import.meta.env.VITE_SENDGRID_FROM,

    // Document storage — AWS S3 (via SDK)
    AWS_REGION:             import.meta.env.VITE_AWS_REGION,
    AWS_ACCESS_KEY_ID:      import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY:  import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    S3_BUCKET:              import.meta.env.VITE_S3_BUCKET,

    // Twilio SMS alerts
    TWILIO_ACCOUNT_SID:     import.meta.env.VITE_TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN:      import.meta.env.VITE_TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER:     import.meta.env.VITE_TWILIO_FROM_NUMBER,

    // Internal API keys
    INTERNAL_API_KEY:       import.meta.env.VITE_INTERNAL_API_KEY,
    WEBHOOK_SECRET:         import.meta.env.VITE_WEBHOOK_SECRET
};
