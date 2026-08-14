export interface FriendlyIssue {
  title: string;
  detail: string;
  example?: string;
}

const KNOWN_ISSUES: Array<{ match: RegExp; issue: FriendlyIssue }> = [
  {
    match: /localhost|samyoj (screen|page)|your computer|live website, not this/i,
    issue: {
      title: 'This link only works on your computer',
      detail:
        'WhatsApp opens the button on the customer’s phone. Paste a page on your live website — like account setup or order tracking — not this Samyoj screen.',
      example: 'https://yourstore.com/verify',
    },
  },
  {
    match: /https:\/\/, not http|isn’t secure|not http/i,
    issue: {
      title: 'This website link isn’t ready yet',
      detail:
        'The address should start with https:// so WhatsApp can open it safely. If it starts with http://, change that to https://',
      example: 'https://yourstore.com/verify',
    },
  },
  {
    match: /doesn’t look like a website|full website|full web address/i,
    issue: {
      title: 'That doesn’t look like a website',
      detail: 'Paste the full address of the page customers should visit after they tap the button.',
      example: 'https://yourstore.com/verify',
    },
  },
  {
    match: /add your website link|add the website for this button|customers open when they tap/i,
    issue: {
      title: 'Add the website for this button',
      detail:
        'When someone taps the button in the chat, they should land on your site. Paste that page’s address here.',
      example: 'https://yourstore.com/verify',
    },
  },
  {
    match: /replace the (example|sample)|real website/i,
    issue: {
      title: 'Use your real website',
      detail: 'Swap the sample address for the page customers should actually visit.',
      example: 'https://yourstore.com/verify',
    },
  },
  {
    match: /lowercase letters, numbers, and underscores|simple name like/i,
    issue: {
      title: 'Use a simpler template name',
      detail: 'WhatsApp names look like order_update — only small letters, numbers, and the _ character.',
      example: 'account_created',
    },
  },
  {
    match: /already exists|duplicate|same name/i,
    issue: {
      title: 'That name is already in use',
      detail: 'Pick a slightly different name, or delete the old template first.',
    },
  },
  {
    match: /pick a template from the list/i,
    issue: {
      title: 'Choose a template first',
      detail: 'Select one from the list, then continue.',
    },
  },
  {
    match: /phone number with country code|valid phone/i,
    issue: {
      title: 'Add the phone number for the call button',
      detail: 'Include the country code so WhatsApp can place the call.',
      example: '+919876543210',
    },
  },
  {
    match: /placeholder/i,
    issue: {
      title: 'A personal field needs a small fix',
      detail:
        'Personal fields look like {{1}} and {{2}}. Keep them in order, and add a few words of normal text around them.',
    },
  },
  {
    match: /sample value/i,
    issue: {
      title: 'Add an example for each personal field',
      detail: 'WhatsApp reviews a filled-in example, like a real name or order number, before they approve the message.',
    },
  },
];

const TECHNICAL_NOISE = /#\d{3,}|error code|oauth|graph\.facebook|invalid parameter|status code|e\d{4}/i;

/** Turn a raw wizard / API message into something a shop owner can act on. */
export function explainTemplateIssue(message: string): FriendlyIssue {
  const trimmed = message.trim();
  for (const row of KNOWN_ISSUES) {
    if (row.match.test(trimmed)) return row.issue;
  }
  if (!trimmed || TECHNICAL_NOISE.test(trimmed)) {
    return {
      title: 'WhatsApp couldn’t save this yet',
      detail: 'Check the website link and message text, then try again. If it still fails, wait a minute and retry.',
    };
  }
  return {
    title: 'A quick fix is needed',
    detail: trimmed,
  };
}
