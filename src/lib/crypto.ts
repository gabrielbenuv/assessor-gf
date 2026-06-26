import crypto from "node:crypto";

function getKey(): Buffer {
  const secret = process.env.APP_SECRET || "";
  // Aceita hex de 64 chars (32 bytes) ou deriva via sha256 de qualquer string.
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, "hex");
  return crypto.createHash("sha256").update(secret).digest();
}

/** Criptografa uma string (AES-256-GCM). Formato: iv.tag.ciphertext (base64). */
export function encrypt(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

/** Descriptografa o formato gerado por encrypt(). Retorna "" se falhar. */
export function decrypt(payload: string): string {
  try {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    const key = getKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

// ===== Sessão (cookie assinado) =====

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Cria um token assinado a partir de um payload. */
export function signSession(payload: Record<string, unknown>): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(
    crypto.createHmac("sha256", getKey()).update(body).digest()
  );
  return `${body}.${sig}`;
}

/** Verifica e decodifica um token de sessão. Retorna null se inválido/expirado. */
export function verifySession<T = Record<string, unknown>>(token?: string): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(
    crypto.createHmac("sha256", getKey()).update(body).digest()
  );
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, "base64").toString("utf8"));
    if (data.exp && Date.now() > data.exp) return null;
    return data as T;
  } catch {
    return null;
  }
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}
