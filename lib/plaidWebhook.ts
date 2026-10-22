import * as crypto from "crypto";
import { plaidClient } from "@/lib/plaid";

// Plaid signs webhooks with an ES256 JWT in the `Plaid-Verification` header.
// https://plaid.com/docs/api/webhooks/webhook-verification/
const keyCache = new Map<string, { key: crypto.KeyObject; fetchedAt: number }>();
const MAX_AGE_SECONDS = 5 * 60;
// Plaid rotates keys; re-fetch a cached one daily so an expired key stops being trusted
const KEY_RECHECK_MS = 24 * 60 * 60 * 1000;

function b64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export async function verifyPlaidWebhook(rawBody: string, jwt: string | null): Promise<boolean> {
  if (!jwt) return false;
  const parts = jwt.split(".");
  if (parts.length !== 3) return false;

  let header: { alg?: string; kid?: string };
  let payload: { iat?: number; request_body_sha256?: string };
  try {
    header = JSON.parse(b64url(parts[0]).toString("utf8"));
    payload = JSON.parse(b64url(parts[1]).toString("utf8"));
  } catch {
    return false;
  }
  if (header.alg !== "ES256" || !header.kid) return false;

  const cached = keyCache.get(header.kid);
  let key = cached && Date.now() - cached.fetchedAt < KEY_RECHECK_MS ? cached.key : undefined;
  if (!key) {
    const res = await plaidClient.webhookVerificationKeyGet({ key_id: header.kid });
    const jwk = res.data.key as any;
    if (jwk.expired_at) {
      keyCache.delete(header.kid);
      return false;
    }
    key = crypto.createPublicKey({ key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, format: "jwk" });
    keyCache.set(header.kid, { key, fetchedAt: Date.now() });
  }

  const signatureValid = crypto.verify(
    "sha256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    { key, dsaEncoding: "ieee-p1363" },
    b64url(parts[2])
  );
  if (!signatureValid) return false;

  if (!payload.iat || Math.abs(Date.now() / 1000 - payload.iat) > MAX_AGE_SECONDS) return false;

  const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const claimed = payload.request_body_sha256 || "";
  return claimed.length === bodyHash.length && crypto.timingSafeEqual(Buffer.from(claimed), Buffer.from(bodyHash));
}
