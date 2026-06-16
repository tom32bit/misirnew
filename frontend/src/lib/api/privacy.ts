import type { KyInstance } from "ky"

export interface ConsentRow {
  purpose: string
  granted: boolean
}

export interface ConsentResponse {
  policy_version: string
  data_region: string
  consents: ConsentRow[]
}

/** Data-subject-rights + consent endpoints (backend privacy router). */
export const privacyApi = {
  getConsent: (k: KyInstance) => k.get("me/consent").json<ConsentResponse>(),
  putConsent: (k: KyInstance, consents: ConsentRow[], jurisdiction?: string, gpc = false) =>
    k.put("me/consent", { json: { consents, jurisdiction, gpc } }).json<ConsentResponse>(),
  exportData: (k: KyInstance) => k.get("me/export").json<unknown>(),
  deleteAccount: (k: KyInstance) => k.delete("me"),
}
