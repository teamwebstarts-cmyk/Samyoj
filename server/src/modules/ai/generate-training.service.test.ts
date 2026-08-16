import { describe, expect, it } from 'vitest';
import { TRAIN_MAX_ITEMS } from './ai-constants';
import {
  buildTrainingGeneratePrompt,
  filterGeneratedFaqs,
  parseGeneratedFaqs,
} from './generate-training.service';
import { AI_USAGE_ACTIONS } from './ai-usage-actions';

const extras = {
  companyName: 'Pune Dental',
  website: 'https://pune.dental',
  notes: 'We do scaling and braces. Hindi or English is fine.',
  audience: '',
  valueProps: [],
};

describe('buildTrainingGeneratePrompt', () => {
  it('asks for FAQ JSON and includes business extras', () => {
    const { system, user } = buildTrainingGeneratePrompt('CHAT', 'Clinic hours and parking', extras);
    expect(system).toMatch(/JSON/i);
    expect(system).toMatch(/items/i);
    expect(system).not.toMatch(/sarvam-105b|VOICE_SAFETY/i);
    expect(user).toContain('Clinic hours and parking');
    expect(user).toContain('https://pune.dental');
    expect(user).toContain('Pune Dental');
  });

  it('asks for spoken calling FAQ pairs', () => {
    const { system } = buildTrainingGeneratePrompt('CALL', 'Answer clinic calls', extras);
    expect(system).toMatch(/phone|spoken|caller/i);
    expect(system).toMatch(/JSON/i);
  });
});

describe('parseGeneratedFaqs', () => {
  it('reads fenced JSON items', () => {
    const raw = '```json\n{"items":[{"title":"Hours","content":"We open at 10 in the morning."}]}\n```';
    expect(parseGeneratedFaqs(raw)).toEqual([
      { title: 'Hours', content: 'We open at 10 in the morning.' },
    ]);
  });
});

describe('filterGeneratedFaqs', () => {
  it('drops short junk, duplicates, and respects the remaining cap', () => {
    const drafts = [
      { title: 'H', content: 'Too' },
      { title: 'Hours', content: 'We open at 10 in the morning.' },
      { title: 'hours', content: 'We open at ten.' },
      { title: 'Parking', content: 'Basement parking is free for patients.' },
    ];
    const kept = filterGeneratedFaqs(drafts, ['Hours'], 80);
    expect(kept.map((item) => item.title)).toEqual(['Parking']);
  });

  it('stops when the bot is at the training cap', () => {
    const drafts = [{ title: 'Parking', content: 'Basement parking is free for patients.' }];
    expect(filterGeneratedFaqs(drafts, [], 0)).toEqual([]);
    expect(TRAIN_MAX_ITEMS).toBeGreaterThan(0);
  });
});

describe('AI_USAGE_ACTIONS', () => {
  it('records generate_training as a named Reports surface', () => {
    expect(AI_USAGE_ACTIONS).toContain('generate_training');
  });
});
