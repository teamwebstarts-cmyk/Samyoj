import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('telemetry');

let initialized = false;

export function initTelemetry(): void {
  if (initialized) return;

  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!otelEndpoint) {
    log.info('OpenTelemetry disabled — set OTEL_EXPORTER_OTLP_ENDPOINT to enable tracing');
    initialized = true;
    return;
  }

  log.info('OpenTelemetry stub initialized', {
    endpoint: otelEndpoint,
    service: process.env.OTEL_SERVICE_NAME || 'whatsapp-platform',
  });

  initialized = true;
}

export function getTelemetryStatus() {
  return {
    enabled: Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT),
    serviceName: process.env.OTEL_SERVICE_NAME || 'whatsapp-platform',
    initialized,
  };
}
