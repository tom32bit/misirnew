/**
 * Server-side instrumentation (Next.js file convention — runs once per server
 * instance on the Node runtime). Optionally ships Next.js server logs to
 * PostHog's Logs product over OpenTelemetry.
 *
 * OFF by default. Server logs can contain URLs and user data and there is no
 * per-user consent gate on the server, so this only activates when explicitly
 * enabled via POSTHOG_LOGS_ENABLED=true AND a token is present. Emit through the
 * global `__posthogLogger` (see usage below) — it's undefined when disabled, so
 * callers use optional chaining and simply no-op.
 *
 *   import { SeverityNumber } from "@opentelemetry/api-logs"
 *   const logger = (globalThis as { __posthogLogger?: import("@opentelemetry/api-logs").Logger }).__posthogLogger
 *   logger?.emit({ severityNumber: SeverityNumber.INFO, severityText: "INFO", body: "…" })
 *
 * Next 16 note: `instrumentation.ts` is a stable convention — no
 * `experimental.instrumentationHook` config is needed (that key was removed).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.POSTHOG_LOGS_ENABLED !== "true") return

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  if (!token) return

  // Region host (…i.posthog.com) drives the OTLP endpoint.
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(
    /\/$/,
    "",
  )

  try {
    const [{ OTLPLogExporter }, { resourceFromAttributes }, { LoggerProvider, SimpleLogRecordProcessor }] =
      await Promise.all([
        import("@opentelemetry/exporter-logs-otlp-http"),
        import("@opentelemetry/resources"),
        import("@opentelemetry/sdk-logs"),
      ])

    const exporter = new OTLPLogExporter({
      url: `${host}/otlp/v1/logs`,
      headers: { Authorization: `Bearer ${token}` },
    })

    // sdk-logs ≥0.2xx: processors go in the constructor and the processor takes
    // an options object ({ exporter }) — the doc's addLogRecordProcessor /
    // positional-exporter form is from an older release.
    const loggerProvider = new LoggerProvider({
      resource: resourceFromAttributes({ "service.name": "misir-frontend" }),
      processors: [new SimpleLogRecordProcessor({ exporter })],
    })

    ;(globalThis as { __posthogLogger?: unknown }).__posthogLogger =
      loggerProvider.getLogger("misir-frontend")
  } catch {
    // Never let observability setup break server startup.
  }
}
