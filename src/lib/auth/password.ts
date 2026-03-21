import { randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

function encodeHash(salt: string, hash: Buffer) {
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

export function hashPasswordSync(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH) as Buffer;
  return encodeHash(salt, hash);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return encodeHash(salt, hash);
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, encodedHash] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !encodedHash) {
    return false;
  }

  const hash = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(encodedHash, "hex");

  if (hash.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(hash, expected);
}
