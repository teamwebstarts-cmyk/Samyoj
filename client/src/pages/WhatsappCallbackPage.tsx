import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader2, Smartphone } from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { whatsappApi, type WhatsappPhoneOption } from '../services/api';

type PageStatus = 'loading' | 'select' | 'connecting' | 'success' | 'error';

export default function WhatsappCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshNumbers } = useWhatsAppNumber();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [message, setMessage] = useState('Connecting your WhatsApp number...');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phones, setPhones] = useState<WhatsappPhoneOption[]>([]);
  const [pendingToken, setPendingToken] = useState('');
  const [selectedKey, setSelectedKey] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setMessage(errorDescription || error || 'Sign-in was cancelled.');
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Something went wrong. Please try connecting again from Settings.');
      return;
    }

    whatsappApi
      .completeConnect(code)
      .then(({ data }) => {
        const result = data.data;
        if (result.requiresSelection && result.phones?.length && result.pendingToken) {
          setPhones(result.phones);
          setPendingToken(result.pendingToken);
          setSelectedKey(`${result.phones[0].wabaId}:${result.phones[0].phoneNumberId}`);
          setStatus('select');
          setMessage('Choose which WhatsApp number to connect.');
          return;
        }

        setPhoneNumber(result.phoneNumber || '');
        setStatus('success');
        setMessage('WhatsApp connected successfully!');
        void refreshNumbers();
        setTimeout(() => navigate('/settings', { replace: true }), 2500);
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message || 'Failed to complete WhatsApp connection.';
        setStatus('error');
        setMessage(msg);
      });
  }, [searchParams, navigate]);

  const handleSelectConnect = async () => {
    const selected = phones.find((p) => `${p.wabaId}:${p.phoneNumberId}` === selectedKey);
    if (!selected || !pendingToken) return;

    setStatus('connecting');
    setMessage(`Connecting +${selected.phoneNumber}...`);

    try {
      const { data } = await whatsappApi.selectConnect(
        pendingToken,
        selected.phoneNumberId,
        selected.wabaId
      );
      setPhoneNumber(data.data.phoneNumber || selected.phoneNumber);
      setStatus('success');
      setMessage('WhatsApp connected successfully!');
      void refreshNumbers();
      setTimeout(() => navigate('/settings', { replace: true }), 2500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to connect selected number.';
      setStatus('error');
      setMessage(msg);
    }
  };

  return (
    <div className="platform-gradient flex min-h-screen items-center justify-center p-4">
      <div className="dashboard-card w-full max-w-md p-8 text-center animate-fade-up">
        {(status === 'loading' || status === 'connecting') && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-whatsapp-600" />
            <h1 className="mt-4 text-xl font-extrabold text-neutral-900">Connecting WhatsApp</h1>
            <p className="mt-2 text-[13px] font-medium text-neutral-600">{message}</p>
          </>
        )}

        {status === 'select' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-whatsapp-600 to-whatsapp-700 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]">
              <Smartphone className="h-7 w-7" strokeWidth={2.25} />
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-neutral-900">Select a number</h1>
            <p className="mt-2 text-[13px] font-medium text-neutral-600">{message}</p>
            <div className="mt-5 space-y-2 text-left">
              {phones.map((phone) => {
                const key = `${phone.wabaId}:${phone.phoneNumberId}`;
                const isSelected = selectedKey === key;
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                      isSelected
                        ? 'border-whatsapp-400 bg-emerald-50/90 ring-1 ring-whatsapp-200'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="whatsapp-phone"
                      value={key}
                      checked={isSelected}
                      onChange={() => setSelectedKey(key)}
                      className="h-4 w-4 accent-whatsapp-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-neutral-900">+{phone.phoneNumber}</p>
                      {phone.verifiedName && (
                        <p className="truncate text-[12px] font-semibold text-neutral-600">
                          {phone.verifiedName}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            <AppButton className="mt-6 w-full" onClick={handleSelectConnect} disabled={!selectedKey}>
              Connect selected number
            </AppButton>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-whatsapp-600">
              <CheckCircle className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-emerald-800">{message}</h1>
            {phoneNumber && (
              <p className="mt-2 text-[13px] font-medium text-neutral-600">Number: +{phoneNumber}</p>
            )}
            <p className="mt-4 text-[11px] font-medium text-neutral-500">Redirecting to Settings...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-red-800">Connection failed</h1>
            <p className="mt-2 text-[13px] font-medium text-neutral-600">{message}</p>
            <AppButton className="mt-6" onClick={() => navigate('/settings', { replace: true })}>
              Back to Settings
            </AppButton>
          </>
        )}
      </div>
    </div>
  );
}
