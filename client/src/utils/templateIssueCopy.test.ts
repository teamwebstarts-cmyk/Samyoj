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
});
