export interface TemplateRejectionGuide {
  title: string;
  summary: string;
  fixes: string[];
}

function matchAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Maps common Meta template rejection reasons to actionable fixes for merchants.
 */
export function getTemplateRejectionGuide(reason?: string | null): TemplateRejectionGuide | null {
  if (!reason) return null;
  const trimmed = reason.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (['none', 'n/a', 'na', '-', 'null'].includes(lower)) return null;

  if (matchAny(lower, [/categor/, /miscategor/, /wrong category/, /reclassif/])) {
    return {
      title: 'Category mismatch',
      summary: 'WhatsApp thinks this template belongs in a different category than you selected.',
      fixes: [
        'Utility = order updates, account alerts, and post-purchase info — not promotions.',
        'Marketing = offers, announcements, and re-engagement messages.',
        'Remove sales language from utility templates, or switch category to Marketing.',
        'We submit with allow_category_change so Meta can recategorize instead of rejecting outright.',
      ],
    };
  }

  if (matchAny(lower, [/variable/, /placeholder/, /\{\{/, /parameter/, /sample/])) {
    return {
      title: 'Variable or sample issue',
      summary: 'Placeholders or their sample values do not meet WhatsApp rules.',
      fixes: [
        'Use sequential placeholders only: {{1}}, {{2}}, {{3}} — no gaps or named variables.',
        'Do not start or end the body/header with a placeholder.',
        'Add realistic sample values for every placeholder before submitting.',
        'Keep samples short and representative of real customer data.',
      ],
    };
  }

  if (matchAny(lower, [/button/, /call.to.action/, /quick reply/, /url/])) {
    return {
      title: 'Button configuration',
      summary: 'Button type, order, or URL does not comply with WhatsApp limits.',
      fixes: [
        'Max 2 website (URL) buttons, 1 phone button, and 1 copy-code button per template.',
        'Group all action buttons together, then all quick-reply buttons (no interleaving).',
        'Button labels must be unique and 25 characters or fewer.',
        'Do not use wa.me or whatsapp.com links in URL buttons.',
      ],
    };
  }

  if (matchAny(lower, [/spam/, /promotional/, /marketing/, /opt.?out/, /unsubscribe/, /stop/])) {
    return {
      title: 'Marketing compliance',
      summary: 'Marketing templates need clear opt-out and must avoid spam-like content.',
      fixes: [
        'Add a footer with opt-out instructions (e.g. "Reply STOP to unsubscribe").',
        'Avoid exaggerated claims, urgency tricks, or misleading offers.',
        'Make sure the message matches a clear user request or legitimate relationship.',
      ],
    };
  }

  if (matchAny(lower, [/abusive/, /threat/, /hate/, /violence/, /adult/, /sexual/])) {
    return {
      title: 'Prohibited content',
      summary: 'The message may include content that violates WhatsApp commerce policies.',
      fixes: [
        'Remove offensive, threatening, or adult content.',
        'Review Meta’s Commerce Policy for restricted industries.',
        'Rewrite in neutral, professional language.',
      ],
    };
  }

  if (matchAny(lower, [/duplicate/, /already exists/, /same name/])) {
    return {
      title: 'Duplicate template',
      summary: 'A template with this name or very similar content already exists.',
      fixes: [
        'Use a new unique template name (lowercase, numbers, underscores only).',
        'Delete the old rejected template first, or duplicate with a new name.',
      ],
    };
  }

  if (matchAny(lower, [/language/, /translation/, /locale/])) {
    return {
      title: 'Language mismatch',
      summary: 'The template language does not match the message content.',
      fixes: [
        'Select the language that matches the body text.',
        'Create separate templates per language instead of mixing languages in one.',
      ],
    };
  }

  if (matchAny(lower, [/header/, /media/, /image/, /video/, /document/])) {
    return {
      title: 'Header or media issue',
      summary: 'The header text or sample media file was rejected.',
      fixes: [
        'Text headers: max 60 characters, no placeholders at the start or end.',
        'Media headers: upload a clear sample file that matches what you will send.',
        'Avoid blurry, watermarked, or policy-violating images.',
      ],
    };
  }

  if (matchAny(lower, [/format/, /length/, /character/, /too long/])) {
    return {
      title: 'Formatting or length',
      summary: 'Part of the template exceeds WhatsApp length or formatting limits.',
      fixes: [
        'Body: max 1,024 characters. Header/footer: max 60 characters each.',
        'Template name: lowercase letters, numbers, underscores only.',
        'Shorten text and remove unnecessary punctuation or symbols.',
      ],
    };
  }

  return {
    title: 'Review required',
    summary: trimmed,
    fixes: [
      'Read the reason above and adjust the template content accordingly.',
      'Edit & resubmit — only change what Meta flagged.',
      'If unclear, send a test to your own number after approval or contact Meta support via Business Manager.',
    ],
  };
}

/** Meta does not publish a hard deadline. Typical Cloud API review window. */
export const TEMPLATE_REVIEW_ETA = {
  short: 'Usually within 24h',
  typical: 'Usually a few minutes to 24 hours',
  detail:
    'WhatsApp reviews this template. Most decisions come in a few minutes to 24 hours; busy periods can take up to 48 hours. We check every 30 seconds and notify you when the status changes.',
};

export function getTemplateStatusHelp(status: string): { title: string; message: string } | null {
  const upper = status.toUpperCase();
  if (upper === 'PENDING') {
    return {
      title: 'Waiting for WhatsApp review',
      message: TEMPLATE_REVIEW_ETA.detail,
    };
  }
  if (upper === 'PAUSED') {
    return {
      title: 'Template paused',
      message:
        'WhatsApp paused this template due to quality or policy signals. Edit the content and resubmit, or pause campaigns using it.',
    };
  }
  if (upper === 'DISABLED') {
    return {
      title: 'Template disabled',
      message:
        'This template was disabled by WhatsApp and cannot be sent. Create a new version with compliant content and resubmit.',
    };
  }
  if (upper === 'FLAGGED') {
    return {
      title: 'Template flagged',
      message: 'Quality rating dropped. Reduce send volume and review message relevance before it is paused.',
    };
  }
  return null;
}
