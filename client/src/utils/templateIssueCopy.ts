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
    match: /https:\/\/, not http|isn.?t secure enough/i,
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
        'This is not {{1}}. Name and order number fill later when you send. Meta needs your live shop or tracking page on this button now.',
      example: 'https://yourstore.com/track',
    },
  },
  {
    match: /replace the sample address with your real website/i,
    issue: {
      title: 'Use your real website',
      detail: 'Swap the sample address for the page customers should actually visit.',
      example: 'https://yourstore.com/verify',
    },
  },
  {
    match: /github|telegram|code-repo/i,
    issue: {
      title: 'Use a shop or tracking page, not GitHub',
      detail:
        'WhatsApp opens this button on the customer’s phone. GitHub, Telegram, and sample links are rejected. Paste a page on your live site.',
      example: 'https://yourstore.com/track',
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
    match: /template with this name already exists|already exists\. Choose a different name|duplicate.*template|same name/i,
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
    match: /phone number with country code/i,
    issue: {
      title: 'Add the phone number for the call button',
      detail: 'Include the country code so WhatsApp can place the call.',
      example: '+919876543210',
    },
  },
  {
    match:
      /placeholders cannot be placed|personal fields? (must be numbered|in order)|don.?t (start|end) the message with a personal field/i,
    issue: {
      title: 'A personal field needs a small fix',
      detail:
        'Personal fields look like {{1}} and {{2}}. Keep them in order, and add a few words of normal text around them.',
    },
  },
  {
    match:
      /leading or trailing params|variables can.?t be at the start or end|cannot (start|end) with a placeholder|full stop after \{\{3\}\}/i,
    issue: {
      title: 'Don’t start or end the message with {{1}}',
      detail:
        'WhatsApp needs normal words before the first field and after the last one. A full stop after Tracking ID {{3}} is not enough. Add a short sentence after the last field.',
      example: 'Tracking ID: {{3}}. Keep this message handy.',
    },
  },
  {
    match: /website link suffix|trackable button|unique ending for the button link/i,
    issue: {
      title: 'Add the button link',
      detail: 'Type only the unique ending, like order-123 — not a full website address.',
      example: 'order-123',
    },
  },
  {
    match: /fill in every (template|message) variable/i,
    issue: {
      title: 'Fill in every message variable',
      detail: 'Each numbered field needs a value — a contact’s details, or the same text for everyone.',
    },
  },
  {
    match: /add sample values for all .+ header variable|add an example for each personal field/i,
    issue: {
      title: 'Add an example for each personal field',
      detail: 'WhatsApp reviews a filled-in example, like a real name or order number, before they approve the message.',
    },
  },
  {
    match: /unresolved placeholders|recipient data before sending/i,
    issue: {
      title: 'Some message fields are still empty',
      detail: 'Fill in every numbered field before sending this campaign.',
    },
  },
  {
    match: /missing sample value for audience preview/i,
    issue: {
      title: 'We need an example value',
      detail: 'Add a sample for this field so we can preview the audience.',
    },
  },
  {
    match: /landing page must be a real website/i,
    issue: {
      title: 'Use your live website',
      detail: 'Customers open this on their phone. Paste a page on your real site, not a test page.',
      example: 'https://yourstore.com/verify',
    },
  },
  {
    match: /header (media|file) (must be a public|needs a public)|header media must be a public https/i,
    issue: {
      title: 'The header file needs a public link',
      detail: 'Use a web address that anyone can open, starting with https://',
    },
  },
  {
    match: /add the (copy-code \/ coupon|coupon code)|copy-code button requires a couponcode|sample code is required for copy-code/i,
    issue: {
      title: 'Add the coupon code',
      detail: 'This template includes a copy-code button. Enter the code customers should copy.',
      example: 'SAVE20',
    },
  },
  {
    match: /webhook url is not http compatible/i,
    issue: {
      title: 'This web address isn’t ready',
      detail: 'Use a normal website link that starts with https://',
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
  const metaRejected = trimmed.match(/^Meta rejected this template:\s*(.*)$/i);
  if (metaRejected) {
    const detail = metaRejected[1].trim();
    if (!detail || /^invalid parameter$/i.test(detail) || TECHNICAL_NOISE.test(detail)) {
      return {
        title: 'WhatsApp rejected this template',
        detail:
          'Usually the button is not a customer website (GitHub, Telegram, sample URLs), or this name already exists on the number. Use a shop or tracking page and a unique name.',
        example: 'https://yourstore.com/track',
      };
    }
    return { title: 'WhatsApp rejected this template', detail };
  }
  if (!trimmed || TECHNICAL_NOISE.test(trimmed)) {
    return {
      title: 'WhatsApp couldn’t save this yet',
      detail: 'Check the website link and message text, then try again. If it still fails, wait a minute and retry.',
    };
  }
  return {
    title: trimmed,
    detail: '',
  };
}
