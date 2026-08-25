import { describe, expect, it } from 'vitest';
import {
  buildFlowAssetJson,
  isSimpleMetaFlow,
  mergeSimpleFlowAssetJson,
} from './types';

describe('flow asset json merge', () => {
  it('detects simple one-screen flows', () => {
    const json = buildFlowAssetJson({
      title: 'Hello',
      submitLabel: 'Go',
      fields: [{ id: 'name', label: 'Name', type: 'text', required: true }],
    });
    expect(isSimpleMetaFlow(json as unknown as Record<string, unknown>)).toBe(true);
  });

  it('preserves extra top-level keys when merging', () => {
    const existing = {
      version: '3.1',
      data_api_version: '3.0',
      screens: buildFlowAssetJson({
        title: 'Old',
        submitLabel: 'Send',
        fields: [{ id: 'a', label: 'A', type: 'text' }],
      }).screens,
    };

    const merged = mergeSimpleFlowAssetJson(existing, {
      title: 'New title',
      submitLabel: 'Submit',
      fields: [{ id: 'email', label: 'Email', type: 'email', required: true }],
    });

    expect(merged.data_api_version).toBe('3.0');
    const screen = (merged.screens as Array<Record<string, unknown>>)[0];
    expect(screen.title).toBe('New title');
  });

  it('emits TextArea for textarea fields', () => {
    const json = buildFlowAssetJson({
      title: 'Form',
      submitLabel: 'Done',
      fields: [{ id: 'notes', label: 'Notes', type: 'textarea' }],
    });
    const screens = json.screens as Array<{ layout: { children: Array<{ children: unknown[] }> } }>;
    const formChildren = screens[0].layout.children[0].children;
    expect(formChildren[0]).toMatchObject({ type: 'TextArea', name: 'notes' });
  });
});
