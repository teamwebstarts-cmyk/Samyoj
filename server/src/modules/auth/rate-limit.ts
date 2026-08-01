import rateLimit from 'express-rate-limit';

/** Login / password reset attempts */
export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
});

/** Registration */
export const authRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many accounts created from this IP. Try again later.' },
});

/** Forgot-password */
export const authForgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many reset requests. Try again later.' },
});

/** OAuth URL kickoff */
export const authOAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OAuth attempts. Try again later.' },
});
