import { describe, expect, it } from 'vitest';
import {
  applyBrainPlaceholders,
  extractInlineToolCalls,
  hasOpenToolCallMarkup,
} from './voice-tool-parse';

describe('extractInlineToolCalls', () => {
  it('strips schedule_callback XML and extracts args', () => {
    const raw =
      '<tool_call>schedule_callback <arg_key>callback_time</arg_key> <arg_value>today 11:00 AM</arg_value> <arg_key>notes</arg_key> <arg_value>Customer requested a callback with the head/manager.</arg_value> </tool_call>';
    const { cleanText, tools } = extractInlineToolCalls(raw);
    expect(cleanText).toBe('');
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('schedule_callback');
    expect(tools[0].arguments.when).toBe('today 11:00 AM');
  });

  it('keeps spoken text around a tool block', () => {
    const raw = 'Sure. <tool_call>request_human <arg_key>reason</arg_key> <arg_value>asked for manager</arg_value> </tool_call>';
    const { cleanText, tools } = extractInlineToolCalls(raw);
    expect(cleanText).toBe('Sure.');
    expect(tools[0].name).toBe('request_human');
  });
});

describe('hasOpenToolCallMarkup', () => {
  it('detects incomplete tool blocks while streaming', () => {
    expect(hasOpenToolCallMarkup('Hello <tool_call>schedule_callback')).toBe(true);
    expect(
      hasOpenToolCallMarkup(
        '<tool_call>schedule_callback <arg_key>when</arg_key> <arg_value>now</arg_value> </tool_call>'
      )
    ).toBe(false);
  });
});

describe('applyBrainPlaceholders', () => {
  it('replaces BUSINESS_NAME and TEAM_NAME', () => {
    expect(
      applyBrainPlaceholders('You work at [BUSINESS_NAME] with [TEAM_NAME].', {
        businessName: 'Samyoj',
        teamName: 'Support',
      })
    ).toBe('You work at Samyoj with Support.');
  });
});
