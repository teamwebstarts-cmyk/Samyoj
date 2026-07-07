import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Link2, LogOut, Smartphone } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AppButton from '../ui/AppButton';
import { toastError, toastSuccess } from '../../utils/toast';
import { whatsappApi } from '../../services/api';

interface WhatsappNumberRow {
  id: string;
  phoneNumber: string;
  isActive: boolean;
}

export default function WhatsAppConnectGuide() {
  const navigate = useNavigate();
  const [connectUrl, setConnectUrl] = useState('');
  const [metaConfigured, setMetaConfigured] = useState(false);
  const [number, setNumber] = useState<WhatsappNumberRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    Promise.all([whatsappApi.numbers(), whatsappApi.metaConfig()])
      .then(async ([numbersRes, metaRes]) => {
        const numbers = numbersRes.data.data as WhatsappNumberRow[];
        setNumber(numbers[0] ?? null);
        setMetaConfigured(Boolean(metaRes.data.data.configured));
        if (metaRes.data.data.configured) {
          try {
            const urlRes = await whatsappApi.connectUrl();
            setConnectUrl(urlRes.data.data.url);
          } catch {
            setConnectUrl('');
          }
        } else {
          setConnectUrl('');
        }
      })
      .catch(() => {
        setNumber(null);
        setConnectUrl('');
        toastError('Could not load WhatsApp connection status.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleConnect = () => {
    if (!metaConfigured) {
      navigate('/settings?tab=whatsapp');
      return;
    }
    if (!connectUrl) return;
    setConnecting(true);
    window.location.href = connectUrl;
  };

  const handleDisconnect = async () => {
    if (!number) return;
    const confirmed = window.confirm(
      'Disconnect WhatsApp? New messages will stop until you connect again.'
    );
    if (!confirmed) return;

    setDisconnecting(true);
    try {
      await whatsappApi.disconnect(number.id);
      setNumber(null);
      toastSuccess('WhatsApp disconnected');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to disconnect WhatsApp.';
      toastError(msg);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <section className="mb-8 sm:mb-10" aria-label="WhatsApp connection">
        <div className="dashboard-card h-[88px] animate-pulse rounded-2xl" />
      </section>
    );
  }

  if (number) {
    return (
      <section className="mb-8 sm:mb-10" aria-label="WhatsApp connection">
        <div className="dashboard-card flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-600 to-whatsapp-700 text-white">
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-neutral-900">WhatsApp connected</p>
              <p className="text-[13px] font-medium text-whatsapp-700">+{number.phoneNumber}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/settings"
              className="inline-flex h-10 items-center rounded-xl border border-neutral-200 bg-white px-4 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Settings
            </Link>
            <AppButton
              variant="danger"
              size="md"
              icon={<LogOut className="h-4 w-4" />}
              onClick={handleDisconnect}
              loading={disconnecting}
              disabled={disconnecting}
            >
              Disconnect
            </AppButton>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8 sm:mb-10" aria-label="WhatsApp connection">
      <div className="dashboard-card rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-600 to-whatsapp-700 text-white">
              <Smartphone className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-neutral-900">Connect WhatsApp</h2>
              <p className="mt-0.5 text-[13px] text-neutral-600">
                {metaConfigured
                  ? 'Sign in and pick your business number to get started.'
                  : 'Configure your Meta app in Settings first, then connect your number.'}
              </p>
              <p className="mt-2 text-[12px] text-neutral-500">
                Connect → Sign in → Choose number
              </p>
            </div>
          </div>
          <AppButton
            className="shrink-0 sm:ml-4"
            icon={<Link2 className="h-4 w-4" />}
            onClick={handleConnect}
            disabled={connecting}
            loading={connecting}
          >
            {metaConfigured ? 'Connect WhatsApp' : 'Configure in Settings'}
          </AppButton>
        </div>
      </div>
    </section>
  );
}
