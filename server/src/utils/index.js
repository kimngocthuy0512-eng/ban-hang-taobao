const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const MEDIA_DIR = path.join(DATA_DIR, "media");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const BLOCKED_TEXT_RE =
  /login|đăng nhập|登录|sign in|sign-in|taobao\.com|淘宝网|天貓淘寶海外|天猫淘寶海外|天猫淘宝海外/i;

const isBlockedText = (value) => {
  const cleaned = cleanText(value).toLowerCase();
  if (!cleaned) return false;
  return BLOCKED_TEXT_RE.test(cleaned);
};

const decodeEscapedText = (value) => {
  if (!value) return "";
  return String(value)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
};

const parseNumberFromText = (value) => {
  if (!value) return null;
  const match = String(value).match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const number = Number(match[1]);
  if (Number.isNaN(number) || number <= 0 || number > 1000000) return null;
  return number;
};

const normalizeImageUrl = (src, baseUrl) => {
  if (!src) return "";
  if (src.startsWith("//")) return `https:${src}`;
  try {
    return new URL(src, baseUrl).href;
  } catch (error) {
    return src;
  }
};

const pickFirst = (...values) =>
  values.find((value) => value && String(value).trim().length > 0) || "";

const getExtensionFromType = (contentType, url) => {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("image/jpeg") || type.includes("image/jpg")) return ".jpg";
  if (type.includes("image/png")) return ".png";
  if (type.includes("image/webp")) return ".webp";
  if (type.includes("image/gif")) return ".gif";
  if (type.includes("image/avif")) return ".avif";
  if (type.includes("image/svg")) return ".svg";
  try {
    const ext = path.extname(new URL(url).pathname);
    if (ext && ext.length <= 6) return ext;
  } catch (error) {
    return ".jpg";
  }
  return ".jpg";
};

const ensureUrl = (raw) => {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  let value = trimmed;
  if (trimmed.startsWith("//")) value = `https:${trimmed}`;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  return value;
};

const normalizeProductUrl = (raw) => {
  const value = ensureUrl(raw);
  if (!value) return "";
  try {
    const url = new URL(value);
    const id = url.searchParams.get("id");
    const host = url.hostname;
    if (id && /taobao|tmall/i.test(host)) {
      const canonicalHost = /tmall/i.test(host) ? "detail.tmall.com" : "item.taobao.com";
      return `https://${canonicalHost}/item.htm?id=${id}`;
    }
    return url.href;
  } catch (error) {
    return value;
  }
};

const normalizeSyncKey = (raw) => {
  const cleaned = String(raw || "default").trim();
  return cleaned || "default";
};

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
};

const ensureMediaDir = (key) => {
  ensureDataDir();
  const dir = path.join(MEDIA_DIR, key);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const ALGORITHM = "aes-256-gcm";

const encrypt = (text, encryptionKey) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(encryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decrypt = (text, encryptionKey) => {
  try {
    const [ivHex, authTagHex, encryptedHex] = text.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) return "";
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(encryptionKey), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
    return decrypted.toString();
  } catch (error)
 {
    console.warn("Failed to decrypt. It might be corrupted or using an old format.");
    return "";
  }
};

module.exports = {
  DATA_DIR,
  MEDIA_DIR,
  delay,
  cleanText,
  isBlockedText,
  decodeEscapedText,
  parseNumberFromText,
  normalizeImageUrl,
  pickFirst,
  getExtensionFromType,
  ensureUrl,
  normalizeProductUrl,
  normalizeSyncKey,
  ensureDataDir,
  ensureMediaDir,
  ensureDirExists,
  encrypt,
  decrypt,
};
