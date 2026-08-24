import { describe, expect, it } from 'vitest';
import { explainTemplateIssue } from './templateIssueCopy';

describe('explainTemplateIssue', () => {
  it('explains a localhost / Samyoj page URL without jargon', () => {
    const issue = explainTemplateIssue(
      'Use your live website, not this Samyoj page or a link that only works on your computer.',
    );
    expect(issue.title).toMatch(/computer/i);
    expect(issue.detail.toLowerCase()).not.toContain('https');
    expect(issue.detail.toLowerCase()).not.toContain('localhost');
    expect(issue.example).toContain('yourstore.com');
  });

  it('hides raw API error codes', () => {
    const issue = explainTemplateIssue('(#100) Invalid parameter');
    expect(issue.title).toMatch(/couldn.t save/i);
    expect(issue.detail).not.toMatch(/#100/);
  });

  it('still explains template-wizard personal-field and sample-value messages', () => {
    const placeholders = explainTemplateIssue(
      'Placeholders cannot be placed directly next to each other — add text between them',
    );
    expect(placeholders.title).toMatch(/personal field/i);

    const samples = explainTemplateIssue('Add sample values for all 1 header variable(s)');
    expect(samples.title).toMatch(/example for each personal field/i);

    const website = explainTemplateIssue('Replace the sample address with your real website.');
    expect(website.title).toMatch(/real website/i);
  });

  it('does not rewrite campaign-like messages into template-wizard titles', () => {
    const unresolved = explainTemplateIssue(
      'body contains unresolved placeholders; provide recipient data before sending',
    );
    expect(unresolved.title).toMatch(/message fields are still empty/i);
    expect(unresolved.detail.toLowerCase()).not.toMatch(/placeholder/i);

    const campaignSample = explainTemplateIssue(
      'Could not start campaign: missing sample value for audience preview',
    );
    expect(campaignSample.title).toMatch(/example value/i);

    const campaignSite = explainTemplateIssue(
      'Campaign landing page must be a real website on your domain',
    );
    expect(campaignSite.title).toMatch(/live website/i);
    expect(campaignSite.detail.toLowerCase()).not.toMatch(/domain/i);

    const campaignPhone = explainTemplateIssue('Add at least one valid phone number');
    expect(campaignPhone.title).toBe('Add at least one valid phone number');
    expect(campaignPhone.detail).toBe('');

    const campaignExists = explainTemplateIssue('A campaign with this name already exists');
    expect(campaignExists.title).toBe('A campaign with this name already exists');
    expect(campaignExists.detail).toBe('');

    const genericHttp = explainTemplateIssue('Webhook URL is not http compatible');
    expect(genericHttp.title).toMatch(/isn.?t ready/i);
    expect(genericHttp.detail.toLowerCase()).not.toMatch(/webhook/i);
  });

  it('still explains template library phone, name, and http button errors', () => {
    const phone = explainTemplateIssue(
      'Enter a valid phone number with country code for the call button.',
    );
    expect(phone.title).toMatch(/call button/i);

    const exists = explainTemplateIssue(
      'A template with this name already exists. Choose a different name.',
    );
    expect(exists.title).toMatch(/already in use/i);

    const http = explainTemplateIssue(
      'This website link isn’t secure enough. Use an address that starts with https://, not http://',
    );
    expect(http.title).toMatch(/website link/i);
  });

  it('explains campaign button-link and coupon messages without jargon', () => {
    const uniqueEnding = explainTemplateIssue('Add the unique ending for the button link.');
    expect(uniqueEnding.title).toMatch(/button link/i);
    expect(uniqueEnding.example).toBe('order-123');
    expect(uniqueEnding.detail.toLowerCase()).not.toContain('localhost');
    expect(uniqueEnding.detail.toLowerCase()).not.toContain('suffix');

    const coupon = explainTemplateIssue('Add the coupon code.');
    expect(coupon.title).toMatch(/coupon code/i);
    expect(coupon.example).toBe('SAVE20');
  });
});
