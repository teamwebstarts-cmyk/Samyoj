import { useRef, useState } from 'react';
import { FileText, Link2, Loader2, Upload } from 'lucide-react';
import AppInput from '../ui/AppInput';
import AppButton from '../ui/AppButton';
import InfoTip from '../ui/InfoTip';
import { headerMediaLabel } from '../campaigns/campaignPreviewUtils';
import {
  HEADER_MEDIA_SIZE_HINT,
  headerMediaAccept,
  isLikelyPublicHttpsUrl,
  uploadPublicHeaderMedia,
  type HeaderMediaFormat,
} from '../../utils/headerMedia';
import { toastError } from '../../utils/toast';

interface TemplateHeaderMediaFieldProps {
  id?: string;
  format: HeaderMediaFormat;
  value: string;
  onChange: (url: string) => void;
  compact?: boolean;
  required?: boolean;
  labelClassName?: string;
}

export default function TemplateHeaderMediaField({
  id = 'header-media-url',
  format,
  value,
  onChange,
  compact,
  required,
  labelClassName,
}: TemplateHeaderMediaFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const publicUrl = await uploadPublicHeaderMedia(file, format);
      onChange(publicUrl);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const urlInvalid = Boolean(value.trim()) && !isLikelyPublicHttpsUrl(value);

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <div className="flex flex-wrap items-center gap-1">
        <span className={`font-semibold text-theme-secondary ${compact ? 'text-[11px]' : 'text-[13px]'}`}>
          {headerMediaLabel(format)}
          {required ? <span className="text-red-500"> *</span> : null}
        </span>
        <InfoTip
          label="Header media at send time"
          content={
            <>
              WhatsApp needs a public <span className="font-semibold">https://</span> link each time you send
              this template. Upload here or paste your own hosted file. This is separate from the sample file
              used when the template was approved.
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept={headerMediaAccept(format)}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        <AppButton
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : 'Upload file'}
        </AppButton>
        <span className="text-[10px] font-medium text-slate-400">{HEADER_MEDIA_SIZE_HINT[format]}</span>
      </div>

      <AppInput
        id={id}
        placeholder="https://yourstore.com/banner.jpg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        icon={<Link2 className="h-3.5 w-3.5" />}
        label="Or paste a public link"
        labelClassName={labelClassName}
        className={compact ? '!h-9 rounded-lg pl-9 text-[12px]' : undefined}
        error={urlInvalid ? 'Use a public https:// link' : undefined}
      />

      {value.trim() && isLikelyPublicHttpsUrl(value) && format === 'IMAGE' ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <img src={value} alt="" className="max-h-28 w-full object-cover" />
        </div>
      ) : null}
      {value.trim() && isLikelyPublicHttpsUrl(value) && format === 'VIDEO' ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <video src={value} className="max-h-28 w-full object-cover" controls muted playsInline />
        </div>
      ) : null}
      {value.trim() && isLikelyPublicHttpsUrl(value) && format === 'DOCUMENT' ? (
        <p className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
          <FileText className="h-3.5 w-3.5" aria-hidden />
          PDF link ready to send
        </p>
      ) : null}
    </div>
  );
}
