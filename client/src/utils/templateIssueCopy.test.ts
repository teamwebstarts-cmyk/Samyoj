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
    expect(unresolved.title).not.toMatch(/personal field/i);
    expect(unresolved.detail).toMatch(/unresolved placeholders/i);

    const campaignSample = explainTemplateIssue(
      'Could not start campaign: missing sample value for audience preview',
    );
    expect(campaignSample.title).not.toMatch(/personal field/i);
    expect(campaignSample.detail).toMatch(/sample value/i);

    const campaignSite = explainTemplateIssue(
      'Campaign landing page must be a real website on your domain',
    );
    expect(campaignSite.title).not.toMatch(/real website/i);
    expect(campaignSite.detail).toMatch(/landing page/i);

    const campaignPhone = explainTemplateIssue('Add at least one valid phone number');
    expect(campaignPhone.title).not.toMatch(/call button/i);
    expect(campaignPhone.detail).toMatch(/valid phone/i);

    const campaignExists = explainTemplateIssue('A campaign with this name already exists');
    expect(campaignExists.title).not.toMatch(/already in use/i);
    expect(campaignExists.detail).toMatch(/campaign/i);

    const genericHttp = explainTemplateIssue('Webhook URL is not http compatible');
    expect(genericHttp.title).not.toMatch(/website link/i);
    expect(genericHttp.detail).toMatch(/not http/i);
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
});
