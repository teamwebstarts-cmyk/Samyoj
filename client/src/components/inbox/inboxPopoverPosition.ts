/** Shared fixed-position math for Inbox popovers portaled to document.body. */

export interface PopoverCoords {
  top: number;
  left: number;
}

/**
 * Place a panel relative to an anchor rect, flipping above/below and clamping
 * horizontally so it stays inside the viewport with a small padding.
 */
export function computeFixedPopoverPosition(
  anchor: DOMRect,
  panel: { width: number; height: number },
  opts?: { prefer?: 'above' | 'below'; gap?: number; padding?: number }
): PopoverCoords {
  const gap = opts?.gap ?? 6;
  const pad = opts?.padding ?? 8;
  const prefer = opts?.prefer ?? 'below';
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spaceBelow = vh - anchor.bottom - pad;
  const spaceAbove = anchor.top - pad;
  const openBelow =
    prefer === 'below'
      ? spaceBelow >= panel.height || spaceBelow >= spaceAbove
      : spaceAbove < panel.height && spaceBelow > spaceAbove;

  let top = openBelow
    ? anchor.bottom + gap
    : anchor.top - panel.height - gap;

  top = Math.max(pad, Math.min(top, vh - panel.height - pad));

  // Prefer right-aligning to the trigger (sidebar actions sit near the right).
  let left = anchor.right - panel.width;
  left = Math.max(pad, Math.min(left, vw - panel.width - pad));

  return { top, left };
}
