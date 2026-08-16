import { describe, expect, it } from 'vitest';
import { liveVoiceTurnsFromTranscript } from './voice-context';

describe('liveVoiceTurnsFromTranscript', () => {
  it('keeps prior call turns and drops the current inbound user line', () => {
    expect(
      liveVoiceTurnsFromTranscript(
        [
          { role: 'assistant', text: 'Hello! How can I help you?' },
          { role: 'user', text: 'Did you know my name?' },
          { role: 'assistant', text: 'Yes, I see your name here as Nirbhay.' },
          { role: 'user', text: 'तुमने पीछे कुछ बोला था' },
        ],
        'तुमने पीछे कुछ बोला था'
      )
    ).toEqual([
      { role: 'assistant', content: 'Hello! How can I help you?' },
      { role: 'user', content: 'Did you know my name?' },
      { role: 'assistant', content: 'Yes, I see your name here as Nirbhay.' },
    ]);
  });

  it('returns an empty list when the call has only the current utterance', () => {
    expect(
      liveVoiceTurnsFromTranscript([{ role: 'user', text: 'Hello.' }], 'Hello.')
    ).toEqual([]);
  });

  it('keeps the opening greeting (stored as system) as an assistant turn', () => {
    expect(
      liveVoiceTurnsFromTranscript(
        [
          { role: 'system', text: 'Hi, thanks for calling. How can I help?' },
          { role: 'user', text: 'Mera naam yaad hai?' },
        ],
        'Mera naam yaad hai?'
      )
    ).toEqual([{ role: 'assistant', content: 'Hi, thanks for calling. How can I help?' }]);
  });
});
