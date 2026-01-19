const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { chromium } = require("playwright");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const ARGS = process.argv.slice(2);
const PROFILE_DIR = path.join(DATA_DIR, "taobao-profile");
const COOKIE_FILE = path.join(DATA_DIR, "taobao-cookie.txt");
const AUTO_LINKS_FILE = path.join(DATA_DIR, "taobao-links-auto.txt");
const CONSUMES_VALUE = new Set(["--links", "--pages", "--max", "--scrolls"]);
const HEADLESS =
  process.env.TAOBAO_HEADLESS === "1" || process.env.HEADLESS === "1";
const SKIP_LOGIN = process.env.TAOBAO_SKIP_LOGIN === "1";
const WAIT_LOGIN = process.env.TAOBAO_WAIT_LOGIN === "1";
const FORCE_LOGIN = process.env.TAOBAO_FORCE_LOGIN === "1";
const LOGIN_URL =
  process.env.TAOBAO_LOGIN_URL || "https://login.taobao.com/";
const BROWSER_CHANNEL = process.env.TAOBAO_BROWSER_CHANNEL || "";
const LOGIN_TIMEOUT_MS = Math.max(
  Number(process.env.TAOBAO_LOGIN_TIMEOUT || 5 * 60 * 1000),
  5000
);
const LOGIN_MIN_WAIT_MS = Math.max(
  Number(process.env.TAOBAO_LOGIN_MIN_WAIT || 60 * 1000),
  5000
);
const CAPTCHA_WAIT_MS = Math.max(
  Number(process.env.TAOBAO_CAPTCHA_WAIT || 5 * 60 * 1000),
  10000
);
const PAGE_WAIT_MS = Math.max(Number(process.env.TAOBAO_PAGE_WAIT || 2500), 500);
const SCROLL_DELAY_MS = Math.max(Number(process.env.TAOBAO_SCROLL_DELAY || 1800), 500);
const IMPORT_DELAY_MS = Math.max(Number(process.env.TAOBAO_IMPORT_DELAY || 1000), 300);
const ERROR_DELAY_MS = Math.max(Number(process.env.TAOBAO_ERROR_DELAY || 1000), 300);

const getArgValue = (flag) => {
  const index = ARGS.indexOf(flag);
  if (index === -1) return "";
  const value = ARGS[index + 1];
  if (!value || value.startsWith("--")) return "";
  return value;
};

const hasFlag = (flag) => ARGS.includes(flag);

const getFirstNonFlagArg = () => {
  const consumed = new Set();
  CONSUMES_VALUE.forEach((flag) => {
    const index = ARGS.indexOf(flag);
    if (index === -1) return;
    consumed.add(index);
    if (ARGS[index + 1]) consumed.add(index + 1);
  });
  return ARGS.find((arg, index) => !arg.startsWith("--") && !consumed.has(index));
};

const LINKS_FILE =
  getArgValue("--links") || getFirstNonFlagArg() || path.join(DATA_DIR, "taobao-links.txt");
const PAGES_FILE =
  getArgValue("--pages") || process.env.TAOBAO_PAGES_FILE || path.join(DATA_DIR, "taobao-pages.txt");
const CRAWL_PAGES_ENV = process.env.TAOBAO_CRAWL_PAGES || "";
const CRAWL_MODE = hasFlag("--crawl") || process.env.TAOBAO_CRAWL === "1";
const MAX_CRAWL_LINKS = Number(getArgValue("--max") || process.env.TAOBAO_MAX_LINKS || 30);
const SCROLL_STEPS = Number(getArgValue("--scrolls") || process.env.TAOBAO_SCROLLS || 6);
const IMPORT_ENDPOINT = process.env.IMPORT_ENDPOINT || "http://localhost:8787/import";
const HEALTH_ENDPOINT = process.env.IMPORT_HEALTH || "http://localhost:8787/health";
const SYNC_ENDPOINT =
  process.env.SYNC_ENDPOINT ||
  "https://ban-hang-taobao-api.quatbqi-p11.workers.dev/sync";
const SYNC_KEY = process.env.SYNC_KEY || "orderhub-main";
const API_KEY = process.env.API_KEY || "";

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

const parseNumberFromText = (value) => {
  if (!value) return null;
  const match = String(value).match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const number = Number(match[1]);
  if (Number.isNaN(number) || number <= 0 || number > 1000000) return null;
  return number;
};

const sanitizeTitle = (value) => {
  if (!value) return "";
  return String(value)
    .replace(/[￥¥]\s*\d+(?:\.\d+)?/g, "")
    .replace(/\d+(?:\.\d+)?\s*元/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const resolvePrice = ({ manualHint, pageHint, dataPrice }) => {
  const manual = parseNumberFromText(manualHint);
  if (manual) return manual;
  const page = parseNumberFromText(pageHint);
  if (page) return page;
  const data = parseNumberFromText(dataPrice);
  return data || 0;
};

const parseUrlHints = (url) => {
  try {
    const parsed = new URL(ensureUrl(url));
    const utparam = parsed.searchParams.get("utparam");
    if (utparam) {
      try {
        const json = JSON.parse(decodeURIComponent(utparam));
        const candidate = json.item_price || json.ump_price || json.price;
        const price = parseNumberFromText(candidate);
        if (price) return { price };
      } catch (error) {
        // ignore utparam parse errors
      }
    }
    const directPrice = parseNumberFromText(parsed.searchParams.get("item_price"));
    if (directPrice) return { price: directPrice };
  } catch (error) {
    return {};
  }
  return {};
};

const inferCategoryFromName = (name) => {
  const value = (name || "").toLowerCase();
  if (/sneaker|giày|shoe/.test(value)) return "sneakers";
  if (/túi|bag|backpack|tote/.test(value)) return "bags";
  if (/áo|hoodie|jacket|khoác|sơ mi|shirt|coat/.test(value)) return "outerwear";
  return "lifestyle";
};

const BLOCKED_TITLE_RE = new RegExp(
  [
    "phone",
    "iphone",
    "android",
    "samsung",
    "xiaomi",
    "huawei",
    "tablet",
    "ipad",
    "laptop",
    "macbook",
    "computer",
    "cpu",
    "gpu",
    "ram",
    "ssd",
    "hdd",
    "camera",
    "lens",
    "drone",
    "earphone",
    "headphone",
    "充电|充電|电池|電池|电源|電源|电芯|電芯|锂|鋰|锂电|鋰電|电瓶|電瓶",
    "pin|battery|powerbank|charger",
    "食品|零食|饼干|餅乾|糖果|茶叶|茶葉|咖啡|饮料|飲料|米|面|面条|麵條|方便面|泡面|辣条|辣條|火锅|火鍋|调料|調料",
    "food|snack|drink|tea|coffee|instant|ramen",
    "化妆|化妝|护肤|護膚|面膜|口红|口紅|香水|精油|粉底|睫毛|眉|眼影|美容",
    "cosmetic|makeup|skincare|lipstick|perfume",
  ].join("|"),
  "i"
);

const ALLOWED_TITLE_RE = new RegExp(
  [
    "衣|服装|上衣|外套|夹克|衬衫|T恤|卫衣|毛衣|裤|褲|牛仔裤|短裤|长裤",
    "鞋|运动鞋|運動鞋|皮鞋|靴|拖鞋|凉鞋|涼鞋",
    "包|手提包|单肩包|斜挎包|背包|双肩包|雙肩包",
    "毛绒|毛絨|毛绒玩具|毛絨玩具|玩偶|公仔",
    "帽|帽子|鸭舌帽|渔夫帽|贝雷帽|针织帽",
  ].join("|"),
  "i"
);

const YOUTH_TITLE_RE = new RegExp(
  [
    "潮流|潮牌|韩版|学生|少女|少年|青年|校园|街头|嘻哈|运动|休闲|时尚|百搭|网红",
  ].join("|"),
  "i"
);

const isBlockedTitle = (title) => {
  if (!title) return false;
  return BLOCKED_TITLE_RE.test(title);
};

const isAllowedTitle = (title) => {
  if (!title) return false;
  return ALLOWED_TITLE_RE.test(title);
};

const isYouthTitle = (title) => {
  if (!title) return false;
  return YOUTH_TITLE_RE.test(title);
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const launchContext = async (options = {}) => {
  const config = { ...options };
  if (BROWSER_CHANNEL) config.channel = BROWSER_CHANNEL;
  try {
    return await chromium.launchPersistentContext(PROFILE_DIR, config);
  } catch (error) {
    if (BROWSER_CHANNEL) {
      console.log("Không mở được Google Chrome, dùng Chromium mặc định.");
      const fallback = { ...options };
      return chromium.launchPersistentContext(PROFILE_DIR, fallback);
    }
    throw error;
  }
};

const isCaptchaPresent = async (page) => {
  try {
    return await page.evaluate(() => {
      const selectors = [
        "#nocaptcha",
        "#nc_1_n1z",
        ".baxia-dialog",
        ".baxia-dialog-content",
        ".baxia-pop",
        ".nc-container",
        ".nc_wrapper",
      ];
      return selectors.some((selector) => document.querySelector(selector));
    });
  } catch (error) {
    return false;
  }
};

const waitForCaptchaClear = async (page, timeoutMs = CAPTCHA_WAIT_MS) => {
  const start = Date.now();
  let lastLog = 0;
  while (Date.now() - start < timeoutMs) {
    const present = await isCaptchaPresent(page);
    if (!present) return true;
    if (Date.now() - lastLog > 5000) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      const left = Math.max(0, Math.round((timeoutMs - (Date.now() - start)) / 1000));
      console.log(`...đang chờ giải captcha (${elapsed}s, còn ${left}s)`);
      lastLog = Date.now();
    }
    await delay(2000);
  }
  return false;
};

const requestJson = (url, method = "GET", payload) =>
  new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const body = payload ? JSON.stringify(payload) : "";
    const headers = {
      "x-api-key": API_KEY,
    };
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(body);
    }
    const req = lib.request(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (!data) return resolve({ status: res.statusCode, json: null });
          try {
            return resolve({ status: res.statusCode, json: JSON.parse(data) });
          } catch (error) {
            return resolve({ status: res.statusCode, json: null });
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(body);
    req.end();
  });

const waitForLoginCookie = async (context, timeoutMs = 5 * 60 * 1000) => {
  const start = Date.now();
  let lastLog = 0;
  const logInterval = 5000;
  console.log(`Thời gian chờ đăng nhập: ${Math.round(timeoutMs / 1000)}s`);
  while (Date.now() - start < timeoutMs) {
    let cookies = [];
    try {
      cookies = await context.cookies();
    } catch (error) {
      return null;
    }
    const loggedIn = cookies.some(
      (cookie) =>
        /taobao|tmall|tb\.cn/i.test(cookie.domain) &&
        /(tracknick|lgc|cookie2|_nk_)/i.test(cookie.name)
    );
    if (loggedIn) {
      if (Date.now() - start >= LOGIN_MIN_WAIT_MS) return cookies;
    }
    if (Date.now() - lastLog > logInterval) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      const left = Math.max(0, Math.round((timeoutMs - (Date.now() - start)) / 1000));
      console.log(`...đang chờ đăng nhập Taobao (${elapsed}s, còn ${left}s)`);
      lastLog = Date.now();
    }
    await delay(2000);
  }
  return null;
};

const loadLinks = () => {
  if (!fs.existsSync(LINKS_FILE)) return { links: [], hintsMap: new Map() };
  const raw = fs.readFileSync(LINKS_FILE, "utf-8");
  const lines = raw
    .split(/\n+/) // Corrected: escaped newline character
    .map((line) => line.trim())
    .filter(Boolean);
  const urlSet = new Set();
  const hintsMap = new Map();
  lines.forEach((line) => {
    const [rawLink, rawPrice] = line.split("|").map((part) => part.trim());
    const linkPart = (rawLink || "").split(/\s+/)[0]; // Corrected: escaped space character
    const url = normalizeProductUrl(linkPart);
    if (!url) return;
    urlSet.add(url);
    const price = parseNumberFromText(rawPrice);
    if (price && !hintsMap.has(url)) hintsMap.set(url, { price });
  });
  return { links: Array.from(urlSet), hintsMap };
};

const loadCookie = () => {
  if (!fs.existsSync(COOKIE_FILE)) return "";
  return fs.readFileSync(COOKIE_FILE, "utf-8").trim();
};

const saveCookie = (cookie) => {
  ensureDir(DATA_DIR);
  fs.writeFileSync(COOKIE_FILE, cookie);
};

const loginOnce = async () => {
  if (HEADLESS || SKIP_LOGIN) {
    console.log("Thiếu cookie, không thể đăng nhập tự động ở chế độ headless.");
    return "";
  }
  console.log("Mở Taobao để đăng nhập (1 lần)...");
  const context = await launchContext({
    headless: false,
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await page.goto("https://login.taobao.com/", { waitUntil: "domcontentloaded" });
  console.log("Đăng nhập Taobao trong cửa sổ vừa mở...");
  const cookies = await waitForLoginCookie(context);
  await context.close();
  if (!cookies) {
    console.log("Hết thời gian chờ đăng nhập.");
    return "";
  }
  const cookieHeader = cookies
    .filter((cookie) => /taobao|tmall|tb\.cn/i.test(cookie.domain))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  if (cookieHeader) saveCookie(cookieHeader);
  return cookieHeader;
};

const ensureCookie = async () => {
  const existing = loadCookie();
  if (existing) return existing;
  if (SKIP_LOGIN) {
    console.log("Thiếu cookie, bỏ qua đăng nhập tự động (TAOBAO_SKIP_LOGIN=1).");
    return "";
  }
  if (HEADLESS) {
    console.log("Thiếu cookie, không thể đăng nhập ở chế độ headless.");
    return "";
  }
  return loginOnce();
};

const buildProduct = (data, sourceUrl, nextId) => {
  const sizes = Array.from(new Set(data.sizes || [])).filter(Boolean);
  if (!sizes.length) sizes.push("Free");
  const sizesText = sizes.filter((size) => /^[A-Za-z]+$/.test(size));
  const sizesNum = sizes.filter((size) => /^[0-9]+$/.test(size));
  const hintedImage = ensureUrl(data.imageHint || "");
  const images = Array.from(
    new Set([...(data.images || []), data.image, hintedImage].filter(Boolean))
  );
  const image = images[0] || "";
  const priceHint = parseUrlHints(sourceUrl).price;
  const price = resolvePrice({
    manualHint: data.priceHint,
    pageHint: priceHint,
    dataPrice: data.price,
  });
  const now = Date.now();
  const hidden = !price;
  const tags = ["auto", "taobao"];
  if (hidden) tags.push("review");
  if (!image) tags.push("needs_image");
  const resolvedName = data.name || data.nameHint || "Sản phẩm Taobao";
  return {
    id: nextId,
    name: resolvedName,
    desc: data.desc || "Mô tả cập nhật thủ công.",
    basePrice: Number.isNaN(price) ? 0 : price,
    category: inferCategoryFromName(resolvedName),
    source: "taobao_link",
    sourceUrl,
    tags,
    sizesText,
    sizesNum,
    stock: sizes.reduce((acc, size) => ({ ...acc, [size]: 3 }), {}),
    palette: ["#2a2f45", "#374766", "#ffb347"],
    image,
    images,
    rating: data.rating ?? null,
    ratingCount: data.ratingCount ?? null,
    positiveRate: data.positiveRate ?? null,
    soldCount: data.soldCount ?? null,
    hidden,
    createdAt: now,
    updatedAt: now,
  };
};

const getNextIdGenerator = (products) => {
  const numbers = (products || [])
    .map((item) => Number(String(item.id || "").replace(/\D/g, "")))
    .filter((value) => !Number.isNaN(value));
  let current = numbers.length ? Math.max(...numbers) : 0;
  return () => {
    current += 1;
    return `P${String(current).padStart(3, "0")}`;
  };
};

const loadPages = () => {
  const envPages = CRAWL_PAGES_ENV.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (envPages.length) return envPages;
  if (!fs.existsSync(PAGES_FILE)) return [];
  const raw = fs.readFileSync(PAGES_FILE, "utf-8");
  return raw
    .split(/\n+/) // Corrected: escaped newline character
    .map((line) => line.trim())
    .filter(Boolean);
};

const collectLinksFromPages = async (pages) => {
  const linkMap = new Map();
  const context = await launchContext({
    headless: HEADLESS,
    viewport: { width: 1280, height: 720 },
  });
  let page = await context.newPage();
  try {
    if (WAIT_LOGIN) {
      if (HEADLESS) {
        console.log("Không thể chờ đăng nhập ở chế độ headless.");
        await context.close();
        return { links: [], hintsMap: new Map() };
      }
      if (FORCE_LOGIN) {
        try {
          await context.clearCookies();
        } catch (error) {
          // ignore cookie clear errors
        }
      }
      await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
      console.log("Đợi bạn đăng nhập Taobao trong cửa sổ vừa mở...");
      const cookies = await waitForLoginCookie(context, LOGIN_TIMEOUT_MS);
      if (!cookies) {
        console.log("Chưa đăng nhập, dừng crawl.");
        await context.close();
        return { links: [], hintsMap: new Map() };
      }
      const cookieHeader = cookies
        .filter((cookie) => /taobao|tmall|tb\.cn/i.test(cookie.domain))
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");
      if (cookieHeader) saveCookie(cookieHeader);
      try {
        await page.close();
      } catch (error) {
        // ignore close errors
      }
      page = await context.newPage();
    }
    const openPage = async () => {
      try {
        if (!page || page.isClosed()) {
          page = await context.newPage();
        }
      } catch (error) {
        page = await context.newPage();
      }
    };

    for (const pageUrl of pages) {
      console.log(`Crawl: ${pageUrl}`);
      await openPage();
      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
      } catch (error) {
        await openPage();
        await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
      }
      const captchaReady = await waitForCaptchaClear(page);
      if (!captchaReady) {
        console.log("Captcha chưa giải, dừng crawl.");
        await context.close();
        return { links: [], hintsMap: new Map() };
      }
      await delay(PAGE_WAIT_MS);
      for (let step = 0; step < SCROLL_STEPS; step += 1) {
        const captchaStepReady = await waitForCaptchaClear(page);
        if (!captchaStepReady) {
          console.log("Captcha chưa giải, dừng crawl.");
          await context.close();
          return { links: [], hintsMap: new Map() };
        }
        let items = [];
        try {
          items = await page.evaluate(() => {
          const isProduct = (href) =>
            /item\.taobao\.com\/item\.htm\?id=|detail\.tmall\.com\/item\.htm\?id=/i.test(
              href || ""
            );
          const anchors = Array.from(document.querySelectorAll("a[href]"));
          const results = [];
          anchors.forEach((anchor) => {
            const href = anchor.href || "";
            if (!isProduct(href)) return;
            let priceText = "";
            let titleText = "";
            let imageUrl = "";
            let node = anchor;
            for (let i = 0; i < 4 && node; i += 1) {
              const priceNode =
                (node.querySelector && node.querySelector("[data-price]")) ||
                (node.querySelector &&
                  node.querySelector(".price, .item-price, .price-value, .tbpc-price"));
              if (priceNode && priceNode.textContent) {
                priceText = priceNode.textContent;
              }
              if (!titleText) {
                titleText =
                  (node.getAttribute && node.getAttribute("title")) ||
                  (node.querySelector &&
                    node.querySelector(".title, .item-title, .item-name, .desc")?.textContent) ||
                  "";
                if (!titleText && node.textContent) titleText = node.textContent;
              }
              if (!imageUrl) {
                const img =
                  (node.querySelector && node.querySelector("img")) ||
                  (node.querySelector && node.querySelector(".img img"));
                if (img) {
                  imageUrl =
                    img.getAttribute("data-src") ||
                    img.getAttribute("data-ks-lazyload") ||
                    img.getAttribute("data-lazyload") ||
                    img.getAttribute("src") ||
                    "";
                }
              }
              node = node.parentElement;
            }
            results.push({ href, priceText, titleText, imageUrl });
          });
          return results;
          });
        } catch (error) {
          await openPage();
          await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
          await delay(PAGE_WAIT_MS);
          try {
            items = await page.evaluate(() => {
              const isProduct = (href) =>
                /item\.taobao\.com\/item\.htm\?id=|detail\.tmall\.com\/item\.htm\?id=/i.test(
                  href || ""
                );
              const anchors = Array.from(document.querySelectorAll("a[href]"));
              const results = [];
              anchors.forEach((anchor) => {
                const href = anchor.href || "";
                if (!isProduct(href)) return;
                let priceText = "";
                let titleText = "";
                let imageUrl = "";
                let node = anchor;
                for (let i = 0; i < 4 && node; i += 1) {
                  const priceNode =
                    (node.querySelector && node.querySelector("[data-price]")) ||
                    (node.querySelector &&
                      node.querySelector(".price, .item-price, .price-value, .tbpc-price"));
                  if (priceNode && priceNode.textContent) {
                    priceText = priceNode.textContent;
                  }
                  if (!titleText) {
                    titleText =
                      (node.getAttribute && node.getAttribute("title")) ||
                      (node.querySelector &&
                        node.querySelector(".title, .item-title, .item-name, .desc")?.textContent) ||
                      "";
                    if (!titleText && node.textContent) titleText = node.textContent;
                  }
                  if (!imageUrl) {
                    const img =
                      (node.querySelector && node.querySelector("img")) ||
                      (node.querySelector && node.querySelector(".img img"));
                    if (img) {
                      imageUrl =
                        img.getAttribute("data-src") ||
                        img.getAttribute("data-ks-lazyload") ||
                        img.getAttribute("data-lazyload") ||
                        img.getAttribute("src") ||
                        "";
                    }
                  }
                  node = node.parentElement;
                }
                results.push({ href, priceText, titleText, imageUrl });
              });
              return results;
            });
          } catch (retryError) {
            items = [];
          }
        }
        for (const item of items) {
          const normalized = normalizeProductUrl(item.href);
          if (!normalized || linkMap.has(normalized)) continue;
          const price = parseNumberFromText(item.priceText);
          const name = sanitizeTitle(item.titleText || "");
          if (
            name &&
            (isBlockedTitle(name) || !isAllowedTitle(name) || !isYouthTitle(name))
          )
            continue;
          const image = ensureUrl(item.imageUrl || "");
          linkMap.set(normalized, {
            price: price || null,
            name: name || "",
            image: image || "",
          });
          if (linkMap.size >= MAX_CRAWL_LINKS) break;
        }
        if (linkMap.size >= MAX_CRAWL_LINKS) break;
        await page.mouse.wheel(0, 1400);
        await delay(SCROLL_DELAY_MS);
      }
      if (linkMap.size >= MAX_CRAWL_LINKS) break;
    }
  } finally {
    await context.close();
  }
  if (linkMap.size) {
    ensureDir(DATA_DIR);
    const lines = Array.from(linkMap.entries()).map(([url, hints]) =>
      hints?.price ? `${url} | ${hints.price}` : url
    );
    fs.writeFileSync(AUTO_LINKS_FILE, lines.join("\n"));
    console.log(`Đã lưu ${linkMap.size} link: ${AUTO_LINKS_FILE}`);
  }
  return { links: Array.from(linkMap.keys()), hintsMap: linkMap };
};

const syncProducts = async (newProducts) => {
  if (!newProducts.length) return { ok: false, message: "Không có sản phẩm mới." };
  const url = new URL(SYNC_ENDPOINT);
  url.searchParams.set("key", SYNC_KEY);
  const snapshotResult = await requestJson(url.toString());
  const snapshot =
    snapshotResult.json && typeof snapshotResult.json === "object"
      ? snapshotResult.json
      : {
          meta: { updatedAt: new Date(0).toISOString() },
          settings: {},
          products: [],
          orders: [],
          customers: {},
        };
  const products = Array.isArray(snapshot.products) ? snapshot.products : [];
  products.unshift(...newProducts);
  const payload = {
    ...snapshot,
    products,
    meta: {
      ...(snapshot.meta || {}),
      updatedAt: new Date().toISOString(),
    },
  };
  const postResult = await requestJson(url.toString(), "POST", payload);
  return { ok: postResult.status >= 200 && postResult.status < 300 };
};

const main = async () => {
  ensureDir(DATA_DIR);
  try {
    const health = await requestJson(HEALTH_ENDPOINT);
    if (!health || health.status !== 200) {
      console.log("Importer chưa chạy. Hãy chạy: node server/index.js");
      return;
    }
  } catch (error) {
    console.log("Importer chưa chạy. Hãy chạy: node server/index.js");
    return;
  }
  const cookie = await ensureCookie();
  if (!cookie) {
    console.log("Chưa có cookie đăng nhập Taobao.");
    return;
  }
  let links = [];
  let hintsMap = new Map();
  if (CRAWL_MODE) {
    const pages = loadPages();
    if (!pages.length) {
      console.log("Không có trang để crawl. Tạo file:", PAGES_FILE);
      return;
    }
    const crawl = await collectLinksFromPages(pages);
    links = crawl.links;
    hintsMap = crawl.hintsMap;
  } else {
    const manual = loadLinks();
    links = manual.links;
    hintsMap = manual.hintsMap;
  }
  if (!links.length) {
    console.log("Không có link sản phẩm để import.");
    return;
  }
  const products = [];
  for (let i = 0; i < links.length; i += 1) {
    const url = links[i];
    console.log(`Import ${i + 1}/${links.length}: ${url}`);
    const result = await requestJson(IMPORT_ENDPOINT, "POST", {
      url,
      cookie,
    });
    const payload = result.json || {};
    if (!payload.ok || !payload.data) {
      console.log("  -> Lỗi import:", payload.message || "Không lấy được dữ liệu");
      await delay(ERROR_DELAY_MS);
      continue;
    }
    const resolvedTitle = sanitizeTitle(payload.data.name || hintsMap.get(url)?.name || "");
    if (
      isBlockedTitle(resolvedTitle) ||
      !isAllowedTitle(resolvedTitle) ||
      !isYouthTitle(resolvedTitle)
    ) {
      console.log("  -> Bỏ qua (không thuộc nhóm hàng trẻ).");
      await delay(600);
      continue;
    }
    const hints = hintsMap.get(url) || {};
    products.push({
      ...payload.data,
      sourceUrl: payload.url || url,
      priceHint: hints.price,
      nameHint: sanitizeTitle(hints.name || ""),
      imageHint: hints.image,
    });
    await delay(IMPORT_DELAY_MS);
  }
  if (!products.length) {
    console.log("Không lấy được sản phẩm nào.");
    return;
  }
  const snapshotResult = await requestJson(`${SYNC_ENDPOINT}?key=${SYNC_KEY}`);
  const existing = snapshotResult.json?.products || [];
  const existingUrls = new Set(
    existing.map((item) => normalizeProductUrl(item.sourceUrl || item.source_url || ""))
  );
  const seenIncoming = new Set();
  const filteredIncoming = products.filter((item) => {
    const url = normalizeProductUrl(item.sourceUrl || "");
    if (!url) return true;
    if (existingUrls.has(url) || seenIncoming.has(url)) return false;
    seenIncoming.add(url);
    return true;
  });
  if (!filteredIncoming.length) {
    console.log("Không có sản phẩm mới (trùng link).");
    return;
  }
  const nextId = getNextIdGenerator(existing);
  const newProducts = filteredIncoming.map((item) =>
    buildProduct(item, item.sourceUrl || "", nextId())
  );
  const outputPath = path.join(DATA_DIR, "import-results.json");
  fs.writeFileSync(outputPath, JSON.stringify(newProducts, null, 2));
  const syncResult = await syncProducts(newProducts);
  if (syncResult.ok) {
    console.log(`Đã đồng bộ ${newProducts.length} sản phẩm lên hệ thống.`);
  } else {
    console.log("Không đồng bộ được lên hệ thống. Đã lưu file:", outputPath);
  }
};

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});