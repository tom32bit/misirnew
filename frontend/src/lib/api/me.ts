import type { KyInstance } from "ky"
import type { AuthUser } from "./types"

export const meApi = {
  /** Verifies the JWT and upserts the user/profile rows in the backend. */
  get: (k: KyInstance) => k.get("me").json<AuthUser>(),
}
