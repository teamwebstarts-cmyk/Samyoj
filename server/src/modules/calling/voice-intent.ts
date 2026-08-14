/** Phrase-only intent for live calls. Single words like "person" or "schedule" must not steal the turn. */

import { normalizeVoiceText } from './spoken-text';

export function wantsHumanOnCall(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /\b((talk|speak|connect)(\s+me)?\s+(to|with)\s+(a |an |the )?(human|agent|person|someone|manager|representative|team|support))\b/i.test(
      t
    ) ||
    /\b(real (human|person|agent|support)|human please|agent please|customer care|customer service|customer support|support team|live agent)\b/i.test(
      t
    ) ||
    /(किसी से बात|इंसान से बात|एजेंट से बात|मानव से बात|सपोर्ट टीम|सपोर्ट से बात|टीम से बात|बात करवा)/.test(t) ||
    /(support.{0,24}बात|बात.{0,24}support)/i.test(t)
  );
}

export function wantsCallbackOnCall(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /\b(call( me)? back|give me a (call|callback)|callback|call later|phone me later)\b/i.test(t) ||
    /(वापस\s*कॉल|कॉल\s*बैक|बाद में कॉल)/.test(t)
  );
}

/** Caller wants the AI to hang up — not a callback, not "call me". */
export function wantsEndCall(text: string): boolean {
  const t = text.trim();
  if (!t || wantsCallbackOnCall(t)) return false;
  if (
    /^(bye|goodbye|bye bye|that's all|thats all|nothing else|i'm done|im done)[.!?।]*$/i.test(t)
  ) {
    return true;
  }
  return (
    /\b(hang\s*up|end (the )?call|cut (the )?call|disconnect (the )?call|you can (hang up|cut|disconnect))\b/i.test(
      t
    ) ||
    /(कॉल\s*काट|कॉल\s*रख|call\s*रख|रख\s*दे|काट\s*दो|बस हो गया|इतना ही काफी|कॉल खत्म)/i.test(t)
  );
}

/** Filler while the other person is talking — do not treat as a new question. */
export function isVoiceBackchannel(text: string): boolean {
  const t = normalizeVoiceText(text);
  if (!t) return true;
  return /^(ok|okay|hmm+|h+m+|mm+|uh+|ah+|oh+|um+|huh|जी+|हाँ+|हां+|हम्म+|अच्छा+|yes|yeah|ya|ha+)$/i.test(
    t
  );
}
