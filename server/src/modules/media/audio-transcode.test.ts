import { describe, expect, it } from 'vitest';
import { needsWhatsAppAudioTranscode, needsBrowserAudioTranscode } from './audio-transcode';

describe('needsWhatsAppAudioTranscode', () => {
  it('returns false for mp3 (audio/mpeg)', () => {
    expect(needsWhatsAppAudioTranscode('audio/mpeg')).toBe(false);
  });

  it('returns false for ogg (audio/ogg)', () => {
    expect(needsWhatsAppAudioTranscode('audio/ogg')).toBe(false);
  });

  it('returns false for aac', () => {
    expect(needsWhatsAppAudioTranscode('audio/aac')).toBe(false);
  });

  it('returns false for amr', () => {
    expect(needsWhatsAppAudioTranscode('audio/amr')).toBe(false);
  });

  it('returns false for mp4 audio', () => {
    expect(needsWhatsAppAudioTranscode('audio/mp4')).toBe(false);
  });

  it('returns true for wav', () => {
    expect(needsWhatsAppAudioTranscode('audio/wav')).toBe(true);
  });

  it('returns true for x-wav', () => {
    expect(needsWhatsAppAudioTranscode('audio/x-wav')).toBe(true);
  });

  it('returns true for webm audio', () => {
    expect(needsWhatsAppAudioTranscode('audio/webm')).toBe(true);
  });

  it('returns true for webm video', () => {
    expect(needsWhatsAppAudioTranscode('video/webm')).toBe(true);
  });

  it('detects webm by filename extension', () => {
    expect(needsWhatsAppAudioTranscode(undefined, 'recording.webm')).toBe(true);
  });

  it('detects wav by filename extension', () => {
    expect(needsWhatsAppAudioTranscode(undefined, 'note.wav')).toBe(true);
  });

  it('returns false for undefined mime and no extension', () => {
    expect(needsWhatsAppAudioTranscode(undefined, undefined)).toBe(false);
  });

  it('handles mime with charset suffix', () => {
    expect(needsWhatsAppAudioTranscode('audio/ogg; charset=utf-8')).toBe(false);
    expect(needsWhatsAppAudioTranscode('audio/webm; codecs=opus')).toBe(true);
  });
});

describe('needsBrowserAudioTranscode', () => {
  it('returns false for mp3 (audio/mpeg)', () => {
    expect(needsBrowserAudioTranscode('audio/mpeg')).toBe(false);
  });

  it('returns false for mp4 audio', () => {
    expect(needsBrowserAudioTranscode('audio/mp4')).toBe(false);
  });

  it('returns false for aac', () => {
    expect(needsBrowserAudioTranscode('audio/aac')).toBe(false);
  });

  it('returns false for wav', () => {
    expect(needsBrowserAudioTranscode('audio/wav')).toBe(false);
  });

  it('returns true for ogg', () => {
    expect(needsBrowserAudioTranscode('audio/ogg')).toBe(true);
  });

  it('returns true for opus', () => {
    expect(needsBrowserAudioTranscode('audio/opus')).toBe(true);
  });

  it('returns true for application/ogg', () => {
    expect(needsBrowserAudioTranscode('application/ogg')).toBe(true);
  });

  it('returns true for amr', () => {
    expect(needsBrowserAudioTranscode('audio/amr')).toBe(true);
  });

  it('returns true for webm', () => {
    expect(needsBrowserAudioTranscode('audio/webm')).toBe(true);
  });

  it('detects .ogg by filename', () => {
    expect(needsBrowserAudioTranscode(undefined, 'voice.ogg')).toBe(true);
  });

  it('detects .opus by filename', () => {
    expect(needsBrowserAudioTranscode(undefined, 'voice.opus')).toBe(true);
  });

  it('detects .amr by filename', () => {
    expect(needsBrowserAudioTranscode(undefined, 'voice.amr')).toBe(true);
  });

  it('detects .webm by filename', () => {
    expect(needsBrowserAudioTranscode(undefined, 'voice.webm')).toBe(true);
  });

  it('returns false for unknown type with no matching extension', () => {
    expect(needsBrowserAudioTranscode('application/octet-stream', 'file.bin')).toBe(false);
  });
});
