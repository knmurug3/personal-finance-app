import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

// Its own key, separate from SESSION_SECRET, so one leaked secret doesn't expose both
// sessions and Plaid tokens, and rotating SESSION_SECRET never orphans stored tokens.
function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY || "";
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    throw new Error("ENCRYPTION_KEY must be set (64 hex chars: openssl rand -hex 32)");
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a string encrypted by `encrypt()`.
 * Returns the original plaintext or throws on tampered data.
 */
export function decrypt(encryptedString: string): string {
  const key = getKey();
  const parts = encryptedString.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted format");
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

