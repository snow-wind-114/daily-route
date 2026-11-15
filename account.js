const PASSWORD_ITERATIONS = 210000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const textEncoder = new TextEncoder();

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function normalizeUsername(value) {
  return String(value ?? "").trim();
}

export function validateAccountInput(username, password, confirmation) {
  const normalizedUsername = normalizeUsername(username);
  if (
    normalizedUsername.length < 2 ||
    normalizedUsername.length > 64
  ) {
    return "账户名必须是 2–64 个字符";
  }

  if (password.length < 6 || password.length > 64) {
    return "密码必须是 6–64 个字符";
  }

  if (confirmation !== undefined && password !== confirmation) {
    return "两次输入的密码不一致";
  }

  return null;
}

export function normalizeAccountRecord(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const username = normalizeUsername(raw.username);
  const passwordHash =
    typeof raw.passwordHash === "string" ? raw.passwordHash : "";
  const passwordSalt =
    typeof raw.passwordSalt === "string" ? raw.passwordSalt : "";
  const passwordIterations = Number(raw.passwordIterations);
  const createdAt =
    typeof raw.createdAt === "string" ? raw.createdAt : "";

  if (
    username.length < 2 ||
    username.length > 64 ||
    !passwordHash ||
    !passwordSalt ||
    !Number.isInteger(passwordIterations) ||
    passwordIterations < 1 ||
    !createdAt
  ) {
    return null;
  }

  try {
    if (
      base64ToBytes(passwordSalt).length !== SALT_BYTES ||
      base64ToBytes(passwordHash).length !== HASH_BITS / 8
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    username,
    passwordHash,
    passwordSalt,
    passwordIterations,
    createdAt,
  };
}

async function derivePasswordHash(
  password,
  salt,
  iterations,
  cryptoImpl,
) {
  const keyMaterial = await cryptoImpl.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await cryptoImpl.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    keyMaterial,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

function hashesMatch(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function createLocalAccount(
  { username, password },
  {
    cryptoImpl = globalThis.crypto,
    iterations = PASSWORD_ITERATIONS,
    now = new Date(),
  } = {},
) {
  if (!cryptoImpl?.subtle || !cryptoImpl?.getRandomValues) {
    throw new Error("当前环境不支持安全密码存储");
  }

  const validationError = validateAccountInput(username, password);
  if (validationError) {
    throw new Error(validationError);
  }

  const salt = cryptoImpl.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derivePasswordHash(
    password,
    salt,
    iterations,
    cryptoImpl,
  );

  return {
    username: normalizeUsername(username),
    passwordHash: bytesToBase64(hash),
    passwordSalt: bytesToBase64(salt),
    passwordIterations: iterations,
    createdAt: now.toISOString(),
  };
}

export async function verifyAccountPassword(
  account,
  password,
  { cryptoImpl = globalThis.crypto } = {},
) {
  const normalized = normalizeAccountRecord(account);
  if (!normalized || !cryptoImpl?.subtle) {
    return false;
  }

  const actual = await derivePasswordHash(
    password,
    base64ToBytes(normalized.passwordSalt),
    normalized.passwordIterations,
    cryptoImpl,
  );
  return hashesMatch(
    actual,
    base64ToBytes(normalized.passwordHash),
  );
}

export async function updateAccountPassword(
  account,
  password,
  options,
) {
  const normalized = normalizeAccountRecord(account);
  if (!normalized) {
    throw new Error("账户数据无效");
  }

  return createLocalAccount(
    { username: normalized.username, password },
    {
      ...options,
      now: new Date(normalized.createdAt),
    },
  );
}

export { PASSWORD_ITERATIONS };
