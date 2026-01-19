const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const BLOCKED_RE =
  /Access denied|访问被拒绝|安全验证|人机验证|验证码|请先登录|登录|security verification|请开启 JavaScript/i;
const BLOCKED_TEXT_RE =
  /login|đăng nhập|登录|sign in|sign-in|taobao\.com|淘宝网|天貓淘寶海外|天猫淘寶海外|天猫淘宝海外/i;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,x-api-key",
};
const KV_PART_BYTES = 4 * 1024 * 1024;
const MAX_R2_IMAGE_BYTES = 10 * 1024 * 1024;
async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const handleAdminLogin = async (request, env) => {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed" }, 405);
  }
  if (!env.ADMIN_HASH) {
    return jsonResponse({ ok: false, message: "Admin not configured" }, 500);
  }
  try {
    const { password } = await request.json();
    if (!password) {
      return jsonResponse({ ok: false, message: "Missing password" }, 400);
    }
    const hash = await sha256(password);
    if (hash === env.ADMIN_HASH) {
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ ok: false }, 401);
  } catch (error) {
    return jsonResponse({ ok: false, message: "Invalid request" }, 400);
  }
};

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const normalizeKey = (raw) => {
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

const parseJsonLdProduct = (html) => {
  const matches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
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
      // ignore JSON-LD parse errors
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
  const picsMatch =
    html.match(/"picsPath"\s*:\s*\[([^\]]+)\]/) ||
    html.match(/'picsPath'\s*:\s*\[([^\]]+)\]/);
  const images = [];
  if (picsMatch && picsMatch[1]) {
    const imgRegex = /["']([^"']+\.(?:png|jpg|jpeg|webp|gif|avif|svg))["']/gi;
    for (const match of picsMatch[1].matchAll(imgRegex)) {
      if (match[1]) images.push(decodeEscapedText(match[1]));
    }
  }
  const imgRegex = /"picUrl"\s*:\s*"([^"]+\.(?:png|jpg|jpeg|webp|gif|avif|svg))"/gi;
  for (const match of html.matchAll(imgRegex)) {
    if (match[1]) images.push(decodeEscapedText(match[1]));
  }
  return { title, subtitle, pic, price, images };
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

const extractFromHtml = (html, sourceUrl, domData) => {
  const jsonLd = parseJsonLdProduct(html);
  const scriptData = parseScriptData(html);
  const quality = parseQualitySignals(html);
  const titleRaw = pickFirst(domData?.title, jsonLd.name, scriptData.title);
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

const fetchHtmlViaJina = async (url) => {
  const parsed = new URL(url);
  const protocol = parsed.protocol.replace(":", "");
  const proxyUrl = `https://r.jina.ai/${protocol}://${parsed.host}${parsed.pathname}${parsed.search}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error("fetch_failed");
  const html = await response.text();
  return html;
};

const sha1 = async (value) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const handleSync = async (request, env) => {
  const url = new URL(request.url);
  const key = normalizeKey(url.searchParams.get("key"));
  if (request.method === "GET") {
    const stored = await env.SYNC_KV.get(key);
    if (!stored) {
      return jsonResponse({
        meta: { updatedAt: new Date().toISOString() },
        settings: {},
        products: [],
        orders: [],
        customers: {},
      });
    }
    try {
      return jsonResponse(JSON.parse(stored));
    } catch (error) {
      return jsonResponse({ ok: false, message: "Invalid stored data" }, 500);
    }
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed" }, 405);
  }
  let payload = null;
  try {
    payload = await request.json();
  } catch (error) {
    return jsonResponse({ ok: false, message: "Invalid payload" }, 400);
  }
  if (!payload || typeof payload !== "object") {
    return jsonResponse({ ok: false, message: "Invalid payload" }, 400);
  }
  const meta = payload.meta || {};
  payload.meta = {
    ...meta,
    updatedAt: meta.updatedAt || new Date().toISOString(),
  };
  await env.SYNC_KV.put(key, JSON.stringify(payload));
  return jsonResponse({ ok: true, key, updatedAt: payload.meta.updatedAt });
};

const handleCacheImage = async (request, env) => {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed" }, 405);
  }
  const url = new URL(request.url);
  const key = normalizeKey(url.searchParams.get("key"));
  let payload = {};
  try {
    payload = await request.json();
  } catch (error) {
    return jsonResponse({ ok: false, message: "Invalid payload" }, 400);
  }
  const urls = Array.isArray(payload.urls)
    ? payload.urls
    : payload.url
    ? [payload.url]
    : [];
  if (!urls.length) {
    return jsonResponse({ ok: false, message: "Missing url(s)" }, 400);
  }
  const origin = new URL(request.url).origin;
  const results = [];
  const hasR2 = Boolean(env.MEDIA_BUCKET);
  const hasKV = Boolean(env.MEDIA_KV);
  if (!hasR2 && !hasKV) {
    const passthrough = urls.map((value) => ensureUrl(value) || "");
    return jsonResponse({ ok: true, urls: passthrough, cached: false });
  }
  for (const raw of urls.slice(0, 30)) {
    try {
      const normalized = ensureUrl(raw);
      if (!normalized) {
        results.push("");
        continue;
      }
      const hash = await sha1(normalized);
      const objectKey = `${key}/${hash}`;
      const mediaUrl = `${origin}/media/${key}/${hash}`;

      if (hasR2) {
        const existing = await env.MEDIA_BUCKET.head(objectKey);
        if (existing) {
          results.push(mediaUrl);
          continue;
        }
        const response = await fetch(normalized, {
          headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
          redirect: "follow",
        });
        if (!response.ok) throw new Error("download_failed");
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.startsWith("image/")) throw new Error("not_image");
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > MAX_R2_IMAGE_BYTES) throw new Error("too_large");
        await env.MEDIA_BUCKET.put(objectKey, buffer, {
          httpMetadata: { contentType },
          customMetadata: { source: normalized },
        });
        results.push(mediaUrl);
        continue;
      }

      if (hasKV) {
        const metaKey = `${objectKey}:meta`;
        const existingMeta = await env.MEDIA_KV.get(metaKey);
        if (existingMeta) {
          results.push(mediaUrl);
          continue;
        }
        const existing = await env.MEDIA_KV.get(objectKey);
        if (existing) {
          results.push(mediaUrl);
          continue;
        }
        const response = await fetch(normalized, {
          headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
          redirect: "follow",
        });
        if (!response.ok) throw new Error("download_failed");
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.startsWith("image/")) throw new Error("not_image");
        const reader = response.body?.getReader?.();
        let partIndex = 0;
        let totalSize = 0;
        let pending = new Uint8Array(0);

        const flushChunk = async (chunk) => {
          if (!chunk || !chunk.length) return;
          await env.MEDIA_KV.put(`${objectKey}:part:${partIndex}`, chunk);
          partIndex += 1;
        };

        if (reader) {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value || !value.length) continue;
            totalSize += value.length;
            const combined = new Uint8Array(pending.length + value.length);
            combined.set(pending, 0);
            combined.set(value, pending.length);
            let offset = 0;
            while (combined.length - offset >= KV_PART_BYTES) {
              await flushChunk(combined.slice(offset, offset + KV_PART_BYTES));
              offset += KV_PART_BYTES;
            }
            pending = combined.slice(offset);
          }
          if (pending.length) {
            await flushChunk(pending);
          }
        } else {
          const buffer = new Uint8Array(await response.arrayBuffer());
          totalSize = buffer.length;
          await flushChunk(buffer);
        }

        await env.MEDIA_KV.put(
          metaKey,
          JSON.stringify({
            parts: partIndex,
            contentType,
            source: normalized,
            size: totalSize,
          })
        );
        results.push(mediaUrl);
        continue;
      }

      results.push(normalized);
    } catch (error) {
      results.push(ensureUrl(raw) || "");
    }
  }
  return jsonResponse({ ok: true, urls: results });
};

const handleMedia = async (request, env) => {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 3) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
  const key = parts[1];
  const id = parts.slice(2).join("/");
  if (env.MEDIA_BUCKET) {
    const object = await env.MEDIA_BUCKET.get(`${key}/${id}`);
    if (!object) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }
    const headers = new Headers(corsHeaders);
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return new Response(object.body, { headers });
  }
  if (env.MEDIA_KV) {
    const directEntry = await env.MEDIA_KV.getWithMetadata(`${key}/${id}`, {
      type: "arrayBuffer",
    });
    if (directEntry && directEntry.value) {
      const headers = new Headers(corsHeaders);
      const contentType = directEntry.metadata?.contentType || "image/jpeg";
      headers.set("Content-Type", contentType);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(directEntry.value, { headers });
    }

    const meta = await env.MEDIA_KV.get(`${key}/${id}:meta`, { type: "json" });
    if (!meta || !meta.parts) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }
    const headers = new Headers(corsHeaders);
    const contentType = meta.contentType || "image/jpeg";
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    const stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < meta.parts; i += 1) {
          const chunk = await env.MEDIA_KV.get(`${key}/${id}:part:${i}`, {
            type: "arrayBuffer",
          });
          if (!chunk) {
            controller.error(new Error("missing_chunk"));
            return;
          }
          controller.enqueue(new Uint8Array(chunk));
        }
        controller.close();
      },
    });
    return new Response(stream, { headers });
  }
  return new Response("Not found", { status: 404, headers: corsHeaders });
};

const handleImport = async (request, env) => {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed" }, 405);
  }
  if (!env.SCRAPER_SERVICE_URL) {
    return jsonResponse({ ok: false, message: "Scraper service not configured" }, 500);
  }

  const incomingApiKey = request.headers.get("x-api-key");
  const headers = { "Content-Type": "application/json" };
  if (incomingApiKey) {
    headers["x-api-key"] = incomingApiKey; // Pass the API key to the scraper service
  }

  try {
    const targetUrl = new URL("/import", env.SCRAPER_SERVICE_URL);
    const newRequest = new Request(targetUrl, {
      method: "POST",
      headers: headers,
      body: request.body,
    });
    return await fetch(newRequest);
  } catch (error) {
    return jsonResponse({ ok: false, message: "Failed to proxy request to scraper" }, 502);
  }
};



export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    // Media GET requests are public
    if (request.method === "GET" && url.pathname.startsWith("/media/")) {
      return handleMedia(request, env);
    }

    const apiKey = request.headers.get("x-api-key");
    if (!env.API_KEY || apiKey !== env.API_KEY) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (url.pathname === "/sync") return handleSync(request, env);
    if (url.pathname === "/cache-image") return handleCacheImage(request, env);
    if (url.pathname === "/import") return handleImport(request, env);
    if (url.pathname === "/admin/login") return handleAdminLogin(request, env);
    return jsonResponse({ ok: true, service: "orderhub-api" });
  },
};

