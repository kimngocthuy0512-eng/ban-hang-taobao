const express = require("express");
require("dotenv").config();
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 8787;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const BLOCKED_RE = /Access denied|访问被拒绝|安全验证|人机验证|验证码|请先登录|登录|security verification|请开启 JavaScript/i;
const DATA_DIR = path.join(__dirname, "data");
const SYNC_STORE = path.join(DATA_DIR, "sync.json");
const MEDIA_DIR = path.join(DATA_DIR, "media");
const MEDIA_MAP = path.join(DATA_DIR, "media-map.json");
const AUTO_IMPORT_LOG = path.join(DATA_DIR, "taobao-auto.log");
const AUTO_IMPORT_PAGES_FILE = path.join(DATA_DIR, "taobao-pages.txt");
const AUTO_IMPORT_LOG_LINES = 200;
const TAOBAO_LOGIN_URL = process.env.TAOBAO_LOGIN_URL || "https://login.taobao.com/";
const TAOBAO_PROFILE_DIR = path.join(DATA_DIR, "taobao-profile");
const TAOBAO_COOKIE_FILE = path.join(DATA_DIR, "taobao-cookie.txt");
const TAOBAO_LOGIN_TIMEOUT_MS = Math.max(
  Number(process.env.TAOBAO_LOGIN_TIMEOUT || 5 * 60 * 1000),
  5000
);
const TAOBAO_LOGIN_MIN_WAIT_MS = Math.max(
  Number(process.env.TAOBAO_LOGIN_MIN_WAIT || 60 * 1000),
  5000
);
const TAOBAO_LOGIN_LOG_INTERVAL_MS = 5000;
const TAOBAO_LOGIN_IDLE_DELAY_MS = 2000;
const TAOBAO_COOKIE_DOMAIN_RE = /taobao|tmall|tb\.cn/i;
const TAOBAO_COOKIE_KEY_RE = /(tracknick|lgc|cookie2|_nk_)/i;

let autoImportProcess = null;
let autoImportLogStream = null;
let autoImportState = {
  running: false,
  startedAt: null,
  endedAt: null,
  pid: null,
  exitCode: null,
  message: "idle",
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

const SHOP_SORT_OPTIONS = [
  { value: "new", label: "Mới nhất" },
  { value: "price-asc", label: "Giá tăng" },
  { value: "price-desc", label: "Giá giảm" },
];

const SHOP_VIEW_MODES = ["grid", "compact", "list"];

const createEmptySnapshot = () => ({
  meta: { updatedAt: new Date(0).toISOString() },
  settings: {},
  products: [],
  orders: [],
  customers: {},
});

const getSnapshotForKey = (key) => {
  const store = loadSyncStore();
  return store[key] || createEmptySnapshot();
};

const formatMetadataLabel = (value) => {
  if (!value) return "";
  return String(value)
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
};

const sortSizesForMetadata = (sizes = []) => {
  const numeric = [];
  const alpha = [];
  sizes.forEach((size) => {
    const normalized = String(size || "").trim();
    if (!normalized) return;
    if (/^\d+(\.\d+)?$/.test(normalized)) {
      numeric.push(Number(normalized));
      return;
    }
    alpha.push(normalized);
  });
  const sortedNumeric = [...new Set(numeric)].sort((a, b) => a - b).map((value) => String(value));
  const sortedAlpha = Array.from(new Set(alpha)).sort((a, b) => a.localeCompare(b, "vi"));
  return [...sortedNumeric, ...sortedAlpha];
};

const ORDER_STORE_FILE = path.join(DATA_DIR, "shop-store.json");
const RATE_API_URL = "https://api.exchangerate.host/latest?base=CNY&symbols=JPY,VND";
const RATE_REFRESH_MS = Number(process.env.RATE_REFRESH_MS || 5 * 60 * 1000);
const DEFAULT_STORE = {
  customers: {},
  orders: [],
  rates: {
    JPY: { value: 21.5, updatedAt: new Date().toISOString() },
    VND: { value: 3600, updatedAt: new Date().toISOString() },
  },
};

const fetchJson = (url, timeout = 8000) =>
  new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Failed to fetch rates (${res.statusCode})`));
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Request timeout"));
    });
  });

const loadOrderStore = () => {
  ensureDataDir();
  if (!fs.existsSync(ORDER_STORE_FILE)) {
    return { ...DEFAULT_STORE };
  }
  try {
    const raw = fs.readFileSync(ORDER_STORE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STORE,
      ...parsed,
      rates: {
        ...DEFAULT_STORE.rates,
        ...(parsed.rates || {}),
      },
    };
  } catch (error) {
    console.warn("Failed to load store", error);
    return { ...DEFAULT_STORE };
  }
};

const saveOrderStore = (payload) => {
  ensureDataDir();
  fs.writeFileSync(ORDER_STORE_FILE, JSON.stringify(payload, null, 2));
  return payload;
};

const normalizeOrders = (orders) =>
  (Array.isArray(orders) ? orders : []).map((order) => ({
    ...order,
    createdAt: order.createdAt || new Date().toISOString(),
  }));

const buildOrderId = () => `ORD-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

const buildCustomerCode = (fingerprint) =>
  crypto.createHash("sha1").update(String(fingerprint || crypto.randomBytes(8).toString("hex"))).digest("hex").slice(0, 8).toUpperCase();

const getVisitorFingerprint = (req) => {
  const forwarded = req.headers["x-forwarded-for"] || "";
  const ip =
    forwarded.split(",").map((part) => part.trim()).find(Boolean) ||
    req.socket.remoteAddress ||
    req.ip ||
    "0.0.0.0";
  const ua = req.headers["user-agent"] || "";
  return `${ip}|${ua}`;
};

let rateRefreshTimer = null;

const refreshRates = async () => {
  const store = loadOrderStore();
  try {
    const json = await fetchJson(RATE_API_URL);
    const rates = json?.rates || {};
    const now = new Date().toISOString();
    const nextRates = {
      JPY: { value: Number(rates.JPY || DEFAULT_STORE.rates.JPY.value), updatedAt: now },
      VND: { value: Number(rates.VND || DEFAULT_STORE.rates.VND.value), updatedAt: now },
    };
    store.rates = nextRates;
    saveOrderStore(store);
    return nextRates;
  } catch (error) {
    console.warn("Rate refresh failed", error.message);
    return store.rates;
  }
};

const buildShopMetadata = (snapshot) => {
  const products = Array.isArray(snapshot?.products) ? snapshot.products : [];
  const categoryMap = new Map();
  const sizeCollector = [];
  const tagSet = new Set();
  products.forEach((product) => {
    const category = String(product?.category || "").trim();
    if (category && !categoryMap.has(category)) {
      categoryMap.set(category, {
        value: category,
        label: formatMetadataLabel(category),
      });
    }
    const variantSizes = [
      ...(product?.sizesText || []),
      ...(product?.sizesNum || []),
      ...(Array.isArray(product?.sizes) ? product.sizes : []),
    ];
    variantSizes.forEach((size) => {
      const normalized = String(size || "").trim();
      if (normalized) {
        sizeCollector.push(normalized);
      }
    });
    (product?.tags || []).forEach((tag) => {
      const normalized = String(tag || "").trim();
      if (normalized) {
        tagSet.add(normalized);
      }
    });
  });
  const categories = Array.from(categoryMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "vi")
  );
  const sizes = sortSizesForMetadata(sizeCollector);
  const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, "vi"));
  return {
    categories,
    sizes,
    tags,
    sortOptions: SHOP_SORT_OPTIONS,
    viewModes: SHOP_VIEW_MODES,
  };
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const appendLogHeader = () => {
  if (!autoImportLogStream) return;
  autoImportLogStream.write(`\n----- ${new Date().toISOString()} -----\n`);
};

const writeLogFooter = (note) => {
  if (!autoImportLogStream) return;
  autoImportLogStream.write(`----- ${note} -----\n\n`);
};

const closeAutoImportStream = () => {
  if (!autoImportLogStream) return;
  autoImportLogStream.end();
  autoImportLogStream = null;
};

const readAutoImportLogTail = () => {
  try {
    const raw = fs.readFileSync(AUTO_IMPORT_LOG, "utf-8");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.slice(-AUTO_IMPORT_LOG_LINES).join("\n");
  } catch (error) {
    return "";
  }
};

const readAutoImportPages = () => {
  try {
    const raw = fs.readFileSync(AUTO_IMPORT_PAGES_FILE, "utf-8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    return [];
  }
};

const saveAutoImportPages = (pages) => {
  ensureDataDir();
  fs.writeFileSync(AUTO_IMPORT_PAGES_FILE, pages.join("\n"));
};

const normalizePageInput = (payload) => {
  const candidates = [];
  if (Array.isArray(payload?.pages)) candidates.push(...payload.pages);
  if (typeof payload?.pages === "string") candidates.push(payload.pages);
  if (typeof payload?.pagesRaw === "string") candidates.push(payload.pagesRaw);
  if (typeof payload?.raw === "string") candidates.push(payload.raw);
  if (typeof payload?.text === "string") candidates.push(payload.text);
  const seen = new Set();
  const pages = [];
  candidates.forEach((value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return;
    trimmed
      .split(/\n+/)
      .map((entry) => ensureUrl(entry))
      .filter(Boolean)
      .forEach((url) => {
        if (seen.has(url)) return;
        seen.add(url);
        pages.push(url);
      });
  });
  return pages;
};

const spawnAutoImport = () => {
  ensureDataDir();
  autoImportLogStream = fs.createWriteStream(AUTO_IMPORT_LOG, { flags: "a" });
  appendLogHeader();
  const startedAt = new Date().toISOString();
  const env = {
    ...process.env,
    TAOBAO_CRAWL: "1",
    TAOBAO_WAIT_LOGIN: "1",
    TAOBAO_PAGES_FILE: AUTO_IMPORT_PAGES_FILE,
    IMPORT_ENDPOINT: `http://localhost:${PORT}/import`,
    SYNC_ENDPOINT: `http://localhost:${PORT}/sync`,
    SYNC_KEY: process.env.SYNC_KEY || "orderhub-main",
  };
  let child;
  try {
    child = spawn("node", ["scripts/taobao-playwright-import.js"], {
      cwd: __dirname,
      env,
    });
  } catch (error) {
    writeLogFooter(`start failed: ${error.message}`);
    closeAutoImportStream();
    throw error;
  }
  autoImportProcess = child;
  autoImportState = {
    running: true,
    startedAt,
    endedAt: null,
    pid: child.pid,
    exitCode: null,
    message: "running",
  };
  const pipeStream = (stream) => {
    stream.on("data", (chunk) => {
      if (autoImportLogStream) autoImportLogStream.write(chunk);
    });
  };
  pipeStream(child.stdout);
  pipeStream(child.stderr);
  child.on("close", (code, signal) => {
    const exitCode =
      typeof code === "number" ? code : signal ? `signal:${signal}` : "unknown";
    autoImportState = {
      running: false,
      startedAt,
      endedAt: new Date().toISOString(),
      pid: child.pid,
      exitCode,
      message: code === 0 ? "completed" : `failed${code ? ` (${code})` : signal ? ` (${signal})` : ""}`,
    };
    writeLogFooter(autoImportState.message);
    closeAutoImportStream();
    autoImportProcess = null;
  });
  child.on("error", (error) => {
    autoImportState = {
      running: false,
      startedAt,
      endedAt: new Date().toISOString(),
      pid: child.pid,
      exitCode: `error:${error.code || -1}`,
      message: `error: ${error.message}`,
    };
    writeLogFooter(autoImportState.message);
    closeAutoImportStream();
    autoImportProcess = null;
  });
  return child;
};

const loadSyncStore = () => {
  try {
    const raw = fs.readFileSync(SYNC_STORE, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
};

const saveSyncStore = (payload) => {
  ensureDataDir();
  fs.writeFileSync(SYNC_STORE, JSON.stringify(payload, null, 2));
};

const loadMediaMap = () => {
  try {
    const raw = fs.readFileSync(MEDIA_MAP, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
};

const saveMediaMap = (payload) => {
  ensureDataDir();
  fs.writeFileSync(MEDIA_MAP, JSON.stringify(payload, null, 2));
};

const normalizeSyncKey = (raw) => {
  const cleaned = String(raw || "default").trim();
  return cleaned || "default";
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

const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const BLOCKED_TEXT_RE =
  /login|đăng nhập|登录|sign in|sign-in|taobao\.com|淘宝网|天貓淘寶海外|天猫淘寶海外|天猫淘宝海外/i;

const isBlockedText = (value) => {
  const cleaned = cleanText(value).toLowerCase();
  if (!cleaned) return false;
  return BLOCKED_TEXT_RE.test(cleaned);
};

const sanitizeBlockedData = (data, blocked) => {
  if (!blocked || !data) return data;
  const next = { ...data };
  if (isBlockedText(next.name)) next.name = "";
  if (isBlockedText(next.desc)) next.desc = "";
  next.image = "";
  next.images = [];
  next.rating = null;
  next.ratingCount = null;
  next.positiveRate = null;
  next.soldCount = null;
  return next;
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

const extractSizesFromProps = (props) => {
  if (!Array.isArray(props)) return [];
  const sizeProp = props.find((prop) =>
    /size|尺码|kích cỡ/i.test(
      prop?.name || prop?.propName || prop?.title || prop?.text || ""
    )
  );
  if (!sizeProp) return [];
  const values = sizeProp.values || sizeProp.value || sizeProp.options || [];
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => value?.name || value?.text || value?.title || value?.value || "")
    .filter(Boolean)
    .map((value) => String(value).trim());
};

const parseSkuSizes = (html) => {
  const sizes = new Set();
  const pushSize = (value) => {
    const cleaned = cleanText(decodeEscapedText(value));
    if (!cleaned || cleaned.length > 12) return;
    sizes.add(cleaned);
  };
  const addSizes = (items) => {
    if (!items) return;
    items.forEach((value) => pushSize(value));
  };
  const parsePropsRaw = (raw) => {
    if (!raw) return;
    try {
      const props = JSON.parse(raw);
      if (Array.isArray(props)) addSizes(extractSizesFromProps(props));
      if (Array.isArray(props?.props)) addSizes(extractSizesFromProps(props.props));
    } catch (error) {
      // ignore JSON parse errors
    }
  };
  const propsMatch = html.match(/["']skuProps["']\s*:\s*(\[[\s\S]*?\])\s*(?:,|\}|\])/);
  const propsAltMatch = html.match(/["']props["']\s*:\s*(\[[\s\S]*?\])\s*(?:,|\}|\])/);
  parsePropsRaw(propsMatch?.[1]);
  parsePropsRaw(propsAltMatch?.[1]);
  const sectionRegex =
    /["'](?:name|propName)["']\s*:\s*["'](?:size|尺码|kích cỡ)["'][\s\S]{0,3000}?["']values["']\s*:\s*(\[[\s\S]*?\])/gi;
  for (const match of html.matchAll(sectionRegex)) {
    const valuesRaw = match[1];
    if (!valuesRaw) continue;
    const valueRegex =
      /["'](?:name|text|title|value)["']\s*:\s*["']([^"']{1,16})["']/gi;
    for (const valueMatch of valuesRaw.matchAll(valueRegex)) {
      pushSize(valueMatch[1]);
    }
  }
  return Array.from(sizes);
};

const parseScriptData = (html) => {
  const matchValue = (...regexes) => {
    for (const regex of regexes) {
      const match = html.match(regex);
      if (match && match[1]) return decodeEscapedText(match[1]);
    }
    return "";
  };
  const title = matchValue(
    /"itemTitle"\s*:\s*"([^"]{2,})"/,
    /'itemTitle'\s*:\s*'([^']{2,})'/,
    /"mainTitle"\s*:\s*"([^"]{2,})"/,
    /'mainTitle'\s*:\s*'([^']{2,})'/,
    /"title"\s*:\s*"([^"]{2,})"/,
    /'title'\s*:\s*'([^']{2,})'/
  );
  const subtitle = matchValue(
    /"subTitle"\s*:\s*"([^"]+)"/,
    /'subTitle'\s*:\s*'([^']+)'/,
    /"subtitle"\s*:\s*"([^"]+)"/,
    /'subtitle'\s*:\s*'([^']+)'/,
    /"desc"\s*:\s*"([^"]+)"/,
    /'desc'\s*:\s*'([^']+)'/
  );
  const pic = matchValue(
    /"pic"\s*:\s*"([^"]+)"/,
    /'pic'\s*:\s*'([^']+)'/,
    /"picUrl"\s*:\s*"([^"]+)"/,
    /'picUrl'\s*:\s*'([^']+)'/,
    /"image"\s*:\s*"([^"]+)"/,
    /'image'\s*:\s*'([^']+)'/
  );
  const priceText = matchValue(
    /"itemPrice"\s*:\s*"([0-9.]+)"/,
    /'itemPrice'\s*:\s*'([0-9.]+)'/,
    /"price"\s*:\s*"([0-9.]+)"/,
    /'price'\s*:\s*'([0-9.]+)'/
  );
  const price = parseNumberFromText(priceText);
  let picsMatch =
    html.match(/"picsPath"\s*:\s*\[([^\]]+)\]/) ||
    html.match(/'picsPath'\s*:\s*\[([^\]]+)\]/);
  const images = new Set();
  if (picsMatch) {
    picsMatch[1]
      .split(",")
      .map((entry) => entry.trim().replace(/^"|"$/g, ""))
      .map(decodeEscapedText)
      .filter(Boolean)
      .forEach((src) => images.add(src));
  }
  if (images.size === 0) {
    picsMatch = html.match(/Hub\.config\.get\('propertyPics'\)\s*:\s*(\{[\s\S]*?\})\s*,/);
    if (picsMatch) {
      try {
        const propertyPics = JSON.parse(picsMatch[1]);
        for (const key in propertyPics) {
          if (Array.isArray(propertyPics[key])) {
            propertyPics[key].forEach(pic => images.add(pic));
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }

  if (images.size === 0) {
    const galleryMatch = html.match(/<div[^>]+id="J_UlThumb"[^>]*>([\s\S]+?)<\/div>/);
    if (galleryMatch) {
      const imageRegex = /<img[^>]+src="([^"]+)"/g;
      let match;
      while ((match = imageRegex.exec(galleryMatch[1])) !== null) {
        images.add(match[1].replace(/_\d+x\d+\.jpg$/, ''));
      }
    }
  }


  return {
    title,
    subtitle,
    pic,
    price,
    images: Array.from(images),
  };
};

const parseJsonLdProduct = (html) => {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of matches) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const type = Array.isArray(item["@type"]) ? item["@type"].join(",") : item["@type"];
        if (!type || !String(type).toLowerCase().includes("product")) continue;
        const offers = item.offers || {};
        const offer = Array.isArray(offers) ? offers[0] || {} : offers;
        const price =
          offer.price || offer.priceSpecification?.price || offer.priceSpecification?.minPrice;
        const image = Array.isArray(item.image) ? item.image[0] : item.image;
        const aggregate = item.aggregateRating || {};
        const rating = parseNumberFromText(aggregate.ratingValue);
        const ratingCount = parseInt(
          aggregate.reviewCount || aggregate.ratingCount || aggregate.reviewCount,
          10
        );
        return {
          name: item.name || "",
          desc: item.description || "",
          image: image || "",
          price: parseNumberFromText(price),
          rating,
          ratingCount: Number.isNaN(ratingCount) ? null : ratingCount,
        };
      }
    } catch (error) {
      // ignore JSON-LD errors
    }
  }
  return { name: "", desc: "", image: "", price: null, rating: null, ratingCount: null };
};

const parseQualitySignals = (html) => {
  const ratings = [];
  const ratingCounts = [];
  const positiveRates = [];
  const soldCounts = [];
  const pushRating = (value) => {
    const parsed = parseNumberFromText(value);
    if (!parsed) return;
    if (parsed <= 5) ratings.push(parsed);
  };
  const pushRate = (value) => {
    const parsed = parseNumberFromText(value);
    if (!parsed) return;
    let rate = parsed;
    if (rate > 1) rate = rate / 100;
    if (rate <= 1) positiveRates.push(rate);
  };
  const pushCount = (list, value) => {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed > 0) list.push(parsed);
  };
  const applyRegexList = (regexes, handler) => {
    regexes.forEach((regex) => {
      for (const match of html.matchAll(regex)) {
        if (match[1]) handler(match[1]);
      }
    });
  };
  applyRegexList(
    [
      /"ratingValue"\s*:\s*"?([0-9.]+)"?/gi,
      /"avgStar"\s*:\s*"?([0-9.]+)"?/gi,
      /"rateScore"\s*:\s*"?([0-9.]+)"?/gi,
      /"commentScore"\s*:\s*"?([0-9.]+)"?/gi,
      /"rating"\s*:\s*"?([0-9.]+)"?/gi,
    ],
    pushRating
  );
  applyRegexList(
    [
      /"goodRatePercent"\s*:\s*"?([0-9.]+)"?/gi,
      /"goodRate"\s*:\s*"?([0-9.]+)"?/gi,
      /"positiveRate"\s*:\s*"?([0-9.]+)"?/gi,
      /"praiseRate"\s*:\s*"?([0-9.]+)"?/gi,
      /"favorableRate"\s*:\s*"?([0-9.]+)"?/gi,
    ],
    pushRate
  );
  applyRegexList(
    [
      /"rateCount"\s*:\s*"?([0-9]+)"?/gi,
      /"commentCount"\s*:\s*"?([0-9]+)"?/gi,
      /"reviewCount"\s*:\s*"?([0-9]+)"?/gi,
      /"ratingCount"\s*:\s*"?([0-9]+)"?/gi,
    ],
    (value) => pushCount(ratingCounts, value)
  );
  applyRegexList(
    [
      /"sellCount"\s*:\s*"?([0-9]+)"?/gi,
      /"soldCount"\s*:\s*"?([0-9]+)"?/gi,
      /"tradeCount"\s*:\s*"?([0-9]+)"?/gi,
      /"dealCount"\s*:\s*"?([0-9]+)"?/gi,
      /"salesCount"\s*:\s*"?([0-9]+)"?/gi,
      /"totalSoldQuantity"\s*:\s*"?([0-9]+)"?/gi,
    ],
    (value) => pushCount(soldCounts, value)
  );
  const rating = ratings.length ? Math.max(...ratings) : null;
  const ratingCount = ratingCounts.length ? Math.max(...ratingCounts) : null;
  const positiveRate = positiveRates.length ? Math.max(...positiveRates) : null;
  const soldCount = soldCounts.length ? Math.max(...soldCounts) : null;
  return {
    rating,
    ratingCount,
    positiveRate,
    soldCount,
  };
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

const cacheImage = async (sourceUrl, key, req, mediaMap) => {
  const normalized = ensureUrl(sourceUrl);
  if (!normalized) throw new Error("invalid_url");
  const keyMap = mediaMap[key] || {};
  const cachedEntry = keyMap[normalized];
  if (cachedEntry?.file) {
    const filePath = path.join(MEDIA_DIR, key, cachedEntry.file);
    if (fs.existsSync(filePath)) {
      return `${req.protocol}://${req.get("host")}/media/${key}/${cachedEntry.file}`;
    }
  }

  const response = await fetch(normalized, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error("download_failed");
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error("not_image");
  const buffer = Buffer.from(await response.arrayBuffer());
  const ext = getExtensionFromType(contentType, normalized);
  const hash = crypto.createHash("sha1").update(normalized).digest("hex");
  const filename = `${hash}${ext}`;
  const dir = ensureMediaDir(key);
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, buffer);
  }
  keyMap[normalized] = {
    file: filename,
    cachedAt: new Date().toISOString(),
    contentType,
  };
  mediaMap[key] = keyMap;
  return `${req.protocol}://${req.get("host")}/media/${key}/${filename}`;
};

const extractFromHtml = (html, sourceUrl, domData) => {
  const jsonLd = parseJsonLdProduct(html);
  const scriptData = parseScriptData(html);
  const quality = parseQualitySignals(html);
  const titleRaw = pickFirst(
    domData?.title,
    jsonLd.name,
    scriptData.title
  );
  const descRaw = pickFirst(domData?.desc, jsonLd.desc, scriptData.subtitle);
  const imageRaw = pickFirst(domData?.image, jsonLd.image, scriptData.pic, scriptData.images[0]);
  const priceCandidates = [
    jsonLd.price,
    scriptData.price,
    html.match(/"itemPrice"\s*:\s*"([0-9.]+)"/)?.[1],
    html.match(/"price"\s*:\s*"([0-9.]+)"/)?.[1],
    html.match(/"defaultItemPrice"\s*:\s*"([0-9.]+)"/)?.[1],
    html.match(/data-price="([0-9.]+)"/)?.[1],
  ];
  const price = priceCandidates.map(parseNumberFromText).find((value) => value);
  const skuSizes = parseSkuSizes(html);
  const sizes = Array.from(new Set([...(domData?.sizes || []), ...skuSizes]));
  const ratingCandidates = [jsonLd.rating, quality.rating]
    .map((value) => parseNumberFromText(value))
    .filter((value) => value && value <= 5);
  const rating = ratingCandidates.length ? Math.max(...ratingCandidates) : null;
  const ratingCountCandidates = [jsonLd.ratingCount, quality.ratingCount]
    .map((value) => parseInt(value, 10))
    .filter((value) => !Number.isNaN(value) && value > 0);
  const ratingCount = ratingCountCandidates.length ? Math.max(...ratingCountCandidates) : null;
  return {
    name: cleanText(titleRaw),
    desc: cleanText(descRaw),
    image: normalizeImageUrl(imageRaw, sourceUrl),
    price,
    sizes,
    images: scriptData.images.map((src) => normalizeImageUrl(src, sourceUrl)).filter(Boolean),
    rating,
    ratingCount,
    positiveRate: quality.positiveRate ?? null,
    soldCount: quality.soldCount ?? null,
  };
};

const parseCookieHeader = (cookieHeader, url) => {
  if (!cookieHeader) return [];
  const cookies = [];
  const parsed = new URL(url);
  cookieHeader.split(";").forEach((pair) => {
    const [name, ...rest] = pair.split("=");
    const value = rest.join("=");
    if (!name || !value) return;
    cookies.push({
      name: name.trim(),
      value: value.trim(),
      domain: parsed.hostname,
      path: "/",
    });
  });
  return cookies;
};

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = "aes-256-gcm";

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  console.error("Fatal: ENCRYPTION_KEY is not defined or is not 32 characters long.");
  process.exit(1);
}

const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decrypt = (text) => {
  try {
    const [ivHex, authTagHex, encryptedHex] = text.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) return "";
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.warn("Failed to decrypt cookie file. It might be corrupted or using an old format.");
    return "";
  }
};

const loadTaobaoCookie = () => {
  try {
    if (!fs.existsSync(TAOBAO_COOKIE_FILE)) return "";
    const encrypted = fs.readFileSync(TAOBAO_COOKIE_FILE, "utf-8").trim();
    if (!encrypted) return "";
    return decrypt(encrypted);
  } catch (error) {
    return "";
  }
};

const saveTaobaoCookie = (value) => {
  ensureDataDir();
  const encrypted = encrypt(value);
  fs.writeFileSync(TAOBAO_COOKIE_FILE, encrypted);
};

const fetchProductData = async ({ url, cookies, cookie }) => {
  const normalized = normalizeProductUrl(url);
  if (!normalized) throw new Error("invalid_url");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: "zh-CN",
    viewport: { width: 1280, height: 720 },
  });

  try {
    const appliedCookies = [];
    if (Array.isArray(cookies) && cookies.length) {
      appliedCookies.push(...cookies);
    } else if (cookie) {
      appliedCookies.push(...parseCookieHeader(cookie, normalized));
    }
    if (!appliedCookies.length) {
      const savedCookie = loadTaobaoCookie();
      if (savedCookie) {
        appliedCookies.push(...parseCookieHeader(savedCookie, normalized));
      }
    }
    if (appliedCookies.length) {
      await context.addCookies(appliedCookies);
    }

    const page = await context.newPage();
    await page.goto(normalized, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);

    const domData = await page.evaluate(() => {
      const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const pick = (...values) => values.find((value) => value && value.trim().length > 0) || "";
      const text = (selector) => document.querySelector(selector)?.textContent || "";
      const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) || "";
      const pushSize = (target, value) => {
        const cleaned = clean(value);
        if (!cleaned || cleaned.length > 12) return;
        target.push(cleaned);
      };
      const scanOptions = (target, container) => {
        if (!container) return;
        container.querySelectorAll("li, a, span, option, button").forEach((el) => {
          const value =
            el.getAttribute("title") ||
            el.getAttribute("data-value") ||
            el.getAttribute("value") ||
            el.textContent;
          pushSize(target, value);
        });
      };
      const title = pick(
        attr("meta[property='og:title']", "content"),
        attr("meta[name='twitter:title']", "content"),
        attr("meta[name='title']", "content"),
        attr("[itemprop='name']", "content"),
        text(".tb-main-title"),
        text(".item-title"),
        text("h1"),
        document.title
      );
      const desc = pick(
        attr("meta[property='og:description']", "content"),
        attr("meta[name='description']", "content"),
        attr("[itemprop='description']", "content"),
        text(".tb-subtitle")
      );
      const image = pick(
        attr("meta[property='og:image']", "content"),
        attr("meta[name='twitter:image']", "content"),
        attr("#J_ImgBooth", "data-src"),
        attr("#J_ImgBooth", "src"),
        attr(".tb-main-pic img", "data-src"),
        attr(".tb-main-pic img", "src")
      );
      const sizes = [];
      document.querySelectorAll("[data-property]").forEach((node) => {
        const prop = node.getAttribute("data-property") || "";
        if (!/size|尺码|kích cỡ/i.test(prop)) return;
        scanOptions(sizes, node);
      });
      document
        .querySelectorAll("#J_isku, .tb-sku, .sku, .sku-prop, .J_Prop, .tb-prop")
        .forEach((node) => scanOptions(sizes, node));
      document.querySelectorAll("dt, label, span, div").forEach((node) => {
        const label = clean(node.textContent);
        if (!/size|尺码|kích cỡ/i.test(label)) return;
        const container =
          node.closest("dl, .tb-prop, .J_Prop, .tb-sku, .sku") || node.parentElement;
        scanOptions(sizes, container);
      });
      return { title: clean(title), desc: clean(desc), image, sizes };
    });

    const html = await page.content();
    const blocked = BLOCKED_RE.test(html);
    const data = sanitizeBlockedData(
      extractFromHtml(html, normalized, domData),
      blocked
    );
    return { data, url: normalized, blocked };
  } finally {
    await context.close();
    await browser.close();
  }
};

let taobaoLoginInProgress = false;

const launchTaobaoLoginContext = async () => {
  ensureDirExists(TAOBAO_PROFILE_DIR);
  return chromium.launchPersistentContext(TAOBAO_PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox"],
  });
};

const waitForTaobaoLoginCookie = async (context, timeoutMs = TAOBAO_LOGIN_TIMEOUT_MS) => {
  const start = Date.now();
  let lastLog = 0;
  while (Date.now() - start < timeoutMs) {
    let cookies = [];
    try {
      cookies = await context.cookies();
    } catch (error) {
      return null;
    }
    const loggedIn = cookies.some(
      (cookie) =>
        TAOBAO_COOKIE_DOMAIN_RE.test(cookie.domain) && TAOBAO_COOKIE_KEY_RE.test(cookie.name)
    );
    if (loggedIn && Date.now() - start >= TAOBAO_LOGIN_MIN_WAIT_MS) {
      return cookies;
    }
    if (Date.now() - lastLog > TAOBAO_LOGIN_LOG_INTERVAL_MS) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      const remaining = Math.max(0, Math.round((timeoutMs - (Date.now() - start)) / 1000));
      console.log(`...đang chờ đăng nhập Taobao (${elapsed}s, còn ${remaining}s)`);
      lastLog = Date.now();
    }
    await delay(TAOBAO_LOGIN_IDLE_DELAY_MS);
  }
  return null;
};

const initRateRefresh = async () => {
  await refreshRates();
  if (rateRefreshTimer) clearInterval(rateRefreshTimer);
  rateRefreshTimer = setInterval(() => {
    refreshRates().catch((error) => {
      console.warn("Rate refresh error:", error.message);
    });
  }, RATE_REFRESH_MS);
};

initRateRefresh().catch((error) => {
  console.warn("Failed to initialize rates", error.message);
});

app.use("/media", express.static(MEDIA_DIR, { maxAge: "365d", etag: true }));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "orderhub-importer" });
});

app.get("/sync", (req, res) => {
  const key = normalizeSyncKey(req.query.key);
  const snapshot = getSnapshotForKey(key);
  res.json(snapshot);
});

app.get("/metadata", (req, res) => {
  const key = normalizeSyncKey(req.query.key);
  const snapshot = getSnapshotForKey(key);
  const metadata = buildShopMetadata(snapshot);
  res.json({ ok: true, metadata });
});

app.post("/sync", (req, res) => {
  const key = normalizeSyncKey(req.query.key);
  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    res.status(400).json({ ok: false, message: "Invalid payload" });
    return;
  }
  const store = loadSyncStore();
  const meta = payload.meta || {};
  store[key] = {
    ...payload,
    meta: {
      ...meta,
      updatedAt: meta.updatedAt || new Date().toISOString(),
    },
  };
  saveSyncStore(store);
  res.json({ ok: true, key, updatedAt: store[key].meta.updatedAt });
});

const buildCustomerRecord = (store, code, fingerprint, req) => {
  const previous = store.customers[code] || {};
  const now = new Date().toISOString();
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",").map((ip) => ip.trim()).find(Boolean) ||
    req.socket.remoteAddress ||
    req.ip ||
    "0.0.0.0";
  store.customers[code] = {
    code,
    fingerprint,
    ip,
    userAgent: req.headers["user-agent"] || "",
    lastSeen: now,
    visits: (previous.visits || 0) + 1,
    orders: previous.orders || [],
  };
  return store.customers[code];
};

const appendOrderNote = (order, note) => {
  if (!note) return;
  if (!order.notes) order.notes = [];
  order.notes.push({
    id: crypto.randomBytes(4).toString("hex"),
    text: note,
    createdAt: new Date().toISOString(),
    type: "system",
  });
};

app.get("/visitor-code", (req, res) => {
  const fingerprint = getVisitorFingerprint(req);
  const code = buildCustomerCode(fingerprint);
  const store = loadOrderStore();
  buildCustomerRecord(store, code, fingerprint, req);
  saveOrderStore(store);
  res.json({ ok: true, code });
});

app.get("/rates", (req, res) => {
  const store = loadOrderStore();
  res.json({ ok: true, rates: store.rates });
});

app.post("/rates/refresh", async (req, res) => {
  const updated = await refreshRates();
  res.json({ ok: true, rates: updated });
});

const ORDER_STATUS = {
  PENDING_QUOTE: "PENDING_QUOTE",
  QUOTED_WAITING_PAYMENT: "QUOTED_WAITING_PAYMENT",
  PAYMENT_UNDER_REVIEW: "PAYMENT_UNDER_REVIEW",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
};

app.post("/orders", (req, res) => {
  const payload = req.body || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) {
    res.status(400).json({ ok: false, message: "Không có sản phẩm nào" });
    return;
  }
  const fingerprint = getVisitorFingerprint(req);
  const customerCode = payload.customerCode || buildCustomerCode(fingerprint);
  const store = loadOrderStore();
  const customer = buildCustomerRecord(store, customerCode, fingerprint, req);
  const now = new Date().toISOString();
  const order = {
    id: buildOrderId(),
    customerCode,
    createdAt: now,
    status: ORDER_STATUS.PENDING_QUOTE,
    paymentStatus: "NOT_PAID",
    device: {
      ip: customer.ip,
      userAgent: customer.userAgent,
    },
    customer: {
      name: payload.customer?.name || "",
      phone: payload.customer?.phone || "",
      email: payload.customer?.email || "",
      note: payload.customer?.note || "",
    },
    shipping: payload.shipping || {},
    items,
    subtotal: payload.subtotal || null,
    total: payload.total || null,
    notes: [],
  };
  appendOrderNote(
    order,
    "xin lưu ý thông tin đang được gửi đi xin vui lòng chờ đợi để admin báo giá ship và tổng đơn để quý khách tiến hành chuyển khoản và đặt hàng. xin vui lòng theo dõi tiến trình ở mục thanh toán. xin cảm ơn."
  );
  if (!customer.orders.includes(order.id)) {
    customer.orders.push(order.id);
  }
  store.orders.unshift(order);
  saveOrderStore(store);
  res.json({
    ok: true,
    orderId: order.id,
    message:
      "xin lưu ý thông tin đang được gửi đi xin vui lòng chờ đợi để admin báo giá ship và tổng đơn để quý khách tiến hành chuyển khoản và đặt hàng. xin vui lòng theo dõi tiến trình ở mục thanh toán. xin cảm ơn.",
    customerCode,
  });
});

app.get("/orders", (req, res) => {
  const store = loadOrderStore();
  res.json({ ok: true, orders: store.orders });
});

app.get("/orders/:id", (req, res) => {
  const store = loadOrderStore();
  const order = store.orders.find((entry) => entry.id === req.params.id);
  if (!order) {
    res.status(404).json({ ok: false, message: "Đơn hàng không tồn tại" });
    return;
  }
  res.json({ ok: true, order });
});

app.patch("/orders/:id", (req, res) => {
  const payload = req.body || {};
  const store = loadOrderStore();
  const orderIndex = store.orders.findIndex((entry) => entry.id === req.params.id);
  if (orderIndex === -1) {
    res.status(404).json({ ok: false, message: "Đơn hàng không tồn tại" });
    return;
  }
  const order = store.orders[orderIndex];
  if (payload.status && ORDER_STATUS[payload.status]) {
    order.status = payload.status;
  }
  if (payload.paymentStatus) {
    order.paymentStatus = payload.paymentStatus;
  }
  if (payload.adminNote) {
    order.notes = order.notes || [];
    order.notes.push({
      id: crypto.randomBytes(4).toString("hex"),
      text: payload.adminNote,
      type: "admin",
      createdAt: new Date().toISOString(),
    });
  }
  if (payload.shipping) {
    order.shipping = {
      ...order.shipping,
      ...payload.shipping,
    };
  }
  store.orders[orderIndex] = order;
  saveOrderStore(store);
  res.json({ ok: true, order });
});

app.post("/cache-image", async (req, res) => {
  const key = normalizeSyncKey(req.query.key);
  const payload = req.body || {};
  const urls = Array.isArray(payload.urls)
    ? payload.urls
    : payload.url
    ? [payload.url]
    : [];
  if (!urls.length) {
    res.status(400).json({ ok: false, message: "Missing url(s)" });
    return;
  }
  const mediaMap = loadMediaMap();
  const results = [];
  for (const url of urls) {
    try {
      const cached = await cacheImage(url, key, req, mediaMap);
      results.push(cached);
    } catch (error) {
      results.push("");
    }
  }
  saveMediaMap(mediaMap);
  res.json({ ok: true, urls: results });
});

app.post("/import", async (req, res) => {
  const { url, cookies, cookie } = req.body || {};
  if (!url) {
    res.status(400).json({ ok: false, message: "Missing url" });
    return;
  }
  try {
    const result = await fetchProductData({ url, cookies, cookie });
    const data = result.data || {};
    const warnings = [];
    if (result.blocked) warnings.push("blocked");
    if (!data.name) warnings.push("missing_name");
    if (!data.image) warnings.push("missing_image");
    if (!data.price) warnings.push("missing_price");
    if (!data.sizes || !data.sizes.length) warnings.push("missing_sizes");
    res.json({ ok: true, data, url: result.url, warnings, blocked: result.blocked });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Import failed", error: error.message });
  }
});

app.post("/taobao/login", async (req, res) => {
  if (taobaoLoginInProgress) {
    res.status(409).json({ ok: false, message: "Đang có phiên đăng nhập Taobao khác." });
    return;
  }
  if (!TAOBAO_LOGIN_URL) {
    res.status(400).json({ ok: false, message: "Chưa cấu hình URL đăng nhập Taobao." });
    return;
  }
  taobaoLoginInProgress = true;
  let context = null;
  try {
    context = await launchTaobaoLoginContext();
    const page = await context.newPage();
    await page.goto(TAOBAO_LOGIN_URL, { waitUntil: "domcontentloaded" });
    console.log("Đăng nhập Taobao trong cửa sổ vừa mở...");
    const cookies = await waitForTaobaoLoginCookie(context);
    if (!cookies || !cookies.length) {
      throw new Error("Không lấy được cookie đăng nhập.");
    }
    const cookieHeader = cookies
      .filter((cookie) => TAOBAO_COOKIE_DOMAIN_RE.test(cookie.domain))
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
    if (!cookieHeader) {
      throw new Error("Cookie Taobao không hợp lệ.");
    }
    saveTaobaoCookie(cookieHeader);
    res.json({
      ok: true,
      message: "Đã lưu cookie Taobao cá nhân.",
      cookieCount: cookies.length,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message || "Đăng nhập Taobao thất bại.",
    });
  } finally {
    taobaoLoginInProgress = false;
    if (context) await context.close();
  }
});

app.get("/taobao/login/status", (req, res) => {
  const cookie = loadTaobaoCookie();
  if (!cookie) {
    res.json({ ok: true, loggedIn: false });
    return;
  }
  let updatedAt = null;
  try {
    const stats = fs.statSync(TAOBAO_COOKIE_FILE);
    updatedAt = stats.mtime.toISOString();
  } catch (error) {
    // ignore
  }
  res.json({ ok: true, loggedIn: true, updatedAt });
});

app.post("/auto-import/run", (req, res) => {
  if (autoImportProcess) {
    res.status(409).json({ ok: false, message: "Auto import already running" });
    return;
  }
  try {
    spawnAutoImport();
    res.json({ ok: true, state: autoImportState });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get("/auto-import/status", (req, res) => {
  res.json({
    ok: true,
    state: autoImportState,
    log: readAutoImportLogTail(),
    pages: readAutoImportPages(),
  });
});

app.get("/auto-import/pages", (req, res) => {
  res.json({ ok: true, pages: readAutoImportPages() });
});

app.post("/auto-import/pages", (req, res) => {
  const pages = normalizePageInput(req.body);
  if (!pages.length) {
    res.status(400).json({ ok: false, message: "Missing pages" });
    return;
  }
  saveAutoImportPages(pages);
  res.json({ ok: true, pages });
});

app.listen(PORT, () => {
  console.log(`Importer running on http://localhost:${PORT}`);
});
