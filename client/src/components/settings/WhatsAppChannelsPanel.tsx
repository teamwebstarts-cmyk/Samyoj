import {
  Smartphone,
  CheckCircle,
  LogOut,
  Plus,
} from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppButton from '../ui/AppButton';
import type { WhatsappNumber } from '../../types';
import { formatPhoneDisplay } from '../../utils/phone';

interface WhatsAppChannelsPanelProps {
  numbers: WhatsappNumber[];
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: (id: string, phone: string) => void;
  disconnectingId: string | null;
  canEdit: boolean;
}

export default function WhatsAppChannelsPanel({
  numbers,
  connecting,
  onConnect,
  onDisconnect,
  disconnectingId,
  canEdit,
}: WhatsAppChannelsPanelProps) {
  return (
    <div className="space-y-5">
      <SettingsPanel
        title="WhatsApp numbers"
        description="Numbers your workspace sends and receives messages on."
        icon={Smartphone}
        accent="emerald"
        footer={
          numbers.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] font-medium text-theme-muted">
                Chats stay saved if you disconnect.
              </p>
              <AppButton
                variant="secondary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={onConnect}
                disabled={connecting || !canEdit}
                loading={connecting}
              >
                Connect another number
              </AppButton>
            </div>
          ) : undefined
        }
      >
        {numbers.length > 0 ? (
          <div className="space-y-3">
            {numbers.map((number) => (
              <div
                key={number.id}
                className="flex flex-col gap-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 via-emerald-50/30 to-theme-surface p-4 ring-1 ring-emerald-100 dark:border-emerald-800/40 dark:from-emerald-950/30 dark:ring-emerald-900/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-theme-surface text-whatsapp-600 shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-800/50">
                    <CheckCircle size={22} strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="font-extrabold text-theme-fg text-[15px]">
                      {formatPhoneDisplay(number.phoneNumber)}
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Connected via Meta Cloud API
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <AppButton
                    variant="danger"
                    size="sm"
                    icon={<LogOut className="h-4 w-4" />}
                    onClick={() => onDisconnect(number.id, number.phoneNumber)}
                    loading={disconnectingId === number.id}
                    disabled={disconnectingId !== null || !canEdit}
                  >
                    Disconnect
                  </AppButton>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-theme-border bg-theme-subtle/40 px-4 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]">
              <Smartphone className="h-6 w-6" strokeWidth={2.25} />
            </div>
            <p className="mt-4 text-[14px] font-semibold text-theme-fg">
              No WhatsApp number connected yet
            </p>
            <p className="mt-1 text-[13px] font-medium text-theme-secondary">
              Connect your business number through Facebook login to start chatting.
            </p>
            <AppButton
              className="mt-5"
              onClick={onConnect}
              disabled={connecting || !canEdit}
              loading={connecting}
              icon={<Plus className="h-4 w-4" />}
            >
              Connect WhatsApp
            </AppButton>
            <p className="mt-3 text-[11px] font-medium text-theme-muted">
              Takes about a minute. You'll pick your number after logging in.
            </p>
          </div>
        )}
      </SettingsPanel>
    </div>
  );
}
