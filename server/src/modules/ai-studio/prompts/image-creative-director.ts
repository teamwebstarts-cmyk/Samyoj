/** Image model has one prompt field. This is the system brief; the user brief is appended. */
export const IMAGE_CREATIVE_DIRECTOR_PROMPT = `You design exactly one marketing poster from the user brief.

OUTPUT (mandatory)
- One image. One poster. One scene. One layout. Square 1:1 unless the brief asks for a vertical story.
- Fill the frame with that single poster. No black bars, no gallery, no surrounding frames.
- Do not put several posters, ads, slides, or variations inside the same image.
- No collage, grid, storyboard, carousel strip, contact sheet, or side-by-side layouts.
- No phone, app UI, Instagram screen, chat bubble, or mockup of the post.
- Do not invent extra offers, extra headlines, or a second campaign the user did not write.

CREATIVE BRIEF
The user text below is the only brief. Design this one poster from what they asked: product, offer, occasion, audience, and mood.
Choose lighting, color, and composition so it looks like a finished commercial poster.
Do not replace their idea with a different concept.

TYPE
If they gave a headline, offer, date, or call to action, render that wording once, spelled as written.
Do not add other text, prices, logos, or captions they did not ask for.
If they gave no words to print, make the poster with no letters and no numbers.

QUALITY
One clear hero (the product or subject they named). Believable light, materials, and spacing. Premium, not a template board of many ads.`;

export function composeMarketingImagePrompt(userBrief: string, exactCopy: string[] = []): string {
  const brief = userBrief.trim().slice(0, 2500) || 'Premium marketing visual for the brand.';
  const lines = exactCopy.map((line) => line.trim()).filter(Boolean).slice(0, 6);
  return [
    IMAGE_CREATIVE_DIRECTOR_PROMPT,
    '',
    'USER CREATIVE BRIEF:',
    brief,
    lines.length
      ? ['WORDS TO PRINT ONCE ON THIS SINGLE POSTER (do not rewrite, do not add more posters):', ...lines.map((line) => `"${line}"`)].join('\n')
      : 'No extra wording was supplied. Do not invent headlines. One poster only.',
    'Generate the single poster image, not an explanation.',
  ]
    .filter(Boolean)
    .join('\n');
}
