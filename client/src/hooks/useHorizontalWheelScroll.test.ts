import { describe, expect, it } from 'vitest';
import { applyVerticalWheelToHorizontalScroll } from './useHorizontalWheelScroll';

function fakeEl(partial: Partial<Pick<HTMLElement, 'scrollWidth' | 'clientWidth' | 'scrollLeft' | 'clientHeight'>>) {
  return {
    scrollWidth: 400,
    clientWidth: 200,
    clientHeight: 28,
    scrollLeft: 0,
    ...partial,
  } as HTMLElement;
}

function fakeWheel(partial: Partial<WheelEvent> = {}): WheelEvent {
  const event = {
    deltaY: 40,
    deltaX: 0,
    deltaMode: 0,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...partial,
  };
  return event as WheelEvent;
}

describe('applyVerticalWheelToHorizontalScroll', () => {
  it('maps deltaY to scrollLeft when the row overflows', () => {
    const el = fakeEl({});
    const event = fakeWheel({ deltaY: 50 });
    expect(applyVerticalWheelToHorizontalScroll(event, el)).toBe(true);
    expect(el.scrollLeft).toBe(50);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not steal page scroll when the row is not overflowed', () => {
    const el = fakeEl({ scrollWidth: 200, clientWidth: 200 });
    const event = fakeWheel({ deltaY: 50 });
    expect(applyVerticalWheelToHorizontalScroll(event, el)).toBe(false);
    expect(el.scrollLeft).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not intercept when shiftKey already maps to horizontal', () => {
    const el = fakeEl({});
    const event = fakeWheel({ deltaY: 50, shiftKey: true });
    expect(applyVerticalWheelToHorizontalScroll(event, el)).toBe(false);
    expect(el.scrollLeft).toBe(0);
  });

  it('does not intercept a mostly-horizontal trackpad gesture', () => {
    const el = fakeEl({});
    const event = fakeWheel({ deltaX: 80, deltaY: 10 });
    expect(applyVerticalWheelToHorizontalScroll(event, el)).toBe(false);
    expect(el.scrollLeft).toBe(0);
  });

  it('lets the page scroll when already at the end', () => {
    const el = fakeEl({ scrollLeft: 200 });
    const event = fakeWheel({ deltaY: 40 });
    expect(applyVerticalWheelToHorizontalScroll(event, el)).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });
});
