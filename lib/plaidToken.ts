import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

/**
 * The usable Plaid access token for a bank item. Tokens saved before encryption existed
 * are still plaintext ("access-…"); those get encrypted in place the first time they're used.
 */
export async function plaidAccessToken(item: { id: string; accessToken: string }): Promise<string> {
  if (!item.accessToken.startsWith("access-")) return decrypt(item.accessToken);
  await db.bankItem.update({ where: { id: item.id }, data: { accessToken: encrypt(item.accessToken) } });
  return item.accessToken;
}
