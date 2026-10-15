import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidSecret = process.env.PLAID_SECRET;
const plaidEnv = (process.env.PLAID_ENV || "sandbox").toLowerCase().trim();
const resolvedBasePath =
  plaidEnv === "production"
    ? PlaidEnvironments.production
    : PlaidEnvironments.sandbox;

export const isPlaidConfigured = Boolean(plaidClientId && plaidSecret);

const configuration = new Configuration({
  basePath: resolvedBasePath,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": plaidClientId || "",
      "PLAID-SECRET": plaidSecret || "",
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export type PlaidTransaction = import("plaid").Transaction;

/**
 * Pulls every change since `cursor` via /transactions/sync (null = full history).
 * Plaid can mutate data mid-pagination; on TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION
 * the whole pass restarts from the original cursor, as Plaid requires.
 */
export async function fetchTransactionChanges(accessToken: string, cursor: string | null) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const added: PlaidTransaction[] = [];
    const modified: PlaidTransaction[] = [];
    const removed: string[] = [];
    let next = cursor ?? undefined;
    try {
      for (;;) {
        const res = await plaidClient.transactionsSync({
          access_token: accessToken,
          cursor: next,
          count: 500,
        });
        added.push(...res.data.added);
        modified.push(...res.data.modified);
        removed.push(...res.data.removed.map((r) => r.transaction_id).filter(Boolean) as string[]);
        next = res.data.next_cursor;
        if (!res.data.has_more) break;
      }
      return { added, modified, removed, nextCursor: next ?? cursor ?? "" };
    } catch (err: any) {
      if (err?.response?.data?.error_code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error("Plaid transactions sync kept changing during pagination");
}
