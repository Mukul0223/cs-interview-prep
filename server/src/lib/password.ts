import * as argon2 from "argon2";

export async function burnPasswordCheck(plain: string): Promise<void> {
  await verifyPassword(await dummyHash, plain);
}

export async function hashPassword(plain: string): Promise<string> {
  return await argon2.hash(plain, { type: argon2.argon2id });
}

const dummyHash = hashPassword("dummy-Password");

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
