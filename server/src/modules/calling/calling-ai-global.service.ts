import prisma from '../../config/database';
import { getOrgCallingSettings, saveOrgCallingSettings } from './settings.service';
import type { CallingSettings } from './calling-settings.types';

/** contactId → was personally ON before last global ON */
export type CallingManualSnapshot = Record<string, Record<string, true>>;

function readCallingManualSnapshot(
  settings: CallingSettings & { personalCallingSnapshot?: CallingManualSnapshot }
): CallingManualSnapshot {
  return settings.personalCallingSnapshot ?? {};
}

async function capturePersonalCallingSnapshot(
  organizationId: string
): Promise<CallingManualSnapshot> {
  const numbers = await prisma.whatsappNumber.findMany({
    where: { organizationId, isActive: true },
    select: { id: true },
  });

  const snapshot: CallingManualSnapshot = {};
  for (const number of numbers) {
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        whatsappNumberId: number.id,
        callingAiEnabled: true,
      },
      select: { id: true },
    });
    if (contacts.length === 0) continue;
    snapshot[number.id] = Object.fromEntries(contacts.map((c) => [c.id, true as const]));
  }
  return snapshot;
}

async function applyGlobalCallingToAllContacts(organizationId: string): Promise<number> {
  const result = await prisma.contact.updateMany({
    where: { organizationId },
    data: { callingAiEnabled: true },
  });
  return result.count;
}

async function disableGlobalCallingOnAllContacts(organizationId: string): Promise<number> {
  const result = await prisma.contact.updateMany({
    where: { organizationId },
    data: { callingAiEnabled: false },
  });
  return result.count;
}

async function restorePersonalCallingSnapshot(
  organizationId: string,
  snapshot: CallingManualSnapshot
): Promise<number> {
  let restored = 0;
  for (const entries of Object.values(snapshot)) {
    const contactIds = Object.keys(entries);
    if (contactIds.length === 0) continue;
    const result = await prisma.contact.updateMany({
      where: { organizationId, id: { in: contactIds } },
      data: { callingAiEnabled: true },
    });
    restored += result.count;
  }
  return restored;
}

export async function enableGlobalCallingAi(organizationId: string): Promise<{
  settings: CallingSettings;
  contactsUpdated: number;
  remembered: number;
}> {
  const current = await getOrgCallingSettings(organizationId);
  const personalCallingSnapshot = await capturePersonalCallingSnapshot(organizationId);
  const contactsUpdated = await applyGlobalCallingToAllContacts(organizationId);

  const { settings } = await saveOrgCallingSettings(organizationId, {
    aiAutoAnswer: true,
    personalCallingSnapshot,
  } as Partial<CallingSettings> & { personalCallingSnapshot: CallingManualSnapshot });

  const remembered = Object.values(personalCallingSnapshot).reduce(
    (sum, row) => sum + Object.keys(row).length,
    0
  );

  return { settings, contactsUpdated, remembered };
}

export async function disableGlobalCallingAi(organizationId: string): Promise<{
  settings: CallingSettings;
  contactsUpdated: number;
  restored: number;
}> {
  const current = await getOrgCallingSettings(organizationId);
  const snapshot = readCallingManualSnapshot(
    current as CallingSettings & { personalCallingSnapshot?: CallingManualSnapshot }
  );

  const contactsUpdated = await disableGlobalCallingOnAllContacts(organizationId);
  const restored = await restorePersonalCallingSnapshot(organizationId, snapshot);

  const { settings } = await saveOrgCallingSettings(organizationId, {
    aiAutoAnswer: false,
    ...(current.routingMode === 'ai_only' ? { routingMode: 'ai_then_agents' as const } : {}),
    personalCallingSnapshot: snapshot,
  } as Partial<CallingSettings> & { personalCallingSnapshot: CallingManualSnapshot });

  return { settings, contactsUpdated, restored };
}

/** New contact while global calling is on — opt into personal calling immediately. */
export async function applyGlobalCallingToContactIfEnabled(
  organizationId: string,
  contactId: string
): Promise<boolean> {
  const settings = await getOrgCallingSettings(organizationId);
  if (!settings.aiAutoAnswer) return false;

  await prisma.contact.updateMany({
    where: { id: contactId, organizationId },
    data: { callingAiEnabled: true },
  });
  return true;
}
