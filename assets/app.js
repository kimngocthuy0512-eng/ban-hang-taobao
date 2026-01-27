(() => {
  const createSafeStorage = (storage) => {
    const memory = {};
    const fallback = {
      getItem: (key) =>
        Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null,
      setItem: (key, value) => {
        memory[key] = String(value);
      },
      removeItem: (key) => {
        delete memory[key];
      },
    };
    if (!storage || typeof storage.getItem !== "function") {
      return fallback;
    }
    try {
      storage.setItem("__oh_test", "1");
      storage.removeItem("__oh_test");
      return storage;
    } catch (error) {
      return fallback;
    }
  };

  const store = createSafeStorage(typeof window !== "undefined" ? window.localStorage : null);
  const sessionStore = createSafeStorage(
    typeof window !== "undefined" ? window.sessionStorage : null
  );

  const KEYS = {
    settings: "oh_settings",
    products: "oh_products",
  deletedProducts: "oh_deleted_products",
  cart: "oh_cart",
  orders: "oh_orders",
  customers: "oh_customers",
  deviceCustomerCode: "oh_device_customer_code",
  productSeq: "oh_product_seq",
  viewMode: "oh_view_mode",
  adminAuth: "oh_admin_auth",
  backup: "oh_backup",
  backupHistory: "oh_backup_history",
  syncCheckpoint: "oh_sync_checkpoint",
  wishlist: "oh_wishlist",
  recent: "oh_recent",
  reviews: "oh_reviews",
  customerRequests: "oh_customer_requests",
};

  const STATUS = {
    CART: "CART",
    PENDING_QUOTE: "PENDING_QUOTE",
    QUOTED_WAITING_PAYMENT: "QUOTED_WAITING_PAYMENT",
    SHIP_CONFIRMED: "SHIP_CONFIRMED",
    PAYMENT_UNDER_REVIEW: "PAYMENT_UNDER_REVIEW",
    PAID: "PAID",
    CANCELLED: "CANCELLED",
  };

  const PAYMENT_STATUS = {
    NOT_PAID: "NOT_PAID",
    BILL_SUBMITTED: "BILL_SUBMITTED",
    CONFIRMED: "CONFIRMED",
    REJECTED: "REJECTED",
    EXPIRED: "EXPIRED",
  };

  const STATUS_LABELS = {
    [STATUS.CART]: "Giỏ hàng",
    [STATUS.PENDING_QUOTE]: "Chờ báo giá",
    [STATUS.QUOTED_WAITING_PAYMENT]: "Chờ thanh toán",
    [STATUS.SHIP_CONFIRMED]: "Đã xác nhận phí ship",
    [STATUS.PAYMENT_UNDER_REVIEW]: "Đang xác nhận",
    [STATUS.PAID]: "Đã thanh toán",
    [STATUS.CANCELLED]: "Đã hủy",
  };

  const PAYMENT_STATUS_LABELS = {
    [PAYMENT_STATUS.NOT_PAID]: "Chưa thanh toán",
    [PAYMENT_STATUS.BILL_SUBMITTED]: "Đã gửi bill",
    [PAYMENT_STATUS.CONFIRMED]: "Đã xác nhận",
    [PAYMENT_STATUS.REJECTED]: "Bị từ chối",
    [PAYMENT_STATUS.EXPIRED]: "Hết hạn",
  };

  const formatOrderStatus = (status) => STATUS_LABELS[status] || status || "-";
  const formatPaymentStatus = (status) => PAYMENT_STATUS_LABELS[status] || status || "-";
  const getMessengerSegment = (value) => {
    if (!value) return "";
    let normalized = String(value).trim();
    if (!normalized) return "";
    normalized = normalized.replace(/^https?:\/\//i, "");
    normalized = normalized.replace(/^www\./i, "");
    if (normalized.startsWith("m.me/")) {
      normalized = normalized.slice(5);
    }
    if (normalized.startsWith("messenger.com/")) {
      normalized = normalized.slice(17);
    }
    if (normalized.startsWith("facebook.com/")) {
      normalized = normalized.slice(13);
    }
    normalized = normalized.split("?")[0].split("#")[0];
    normalized = normalized.replace(/\/+$/, "");
    return normalized.trim();
  };
  const getMessengerLink = (value) => {
    const segment = getMessengerSegment(value);
    if (!segment) return "";
    return `https://m.me/${segment}`;
  };
  const notifyCustomerMessenger = (order, options = {}) => {
    if (!order) return "";
    const link = getMessengerLink(order.customer?.fb);
    if (!link) return "";
    if (typeof window !== "undefined" && typeof window.open === "function") {
      if (options.redirect) {
        window.location.assign(link);
        return link;
      }
      window.open(link, "_blank");
    }
    return link;
  };
  const PAYMENT_BADGE_CONFIG = {
    [PAYMENT_STATUS.NOT_PAID]: { label: "Chưa thanh toán", class: "red" },
    [PAYMENT_STATUS.BILL_SUBMITTED]: { label: "Bill đã gửi", class: "orange" },
    [PAYMENT_STATUS.PAYMENT_UNDER_REVIEW]: { label: "Đang xác thực", class: "orange" },
    [PAYMENT_STATUS.CONFIRMED]: { label: "Đã thanh toán", class: "green" },
    [PAYMENT_STATUS.EXPIRED]: { label: "Mã hết hạn", class: "red" },
    [PAYMENT_STATUS.REJECTED]: { label: "Đã từ chối", class: "red" },
  };

  const getOrderPaymentBadge = (order) => {
    if (!order) return { label: "Không xác định", class: "" };
    if (order.status === STATUS.CANCELLED) {
      return { label: "Đã huỷ", class: "red" };
    }
    const expired = order.paymentExpiresAt && Date.now() > order.paymentExpiresAt;
    if (expired && order.paymentStatus === PAYMENT_STATUS.NOT_PAID) {
      return { label: "Mã hết hạn", class: "red" };
    }
    const badge = PAYMENT_BADGE_CONFIG[order.paymentStatus];
    if (badge) return badge;
    return { label: formatPaymentStatus(order.paymentStatus), class: "" };
  };

  const DEFAULT_SETTINGS = {
    baseCurrency: "CNY",
    rateJPY: 21.5,
    rateVND: 3600,
    rateUpdated: "2026-05-18",
    fbLink: "https://www.facebook.com/",
    bankJP: "Mizuho Bank · 001 · 1234567 · JP ORDER HUB",
    bankVN: "Vietcombank · 0123456789 · ORDER HUB VN",
    paymentGateOpen: false,
    syncEndpoint: "https://ban-hang-taobao-api.quatbqi-p11.workers.dev/sync",
    syncKey: "orderhub-main",
    apiKey: "",
    importEndpoint: "https://ban-hang-taobao-api.quatbqi-p11.workers.dev/import",
    importCookie: "",
    lastSync: "",
    orderEndpoint: "/orders",
  };

  const getAutoImportBaseUrl = (settings) => {
    const raw = (settings?.importEndpoint || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      url.pathname = "";
      url.search = "";
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    } catch (error) {
      const trimmed = raw.replace(/\/$/, "");
      return trimmed.replace(/\/import$/, "").replace(/\/$/, "");
    }
  };

  const buildAutoImportUrl = (settings, path = "") => {
    const base = getAutoImportBaseUrl(settings);
    if (!base) return "";
    const suffix = path ? (path.startsWith("/") ? path : `/${path}`) : "";
    return `${base}${suffix}`;
  };

  const BACKEND_IMPORTER_HINT =
    "Auto import và Taobao cá nhân chỉ chạy khi backend crawler (server/) được triển khai. Hãy cập nhật Import URL trỏ tới backend đó (ví dụ Render) để dùng tính năng này.";

  const ensureImporterSupported = (response, fallback = "Không thể kết nối backend crawler.") => {
    if (!response) {
      throw new Error(fallback);
    }
    if (response.status === 404 || response.status === 405) {
      throw new Error(BACKEND_IMPORTER_HINT);
    }
    if (!response.ok) {
      throw new Error(fallback);
    }
  };

  const normalizeSettings = (settings) => {
    const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    if (!merged.importEndpoint) merged.importEndpoint = DEFAULT_SETTINGS.importEndpoint;
    if (!merged.syncEndpoint) merged.syncEndpoint = DEFAULT_SETTINGS.syncEndpoint;
    if (!merged.syncKey) merged.syncKey = DEFAULT_SETTINGS.syncKey;
    if (!merged.apiKey) merged.apiKey = "";
    if (!merged.importCookie) merged.importCookie = "";
    if (/localhost|127\\.0\\.0\\.1/i.test(String(merged.syncEndpoint || ""))) {
      merged.syncEndpoint = DEFAULT_SETTINGS.syncEndpoint;
    }
    if (/localhost|127\\.0\\.0\\.1/i.test(String(merged.importEndpoint || ""))) {
      merged.importEndpoint = DEFAULT_SETTINGS.importEndpoint;
    }
    if (typeof merged.paymentGateOpen !== "boolean") {
      const normalized = String(merged.paymentGateOpen || "").toLowerCase().trim();
      merged.paymentGateOpen = normalized === "true" || normalized === "1";
    }
    return merged;
  };

  const SHOP_SORT_OPTIONS = [
    { value: "new", label: "Mới nhất" },
    { value: "price-asc", label: "Giá tăng" },
    { value: "price-desc", label: "Giá giảm" },
  ];

  const SHOP_VIEW_MODES = ["grid", "compact", "list"];

  const SHOP_METADATA_DEFAULT = {
    categories: [],
    sizes: [],
    sortOptions: SHOP_SORT_OPTIONS,
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const debounce = (callback, delay = 120) => {
    let timeoutId = null;
    const debounced = (...args) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        callback(...args);
      }, delay);
    };
    debounced.cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    return debounced;
  };

  const getSyncBaseUrl = (settings) => {
    const raw = (settings?.syncEndpoint || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      const segments = url.pathname
        .split("/")
        .filter(Boolean)
        .filter((segment, index, array) => !(index === array.length - 1 && segment === "sync"));
      url.pathname = segments.length ? `/${segments.join("/")}` : "";
      url.search = "";
      url.hash = "";
      const trimmed = url.toString().replace(/\/$/, "");
      return trimmed;
    } catch (error) {
      return raw.replace(/\/sync\/?$/, "").replace(/\/$/, "");
    }
  };

  const buildSyncMetadataUrl = (settings) => {
    const base = getSyncBaseUrl(settings);
    if (!base) return "";
    try {
      const url = new URL(`${base}/metadata`);
      if (settings.syncKey) url.searchParams.set("key", settings.syncKey);
      return url.toString();
    } catch (error) {
      return `${base}/metadata`;
    }
  };

  const populateFilterOptions = (select, items = [], defaultLabel = "Tất cả") => {
    if (!select) return;
    const optionHtml = [`<option value="">${escapeHtml(defaultLabel)}</option>`];
    items.forEach((item) => {
      const value = item?.value ?? item;
      if (!value) return;
      const label = item?.label || (item?.text || value);
      optionHtml.push(
        `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`
      );
    });
    select.innerHTML = optionHtml.join("");
  };

  const applyShopMetadataToFilters = (metadata, controls = {}) => {
    const { categoryFilter, sizeFilter, sortFilter } = controls;
    const categories = Array.isArray(metadata?.categories) ? metadata.categories : [];
    const sizes = Array.isArray(metadata?.sizes) ? metadata.sizes : [];
    const sortOptions = Array.isArray(metadata?.sortOptions) ? metadata.sortOptions : SHOP_SORT_OPTIONS;
    if (categoryFilter) {
      populateFilterOptions(categoryFilter, categories, "Tất cả danh mục");
    }
    if (sizeFilter) {
      const sizeItems = sizes.map((value) => ({ value, label: value }));
      populateFilterOptions(sizeFilter, sizeItems, "Tất cả size");
    }
    if (sortFilter) {
      populateFilterOptions(sortFilter, sortOptions, "Sắp xếp");
    }
  };

  const fetchShopMetadata = async () => {
    const settings = getSettings();
    const url = buildSyncMetadataUrl(settings);
    if (!url) return null;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(response.statusText || "Không lấy được metadata.");
      }
      const payload = await response.json();
      if (!payload?.ok) {
        throw new Error(payload?.message || "Không lấy được metadata.");
      }
      return payload.metadata || null;
    } catch (error) {
      console.warn("Không thể tải metadata cửa hàng:", error);
      return null;
    }
  };

  const DEFAULT_PRODUCTS = [
    {
      id: "P001",
      name: "Áo khoác lông mịn",
      desc: "Form rộng, lót dày, giữ nhiệt tốt. Nguồn web nội bộ.",
      category: "outerwear",
      source: "web",
      tags: ["nổi bật", "mới"],
      palette: ["#2f4f43", "#3a5d4f", "#d2b48c"],
      image: "assets/images/p-01.svg",
      variants: [
        { size: "S", color: "Đen", price: 168, stock: 6, image: "assets/images/p-01.svg" },
        { size: "M", color: "Đen", price: 170, stock: 0, image: "assets/images/p-01.svg" },
        { size: "L", color: "Đen", price: 172, stock: 5, image: "assets/images/p-01.svg" },
        { size: "XL", color: "Đen", price: 175, stock: 2, image: "assets/images/p-01.svg" },
      ],
    },
    {
      id: "P002",
      name: "Sneaker giới hạn",
      desc: "Đế êm, form chuẩn, kèm size số.",
      category: "sneakers",
      source: "taobao_link",
      tags: ["limited", "taobao"],
      palette: ["#2b3a46", "#37505c", "#a47b57"],
      image: "assets/images/p-02.svg",
      variants: [
        { size: "38", color: "Trắng", price: 328, stock: 3, image: "assets/images/p-02.svg" },
        { size: "39", color: "Trắng", price: 330, stock: 0, image: "assets/images/p-02.svg" },
        { size: "40", color: "Trắng", price: 332, stock: 4, image: "assets/images/p-02.svg" },
      ],
    },
    {
      id: "P003",
      name: "Túi canvas tối giản",
      desc: "Tối giản, bền nhẹ, dùng cho đi học và đi làm.",
      category: "bags",
      source: "web",
      tags: ["bán chạy"],
      palette: ["#2f3f39", "#3b4f46", "#c9a17f"],
      image: "assets/images/p-03.svg",
      variants: [
        { size: "M", color: "Kem", price: 96, stock: 7, image: "assets/images/p-03.svg" },
        { size: "L", color: "Kem", price: 100, stock: 3, image: "assets/images/p-03.svg" },
      ],
    },
    {
      id: "P004",
      name: "Set đồ loungewear",
      desc: "Chất nỉ mịn, thấm hút tốt, dùng ở nhà lẫn đi phố.",
      category: "lifestyle",
      source: "taobao_sync",
      tags: ["sync"],
      palette: ["#2b3b36", "#364a43", "#b58c6b"],
      image: "assets/images/p-04.svg",
      variants: [
        { size: "S", color: "Xám", price: 142, stock: 2, image: "assets/images/p-04.svg" },
        { size: "M", color: "Xám", price: 145, stock: 1, image: "assets/images/p-04.svg" },
        { size: "L", color: "Xám", price: 148, stock: 4, image: "assets/images/p-04.svg" },
      ],
    },
    {
      id: "P005",
      name: "Áo sơ mi linen",
      desc: "Linen Nhật, nhẹ mát, phù hợp khí hậu nóng.",
      category: "outerwear",
      source: "web",
      tags: ["new"],
      palette: ["#26332f", "#34433d", "#c4a07d"],
      image: "assets/images/p-05.svg",
      variants: [
        { size: "M", color: "Be", price: 118, stock: 4, image: "assets/images/p-05.svg" },
        { size: "L", color: "Be", price: 120, stock: 2, image: "assets/images/p-05.svg" },
        { size: "XL", color: "Be", price: 122, stock: 1, image: "assets/images/p-05.svg" },
      ],
    },
    {
      id: "P006",
      name: "Giày thể thao retro",
      desc: "Retro form, phối màu Nhật, size số đủ.",
      category: "sneakers",
      source: "taobao_link",
      tags: ["retro"],
      palette: ["#2f3a35", "#44534c", "#a77a5a"],
      image: "assets/images/p-06.svg",
      variants: [
        { size: "38", color: "Xanh", price: 275, stock: 3, image: "assets/images/p-06.svg" },
        { size: "39", color: "Xanh", price: 278, stock: 2, image: "assets/images/p-06.svg" },
        { size: "40", color: "Xanh", price: 280, stock: 0, image: "assets/images/p-06.svg" },
      ],
    },
    {
      id: "P007",
      name: "Áo hoodie Nhật bản",
      desc: "Form boxy, chất nỉ dày, phù hợp thời tiết lạnh.",
      category: "outerwear",
      source: "taobao_link",
      tags: ["hoodie", "new"],
      palette: ["#26332f", "#3b4f45", "#c6a072"],
      image: "assets/images/p-07.svg",
      variants: [
        { size: "S", color: "Đỏ", price: 210, stock: 4, image: "assets/images/p-07.svg" },
        { size: "M", color: "Đỏ", price: 212, stock: 6, image: "assets/images/p-07.svg" },
        { size: "L", color: "Đỏ", price: 215, stock: 3, image: "assets/images/p-07.svg" },
        { size: "XL", color: "Đỏ", price: 218, stock: 2, image: "assets/images/p-07.svg" },
      ],
    },
    {
      id: "P008",
      name: "Chân váy xếp ly",
      desc: "Kiểu dáng nhẹ, tôn dáng, phối được nhiều outfit.",
      basePrice: 124,
      category: "lifestyle",
      source: "web",
      tags: ["trend"],
      sizesText: ["S", "M", "L"],
      sizesNum: [],
      stock: { S: 3, M: 5, L: 4 },
      palette: ["#22302a", "#394840", "#c39a6d"],
      image: "assets/images/p-08.svg",
    },
    {
      id: "P009",
      name: "Balo đa năng",
      desc: "Chống nước nhẹ, nhiều ngăn, phù hợp đi làm.",
      basePrice: 186,
      category: "bags",
      source: "web",
      tags: ["bền", "daily"],
      sizesText: ["M"],
      sizesNum: [],
      stock: { M: 8 },
      palette: ["#222e2a", "#3a4a43", "#c39b70"],
      image: "assets/images/p-09.svg",
    },
    {
      id: "P010",
      name: "Áo thun basic",
      desc: "Cotton mềm, form vừa, phối dễ với mọi outfit.",
      basePrice: 88,
      category: "lifestyle",
      source: "web",
      tags: ["basic"],
      sizesText: ["S", "M", "L", "XL"],
      sizesNum: [],
      stock: { S: 7, M: 9, L: 6, XL: 3 },
      palette: ["#243028", "#3a4a41", "#c5a072"],
      image: "assets/images/p-10.svg",
    },
    {
      id: "P011",
      name: "Giày chạy bộ nhẹ",
      desc: "Đế nhẹ, bám tốt, phù hợp chạy bộ hàng ngày.",
      basePrice: 260,
      category: "sneakers",
      source: "taobao_sync",
      tags: ["sport"],
      sizesText: [],
      sizesNum: ["38", "39", "40"],
      stock: { "38": 4, "39": 2, "40": 3 },
      palette: ["#232c33", "#3b4b58", "#c79d72"],
      image: "assets/images/p-11.svg",
    },
    {
      id: "P012",
      name: "Túi đeo chéo mini",
      desc: "Gọn nhẹ, đủ để đồ cơ bản, phù hợp đi phố.",
      basePrice: 98,
      category: "bags",
      source: "taobao_link",
      tags: ["compact"],
      sizesText: ["M"],
      sizesNum: [],
      stock: { M: 6 },
      palette: ["#232f2a", "#3a4a42", "#c79e72"],
      image: "assets/images/p-12.svg",
    },
  ];

  const DEFAULT_REVIEWS = {};

  const normalizeForSearch = (value) => {
    if (!value) return "";
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  const buildSearchText = (...values) =>
    values
      .filter(Boolean)
      .join(" ")
      .trim();

  const COLOR_TOKENS = [
    ["den", "Đen"],
    ["black", "Đen"],
    ["trang", "Trắng"],
    ["white", "Trắng"],
    ["xanh", "Xanh"],
    ["blue", "Xanh"],
    ["do", "Đỏ"],
    ["red", "Đỏ"],
    ["vang", "Vàng"],
    ["yellow", "Vàng"],
    ["hong", "Hồng"],
    ["pink", "Hồng"],
    ["tim", "Tím"],
    ["purple", "Tím"],
    ["nau", "Nâu"],
    ["brown", "Nâu"],
    ["xam", "Xám"],
    ["gray", "Xám"],
    ["den trang", "Đen/Trắng"],
  ];

  const guessColorFromText = (text) => {
    if (!text) return "";
    const normalized = normalizeForSearch(text);
    for (const [token, label] of COLOR_TOKENS) {
      if (normalized.includes(token)) return label;
    }
    return "";
  };

  const extractTextFromUrl = (value) => {
    if (!value) return "";
    try {
      const decoded = decodeURIComponent(value.replace(/\+/g, " "));
      const match = decoded.match(/\/([^\/?#]+)(?:[?#].*)?$/);
      if (!match || !match[1]) return "";
      return match[1].replace(/\.[^.]+$/, "").replace(/[-_.]+/g, " ");
    } catch (error) {
      return value.replace(/[-_.]+/g, " ");
    }
  };

  const guessSizeFromText = (text) => {
    if (!text) return "";
    const normalized = normalizeForSearch(text).toUpperCase();
    const explicitMatch = normalized.match(
      /\b(FREE SIZE|ONE SIZE|ONESIZE|XS|S|M|L|XL|XXL|XXXL|XXXXL)\b/
    );
    if (explicitMatch) {
      return explicitMatch[1].replace(/\s+/g, " ");
    }
    const numericMatch = normalized.match(/\b(36|38|40|42|44|46|48|50)\b/);
    if (numericMatch) return numericMatch[1];
    const hintMatch = normalized.match(/\bkich co\s*([A-Z0-9]+)\b/);
    if (hintMatch) return hintMatch[1];
    return "";
  };

  const getSizeTypeFromCandidate = (value) => {
    if (!value) return "";
    if (/^\d+$/.test(value)) return "number";
    if (/^[A-Za-z]+$/.test(value)) return "letter";
    return "";
  };

  const CATEGORY_SIZE_TYPE = {
    sneakers: "number",
  };

  const getSizeTypeForProduct = (product) => {
    if (!product) return "letter";
    if (product.sizeType) return product.sizeType;
    if (product.category && CATEGORY_SIZE_TYPE[product.category]) {
      return CATEGORY_SIZE_TYPE[product.category];
    }
    if (Array.isArray(product.sizesNum) && product.sizesNum.length) return "number";
    if (Array.isArray(product.sizesText) && product.sizesText.length) return "letter";
    return getSizeTypeFromCandidate(product.defaultSize) || "letter";
  };

  const ensureProductHasDefaultTraits = (product) => {
    if (!product || typeof product !== "object") return product;
    const textSource = buildSearchText(
      product.name,
      product.desc,
      Array.isArray(product.tags) ? product.tags.join(" ") : ""
    );
    const imageText = extractTextFromUrl(
      product.image || (Array.isArray(product.images) ? product.images[0] : "") || ""
    );
    const combinedText = buildSearchText(textSource, imageText);
    const next = { ...product };
    if (!next.defaultColor) {
      const colorGuess = guessColorFromText(combinedText) || guessColorFromText(imageText);
      if (colorGuess) next.defaultColor = colorGuess;
    }
    const listedSizes = [
      ...(Array.isArray(next.sizesText) ? next.sizesText : []),
      ...(Array.isArray(next.sizesNum) ? next.sizesNum : []),
    ].filter(Boolean);
    const candidate =
      listedSizes[0] || guessSizeFromText(combinedText) || guessSizeFromText(imageText);
    if (!next.defaultSize) {
      next.defaultSize = candidate || "One size";
    }
    if (!next.sizeType) {
      const sourceValue = next.defaultSize || candidate;
      next.sizeType =
        getSizeTypeFromCandidate(sourceValue) ||
        CATEGORY_SIZE_TYPE[next.category] ||
        (next.sizesNum?.length ? "number" : "letter");
    }
    return next;
  };

  const ensureProductsValue = (value) => {
    if (!Array.isArray(value)) return value;
    return value.map((product) => ensureProductHasDefaultTraits(product));
  };

  const readStore = (key, fallback) => {
    try {
      const raw = store.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  };

  const buildSnapshot = () => ({
    meta: { updatedAt: new Date().toISOString() },
    settings: readStore(KEYS.settings, DEFAULT_SETTINGS),
    products: readStore(KEYS.products, DEFAULT_PRODUCTS),
    deletedProducts: readStore(KEYS.deletedProducts, []),
    orders: readStore(KEYS.orders, []),
    customers: readStore(KEYS.customers, {}),
    cart: readStore(KEYS.cart, []),
    wishlist: readStore(KEYS.wishlist, []),
    recent: readStore(KEYS.recent, []),
    reviews: readStore(KEYS.reviews, DEFAULT_REVIEWS),
  });

  const pushBackupHistory = (snapshot) => {
    try {
      const history = readStore(KEYS.backupHistory, []);
      const next = Array.isArray(history) ? history.slice(-4) : [];
      next.push(snapshot);
      store.setItem(KEYS.backupHistory, JSON.stringify(next));
    } catch (error) {
      // Ignore history write failures.
    }
  };

  const updateBackup = () => {
    const snapshot = buildSnapshot();
    try {
      store.setItem(KEYS.backup, JSON.stringify(snapshot));
    } catch (error) {
      // Ignore backup write failures.
    }
    pushBackupHistory(snapshot);
    return snapshot;
  };

  const getBackupSnapshot = () => readStore(KEYS.backup, null);

  const writeStore = (key, value) => {
    const payload = key === KEYS.products ? ensureProductsValue(value) : value;
    try {
      store.setItem(key, JSON.stringify(payload));
    } catch (error) {
      // Ignore storage write failures (private mode / quota) and fall back to memory.
    }
    if (
      [
        KEYS.settings,
        KEYS.products,
        KEYS.orders,
        KEYS.customers,
        KEYS.cart,
        KEYS.wishlist,
        KEYS.recent,
        KEYS.reviews,
      ].includes(key)
    ) {
      updateBackup();
    }
    if (!suppressSync && SYNC_KEYS.includes(key)) {
      syncDirty = true;
      scheduleSync("local-change");
    }
  };

  const EXCHANGE_RATE_APIS = [
    {
      url: "https://api.exchangerate.host/latest?base=CNY&symbols=JPY,VND",
      extract: (payload) => payload?.rates || {},
    },
    {
      url: "https://open.er-api.com/v6/latest/CNY",
      extract: (payload) => payload?.rates || {},
    },
  ];
  const RATE_FETCH_KEY = "oh_rate_fetch_at";
  const RATE_FETCH_TTL = 30 * 60 * 1000;

  const resolveRateValue = (value) => {
    if (typeof value === "number") return value;
    return parseNumberFromText(value);
  };

  const fetchLiveRates = async () => {
    let lastError = null;
    for (const source of EXCHANGE_RATE_APIS) {
      try {
        const response = await fetch(source.url, { cache: "no-store" });
        if (!response.ok) throw new Error("rate_fetch_failed");
        const payload = await response.json();
        const rates = source.extract(payload);
        const jpyRate = resolveRateValue(rates?.JPY);
        const vndRate = resolveRateValue(rates?.VND);
        if (jpyRate || vndRate) {
          return { jpy: jpyRate, vnd: vndRate };
        }
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("rate_fetch_failed");
  };
  const refreshLiveRates = async (force = false) => {
    try {
      const now = Date.now();
      const lastFetch = Number(store.getItem(RATE_FETCH_KEY) || "0");
      if (!force && now - lastFetch < RATE_FETCH_TTL) {
        return false;
      }
      const rates = await fetchLiveRates();
      store.setItem(RATE_FETCH_KEY, String(now));
      if (!rates?.jpy && !rates?.vnd) {
        return true;
      }
      const current = getSettings();
      const next = { ...current };
      let changed = false;
      if (typeof rates.jpy === "number" && rates.jpy !== current.rateJPY) {
        next.rateJPY = rates.jpy;
        changed = true;
      }
      if (typeof rates.vnd === "number" && rates.vnd !== current.rateVND) {
        next.rateVND = rates.vnd;
        changed = true;
      }
      if (changed || force) {
        next.rateUpdated = new Date().toISOString();
        setSettings(next);
      }
      return true;
    } catch (error) {
      console.warn("Live rate update failed:", error);
      return false;
    }
  };

  const fetchBackendOrders = async () => {
    try {
      const response = await fetch("/orders", { cache: "no-store" });
      if (!response.ok) throw new Error("Không thể lấy đơn");
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.orders)) {
        return [];
      }
      return payload.orders;
    } catch (error) {
      console.warn("Lấy đơn từ backend thất bại:", error);
      return [];
    }
  };

  const renderAdminOrderQueue = async (container, meta) => {
    if (!container) return;
    const orders = await fetchBackendOrders();
    if (!orders.length) {
      container.innerHTML =
        '<div class="card soft"><p>Chưa có đơn hàng mới từ backend.</p></div>';
      if (meta) meta.textContent = "Chưa có đơn hàng nào.";
      return;
    }
    const rows = orders.slice(0, 4).map((order) => {
      const totals = computeTotals(order, getSettings(), getProducts());
      const badge = getOrderPaymentBadge(order);
      const customerLabel = order.customer?.name || "Khách vãng lai";
      const phoneLabel = order.customer?.phone || "Chưa có số điện thoại";
      const contactFb = order.customer?.fb ? ` · FB: ${order.customer.fb}` : "";
      const statusLabel = formatOrderStatus(order.status);
      const totalLabel =
        typeof totals.totalJPY === "number" && typeof totals.totalVND === "number"
          ? `JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(totals.totalVND)}`
          : "Đang tính tổng";
      const timestamp = order.createdAt
        ? new Date(order.createdAt).toLocaleString("vi-VN")
        : "-";
      const note =
        Array.isArray(order.notes) && order.notes.length
          ? order.notes[order.notes.length - 1].text
          : "Chưa có ghi chú admin.";
      return `
        <article class="card admin-order-card">
          <div class="segment admin-order-head">
            <div>
              <strong>${customerLabel}</strong>
              <span class="helper">${phoneLabel}${contactFb}</span>
            </div>
            <span class="status ${badge.class}">${badge.label}</span>
          </div>
          <p><strong>Mã đơn:</strong> ${order.code}</p>
          <p><strong>Trạng thái:</strong> ${statusLabel}</p>
          <p><strong>Tổng:</strong> ${totalLabel}</p>
          <p><strong>Thời gian:</strong> ${timestamp}</p>
          <p class="helper">${note}</p>
          <div class="admin-order-actions">
            <button class="btn ghost small" type="button" data-action="view-order" data-order-id="${order.code}">
              Xem chi tiết
            </button>
            <button class="btn secondary small confirm-ship" data-order-id="${order.id}" type="button">
              Xác nhận ship
            </button>
          </div>
        </article>
      `;
    });
    container.innerHTML = rows.join("");
    container.querySelectorAll(".confirm-ship").forEach((button) => {
      const orderId = button.getAttribute("data-order-id");
      button.addEventListener("click", () => {
        button.disabled = true;
        confirmShipping(orderId)
          .catch((error) => {
            console.error("Không thể xác nhận ship:", error);
          })
          .finally(() => {
            button.disabled = false;
          });
      });
    });
    container.querySelectorAll("[data-action=\"view-order\"]").forEach((button) => {
      const orderCode = button.getAttribute("data-order-id");
      button.addEventListener("click", () => {
        if (!orderCode) return;
        window.location.href = `admin-orders.html?order=${encodeURIComponent(orderCode)}`;
      });
    });
    if (meta) meta.textContent = `Đã cập nhật ${new Date().toLocaleTimeString("vi-VN")}`;
  };

  const CUSTOMER_SECTION_IDS = ["adminNewCustomersList", "customerList"];

  const renderAdminNewCustomers = (container, limit = 6) => {
    if (!container) return;
    const searchTerm =
      container.id === "customerList" ? getCustomerSearchTerm() : "";
    const customers = getActiveCustomers();
    if (!customers.length) {
      container.innerHTML =
        '<div class="card soft"><p>Chưa có khách hàng được ghi nhận trên hệ thống.</p></div>';
      renderCustomerDetailPanel("");
      return;
    }
    let filtered = customers;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = customers.filter((customer) => {
        const name = (customer.name || "").toLowerCase();
        const phone = (customer.phone || "").toLowerCase();
        const fb = (customer.fb || "").toLowerCase();
        return name.includes(term) || phone.includes(term) || fb.includes(term);
      });
    }
    if (!filtered.length) {
      container.innerHTML =
        '<div class="card soft"><p>Không tìm thấy khách hàng phù hợp.</p></div>';
      renderCustomerDetailPanel("");
      return;
    }
    const ordersList = getOrders();
    const products = getVisibleProducts();
    const settings = getSettings();
    const sorted = filtered
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit);
    const markup = sorted
      .map((customer, index) => {
        const customerOrders = ordersList.filter(
          (entry) => entry.customerCode === customer.code
        );
        const orderTotals = customerOrders.map((order) =>
          computeTotals(order, settings, products)
        );
        const totalAll = orderTotals.reduce((sum, totals) => sum + (totals.totalVND || 0), 0);
        const totalPaid = customerOrders.reduce((sum, order, idx) => {
          if (order.paymentStatus !== PAYMENT_STATUS.CONFIRMED) return sum;
          return sum + (orderTotals[idx]?.totalVND || 0);
        }, 0);
        const outstanding = Math.max(0, totalAll - totalPaid);
        const messengerLink = getMessengerLink(customer.fb);
        const safeMessengerLink = messengerLink ? escapeHtml(messengerLink) : "";
        const safeFbLabel = escapeHtml(customer.fb || "Facebook chưa cập nhật");
        const messengerDisplay = safeMessengerLink
          ? `<a href="${safeMessengerLink}" target="_blank" rel="noopener">${safeFbLabel}</a>`
          : safeFbLabel;
        const phoneLabel = escapeHtml(customer.phone || "Chưa có số điện thoại");
        const phoneLink = customer.phone
          ? `<a href="tel:${phoneLabel}">${phoneLabel}</a>`
          : phoneLabel;
        const lastOrder =
          customerOrders
            .slice()
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;
        const lastOrderLabel = lastOrder
          ? `${lastOrder.code} · ${formatOrderStatus(lastOrder.status)}`
          : "Chưa có đơn hàng";
        const createdLabel = customer.createdAt
          ? formatDateTime(customer.createdAt)
          : "Không rõ thời gian";
        const isFresh = index < 3;
        const badgeClass = isFresh ? "badge green" : "badge orange";
        const badgeLabel = isFresh ? "Ưu tiên" : "Đã ghi nhận";
        const statusBadgeClass = lastOrder
          ? lastOrder.status === STATUS.CANCELLED
            ? "red"
            : "orange"
          : "";
        const paymentBadgeClass = lastOrder
          ? lastOrder.paymentStatus === PAYMENT_STATUS.CONFIRMED
            ? "green"
            : "red"
          : "";
        const orderStatusBadge = lastOrder
          ? `<span class="badge ${statusBadgeClass}">${escapeHtml(
              formatOrderStatus(lastOrder.status)
            )}</span>`
          : `<span class="badge">Chưa có đơn</span>`;
        const paymentStatusBadge = lastOrder
          ? `<span class="badge ${paymentBadgeClass}">${escapeHtml(
              formatPaymentStatus(lastOrder.paymentStatus)
            )}</span>`
          : "";
        const outstandingBadge = outstanding
          ? `<span class="badge orange">Chưa TT ${formatNumber(outstanding)} ₫</span>`
          : `<span class="badge green">Đã thanh toán</span>`;
        return `
          <article class="customer-card ${isFresh ? "customer-card--fresh" : ""}" data-customer-card data-code="${customer.code}">
            <div class="customer-card-head">
              <div>
                <strong>${escapeHtml(customer.name || "Khách hàng")}</strong>
                <span class="helper">${phoneLink}</span>
              </div>
              <div class="customer-card-head-meta">
                <span class="helper">${createdLabel}</span>
                <span class="${badgeClass}">${badgeLabel}</span>
              </div>
            </div>
            <div class="customer-card-finance">
              <div>
                <span class="label">Đơn hàng</span>
                <strong>${customerOrders.length}</strong>
              </div>
              <div>
                <span class="label">Đã thanh toán</span>
                <strong>${formatNumber(totalPaid)} ₫</strong>
              </div>
              <div>
                <span class="label">Chưa thanh toán</span>
                <strong>${formatNumber(outstanding)} ₫</strong>
              </div>
            </div>
            <div class="customer-card-meta">
              <span>FB: ${messengerDisplay}</span>
              <span class="helper small">Mới nhất: ${lastOrderLabel}</span>
            </div>
            <div class="customer-card-badges">
              ${orderStatusBadge}
              ${paymentStatusBadge}
              ${outstandingBadge}
            </div>
            <div class="customer-card-actions">
              <button class="btn ghost small" type="button" data-action="view-orders" data-code="${
                customer.code
              }">Danh sách đơn</button>
              <button class="btn danger small" type="button" data-action="delete-customer" data-code="${
                customer.code
              }">Xóa khách</button>
            </div>
          </article>
        `;
      })
      .join("");
    container.innerHTML = markup;
    bindCustomerSection(container);
    bindCustomerDetailPanel();
    renderCustomerDetailPanel(sorted[0]?.code || "");
  };

  const getCustomerSearchTerm = () => {
    const input = document.getElementById("customerSearch");
    return input?.value.trim().toLowerCase() || "";
  };

  const computeCustomerOrderStats = (customerCode) => {
    const orders = getOrders().filter((entry) => entry.customerCode === customerCode);
    const products = getVisibleProducts();
    const settings = getSettings();
    let totalPaid = 0;
    let outstanding = 0;
    orders.forEach((order) => {
      const totals = computeTotals(order, settings, products);
      if (order.paymentStatus === PAYMENT_STATUS.CONFIRMED) {
        totalPaid += totals.totalVND;
      } else {
        outstanding += totals.totalVND;
      }
    });
    return {
      orders,
      count: orders.length,
      paid: totalPaid,
      outstanding,
    };
  };

  const renderCustomerDetailPanel = (customerCode) => {
    const panel = document.getElementById("customerDetailPanel");
    if (!panel) return;
    if (!customerCode) {
      panel.innerHTML =
        '<div class="customer-detail-placeholder"><p class="helper">Chọn khách hàng để xem chi tiết.</p></div>';
      return;
    }
    const customer = findActiveCustomer(customerCode);
    if (!customer) {
      panel.innerHTML =
        '<div class="customer-detail-placeholder"><p class="helper">Khách hàng đã được xóa hoặc không tồn tại.</p></div>';
      return;
    }
    const stats = computeCustomerOrderStats(customerCode);
    const productSettings = getSettings();
    const productList = getProducts();
    const safeName = escapeHtml(customer.name || "Khách hàng");
    const safePhone = escapeHtml(customer.phone || "Chưa có số điện thoại");
    const safeAddress = escapeHtml(customer.address || "Địa chỉ chưa cập nhật");
    const sortedOrders = stats.orders
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const latestOrder = sortedOrders[0] || null;
    const recentOrders = sortedOrders
      .slice(0, 3)
      .map((order) => {
        const totals = computeTotals(order, productSettings, productList);
        return `
          <div class="customer-detail-order">
            <strong>${escapeHtml(order.code)}</strong>
            <span>${formatOrderStatus(order.status)}</span>
            <span>${formatPaymentStatus(order.paymentStatus)}</span>
            <span class="helper">JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(
              totals.totalVND
            )}</span>
          </div>
        `;
      })
      .join("");
    const messengerLink = getMessengerLink(customer.fb);
    const safeFbLabel = escapeHtml(customer.fb || "Chưa cập nhật");
    const messengerMarkup = messengerLink
      ? `<a href="${escapeHtml(messengerLink)}" target="_blank" rel="noopener">${safeFbLabel}</a>`
      : safeFbLabel;
    const phoneMarkup = customer.phone
      ? `<a href="tel:${escapeHtml(customer.phone)}">${escapeHtml(customer.phone)}</a>`
      : safePhone;
    const statusBadgeClass = latestOrder
      ? latestOrder.status === STATUS.CANCELLED
        ? "red"
        : "orange"
      : "";
    const paymentBadgeClass = latestOrder
      ? latestOrder.paymentStatus === PAYMENT_STATUS.CONFIRMED
        ? "green"
        : "red"
      : "";
    const latestOrderBadge = latestOrder
      ? `<span class="badge ${statusBadgeClass}">${escapeHtml(formatOrderStatus(latestOrder.status))}</span>`
      : `<span class="badge">Chưa có đơn</span>`;
    const latestPaymentBadge = latestOrder
      ? `<span class="badge ${paymentBadgeClass}">${escapeHtml(
          formatPaymentStatus(latestOrder.paymentStatus)
        )}</span>`
      : "";
    const outstandingBadge = stats.outstanding
      ? `<span class="badge orange">Còn nợ ${formatNumber(stats.outstanding)} ₫</span>`
      : `<span class="badge green">Không nợ</span>`;
    panel.innerHTML = `
      <div class="customer-detail-card">
        <div class="customer-detail-head">
          <div>
            <h3>${safeName}</h3>
            <span class="helper">${safePhone}</span>
            <span class="helper small">${safeAddress}</span>
            <span class="helper small">FB: ${escapeHtml(customer.fb || "Chưa cập nhật")}</span>
          </div>
          <div class="customer-detail-contact">
            <span>SĐT: ${phoneMarkup}</span>
            <span>Messenger: ${messengerMarkup}</span>
          </div>
        </div>
        <div class="customer-detail-badges">
          ${latestOrderBadge}
          ${latestPaymentBadge}
          ${outstandingBadge}
        </div>
        <div class="customer-detail-stats">
          <span>Đơn hàng: ${stats.count}</span>
          <span>Đã TT: ${formatNumber(stats.paid)} ₫</span>
          <span>Chưa TT: ${formatNumber(stats.outstanding)} ₫</span>
        </div>
        <div class="customer-detail-orders">
          <h4>Đơn gần nhất</h4>
          ${recentOrders || '<p class="helper small">Chưa có đơn hàng.</p>'}
        </div>
        <div class="customer-detail-actions">
          <button class="btn ghost small" type="button" data-action="view-orders" data-code="${customerCode}">
            Xem đơn hàng
          </button>
          <button class="btn danger small" type="button" data-action="delete-customer" data-code="${customerCode}">
            Xóa khách
          </button>
        </div>
      </div>
    `;
  };

  const handleCustomerDetailAction = (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const code = button.dataset.code;
    if (action === "delete-customer") {
      removeCustomerByCode(code);
      return;
    }
    if (action === "view-orders") {
      window.location.href = `admin-orders.html?customer=${code}`;
    }
  };

  const bindCustomerDetailPanel = () => {
    const panel = document.getElementById("customerDetailPanel");
    if (!panel || panel.dataset.bound === "1") return;
    panel.dataset.bound = "1";
    panel.addEventListener("click", handleCustomerDetailAction);
  };

  const renderAllCustomerSections = () => {
    CUSTOMER_SECTION_IDS.forEach((id) => {
      const limit = id === "customerList" ? 12 : 6;
      renderAdminNewCustomers(document.getElementById(id), limit);
    });
    refreshAdminInsights();
  };

  const removeCustomerByCode = (code) => {
    if (!code) return;
    const customers = getCustomers();
    const customer = customers[code];
    if (!customer) return;
    const confirmMessage = customer.name
      ? `Bạn có chắc muốn xoá khách hàng ${customer.name} vĩnh viễn?`
      : `Bạn có chắc muốn xoá khách hàng ${code}?`;
    if (!window.confirm(confirmMessage)) return;
    const displayName = customer.name || code;
    delete customers[code];
    setCustomers(customers);
    renderAllCustomerSections();
    renderCustomerDetailPanel("");
    showOrderNotice(`Đã xóa khách hàng ${displayName}.`);
  };

  const handleCustomerCardAction = (event) => {
    const button = event.target.closest("[data-action]");
    const card = event.target.closest("[data-customer-card]");
    const cardCode = card?.dataset?.code;
    const actionCode = button?.dataset?.code;
    const code = actionCode || cardCode;
    if (code) {
      renderCustomerDetailPanel(code);
    }
    if (!button) return;
    const action = button.dataset.action;
    if (action === "delete-customer") {
      removeCustomerByCode(actionCode);
      return;
    }
    if (action === "view-orders") {
      window.location.href = `admin-orders.html?customer=${actionCode}`;
    }
  };

  const bindCustomerSection = (container) => {
    if (!container) return;
    if (container.dataset.customerBound === "1") return;
    container.dataset.customerBound = "1";
    container.addEventListener("click", handleCustomerCardAction);
  };

  const confirmShipping = async (orderId) => {
    if (!orderId) return;
    try {
      const response = await fetch(`/orders/${orderId}/ship-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => ({}));
      if (payload?.message) showOrderNotice(payload.message);
      if (payload?.order) {
        handleOrderEvent(payload.order);
      }
      return payload;
    } catch (error) {
      console.warn("Xác nhận ship thất bại:", error);
      showOrderNotice("Không thể cập nhật trạng thái ship.");
      throw error;
    }
  };

  const getSnapshot = () => getBackupSnapshot() || buildSnapshot();

  const applySnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return false;
    if (snapshot.settings) writeStore(KEYS.settings, snapshot.settings);
    if (snapshot.products) writeStore(KEYS.products, snapshot.products);
    if (Array.isArray(snapshot.deletedProducts)) {
      writeStore(KEYS.deletedProducts, snapshot.deletedProducts);
    }
    if (snapshot.orders) writeStore(KEYS.orders, snapshot.orders);
    if (snapshot.customers) writeStore(KEYS.customers, snapshot.customers);
    if (snapshot.cart) writeStore(KEYS.cart, snapshot.cart);
    if (snapshot.wishlist) writeStore(KEYS.wishlist, snapshot.wishlist);
    if (snapshot.recent) writeStore(KEYS.recent, snapshot.recent);
    if (snapshot.reviews) writeStore(KEYS.reviews, snapshot.reviews);
    updateBackup();
    return true;
  };

  const downloadJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const seedData = () => {
    const existingSettings = readStore(KEYS.settings, null);
    const normalizedSettings = normalizeSettings(existingSettings);
    if (!normalizedSettings.updatedAt) normalizedSettings.updatedAt = 0;
    writeStore(KEYS.settings, normalizedSettings);
    const existingProducts = readStore(KEYS.products, null);
    let deletedProductIds = getDeletedProductIds();
    const legacyDeletedIds =
      Array.isArray(existingProducts)
        ? existingProducts
            .filter((product) => product?.deletedAt && product.id)
            .map((product) => product.id)
        : [];
    if (legacyDeletedIds.length) {
      const nextDeletedIds = new Set(deletedProductIds);
      legacyDeletedIds.forEach((id) => nextDeletedIds.add(id));
      setDeletedProductIds(nextDeletedIds);
      deletedProductIds = nextDeletedIds;
    }
    const filteredExisting = Array.isArray(existingProducts)
      ? existingProducts.filter(
          (product) => product && !product.deletedAt && !deletedProductIds.has(product.id)
        )
      : [];
    if (!filteredExisting.length) {
      const seededDefaults = DEFAULT_PRODUCTS.filter(
        (item) => item.id && !deletedProductIds.has(item.id)
      );
      writeStore(KEYS.products, seededDefaults);
    } else {
      const defaultMap = new Map(DEFAULT_PRODUCTS.map((item) => [item.id, item]));
      const merged = filteredExisting.map((item) =>
        defaultMap.has(item.id) ? { ...defaultMap.get(item.id), ...item } : item
      );
      const existingIds = new Set(merged.map((item) => item.id));
      DEFAULT_PRODUCTS.forEach((item) => {
        if (item.id && !existingIds.has(item.id) && !deletedProductIds.has(item.id)) {
          merged.push(item);
        }
      });
      writeStore(KEYS.products, merged);
    }
    if (!store.getItem(KEYS.cart)) writeStore(KEYS.cart, []);
    if (!store.getItem(KEYS.orders)) writeStore(KEYS.orders, []);
    if (!store.getItem(KEYS.customers)) writeStore(KEYS.customers, {});
    if (!store.getItem(KEYS.wishlist)) writeStore(KEYS.wishlist, []);
    if (!store.getItem(KEYS.recent)) writeStore(KEYS.recent, []);
    if (!store.getItem(KEYS.reviews)) writeStore(KEYS.reviews, DEFAULT_REVIEWS);
    const existingOrders = readStore(KEYS.orders, []);
    if (Array.isArray(existingOrders) && existingOrders.length) {
      const normalizedOrders = existingOrders.map((order) => ({
        ...order,
        paymentCode: order.paymentCode || order.code,
        timeline: Array.isArray(order.timeline) ? order.timeline : [],
        updatedAt: order.updatedAt ?? order.createdAt ?? 0,
      }));
      writeStore(KEYS.orders, normalizedOrders);
    }
    if (!store.getItem(KEYS.productSeq)) {
      store.setItem(KEYS.productSeq, String(DEFAULT_PRODUCTS.length + 1));
    }
    if (!store.getItem(KEYS.syncCheckpoint)) store.setItem(KEYS.syncCheckpoint, "0");
    ensureProductReviewsSeeded();
    updateBackup();
  };

  const getSettings = () =>
    normalizeSettings(readStore(KEYS.settings, DEFAULT_SETTINGS));
  const setSettings = (settings) =>
    writeStore(KEYS.settings, { ...normalizeSettings(settings), updatedAt: Date.now() });

  const normalizeDeletedProductValues = (values) => {
    let list = values;
    if (list instanceof Set) list = Array.from(list);
    if (!Array.isArray(list)) list = [];
    return Array.from(new Set(list.filter(Boolean)));
  };

  const getDeletedProductIds = () =>
    new Set(normalizeDeletedProductValues(readStore(KEYS.deletedProducts, [])));

  const setDeletedProductIds = (values) => {
    const normalized = normalizeDeletedProductValues(values);
    writeStore(KEYS.deletedProducts, normalized);
  };

  const addDeletedProductId = (id) => {
    if (!id) return;
    const current = getDeletedProductIds();
    current.add(id);
    setDeletedProductIds(current);
  };

  const removeDeletedProductId = (id) => {
    if (!id) return;
    const current = getDeletedProductIds();
    if (!current.has(id)) return;
    current.delete(id);
    setDeletedProductIds(current);
  };

  const isProductIdDeleted = (id) => Boolean(id && getDeletedProductIds().has(id));

  const getProducts = () => readStore(KEYS.products, DEFAULT_PRODUCTS);
  const setProducts = (products) => writeStore(KEYS.products, products);
  const getProductReviews = () => readStore(KEYS.reviews, DEFAULT_REVIEWS);
  const setProductReviews = (reviews) => writeStore(KEYS.reviews, reviews);

  const getReviewsForProduct = (productId) => {
    if (!productId) return [];
    const allReviews = getProductReviews() || {};
    const list = Array.isArray(allReviews[productId]) ? allReviews[productId] : [];
    return [...list].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  };

  const addReviewForProduct = (productId, review) => {
    if (!productId || !review) return [];
    const current = getProductReviews() || {};
    const existing = Array.isArray(current[productId]) ? current[productId] : [];
    const nextList = [review, ...existing].slice(0, 80);
    setProductReviews({ ...current, [productId]: nextList });
    return nextList;
  };

  const buildReviewStats = (reviewsList = []) => {
    const normalized = Array.isArray(reviewsList) ? reviewsList : [];
    const total = normalized.length;
    if (!total) {
      return { total: 0, average: 0, positiveRate: 0 };
    }
    const sum = normalized.reduce((acc, entry) => acc + Number(entry.rating || 0), 0);
    const positiveCount = normalized.filter((entry) => Number(entry.rating || 0) >= 4).length;
    return {
      total,
      average: sum / total,
      positiveRate: Math.round((positiveCount / total) * 100),
    };
  };

  const hashString = (value) => {
    let hash = 0;
    if (!value) return hash;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const getDefaultReviewStatsForProduct = (product) => {
    if (!product) return { total: 25, average: 4.7, positiveRate: 92 };
    const seed = `${product.id || ""}:${product.name || ""}`;
    const hash = hashString(seed);
    const average = Math.min(5, 4.5 + (hash % 51) / 100);
    const total = 23 + (hash % 5);
    const positiveRate = Math.min(100, 90 + (hash % 11));
    return {
      total,
      average,
      positiveRate,
    };
  };

  const createSeededRandom = (seed) => {
    let state = hashString(seed) || 1;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  };

  const REVIEW_AUTHOR_NAMES = [
    "An", "Bảo", "Chi", "Cường", "Duy", "Em", "Hà", "Hân", "Hưng", "Khoa",
    "Linh", "Mai", "My", "Nhi", "Quân", "Sơn", "Thảo", "Trâm", "Uyên", "Viên", "Yến",
  ];
  const REVIEW_ADJECTIVES = ["mềm mại", "gọn gàng", "chắc chắn", "tinh tế", "phẳng", "thoáng", "mịn", "sang trọng"];
  const REVIEW_FEATURES = ["form", "chất vải", "đường may", "phân tầng", "màu sắc", "chi tiết viền", "phom dáng", "phần cổ"];
  const REVIEW_CONTEXTS = [
    "đi làm", "đi chơi cuối tuần", "đi cà phê", "đi dạo phố", "đi đón bạn", "mặc ở nhà", "phối đồ đi du lịch",
    "đi họp online", "di chuyển sân bay", "dự tiệc nhỏ",
  ];
  const REVIEW_COLORS = ["đen", "trắng", "be", "nâu", "xám", "xanh lá", "xanh dương", "xám tro"];
  const REVIEW_TIMES = [
    "vừa nhận", "đã dùng vài ngày", "mới thử hôm nay", "vừa order xong", "đã xài hơn 1 tuần", "đang thử mặc",
  ];
  const REVIEW_CATEGORY_CONTEXTS = {
    outerwear: ["đi dạo phố mùa lạnh", "đi cafe trời đông", "đi du lịch ngắn ngày vùng cao"],
    sneakers: ["đi bộ sáng trong phố", "ghé gym buổi chiều", "ra ngoài khi mưa nhẹ"],
    bags: ["đi làm văn phòng", "đi cà phê cuối tuần", "đi du lịch tay nhẹ"],
    lifestyle: ["ở nhà thư giãn", "đi cafe với bạn thân", "mix đồ đi dạo phố"],
  };
  const REVIEW_ACTIONS = ["mình đặt", "Mình order", "Đã lấy", "Mới gom", "Đã chốt", "Vừa chọn"];
  const REVIEW_INTROS = [
    "{action} {product} cho {context},",
    "Trong lúc {contextAlt}, {product} khiến mình có cảm nhận là",
    "{time}, {product} thật sự",
    "Lần đầu mình thử {product} cho {context},",
    "Thử {product} vài lần thì",
  ];
  const REVIEW_DETAILS = [
    "{feature} {adjective}, đường may chắc và {contextAlt} vẫn ổn.",
    "Màu {color} đúng chuẩn ảnh, size {size} ôm vừa mà không chật.",
    "Từ chất vải tới phom dáng, {feature} giữ {adjective} suốt {context}.",
    "Mô tả {description} đúng chuẩn, {feature} {adjective}.",
    "Mang {product} đi {contextAlt} mà {feature} không nhăn, cảm giác {adjective}.",
  ];
  const REVIEW_HIGHLIGHTS = [
    "{product} vẫn giữ {adjective} dù mình {context} cả ngày.",
    "Phối {color} với outfit khác mà {feature} không mất phom.",
    "Đây là mẫu hiếm mình thấy {contextAlt} vẫn nhẹ, rất {adjective}.",
    "Ai cũng khen {product} khi mình cho họ thử, đặc biệt {feature}.",
    "Độ {feature} vừa phải giúp mình tự tin khi {context}.",
  ];
  const REVIEW_CLOSINGS = [
    "Kết lại là mình cho 5 sao và sẽ order lại.",
    "Mình giới thiệu {product} cho đám bạn và ai cũng muốn lấy thêm.",
    "Nếu bạn cần {context} dễ chịu, cứ chọn {product}.",
    "Đợi khi có khuyến mãi sẽ rinh thêm vài màu khác.",
    "Cảm ơn shop giữ dịch vụ nhanh và {feature} vẫn chuẩn.",
  ];
  const pickFromList = (list, random, index, offset = 0) => {
    if (!Array.isArray(list) || !list.length) return { value: "", idx: 0 };
    const rawIndex = Math.floor(random() * list.length);
    const normalized = (rawIndex + index + offset) % list.length;
    return { value: list[normalized], idx: normalized };
  };
  const resolveProductContexts = (product) => {
    const category = String(product?.category || "").toLowerCase();
    const categoryContexts = Array.isArray(REVIEW_CATEGORY_CONTEXTS[category])
      ? REVIEW_CATEGORY_CONTEXTS[category]
      : [];
    const baseContexts = Array.isArray(REVIEW_CONTEXTS) ? REVIEW_CONTEXTS : [];
    const combined = Array.from(new Set([...categoryContexts, ...baseContexts]));
    if (combined.length) return combined;
    if (baseContexts.length) return baseContexts;
    return ["đi chơi"];
  };

  const applyReviewTemplate = (template, values = {}) =>
    template.replace(/\{(\w+)\}/g, (_, key) => values[key] || "");

  const buildSampleReviewText = (product, random, index = 0) => {
    const contexts = resolveProductContexts(product);
    const contextPick = pickFromList(contexts, random, index, 0);
    const context = contextPick.value || "đi chơi";
    const contextAlt =
      contexts.length > 1
        ? contexts[(contextPick.idx + 1) % contexts.length]
        : context;
    const actionPick = pickFromList(REVIEW_ACTIONS, random, index, 1);
    const timePick = pickFromList(REVIEW_TIMES, random, index, 2);
    const featurePick = pickFromList(REVIEW_FEATURES, random, index, 3);
    const adjectivePick = pickFromList(REVIEW_ADJECTIVES, random, index, 4);
    const paletteColors = Array.isArray(product.palette) ? product.palette.filter(Boolean) : [];
    const paletteChoices = paletteColors.length ? paletteColors : REVIEW_COLORS;
    const paletteIndex = Math.floor(random() * paletteChoices.length);
    const colorLabel =
      product.defaultColor || paletteChoices[paletteIndex] || "màu";
    const sizeLabel = getProductSizeList(product)[0] || "cỡ chuẩn";
    const trimmedName =
      (product.name || "sản phẩm").split("·")[0].split("-")[0].trim();
    const descriptionSnippet = (product.desc || "mẫu này").split(".")[0].trim() || "mẫu này";
    const values = {
      product: trimmedName || "sản phẩm",
      feature: featurePick.value || "form",
      adjective: adjectivePick.value || "mềm mại",
      context,
      contextAlt,
      color: (colorLabel || "màu").toLowerCase(),
      size: sizeLabel,
      time: timePick.value || "vừa nhận",
      action: actionPick.value || "Mình order",
      description: descriptionSnippet,
    };
    const intro = applyReviewTemplate(
      pickFromList(REVIEW_INTROS, random, index, 5).value,
      values
    );
    const detail = applyReviewTemplate(
      pickFromList(REVIEW_DETAILS, random, index, 6).value,
      values
    );
    const highlight = applyReviewTemplate(
      pickFromList(REVIEW_HIGHLIGHTS, random, index, 7).value,
      values
    );
    const closing = applyReviewTemplate(
      pickFromList(REVIEW_CLOSINGS, random, index, 8).value,
      values
    );
    return [intro, detail, highlight, closing]
      .filter(Boolean)
      .map((sentence) => sentence.trim())
      .join(" ");
  };

  const ensureProductReviewsSeeded = () => {
    const products = getProducts();
    if (!Array.isArray(products)) return;
    const existing = getProductReviews() || {};
    const next = { ...existing };
    let changed = false;
    products.forEach((product) => {
      if (!product?.id) return;
      const key = product.id;
      const current = Array.isArray(next[key]) ? next[key] : [];
      const desiredCount = Math.min(
        12,
        5 + Math.floor(createSeededRandom(`${key}-review-count`)() * 8)
      );
      if (current.length >= desiredCount) return;
      const additions = [];
      for (let index = current.length; index < desiredCount; index += 1) {
        const reviewSeed = `${key}-review-${index}`;
        const reviewRandom = createSeededRandom(reviewSeed);
        const rating = 4 + Math.floor(reviewRandom() * 2);
        const text = buildSampleReviewText(product, reviewRandom, index);
        const author =
          REVIEW_AUTHOR_NAMES[Math.floor(reviewRandom() * REVIEW_AUTHOR_NAMES.length)] ||
          `Khách ${index + 1}`;
        const createdAt =
          Date.now() - (index * 86400000 + Math.floor(reviewRandom() * 3600000));
        additions.push({
          id: `sample-${reviewSeed}`,
          name: author,
          rating,
          text,
          attachments: [],
          createdAt,
        });
      }
      next[key] = [...current, ...additions];
      changed = true;
    });
    if (changed) {
      setProductReviews(next);
    }
  };

  const stripHtml = (value) =>
    String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const parseDescriptionFromHtml = (html) => {
    if (!html) return "";
    const metaMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    if (metaMatch && metaMatch[1]) return metaMatch[1].trim();
    const paragraphMatch = html.match(/<p[^>]*>(.*?)<\/p>/i);
    if (paragraphMatch && paragraphMatch[1]) return stripHtml(paragraphMatch[1]);
    const bodyParts = html.split("</head>");
    const candidate = bodyParts.length > 1 ? bodyParts[1] : html;
    return stripHtml(candidate).slice(0, 400);
  };

  const fetchDescriptionFromLink = async (url) => {
    if (!url || typeof fetch !== "function") return null;
    const hasAbort = typeof AbortController !== "undefined";
    const controller = hasAbort ? new AbortController() : null;
    const signal = controller ? controller.signal : undefined;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), 6000)
      : null;
    try {
      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        ...(signal ? { signal } : {}),
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (!response.ok) return null;
      const html = await response.text();
      return parseDescriptionFromHtml(html);
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn("Không thể lấy mô tả từ link:", error);
      return null;
    }
  };

  const getOrderEndpoint = () => (getSettings().orderEndpoint || "/orders");

  const ensureNoticePanel = () => {
    let panel = document.getElementById("orderNotice");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "orderNotice";
      panel.className = "order-notice";
      document.body.appendChild(panel);
    }
    return panel;
  };

  const handleOrderEvent = (order) => {
    if (!order || !order.id) return;
    const orders = getOrders();
    const index = orders.findIndex((entry) => entry.id === order.id);
    if (index === -1) {
      orders.unshift(order);
    } else {
      orders[index] = { ...orders[index], ...order };
    }
    setOrders(orders);
    showOrderNotice(`Đơn hàng ${order.id} cập nhật: ${formatOrderStatus(order.status)}`);
    if (document.body.dataset.page === "admin-dashboard") {
      const orderPanel = document.getElementById("adminOrdersPanel");
      const orderMeta = document.getElementById("adminOrderRefreshMeta");
      renderAdminOrderQueue(orderPanel, orderMeta).catch((error) => {
        console.error("Không thể cập nhật panel sau event:", error);
      });
      refreshAdminWorkflow();
    }
  };

  const initOrderStream = () => {
    if (typeof EventSource === "undefined") return;
    try {
      const source = new EventSource("/events");
      source.addEventListener("orderUpdate", (event) => {
        try {
          const payload = JSON.parse(event.data || "{}");
          handleOrderEvent(payload.order);
        } catch (error) {
          console.warn("Không thể parse event orderUpdate:", error);
        }
      });
      source.addEventListener("message", (event) => {
        if (event.data) showOrderNotice(event.data);
      });
      source.addEventListener("error", (event) => {
        console.warn("Order stream error", event);
      });
      window.addEventListener("beforeunload", () => source.close());
    } catch (error) {
      console.warn("EventSource init failed:", error);
    }
  };

  let noticeTimer = null;
  const showOrderNotice = (message) => {
    if (!message) return;
    const panel = ensureNoticePanel();
    panel.textContent = message;
    panel.classList.add("visible");
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => panel.classList.remove("visible"), 12000);
  };


  const needsDefaultTraits = (product) =>
    Boolean(product) && (!product.defaultColor || !product.defaultSize);

  const patchProductsForDefaults = () => {
    const products = getProducts();
    if (!Array.isArray(products)) return;
    if (!products.some(needsDefaultTraits)) return;
    setProducts(products);
  };

  const getVisibleProducts = () => {
    const removedIds = getDeletedProductIds();
    return getProducts().filter((product) => {
      if (!product) return false;
      if (product.hidden || product.deletedAt) return false;
      if (!product.id) return true;
      return !removedIds.has(product.id);
    });
  };

  const normalizeExternalUrl = (raw) => {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return "";
    let value = trimmed;
    if (trimmed.startsWith("//")) value = `https:${trimmed}`;
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    return value;
  };

  const buildProxyFetchUrl = (targetUrl) => {
    try {
      const parsed = new URL(targetUrl);
      const scheme = parsed.protocol.replace(":", "");
      return `https://r.jina.ai/${scheme}://${parsed.host}${parsed.pathname}${parsed.search}`;
    } catch (error) {
      return "";
    }
  };

  const parseSimplePageMetadata = (html, sourceUrl) => {
    if (!html) return {};
    const doc = new DOMParser().parseFromString(html, "text/html");
    const readMeta = (selector) => doc.querySelector(selector)?.getAttribute("content")?.trim() || "";
    const title =
      readMeta('meta[property="og:title"]') ||
      readMeta('meta[name="title"]') ||
      readMeta('meta[property="twitter:title"]') ||
      doc.title ||
      "";
    const description =
      readMeta('meta[property="og:description"]') ||
      readMeta('meta[name="description"]') ||
      readMeta('meta[property="twitter:description"]') ||
      "";
    const image =
      normalizeExternalUrl(
        readMeta('meta[property="og:image"]') ||
          readMeta('meta[name="twitter:image"]') ||
          readMeta('meta[property="og:image:secure_url"]') ||
          ""
      ) || "";
    const price =
      readMeta('meta[property="product:price:amount"]') ||
      readMeta('meta[property="og:price:amount"]') ||
      readMeta('meta[name="twitter:data1"]') ||
      "";
    return {
      name: title,
      desc: description,
      image,
      price: price || "",
      sourceUrl,
    };
  };

  const fetchLinkMetadata = async (url) => {
    if (!url) return null;
    const normalizedUrl = normalizeExternalUrl(url);
    if (!normalizedUrl) return null;
    const proxyUrl = buildProxyFetchUrl(normalizedUrl);
    if (!proxyUrl) return null;
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("fetch_failed");
      const html = await response.text();
      return parseSimplePageMetadata(html, normalizedUrl);
    } catch (error) {
      console.warn("Failed to fetch link metadata:", error);
      return null;
    }
  };

  const getCustomerRequests = () => readStore(KEYS.customerRequests, []);
  const setCustomerRequests = (requests) =>
    writeStore(KEYS.customerRequests, Array.isArray(requests) ? requests : []);
  const addCustomerRequest = (entry) => {
    const existing = getCustomerRequests();
    setCustomerRequests([entry, ...existing]);
  };

  const isPriorityProductEntry = (product) =>
    Boolean(product?.primary || product?.priority === "primary" || product?.flags?.includes?.("priority"));

  const getFilteredAndSortedProducts = (
    searchInput,
    priceMin,
    priceMax,
    sizeFilter,
    categoryFilter,
    sortFilter,
    sizeModeValue
  ) => {
    const query = searchInput.value.trim().toLowerCase();
    const min = Number(priceMin.value) || 0;
    const max = Number(priceMax.value) || Infinity;
    const size = sizeFilter.value.trim();
    const category = categoryFilter.value;

    let results = getVisibleProducts().filter((product) => {
      const tagsText = (product.tags || []).join(" ").toLowerCase();
      const sourceText = (product.source || "web").toLowerCase();
      const matchQuery =
        !query ||
        product.name.toLowerCase().includes(query) ||
        tagsText.includes(query) ||
        sourceText.includes(query);
      const priced = applyProductFee(product.basePrice);
      const matchPrice = priced >= min && priced <= max;
      const sizes = [...(product.sizesText || []), ...(product.sizesNum || [])];
      const matchSize = !size || sizes.includes(size);
      const matchCategory = !category || product.category === category;
      const matchSizeMode = !sizeModeValue || getSizeTypeForProduct(product) === sizeModeValue;
      return matchQuery && matchPrice && matchSize && matchCategory && matchSizeMode;
    });

    const sortValue = sortFilter.value;
    const toProductStamp = (entry) => toTimestamp(entry?.createdAt);
    if (sortValue === "price-asc") {
      results = results.sort(
        (a, b) => applyProductFee(a.basePrice) - applyProductFee(b.basePrice)
      );
    }
    if (sortValue === "price-desc") {
      results = results.sort(
        (a, b) => applyProductFee(b.basePrice) - applyProductFee(a.basePrice)
      );
    }
    if (sortValue === "new" || !sortValue) {
      results = results.sort((a, b) => toProductStamp(b) - toProductStamp(a));
    }
    results = results.sort((a, b) => {
      const pa = isPriorityProductEntry(a) ? 0 : 1;
      const pb = isPriorityProductEntry(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return toProductStamp(b) - toProductStamp(a);
    });
    return results;
  };

  const getCart = () => readStore(KEYS.cart, []);
  const setCart = (cart) => writeStore(KEYS.cart, cart);

  const getOrders = () => readStore(KEYS.orders, []);
  const setOrders = (orders) => writeStore(KEYS.orders, orders);

  const getCustomers = () => readStore(KEYS.customers, {});
  const setCustomers = (customers) => writeStore(KEYS.customers, customers);
  const getCustomerProfile = () => {
    const code = getDeviceCustomerCode();
    const customers = getCustomers();
    return customers[code] || {};
  };

  const isCustomerActive = (customer) => Boolean(customer && !customer.deletedAt);
  const getActiveCustomers = () => Object.values(getCustomers()).filter(isCustomerActive);
  const findActiveCustomer = (code) => {
    if (!code) return null;
    const customer = getCustomers()[code];
    return isCustomerActive(customer) ? customer : null;
  };

  const getCustomerOrders = () => {
    const customerCode = getDeviceCustomerCode();
    return getOrders().filter((entry) => entry.customerCode === customerCode);
  };

  const copyCustomerCodeToClipboard = () => {
    const button = document.getElementById("copyCustomerCode");
    if (!button) return;
    button.addEventListener("click", () => {
      const code = getDeviceCustomerCode();
      if (!code) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(
          () => showOrderNotice("Mã khách đã được sao chép"),
          () => showOrderNotice("Không thể sao chép mã khách")
        );
      } else {
        showOrderNotice("Trình duyệt không hỗ trợ sao chép tự động.");
      }
    });
  };

  const fillCheckoutFormWithProfile = () => {
    const profile = getCustomerProfile();
    const nameEl = document.getElementById("customerName");
    const phoneEl = document.getElementById("customerPhone");
    const addressEl = document.getElementById("customerAddress");
    const fbEl = document.getElementById("customerFb");
    if (nameEl && profile.name) nameEl.value = profile.name;
    if (phoneEl && profile.phone) phoneEl.value = profile.phone;
    if (addressEl && profile.address) addressEl.value = profile.address;
    if (fbEl && profile.fb) fbEl.value = profile.fb;
  };

  const getWishlist = () => readStore(KEYS.wishlist, []);
  const setWishlist = (items) => writeStore(KEYS.wishlist, items);
  const isWishlisted = (id) => getWishlist().includes(id);
  const toggleWishlist = (id) => {
    const items = getWishlist();
    const index = items.indexOf(id);
    if (index >= 0) {
      items.splice(index, 1);
      setWishlist(items);
      return false;
    }
    items.unshift(id);
    setWishlist(items.slice(0, 40));
    return true;
  };

  const getRecent = () => readStore(KEYS.recent, []);
  const setRecent = (items) => writeStore(KEYS.recent, items);
  const addRecent = (id) => {
    const items = getRecent().filter((item) => item !== id);
    items.unshift(id);
    const next = items.slice(0, 12);
    setRecent(next);
    return next;
  };

  const SYNC_KEYS = [
    KEYS.settings,
    KEYS.products,
    KEYS.orders,
    KEYS.customers,
    KEYS.customerRequests,
  ];
  const SYNC_LISTENERS = new Set();
  const registerSyncListener = (listener) => {
    if (typeof listener === "function") {
      SYNC_LISTENERS.add(listener);
    }
  };
  const triggerSyncListeners = () => {
    SYNC_LISTENERS.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.warn("Sync listener failed:", error);
      }
    });
  };
  const SYNC_DELAY = 1200;
  let syncTimer = null;
  let syncInFlight = false;
  let syncPending = false;
  let syncDirty = false;
  let suppressSync = false;

  const toTimestamp = (value) => {
    if (!value && value !== 0) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string" && /^[0-9]+$/.test(value)) {
      return Number(value);
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getItemStamp = (item) =>
    Math.max(toTimestamp(item?.updatedAt), toTimestamp(item?.createdAt));

  const getSnapshotStamp = (snapshot) => {
    if (!snapshot) return 0;
    const settingsStamp = toTimestamp(snapshot.settings?.updatedAt);
    const productsStamp = Math.max(
      0,
      ...(snapshot.products || []).map((item) => getItemStamp(item))
    );
    const ordersStamp = Math.max(
      0,
      ...(snapshot.orders || []).map((item) => getItemStamp(item))
    );
    const customerValues = snapshot.customers ? Object.values(snapshot.customers) : [];
    const customersStamp = Math.max(
      0,
      ...customerValues.map((item) => getItemStamp(item))
    );
    return Math.max(settingsStamp, productsStamp, ordersStamp, customersStamp);
  };

  const buildSyncSnapshot = () => {
    const payload = {
      settings: getSettings(),
      products: getProducts(),
      orders: getOrders(),
      customers: getCustomers(),
    };
    const stamp = getSnapshotStamp(payload);
    return {
      meta: { updatedAt: stamp ? new Date(stamp).toISOString() : new Date(0).toISOString() },
      ...payload,
    };
  };

  const pickLatest = (local, remote) => {
    if (!local && !remote) return null;
    if (!local) return remote;
    if (!remote) return local;
    const localStamp = getItemStamp(local);
    const remoteStamp = getItemStamp(remote);
    return localStamp >= remoteStamp ? local : remote;
  };

  const mergeArrayByKey = (local = [], remote = [], key) => {
    const map = new Map();
    remote.forEach((item) => {
      if (!item || !item[key]) return;
      map.set(item[key], item);
    });
    local.forEach((item) => {
      if (!item || !item[key]) return;
      const existing = map.get(item[key]);
      if (!existing || getItemStamp(item) >= getItemStamp(existing)) {
        map.set(item[key], item);
      }
    });
    return Array.from(map.values());
  };

  const mergeCustomers = (local = {}, remote = {}) => {
    const merged = { ...remote };
    Object.entries(local).forEach(([key, value]) => {
      if (!value) return;
      const existing = merged[key];
      if (!existing || getItemStamp(value) >= getItemStamp(existing)) {
        merged[key] = value;
      }
    });
    return merged;
  };

  const mergeSnapshots = (local, remote) => {
    const baseSettings = pickLatest(local?.settings, remote?.settings) || getSettings();
    const mergedSettings = {
      ...baseSettings,
      syncEndpoint: local?.settings?.syncEndpoint || baseSettings.syncEndpoint,
      syncKey: local?.settings?.syncKey || baseSettings.syncKey,
      importEndpoint: local?.settings?.importEndpoint || baseSettings.importEndpoint,
      importCookie: local?.settings?.importCookie || baseSettings.importCookie,
    };
    const merged = {
      settings: mergedSettings,
      products: mergeArrayByKey(local?.products, remote?.products, "id"),
      orders: mergeArrayByKey(local?.orders, remote?.orders, "code"),
      customers: mergeCustomers(local?.customers, remote?.customers),
    };
    const stamp = getSnapshotStamp(merged);
    return {
      meta: { updatedAt: stamp ? new Date(stamp).toISOString() : new Date(0).toISOString() },
      ...merged,
    };
  };

  const buildSyncUrl = (settings) => {
    try {
      const url = new URL(settings.syncEndpoint);
      if (settings.syncKey) url.searchParams.set("key", settings.syncKey);
      return url.toString();
    } catch (error) {
      return settings.syncEndpoint;
    }
  };

  const applySyncSnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;
    suppressSync = true;
    if (snapshot.settings) writeStore(KEYS.settings, normalizeSettings(snapshot.settings));
    if (snapshot.products) writeStore(KEYS.products, snapshot.products);
    if (snapshot.orders) writeStore(KEYS.orders, snapshot.orders);
    if (snapshot.customers) writeStore(KEYS.customers, snapshot.customers);
    suppressSync = false;
  };

  const scheduleSync = (reason = "", delay = SYNC_DELAY) => {
    const settings = getSettings();
    if (!settings.syncEndpoint) return;
    if (syncTimer) return;
    syncTimer = setTimeout(() => {
      performSync({ reason });
    }, delay);
  };

  const unwrapSyncPayload = (payload) => {
    if (!payload) return null;
    if (payload.data) return payload.data;
    return payload;
  };

  const hasSyncData = (snapshot) => {
    if (!snapshot) return false;
    const products = Array.isArray(snapshot.products) ? snapshot.products.length : 0;
    const orders = Array.isArray(snapshot.orders) ? snapshot.orders.length : 0;
    const customers = snapshot.customers ? Object.keys(snapshot.customers).length : 0;
    return products > 0 || orders > 0 || customers > 0;
  };

  const hasSyncSettings = (snapshot) =>
    Boolean(snapshot?.settings && Object.keys(snapshot.settings).length > 0);

  const performSync = async ({ reason = "", silent = false } = {}) => {
    const settings = getSettings();
    if (!settings.syncEndpoint) {
      return { ok: false, message: "Chưa có URL đồng bộ." };
    }
    if (syncInFlight) {
      syncPending = true;
      return { ok: false, message: "Đang đồng bộ." };
    }
    syncInFlight = true;
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }

    const endpoint = buildSyncUrl(settings);
    const localSnapshot = buildSyncSnapshot();
    let remoteSnapshot = null;
    const headers = { Accept: "application/json" };
    if (settings.apiKey) headers["x-api-key"] = settings.apiKey;
    try {
      const response = await fetch(endpoint, { headers });
      if (response.ok) remoteSnapshot = unwrapSyncPayload(await response.json());
    } catch (error) {
      remoteSnapshot = null;
    }

    const emptyRemote =
      !remoteSnapshot || (!hasSyncData(remoteSnapshot) && !hasSyncSettings(remoteSnapshot));
    const merged = mergeSnapshots(localSnapshot, emptyRemote ? {} : remoteSnapshot || {});
    applySyncSnapshot(merged);
    triggerSyncListeners();

    const mergedStamp = getSnapshotStamp(merged);
    const shouldPush =
      syncDirty || (!hasSyncData(remoteSnapshot) && hasSyncData(localSnapshot));
    if (shouldPush) {
      try {
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(merged),
        });
        store.setItem(KEYS.syncCheckpoint, String(mergedStamp));
        syncDirty = false;
        syncInFlight = false;
        if (syncPending) {
          syncPending = false;
          scheduleSync("pending", 2000);
        }
        return { ok: true, message: "Đã đồng bộ dữ liệu." };
      } catch (error) {
        syncInFlight = false;
        if (syncPending) {
          syncPending = false;
          scheduleSync("pending", 3000);
        }
        return { ok: false, message: "Không thể ghi dữ liệu lên server." };
      }
    }

    store.setItem(KEYS.syncCheckpoint, String(mergedStamp));
    syncDirty = false;
    syncInFlight = false;
    if (syncPending) {
      syncPending = false;
      scheduleSync("pending", 2000);
    }
    return {
      ok: true,
      message: silent ? "" : "Đã cập nhật dữ liệu từ server.",
    };
  };

  const initSync = () => {
    const settings = getSettings();
    if (!settings.syncEndpoint) return;
    const checkpoint = Number(store.getItem(KEYS.syncCheckpoint)) || 0;
    const localStamp = getSnapshotStamp(buildSyncSnapshot());
    if (localStamp > checkpoint) syncDirty = true;
    scheduleSync("init", 400);
    setInterval(() => {
      performSync({ reason: "poll", silent: true });
    }, 45000);
  };

  const formatNumber = (value) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value || 0);

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const formatCurrency = (value, currency) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "CNY" ? 2 : 0,
    }).format(value || 0);

  const formatRatingText = (rating, ratingCount) => {
    const parsedRating = typeof rating === "number" ? rating : Number(rating);
    const ratingValue = Number.isFinite(parsedRating) && parsedRating > 0 ? parsedRating : null;
    const parsedCount = typeof ratingCount === "number" ? ratingCount : Number(ratingCount);
    const countValue = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : null;
    if (!ratingValue && !countValue) {
      return "Chưa có đánh giá";
    }
    if (ratingValue) {
      const normalized = Math.round(ratingValue * 10) / 10;
      const formattedRating =
        Number.isInteger(normalized) ? normalized.toFixed(0) : normalized.toFixed(1);
      let text = `★ ${formattedRating} sao`;
      if (countValue) {
        text += ` · ${formatNumber(countValue)} lượt đánh giá`;
      }
      return text;
    }
    return `${formatNumber(countValue)} lượt đánh giá`;
  };

  const formatPositiveRate = (value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return "";
    const normalized = parsed > 1 ? parsed / 100 : parsed;
    const percent = Math.round(normalized * 100);
    return `${percent}%`;
  };

  const PRICE_FEE_RATE = 0.25;
  const applyProductFee = (base) => {
    const value = Number(base) || 0;
    return Math.round(value * (1 + PRICE_FEE_RATE) * 100) / 100;
  };

  const convertPrice = (base, settings) => {
    const priced = applyProductFee(base);
    return {
      jpy: Math.round(priced * settings.rateJPY),
      vnd: Math.round(priced * settings.rateVND),
    };
  };

  const CATEGORY_LABELS = {
    outerwear: "Outerwear & Áo khoác",
    sneakers: "Sneakers",
    bags: "Túi xách",
    lifestyle: "Lifestyle",
  };

  const sourceLabel = (source) => {
    if (source === "web") return "Nội bộ";
    if (source === "taobao_link") return "Link Taobao";
    return "Sync Taobao";
  };

  const getProductImages = (product) => {
    if (Array.isArray(product.images) && product.images.length) return product.images;
    if (product.image) return [product.image];
    return [];
  };

  const normalizeImageSources = (sources) => {
    if (!Array.isArray(sources)) return [];
    const seen = new Set();
    return sources.reduce((list, raw) => {
      const value = String(raw || "").trim();
      if (!value || seen.has(value)) return list;
      seen.add(value);
      list.push(value);
      return list;
    }, []);
  };

  const getOrderItemSnapshot = (item, products) => {
    const product = products.find((entry) => entry.id === item.id);
    const name = item.name || product?.name || "Sản phẩm";
    const basePrice = Number(
      item.basePrice ?? product?.basePrice ?? item.priceBase ?? 0
    );
    const images =
      (Array.isArray(item.images) && item.images.length
        ? item.images
        : product
        ? getProductImages(product)
        : []) || [];
    const image = item.image || images[0] || product?.image || "";
    const productUrl = item.productUrl || product?.sourceUrl || product?.link || "";
    const color = item.color || product?.defaultColor || "";
    return {
      name,
      basePrice,
      images,
      image,
      productUrl,
      size: item.size,
      qty: item.qty,
      source: item.source || product?.source || "web",
      color,
      imagePreference: item.imagePreference || null,
    };
  };

  const renderOrderItems = (order, products) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    if (!items.length) return '<span class="tag">Không có sản phẩm.</span>';
    const settings = getSettings();
    const badge = getOrderPaymentBadge(order);
    const markup = items
      .map((item) => {
        const snapshot = getOrderItemSnapshot(item, products);
        const fallback = (snapshot.name || "SP").slice(0, 2).toUpperCase();
        const thumb = snapshot.image
          ? `<img src="${snapshot.image}" alt="${snapshot.name}" loading="lazy" />`
          : `<span class="tag">${fallback}</span>`;
        const nameMarkup = `<strong>${snapshot.name}</strong>`;
        const detailParts = [
          snapshot.color ? `Màu ${snapshot.color}` : "",
          snapshot.size ? `Size ${snapshot.size}` : "",
          snapshot.imagePreference?.label ? `Ảnh: ${snapshot.imagePreference.label}` : "",
          `x${snapshot.qty || 0}`,
          sourceLabel(snapshot.source),
        ]
          .filter(Boolean)
          .join(" · ");
        const priceWithFee = applyProductFee(snapshot.basePrice);
        const pricePerItemJPY = Math.round(priceWithFee * settings.rateJPY);
        const pricePerItemVND = Math.round(priceWithFee * settings.rateVND);
        const totalBase = priceWithFee * (snapshot.qty || 0);
        const totalJPY = Math.round(totalBase * settings.rateJPY);
        const totalVND = Math.round(totalBase * settings.rateVND);
        return `
          <div class="order-item-card">
            <div class="order-item-thumb">${thumb}</div>
            <div class="order-item-info">
              <div class="order-item-meta">
                ${nameMarkup}
                <span>${detailParts}</span>
              </div>
              <div class="order-item-price">
                <p><strong>${formatCurrency(priceWithFee, settings.baseCurrency)}</strong></p>
                <p class="helper">JPY ${formatNumber(pricePerItemJPY)} · VND ${formatNumber(
                  pricePerItemVND
                )} / cái</p>
              </div>
              <div class="order-item-total">
                <span><strong>Tổng:</strong> JPY ${formatNumber(totalJPY)} · VND ${formatNumber(
                  totalVND
                )}</span>
              </div>
            </div>
            <div class="order-item-status">
              <span class="status ${badge.class}">${badge.label}</span>
              <p class="helper">Thanh toán & xác nhận sản phẩm</p>
            </div>
          </div>
        `;
      })
      .join("");
    return `<div class="order-items-detailed">${markup}</div>`;
  };

  const STATUS_PANEL_INFO = {
    pending: {
      label: "Chưa thanh toán",
      helper: "Đơn hàng đang chờ báo giá và thanh toán tổng",
      notice: "Đang chờ thanh toán gộp, thanh toán một lần khi có giá ship",
      detailTitle: "Các đơn chưa thanh toán",
      emptyHint: "Chưa có đơn đang chờ thanh toán.",
    },
    shipping: {
      label: "Đang chờ giao",
      helper: "Đơn đã xác nhận phí ship và đang trên đường",
      notice: "Theo dõi lộ trình và sẵn sàng nhận hàng",
      detailTitle: "Các đơn đang chờ giao",
      emptyHint: "Chưa có đơn đang giao.",
    },
    paid: {
      label: "Đã thanh toán",
      helper: "Đơn đã hoàn tất và xác nhận thanh toán",
      notice: "Thanh toán trọn gói, chuẩn bị bàn giao hàng",
      detailTitle: "Các đơn đã thanh toán",
      emptyHint: "Chưa có đơn thanh toán thành công.",
    },
  };

  const getStatusKeyForOrder = (order) => {
    if (order.status === STATUS.PAID) return "paid";
    if (order.status === STATUS.SHIP_CONFIRMED) return "shipping";
    return "pending";
  };

  const canPayOrder = (order, settings) => {
    if (!order) return false;
    const hasShipping = typeof order.shipFee === "number" && !Number.isNaN(order.shipFee) && order.shipFee > 0;
    if (!hasShipping) return false;
    if (!settings?.paymentGateOpen) return false;
    const notPaid = order.paymentStatus === PAYMENT_STATUS.NOT_PAID;
    return notPaid;
  };

  const getPayableOrders = (orders, settings) =>
    (Array.isArray(orders) ? orders : []).filter((order) => canPayOrder(order, settings));

  const buildPaymentStatusData = (orders, settings, products) => {
    const buckets = { pending: [], shipping: [], paid: [] };
    const totals = {
      pending: { totalJPY: 0, totalVND: 0 },
      shipping: { totalJPY: 0, totalVND: 0 },
      paid: { totalJPY: 0, totalVND: 0 },
    };
    const actionableOrders = [];
    const blockedOrders = [];
    const metadata = {
      pending: { actionableCount: 0, blockedCount: 0, actionableOrders, blockedOrders },
      hasAggregateAction: false,
    };
    orders.forEach((order) => {
      if (order.status === STATUS.CANCELLED) return;
      const key = getStatusKeyForOrder(order);
      buckets[key].push(order);
      const summary = computeTotals(order, settings, products);
      totals[key].totalJPY += summary.totalJPY;
      totals[key].totalVND += summary.totalVND;
    });
    const payable = getPayableOrders(buckets.pending, settings);
    metadata.pending.actionableCount = payable.length;
    metadata.pending.actionableOrders.push(...payable);
    metadata.pending.blockedOrders.push(
      ...buckets.pending.filter((order) => !payable.includes(order))
    );
    metadata.pending.blockedCount = metadata.pending.blockedOrders.length;
    metadata.hasAggregateAction = payable.length >= 2 && Boolean(settings.paymentGateOpen);
    return { buckets, totals, metadata };
  };

  const PAYMENT_REMINDER_WINDOW = 10 * 60 * 60 * 1000;

  const isPaymentReminderDue = (order) => {
    if (!order) return false;
    if (order.paymentStatus !== PAYMENT_STATUS.NOT_PAID) return false;
    if (!order.shipFeeConfirmedAt) return false;
    const reminderThreshold = Date.now() - PAYMENT_REMINDER_WINDOW;
    return !order.paymentSubmittedAt && order.shipFeeConfirmedAt < reminderThreshold;
  };

  const buildOrderTimelineSteps = (order) => {
    if (!order) return [];
    const createdAt = order.createdAt || order.updatedAt || Date.now();
    const shipConfirmedAt = order.shipFeeConfirmedAt || null;
    const paymentGateOpenedAt = order.paymentGateOpenedAt || shipConfirmedAt || null;
    const paymentSubmittedAt = order.paymentSubmittedAt || null;
    const paymentConfirmedAt = order.paymentConfirmedAt || null;
    const shippingAt = order.status === STATUS.PAID ? order.updatedAt || Date.now() : null;
    const shippingHelper = order.status === STATUS.PAID ? "Đơn đã chuyển sang giao hàng" : "Đang chờ giao";
    return [
      {
        label: "Đơn được tạo",
        time: createdAt,
        helper: "Bắt đầu hành trình mua hộ",
      },
      {
        label: "Admin xác nhận phí ship",
        time: shipConfirmedAt,
        helper: shipConfirmedAt ? `Ship ${order.shipFee || 0} ${order.shipCurrency || "JPY"}` : "Chờ admin báo phí ship",
      },
      {
        label: "Cổng thanh toán mở",
        time: paymentGateOpenedAt,
        helper: paymentGateOpenedAt ? "Admin bật cổng chuyển khoản" : "Chờ admin mở cổng",
      },
      {
        label: "Bạn chuyển khoản",
        time: paymentSubmittedAt,
        helper: paymentSubmittedAt ? "Bill đã gửi, chờ admin xác nhận" : "Chưa upload bill",
      },
      {
        label: "Admin xác nhận tiền",
        time: paymentConfirmedAt,
        helper: paymentConfirmedAt ? "Đã xác nhận thanh toán" : "Chờ admin kiểm tra bill",
      },
      {
        label: "Bắt đầu giao hàng",
        time: shippingAt,
        helper: shippingHelper,
      },
    ];
  };

  const renderTimelineItems = (steps) =>
    steps
      .map((step) => {
        const statusClass = step.time ? "is-done" : "is-pending";
        return `
          <div class="payment-timeline-item ${statusClass}">
            <div>
              <strong>${step.label}</strong>
              <p class="helper small">${step.helper}</p>
            </div>
            <span class="timeline-time">${step.time ? formatDateTime(step.time) : "Chưa thực hiện"}</span>
          </div>
        `;
      })
      .join("");

  const renderPaymentTimeline = (order) => {
    const steps = buildOrderTimelineSteps(order);
    return `
      <div class="card payment-timeline-card">
        <h4>Payment Timeline</h4>
        <div class="payment-timeline-list">
          ${renderTimelineItems(steps)}
        </div>
      </div>
    `;
  };

  const PAYMENT_RUN_STATUS_PRIORITY = [
    PAYMENT_STATUS.CONFIRMED,
    PAYMENT_STATUS.BILL_SUBMITTED,
    PAYMENT_STATUS.NOT_PAID,
    PAYMENT_STATUS.REJECTED,
    PAYMENT_STATUS.EXPIRED,
  ];

  const reducePaymentStatus = (orders) => {
    const codes = new Set(orders.map((order) => order.paymentStatus).filter(Boolean));
    for (const status of PAYMENT_RUN_STATUS_PRIORITY) {
      if (codes.has(status)) return status;
    }
    return PAYMENT_STATUS.NOT_PAID;
  };

  const buildPaymentRuns = (orders, settings, products) => {
    const runs = new Map();
    orders.forEach((order) => {
      const paymentId = order.paymentId;
      if (!paymentId) return;
      const totals = computeTotals(order, settings, products);
      const existing = runs.get(paymentId) || {
        paymentId,
        memo: order.paymentMemo || paymentId,
        submittedAt: order.paymentSubmittedAt || order.updatedAt || order.createdAt || Date.now(),
        confirmedAt: order.paymentConfirmedAt || 0,
        createdAt: order.createdAt || Date.now(),
        shipConfirmedAt: order.shipFeeConfirmedAt || null,
        shippingStartedAt:
          order.status === STATUS.PAID ? order.updatedAt || order.createdAt || null : null,
        orders: [],
        totalJPY: 0,
        totalVND: 0,
        billPreview: order.billPreview || "",
        billFileName: order.billFileName || "",
      };
      existing.orders.push(order);
      existing.totalJPY += totals.totalJPY;
      existing.totalVND += totals.totalVND;
      existing.memo = existing.memo || order.paymentMemo || paymentId;
      existing.submittedAt = Math.min(
        existing.submittedAt,
        order.paymentSubmittedAt || order.updatedAt || order.createdAt || Date.now()
      );
      existing.confirmedAt = Math.max(existing.confirmedAt, order.paymentConfirmedAt || 0);
      existing.createdAt = Math.min(existing.createdAt, order.createdAt || Date.now());
      if (order.shipFeeConfirmedAt) {
        if (!existing.shipConfirmedAt) {
          existing.shipConfirmedAt = order.shipFeeConfirmedAt;
        } else {
          existing.shipConfirmedAt = Math.min(existing.shipConfirmedAt, order.shipFeeConfirmedAt);
        }
      }
      if (order.status === STATUS.PAID && order.updatedAt) {
        if (!existing.shippingStartedAt) {
          existing.shippingStartedAt = order.updatedAt;
        } else {
          existing.shippingStartedAt = Math.min(existing.shippingStartedAt, order.updatedAt);
        }
      }
      if (!existing.billPreview && order.billPreview) existing.billPreview = order.billPreview;
      if (!existing.billFileName && order.billFileName) existing.billFileName = order.billFileName;
      runs.set(paymentId, existing);
    });
    return Array.from(runs.values())
      .map((run) => ({
        ...run,
        status: reducePaymentStatus(run.orders),
      }))
      .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  };

  const buildPaymentRunTimeline = (run) => {
    if (!run) return [];
    return [
      {
        label: "Đơn được tạo",
        time: run.createdAt,
        helper: `${run.orders.length} đơn trong lượt thanh toán`,
      },
      {
        label: "Admin xác nhận phí ship",
        time: run.shipConfirmedAt || null,
        helper: run.shipConfirmedAt ? "Admin đã báo phí ship cho các đơn" : "Đợi admin báo ship",
      },
      {
        label: "Bạn chuyển khoản",
        time: run.submittedAt,
        helper: "Đã upload bill cho lượt thanh toán",
      },
      {
        label: "Admin xác nhận tiền",
        time: run.confirmedAt || null,
        helper: run.confirmedAt ? "Admin xác nhận tiền thành công" : "Chờ admin đối soát",
      },
      {
        label: "Bắt đầu giao hàng",
        time: run.shippingStartedAt || null,
        helper: run.shippingStartedAt ? "Các đơn chuyển sang trạng thái giao" : "Đang chuẩn bị giao",
      },
    ];
  };

  const renderPaymentRunTimeline = (run) => {
    const steps = buildPaymentRunTimeline(run);
    return `
      <div class="card payment-timeline-card">
        <h4>Lượt thanh toán</h4>
        <div class="payment-timeline-list">
          ${renderTimelineItems(steps)}
        </div>
      </div>
    `;
  };

  const renderPaymentRunDetail = (run, settings, products) => {
    if (!run) return "";
    const badge = getOrderPaymentBadge({ paymentStatus: run.status });
    const ordersMarkup = run.orders
      .map((order) => {
        const totals = computeTotals(order, settings, products);
        const timestamp = order.paymentSubmittedAt || order.updatedAt || order.createdAt;
        return `
          <li>
            <div>
              <strong>${escapeHtml(order.code)}</strong>
              <span class="helper small">${formatDateTime(timestamp)}</span>
            </div>
            <div class="helper small">
              JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(totals.totalVND)}
            </div>
            <button class="btn ghost tiny" type="button" data-action="detail" data-order-code="${escapeHtml(
              order.code
            )}">Xem đơn</button>
          </li>
        `;
      })
      .join("");
    return `
      <div class="card payment-basic-info">
        <div class="segment">
          <div>
            <p class="helper">Lượt thanh toán</p>
            <strong>${escapeHtml(run.paymentId)}</strong>
            <span class="helper small">${formatDateTime(run.submittedAt)}</span>
          </div>
          <div class="payment-run-badge">
            <span class="status ${badge.class}">${badge.label}</span>
            <button class="btn ghost tiny" data-action="run-copy" type="button">Copy memo</button>
          </div>
        </div>
        <div class="segment compact">
          <p><strong>Tổng:</strong> JPY ${formatNumber(run.totalJPY)} · VND ${formatNumber(run.totalVND)}</p>
          <p class="helper small">${run.orders.length} đơn qua lượt này</p>
        </div>
        <p class="helper small">Memo: ${escapeHtml(run.memo || run.paymentId)}</p>
      </div>
      ${renderPaymentRunTimeline(run)}
      <div class="card soft payment-run-orders">
        <h4>Đơn trong lượt thanh toán</h4>
        <ul>
          ${ordersMarkup}
        </ul>
      </div>
      <div class="card soft payment-run-bill">
        <h4>Bill đã upload</h4>
        ${
          run.billPreview
            ? `<img src="${escapeHtml(run.billPreview)}" alt="Bill preview" />`
            : run.billFileName
            ? `<span class="tag">${escapeHtml(run.billFileName)}</span>`
            : `<p class="helper small">Bill chưa có trong hệ thống.</p>`
        }
      </div>
    `;
  };

  const renderPendingOrderCard = (order, settings, aggregatedAvailable) => {
    const totals = computeTotals(order, settings, getProducts());
    const ready = canPayOrder(order, settings);
    const quantity =
      Array.isArray(order.items) && order.items.length
        ? order.items.reduce((sum, item) => sum + Number(item.qty || 0), 0)
        : 0;
    const shippingLabel = ready ? "Đã có phí ship" : "Chờ admin xác nhận phí ship";
    const shippingDetail = ready
      ? `Phí ship: JPY ${formatNumber(totals.shipJPY)} · VND ${formatNumber(totals.shipVND)}`
      : "Phí ship chưa được cập nhật";
    return `
      <article class="status-order-card pending ${ready ? "ready" : "blocked"}" data-order-code="${escapeHtml(
        order.code
      )}">
        <div class="status-order-card-meta">
          <div>
            <strong>${escapeHtml(order.code)}</strong>
            <span class="helper small">${formatDateTime(order.createdAt)}</span>
          </div>
          <span class="status ${ready ? "green" : "orange"}">${shippingLabel}</span>
        </div>
        <div class="status-order-card-body">
          <div>
            <p class="helper small">Số lượng</p>
            <strong>${quantity || order.items?.length || 0} sản phẩm</strong>
          </div>
          <div>
            <p class="helper small">Tổng cần trả</p>
            <strong>JPY ${formatNumber(totals.totalJPY)}</strong>
            <span class="helper small">VND ${formatNumber(totals.totalVND)}</span>
          </div>
        </div>
        <p class="helper small">${shippingDetail}</p>
        <div class="status-order-card-actions">
          ${
            ready
              ? aggregatedAvailable
                ? `
                  <label class="checkbox-toggle">
                    <input type="checkbox" data-aggregate-checkbox data-order-code="${escapeHtml(order.code)}" />
                    <span>Chọn gộp</span>
                  </label>`
                : `<button class="btn primary small" data-action="detail" data-order-code="${escapeHtml(
                    order.code
                  )}" type="button">Thanh toán</button>`
              : `<span class="helper small">Không thể thanh toán trước khi admin xác nhận phí ship.</span>`
          }
          <button class="btn ghost small" data-action="detail" data-order-code="${escapeHtml(
            order.code
          )}" type="button">
            Xem chi tiết
          </button>
        </div>
      </article>
    `;
  };

  const renderPendingPanel = (statusData, settings, products) => {
    const pendingOrders = statusData.buckets.pending || [];
    const totals = statusData.totals.pending || { totalJPY: 0, totalVND: 0 };
    const actionableOrders = statusData.metadata.pending.actionableOrders || [];
    const blockedOrders = statusData.metadata.pending.blockedOrders || [];
    const readySummary =
      actionableOrders.length > 0 ? buildAggregateSummary(actionableOrders, settings, products) : null;
    const readyLabel = readySummary
      ? `Thanh toán gộp ${actionableOrders.length} đơn · JPY ${formatNumber(readySummary.totalJPY)} · VND ${formatNumber(
          readySummary.totalVND
        )}`
      : "Chưa đủ đơn để thanh toán gộp";
    const aggregatedAvailable = statusData.metadata.pending.hasAggregateAction;
    const reminderOrders = actionableOrders.filter(isPaymentReminderDue);
    const reminderMarkup = reminderOrders.length
      ? `
        <div class="payment-reminder">
          <p>
            Đơn <strong>${escapeHtml(reminderOrders[0].code)}</strong> đã mở cổng từ ${formatDateTime(
              reminderOrders[0].shipFeeConfirmedAt
            )} nhưng chưa chuyển khoản. Vui lòng upload bill hoặc nhắn admin.
          </p>
          <button class="btn ghost tiny" data-action="detail" data-order-code="${escapeHtml(
            reminderOrders[0].code
          )}" type="button">Mở đơn</button>
        </div>
      `
      : "";
    const emptyGuidance = !pendingOrders.length
      ? `
        <div class="payment-empty-state">
          <strong>Không còn đơn đang chờ thanh toán.</strong>
          <p class="helper small">Bạn có thể tạo đơn mới, hoặc chờ admin xác nhận phí ship để thanh toán.</p>
        </div>
      `
      : "";
    return `
      <div class="status-detail-aggregate">
        <div class="status-detail-aggregate-title">
          <span>Chờ thanh toán</span>
          <span class="status orange">Ưu tiên cao</span>
        </div>
        <div class="status-detail-aggregate-body">
          <p class="helper">Tổng ${pendingOrders.length} đơn chờ xử lý</p>
          <strong>JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(totals.totalVND)}</strong>
          <p class="helper small">
            ${actionableOrders.length} đơn sẵn sàng thanh toán · ${statusData.metadata.pending.blockedCount} đơn chờ phí ship
          </p>
        </div>
        <div class="status-detail-aggregate-actions">
          ${
            aggregatedAvailable
              ? `
                <button
                  class="btn primary status-detail-aggregate-btn"
                  data-action="aggregate-pay"
                  type="button"
                >
                  ${readyLabel}
                </button>
                <p class="helper small">Bạn có nhiều đơn chưa thanh toán. Chọn các đơn để thanh toán gộp.</p>`
              : `
                <p class="helper small">Thanh toán gộp chỉ kích hoạt khi có tối thiểu 2 đơn đã xác nhận phí ship.</p>
              `
          }
        </div>
        ${aggregatedAvailable ? '<p class="helper multi-order-hint">Bạn có nhiều đơn chưa thanh toán, tận dụng thanh toán gộp để giảm tương tác.</p>' : ""}
        ${reminderMarkup}
      </div>
      ${emptyGuidance}
      <div class="status-detail-body">
        <div class="status-detail-orders">
          <h4>Đơn sẵn sàng thanh toán</h4>
          ${
            actionableOrders.length
              ? actionableOrders.map((order) => renderPendingOrderCard(order, settings, aggregatedAvailable)).join("")
              : `<div class="status-empty">Chưa có đơn nào sẵn sàng thanh toán.</div>`
          }
        </div>
        <div class="status-detail-orders">
          <h4>Đơn chờ admin báo phí ship</h4>
          ${
            blockedOrders.length
              ? blockedOrders.map((order) => renderPendingOrderCard(order, settings, false)).join("")
              : `<div class="status-empty">Tất cả đơn đã có phí ship.</div>`
          }
        </div>
      </div>
      ${
        aggregatedAvailable
          ? `<div class="aggregate-sticky hidden" data-aggregate-sticky>
              <div>
                <strong data-aggregate-summary-text>
                  Đã chọn: <span data-aggregate-count>0</span> đơn · Tổng: JPY <span data-aggregate-total-jpy>0</span> · VND <span data-aggregate-total-vnd>0</span>
                </strong>
                <p class="helper small">Bấm thanh toán gộp để mở modal và upload bill chung.</p>
              </div>
              <button class="btn primary small" data-action="aggregate-pay" type="button" disabled>Thanh toán gộp</button>
            </div>`
          : ""
      }
    `;
  };

  const renderShippingPanel = (statusData, settings, products) => {
    const shippingOrders = statusData.buckets.shipping || [];
    if (!shippingOrders.length) {
      return `<div class="status-empty">Chưa có đơn đang giao.</div>`;
    }
    return `
      <div class="tab-order-list">
        ${shippingOrders
          .map((order) => {
            const totals = computeTotals(order, settings, products);
            return `
              <article class="history-card" data-order-code="${order.code}">
                <div class="history-card-summary">
                  <div>
                    <strong>${order.code}</strong>
                    <span class="helper">${formatDateTime(order.updatedAt || order.createdAt)}</span>
                  </div>
                <div class="history-card-status">
                  <span class="status ${
                    order.paymentStatus === PAYMENT_STATUS.CONFIRMED ? "green" : "orange"
                  }">
                    ${order.paymentStatus === PAYMENT_STATUS.CONFIRMED ? "Đã xác nhận" : "Chờ xác nhận"}
                  </span>
                  ${
                    order.paymentStatus === PAYMENT_STATUS.BILL_SUBMITTED
                      ? '<span class="history-card-pill">Đã chuyển khoản – chờ xác nhận</span>'
                      : ""
                  }
                  <span class="helper">${formatPaymentStatus(order.paymentStatus)}</span>
                </div>
                </div>
                <div class="history-card-meta">
                  <span><strong>Đang giao</strong></span>
                  <span>JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(totals.totalVND)}</span>
                </div>
                <div class="history-card-actions">
                  <button class="btn ghost small" data-action="detail" data-order-code="${order.code}" type="button">
                    Xem chi tiết
                  </button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  };

  const renderPaidPanel = (statusData, settings, products) => {
    const paidOrders = statusData.buckets.paid || [];
    if (!paidOrders.length) {
      return `<div class="status-empty">Chưa có đơn đã thanh toán.</div>`;
    }
    return `
      <div class="tab-order-list">
        ${paidOrders
          .map((order) => {
            const totals = computeTotals(order, settings, products);
            return `
              <article class="history-card" data-order-code="${order.code}">
                <div class="history-card-summary">
                  <div>
                    <strong>${order.code}</strong>
                    <span class="helper">${formatDateTime(order.updatedAt || order.createdAt)}</span>
                  </div>
                <div class="history-card-status">
                  <span class="status green">Đã thanh toán</span>
                  ${
                    order.paymentStatus === PAYMENT_STATUS.BILL_SUBMITTED
                      ? '<span class="history-card-pill">Đã chuyển khoản – chờ xác nhận</span>'
                      : ""
                  }
                  <span class="helper">${formatPaymentStatus(order.paymentStatus)}</span>
                </div>
                </div>
                <div class="history-card-meta">
                  <span><strong>Hoàn tất</strong></span>
                  <span>JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(totals.totalVND)}</span>
                </div>
                <div class="history-card-actions">
                  <button class="btn ghost small" data-action="detail" data-order-code="${order.code}" type="button">
                    Xem chi tiết
                  </button>
                  <button class="btn secondary small" type="button">Mua lại</button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  };

  const renderStatusDetailPanel = (statusKey, statusData, settings, products) => {
    switch (statusKey) {
      case "shipping":
        return renderShippingPanel(statusData, settings, products);
      case "paid":
        return renderPaidPanel(statusData, settings, products);
      case "pending":
      default:
        return renderPendingPanel(statusData, settings, products);
    }
  };

  const renderPaymentSummary = (statusData, settings, products) => {
    const keys = ["pending", "shipping", "paid"];
    const cards = keys
      .map((key) => {
        const bucket = statusData.buckets[key] || [];
        const totals = statusData.totals[key] || { totalJPY: 0, totalVND: 0 };
        return `
          <article
            class="status-pill ${key === "pending" ? "active" : ""}"
            data-status-key="${key}"
            data-has-orders="${bucket.length ? "1" : "0"}"
          >
            <div>
              <strong>${bucket.length}</strong>
              <span>${key === "pending" ? "chờ xử lý" : key === "shipping" ? "đã xác nhận ship" : "đã thanh toán"}</span>
            </div>
            <small>JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(totals.totalVND)}</small>
          </article>
        `;
      })
      .join("");
    const pendingBucket = statusData.buckets.pending || [];
    const pendingTotals = statusData.totals.pending || { totalJPY: 0, totalVND: 0 };
    const actionable = statusData?.metadata?.pending?.actionableCount || 0;
    const blocked = statusData?.metadata?.pending?.blockedCount || 0;
    return `
      <div class="status-shell compact">
        <div class="status-summary-grid compact">
          ${cards}
        </div>
        <div class="status-detail compact" data-status-detail data-compact="true">
          <div class="status-summary-line">
            <span>Chờ thanh toán</span>
            <span class="status orange">Ưu tiên cao</span>
          </div>
          <div class="status-summary-line">
            <p class="helper small">Tổng ${pendingBucket.length} đơn chờ xử lý</p>
            <strong>JPY ${formatNumber(pendingTotals.totalJPY)} · VND ${formatNumber(pendingTotals.totalVND)}</strong>
          </div>
          <div class="status-summary-line subtle">
            <span>${actionable} đơn sẵn sàng thanh toán · ${blocked} đơn chờ phí ship</span>
          </div>
          <div class="status-actions compact">
            <p class="helper small">
              Thanh toán gộp chỉ kích hoạt khi có tối thiểu 2 đơn đã xác nhận phí ship.
            </p>
          </div>
          <div class="payment-empty-state compact">
            <strong>Không còn đơn đang chờ thanh toán.</strong>
            <p class="helper small">Bạn có thể tạo đơn mới hoặc chờ admin xác nhận phí ship.</p>
          </div>
          <div class="status-detail-body compact">
            <div class="status-detail-orders">
              <h4>Đơn sẵn sàng thanh toán</h4>
              <div class="status-empty">Chưa có đơn nào sẵn sàng.</div>
            </div>
            <div class="status-detail-orders">
              <h4>Đơn chờ admin báo phí ship</h4>
              <div class="status-empty">Tất cả đơn đã có phí ship.</div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const buildAggregateSummary = (orders, settings, products) => {
    const summary = {
      totalJPY: 0,
      totalVND: 0,
      shipJPY: 0,
      shipVND: 0,
      codes: [],
    };
    orders.forEach((order) => {
      const totals = computeTotals(order, settings, products);
      summary.totalJPY += totals.totalJPY;
      summary.totalVND += totals.totalVND;
      summary.shipJPY += totals.shipJPY;
      summary.shipVND += totals.shipVND;
      const codeValue = order.paymentCode || order.code;
      if (codeValue) summary.codes.push(codeValue);
    });
    summary.codes = summary.codes.sort();
    const checksum = hashString(`${summary.codes.join("|")}-${summary.totalJPY}-${summary.totalVND}`);
    const memoId = `PAY-AGG-${checksum.slice(-5)}`;
    const memo = memoId;
    return { ...summary, memo, memoId };
  };

  const renderAggregateOrderList = (orders, settings, products) => {
    if (!orders.length) {
      return `<p class="helper small">Không có đơn nào được chọn.</p>`;
    }
    return `
      <ul class="aggregate-order-list">
        ${orders
          .map((order) => {
            const totals = computeTotals(order, settings, products);
            const quantity =
              Array.isArray(order.items) && order.items.length
                ? order.items.reduce((sum, item) => sum + Number(item.qty || 0), 0)
                : order.items?.length || 0;
            return `
              <li>
                <div>
                  <strong>${escapeHtml(order.code)}</strong>
                  <span class="helper small">${quantity} sản phẩm</span>
                </div>
                <div class="helper small">
                  JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(totals.totalVND)}
                </div>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  };

  const renderAggregateModalStep1 = (session, settings, products) => {
    if (!session) return "";
    const { summary, orders } = session;
    return `
      <div class="card payment-basic-info aggregate-step aggregate-step-1">
        <div class="segment">
          <div>
            <p class="helper">Các đơn đã chọn</p>
            <strong>${orders.length} đơn</strong>
          </div>
          <span class="status green">Chuẩn bị thanh toán gộp</span>
        </div>
        <div class="segment compact">
          <p><strong>Tổng tiền:</strong> JPY ${formatNumber(summary.totalJPY)}</p>
          <p><strong>VND:</strong> ${formatNumber(summary.totalVND)}</p>
        </div>
        <p class="helper small">Phí ship tổng: JPY ${formatNumber(summary.shipJPY)} · VND ${formatNumber(
          summary.shipVND
        )}</p>
        <p class="helper small">Mã thanh toán: <strong>${summary.memoId}</strong></p>
        <p class="helper small">Nội dung chuyển khoản cố định: <strong>${escapeHtml(summary.memo)}</strong></p>
      </div>
      <div class="card soft aggregate-order-list-card">
        <h4>Danh sách đơn gộp</h4>
        ${renderAggregateOrderList(orders, settings, products)}
      </div>
      <div class="card aggregate-modal-actions">
        <button class="btn primary" data-action="aggregate-next" type="button">
          Bước 2 · Chuyển khoản & upload bill
        </button>
        <p class="helper small">Nội dung chuyển khoản sẽ dùng để đối soát tự động và không thay đổi sau khi khởi tạo.</p>
      </div>
    `;
  };

  const renderAggregateModalStep2 = (session, settings) => {
    if (!session) return "";
    const { summary } = session;
    return `
      <div class="card payment-basic-info aggregate-step aggregate-step-2">
        <div class="segment">
          <div>
            <p class="helper">Xác nhận thanh toán gộp</p>
            <strong>JPY ${formatNumber(summary.totalJPY)}</strong>
            <span class="helper small">VND ${formatNumber(summary.totalVND)}</span>
          </div>
          <button class="btn ghost small" data-action="aggregate-back" type="button">Quay lại</button>
        </div>
        <p class="helper small">Mã đối soát: <strong>${summary.memoId}</strong></p>
        <div class="aggregate-memo-field">
          <strong>Nội dung chuyển khoản</strong>
          <p data-aggregate-memo>${escapeHtml(summary.memo)}</p>
          <button class="btn ghost small" data-action="aggregate-copy" type="button">Copy nội dung chuyển khoản</button>
        </div>
      </div>
      <div class="card soft">
        <h4>Thông tin chuyển khoản</h4>
        <p>${escapeHtml(settings.bankJP)}</p>
        <p>${escapeHtml(settings.bankVN)}</p>
      </div>
      <div class="card aggregate-modal-upload">
        <div class="field">
          <label for="billUpload">Upload bill (jpg/png/pdf ≤ 5MB)</label>
          <input id="billUpload" type="file" accept=".jpg,.jpeg,.png,.pdf" />
        </div>
        <div class="aggregate-modal-actions">
          <button class="btn primary" id="submitBill" type="button">Tải bill & hoàn tất</button>
          <button class="btn ghost small" data-action="aggregate-back" type="button">Quay lại</button>
        </div>
        <p class="helper small">Sau khi gửi bill, hệ thống đóng cổng thanh toán và cập nhật trạng thái “Đang xác nhận”.</p>
      </div>
    `;
  };

  const renderAggregateModalStep = (session, settings, products) =>
    session?.step === 2
      ? renderAggregateModalStep2(session, settings)
      : renderAggregateModalStep1(session, settings, products);

  const attachDetailActions = (detail, statusKey, statusData, helpers = {}) => {
    if (!detail || !statusKey) return;
    const button = detail.querySelector("[data-action=\"aggregate-pay\"]");
    if (!button) return;
    button.addEventListener("click", () => {
      const bucket = statusData.buckets[statusKey] || [];
      if (!bucket.length) {
        showNotification("Không có đơn nào để gộp.", "info");
        return;
      }
      const totals = statusData.totals[statusKey] || { totalJPY: 0, totalVND: 0 };
      showNotification(
        `${bucket.length} đơn đã được tổng hợp: JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(
          totals.totalVND
        )}`,
        "info",
        4200
      );
      if (typeof helpers.openAggregateDetail === "function") {
        helpers.openAggregateDetail(bucket);
      } else if (typeof helpers.openOrderDetail === "function") {
        helpers.openOrderDetail(bucket[0]);
      }
    });
  };

  const bindStatusSummary = (
    statusData,
    settings,
    products,
    helpers = {},
    initialKey = "pending"
  ) => {
    const summary = document.querySelector(".status-shell");
    if (!summary) return null;
    const detail = summary.querySelector("[data-status-detail]");
    const cards = summary.querySelectorAll(".status-pill");
    if (!detail || !cards.length) return null;
    const isCompactDetail = detail.dataset?.compact === "true";
    const activate = (key, options = {}) => {
      cards.forEach((card) => {
        card.classList.toggle("active", card.dataset.statusKey === key);
      });
      if (options.scroll && typeof detail.scrollIntoView === "function") {
        detail.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (!isCompactDetail) {
        detail.innerHTML = renderStatusDetailPanel(key, statusData, settings, products);
        attachDetailActions(detail, key, statusData, helpers);
      }
    };
    activate(initialKey);
    return activate;
  };

  const renderPaymentRunCard = (run) => {
    const badge = getOrderPaymentBadge({ paymentStatus: run.status });
    const submittedLabel = run.submittedAt ? formatDateTime(run.submittedAt) : "Chưa chuyển khoản";
    return `
      <article class="payment-run-card" data-payment-id="${escapeHtml(run.paymentId)}">
        <div class="payment-run-card-head">
          <div>
            <p class="helper">Tiền gộp</p>
            <strong>${escapeHtml(run.paymentId)}</strong>
          </div>
          <span class="status ${badge.class}">${badge.label}</span>
        </div>
        <p class="helper small">Memo: ${escapeHtml(run.memo || run.paymentId)}</p>
        <div class="payment-run-meta">
          <span>${run.orders.length} đơn</span>
          <span>${submittedLabel}</span>
        </div>
        <div class="payment-run-total">
          <strong>JPY ${formatNumber(run.totalJPY)}</strong>
          <span>VND ${formatNumber(run.totalVND)}</span>
        </div>
        <div class="payment-run-actions">
          <button class="btn ghost small" data-action="run-detail" data-payment-id="${escapeHtml(
            run.paymentId
          )}" type="button">
            Xem chi tiết
          </button>
        </div>
      </article>
    `;
  };

  const renderPaymentRunHistory = (runs) => {
    if (!runs.length) {
      return `
        <div class="payment-empty-state">
          <p><strong>Chưa có lần thanh toán nào.</strong></p>
          <p class="helper">Khi bạn chuyển khoản, hệ thống sẽ nhóm đơn và lưu thành một bản ghi để đối soát.</p>
        </div>
      `;
    }
    return `<div class="payment-run-grid">${runs.map((run) => renderPaymentRunCard(run)).join("")}</div>`;
  };

  const renderOrderHistoryList = (orders, products) => {
    if (!orders.length) {
      return `
        <div class="card soft">
          <p class="helper">Chưa có lịch sử đơn hàng trên thiết bị, hãy tạo đơn mới để bắt đầu.</p>
        </div>
      `;
    }
    const reversed = orders.slice().reverse();
    const history = reversed
      .map((order, index) => {
        const totals = computeTotals(order, getSettings(), products);
        const badge = getOrderPaymentBadge(order);
        const itemsMarkup = renderOrderItems(order, products);
        const isLatest = index === 0;
        return `
          <article
            class="history-card ${isLatest ? "history-card--latest" : ""}"
            data-order-code="${order.code}"
          >
            <div class="history-card-summary">
              <div>
                <strong>${order.code}</strong>
                <span class="helper">${formatDateTime(order.createdAt)}</span>
              </div>
              <div class="history-card-status">
                <span class="status ${badge.class}">${badge.label}</span>
                <span class="helper">${formatPaymentStatus(order.paymentStatus)}</span>
              </div>
            </div>
            <div class="history-card-meta">
              <span><strong>${formatOrderStatus(order.status)}</strong></span>
              <span>JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(
                totals.totalVND
              )}</span>
            </div>
            <div class="history-card-items">
              ${itemsMarkup}
            </div>
            <div class="history-card-actions">
              <button class="btn ghost small" type="button" data-action="detail" data-order-code="${
                order.code
              }">
                Xem chi tiết
              </button>
              <button class="btn primary small" type="button" data-action="pay" data-order-code="${
                order.code
              }">
                Thanh toán
              </button>
            </div>
          </article>
        `;
      })
      .join("");
    return `<div class="payment-history-list">${history}</div>`;
  };

  const renderPaymentHistory = (orders, settings, products) => {
    const runs = buildPaymentRuns(orders, settings, products);
    return `
      <div class="payment-history-section">
        <div class="section-header">
          <h3>Lịch sử thanh toán</h3>
          <p class="helper small">Mỗi lần chuyển khoản được lưu lại độc lập để bạn đối soát nhanh.</p>
        </div>
        ${renderPaymentRunHistory(runs)}
        <div class="payment-history-divider"></div>
        <h4 class="helper small">Lịch sử theo đơn</h4>
        ${renderOrderHistoryList(orders, products)}
      </div>
    `;
  };

  const RANDOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const randomAlphaNumeric = (length = 6) => {
    const chars = RANDOM_CHARS;
    const sized = Math.max(1, length);
    const bytes = new Uint8Array(sized);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < sized; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(bytes)
      .map((byte) => chars[byte % chars.length])
      .join("");
  };

  const hashSignatureString = (value) => {
    if (!value) return "";
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash.toString(36).toUpperCase();
  };

  const getDeviceSignature = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return "";
    try {
      const parts = [
        navigator.userAgent,
        navigator.vendor,
        navigator.platform,
        navigator.language,
        Array.isArray(navigator.languages) ? navigator.languages.join(",") : "",
        navigator.hardwareConcurrency,
        navigator.deviceMemory,
        typeof screen !== "undefined" ? screen.width : "",
        typeof screen !== "undefined" ? screen.height : "",
        typeof screen !== "undefined" ? screen.colorDepth : "",
      ]
        .filter(Boolean)
        .join("|");
      return hashSignatureString(parts).slice(0, 6).padStart(4, "0");
    } catch (error) {
      return "";
    }
  };

  const getDeviceCustomerCode = () => {
    const existing = store.getItem(KEYS.deviceCustomerCode);
    if (existing) return existing;
    const signature = getDeviceSignature();
    const suffix = randomAlphaNumeric(4);
    const code = `KH${signature || ""}${suffix}`;
    store.setItem(KEYS.deviceCustomerCode, code);
    return code;
  };

  const upsertCustomer = (payload) => {
    const customers = getCustomers();
    const deviceCode = getDeviceCustomerCode();
    let existing = customers[deviceCode];
    if (!existing && payload.phone && customers[payload.phone]) {
      existing = customers[payload.phone];
      delete customers[payload.phone];
    }
    const now = Date.now();
    customers[deviceCode] = {
      ...existing,
      ...payload,
      code: deviceCode,
      deviceCode,
      phone: payload.phone || existing?.phone,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    setCustomers(customers);
    return deviceCode;
  };

  const generateOrderIdSegment = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    return `${timestamp.slice(-4)}${randomAlphaNumeric(5)}`;
  };

  const generateOrderCode = () => {
    const orders = getOrders();
    let attempts = 0;
    let code = "";
    do {
      const segment = generateOrderIdSegment();
      code = `DH-${segment}`;
      attempts += 1;
      if (attempts > 12) break;
    } while (orders.some((entry) => entry.code === code));
    return code;
  };

  const generatePaymentCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const length = 10 + Math.floor(Math.random() * 3);
    let code = "";
    for (let i = 0; i < length; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const pushTimeline = (order, payload) => {
    if (!order) return;
    const entry = {
      at: Date.now(),
      status: payload.status || order.status,
      paymentStatus: payload.paymentStatus || order.paymentStatus,
      actor: payload.actor || "system",
      message: payload.message || "",
    };
    if (!Array.isArray(order.timeline)) order.timeline = [];
    order.timeline.push(entry);
    order.timeline = order.timeline.slice(-60);
    order.updatedAt = Date.now();
  };

  const renderTimeline = (order) => {
    const timeline = Array.isArray(order.timeline) ? order.timeline : [];
    if (!timeline.length) return '<span class="tag">Chưa có cập nhật.</span>';
    return timeline
      .slice()
      .sort((a, b) => a.at - b.at)
      .map(
        (entry) => `
          <div class="timeline-item">
            <span class="timeline-time">${formatDateTime(entry.at)}</span>
            <strong>${formatOrderStatus(entry.status)}</strong>
            <span>${entry.message || "-"}</span>
          </div>
        `
      )
      .join("");
  };

const computeTotals = (order, settings, products, overrides = {}) => {
    const subtotalBase = order.items.reduce((sum, item) => {
      const product = products.find((entry) => entry.id === item.id);
      const basePrice = Number(item.basePrice ?? product?.basePrice ?? 0);
      if (!basePrice) return sum;
      return sum + applyProductFee(basePrice) * item.qty;
    }, 0);
    const subtotalJPY = Math.round(subtotalBase * settings.rateJPY);
    const subtotalVND = Math.round(subtotalBase * settings.rateVND);
    const resolvedShipFee =
      typeof overrides.shipFee === "number" && !Number.isNaN(overrides.shipFee)
        ? overrides.shipFee
        : order.shipFee;
    const resolvedShipCurrency = overrides.shipCurrency || order.shipCurrency;
    const shipBase = resolvedShipFee
      ? resolvedShipCurrency === "VND"
        ? resolvedShipFee / settings.rateVND
        : resolvedShipFee / settings.rateJPY
      : 0;
    const shipJPY = Math.round(shipBase * settings.rateJPY);
    const shipVND = Math.round(shipBase * settings.rateVND);
    const totalJPY = subtotalJPY + shipJPY;
    const totalVND = subtotalVND + shipVND;
    const taxJPY = Math.round((subtotalJPY + shipJPY) * 0.15);
    const taxVND = Math.round((subtotalVND + shipVND) * 0.15);
    return {
      subtotalBase,
      subtotalJPY,
      subtotalVND,
      shipJPY,
      shipVND,
      totalJPY,
      totalVND,
      taxJPY,
      taxVND,
    };
  };

  const persistOrderToBackend = async (order) => {
    if (!order || !order.items?.length) return;
    const endpoint = getOrderEndpoint();
    if (!endpoint) return;
    const settings = getSettings();
    const products = getProducts();
    const totals = computeTotals(order, settings, products);
    const payload = {
      customerCode: order.customerCode,
      customer: order.customer,
      items: order.items,
      shipping: order.shipping || {},
      subtotalBase: totals.subtotalBase,
      totalJPY: totals.totalJPY,
      totalVND: totals.totalVND,
    };
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      const message = data?.message;
      if (message) showOrderNotice(message);
      if (data?.customerCode) {
        store.setItem(KEYS.deviceCustomerCode, data.customerCode);
      }
    } catch (error) {
      console.warn("Order sync failed", error);
    }
  };

  const computeCartTotals = (cart, settings, products) => {
    const subtotalBase = cart.reduce((sum, item) => {
      const product = products.find((entry) => entry.id === item.id);
      const basePrice = Number(item.basePrice ?? product?.basePrice ?? 0);
      if (!basePrice) return sum;
      return sum + applyProductFee(basePrice) * item.qty;
    }, 0);
    return {
      subtotalBase,
      subtotalJPY: Math.round(subtotalBase * settings.rateJPY),
      subtotalVND: Math.round(subtotalBase * settings.rateVND),
    };
  };

  const renderCartSummary = (container) => {
    if (!container) return;
    const cart = getCart();
    const settings = getSettings();
    const products = getProducts();
    const totals = computeCartTotals(cart, settings, products);
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
    if (!cart.length) {
      container.innerHTML = `
        <div class="card">
          <h3>Giỏ hàng trống</h3>
          <p>Thêm sản phẩm để hệ thống tự tính tổng và báo giá ship.</p>
          <a class="btn secondary small" href="shop.html">Đi tới cửa hàng</a>
        </div>
      `;
      return;
    }
    container.innerHTML = `
      <div class="card">
        <h3>Giỏ hàng hiện tại</h3>
        <p>${itemCount} sản phẩm · ${cart.length} dòng hàng</p>
        <div class="price">
          <span>Tạm tính: ${formatCurrency(totals.subtotalBase, settings.baseCurrency)}</span>
          <span>JPY ${formatNumber(totals.subtotalJPY)}</span>
          <span>VND ${formatNumber(totals.subtotalVND)}</span>
        </div>
        <a class="btn primary small" href="cart.html">Xem giỏ hàng</a>
      </div>
    `;
  };

  const bindSearchRedirect = (input, button, destination) => {
    if (!input) return;
    const go = () => {
      const value = input.value.trim();
      if (!value) return;
      const url = `${destination}?q=${encodeURIComponent(value)}`;
      window.location.href = url;
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") go();
    });
    if (button) button.addEventListener("click", go);
  };

  const updateCartBadge = () => {
    const count = getCart().reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll("[data-cart-count]").forEach((node) => {
      node.textContent = count;
    });
  };

  const pulseCartTarget = () => {
    const counter = document.querySelector("[data-cart-count]");
    const target = counter?.closest("a, button") || counter;
    if (!target) return;
    target.classList.remove("cart-pulse");
    void target.offsetWidth;
    target.classList.add("cart-pulse");
  };

  const animateAddToCart = (sourceEl) => {
    if (!sourceEl) return;
    const counter = document.querySelector("[data-cart-count]");
    const target = counter?.closest("a, button") || counter;
    if (!target) return;

    const startRect = sourceEl.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (!startRect.width || !startRect.height) return;

    const size = Math.min(140, startRect.width, startRect.height);
    const startX = startRect.left + (startRect.width - size) / 2;
    const startY = startRect.top + (startRect.height - size) / 2;
    const targetX = targetRect.left + targetRect.width / 2 - size / 2;
    const targetY = targetRect.top + targetRect.height / 2 - size / 2;

    const flyer = document.createElement("div");
    const img = sourceEl.tagName === "IMG" ? sourceEl : sourceEl.querySelector("img");
    flyer.className = `fly-to-cart${img?.src ? " image" : ""}`;
    if (img?.src) flyer.style.backgroundImage = `url("${img.src}")`;
    flyer.style.width = `${size}px`;
    flyer.style.height = `${size}px`;
    flyer.style.left = `${startX}px`;
    flyer.style.top = `${startY}px`;
    document.body.appendChild(flyer);

    requestAnimationFrame(() => {
      flyer.style.transform = `translate(${targetX - startX}px, ${
        targetY - startY
      }px) scale(0.18)`;
      flyer.style.opacity = "0.15";
    });

    flyer.addEventListener(
      "transitionend",
      () => {
        flyer.remove();
      },
      { once: true }
    );
    pulseCartTarget();
  };

  const updateWishlistBadge = () => {
    const count = getWishlist().length;
    document.querySelectorAll("[data-wishlist-count]").forEach((node) => {
      node.textContent = count;
    });
  };

  const updateEmergencyLinks = () => {
    const settings = getSettings();
    document.querySelectorAll("[data-emergency]").forEach((node) => {
      node.href = settings.fbLink || "#";
    });
  };

  const setActiveNav = (page) => {
    document.querySelectorAll("[data-nav]").forEach((node) => {
      if (node.dataset.nav === page) node.classList.add("active");
    });
  };

  const NOTIFICATION_CENTER_ID = "notificationCenter";
  const NOTIFICATION_NAV_LABELS = {
    home: "Trang chủ",
    shop: "Cửa hàng",
    product: "Chi tiết sản phẩm",
    cart: "Giỏ hàng",
    checkout: "Đặt hàng",
    payment: "Thanh toán",
  };

  const ensureNotificationCenter = () => {
    let center = document.getElementById(NOTIFICATION_CENTER_ID);
    if (!center) {
      center = document.createElement("div");
      center.id = NOTIFICATION_CENTER_ID;
      center.className = "toast-container";
      document.body.appendChild(center);
    }
    return center;
  };

  const mountToast = (variant, duration, configure) => {
    const center = ensureNotificationCenter();
    const toast = document.createElement("div");
    toast.className = `toast toast-${variant}`;
    if (typeof configure === "function") configure(toast);
    center.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("visible"));
    const dismiss = () => {
      toast.classList.remove("visible");
      toast.addEventListener(
        "transitionend",
        () => {
          toast.remove();
        },
        { once: true }
      );
    };
    const delay = Number.isFinite(Number(duration)) ? Number(duration) : 3200;
    const timeoutId = setTimeout(dismiss, delay);
    toast.addEventListener("click", () => {
      clearTimeout(timeoutId);
      dismiss();
    });
  };

  const showNotification = (message = "", variant = "info", duration = 3200) => {
    const trimmedMessage = String(message || "").trim();
    if (!trimmedMessage) return;
    mountToast(variant, duration, (toast) => {
      toast.textContent = trimmedMessage;
    });
  };

  const showNotificationWithLink = (
    message = "",
    linkHref = "",
    linkLabel = "",
    variant = "info",
    duration = 4200
  ) => {
    const trimmedMessage = String(message || "").trim();
    if (!trimmedMessage && !linkHref) return;
    mountToast(variant, duration, (toast) => {
      const parts = [];
      if (trimmedMessage) {
        parts.push(`<span>${escapeHtml(trimmedMessage)}</span>`);
      }
      if (linkHref) {
        const safeHref = escapeHtml(linkHref);
        const safeLabel = escapeHtml(linkLabel || "Xem trang sản phẩm");
        parts.push(
          `<a href="${safeHref}" target="_blank" rel="noreferrer">${safeLabel}</a>`
        );
      }
      toast.innerHTML = parts.join(" ");
    });
  };

  const redirectToPaymentPage = (orderCode) => {
    const base =
      typeof window !== "undefined" && window.location && window.location.origin
        ? window.location.origin
        : window.location.href;
    try {
      const targetUrl = new URL("payment.html", base);
      if (orderCode) {
        targetUrl.searchParams.set("order", orderCode);
      }
      window.location.href = targetUrl.toString();
    } catch (error) {
      window.location.href = `payment.html${orderCode ? `?order=${encodeURIComponent(orderCode)}` : ""}`;
    }
  };

  const annotateNotificationTargets = () => {
    document.querySelectorAll("[data-nav]").forEach((trigger) => {
      if (trigger.dataset.notification) return;
      const label = NOTIFICATION_NAV_LABELS[trigger.dataset.nav] || trigger.textContent.trim();
      if (label) trigger.dataset.notification = `Đang chuyển tới ${label}`;
    });
    document.querySelectorAll(".hero-actions a").forEach((trigger) => {
      if (trigger.dataset.notification) return;
      const label = trigger.textContent.trim();
      trigger.dataset.notification = `Bạn chọn ${label || "chức năng mua sắm"}`;
    });
    document.querySelectorAll(".bottom-nav a").forEach((trigger) => {
      if (trigger.dataset.notification) return;
      const label = trigger.textContent.replace(/\([^)]*\)/, "").trim();
      if (label) trigger.dataset.notification = `Mở ${label}`;
    });
    document.querySelectorAll(".actions .btn, .section .btn").forEach((trigger) => {
      if (trigger.dataset.notification) return;
      const label = trigger.textContent.trim();
      if (label) trigger.dataset.notification = `Đã chọn ${label}`;
    });
    const filterClear = document.getElementById("clearFilters");
    if (filterClear && !filterClear.dataset.notification) {
      filterClear.dataset.notification = "Đã làm mới bộ lọc";
    }
  };

  const handleNotificationClick = (event) => {
    const trigger = event.target.closest("[data-notification]");
    if (!trigger) return;
    showNotification(trigger.dataset.notification);
  };

  const initNotifications = () => {
    annotateNotificationTargets();
    document.body.addEventListener("click", handleNotificationClick);
  };

  const renderRatePanel = (container, settings) => {
    if (!container) return;
    container.innerHTML = `
      <div class="card soft">
        <span class="badge">Base → JPY</span>
        <h3>${settings.rateJPY}</h3>
        <p>Tỷ giá tính từ ${settings.baseCurrency}.</p>
      </div>
      <div class="card soft">
        <span class="badge orange">Base → VND</span>
        <h3>${formatNumber(settings.rateVND)}</h3>
        <p>Cập nhật ngày ${settings.rateUpdated}.</p>
      </div>
    `;
  };

    const getDisplayName = (product) => {
      if (!product) return "Sản phẩm";
      const original = (product.name || "").trim();
      if (!original) return "Sản phẩm";
      const stripped = original.replace(/-淘宝网.*$/i, "").trim();
      return stripped.split("·")[0].split("·")[0];
    };

    const buildProductCard = (product, settings) => {
      const price = convertPrice(product.basePrice, settings);
      const baseWithFee = applyProductFee(product.basePrice);
      const wished = isWishlisted(product.id);
      const images = getProductImages(product);
      const heroImage = images[0] || "";
      const highlightBadge = (
        product.tags && product.tags.length ? product.tags[0] : "New"
      ).toString().toUpperCase();
      const isPriority = isPriorityProductEntry(product);
      const displayName = escapeHtml(getDisplayName(product));
      const placeholderInitials = (() => {
        const raw = (product.name || "").trim();
        if (!raw) return "SP";
        const initials = raw
          .split(/\s+/)
          .filter(Boolean)
          .map((segment) => segment[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("");
        if (initials) return initials;
        return raw.slice(0, 2);
      })();
      const placeholderMarkup = `<span class="product-image-placeholder">${escapeHtml(
        placeholderInitials.toUpperCase()
      )}</span>`;
      const imageMarkup = heroImage
        ? `<img class="product-image-inner" src="${escapeHtml(heroImage)}" loading="eager" alt="${displayName}" />`
        : placeholderMarkup;
      const thumbSources = images.slice(0, 5);
      const thumbButtons =
        thumbSources.length > 0
          ? thumbSources
              .map((src, index) => {
                const safeSrc = escapeHtml(src);
                const altLabel = `${displayName} ${index + 1}`;
                return `
                  <button type="button" class="product-thumb${index === 0 ? " active" : ""}" data-thumb-src="${safeSrc}" aria-label="${altLabel}">
                    <img src="${safeSrc}" alt="${altLabel}" loading="lazy" />
                  </button>
                `;
              })
              .join("")
          : "";
      const thumbStrip = thumbButtons
        ? `<div class="product-thumb-strip" data-product-thumb-strip>${thumbButtons}</div>`
        : `<div class="product-thumb-strip" data-product-thumb-strip><span class="helper small">Chưa có ảnh phụ.</span></div>`;
      return `
        <article class="card product-card ${wished ? "is-wish" : ""} ${isPriority ? "is-priority" : ""}" data-product-card data-id="${product.id}" tabindex="0">
          <button class="wish-btn ${wished ? "active" : ""}" type="button" data-wish="${product.id}" aria-pressed="${wished}" aria-label="${wished ? "Bỏ lưu" : "Lưu"}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21s-6.7-4.4-9.3-8.2C.6 9.4 2.2 5.8 5.7 5.1c2-.4 3.8.3 5 1.8 1.2-1.5 3-2.2 5-1.8 3.5.7 5.1 4.3 3 7.7C18.7 16.6 12 21 12 21z"></path>
            </svg>
          </button>
          <div class="product-image">
            <span class="product-highlight-badge">${isPriority ? "Ưu tiên" : highlightBadge}</span>
            ${imageMarkup}
            <div class="product-image-gloss"></div>
            <div class="product-meta-overlay">
              <h3 class="product-title">${displayName}</h3>
              <div class="price price-main">${formatCurrency(baseWithFee, settings.baseCurrency)}</div>
            </div>
          </div>
          ${thumbStrip}
        </article>
      `;
    };

    const renderProductGrid = (products, container, mode = "grid", append = false, nextOffset = 0) => {
    if (!container) return;
    const settings = getSettings();
    container.dataset.view = mode;
    const removeSentinel = () => {
      const existingSentinel = container.querySelector(".load-more-sentinel");
      if (existingSentinel) existingSentinel.remove();
    };

    const visibleProducts = Array.isArray(products) ? products : [];
    if (!visibleProducts.length) {
      removeSentinel();
      container.innerHTML = "<div class=\"card empty-state\">Không tìm thấy sản phẩm phù hợp.</div>";
      return;
    }

    const cardsHtml = visibleProducts.map((product) => buildProductCard(product, settings)).join("");

    if (append) {
      removeSentinel();
      container.insertAdjacentHTML("beforeend", cardsHtml);
    } else {
      removeSentinel();
      container.innerHTML = cardsHtml;
    }

    if (nextOffset > 0) {
      removeSentinel();
      container.insertAdjacentHTML(
        "beforeend",
        `<div class="load-more-sentinel" data-offset="${nextOffset}">
          <div class="card empty-state">Đang tải thêm sản phẩm...</div>
        </div>`
      );
    }

    bindProductCardNavigation(container);
    bindProductCardThumbnails(container);
    bindWishlistToggle(container);
  };

  const SYNC_WARNING_ID = "shopSyncWarning";

  const renderSyncWarning = (section, message) => {
    if (!section || !message) return;
    let notice = document.getElementById(SYNC_WARNING_ID);
    if (!notice) {
      notice = document.createElement("div");
      notice.id = SYNC_WARNING_ID;
      notice.className = "card sync-warning";
      const header = section.querySelector(".section-header");
      if (header) {
        header.insertAdjacentElement("afterend", notice);
      } else {
        section.prepend(notice);
      }
    }
    notice.innerHTML = `<strong>Đồng bộ thất bại</strong><p>${message}</p>`;
  };

  const clearSyncWarning = () => {
    const existing = document.getElementById(SYNC_WARNING_ID);
    if (existing) existing.remove();
  };

  const bindProductCardNavigation = (container) => {
    if (!container || container.dataset.bound === "true") return;
    container.dataset.bound = "true";
    const navigate = (card) => {
      const id = card.dataset.id;
      if (id) window.location.href = `product.html?id=${id}`;
    };
    container.addEventListener("click", (event) => {
      if (event.target.closest("a, button, input, select, textarea")) return;
      const card = event.target.closest("[data-product-card]");
      if (!card) return;
      navigate(card);
    });
    container.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest("[data-product-card]");
      if (!card) return;
      event.preventDefault();
      navigate(card);
    });
  };

  const bindProductCardThumbnails = (container) => {
    if (!container || container.dataset.thumbBound === "true") return;
    container.dataset.thumbBound = "true";
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-thumb-src]");
      if (!button) return;
      const card = button.closest("[data-product-card]");
      if (!card) return;
      const src = button.dataset.thumbSrc;
      if (!src) return;
      event.preventDefault();
      event.stopPropagation();
      const heroImage = card.querySelector(".product-image-inner");
      if (heroImage) {
        heroImage.src = src;
      }
      card.querySelectorAll("[data-thumb-src]").forEach((node) => {
        node.classList.toggle("active", node === button);
      });
    });
  };

  const bindWishlistToggle = (container) => {
    if (!container || container.dataset.wishBound === "true") return;
    container.dataset.wishBound = "true";
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-wish]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const id = button.dataset.wish;
      if (!id) return;
      const active = toggleWishlist(id);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      const card = button.closest("[data-product-card]");
      if (card) card.classList.toggle("is-wish", active);
      updateWishlistBadge();
      renderWishlistSections();
    });
  };

  const renderWishlistSections = () => {
    const products = getVisibleProducts();
    const resolve = (ids) =>
      ids
        .map((id) => products.find((product) => product.id === id))
        .filter(Boolean);

    const wishlistGrid = document.getElementById("wishlistGrid");
    const wishlistSection = document.getElementById("wishlistSection");
    if (wishlistGrid || wishlistSection) {
      const wishlistItems = resolve(getWishlist());
      if (wishlistGrid) {
        renderProductGrid(wishlistItems, wishlistGrid, "compact");
      }
      if (wishlistSection) {
        wishlistSection.classList.toggle("hidden", !wishlistItems.length);
      }
    }

    const recentGrid = document.getElementById("recentGrid");
    const recentSection = document.getElementById("recentSection");
    if (recentGrid || recentSection) {
      const recentItems = resolve(getRecent());
      if (recentGrid) {
        renderProductGrid(recentItems, recentGrid, "compact");
      }
      if (recentSection) {
        recentSection.classList.toggle("hidden", !recentItems.length);
      }
    }
  };

  const initHome = () => {
    const settings = getSettings();
    const products = getVisibleProducts();
    renderRatePanel(document.getElementById("homeRates"), settings);
    renderWishlistSections();
    bindSearchRedirect(
      document.getElementById("homeSearch"),
      document.getElementById("homeSearchBtn"),
      "shop.html"
    );

    const requestSection = document.getElementById("homeRequestSection");
    if (requestSection) {
      const nameInput = document.getElementById("requesterName");
      const fbInput = document.getElementById("requesterFb");
      const sizeInput = document.getElementById("requestSize");
      const colorInput = document.getElementById("requestColor");
      const otherInput = document.getElementById("requestOther");
      const linkInput = document.getElementById("requestLinkInput");
      const bulkLinks = document.getElementById("requestBulkLinks");
      const imageLinks = document.getElementById("requestImageLinks");
      const addLinkBtn = document.getElementById("requestAddLink");
      const addMultipleBtn = document.getElementById("requestAddMultiple");
      const clearLinksBtn = document.getElementById("requestClearLinks");
      const linksList = document.getElementById("requestLinksList");
      const submitRequestBtn = document.getElementById("submitRequest");
      const feedbackEl = document.getElementById("requestFeedback");
      let requestLinks = [];
      let submittingRequest = false;

      const renderRequestLinks = () => {
        if (!linksList) return;
        if (!requestLinks.length) {
          linksList.innerHTML = '<span class="helper small">Chưa có link nào.</span>';
          return;
        }
        linksList.innerHTML = requestLinks
          .map(
            (value, index) => `
              <span class="link-item">
                <strong>${escapeHtml(value)}</strong>
                <button type="button" data-remove-link="${index}" aria-label="Xóa link">&times;</button>
              </span>
            `
          )
          .join("");
      };

      const addRequestLinkValue = (value) => {
        const normalized = normalizeExternalUrl(value);
        if (!normalized || requestLinks.includes(normalized)) return false;
        requestLinks = [...requestLinks, normalized];
        renderRequestLinks();
        return true;
      };

      const addLinksFromMultiline = (raw) => {
        if (!raw) return false;
        const entries = raw
          .split(/\n|,/)
          .map((value) => value.trim())
          .filter(Boolean);
        let added = false;
        entries.forEach((entry) => {
          if (addRequestLinkValue(entry)) added = true;
        });
        return added;
      };

      const clearRequestLinks = () => {
        requestLinks = [];
        renderRequestLinks();
      };

      const setFeedback = (message, variant = "info") => {
        if (!feedbackEl) return;
        feedbackEl.textContent = message;
        feedbackEl.classList.add("helper", "small");
        if (variant === "error") {
          feedbackEl.classList.add("helper-error");
        } else {
          feedbackEl.classList.remove("helper-error");
        }
      };

      const collectImageURLs = () =>
        (String(imageLinks?.value || "")
          .split(/\n|,/)
          .map((value) => normalizeExternalUrl(value))
          .filter(Boolean));

      const handleSubmitRequest = async () => {
        if (submittingRequest) return;
        if (!nameInput?.value.trim()) {
          setFeedback("Vui lòng nhập tên khách hàng trước khi gửi.", "error");
          return;
        }
        if (!requestLinks.length) {
          setFeedback("Vui lòng thêm ít nhất một link Taobao để admin kiểm tra.", "error");
          return;
        }
        submittingRequest = true;
        submitRequestBtn?.setAttribute("disabled", "disabled");
        setFeedback("Đang gửi yêu cầu...");
        const payloadLinks = await Promise.all(
          requestLinks.map(async (link) => ({
            url: link,
            preview: await fetchLinkMetadata(link),
          }))
        );
        const requestEntry = {
          id: `req-${Date.now().toString(36)}`,
          createdAt: new Date().toISOString(),
          name: nameInput.value.trim(),
          facebook: fbInput?.value.trim() || "",
          sizeNote: sizeInput?.value.trim() || "",
          colorNote: colorInput?.value.trim() || "",
          otherNote: otherInput?.value.trim() || "",
          imageLinks: collectImageURLs(),
          links: payloadLinks,
        };
        try {
          addCustomerRequest(requestEntry);
          await performSync({ reason: "customer-request", silent: true });
          setFeedback("Đã gửi yêu cầu. Admin sẽ liên hệ qua Facebook.", "info");
          if (nameInput) nameInput.value = "";
          if (fbInput) fbInput.value = "";
          if (sizeInput) sizeInput.value = "";
          if (colorInput) colorInput.value = "";
          if (otherInput) otherInput.value = "";
          if (linkInput) linkInput.value = "";
          if (bulkLinks) bulkLinks.value = "";
          if (imageLinks) imageLinks.value = "";
          clearRequestLinks();
        } catch (error) {
          console.error("Gửi yêu cầu thất bại:", error);
          setFeedback("Không thể gửi yêu cầu. Vui lòng thử lại.", "error");
        } finally {
          submittingRequest = false;
          submitRequestBtn?.removeAttribute("disabled");
        }
      };

      if (addLinkBtn) {
        addLinkBtn.addEventListener("click", () => {
          if (linkInput?.value && addRequestLinkValue(linkInput.value)) {
            linkInput.value = "";
            setFeedback("Đã thêm link.", "info");
          } else {
            setFeedback("Link không hợp lệ hoặc đã tồn tại.", "error");
          }
        });
      }

      if (addMultipleBtn) {
        addMultipleBtn.addEventListener("click", () => {
          if (bulkLinks?.value && addLinksFromMultiline(bulkLinks.value)) {
            bulkLinks.value = "";
            setFeedback("Đã thêm các link từ danh sách.", "info");
          } else {
            setFeedback("Không tìm thấy link mới từ nội dung.", "error");
          }
        });
      }

      if (clearLinksBtn) {
        clearLinksBtn.addEventListener("click", () => {
          clearRequestLinks();
          setFeedback("Đã xoá hết link.");
        });
      }

      if (linksList) {
        linksList.addEventListener("click", (event) => {
          const button = event.target.closest("[data-remove-link]");
          if (!button) return;
          const index = Number(button.dataset.removeLink);
          if (Number.isNaN(index)) return;
          requestLinks = requestLinks.filter((_, idx) => idx !== index);
          renderRequestLinks();
        });
      }

      if (submitRequestBtn) {
        submitRequestBtn.addEventListener("click", handleSubmitRequest);
      }

      renderRequestLinks();
    }
  };

  const renderAutoImportStatus = (status) => {
    const container = document.getElementById("autoImportStatus");
    if (!container) return;
    if (!status) {
      container.innerHTML = "";
      return;
    }
    const { running, message, log } = status.state;
    const logLines = (log || "").split("\n").slice(-10).join("\n");
    container.innerHTML = `
      <div class="card">
        <h3>Trạng thái import</h3>
        <p><strong>Trạng thái:</strong> ${running ? "Đang chạy" : "Đã dừng"}</p>
        <p><strong>Thông báo:</strong> ${message}</p>
        <details>
          <summary>Xem log</summary>
          <pre>${logLines}</pre>
        </details>
      </div>
    `;
  };

  const pollAutoImportStatus = async () => {
    const settings = getSettings();
    const url = buildAutoImportUrl(settings, "/auto-import/status");
    if (!url) return;
    try {
      const response = await fetch(url, {
        headers: { "x-api-key": settings.apiKey },
      });
      ensureImporterSupported(response);
      const status = await response.json();
      renderAutoImportStatus(status);
      if (status.state.running) {
        setTimeout(pollAutoImportStatus, 2000);
      }
    } catch (error) {
      console.error("Auto import status poll failed:", error);
      renderAutoImportStatus({
        state: {
          running: false,
          message: `Lỗi: ${error.message}`,
          log: "",
        },
      });
    }
  };

  const runAutoImport = async () => {
    const settings = getSettings();
    if (settings.importEndpoint.includes("taobao.com")) {
      console.error("Lỗi: Import URL không được trỏ trực tiếp đến taobao.com. Vui lòng cấu hình lại trong trang Admin -> Cấu hình.");
      alert("Lỗi: Import URL không được trỏ trực tiếp đến taobao.com. Vui lòng cấu hình lại trong trang Admin -> Cấu hình.");
      return;
    }
    if (!settings.importEndpoint || settings.importEndpoint === DEFAULT_SETTINGS.importEndpoint) {
      alert("Vui lòng cấu hình Import URL trong trang Admin để sử dụng tính năng này.");
      return;
    }
    const url = buildAutoImportUrl(settings, "/auto-import/run");
    if (!url) return;
    try {
      renderAutoImportStatus({
        state: {
          running: true,
          message: "Đang bắt đầu...",
          log: "",
        },
      });
      const autoImportHeaders = {};
      if (settings.apiKey) autoImportHeaders["x-api-key"] = settings.apiKey;
      const response = await fetch(url, {
        method: "POST",
        headers: autoImportHeaders,
      });
      ensureImporterSupported(response);
      pollAutoImportStatus();
    } catch (error) {
      console.error("Auto import failed:", error);
      renderAutoImportStatus({
        state: {
          running: false,
          message: `Lỗi: ${error.message}`,
          log: "",
        },
      });
    }
  };



  const initShop = async () => {
    const grid = document.getElementById("shopGrid");
    const productSection = grid?.closest(".section");
    const syncWarningMessage =
      "Không thể kết nối backend để lấy dữ liệu sản phẩm. Hiển thị catalog mẫu và kiểm tra cài đặt Sync/Render.";
    let syncFailed = false;
    clearSyncWarning();
    let allFilteredProducts = [];
    let viewMode = store.getItem(KEYS.viewMode) || "grid";
    if (grid) {
      grid.innerHTML = '<div class="card empty-state">Đang tải sản phẩm từ server...</div>';
      const teaserProducts = getVisibleProducts();
      if (teaserProducts.length) {
        renderProductGrid(teaserProducts, grid, viewMode);
      }
    }

    try {
      await performSync({ reason: "initShop", silent: true });
    } catch (error) {
      console.error("Error performing sync in initShop:", error);
      syncFailed = true;
      renderSyncWarning(productSection, syncWarningMessage);
    }
    if (!syncFailed) {
      clearSyncWarning();
    }
    const searchInput = document.getElementById("shopSearch");
    const priceMin = document.getElementById("priceMin");
    const priceMax = document.getElementById("priceMax");
    const sizeFilter = document.getElementById("sizeFilter");
    const categoryFilter = document.getElementById("categoryFilter");
    const sortFilter = document.getElementById("sortFilter");
    const sizeMode = document.getElementById("sizeMode");
    const viewButtons = document.getElementById("viewButtons");
    const filterSummary = document.getElementById("filterSummary");
    const resultCount = document.getElementById("resultCount");
    const clearFiltersBtn = document.getElementById("clearFilters");
    const restoreProductsBtn = document.getElementById("restoreProducts");

    const params = new URLSearchParams(window.location.search);
    const query = params.get("q");
    if (query) searchInput.value = query;
    const viewParam = params.get("view");
    if (["grid", "compact", "list"].includes(viewParam)) {
      viewMode = viewParam;
    }

    renderRatePanel(document.getElementById("shopRates"), getSettings());
    renderCartSummary(document.getElementById("shopCartSummary"));

    const getEffectiveSizeMode = () => {
      const numericSize = /^\d+$/.test(sizeFilter.value.trim());
      const letterSize = /^[A-Za-z]+$/.test(sizeFilter.value.trim());
      const autoMode = numericSize ? "number" : letterSize ? "letter" : "";
      if (!sizeMode) return autoMode;
      if (sizeMode.dataset.manual === "true") return sizeMode.value;
      if (autoMode) {
        sizeMode.value = autoMode;
        sizeMode.dataset.auto = "true";
        return autoMode;
      }
      if (sizeMode.dataset.auto) {
        sizeMode.value = "";
        delete sizeMode.dataset.auto;
      }
      return "";
    };

    if (sizeMode) {
      sizeMode.addEventListener("change", () => {
        if (sizeMode.value) sizeMode.dataset.manual = "true";
        else delete sizeMode.dataset.manual;
        applyFilters();
      });
    }

    const applyFilters = () => {
      const sizeModeValue = getEffectiveSizeMode();
      allFilteredProducts = getFilteredAndSortedProducts(
        searchInput,
        priceMin,
        priceMax,
        sizeFilter,
        categoryFilter,
        sortFilter,
        sizeModeValue
      );

      if (filterSummary) {
        const rawQuery = searchInput.value.trim();
        const summaryParts = [];
        if (rawQuery) summaryParts.push(`"${rawQuery}"`);
        if (priceMin.value || priceMax.value) {
          const from = priceMin.value ? priceMin.value : "0";
          const to = priceMax.value ? priceMax.value : "∞";
          summaryParts.push(`Giá ${from}-${to}`);
        }
        if (sizeFilter.value) summaryParts.push(`Size ${sizeFilter.value}`);
        if (categoryFilter.value) {
          const label = categoryFilter.options[categoryFilter.selectedIndex]?.text || categoryFilter.value;
          summaryParts.push(`Danh mục ${label}`);
        }
        const modeLabel = sizeModeValue
          ? sizeModeValue === "number"
            ? "Size số (giày dép)"
            : "Size chữ (quần áo)"
          : "";
        if (modeLabel) summaryParts.push(modeLabel);
        if (sortFilter.value !== "new") {
          const label = sortFilter.options[sortFilter.selectedIndex]?.text || sortFilter.value;
          summaryParts.push(`Sắp xếp ${label}`);
        }
        filterSummary.textContent = summaryParts.length ? summaryParts.join(" • ") : "Chưa lọc";
      }
      if (resultCount) resultCount.textContent = `${allFilteredProducts.length} sản phẩm`;

      renderProductGrid(allFilteredProducts, grid, viewMode);
    };

    const restoreCatalogProducts = () => {
      const currentProducts = Array.isArray(getProducts()) ? getProducts() : [];
      const existingIds = new Set(
        currentProducts.map((product) => product?.id).filter(Boolean)
      );
      const missingDefaults = DEFAULT_PRODUCTS.filter(
        (product) => product?.id && !existingIds.has(product.id)
      );
      const deletedIds = getDeletedProductIds();
      if (!missingDefaults.length && deletedIds.size === 0) {
        showNotification("Đang hiển thị toàn bộ sản phẩm.", "info");
        return;
      }
      const nextProducts = [...currentProducts];
      missingDefaults.forEach((product) => nextProducts.push(product));
      setDeletedProductIds([]);
      setProducts(nextProducts);
      showNotification("Đã khôi phục toàn bộ catalog mẫu.", "info");
      applyFilters();
    };

    const debouncedApplyFilters = debounce(applyFilters, 120);

    const setViewMode = (mode) => {
      viewMode = mode;
      store.setItem(KEYS.viewMode, mode);
      document.querySelectorAll("#viewButtons button").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.view === mode);
      });
      applyFilters();
    };

    if (viewButtons) {
      viewButtons.addEventListener("click", (event) => {
        const target = event.target.closest("button[data-view]");
        if (!target) return;
        setViewMode(target.dataset.view);
      });
    }

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => {
        searchInput.value = "";
        priceMin.value = "";
        priceMax.value = "";
        sizeFilter.value = "";
        categoryFilter.value = "";
        sortFilter.value = "new";
        if (sizeMode) {
          sizeMode.value = "";
          delete sizeMode.dataset.manual;
          delete sizeMode.dataset.auto;
        }
        applyFilters();
      });
    }

    if (restoreProductsBtn) {
      restoreProductsBtn.addEventListener("click", restoreCatalogProducts);
    }

    [searchInput, priceMin, priceMax].forEach((input) => {
      input.addEventListener("input", debouncedApplyFilters);
    });
    [sizeFilter, categoryFilter, sortFilter].forEach((select) => {
      select.addEventListener("change", applyFilters);
    });

    const metadataStatus = document.getElementById("shopMetadataStatus");
    if (metadataStatus) {
      metadataStatus.classList.remove("success", "error");
      metadataStatus.textContent = "Đang cập nhật bộ lọc...";
    }
    const metadataPromise = fetchShopMetadata();

    setViewMode(viewMode);

    const metadata = await metadataPromise;
    const combinedMetadata = {
      ...SHOP_METADATA_DEFAULT,
      ...(metadata || {}),
    };
    applyShopMetadataToFilters(combinedMetadata, { categoryFilter, sizeFilter, sortFilter });
    if (metadataStatus) {
      metadataStatus.classList.add(metadata ? "success" : "error");
      metadataStatus.textContent = metadata
        ? "Bộ lọc đã đồng bộ từ backend."
        : "Không thể tải bộ lọc từ backend. Đang dùng giá trị mặc định.";
    }

    applyFilters();
  };

  const renderSizeButtons = (sizes, stock) => {
    if (!sizes.length) return '<span class="tag">Không có</span>';
    return sizes
      .map((size) => {
        const out = stock[size] === 0;
        return `<button type="button" data-size="${size}" ${out ? "disabled" : ""}>${size}</button>`;
      })
      .join("");
  };

  const initProduct = () => {
    const params = new URLSearchParams(window.location.search);
    const products = getVisibleProducts();
    const settings = getSettings();
    const productId = params.get("id") || products[0]?.id;
    const product = products.find((item) => item.id === productId) || products[0];

    const productMain = document.getElementById("productMain");
    const productThumbs = document.getElementById("productThumbs");
    const productTags = document.getElementById("productTags");
    const productDefaults = document.getElementById("productDefaults");
    const productName = document.getElementById("productName");
    const productDesc = document.getElementById("productDesc");
    const productPrices = document.getElementById("productPrices");
    const productStock = document.getElementById("productStock");
    const sizeText = document.getElementById("sizeText");
    const sizeNum = document.getElementById("sizeNum");
    const sizeHint = document.getElementById("sizeHint");
    const addToCartBtn = document.getElementById("addToCart");
    const buyNowBtn = document.getElementById("buyNow");
    const productWish = document.getElementById("productWish");
    const relatedGrid = document.getElementById("relatedGrid");
    const stickyBuy = document.getElementById("stickyBuy");
    const stickyBuyPrice = document.getElementById("stickyBuyPrice");
    const stickyBuySize = document.getElementById("stickyBuySize");
    const stickyAdd = document.getElementById("stickyAdd");
    const stickyBuyNow = document.getElementById("stickyBuyNow");
    const productImageSkeleton = document.getElementById("productImageSkeleton");
    const productInfoCard = document.getElementById("productInfoCard");
    const productCodeInfo = document.getElementById("productCodeInfo");
    const productCategoryInfo = document.getElementById("productCategoryInfo");
    const productSourceInfo = document.getElementById("productSourceInfo");
    const productSizeInfo = document.getElementById("productSizeInfo");
    const productStockInfo = document.getElementById("productStockInfo");
    const productRatingInfo = document.getElementById("productRatingInfo");
    const productPositiveRateInfo = document.getElementById("productPositiveRateInfo");
    const productSoldInfo = document.getElementById("productSoldInfo");
    const productColorInfo = document.getElementById("productColorInfo");
    const productSourceLink = document.getElementById("productSourceLink");
    const reviewAverageBadge = document.getElementById("reviewAverageBadge");
    const reviewCountBadge = document.getElementById("reviewCountBadge");
    const reviewPositiveBadge = document.getElementById("reviewPositiveBadge");
    const reviewListContainer = document.getElementById("productReviewsList");
    const reviewForm = document.getElementById("productReviewForm");
    const reviewRatingInput = document.getElementById("reviewRating");
    const reviewRatingValue = document.getElementById("reviewRatingValue");
    const reviewNameInput = document.getElementById("reviewName");
    const reviewTextInput = document.getElementById("reviewText");
    const reviewAttachmentsInput = document.getElementById("reviewAttachments");
    const reviewAttachmentPreview = document.getElementById("reviewAttachmentPreview");
    const reviewFormFeedback = document.getElementById("reviewFormFeedback");
    const taobaoLinkForm = document.getElementById("taobaoLinkForm");
    const taobaoLinkInput = document.getElementById("taobaoLinkInput");
    const taobaoDescriptionInput = document.getElementById("taobaoDescription");
    const taobaoFilesInput = document.getElementById("taobaoFiles");
    const taobaoFilePreview = document.getElementById("taobaoFilePreview");
    const taobaoFormFeedback = document.getElementById("taobaoFormFeedback");
    const taobaoLinkReset = document.getElementById("taobaoLinkReset");
    const reviewStarButtons = Array.from(document.querySelectorAll("[data-rating-star]"));
    const productLongDesc = document.getElementById("productLongDesc");
    const productDescHighlights = document.getElementById("productDescHighlights");
    const productSummaryCode = document.getElementById("productSummaryCode");
    const productSummaryCategory = document.getElementById("productSummaryCategory");
    const productSummarySource = document.getElementById("productSummarySource");
    const productSummarySize = document.getElementById("productSummarySize");
    const productSummaryStock = document.getElementById("productSummaryStock");
    const productDescriptionCard = document.getElementById("productDescriptionCard");
    const productDescriptionSource = document.getElementById("productDescriptionSource");
    const productVariantSelector = document.getElementById("productVariantSelector");
    const productVariantList = document.getElementById("productVariantList");
    const variantFeedback = document.getElementById("variantFeedback");
    const imageChoiceGrid = document.getElementById("productImageChoiceGrid");
    const imageChoiceStatus = document.getElementById("productImageChoiceStatus");
    let remoteProductMetadata = null;

    const updateProductSummary = () => {
      if (!product) return;
      if (productSummaryCode) productSummaryCode.textContent = product.id || "-";
      if (productSummaryCategory) {
        const label = CATEGORY_LABELS[product.category] || product.category || "Chưa phân loại";
        productSummaryCategory.textContent = label;
      }
      if (productSummarySource) productSummarySource.textContent = sourceLabel(product.source);
      if (productSummarySize) {
        const sizes = getProductSizeList(product);
        productSummarySize.textContent = sizes.length ? sizes.join(", ") : "Chưa có size";
      }
      if (productSummaryStock) {
        const stocks = getProductStockValues(product);
        const totalStock = stocks.reduce((sum, value) => sum + Number(value || 0), 0);
        productSummaryStock.textContent = totalStock
          ? `${formatNumber(totalStock)} sản phẩm`
          : "Chưa có dữ liệu";
      }
    };
    const getProductVariantOptions = (sourceProduct) => {
      if (!sourceProduct) return [];
      const rawVariants = Array.isArray(sourceProduct.variants) ? sourceProduct.variants : [];
      if (!rawVariants.length) return [];
      return rawVariants.map((variant, index) => {
        const candidateId =
          variant.id ||
          variant.sku ||
          variant.code ||
          variant.key ||
          variant.ref ||
          `${sourceProduct.id || "variant"}-${index}`;
        const colorTag =
          variant.color ||
          variant.props?.color ||
          (Array.isArray(variant.colors) ? variant.colors[0] : "") ||
          "";
        const sizeTag =
          variant.size ||
          variant.props?.size ||
          variant.label ||
          variant.name ||
          "";
        const labelParts = [];
        if (variant.name) labelParts.push(variant.name);
        if (colorTag && !labelParts.includes(colorTag)) labelParts.push(colorTag);
        if (sizeTag && !labelParts.includes(sizeTag)) labelParts.push(sizeTag);
        if (!labelParts.length) labelParts.push(`Biến thể ${index + 1}`);
        const badge =
          variant.badge ||
          variant.tag ||
          (Array.isArray(variant.tags) ? variant.tags[0] : "") ||
          variant.highlight ||
          "";
        const image =
          variant.image ||
          variant.images?.[0] ||
          variant.thumbnail ||
          variant.picture ||
          "";
        const priceValue =
          variant.price ??
          variant.basePrice ??
          variant.listPrice ??
          variant.value ??
          sourceProduct.basePrice ??
          0;
        const numericPrice = Number(priceValue) || 0;
        const stockRaw =
          variant.stock ?? variant.qty ?? variant.inventory ?? variant.count ?? null;
        const stock =
          Number.isFinite(Number(stockRaw)) && Number(stockRaw) >= 0 ? Number(stockRaw) : null;
        const available =
          variant.available === false
            ? false
            : stock !== null
            ? stock > 0
            : variant.outOfStock === true
            ? false
            : true;
        return {
          id: String(candidateId),
          name: labelParts.join(" · "),
          badge,
          image,
          price: numericPrice,
          stock,
          available,
          color: colorTag,
          metadata: variant,
        };
      });
    };
    let variantOptions = getProductVariantOptions(product);
    let selectedVariantId = "";
    const getSelectedVariant = () =>
      variantOptions.find((option) => option.id === selectedVariantId) || null;
    const setVariantFeedback = (message = "", isError = false) => {
      if (!variantFeedback) return;
      variantFeedback.innerHTML = message || "";
      variantFeedback.classList.toggle("hidden", !message);
      variantFeedback.classList.toggle("error", Boolean(isError));
    };
    const renderVariantOptions = () => {
      if (!productVariantSelector || !productVariantList) return;
      if (!variantOptions.length) {
        productVariantSelector.classList.add("hidden");
        return;
      }
      productVariantSelector.classList.remove("hidden");
      const markup = variantOptions
        .map((option) => {
          const safeText = escapeHtml(option.name);
          const safeId = escapeHtml(option.id);
          const badgeMarkup = option.badge
            ? `<span class="variant-badge">${escapeHtml(option.badge)}</span>`
            : "";
          const stockLabel = option.available
            ? option.stock !== null
              ? `<span class="helper small">${formatNumber(option.stock)} còn lại</span>`
              : ""
            : `<span class="helper small">Hết hàng</span>`;
          const imageStyle = option.image
            ? `style="background-image:url('${escapeHtml(option.image)}')"`
            : "";
          const isActive = selectedVariantId === option.id;
          const disabledAttr = option.available ? "" : "disabled";
          const meta = `${option.name}${option.badge ? ` · ${option.badge}` : ""}`;
          return `
            <button
              type="button"
              class="variant-option${isActive ? " active" : ""}${option.available ? "" : " disabled"}"
              data-variant-id="${safeId}"
              ${disabledAttr}
              aria-label="${escapeHtml(meta)}"
              aria-pressed="${isActive}"
            >
              <span class="variant-image"${imageStyle}></span>
              <span class="variant-meta">
                <strong>${safeText}</strong>
                ${badgeMarkup}
                ${stockLabel}
              </span>
            </button>
          `;
        })
        .join("");
      productVariantList.innerHTML = markup;
    };
    const variantRequirementContext = () => {
      const baseMessage = "Vui lòng chọn biến thể trước khi thao tác.";
      const explicitLink = product?.sourceUrl || product?.link || "";
      const fallbackLink =
        explicitLink ||
        (typeof window !== "undefined" && typeof window.location !== "undefined"
          ? window.location.href
          : "");
      const linkLabel = explicitLink ? "Xem link gốc" : "Xem trang sản phẩm";
      const safeMessage = escapeHtml(baseMessage);
      const safeLinkLabel = escapeHtml(linkLabel);
      const linkMarkup = fallbackLink
        ? ` <a href="${escapeHtml(fallbackLink)}" target="_blank" rel="noreferrer">${safeLinkLabel}</a>`
        : "";
      return {
        message: baseMessage,
        href: fallbackLink,
        label: linkLabel,
        markup: `${safeMessage}${linkMarkup}`,
      };
    };
    const variantRequirementMessage = () => variantRequirementContext().markup;
    const renderDescriptionHighlights = (items = []) => {
      if (!productDescHighlights) return;
      const list = Array.isArray(items) ? items.filter(Boolean) : [];
      if (!list.length) {
        productDescHighlights.innerHTML = '<span class="tag">Chưa có điểm nổi bật</span>';
        return;
      }
      productDescHighlights.innerHTML = list
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");
    };

    const updateProductDescription = () => {
      if (productLongDesc) {
        const description =
          remoteProductMetadata?.desc?.trim() ||
          product.longDesc ||
          product.description ||
          product.desc ||
          "Chưa có mô tả cụ thể.";
        productLongDesc.textContent = description;
      }
      const combinedHighlights = Array.from(
        new Set([
          ...(remoteProductMetadata?.highlights || []),
          ...(Array.isArray(product.highlights) ? product.highlights : []),
          ...(Array.isArray(product.tags) ? product.tags : []),
          ...((remoteProductMetadata?.colors || []).map((entry) =>
            typeof entry === "string" ? entry : entry?.name
          ).filter(Boolean)),
        ])
      );
      renderDescriptionHighlights(combinedHighlights);
      if (productDescriptionCard) {
        productDescriptionCard.classList.toggle(
          "has-remote-source",
          Boolean(remoteProductMetadata?.desc)
        );
      }
      if (productDescriptionSource) {
        if (remoteProductMetadata?.source) {
          productDescriptionSource.textContent = `Dữ liệu mô tả từ ${remoteProductMetadata.source}`;
          productDescriptionSource.classList.remove("hidden");
        } else {
          productDescriptionSource.classList.add("hidden");
        }
      }
      if (!remoteProductMetadata?.desc) {
        const linkSource = product.sourceUrl || product.link || "";
        if (linkSource && productLongDesc) {
          fetchDescriptionFromLink(linkSource).then((remoteDesc) => {
            if (remoteDesc) {
              remoteProductMetadata = {
                ...remoteProductMetadata,
                desc: remoteDesc,
                source: remoteProductMetadata?.source || linkSource,
              };
              updateProductDescription();
            }
          });
        }
      }
    };

    const mergeRemoteReviewStats = (baseline) => {
      if (!remoteProductMetadata) return baseline;
      const merged = { ...baseline };
      if (Number.isFinite(Number(remoteProductMetadata.rating))) {
        merged.average = Number(remoteProductMetadata.rating);
      }
      if (Number.isFinite(Number(remoteProductMetadata.ratingCount))) {
        merged.total = Number(remoteProductMetadata.ratingCount);
      }
      if (Number.isFinite(Number(remoteProductMetadata.positiveRate))) {
        merged.positiveRate = Number(remoteProductMetadata.positiveRate);
      }
      return merged;
    };

    const applyRemoteProductDetails = (data, sourceUrl) => {
      if (!data) return;
      const colors = Array.isArray(data.colors) ? data.colors : [];
      const highlights = colors
        .map((entry) => (typeof entry === "string" ? entry : entry?.name || "").trim())
        .filter(Boolean);
      remoteProductMetadata = {
        desc: (data.desc || data.description || "").trim(),
        highlights,
        colors,
        rating: Number.isFinite(Number(data.rating)) ? Number(data.rating) : null,
        ratingCount: Number.isFinite(Number(data.ratingCount))
          ? Number(data.ratingCount)
          : null,
        positiveRate: Number.isFinite(Number(data.positiveRate))
          ? Number(data.positiveRate)
          : null,
        soldCount: Number.isFinite(Number(data.soldCount)) ? Number(data.soldCount) : null,
        source: sourceUrl || data.sourceUrl || product.sourceUrl || product.link || "",
      };
      updateProductDescription();
      refreshReviewSection();
    };

    const importProductDataFromLink = async () => {
      const link = product.sourceUrl || product.link || "";
      if (!link) return;
      const normalized = normalizeProductUrl(link);
      const importUrl = buildAutoImportUrl(settings, "/import");
      if (!normalized || !importUrl) return;
      try {
        const headers = { "Content-Type": "application/json" };
        if (settings.apiKey) headers["x-api-key"] = settings.apiKey;
        const response = await fetch(importUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ url: normalized }),
        });
        if (!response.ok) throw new Error("import_failed");
        const payload = await response.json();
        if (payload?.ok && payload.data) {
          applyRemoteProductDetails(payload.data, payload.url || normalized);
        }
      } catch (error) {
        console.warn("Không thể lấy dữ liệu mô tả từ link:", error);
      }
    };

    const REVIEW_ATTACHMENT_LIMIT = 5;
    let attachmentPreviewUrls = [];
    const TAOBAO_ATTACHMENT_LIMIT = 4;
    let taobaoAttachmentUrls = [];

    const updateRatingLabel = (value) => {
      if (!reviewRatingValue) return;
      const parsed = Number.isFinite(value) ? value : Number(reviewRatingInput?.value) || 5;
      reviewRatingValue.textContent = `${parsed} sao`;
    };

    const highlightStars = (value) => {
      if (!reviewStarButtons.length) return;
      const rating = Number.isFinite(value) ? value : Number(reviewRatingInput?.value) || 5;
      reviewStarButtons.forEach((button) => {
        const buttonValue = Number(button.dataset.ratingStar) || 0;
        const active = buttonValue <= rating;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    };

    const showRatingPreview = (value) => {
      const baseline = getDefaultReviewStatsForProduct(product);
      if (reviewAverageBadge) {
        reviewAverageBadge.textContent = `★ ${value} sao`;
      }
      if (reviewCountBadge) {
        reviewCountBadge.textContent = `${baseline.total} lượt đánh giá`;
      }
      if (reviewPositiveBadge) {
        reviewPositiveBadge.textContent = `${formatPositiveRate(baseline.positiveRate)} tích cực`;
      }
    };

    const setSelectedRating = (value, { preview = false } = {}) => {
      const normalized = Math.max(1, Math.min(5, Math.round(Number(value) || 0) || 5));
      if (reviewRatingInput) reviewRatingInput.value = normalized;
      updateRatingLabel(normalized);
      highlightStars(normalized);
      if (preview) showRatingPreview(normalized);
      return normalized;
    };

    const clearAttachmentPreview = () => {
      attachmentPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
      attachmentPreviewUrls = [];
      if (reviewAttachmentPreview) reviewAttachmentPreview.innerHTML = "";
    };

    const clearTaobaoPreview = () => {
      taobaoAttachmentUrls.forEach((url) => URL.revokeObjectURL(url));
      taobaoAttachmentUrls = [];
      if (taobaoFilePreview) taobaoFilePreview.innerHTML = "";
    };

    const updateTaobaoPreview = (fileList) => {
      if (!taobaoFilePreview) return;
      clearTaobaoPreview();
      if (!fileList || !fileList.length) return;
      const limited = Array.from(fileList)
        .filter((file) => (file.type || "").startsWith("image/"))
        .slice(0, TAOBAO_ATTACHMENT_LIMIT);
      taobaoAttachmentUrls = limited.map((file) => URL.createObjectURL(file));
      taobaoFilePreview.innerHTML = limited
        .map((file, index) => {
          const safeUrl = escapeHtml(taobaoAttachmentUrls[index] || "");
          const safeName = escapeHtml(file.name || "Ảnh minh họa");
          return `<figure><img src="${safeUrl}" alt="${safeName}" title="${safeName}" loading="lazy" /></figure>`;
        })
        .join("");
    };

    const resetTaobaoInputs = () => {
      if (taobaoLinkForm) taobaoLinkForm.reset();
      clearTaobaoPreview();
    };

    const setTaobaoFeedback = (message, isError = false) => {
      if (!taobaoFormFeedback) return;
      taobaoFormFeedback.textContent = message || "";
      taobaoFormFeedback.classList.toggle("danger", Boolean(message) && isError);
      taobaoFormFeedback.classList.toggle("success", Boolean(message) && !isError);
      if (!message) {
        taobaoFormFeedback.classList.remove("danger", "success");
      }
    };

    const setReviewFeedback = (message, isError = false) => {
      if (!reviewFormFeedback) return;
      reviewFormFeedback.textContent = message || "";
      reviewFormFeedback.classList.toggle("danger", Boolean(message) && isError);
      reviewFormFeedback.classList.toggle("success", Boolean(message) && !isError);
      if (!message) {
        reviewFormFeedback.classList.remove("danger", "success");
      }
    };

    const updateAttachmentPreview = (fileList) => {
      if (!reviewAttachmentPreview) return;
      clearAttachmentPreview();
      if (!fileList || !fileList.length) return;
      const limited = Array.from(fileList).slice(0, REVIEW_ATTACHMENT_LIMIT);
      attachmentPreviewUrls = limited.map((file) => URL.createObjectURL(file));
      reviewAttachmentPreview.innerHTML = limited
        .map((file, index) => {
          const safeUrl = escapeHtml(attachmentPreviewUrls[index] || "");
          const safeName = escapeHtml(file.name || "Đính kèm");
          if ((file.type || "").startsWith("video/")) {
            return `<video src="${safeUrl}" controls muted playsinline title="${safeName}"></video>`;
          }
          return `<img src="${safeUrl}" alt="${safeName}" title="${safeName}" />`;
        })
        .join("");
    };

    const renderReviewAttachments = (attachments) => {
      if (!attachments || !attachments.length) return "";
      const items = attachments
        .map((attachment) => {
          const safeData = escapeHtml(attachment.data || "");
          if (!safeData) return "";
          const safeName = escapeHtml(attachment.name || "Đính kèm");
          if (attachment.type === "video") {
            return `<video src="${safeData}" controls muted playsinline title="${safeName}"></video>`;
          }
          return `<img src="${safeData}" alt="${safeName}" title="${safeName}" />`;
        })
        .filter(Boolean);
      if (!items.length) return "";
      return `<div class="review-attachments">${items.join("")}</div>`;
    };

    const renderReviewList = (list = []) => {
      if (!reviewListContainer) return;
      if (!list.length) {
        reviewListContainer.innerHTML = `
          <div class="card review-empty">
            <p class="helper small">Chưa có đánh giá nào. Hãy là người đầu tiên chia sẻ cảm nhận.</p>
          </div>
        `;
        return;
      }
      reviewListContainer.innerHTML = list
        .map((review) => {
          const name = escapeHtml(review.name || "Khách hàng");
          const ratingValue = Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0)));
          const body = escapeHtml(review.text || "").replace(/\n/g, "<br />");
          const stars = Array.from({ length: 5 })
            .map(
              (_, index) =>
                `<span class="star ${index < ratingValue ? "active" : ""}" aria-hidden="true">★</span>`
            )
            .join("");
          const attachments = renderReviewAttachments(review.attachments || []);
          return `
            <article class="card review-card">
              <header class="review-card-header">
                <div>
                  <strong>${name}</strong>
                  <div class="review-stars">${stars}</div>
                </div>
                <span class="helper small">${formatDateTime(review.createdAt)}</span>
              </header>
              <p class="review-body">${body}</p>
              ${attachments}
            </article>
          `;
        })
        .join("");
    };

    const updateReviewSummaryBadges = (stats = { total: 0, average: 0, positiveRate: 0 }) => {
      if (reviewAverageBadge) {
        reviewAverageBadge.textContent = stats.total
          ? formatRatingText(stats.average, stats.total)
          : "Chưa có đánh giá";
      }
      if (reviewCountBadge) {
        reviewCountBadge.textContent = stats.total
          ? `${formatNumber(stats.total)} lượt đánh giá`
          : "0 lượt đánh giá";
      }
      if (reviewPositiveBadge) {
        reviewPositiveBadge.textContent = stats.total
          ? `${formatPositiveRate(stats.positiveRate)} tích cực`
          : "Chưa có tỷ lệ tích cực";
      }
    };

    const refreshReviewSection = () => {
      if (!product || !product.id) return;
      const reviews = getReviewsForProduct(product.id);
      const stats = buildReviewStats(reviews);
      const effectiveStats = stats.total ? stats : getDefaultReviewStatsForProduct(product);
      const displayStats = mergeRemoteReviewStats(effectiveStats);
      renderReviewList(reviews);
      updateReviewSummaryBadges(displayStats);
      if (productRatingInfo) {
        productRatingInfo.textContent = formatRatingText(displayStats.average, displayStats.total);
      }
      if (productPositiveRateInfo) {
        const positiveLabel = formatPositiveRate(displayStats.positiveRate);
        productPositiveRateInfo.textContent = positiveLabel
          ? `${positiveLabel} đánh giá tích cực`
          : "Chưa có tỷ lệ";
      }
      if (productSoldInfo) {
        const soldValue =
          Number.isFinite(Number(remoteProductMetadata?.soldCount))
            ? Number(remoteProductMetadata.soldCount)
            : Number(product.soldCount);
        productSoldInfo.textContent = soldValue
          ? `${formatNumber(soldValue)} lượt bán`
          : "Chưa có số liệu";
      }
    };

    const readFileAsDataUrl = (file) =>
      new Promise((resolve) => {
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.addEventListener("load", () =>
          resolve({ name: file.name, data: reader.result, type: file.type })
        );
        reader.addEventListener("error", () => resolve(null));
        reader.readAsDataURL(file);
      });

    const resetProductInfo = () => {
      if (productInfoCard) productInfoCard.classList.add("hidden");
      if (productCodeInfo) productCodeInfo.textContent = "-";
      if (productCategoryInfo) productCategoryInfo.textContent = "Chưa phân loại";
      if (productSourceInfo) productSourceInfo.textContent = "-";
      if (productSizeInfo) productSizeInfo.textContent = "Chưa có size";
      if (productStockInfo) productStockInfo.textContent = "Chưa có dữ liệu";
      if (productRatingInfo) productRatingInfo.textContent = "Chưa có đánh giá";
      if (productPositiveRateInfo) productPositiveRateInfo.textContent = "Chưa có tỷ lệ";
      if (productSoldInfo) productSoldInfo.textContent = "Chưa có số liệu";
      if (productColorInfo) productColorInfo.textContent = "Chưa có màu";
      if (productSummaryCode) productSummaryCode.textContent = "-";
      if (productSummaryCategory) productSummaryCategory.textContent = "Chưa phân loại";
      if (productSummarySource) productSummarySource.textContent = "-";
      if (productSummarySize) productSummarySize.textContent = "Chưa có size";
      if (productSummaryStock) productSummaryStock.textContent = "Chưa có dữ liệu";
      if (productSourceLink) {
        productSourceLink.href = "#";
        productSourceLink.textContent = "Chưa có link";
        productSourceLink.classList.add("muted");
      }
    };

    const updateProductInfo = () => {
      if (!productInfoCard) return;
      productInfoCard.classList.remove("hidden");
      if (productCodeInfo) productCodeInfo.textContent = product.id || "-";
      if (productCategoryInfo) {
        const label = CATEGORY_LABELS[product.category] || product.category || "Chưa phân loại";
        productCategoryInfo.textContent = label;
      }
      if (productSourceInfo) productSourceInfo.textContent = sourceLabel(product.source);
      const sizes = getProductSizeList(product);
      if (productSizeInfo) {
        productSizeInfo.textContent = sizes.length ? sizes.join(", ") : "Chưa có size";
      }
      const stocks = getProductStockValues(product);
      const totalStock = stocks.reduce((sum, value) => sum + Number(value || 0), 0);
      if (productStockInfo) {
        productStockInfo.textContent = totalStock
          ? `${formatNumber(totalStock)} sản phẩm`
          : "Chưa có dữ liệu";
      }
      if (productRatingInfo) {
        productRatingInfo.textContent = formatRatingText(product.rating, product.ratingCount);
      }
      if (productPositiveRateInfo) {
        const positiveText = formatPositiveRate(product.positiveRate);
        productPositiveRateInfo.textContent = positiveText
          ? `${positiveText} đánh giá tích cực`
          : "Chưa có tỷ lệ";
      }
      if (productSoldInfo) {
        productSoldInfo.textContent = product.soldCount
          ? `${formatNumber(product.soldCount)} lượt bán`
          : "Chưa có số liệu";
      }
      if (productColorInfo) productColorInfo.textContent = product.defaultColor || "Chưa có màu";
      if (productSourceLink) {
        const sourceUrl = product.sourceUrl || product.link || "";
        if (sourceUrl) {
          productSourceLink.href = sourceUrl;
          productSourceLink.textContent = "Xem link gốc";
          productSourceLink.classList.remove("muted");
        } else {
          productSourceLink.href = "#";
          productSourceLink.textContent = "Chưa có link";
          productSourceLink.classList.add("muted");
        }
      }
    };

    if (!product || product.hidden || product.deletedAt || isProductIdDeleted(product.id)) {
      resetProductInfo();
      if (productMain) productMain.innerHTML = "";
      if (productThumbs) productThumbs.innerHTML = "";
      if (productTags) productTags.innerHTML = "";
      if (productName) productName.textContent = "Sản phẩm tạm ẩn";
      if (productDesc) {
        productDesc.textContent = product
          ? "Sản phẩm đang được ẩn khỏi cửa hàng."
          : "Không tìm thấy sản phẩm.";
      }
      if (productPrices) productPrices.innerHTML = "";
      if (productStock) productStock.textContent = "";
      if (sizeText) sizeText.innerHTML = "";
      if (sizeNum) sizeNum.innerHTML = "";
      if (addToCartBtn) addToCartBtn.disabled = true;
      if (buyNowBtn) buyNowBtn.disabled = true;
      if (sizeHint) sizeHint.textContent = "Không thể thao tác với sản phẩm này.";
      if (productWish) {
        productWish.disabled = true;
        productWish.textContent = "Đã ẩn";
      }
      if (relatedGrid) relatedGrid.innerHTML = "";
      if (stickyBuy) stickyBuy.classList.add("hidden");
      if (imageChoiceGrid) imageChoiceGrid.innerHTML = "";
      if (imageChoiceStatus) imageChoiceStatus.textContent = "Không có ảnh mẫu.";
      selectedImagePreference = null;
      return;
    }

    let selectedSize = "";
    let selectedImagePreference = null;
    addRecent(product.id);
    const palette = product.palette?.length ? product.palette : ["#2a2f45", "#374766", "#ffb347"];
    const baseImages = normalizeImageSources(getProductImages(product));
    const getVariantBaseValue = () => {
      const variant = getSelectedVariant();
      const fallback = Number(product.basePrice) || 0;
      const value = variant && Number.isFinite(Number(variant.price)) ? Number(variant.price) : fallback;
      return value || fallback;
    };
    const getDisplayedPriceDetail = () => {
      const baseValue = getVariantBaseValue();
      return {
        baseWithFee: applyProductFee(baseValue),
        converted: convertPrice(baseValue, settings),
      };
    };
    const updatePriceDisplay = () => {
      const { baseWithFee, converted } = getDisplayedPriceDetail();
      if (productPrices) {
        productPrices.innerHTML = `
          <strong>${formatCurrency(baseWithFee, settings.baseCurrency)}</strong>
          <span>JPY ${formatNumber(converted.jpy)}</span>
          <span>VND ${formatNumber(converted.vnd)}</span>
        `;
      }
      if (stickyBuyPrice) {
        stickyBuyPrice.textContent = `${formatCurrency(
          baseWithFee,
          settings.baseCurrency
        )} · JPY ${formatNumber(converted.jpy)}`;
      }
    };
    const updateStockDisplay = () => {
      if (!productStock) return;
      const variant = getSelectedVariant();
      const optionStock =
        variant && Number.isFinite(Number(variant.stock)) ? Number(variant.stock) : null;
      const fallbackStock = getProductStockValues(product).reduce(
        (sum, value) => sum + Number(value || 0),
        0
      );
      const totalStock = optionStock !== null ? optionStock : fallbackStock;
      const hasStock = totalStock > 0;
      productStock.textContent = hasStock ? "Còn hàng" : "Hết hàng";
      productStock.className = `status ${hasStock ? "green" : "red"}`;
    };
    const buildVariantImageSources = (variant) => {
      const sources = [];
      if (variant?.image) sources.push(variant.image);
      if (Array.isArray(variant?.images)) sources.push(...variant.images);
      return normalizeImageSources([...sources, ...baseImages]);
    };
    let availableImages = buildVariantImageSources(getSelectedVariant());
    let currentImageSrc = "";

    const showDefaultBackground = () => {
      if (!productMain) return;
      currentImageSrc = "";
      productMain.innerHTML = "";
      productMain.classList.remove("has-image", "is-loading");
      if (productImageSkeleton) productImageSkeleton.classList.add("hidden");
      productMain.style.background = `linear-gradient(140deg, ${palette.join(", ")})`;
    };

    const removeImageSource = (src) => {
      if (!src) return;
      const index = availableImages.indexOf(src);
      if (index >= 0) {
        availableImages.splice(index, 1);
      }
    };

    const renderProductImage = (src) => {
      const optimizedSrc = String(src || "").trim();
      if (!productMain) return;
      if (!optimizedSrc) {
        showDefaultBackground();
        return;
      }
      productMain.innerHTML = "";
      productMain.style.background = "none";
      productMain.classList.add("has-image", "is-loading");
      if (productImageSkeleton) productImageSkeleton.classList.remove("hidden");
      const img = document.createElement("img");
      img.src = optimizedSrc;
      img.alt = product.name;
      img.loading = "lazy";
      img.decoding = "async";
      const cleanup = () => {
        productMain.classList.remove("is-loading");
        if (productImageSkeleton) productImageSkeleton.classList.add("hidden");
      };
      const handleError = () => {
        cleanup();
        removeImageSource(optimizedSrc);
        if (availableImages.length) {
          renderProductImage(availableImages[0]);
        } else {
          showDefaultBackground();
        }
        renderThumbnailButtons();
      };
      img.addEventListener("load", cleanup);
      img.addEventListener("error", handleError);
      productMain.appendChild(img);
      currentImageSrc = optimizedSrc;
    };

    const describeImageChoiceLabel = (src, index = 0) => {
      const normalized = extractTextFromUrl(src);
      const colorHint = guessColorFromText(normalized);
      const fallbackIndex = index >= 0 ? index + 1 : 1;
      if (colorHint) return `Màu ${colorHint}`;
      return `Ảnh ${fallbackIndex}`;
    };

    const updateImageChoiceStatus = () => {
      if (!imageChoiceStatus) return;
      if (selectedImagePreference?.label) {
        imageChoiceStatus.textContent = `Đã chọn ảnh mẫu: ${selectedImagePreference.label}`;
      } else {
        imageChoiceStatus.textContent = "Chưa chọn ảnh mẫu.";
      }
    };

    const renderImageChoiceGrid = () => {
      if (!imageChoiceGrid) return;
      if (!availableImages.length) {
        imageChoiceGrid.innerHTML = '<p class="helper small">Không có ảnh mẫu để chọn.</p>';
        return;
      }
      imageChoiceGrid.innerHTML = availableImages
        .map((src, index) => {
          const label = describeImageChoiceLabel(src, index);
          const active = selectedImagePreference?.src === src ? " active" : "";
          const safeSrc = escapeHtml(src);
          const safeLabel = escapeHtml(label);
          return `
            <button class="image-choice-thumb${active}" type="button" data-image="${safeSrc}">
              <img src="${safeSrc}" alt="${safeLabel}" loading="lazy" />
              <span class="image-choice-caption">${safeLabel}</span>
            </button>
          `;
        })
        .join("");
    };

    const setImagePreferenceValue = (src) => {
      if (!src) {
        selectedImagePreference = null;
        updateImageChoiceStatus();
        return;
      }
      const index = availableImages.indexOf(src);
      const label = describeImageChoiceLabel(src, index >= 0 ? index : 0);
      selectedImagePreference = { src, label };
      updateImageChoiceStatus();
    };

    const renderThumbnailButtons = () => {
      if (!productThumbs) return;
      if (availableImages.length) {
        productThumbs.innerHTML = availableImages
          .map((src, index) => {
            const active = src === currentImageSrc ? " active" : "";
            const safeSrc = escapeHtml(src);
            return `<button class="thumb${active}" type="button" data-src="${safeSrc}" aria-label="Ảnh ${index + 1}">
              <img src="${safeSrc}" alt="" loading="lazy" />
            </button>`;
          })
          .join("");
        return;
      }
      productThumbs.innerHTML = palette
        .map((color) => `<div class="card" style="height:70px;background:${color};"></div>`)
        .join("");
    };

    const handleImageChoiceSelection = (src) => {
      if (!src) return;
      setImagePreferenceValue(src);
      renderProductImage(src);
      renderThumbnailButtons();
      renderImageChoiceGrid();
    };

    const handleThumbnailImageError = (event) => {
      const img = event.target;
      if (!img || img.tagName !== "IMG") return;
      const button = img.closest(".thumb");
      const src = button?.dataset?.src;
      if (!src) return;
      const wasCurrent = currentImageSrc === src;
      removeImageSource(src);
      if (!availableImages.length) {
        showDefaultBackground();
      } else if (wasCurrent) {
        renderProductImage(availableImages[0]);
      }
      renderThumbnailButtons();
    };

    if (productThumbs) {
      productThumbs.addEventListener("error", handleThumbnailImageError, true);
    }
    if (imageChoiceGrid) {
      imageChoiceGrid.addEventListener("click", (event) => {
        const button = event.target.closest("[data-image]");
        if (!button) return;
        const src = button.dataset.image;
        if (!src) return;
        handleImageChoiceSelection(src);
      });
    }
    const refreshVariantMedia = () => {
      availableImages = buildVariantImageSources(getSelectedVariant());
      if (availableImages.length) {
        const preferred =
          selectedImagePreference && availableImages.includes(selectedImagePreference.src)
            ? selectedImagePreference.src
            : availableImages[0];
        handleImageChoiceSelection(preferred);
      } else {
        showDefaultBackground();
        renderThumbnailButtons();
        selectedImagePreference = null;
        updateImageChoiceStatus();
        renderImageChoiceGrid();
      }
    };
    const syncVariantState = () => {
      refreshVariantMedia();
      updatePriceDisplay();
      updateStockDisplay();
    };

    const handleVariantSelection = (variantId) => {
      if (!variantId || !variantOptions.length) return;
      const option = variantOptions.find((entry) => entry.id === variantId);
      if (!option) return;
      if (!option.available) {
        setVariantFeedback("Biến thể hiện không khả dụng.", true);
        return;
      }
      selectedVariantId = variantId;
      setVariantFeedback("");
      renderVariantOptions();
      syncVariantState();
    };

    const handleVariantClick = (event) => {
      const button = event.target.closest("[data-variant-id]");
      if (!button || button.disabled) return;
      event.preventDefault();
      const variantId = button.dataset.variantId;
      if (!variantId) return;
      if (selectedVariantId === variantId) return;
      handleVariantSelection(variantId);
    };

    if (productVariantList) {
      productVariantList.addEventListener("click", handleVariantClick);
    }

    renderVariantOptions();
    if (variantOptions.length && !selectedVariantId) {
      setVariantFeedback(variantRequirementMessage());
    } else {
      setVariantFeedback("");
    }

    syncVariantState();
    const tagMarkup = (product.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join("");
    productTags.innerHTML = `
      <span class="badge">${sourceLabel(product.source)}</span>
      ${tagMarkup}
    `;
    if (productDefaults) {
      const defaultParts = [];
      if (product.defaultColor) defaultParts.push(`Màu mặc định: ${product.defaultColor}`);
      if (product.defaultSize) defaultParts.push(`Size mặc định: ${product.defaultSize}`);
      productDefaults.innerHTML = defaultParts
        .map((text) => `<span class="tag">${text}</span>`)
        .join("");
      productDefaults.classList.toggle("hidden", defaultParts.length === 0);
    }
    productName.textContent = product.name;
    productDesc.textContent = product.desc;

    if (productWish) {
      const wished = isWishlisted(product.id);
      productWish.textContent = wished ? "Đã lưu" : "Lưu";
      productWish.addEventListener("click", () => {
        const active = toggleWishlist(product.id);
        productWish.textContent = active ? "Đã lưu" : "Lưu";
        updateWishlistBadge();
        renderWishlistSections();
      });
    }

    if (stickyBuy) {
      stickyBuy.classList.remove("hidden");
      if (stickyBuySize) stickyBuySize.textContent = "Chưa chọn size";
      if (stickyAdd) stickyAdd.disabled = true;
      if (stickyBuyNow) stickyBuyNow.disabled = true;
    }

    updatePriceDisplay();

    sizeText.innerHTML = renderSizeButtons(product.sizesText, product.stock);
    sizeNum.innerHTML = renderSizeButtons(product.sizesNum, product.stock);
    addToCartBtn.disabled = true;
    buyNowBtn.disabled = true;

    const activateSize = (size) => {
      if (!size) return false;
      const allSizeButtons = [
        ...document.querySelectorAll("#sizeText button[data-size]"),
        ...document.querySelectorAll("#sizeNum button[data-size]"),
      ];
      allSizeButtons.forEach((el) => el.classList.remove("active"));
      const target =
        document.querySelector(`#sizeText button[data-size="${size}"]`) ||
        document.querySelector(`#sizeNum button[data-size="${size}"]`);
      if (!target || target.disabled) return false;
      target.classList.add("active");
      selectedSize = size;
      sizeHint.textContent = `Đã chọn size: ${selectedSize}`;
      addToCartBtn.disabled = false;
      buyNowBtn.disabled = false;
      if (stickyBuySize) stickyBuySize.textContent = `Size ${selectedSize}`;
      if (stickyAdd) stickyAdd.disabled = false;
      if (stickyBuyNow) stickyBuyNow.disabled = false;
      return true;
    };

    const handleSizeClick = (event) => {
      const btn = event.target.closest("button[data-size]");
      if (!btn || btn.disabled) return;
      activateSize(btn.dataset.size);
    };

    sizeText.addEventListener("click", handleSizeClick);
    sizeNum.addEventListener("click", handleSizeClick);

    const fallbackSizes = [
      ...(product.sizesText || []),
      ...(product.sizesNum || []),
    ].filter(Boolean);
    const desiredSize = product.defaultSize || fallbackSizes[0];
    if (desiredSize) {
      activateSize(desiredSize);
    }

    productThumbs.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-src]");
      if (!btn) return;
      const src = btn.dataset.src;
      if (!src) return;
      handleImageChoiceSelection(src);
    });

    const handleReviewSubmit = async (event) => {
      event.preventDefault();
      if (!product || !product.id) {
        setReviewFeedback("Không thể gửi đánh giá cho sản phẩm này.", true);
        return;
      }
      const comment = (reviewTextInput?.value || "").trim();
      if (!comment) {
        setReviewFeedback("Vui lòng nhập nhận xét trước khi gửi.", true);
        return;
      }
      const ratingValue = Number(reviewRatingInput?.value) || 5;
      const files = reviewAttachmentsInput?.files ? Array.from(reviewAttachmentsInput.files) : [];
      if (files.length > REVIEW_ATTACHMENT_LIMIT) {
        setReviewFeedback(`Chỉ được gửi tối đa ${REVIEW_ATTACHMENT_LIMIT} tệp.`, true);
      }
      const attachments = [];
      for (const file of files.slice(0, REVIEW_ATTACHMENT_LIMIT)) {
        const loaded = await readFileAsDataUrl(file);
        if (!loaded?.data) continue;
        const kind = (file.type || "").startsWith("video/") ? "video" : "image";
        attachments.push({
          name: loaded.name || file.name || "Đính kèm",
          type: kind,
          data: loaded.data,
        });
      }
      const newReview = {
        id: `review-${product.id}-${Date.now()}`,
        name: (reviewNameInput?.value || "").trim() || "Khách hàng",
        rating: Math.max(1, Math.min(5, Math.round(ratingValue))),
        text: comment,
        attachments,
        createdAt: Date.now(),
      };
      addReviewForProduct(product.id, newReview);
      refreshReviewSection();
      setReviewFeedback("Đánh giá đã gửi. Cảm ơn!", false);
      if (reviewForm) reviewForm.reset();
      setSelectedRating(5);
      if (reviewAttachmentsInput) reviewAttachmentsInput.value = "";
      clearAttachmentPreview();
    };

    const handleTaobaoSubmit = (event) => {
      event.preventDefault();
      const linkValue = (taobaoLinkInput?.value || "").trim();
      if (!linkValue) {
        setTaobaoFeedback("Vui lòng cung cấp link Taobao để admin đối chiếu.", true);
        if (taobaoLinkInput) taobaoLinkInput.focus();
        return;
      }
      resetTaobaoInputs();
      setTaobaoFeedback("Link đã được chuyển tới admin. Chúng tôi sẽ phản hồi trong 24h.", false);
    };

    if (reviewStarButtons.length) {
      reviewStarButtons.forEach((button) => {
        button.addEventListener("click", () =>
          setSelectedRating(button.dataset.ratingStar, { preview: true })
        );
        button.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            button.click();
          }
        });
      });
    }
    setSelectedRating(reviewRatingInput?.value || "5");

    if (reviewAttachmentsInput) {
      reviewAttachmentsInput.addEventListener("change", (event) => {
        const files = event.target.files || [];
        if (files.length > REVIEW_ATTACHMENT_LIMIT) {
          setReviewFeedback(`Chỉ được gửi tối đa ${REVIEW_ATTACHMENT_LIMIT} tệp.`, true);
        } else {
          setReviewFeedback("");
        }
        updateAttachmentPreview(files);
      });
    }

    if (reviewForm) {
      reviewForm.addEventListener("submit", handleReviewSubmit);
    }

    if (taobaoFilesInput) {
      taobaoFilesInput.addEventListener("change", (event) => {
        const files = event.target.files || [];
        if (files.length > TAOBAO_ATTACHMENT_LIMIT) {
          setTaobaoFeedback(`Chỉ được gửi tối đa ${TAOBAO_ATTACHMENT_LIMIT} ảnh.`, true);
        } else {
          setTaobaoFeedback("");
        }
        updateTaobaoPreview(files);
      });
    }

    if (taobaoLinkInput) {
      taobaoLinkInput.addEventListener("input", () => {
        if (taobaoFormFeedback?.classList.contains("danger")) {
          setTaobaoFeedback("");
        }
      });
    }

    if (taobaoLinkReset) {
      taobaoLinkReset.addEventListener("click", () => {
        resetTaobaoInputs();
        setTaobaoFeedback("");
      });
    }

    if (taobaoLinkForm) {
      taobaoLinkForm.addEventListener("submit", handleTaobaoSubmit);
    }

    const ensureVariantSelection = () => {
      if (!variantOptions.length) return true;
      if (!selectedVariantId) {
        const requirement = variantRequirementContext();
        setVariantFeedback(requirement.markup, true);
        showNotificationWithLink(
          requirement.message,
          requirement.href,
          requirement.label,
          "info",
          4200
        );
        return false;
      }
      const active = getSelectedVariant();
      if (!active || !active.available) {
        setVariantFeedback("Biến thể hiện không khả dụng.", true);
        return false;
      }
      setVariantFeedback("");
      return true;
    };

    const addToCart = () => {
      if (!ensureVariantSelection()) return false;
      if (!selectedSize) return false;
      const cart = getCart();
      const activeVariant = getSelectedVariant();
      const variantId = activeVariant?.id || "";
      const variantLabel = activeVariant?.name || "";
      const variantColor = activeVariant?.color || product.defaultColor || "";
      const normalizedColor = variantColor || "";
      const currentImagePreference = selectedImagePreference?.src || "";
      const imagePreferencePayload = selectedImagePreference
        ? { ...selectedImagePreference }
        : null;
      const existing = cart.find((item) => {
        const entryColor = item.color || product?.defaultColor || "";
        const entryImage = item.imagePreference?.src || "";
        return (
          item.id === product.id &&
          item.size === selectedSize &&
          (item.variantId || "") === variantId &&
          entryColor === normalizedColor &&
          entryImage === currentImagePreference
        );
      });
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({
          id: product.id,
          size: selectedSize,
          qty: 1,
          source: product.source,
          color: normalizedColor,
          variantId,
          variantLabel,
          variantPrice: activeVariant?.price,
          imagePreference: imagePreferencePayload,
        });
      }
      setCart(cart);
      updateCartBadge();
      if (productMain) {
        const sourceNode = productMain.querySelector("img") || productMain;
        animateAddToCart(sourceNode);
      }
      return true;
    };

    const handleAdd = () => {
      if (!addToCart()) {
        if (!selectedSize) {
          sizeHint.textContent = "Vui lòng chọn size trước khi thêm giỏ.";
        }
      }
    };
    const handleBuy = () => {
      if (addToCart()) window.location.href = "cart.html";
      else if (!selectedSize) {
        sizeHint.textContent = "Vui lòng chọn size trước khi mua ngay.";
      }
    };

    addToCartBtn.addEventListener("click", handleAdd);
    buyNowBtn.addEventListener("click", handleBuy);
    if (stickyAdd) stickyAdd.addEventListener("click", handleAdd);
    if (stickyBuyNow) stickyBuyNow.addEventListener("click", handleBuy);

    updateProductInfo();
    syncVariantState();
    updateProductSummary();
    updateProductDescription();
    refreshReviewSection();
    importProductDataFromLink();
    if (relatedGrid) {
      const related = getVisibleProducts()
        .filter((item) => item.id !== product.id && item.category === product.category)
        .slice(0, 4);
      renderProductGrid(related, relatedGrid, "compact");
    }
  };

  const initCart = () => {
    const cartList = document.getElementById("cartList");
    const subtotalBase = document.getElementById("cartSubtotalBase");
    const subtotalJPY = document.getElementById("cartSubtotalJPY");
    const subtotalVND = document.getElementById("cartSubtotalVND");
    const stickyBar = document.getElementById("cartSticky");
    const stickyBase = document.getElementById("cartStickyBase");
    const stickyJPY = document.getElementById("cartStickyJPY");
    const stickyVND = document.getElementById("cartStickyVND");

    const renderCart = () => {
      const cart = getCart();
      const products = getProducts();
      const settings = getSettings();
      console.log("Current Cart:", cart);
      if (!cart.length) {
        cartList.innerHTML = "<div class=\"card\">Giỏ hàng trống.</div>";
        subtotalBase.textContent = formatCurrency(0, settings.baseCurrency);
        subtotalJPY.textContent = "0";
        subtotalVND.textContent = "0";
        if (stickyBar) stickyBar.classList.add("hidden");
        updateCartBadge();
        return;
      }
      cartList.innerHTML = cart
        .map((item) => {
          const product = products.find((entry) => entry.id === item.id);
          if (!product) return "";
          const price = convertPrice(product.basePrice, settings);
          const baseWithFee = applyProductFee(product.basePrice);
          const images = getProductImages(product);
          const thumb = images[0];
          const fallbackLabel = (product.name || "SP").slice(0, 2).toUpperCase();
          const thumbMarkup = thumb
            ? `<img src="${thumb}" alt="${product.name}" loading="lazy" />`
            : `<span class="cart-thumb-fallback">${fallbackLabel}</span>`;
          const colorLabel = item.color || product?.defaultColor || "";
          const preferenceLabel = item.imagePreference?.label || "";
          const preferenceSrc = item.imagePreference?.src || "";
          return `
            <div class="card cart-item">
              <div class="cart-thumb">${thumbMarkup}</div>
              <div class="cart-info">
                <div class="segment">
                  <strong>${product.name}</strong>
                  <span class="tag">Size ${item.size}</span>
                  ${colorLabel ? `<span class="tag">Màu ${colorLabel}</span>` : ""}
                  ${preferenceLabel ? `<span class="tag">Ảnh: ${escapeHtml(preferenceLabel)}</span>` : ""}
                  <span class="tag">${sourceLabel(item.source)}</span>
                </div>
                <div class="price">
                  <span>${formatCurrency(baseWithFee, settings.baseCurrency)}</span>
                  <span>JPY ${formatNumber(price.jpy)}</span>
                  <span>VND ${formatNumber(price.vnd)}</span>
                </div>
                <div class="segment">
                  <button class="btn ghost small" data-action="dec" data-id="${item.id}" data-size="${item.size}" data-color="${colorLabel}" data-image="${escapeHtml(preferenceSrc)}">-</button>
                  <span>${item.qty}</span>
                  <button class="btn ghost small" data-action="inc" data-id="${item.id}" data-size="${item.size}" data-color="${colorLabel}" data-image="${escapeHtml(preferenceSrc)}">+</button>
                  <button class="btn ghost small" data-action="remove" data-id="${item.id}" data-size="${item.size}" data-color="${colorLabel}" data-image="${escapeHtml(preferenceSrc)}">Xoá</button>
                </div>
              </div>
            </div>
          `;
        })
        .join("");
      const totals = computeCartTotals(cart, settings, products);
      subtotalBase.textContent = formatCurrency(totals.subtotalBase, settings.baseCurrency);
      subtotalJPY.textContent = formatNumber(totals.subtotalJPY);
      subtotalVND.textContent = formatNumber(totals.subtotalVND);
      if (stickyBar) {
        stickyBar.classList.remove("hidden");
        if (stickyBase) {
          stickyBase.textContent = `Tạm tính: ${formatCurrency(
            totals.subtotalBase,
            settings.baseCurrency
          )}`;
        }
        if (stickyJPY) stickyJPY.textContent = `JPY: ${formatNumber(totals.subtotalJPY)}`;
        if (stickyVND) stickyVND.textContent = `VND: ${formatNumber(totals.subtotalVND)}`;
      }
      updateCartBadge();
    };

    cartList.addEventListener("click", (event) => {
      const action = event.target.dataset.action;
      if (!action) return;
      const id = event.target.dataset.id;
      const size = event.target.dataset.size;
      const color = event.target.dataset.color || "";
      const imageSrc = event.target.dataset.image || "";
      const cart = getCart();
      const products = getProducts();
      const item = cart.find((entry) => {
        const product = products.find((prod) => prod.id === entry.id);
        const entryColor = entry.color || product?.defaultColor || "";
        const entryImage = entry.imagePreference?.src || "";
        return (
          entry.id === id &&
          entry.size === size &&
          entryColor === color &&
          entryImage === imageSrc
        );
      });
      if (!item) return;
      if (action === "inc") item.qty += 1;
      if (action === "dec") item.qty = Math.max(1, item.qty - 1);
      if (action === "remove") {
        const nextCart = cart.filter((entry) => entry !== item);
        setCart(nextCart);
        renderCart();
        return;
      }
      setCart(cart);
      renderCart();
    });

    renderCart();
  };

  const normalizeItemKey = (item) => {
    const color = (item.color || "").trim();
    const size = (item.size || "").trim();
    const imageKey = (item.imagePreference?.src || "").trim();
    return `${item.id || "unknown"}|${size}|${color}|${imageKey}`;
  };

  const mergeOrderItems = (existingItems = [], incomingItems = []) => {
    const merged = new Map();
    existingItems.forEach((entry) => {
      const key = normalizeItemKey(entry);
      merged.set(key, { ...entry });
    });
    incomingItems.forEach((entry) => {
      const key = normalizeItemKey(entry);
      if (merged.has(key)) {
        const existing = merged.get(key);
        existing.qty = (existing.qty || 0) + (entry.qty || 0);
        merged.set(key, existing);
      } else {
        merged.set(key, { ...entry });
      }
    });
    return Array.from(merged.values());
  };

  const findPendingOrderIndexForCustomer = (ordersList, customerCode) => {
    for (let i = ordersList.length - 1; i >= 0; i -= 1) {
      const candidate = ordersList[i];
      if (candidate.customerCode !== customerCode) continue;
      if (candidate.status === STATUS.CANCELLED) continue;
      if (candidate.paymentStatus === PAYMENT_STATUS.CONFIRMED) continue;
      return i;
    }
    return -1;
  };

  const mergePendingOrderForCustomer = (ordersList, customerCode, payload, items) => {
    if (!customerCode) return null;
    const targetIndex = findPendingOrderIndexForCustomer(ordersList, customerCode);
    if (targetIndex < 0) return null;
    const targetOrder = ordersList[targetIndex];
    if (!items.length) return null;
    targetOrder.items = mergeOrderItems(targetOrder.items || [], items);
    targetOrder.customer = { ...targetOrder.customer, ...payload };
    targetOrder.shipping = {
      address: payload.address || targetOrder.shipping?.address || "",
      fb: payload.fb || targetOrder.shipping?.fb || "",
    };
    targetOrder.status = STATUS.PENDING_QUOTE;
    targetOrder.paymentStatus = PAYMENT_STATUS.NOT_PAID;
    targetOrder.shipFee = 0;
    targetOrder.paymentExpiresAt = null;
    targetOrder.billSubmitted = false;
    targetOrder.billPreview = "";
    targetOrder.updatedAt = Date.now();
    const addedQty = items.reduce((sum, entry) => sum + Number(entry.qty || 0), 0);
    pushTimeline(targetOrder, {
      status: targetOrder.status,
      paymentStatus: targetOrder.paymentStatus,
      actor: "customer",
      message: `Gộp thêm ${addedQty} sản phẩm, chờ báo giá và thanh toán tổng.`,
    });
    return { order: targetOrder, addedQty };
  };

  const initCheckout = () => {
    const form = document.getElementById("checkoutForm");
    const guidance = document.getElementById("checkoutGuidance");
    const formAlert = document.getElementById("checkoutFormAlert");

    const renderGuidance = () => {
      if (!guidance) return;
      guidance.innerHTML = `
        <div class="guidance-card">
          <h4>Đơn đặt hàng chuyên nghiệp</h4>
          <p>Chúng tôi chỉ cần tên, số điện thoại, địa chỉ và link Facebook.</p>
          <p class="helper small">
            Những dữ liệu này được ghi nhận tức thì để đội ngũ Order gọi/viber Messenger
            xác nhận và lên lịch xử lý trong vài phút.
          </p>
        </div>
        <div class="guidance-card">
          <h4>Admin phản hồi chủ động</h4>
          <ul>
            <li>Đọc đơn, kiểm tra link sản phẩm và chuẩn bị báo phí ship.</li>
            <li>Nếu cần bổ sung, admin sẽ nhắn trực tiếp qua Facebook Messenger.</li>
            <li>Sau khi xác nhận, bạn nhận tin nhắn và tiến hành thanh toán.</li>
          </ul>
        </div>
      `;
    };

    const setFormAlert = (message, isError = false) => {
      if (!formAlert) return;
      formAlert.textContent = message;
      formAlert.classList.toggle("alert", isError && Boolean(message));
    };

    renderGuidance();
    setFormAlert("");
    fillCheckoutFormWithProfile();

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const cart = getCart();
      if (!cart.length) {
        setFormAlert("Giỏ hàng trống, chưa thể tạo đơn.", true);
        return;
      }
      setFormAlert("");
      const products = getProducts();
      const payload = {
        name: document.getElementById("customerName").value.trim(),
        phone: document.getElementById("customerPhone").value.trim(),
        address: document.getElementById("customerAddress").value.trim(),
        fb: document.getElementById("customerFb").value.trim(),
      };
      const customerCode = upsertCustomer(payload);
      const items = cart.map((item) => {
        const product = products.find((entry) => entry.id === item.id);
        const images = product ? getProductImages(product) : [];
        const basePrice = product?.basePrice ?? item.basePrice ?? 0;
        const color = item.color || product?.defaultColor || "";
        return {
          id: item.id,
          name: product?.name || item.name || "Sản phẩm",
          size: item.size,
          color,
          qty: item.qty,
          source: item.source || product?.source || "web",
          basePrice,
          image: images[0] || product?.image || "",
          images,
          productUrl: product?.sourceUrl || product?.link || "",
          imagePreference: item.imagePreference,
        };
      });
      const ordersList = getOrders();
      const mergeResult = mergePendingOrderForCustomer(ordersList, customerCode, payload, items);
      let orderToPersist;
      let toastMessage;
      if (mergeResult) {
        orderToPersist = mergeResult.order;
        toastMessage = `Đơn hàng cũ đã gộp thêm ${mergeResult.addedQty} sản phẩm, chờ báo giá tổng.`;
      } else {
        const order = {
          code: generateOrderCode(),
          customerCode,
          customer: payload,
          status: STATUS.PENDING_QUOTE,
          paymentStatus: PAYMENT_STATUS.NOT_PAID,
          paymentCode: "",
          paymentExpiresAt: null,
          shipFee: 0,
          shipCurrency: "JPY",
          items,
          shipping: {
            address: payload.address || "",
            fb: payload.fb || "",
          },
          billSubmitted: false,
          note: "",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          eta: "",
          tracking: "",
        };
        order.paymentCode = order.code;
        pushTimeline(order, {
          status: order.status,
          paymentStatus: order.paymentStatus,
          actor: "customer",
          message: "Đơn hàng đã được tạo và đang chờ báo giá.",
        });
        ordersList.push(order);
        orderToPersist = order;
        toastMessage = "Đơn hàng gửi thành công. Chuyển sang phần thanh toán...";
      }
      setOrders(ordersList);
      setCart([]);
      updateCartBadge();
      form.reset();
      fillCheckoutFormWithProfile();
      persistOrderToBackend(orderToPersist);
      showNotification(toastMessage, "success");
      setTimeout(() => redirectToPaymentPage(orderToPersist.code), 1200);
    });
  };

  const renderPaymentResult = (order) => {
    const settings = getSettings();
    const products = getProducts();
    const totals = computeTotals(order, settings, products);
    const itemsMarkup = renderOrderItems(order, products);
    const timelineMarkup = renderTimeline(order);
    const hasShipping = typeof order.shipFee === "number" && !Number.isNaN(order.shipFee) && order.shipFee > 0;
    const gateOpen = hasShipping && Boolean(settings.paymentGateOpen);
    const eligibleForPayment = canPayOrder(order, settings);
    const memoText = order.paymentCode || order.code || "Đơn hàng";
    const gateLabel = hasShipping ? (gateOpen ? "Cổng thanh toán mở" : "Cổng tạm đóng") : "Chờ báo phí ship";
    const gateClass = gateOpen ? "green" : "orange";
    const gateHint = hasShipping
      ? gateOpen
        ? "Admin đã xác nhận phí ship và mở cổng chuyển khoản."
        : "Cổng thanh toán đang đóng, đợi admin bật cổng."
      : "Chưa có phí ship, admin sẽ cập nhật và gửi bill.";
    const shippingDetail = hasShipping
      ? `JPY ${formatNumber(totals.shipJPY)} · VND ${formatNumber(totals.shipVND)}`
      : "Chưa có phí ship";
    let actionLabel = "Thanh toán đơn này";
    if (order.paymentStatus === PAYMENT_STATUS.BILL_SUBMITTED) {
      actionLabel = "Đã chuyển khoản – chờ xác nhận";
    } else if (order.paymentStatus === PAYMENT_STATUS.CONFIRMED) {
      actionLabel = "Đã xác nhận";
    } else if (!gateOpen) {
      actionLabel = "Chờ admin xác nhận phí ship";
    }
    const actionHint =
      order.paymentStatus === PAYMENT_STATUS.BILL_SUBMITTED
        ? "Bill đã được gửi, hệ thống đang chờ xác nhận từ admin."
        : eligibleForPayment
        ? "Sau khi gửi bill, đơn chuyển sang trạng thái chờ xác nhận."
        : gateHint;
    return `
      <div class="card payment-basic-info">
        <div class="segment">
          <div>
            <p class="helper">Mã đơn</p>
            <strong>${escapeHtml(order.code)}</strong>
            <span class="helper small">${formatDateTime(order.createdAt)}</span>
          </div>
          <span class="status ${gateClass}">${gateLabel}</span>
        </div>
        <div class="segment compact">
          <p><strong>Tổng cần trả:</strong> JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(
            totals.totalVND
          )}</p>
          <p class="helper small">Phí ship: ${shippingDetail}</p>
        </div>
        <div class="segment compact">
          <p><strong>Trạng thái:</strong> ${escapeHtml(formatOrderStatus(order.status))}</p>
          <p class="helper small">Thanh toán: ${escapeHtml(formatPaymentStatus(order.paymentStatus))}</p>
        </div>
      </div>
      <div class="card gate-card">
        <div class="gate-status">
          <span class="status ${gateClass}">${gateLabel}</span>
          <p class="helper">${gateHint}</p>
        </div>
      </div>
      <div class="card">
        <h4>Sản phẩm</h4>
        ${itemsMarkup}
      </div>
      <div class="card">
        <h4>Tiến trình đơn hàng</h4>
        <div class="timeline">${timelineMarkup}</div>
      </div>
      ${renderPaymentTimeline(order)}
      <div class="card soft">
        <div class="segment">
          <div>
            <p class="helper">Nội dung chuyển khoản</p>
            <strong>${escapeHtml(memoText)}</strong>
          </div>
          <button class="btn ghost small" data-action="order-copy" type="button">Copy nội dung</button>
        </div>
        <p class="helper small">Nội dung cố định để đối soát và thanh toán riêng từng đơn.</p>
      </div>
      <div class="card soft">
        <h4>Thông tin chuyển khoản</h4>
        <p>${escapeHtml(settings.bankJP)}</p>
        <p>${escapeHtml(settings.bankVN)}</p>
      </div>
      <div class="card payment-action-card">
        <div class="field">
          <label for="billUpload">Upload bill chuyển khoản (jpg/png/pdf ≤ 5MB)</label>
          <input id="billUpload" type="file" accept=".jpg,.jpeg,.png,.pdf" ${eligibleForPayment ? "" : "disabled"} />
        </div>
        <button class="btn primary" id="submitBill" type="button" ${eligibleForPayment ? "" : "disabled"}>
          ${actionLabel}
        </button>
        <p class="helper small">${actionHint}</p>
      </div>
    `;
  };

  const initPayment = () => {
    const activity = document.getElementById("paymentActivity");
    const modal = document.getElementById("paymentDetailModal");
    const modalContent = document.getElementById("paymentDetailContent");
    const modalClose = document.getElementById("paymentDetailClose");
    const highlightOrderCode = new URLSearchParams(window.location.search).get("order");

    const aggregateSelection = new Set();
    let currentStatusData = null;
    let currentSettings = null;
    let currentProducts = null;
    let currentPaymentRuns = [];
    let activeStatus = "pending";
    let setActiveStatus = null;
    let aggregateSession = null;

    const resetAggregateContext = () => {
      aggregateSession = null;
      if (!modal) return;
      modal.dataset.aggregateOrders = "";
      modal.dataset.aggregateMemo = "";
      modal.dataset.aggregateStep = "";
      modal.dataset.activePaymentRun = "";
      modal.dataset.paymentRunMemo = "";
    };

    const updatePaymentHeroStats = (statusData, settings) => {
      const pendingCountEl = document.querySelector("[data-payment-hero-pending-count]");
      const pendingTotalEl = document.querySelector("[data-payment-hero-pending-total]");
      const gateStateEl = document.querySelector("[data-payment-hero-gate-state]");
      const gateMetaEl = document.querySelector("[data-payment-hero-gate-meta]");
    const pendingBucket = statusData?.buckets?.pending || [];
    const shippingBucket = statusData?.buckets?.shipping || [];
    const paidBucket = statusData?.buckets?.paid || [];
    const pendingTotals = statusData?.totals?.pending || { totalJPY: 0, totalVND: 0 };
      const countText = `${formatNumber(pendingBucket.length)} đơn`;
      if (pendingCountEl) pendingCountEl.textContent = countText;
      if (pendingTotalEl) {
        pendingTotalEl.textContent = `JPY ${formatNumber(pendingTotals.totalJPY)} · VND ${formatNumber(
          pendingTotals.totalVND
        )}`;
      }
      const gateOpen = Boolean(settings?.paymentGateOpen);
      if (gateStateEl) {
        gateStateEl.textContent = gateOpen ? "Đang mở" : "Đang đóng";
        gateStateEl.dataset.gateState = gateOpen ? "open" : "closed";
      }
    if (gateMetaEl) {
      const statusHint = gateOpen
        ? "Admin đã bật cổng, khách có thể chuyển khoản"
        : "Đợi admin mở cổng thanh toán";
      const lastSyncMessage = settings?.lastSync
        ? ` · Cập nhật ${formatDateTime(settings.lastSync)}`
        : "";
      gateMetaEl.textContent = `${statusHint}${lastSyncMessage}`;
    }
    const shippingCountEl = document.querySelector("[data-payment-hero-shipping-count]");
    const paidCountEl = document.querySelector("[data-payment-hero-paid-count]");
    if (shippingCountEl) shippingCountEl.textContent = formatNumber(shippingBucket.length);
    if (paidCountEl) paidCountEl.textContent = formatNumber(paidBucket.length);
  };

    const generateBillPreview = (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const maxSize = 480;
            const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * ratio);
            canvas.height = Math.round(img.height * ratio);
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          };
          img.onerror = () => resolve("");
          img.src = reader.result;
        };
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      });

    const setAggregateStep = (step) => {
      if (!aggregateSession || !modalContent) return;
      aggregateSession.step = step;
      const settings = currentSettings || getSettings();
      const products = currentProducts || getProducts();
      if (modal) modal.dataset.aggregateStep = String(step);
      modalContent.innerHTML = renderAggregateModalStep(aggregateSession, settings, products);
    };

    const openOrderDetail = (order) => {
      if (!modal || !modalContent || !order) return;
      resetAggregateContext();
      modalContent.innerHTML = renderPaymentResult(order);
      modal.dataset.activeOrder = order.code;
      modal.dataset.orderMemo = order.paymentCode || order.code || "";
      modal.classList.remove("hidden");
      copyCustomerCodeToClipboard();
    };

    const closeOrderDetail = () => {
      if (!modal) return;
      modal.classList.add("hidden");
      modal.dataset.activeOrder = "";
      modal.dataset.orderMemo = "";
      resetAggregateContext();
    };

    const getPendingReadyMap = () => {
      const readyOrders = currentStatusData?.metadata.pending.actionableOrders || [];
      return new Map(readyOrders.map((order) => [order.code, order]));
    };

    const getSelectedOrders = () => {
      const map = getPendingReadyMap();
      return Array.from(aggregateSelection)
        .map((code) => map.get(code))
        .filter(Boolean);
    };

    const updateAggregateSticky = () => {
      const detail = activity?.querySelector("[data-status-detail]");
      if (!detail) return;
      const sticky = detail.querySelector("[data-aggregate-sticky]");
      const aggregatedAvailable = Boolean(currentStatusData?.metadata.pending.hasAggregateAction);
      if (!sticky || activeStatus !== "pending" || !aggregatedAvailable) {
        aggregateSelection.clear();
        sticky?.classList.add("hidden");
        return;
      }
      const pendingMap = getPendingReadyMap();
      const staleCodes = [];
      aggregateSelection.forEach((code) => {
        if (!pendingMap.has(code)) {
          staleCodes.push(code);
        }
      });
      staleCodes.forEach((code) => aggregateSelection.delete(code));
      const selectedOrders = getSelectedOrders();
      const stickyButton = sticky.querySelector("[data-action=\"aggregate-pay\"]");
      const headerButton = detail.querySelector(".status-detail-aggregate-btn");
      const countEl = sticky.querySelector("[data-aggregate-count]");
      const totalJpyEl = sticky.querySelector("[data-aggregate-total-jpy]");
      const totalVndEl = sticky.querySelector("[data-aggregate-total-vnd]");
      const hasEnough = selectedOrders.length >= 2;
      if (!hasEnough) {
        sticky.classList.add("hidden");
        stickyButton?.setAttribute("disabled", "disabled");
        countEl && (countEl.textContent = `${selectedOrders.length}`);
        totalJpyEl && (totalJpyEl.textContent = formatNumber(0));
        totalVndEl && (totalVndEl.textContent = formatNumber(0));
      } else {
        const summary = buildAggregateSummary(selectedOrders, currentSettings, currentProducts);
        sticky.classList.remove("hidden");
        stickyButton?.removeAttribute("disabled");
        countEl && (countEl.textContent = `${selectedOrders.length}`);
        totalJpyEl && (totalJpyEl.textContent = formatNumber(summary.totalJPY));
        totalVndEl && (totalVndEl.textContent = formatNumber(summary.totalVND));
      }
      if (headerButton) {
        hasEnough ? headerButton.removeAttribute("disabled") : headerButton.setAttribute("disabled", "disabled");
      }
      detail
        .querySelectorAll("[data-aggregate-checkbox]")
        .forEach((checkbox) => (checkbox.checked = aggregateSelection.has(checkbox.dataset.orderCode)));
    };

    const openAggregateDetail = (orders) => {
      if (!modal || !modalContent || !orders.length) return;
      const selectedOrders = orders.filter(Boolean);
      if (selectedOrders.length < 2) {
        showNotification("Chọn ít nhất 2 đơn để thanh toán gộp.", "info");
        return;
      }
      resetAggregateContext();
      const settings = currentSettings || getSettings();
      const products = currentProducts || getProducts();
      const summary = buildAggregateSummary(selectedOrders, settings, products);
      aggregateSession = { orders: selectedOrders, summary, step: 1 };
      modal.dataset.aggregateOrders = summary.codes.join("|");
      modal.dataset.aggregateMemo = summary.memo;
      modal.dataset.activeOrder = "AGGREGATE";
      setAggregateStep(1);
      modal.classList.remove("hidden");
      copyCustomerCodeToClipboard();
    };

    const openPaymentRunDetail = (run) => {
      if (!modal || !modalContent || !run) return;
      resetAggregateContext();
      const settings = currentSettings || getSettings();
      const products = currentProducts || getProducts();
      modalContent.innerHTML = renderPaymentRunDetail(run, settings, products);
      modal.dataset.activePaymentRun = run.paymentId;
      modal.dataset.paymentRunMemo = run.memo || run.paymentId;
      modal.classList.remove("hidden");
    };

    const renderActivity = () => {
      if (!activity) return;
      currentSettings = getSettings();
      currentProducts = getProducts();
      const orders = getCustomerOrders();
      currentStatusData = buildPaymentStatusData(orders, currentSettings, currentProducts);
      currentPaymentRuns = buildPaymentRuns(orders, currentSettings, currentProducts);
      aggregateSelection.clear();
      updatePaymentHeroStats(currentStatusData, currentSettings);
      activity.innerHTML = `
        ${renderPaymentSummary(currentStatusData, currentSettings, currentProducts)}
        ${renderPaymentHistory(orders, currentSettings, currentProducts)}
      `;
      setActiveStatus = bindStatusSummary(
        currentStatusData,
        currentSettings,
        currentProducts,
        { openOrderDetail, openAggregateDetail },
        activeStatus
      );
      updateAggregateSticky();
    };

    const findOrderByCode = (code) => {
      const orders = getOrders();
      return orders.find((entry) => entry.paymentCode === code || entry.code === code);
    };

    const handleActivityClick = (event) => {
      const statusCard = event.target.closest("[data-status-key]");
      if (statusCard) {
        const key = statusCard.dataset.statusKey;
        if (!key || !setActiveStatus) return;
        activeStatus = key;
        setActiveStatus(key, { scroll: true });
        updateAggregateSticky();
        return;
      }
      const actionEl = event.target.closest("[data-action]");
      if (actionEl) {
        const action = actionEl.dataset.action;
        if (action === "aggregate-pay") {
          const selectedOrders = getSelectedOrders();
          if (selectedOrders.length < 2) {
            showNotification("Chọn ít nhất 2 đơn để thanh toán gộp.", "info");
            return;
          }
          openAggregateDetail(selectedOrders);
          return;
        }
        if (action === "run-detail") {
          const paymentId = actionEl.dataset.paymentId;
          if (!paymentId) return;
          const run = currentPaymentRuns.find((entry) => entry.paymentId === paymentId);
          if (run) openPaymentRunDetail(run);
          return;
        }
        if (action === "detail") {
          const code = actionEl.dataset.orderCode;
          if (!code) return;
          const order = findOrderByCode(code);
          if (order) openOrderDetail(order);
          return;
        }
      }
      const orderCard = event.target.closest("[data-order-code]");
      if (orderCard) {
        const order = findOrderByCode(orderCard.dataset.orderCode);
        if (order) openOrderDetail(order);
      }
    };

    const handleActivityChange = (event) => {
      if (!currentStatusData?.metadata.pending.hasAggregateAction) return;
      const checkbox = event.target.closest("[data-aggregate-checkbox]");
      if (!checkbox) return;
      const code = checkbox.dataset.orderCode;
      if (!code) return;
      checkbox.checked ? aggregateSelection.add(code) : aggregateSelection.delete(code);
      updateAggregateSticky();
    };

    const handleModalAction = (event) => {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl) return;
      const action = actionEl.dataset.action;
      const doCopy = (value, message = "Đã sao chép nội dung chuyển khoản.") => {
        if (!value) {
          showNotification("Không có nội dung để sao chép.", "info");
          return;
        }
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard
            .writeText(value)
            .then(() => showNotification(message, "success"))
            .catch(() => showNotification("Không thể sao chép nội dung.", "error"));
        } else {
          showNotification("Trình duyệt không hỗ trợ sao chép tự động.", "info");
        }
      };
      if (action === "aggregate-copy") {
        doCopy(modal?.dataset.aggregateMemo);
        return;
      }
      if (action === "run-copy") {
        doCopy(modal?.dataset.paymentRunMemo);
        return;
      }
      if (action === "order-copy") {
        doCopy(modal?.dataset.orderMemo, "Đã sao chép nội dung đơn hàng.");
        return;
      }
      if (action === "aggregate-next") {
        setAggregateStep(2);
        return;
      }
      if (action === "aggregate-back") {
        setAggregateStep(1);
        return;
      }
    };

    const finalizeSubmittedOrders = (ordersList, preview, file, context = {}) => {
      const now = Date.now();
      const timestamp = context.timestamp || now;
      const paymentId = context.paymentId;
      const memo = context.memo || paymentId;
      ordersList.forEach((order) => {
        const resolvedPaymentId =
          paymentId || order.paymentId || order.paymentCode || order.code;
        order.paymentId = resolvedPaymentId;
        order.paymentMemo = memo || resolvedPaymentId;
        order.paymentSubmittedAt = timestamp;
        order.billSubmitted = true;
        order.billPreview = preview;
        order.billFileName = file.name;
        order.billFileType = file.type;
        order.paymentStatus = PAYMENT_STATUS.BILL_SUBMITTED;
        order.status = STATUS.PAYMENT_UNDER_REVIEW;
        pushTimeline(order, {
          status: order.status,
          paymentStatus: order.paymentStatus,
          actor: "customer",
          message: `Khách đã upload bill chuyển khoản (ID ${resolvedPaymentId}).`,
        });
      });
      setOrders(getOrders());
      const updatedSettings = getSettings();
      if (updatedSettings.paymentGateOpen) {
        updatedSettings.paymentGateOpen = false;
        setSettings(updatedSettings);
      }
      aggregateSelection.clear();
      renderActivity();
      closeOrderDetail();
      showOrderNotice("Thanh toán đã được xác nhận, cổng thanh toán đã đóng.");
    };

    const handleBillSubmission = (event) => {
      if (event.target.id !== "submitBill") return;
      const code = modal?.dataset?.activeOrder;
      if (!code) return;
      const settings = getSettings();
      if (!settings.paymentGateOpen) {
        modalContent?.insertAdjacentHTML(
          "beforeend",
          '<p class="alert">Cổng thanh toán đang đóng. Vui lòng chờ admin mở.</p>'
        );
        return;
      }
      const upload = document.getElementById("billUpload");
      if (!upload || !upload.files.length) {
        modalContent?.insertAdjacentHTML("beforeend", '<p class="alert">Vui lòng chọn file bill.</p>');
        return;
      }
      const file = upload.files[0];
      const allowed = ["image/jpeg", "image/png", "application/pdf"];
      if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
        modalContent?.insertAdjacentHTML(
          "beforeend",
          '<p class="alert">File không hợp lệ hoặc vượt quá 5MB.</p>'
        );
        return;
      }
      const handleSubmission = (preview) => {
        const orders = getOrders();
        const now = Date.now();
        if (code === "AGGREGATE") {
          const aggregateCodes = (modal.dataset.aggregateOrders || "").split("|").filter(Boolean);
          const targetOrders = orders.filter(
            (entry) => aggregateCodes.includes(entry.code) || aggregateCodes.includes(entry.paymentCode)
          );
          if (!targetOrders.length) return;
          const summary = aggregateSession?.summary;
          const context = {
            paymentId: summary?.memoId,
            memo: summary?.memo,
            timestamp: now,
          };
          finalizeSubmittedOrders(targetOrders, preview, file, context);
          return;
        }
        const targetOrder = orders.find(
          (entry) => entry.paymentCode === code || entry.code === code
        );
        if (!targetOrder) return;
        const context = {
          paymentId: targetOrder.paymentId || targetOrder.paymentCode || targetOrder.code,
          memo: targetOrder.paymentMemo || targetOrder.paymentCode || targetOrder.code,
          timestamp: now,
        };
        finalizeSubmittedOrders([targetOrder], preview, file, context);
      };
      if (file.type.startsWith("image/")) {
        generateBillPreview(file).then((preview) => handleSubmission(preview));
      } else {
        handleSubmission("");
      }
    };

    renderActivity();

    const heroActions = document.querySelector(".payment-hero-actions");
    heroActions?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-hero-action]");
      if (!button) return;
      const action = button.dataset.heroAction;
      const heroTarget = button.dataset.heroTarget;
      if (action === "focus" && heroTarget && setActiveStatus) {
        activeStatus = heroTarget;
        setActiveStatus(heroTarget, { scroll: true });
        return;
      }
      if (action === "scroll" && heroTarget) {
        const targetElement = document.querySelector(heroTarget);
        if (targetElement && typeof targetElement.scrollIntoView === "function") {
          targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });

    if (highlightOrderCode) {
      const focusOrder = findOrderByCode(highlightOrderCode);
      if (focusOrder) {
        setTimeout(() => openOrderDetail(focusOrder), 220);
      }
    }

    if (activity) {
      activity.addEventListener("click", handleActivityClick);
      activity.addEventListener("change", handleActivityChange);
    }
    if (modal) {
      modalClose?.addEventListener("click", closeOrderDetail);
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeOrderDetail();
      });
      modal.addEventListener("click", handleModalAction);
      modalContent?.addEventListener("click", handleBillSubmission);
    }
  };

  const initAdminLogin = () => {
    const loginBtn = document.getElementById("adminLoginBtn");
    const hint = document.getElementById("loginHint");

    if (sessionStore.getItem(KEYS.adminAuth) === "1" || store.getItem(KEYS.adminAuth) === "1") {
      window.location.href = "admin.html";
      return;
    }

    loginBtn.addEventListener("click", async () => {
      const pass = document.getElementById("adminPass").value.trim();
      if (!pass) {
        hint.textContent = "Vui lòng nhập mật khẩu.";
        return;
      }

      const settings = getSettings();
      const base = getAutoImportBaseUrl(settings);
      const endpoint = buildAutoImportUrl(settings, "/admin/login");

      if (!base || !endpoint) {
        hint.textContent = "Lỗi cấu hình: không tìm thấy Sync/Import URL.";
        return;
      }
      
      const headers = {
        "Content-Type": "application/json",
      };
      if (settings.apiKey) {
        headers["x-api-key"] = settings.apiKey;
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ password: pass }),
        });

        if (response.ok) {
          const payload = await response.json();
          if (payload.ok) {
            sessionStore.setItem(KEYS.adminAuth, "1");
            store.setItem(KEYS.adminAuth, "1");
            hint.textContent = "Đăng nhập thành công.";
            window.location.href = "admin.html";
            return;
          }
        }
        hint.textContent = "Sai mật khẩu. Thử lại.";
      } catch (error) {
        hint.textContent = "Lỗi mạng hoặc API không hoạt động.";
      }
    });
  };

  const requireAdminAuth = () => {
    if (sessionStore.getItem(KEYS.adminAuth) !== "1" && store.getItem(KEYS.adminAuth) !== "1") {
      window.location.href = "admin-login.html";
      return false;
    }
    return true;
  };

  const bindAdminLogout = () => {
    const logout = document.getElementById("adminLogout");
    if (!logout) return;
    logout.addEventListener("click", () => {
      sessionStore.removeItem(KEYS.adminAuth);
      store.removeItem(KEYS.adminAuth);
      window.location.href = "admin-login.html";
    });
  };

  const ADMIN_NEW_ORDER_WINDOW = 3 * 24 * 60 * 60 * 1000;

  const STATUS_OVERVIEW = [
    { status: STATUS.PENDING_QUOTE, label: "Chờ báo giá", hint: "Liên hệ khách khi có báo giá" },
    { status: STATUS.QUOTED_WAITING_PAYMENT, label: "Chờ thanh toán", hint: "Đã gửi hóa đơn" },
    { status: STATUS.PAYMENT_UNDER_REVIEW, label: "Đang xác nhận", hint: "Kiểm tra bill ngân hàng" },
    { status: STATUS.PAID, label: "Đã thanh toán", hint: "Chuyển sang giao hàng" },
    { status: STATUS.CANCELLED, label: "Đã hủy", hint: "Cần xác nhận nguyên nhân" },
  ];

  const ADMIN_WORKFLOW_STEPS = [
    {
      key: "pending-quote",
      label: "Chuẩn bị báo giá",
      helper: "Xác định ship fee và bill",
      statuses: [STATUS.PENDING_QUOTE],
      actionLabel: "Mở đơn chờ báo giá",
      actionStatus: STATUS.PENDING_QUOTE,
    },
    {
      key: "awaiting-payment",
      label: "Chờ thanh toán",
      helper: "Đã gửi bill và cần đối soát",
      statuses: [STATUS.QUOTED_WAITING_PAYMENT],
      actionLabel: "Truy cập đơn chờ thanh toán",
      actionStatus: STATUS.QUOTED_WAITING_PAYMENT,
    },
    {
      key: "under-review",
      label: "Đang xác nhận bill",
      helper: "Admin kiểm tra chứng từ",
      statuses: [STATUS.PAYMENT_UNDER_REVIEW],
      actionLabel: "Xem đơn đang kiểm tra",
      actionStatus: STATUS.PAYMENT_UNDER_REVIEW,
    },
    {
      key: "ship-confirmed",
      label: "Đã xác nhận ship",
      helper: "Chuẩn bị giao hàng & messenger",
      statuses: [STATUS.SHIP_CONFIRMED],
      actionLabel: "Kiểm tra lộ trình",
      actionStatus: STATUS.SHIP_CONFIRMED,
    },
  ];

  const renderStatusStats = (container) => {
    if (!container) return;
    const ordersList = getOrders();
    const counts = ordersList.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});
    container.innerHTML = STATUS_OVERVIEW.map((entry) => {
      const count = counts[entry.status] || 0;
      return `
        <div class="admin-status-pill" data-status="${entry.status}">
          <div>
            <strong>${count}</strong>
            <span>${entry.label}</span>
          </div>
          <span class="helper small">${entry.hint}</span>
        </div>
      `;
    }).join("");
  };

  const renderAdminWorkflow = (container) => {
    if (!container) return;
    const ordersList = getOrders();
    const settings = getSettings();
    const products = getProducts();
    const markup = ADMIN_WORKFLOW_STEPS.map((step) => {
      const stepOrders = ordersList.filter((order) => step.statuses.includes(order.status));
      const count = stepOrders.length;
      const totals = stepOrders.reduce(
        (acc, order) => {
          const computed = computeTotals(order, settings, products);
          acc.totalJPY += computed.totalJPY;
          acc.totalVND += computed.totalVND;
          return acc;
        },
        { totalJPY: 0, totalVND: 0 }
      );
      const lastUpdate = stepOrders.reduce(
        (max, order) => Math.max(max, order.updatedAt || order.createdAt || 0),
        0
      );
      const statusValue = count
        ? `Giá trị: JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(totals.totalVND)}`
        : "Chưa có đơn trong giai đoạn này.";
      const timeHint = lastUpdate ? `Cập nhật ${formatDateTime(lastUpdate)}` : "Chưa có cập nhật";
      return `
        <article class="card admin-workflow-card">
          <header>
            <div>
              <strong>${escapeHtml(step.label)}</strong>
              <span class="helper">${escapeHtml(step.helper)}</span>
            </div>
            <span class="badge small">${count} đơn</span>
          </header>
          <p>${escapeHtml(statusValue)}</p>
          <footer>
            <button
              class="btn ghost small"
              type="button"
              data-workflow-action="${escapeHtml(step.actionStatus)}"
            >
              ${escapeHtml(step.actionLabel)}
            </button>
            <span class="helper small">${escapeHtml(timeHint)}</span>
          </footer>
        </article>
      `;
    });
    container.innerHTML = markup.join("");
  };

  const refreshAdminWorkflow = () => renderAdminWorkflow(document.getElementById("adminWorkflowGrid"));

  const handleAdminWorkflowAction = (event) => {
    const button = event.target.closest("[data-workflow-action]");
    if (!button) return;
    const status = button.dataset.workflowAction;
    const target = status
      ? `admin-orders.html?status=${encodeURIComponent(status)}`
      : "admin-orders.html";
    window.location.href = target;
  };

  const createAdminInsightCard = ({ value, label, hint }) => `
    <div class="card soft admin-insight-card">
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(label)}</p>
      ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ""}
    </div>
  `;

  const renderAdminInsights = async (container) => {
    if (!container) return;
    const placeholder = `<div class="card soft admin-insight-card"><p>Đang thu thập dữ liệu...</p></div>`;
    container.innerHTML = placeholder;
    const settings = getSettings();
    const orders = getOrders();
    const products = getProducts();
    const orderCount = orders.length;
    const newOrders = orders.filter(
      (order) => Date.now() - (order.createdAt || 0) <= ADMIN_NEW_ORDER_WINDOW
    );
    const totalRevenueVND = orders.reduce((sum, order) => {
      const totals = computeTotals(order, settings, products);
      return sum + (totals.totalVND || 0);
    }, 0);
    const paidOrders = orders.filter((order) => order.paymentStatus === PAYMENT_STATUS.CONFIRMED);
    const customers = getActiveCustomers();
    const newCustomerWindow = 7 * 24 * 60 * 60 * 1000;
    const newCustomerCount = customers.filter(
      (customer) => (Date.now() - (customer.createdAt || 0)) <= newCustomerWindow
    ).length;
    const outstandingCustomerSet = new Set();
    orders.forEach((order) => {
      if (order.customerCode && order.paymentStatus !== PAYMENT_STATUS.CONFIRMED) {
        outstandingCustomerSet.add(order.customerCode);
      }
    });
    const pendingStatuses = [
      STATUS.PENDING_QUOTE,
      STATUS.QUOTED_WAITING_PAYMENT,
      STATUS.PAYMENT_UNDER_REVIEW,
    ];
    const pendingOrders = orders.filter((order) => pendingStatuses.includes(order.status));
    const pendingTotals = pendingOrders.reduce(
      (acc, order) => {
        const totals = computeTotals(order, settings, products);
        acc.totalJPY += totals.totalJPY;
        acc.totalVND += totals.totalVND;
        return acc;
      },
      { totalJPY: 0, totalVND: 0 }
    );
    const cards = [
      {
        value: formatNumber(orderCount),
        label: "Tổng đơn hàng",
        hint: `${formatNumber(paidOrders.length)} đơn đã thanh toán`,
      },
      {
        value: `${formatNumber(pendingOrders.length)} đơn`,
        label: "Đang chờ xử lý",
        hint: `Giá trị: JPY ${formatNumber(pendingTotals.totalJPY)} · VND ${formatNumber(
          pendingTotals.totalVND
        )}`,
      },
      {
        value: formatNumber(newCustomerCount),
        label: "Khách mới 7 ngày",
        hint: "Ưu tiên phản hồi khách mới",
      },
      {
        value: formatNumber(outstandingCustomerSet.size),
        label: "Khách chưa thanh toán",
        hint: "Gộp đơn thành báo giá tổng",
      },
    ];
    container.innerHTML = cards.map(createAdminInsightCard).join("");
    const newOrderCountEl = document.getElementById("adminNewOrderCountLabel");
    if (newOrderCountEl) {
      newOrderCountEl.textContent = `${formatNumber(newOrders.length)} đơn mới`;
    }
    const paymentGateStateEl = document.getElementById("adminPaymentGateState");
    if (paymentGateStateEl) {
      paymentGateStateEl.textContent = settings.paymentGateOpen
        ? "Cổng thanh toán đang mở"
        : "Cổng thanh toán đang đóng";
    }
  };

  const createAdminInsightMarkup = (card) => {
    const value = card.value || "";
    const label = card.label || "";
    const hint = card.hint || "";
    return `
      <article class="card soft admin-insight-card">
        <strong>${escapeHtml(value)}</strong>
        <p>${escapeHtml(label)}</p>
        ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ""}
      </article>
    `;
  };

  const createAdminStorageCard = ({ value, label, hint }) => `
    <article class="card soft admin-storage-card">
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(label)}</p>
      ${hint ? `<span class="helper small">${escapeHtml(hint)}</span>` : ""}
    </article>
  `;

  const renderAdminStorageOverview = (message = "") => {
    const container = document.getElementById("adminStorageGrid");
    if (!container) return;
    const snapshot = getSnapshot() || {};
    const history = readStore(KEYS.backupHistory, []);
    const counts = {
      products: Array.isArray(snapshot.products) ? snapshot.products.length : 0,
      orders: Array.isArray(snapshot.orders) ? snapshot.orders.length : 0,
      customers: snapshot.customers ? Object.keys(snapshot.customers).length : 0,
      backup: Array.isArray(history) ? history.length : 0,
    };
    const cards = [
      {
        label: "Cập nhật gần nhất",
        value: formatDateTime(snapshot.meta?.updatedAt) || "Chưa lưu",
        hint: "Hiển thị tức thì trong admin",
      },
      {
        label: "Sản phẩm hiện có",
        value: `${counts.products} mục`,
        hint: "Hiển thị ngay sau khi thêm mới",
      },
      {
        label: "Đơn hàng",
        value: `${counts.orders} đơn`,
        hint: "Tất cả thao tác đều có ghi nhận",
      },
      {
        label: "Khách hàng",
        value: `${counts.customers} hồ sơ`,
        hint: "Thông tin khách được lưu nhanh chóng",
      },
      {
        label: "Snapshot dự phòng",
        value: `${counts.backup} phiên`,
        hint: "Giữ các phiên bản để tránh mất dữ liệu",
      },
    ];
    container.innerHTML = cards.map(createAdminStorageCard).join("");
    const noteElement = document.getElementById("adminStorageNote");
    if (!noteElement) return;
    if (message) {
      noteElement.innerHTML = `<span class="tag">${escapeHtml(message)}</span>`;
      return;
    }
    const settings = getSettings();
    const syncNote = settings.syncEndpoint
      ? `Đồng bộ qua ${settings.syncEndpoint}`
      : "Sync backend chưa bật nhưng server vẫn giữ file server/data/shop-store.json khi có backend.";
    const helperText = `Mọi thao tác hiển thị trong admin, dữ liệu lưu tại local + ${counts.backup} snapshot cục bộ · ${syncNote}`;
    noteElement.innerHTML = `<span>${escapeHtml(helperText)}</span>`;
  };

  const sumOrderTotals = (ordersList, settings, products) =>
    ordersList.reduce(
      (acc, order) => {
        const totals = computeTotals(order, settings, products);
        acc.totalJPY += totals.totalJPY;
        acc.totalVND += totals.totalVND;
        return acc;
      },
      { totalJPY: 0, totalVND: 0 }
    );

  const getProductStockValues = (product) => {
    if (!product) return [];
    const stocks = [];
    const pushStock = (value) => {
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) stocks.push(numeric);
    };
    if (Array.isArray(product.variants)) {
      product.variants.forEach((variant) => pushStock(variant.stock));
    }
    if (product.stock && typeof product.stock === "object") {
      Object.values(product.stock).forEach(pushStock);
    }
    if (typeof product.stock === "number") {
      pushStock(product.stock);
    }
    return stocks;
  };

  const getProductSizeList = (product) => {
    if (!product) return [];
    const sizes = new Set();
    const pushSize = (value) => {
      const text = String(value || "").trim();
      if (!text) return;
      sizes.add(text);
    };
    (product.sizesText || []).forEach(pushSize);
    (product.sizesNum || []).forEach(pushSize);
    if (Array.isArray(product.variants)) {
      product.variants.forEach((variant) => {
        pushSize(variant.size || variant.name || variant.label || variant.value);
      });
    }
    if (product.defaultSize) pushSize(product.defaultSize);
    if (!sizes.size && product.size) pushSize(product.size);
    return Array.from(sizes);
  };

  const isProductLowStock = (product) => {
    const stocks = getProductStockValues(product);
    if (!stocks.length) return false;
    return Math.min(...stocks) <= 2;
  };

  const buildAdminInsightCards = (page) => {
    const orders = getOrders();
    const products = getProducts();
    const customers = getActiveCustomers();
    const settings = getSettings();
    const now = Date.now();
    const pendingStatuses = [
      STATUS.PENDING_QUOTE,
      STATUS.QUOTED_WAITING_PAYMENT,
      STATUS.PAYMENT_UNDER_REVIEW,
    ];
    const pendingOrders = orders.filter((order) => pendingStatuses.includes(order.status));
    const readyStatuses = [STATUS.SHIP_CONFIRMED, STATUS.PAID];
    const readyOrders = orders.filter((order) => readyStatuses.includes(order.status));
    const paidOrders = orders.filter((order) => order.paymentStatus === PAYMENT_STATUS.CONFIRMED);
    const quoteOrders = orders.filter((order) =>
      [STATUS.PENDING_QUOTE, STATUS.QUOTED_WAITING_PAYMENT].includes(order.status)
    );
    const awaitingPaymentOrders = orders.filter(
      (order) =>
        order.status === STATUS.QUOTED_WAITING_PAYMENT &&
        order.paymentStatus !== PAYMENT_STATUS.CONFIRMED
    );
    const outstandingOrders = orders.filter(
      (order) => order.paymentStatus !== PAYMENT_STATUS.CONFIRMED
    );
    const etaOrders = orders.filter((order) => order.eta && order.eta.trim());
    const trackingOrders = orders.filter((order) => order.tracking && order.tracking.trim());
    const billSubmittedCount = orders.filter(
      (order) => order.billSubmitted || order.billPreview || order.billFileName
    ).length;
    const fbOrders = orders.filter((order) => order.customer?.fb).length;
    const newOrders = orders.filter(
      (order) => now - (order.createdAt || 0) <= ADMIN_NEW_ORDER_WINDOW
    );
    const newCustomerWindow = 7 * 24 * 60 * 60 * 1000;
    const newCustomers = customers.filter(
      (customer) => now - (customer.createdAt || 0) <= newCustomerWindow
    );
    const outstandingCustomerCodes = new Set(
      outstandingOrders.map((order) => order.customerCode).filter(Boolean)
    );
    const categories = new Set(
      products
        .map((product) => (product.category || "Chưa phân loại").trim())
        .filter(Boolean)
    );
    const hiddenCount = products.filter((product) => product.hidden).length;
    const visibleCount = getVisibleProducts().length;
    const lowStockCount = products.filter(isProductLowStock).length;

    const pendingTotals = sumOrderTotals(pendingOrders, settings, products);
    const awaitingTotals = sumOrderTotals(awaitingPaymentOrders, settings, products);
    const readyTotals = sumOrderTotals(readyOrders, settings, products);
    const quoteTotals = sumOrderTotals(quoteOrders, settings, products);
    const outstandingTotals = sumOrderTotals(outstandingOrders, settings, products);
    const paidTotals = sumOrderTotals(paidOrders, settings, products);

    switch (page) {
      case "admin-dashboard":
        return [
          {
            value: `${formatNumber(orders.length)} đơn`,
            label: "Tổng đơn hàng",
            hint: `${formatNumber(paidOrders.length)} đơn đã thanh toán`,
          },
          {
            value: `${formatNumber(pendingOrders.length)} đơn`,
            label: "Đang xử lý",
            hint: `Giá trị: JPY ${formatNumber(pendingTotals.totalJPY)} · VND ${formatNumber(
              pendingTotals.totalVND
            )}`,
          },
          {
            value: `${formatNumber(newOrders.length)} đơn`,
            label: "Đơn mới 3 ngày",
            hint: "Ưu tiên phản hồi khách mới",
          },
          {
            value: `${formatNumber(outstandingCustomerCodes.size)} khách`,
            label: "Khách chưa thanh toán",
            hint: `Công nợ: ${formatNumber(outstandingTotals.totalVND)} ₫`,
          },
        ];
      case "admin-products":
        return [
          {
            value: `${formatNumber(products.length)} sp`,
            label: "Tổng sản phẩm",
            hint: `${formatNumber(categories.size)} danh mục`,
          },
          {
            value: `${formatNumber(visibleCount)} hiển thị`,
            label: "Đang bán",
            hint: `Ẩn: ${formatNumber(hiddenCount)} sp`,
          },
          {
            value: `${formatNumber(lowStockCount)} danh mục`,
            label: "Cảnh báo low stock",
            hint: "Stock ≤2, cần kiểm tra kho",
          },
          {
            value: `${formatNumber(categories.size)} danh mục`,
            label: "Phân loại",
            hint: "Cập nhật tag & category đều đặn",
          },
        ];
      case "admin-orders":
        return [
          {
            value: `${formatNumber(newOrders.length)} đơn`,
            label: "Đơn mới 3 ngày",
            hint: `Trong tổng ${formatNumber(orders.length)} đơn`,
          },
          {
            value: `${formatNumber(awaitingPaymentOrders.length)} đơn`,
            label: "Chờ thanh toán",
            hint: `Giá trị: JPY ${formatNumber(awaitingTotals.totalJPY)} · VND ${formatNumber(
              awaitingTotals.totalVND
            )}`,
          },
          {
            value: `${formatNumber(readyOrders.length)} đơn`,
            label: "Đã xác nhận ship",
            hint: `Giá trị: JPY ${formatNumber(readyTotals.totalJPY)} · VND ${formatNumber(
              readyTotals.totalVND
            )}`,
          },
          {
            value: `${formatNumber(pendingOrders.length)} đơn`,
            label: "Đang xử lý tổng quát",
            hint: `Đã gửi bill: ${formatNumber(billSubmittedCount)}`,
          },
        ];
      case "admin-quotes":
        return [
          {
            value: `${formatNumber(pendingOrders.length)} đơn`,
            label: "Chờ báo giá",
            hint: `Giá trị: JPY ${formatNumber(quoteTotals.totalJPY)} · VND ${formatNumber(
              quoteTotals.totalVND
            )}`,
          },
          {
            value: `${formatNumber(awaitingPaymentOrders.length)} đơn`,
            label: "Đợi thanh toán",
            hint: "Gửi bill, mở cổng thanh toán",
          },
          {
            value: `${formatNumber(fbOrders)} đơn`,
            label: "Có Facebook",
            hint: "Nhắn Messenger ngay khi có bill",
          },
        ];
      case "admin-payments":
        return [
          {
            value: `${formatNumber(awaitingPaymentOrders.length)} đơn`,
            label: "Chờ xác nhận thanh toán",
            hint: `Giá trị: JPY ${formatNumber(awaitingTotals.totalJPY)} · VND ${formatNumber(
              awaitingTotals.totalVND
            )}`,
          },
          {
            value: `${formatNumber(billSubmittedCount)} đơn`,
            label: "Bill đã upload",
            hint: "Kiểm tra chứng từ & đối soát",
          },
          {
            value: settings.paymentGateOpen ? "Mở" : "Đóng",
            label: "Cổng thanh toán",
            hint: settings.paymentGateOpen
              ? `Cập nhật ${formatDateTime(settings.lastSync || Date.now())}`
              : "Đang đóng",
          },
          {
            value: `${formatNumber(paidOrders.length)} đơn`,
            label: "Thanh toán đã xác nhận",
            hint: `VND ${formatNumber(paidTotals.totalVND)}`,
          },
        ];
      case "admin-tracking":
        return [
          {
            value: `${formatNumber(etaOrders.length)} đơn`,
            label: "ETA đã cập nhật",
            hint: "Theo dõi lịch nhận hàng",
          },
          {
            value: `${formatNumber(trackingOrders.length)} đơn`,
            label: "Có lộ trình",
            hint: "Cập nhật tracking link",
          },
          {
            value: `${formatNumber(readyOrders.length)} đơn`,
            label: "Sẵn sàng giao",
            hint: `Giá trị: JPY ${formatNumber(readyTotals.totalJPY)} · VND ${formatNumber(
              readyTotals.totalVND
            )}`,
          },
        ];
      case "admin-customers":
        return [
          {
            value: `${formatNumber(customers.length)} khách`,
            label: "Khách hàng ghi nhận",
            hint: `${formatNumber(newCustomers.length)} khách mới 7 ngày`,
          },
          {
            value: `${formatNumber(outstandingCustomerCodes.size)} khách`,
            label: "Khách đang nợ",
            hint: `Tổng công nợ: ${formatNumber(outstandingTotals.totalVND)} ₫`,
          },
          {
            value: `${formatNumber(customers.filter((entry) => entry.fb).length)} khách`,
            label: "Có Facebook",
            hint: "Nhắn Messenger để nhắc thanh toán",
          },
          {
            value: `${formatNumber(newCustomers.length)} khách`,
            label: "Khách mới 7 ngày",
            hint: "Ưu tiên xử lý đơn đầu tiên",
          },
        ];
      case "admin-settings":
        return [
          {
            value: settings.syncEndpoint ? "Đã cấu hình" : "Chưa có",
            label: "URL đồng bộ",
            hint: settings.syncEndpoint || "Chưa khai báo",
          },
          {
            value: settings.importEndpoint ? "Đã cấu hình" : "Chưa có",
            label: "Crawler Import",
            hint: settings.importEndpoint || "Chưa khai báo",
          },
          {
            value: settings.paymentGateOpen ? "Mở" : "Đóng",
            label: "Cổng thanh toán",
            hint: settings.paymentGateOpen ? "Khách có thể chuyển khoản" : "Hoàn tất báo giá trước",
          },
          {
            value: `JPY ${formatNumber(settings.rateJPY)} · VND ${formatNumber(
              settings.rateVND
            )}`,
            label: "Tỷ giá hiện tại",
            hint: settings.rateUpdated ? `Cập nhật ${formatDateTime(settings.rateUpdated)}` : "",
          },
        ];
      case "admin-reports":
        const pendingOrders = orders.filter((order) => pendingStatuses.includes(order.status));
        const pendingReportTotals = sumOrderTotals(pendingOrders, settings, products);
        return [
          {
            value: `${formatNumber(paidTotals.totalVND)} ₫`,
            label: "Doanh thu đã thu",
            hint: `${formatNumber(paidOrders.length)} đơn đã TT`,
          },
          {
            value: `${formatNumber(pendingOrders.length)} đơn`,
            label: "Đang xử lý",
            hint: `Giá trị: JPY ${formatNumber(pendingReportTotals.totalJPY)} · VND ${formatNumber(
              pendingReportTotals.totalVND
            )}`,
          },
          {
            value: `${formatNumber(orders.length)} đơn`,
            label: "Tổng đơn",
            hint: `Đã thu: ${formatNumber(paidTotals.totalVND)} ₫`,
          },
        ];
      default:
        return [];
    }
  };

  const renderAdminPageInsights = (page) => {
    const container = document.querySelector("[data-admin-insights]");
    if (!container) return;
    const cards = buildAdminInsightCards(page);
    if (!cards.length) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = cards.map(createAdminInsightMarkup).join("");
  };

  const refreshAdminInsights = () => renderAdminPageInsights(document.body.dataset.page);

  const ADMIN_QUICK_LINKS = {
    orders: "admin-orders.html",
    payments: "admin-payments.html",
    products: "admin-products.html",
    customers: "admin-customers.html",
    settings: "admin-settings.html",
  };

  const ADMIN_SEARCH_DEFAULT_HINT = "Nhập mã đơn, tên khách hoặc sản phẩm để tìm nhanh.";

  const findOrderMatch = (term, orders) => {
    const normalized = term.toLowerCase();
    const equals = (value) => (value || "").toLowerCase() === normalized;
    const includes = (value) => (value || "").toLowerCase().includes(normalized);
    const exact = orders.find(
      (order) => equals(order.code) || equals(order.paymentCode)
    );
    if (exact) return exact;
    return orders.find(
      (order) =>
        includes(order.code) ||
        includes(order.paymentCode) ||
        includes(order.customer?.name) ||
        includes(order.customer?.phone) ||
        includes(order.customer?.fb)
    );
  };

  const findCustomerMatch = (term, customers) => {
    const normalized = term.toLowerCase();
    const equals = (value) => (value || "").toLowerCase() === normalized;
    const includes = (value) => (value || "").toLowerCase().includes(normalized);
    return (
      customers.find(
        (customer) =>
          equals(customer.code) ||
          equals(customer.phone) ||
          equals(customer.fb)
      ) ||
      customers.find(
        (customer) =>
          includes(customer.name) ||
          includes(customer.phone) ||
          includes(customer.fb || "")
      )
    );
  };

  const findProductMatch = (term, products) => {
    const normalized = term.toLowerCase();
    const equals = (value) => (value || "").toLowerCase() === normalized;
    const includes = (value) => (value || "").toLowerCase().includes(normalized);
    return (
      products.find(
        (product) => equals(product.id) || equals(product.name) || equals(product.sourceUrl)
      ) ||
      products.find(
        (product) => includes(product.name) || includes((product.tags || []).join(" "))
      )
    );
  };

  const runAdminSearch = (term, feedback) => {
    const input = term.trim();
    if (!input) {
      if (feedback) feedback.textContent = ADMIN_SEARCH_DEFAULT_HINT;
      return false;
    }
    const normalized = input.toLowerCase();
    const orders = getOrders();
    const products = getProducts();
    const customers = getActiveCustomers();
    const order = findOrderMatch(normalized, orders);
    if (order) {
      const code = order.code || order.paymentCode || "";
      if (code) {
        window.location.href = `admin-orders.html?order=${encodeURIComponent(code)}`;
        return true;
      }
    }
    const customer = findCustomerMatch(normalized, customers);
    if (customer?.code) {
      window.location.href = `admin-orders.html?customer=${encodeURIComponent(customer.code)}`;
      return true;
    }
    const product = findProductMatch(normalized, products);
    if (product?.id) {
      window.location.href = `admin-products.html?product=${encodeURIComponent(product.id)}`;
      return true;
    }
    if (feedback) {
      feedback.textContent = `Không tìm thấy "${term}".`;
    }
    return false;
  };

  const initAdminGlobalTools = () => {
    const searchInput = document.getElementById("adminGlobalSearch");
    const searchButton = document.getElementById("adminSearchButton");
    const feedback = document.getElementById("adminSearchFeedback");
    const quickLinks = Array.from(document.querySelectorAll("[data-admin-quick]"));
    const triggerSearch = () => runAdminSearch(searchInput?.value || "", feedback);
    if (feedback) {
      feedback.textContent = ADMIN_SEARCH_DEFAULT_HINT;
    }
    if (searchInput) {
      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          triggerSearch();
        } else if (feedback) {
          feedback.textContent = ADMIN_SEARCH_DEFAULT_HINT;
        }
      });
      searchInput.addEventListener("input", () => {
        if (feedback) feedback.textContent = ADMIN_SEARCH_DEFAULT_HINT;
      });
    }
    if (searchButton) {
      searchButton.addEventListener("click", () => {
        triggerSearch();
      });
    }
    quickLinks.forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.adminQuick;
        const url = ADMIN_QUICK_LINKS[target] || "admin-orders.html";
        window.location.href = url;
      });
    });
  };

  const renderOrdersTable = (container, statusFilter = "all", customerFilter = "") => {
    if (!container) return;
    const products = getProducts();
    const settings = getSettings();
    let ordersList = getOrders();
    if (statusFilter && statusFilter !== "all") {
      ordersList = ordersList.filter((order) => order.status === statusFilter);
    }
    if (customerFilter) {
      ordersList = ordersList.filter((order) => order.customerCode === customerFilter);
    }
    const rows = ordersList.length
      ? ordersList
          .map((order) => {
            const totals = computeTotals(order, settings, products);
            const customerName = escapeHtml(order.customer?.name || "Khách vãng lai");
            const phoneLabel = escapeHtml(order.customer?.phone || "Chưa có số điện thoại");
            const statusLabel = formatOrderStatus(order.status);
            const paymentLabel = formatPaymentStatus(order.paymentStatus);
            const orderCode = escapeHtml(order.code || "");
            const isNew =
              order.createdAt && Date.now() - order.createdAt <= ADMIN_NEW_ORDER_WINDOW;
            const newBadge = isNew ? '<span class="badge green badge-inline">Mới</span>' : "";
            return `
              <tr class="order-row${isNew ? " order-row--new" : ""}">
                <td class="order-customer-cell">
                  <strong>${customerName}</strong>${newBadge}
                  <span class="helper">${phoneLabel}</span>
                </td>
                <td>${orderCode}</td>
                <td><span class="status">${statusLabel}</span></td>
                <td><span class="status">${paymentLabel}</span></td>
                <td>
                  JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(totals.totalVND)}
                </td>
                <td class="order-items-cell">${renderOrderItems(order, products)}</td>
                <td>
                  <div class="segment" style="gap:.2rem;">
                    <button class="btn ghost small" data-action="edit" data-code="${orderCode}" type="button">Sửa</button>
                    <button class="btn ghost small danger" data-action="delete" data-code="${orderCode}" type="button">Xóa</button>
                  </div>
                </td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="7">Chưa có đơn hàng.</td></tr>`;
    container.innerHTML = `
      <tr>
        <th>Khách hàng</th>
        <th>Mã đơn</th>
        <th>Trạng thái</th>
        <th>Thanh toán</th>
        <th>Tổng</th>
        <th>Sản phẩm</th>
        <th>Hành động</th>
      </tr>
      ${rows}
    `;
  };

  const renderAdminOrderLanes = () => {
    const newOrdersEl = document.getElementById("adminNewOrdersList");
    const pendingSummaryEl = document.getElementById("adminPendingSummary");
    const priorityZonesEl = document.getElementById("adminPriorityZones");
    if (!newOrdersEl && !pendingSummaryEl && !priorityZonesEl) return;
    const orders = getOrders().filter((order) => order.status !== STATUS.CANCELLED);
    const settings = getSettings();
    const products = getProducts();
    const sortedByCreated = orders
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const newOrders = sortedByCreated.slice(0, 4);
    if (newOrdersEl) {
      newOrdersEl.innerHTML = newOrders.length
        ? newOrders
            .map((order) => {
            const customerName = escapeHtml(order.customer?.name || "Khách vãng lai");
            const statusLabel = escapeHtml(formatOrderStatus(order.status));
            const paymentLabel = escapeHtml(formatPaymentStatus(order.paymentStatus));
            const totals = computeTotals(order, settings, products);
            const created = order.createdAt ? formatDateTime(order.createdAt) : "-";
            const safeCode = escapeHtml(order.code || "");
            return `
                <div class="admin-lane-item">
                  <div>
                    <strong>${customerName}</strong>
                    <span class="helper small">${statusLabel} · ${paymentLabel}</span>
                  </div>
                  <div class="admin-lane-meta">
                    <span>JPY ${formatNumber(totals.totalJPY)} · VND ${formatNumber(
                      totals.totalVND
                    )}</span>
                    <span class="helper small">${created}</span>
                  </div>
                  <p class="helper small">Mã: ${safeCode}</p>
                </div>
              `;
            })
            .join("")
        : `<p class="helper">Chưa có đơn mới.</p>`;
    }
    const pendingStatuses = [
      STATUS.PENDING_QUOTE,
      STATUS.QUOTED_WAITING_PAYMENT,
      STATUS.PAYMENT_UNDER_REVIEW,
    ];
    const pendingOrders = orders.filter((order) => pendingStatuses.includes(order.status));
    const pendingTotals = pendingOrders.reduce(
      (acc, order) => {
        const totals = computeTotals(order, settings, products);
        acc.totalJPY += totals.totalJPY;
        acc.totalVND += totals.totalVND;
        acc.count += 1;
        return acc;
      },
      { totalJPY: 0, totalVND: 0, count: 0 }
    );
    if (pendingSummaryEl) {
      pendingSummaryEl.innerHTML = pendingTotals.count
        ? `
          <div class="admin-lane-summary-row">
            <strong>${formatNumber(pendingTotals.count)} đơn</strong>
            <span class="helper small">Chờ thanh toán tổng / bill</span>
          </div>
          <div class="admin-lane-summary-row">
            <span>JPY ${formatNumber(pendingTotals.totalJPY)}</span>
            <span>VND ${formatNumber(pendingTotals.totalVND)}</span>
          </div>
          <p class="helper">Gộp đơn để thanh toán cùng lúc và hạn chế theo dõi lẻ.</p>
        `
        : `<p class="helper">Không có đơn đang chờ thanh toán.</p>`;
    }
    if (priorityZonesEl) {
      const statusCounts = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {});
      const zoneItems = [
        {
          label: "Chờ báo giá",
          status: STATUS.PENDING_QUOTE,
          hint: "Chuẩn bị phí ship rõ ràng",
          color: "rgba(255, 187, 71, 0.15)",
        },
        {
          label: "Chờ thanh toán",
          status: STATUS.QUOTED_WAITING_PAYMENT,
          hint: "Nhắc khách, gửi bill",
          color: "rgba(96, 165, 250, 0.15)",
        },
        {
          label: "Đã xác nhận ship",
          status: STATUS.SHIP_CONFIRMED,
          hint: "Theo dõi lộ trình",
          color: "rgba(102, 252, 241, 0.15)",
        },
      ];
      const zonesMarkup = zoneItems
        .map((zone) => {
          const count = statusCounts[zone.status] || 0;
          return `
            <div class="admin-priority-zone" style="background:${zone.color}">
              <div>
                <strong>${escapeHtml(zone.label)}</strong>
                <span class="helper small">${escapeHtml(zone.hint)}</span>
              </div>
              <span class="badge small">${count} đơn</span>
            </div>
          `;
        })
        .join("");
      priorityZonesEl.innerHTML = zonesMarkup;
    }
  };

  const renderOrderSelect = (select, selectedCode = "") => {
    if (!select) return "";
    const ordersList = getOrders();
    if (!ordersList.length) {
      select.innerHTML = "<option value=\"\">Chưa có đơn</option>";
      return "";
    }
    select.innerHTML = ordersList
      .map((order) => {
        const customerLabel = escapeHtml(order.customer?.name || "Khách hàng");
        const displayLabel = `${customerLabel} · ${escapeHtml(order.code || "")}`;
        return `<option value="${order.code}">${displayLabel}</option>`;
      })
      .join("");
    const nextCode = selectedCode || ordersList[ordersList.length - 1].code;
    select.value = nextCode;
    return nextCode;
  };

  const initAdminDashboard = () => {
    if (!requireAdminAuth()) return;
    bindAdminLogout();
    renderStatusStats(document.getElementById("statusStats"));
    renderAdminInsights(document.getElementById("overviewStats")).catch((error) => {
      console.error("Không thể tải thông tin tổng quan admin:", error);
    });
    const workflowGrid = document.getElementById("adminWorkflowGrid");
    const workflowRefreshBtn = document.getElementById("adminWorkflowRefresh");
    const refreshWorkflowSection = () => refreshAdminWorkflow();
    refreshWorkflowSection();
    if (workflowGrid) {
      workflowGrid.addEventListener("click", handleAdminWorkflowAction);
    }
    if (workflowRefreshBtn) {
      workflowRefreshBtn.addEventListener("click", refreshWorkflowSection);
    }
    const orderPanel = document.getElementById("adminOrdersPanel");
    const orderMeta = document.getElementById("adminOrderRefreshMeta");
    const orderRefreshBtn = document.getElementById("adminOrderRefresh");
    const refreshOrders = () =>
      renderAdminOrderQueue(orderPanel, orderMeta).catch((error) => {
        console.error("Không thể tải đơn hàng từ backend:", error);
      });
    refreshOrders();
    if (orderRefreshBtn) {
      orderRefreshBtn.addEventListener("click", refreshOrders);
    }
    const backupNowBtn = document.getElementById("adminBackupNow");
    if (backupNowBtn) {
      backupNowBtn.addEventListener("click", () => {
        updateBackup();
        showNotification("Đã lưu bản sao dữ liệu cục bộ.", "success");
        renderAdminStorageOverview("Snapshot cục bộ đã được tạo.");
      });
    }
    const exportSnapshotBtn = document.getElementById("adminExportSnapshot");
    if (exportSnapshotBtn) {
      exportSnapshotBtn.addEventListener("click", () => {
        const date = new Date().toISOString().slice(0, 10);
        downloadJSON(getSnapshot(), `orderhub-backup-${date}.json`);
        renderAdminStorageOverview("Đã xuất dữ liệu cục bộ.");
      });
    }
    renderAllCustomerSections();
    renderAdminStorageOverview();
    refreshAdminInsights();
  };

  const initAdminSettings = () => {
    if (!requireAdminAuth()) return;
    bindAdminLogout();

    let settings = getSettings();
    let autoImportPolling = null;
    const rateJPY = document.getElementById("rateJPY");
    const rateVND = document.getElementById("rateVND");
    const rateUpdated = document.getElementById("rateUpdated");
    const fbLink = document.getElementById("fbLink");
    const bankJP = document.getElementById("bankJP");
    const bankVN = document.getElementById("bankVN");
    const paymentGateOpen = document.getElementById("paymentGateOpen");
    const saveSettings = document.getElementById("saveSettings");
    const syncEndpoint = document.getElementById("syncEndpoint");
    const syncKey = document.getElementById("syncKey");
    const importEndpoint = document.getElementById("importEndpoint");
    const importCookie = document.getElementById("importCookie");
    const syncNow = document.getElementById("syncNow");
    const exportData = document.getElementById("exportData");
    const importData = document.getElementById("importData");
    const dataStatus = document.getElementById("dataStatus");
    const autoImportPages = document.getElementById("autoImportPages");
    const autoImportSavePages = document.getElementById("autoImportSavePages");
    const autoImportRun = document.getElementById("autoImportRun");
    const autoImportRefresh = document.getElementById("autoImportRefresh");
    const autoImportStatusMessage = document.getElementById("autoImportStatusMessage");
    const autoImportStatusMeta = document.getElementById("autoImportStatusMeta");
    const autoImportLog = document.getElementById("autoImportLog");
    const taobaoProductUrl = document.getElementById("taobaoProductUrl");
    const taobaoLoginButton = document.getElementById("taobaoLogin");
    const taobaoFetchProduct = document.getElementById("taobaoFetchProduct");
    const taobaoStatusMessage = document.getElementById("taobaoStatusMessage");
    const taobaoStatusMeta = document.getElementById("taobaoStatusMeta");
    const taobaoProductDetails = document.getElementById("taobaoProductDetails");

    const syncSettingsForm = () => {
      rateJPY.value = settings.rateJPY;
      rateVND.value = settings.rateVND;
      rateUpdated.value = settings.rateUpdated;
      fbLink.value = settings.fbLink;
      bankJP.value = settings.bankJP;
      bankVN.value = settings.bankVN;
      if (paymentGateOpen) paymentGateOpen.checked = Boolean(settings.paymentGateOpen);
      if (syncEndpoint) syncEndpoint.value = settings.syncEndpoint || "";
      if (syncKey) syncKey.value = settings.syncKey || "";
      if (importEndpoint) importEndpoint.value = settings.importEndpoint || "";
      if (importCookie) importCookie.value = settings.importCookie || "";
    };

    const startAutoImportPolling = () => {
      if (autoImportPolling) return;
      autoImportPolling = setInterval(() => {
        refreshAutoImportStatus();
      }, 5000);
    };

    const stopAutoImportPolling = () => {
      if (!autoImportPolling) return;
      clearInterval(autoImportPolling);
      autoImportPolling = null;
    };

    const refreshAutoImportStatus = async () => {
      const endpoint = buildAutoImportUrl(settings, "/auto-import/status");
      if (!endpoint) {
        if (autoImportStatusMessage) {
          autoImportStatusMessage.textContent =
            "Ghi rõ Import Endpoint để dùng auto import.";
        }
        if (autoImportLog) autoImportLog.textContent = "";
        stopAutoImportPolling();
        return;
      }
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        ensureImporterSupported(response, "Không thể lấy trạng thái auto import.");
        const payload = await response.json();
        if (!payload?.ok) throw new Error(payload?.message || "Lỗi auto import.");
        const state = payload.state || {};
        if (autoImportStatusMessage) {
          autoImportStatusMessage.textContent = state.running
            ? "Đang chạy crawl Taobao..."
            : state.message || "Chưa chạy.";
        }
        if (autoImportStatusMeta) {
          const metaParts = [];
          if (state.startedAt) metaParts.push(`Bắt đầu ${formatDateTime(state.startedAt)}`);
          if (state.pid) metaParts.push(`PID ${state.pid}`);
          if (!state.running && state.endedAt)
            metaParts.push(`Kết thúc ${formatDateTime(state.endedAt)}`);
          if (state.exitCode !== null && state.exitCode !== undefined)
            metaParts.push(`Exit ${state.exitCode}`);
          autoImportStatusMeta.textContent = metaParts.join(" · ");
        }
        if (autoImportLog) {
          autoImportLog.textContent = payload.log || "Chưa có nhật ký.";
          autoImportLog.scrollTop = autoImportLog.scrollHeight;
        }
        if (state.running) {
          startAutoImportPolling();
        } else {
          stopAutoImportPolling();
        }
        return payload;
      } catch (error) {
        if (autoImportStatusMessage) {
          autoImportStatusMessage.textContent =
            error.message || "Không thể lấy trạng thái auto import.";
        }
        if (autoImportLog) {
          autoImportLog.textContent = error.message || "Không có nhật ký.";
        }
        stopAutoImportPolling();
      }
    };

    const hydrateAutoImportPages = async () => {
      if (!autoImportPages) return;
      const endpoint = buildAutoImportUrl(settings, "/auto-import/pages");
      if (!endpoint) {
        autoImportPages.value = "";
        return;
      }
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        ensureImporterSupported(response, "Không lấy được danh sách trang crawl.");
        const payload = await response.json();
        if (!payload?.ok) throw new Error();
        autoImportPages.value = Array.isArray(payload.pages)
          ? payload.pages.join("\n")
          : "";
      } catch (error) {
        autoImportPages.value = "";
        if (autoImportStatusMessage) {
          autoImportStatusMessage.textContent =
            error.message || "Không thể lấy danh sách trang crawl.";
        }
      }
    };

    const saveAutoImportPages = async () => {
      if (!autoImportPages) return;
      const lines = autoImportPages.value
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (!lines.length) {
        if (autoImportStatusMessage) {
          autoImportStatusMessage.textContent = "Nhập tối thiểu một trang crawl.";
        }
        return;
      }
      const endpoint = buildAutoImportUrl(settings, "/auto-import/pages");
      if (!endpoint) {
        if (autoImportStatusMessage) {
          autoImportStatusMessage.textContent =
            "Ghi rõ Import Endpoint để lưu trang crawl.";
        }
        return;
      }
      if (autoImportSavePages) autoImportSavePages.disabled = true;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages: lines }),
        });
        ensureImporterSupported(response, "Không lưu được.");
        const payload = await response.json();
        if (!payload?.ok) throw new Error(payload?.message || "Lỗi lưu trang.");
        autoImportPages.value = Array.isArray(payload.pages) ? payload.pages.join("\n") : "";
        if (autoImportStatusMessage) {
          autoImportStatusMessage.textContent = "Đã lưu trang crawl.";
        }
        refreshAutoImportStatus();
      } catch (error) {
        if (autoImportStatusMessage) {
          autoImportStatusMessage.textContent =
            error.message || "Lưu trang crawl thất bại.";
        }
      } finally {
        if (autoImportSavePages) autoImportSavePages.disabled = false;
      }
    };

    const runAutoImport = async () => {
      if (!autoImportRun) return;
      const endpoint = buildAutoImportUrl(settings, "/auto-import/run");
      if (!endpoint) {
        if (autoImportStatusMessage) {
          autoImportStatusMessage.textContent =
            "Ghi rõ Import Endpoint để khởi chạy auto import.";
        }
        return;
      }
      autoImportRun.disabled = true;
      try {
        const response = await fetch(endpoint, { method: "POST" });
        ensureImporterSupported(response, "Không thể khởi chạy auto import.");
        const payload = await response.json();
        if (!payload?.ok) throw new Error(payload?.message || "Lỗi auto import.");
        if (autoImportStatusMessage) {
          autoImportStatusMessage.textContent = "Đã yêu cầu chạy auto import.";
        }
        refreshAutoImportStatus();
      } catch (error) {
        if (autoImportStatusMessage) {
          autoImportStatusMessage.textContent =
            error.message || "Khởi chạy auto import thất bại.";
        }
      } finally {
        autoImportRun.disabled = false;
      }
    };

    const setTaobaoStatus = (message, meta = "") => {
      if (taobaoStatusMessage) taobaoStatusMessage.textContent = message;
      if (taobaoStatusMeta) taobaoStatusMeta.textContent = meta;
    };

    const buildTaobaoServiceUrl = (path) => buildAutoImportUrl(settings, path);

    const refreshTaobaoStatus = async () => {
      if (!settings.importEndpoint) {
        setTaobaoStatus("Chưa có Import URL.", "");
        return;
      }
      const endpoint = buildTaobaoServiceUrl("/taobao/login/status");
      if (!endpoint) {
        setTaobaoStatus("Không xác định được backend Taobao.", "");
        return;
      }
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        ensureImporterSupported(response, "Không lấy được trạng thái Taobao.");
        const payload = await response.json();
        if (payload?.ok === false) {
          throw new Error(payload?.message || "Không lấy được trạng thái.");
        }
        const message = payload.loggedIn
          ? "Đã có cookie Taobao cá nhân."
          : "Chưa đăng nhập Taobao.";
        const metaParts = [];
        if (payload.updatedAt) metaParts.push(`Cập nhật ${formatDateTime(payload.updatedAt)}`);
        setTaobaoStatus(message, metaParts.join(" · "));
      } catch (error) {
        setTaobaoStatus(error.message || "Không thể xác định trạng thái Taobao.", "");
      }
    };

    const renderTaobaoProductDetails = (payload) => {
      if (!taobaoProductDetails) return;
      if (!payload || !payload.data) {
        taobaoProductDetails.textContent = "Không có dữ liệu sản phẩm.";
        return;
      }
      const { data, warnings, blocked } = payload;
      const lines = [];
      lines.push(`Tên: ${data.name || "-"}`);
      lines.push(
        `Giá: ${
          typeof data.price === "number" ? `${formatNumber(data.price)} CNY` : data.price || "-"
        }`
      );
      const ratingLine = formatRatingText(data.rating, data.ratingCount);
      if (ratingLine) {
        lines.push(`Đánh giá: ${ratingLine}`);
      }
      const positiveRateText = formatPositiveRate(data.positiveRate);
      if (positiveRateText) {
        lines.push(`Tỉ lệ tích cực: ${positiveRateText}`);
      }
      const soldValue =
        typeof data.soldCount === "number" ? data.soldCount : Number(data.soldCount);
      if (Number.isFinite(soldValue) && soldValue > 0) {
        lines.push(`Đã bán: ${formatNumber(soldValue)}`);
      }
      lines.push(`Mô tả: ${data.desc || "-"}`);
      lines.push(
        `Sizes: ${
          Array.isArray(data.sizes) && data.sizes.length ? data.sizes.join(", ") : "-"
        }`
      );
      if (Array.isArray(data.colors) && data.colors.length) {
        const colorNames = data.colors.map((color) => color.name).filter(Boolean);
        if (colorNames.length) {
          lines.push(`Màu sắc: ${colorNames.join(", ")}`);
        }
      }
      if (Array.isArray(data.variants) && data.variants.length) {
        const variantLines = data.variants.slice(0, 6).map((variant) => {
          const colorLabel = variant.props?.color || "-";
          const sizeLabel = variant.props?.size || "-";
          const priceLabel =
            typeof variant.price === "number" ? `${formatNumber(variant.price)} CNY` : "-";
          const stockLabel =
            variant.stock === null || variant.stock === undefined ? "-" : String(variant.stock);
          return `  ${colorLabel} · ${sizeLabel} → ${priceLabel}, kho ${stockLabel}`;
        });
        if (variantLines.length) {
          lines.push("Biến thể:");
          lines.push(...variantLines);
          if (data.variants.length > 6) {
            lines.push(`  ...còn ${data.variants.length - 6} biến thể nữa.`);
          }
        }
      }
      const images = [];
      if (data.image) images.push(data.image);
      if (Array.isArray(data.images)) images.push(...data.images);
      if (images.length) {
        lines.push(`Ảnh chính: ${images[0]}`);
        if (images.length > 1) {
          lines.push(`...còn ${images.length - 1} ảnh nữa.`);
        }
      }
      if (warnings?.length) {
        lines.push(`Cảnh báo: ${warnings.join(", ")}`);
      }
      if (blocked) {
        lines.push("Trang yêu cầu xác thực, dữ liệu có thể thiếu.");
      }
      taobaoProductDetails.textContent = lines.join("\n");
    };

    const fetchTaobaoProductDetails = async () => {
      const url = taobaoProductUrl?.value.trim();
      if (!url) {
        setTaobaoStatus("Vui lòng nhập link sản phẩm.", "");
        return;
      }
      const endpoint =
        (importEndpoint ? importEndpoint.value.trim() : settings.importEndpoint) || "";
      if (!endpoint) {
        setTaobaoStatus("Chưa có Import URL.", "");
        return;
      }
      if (taobaoProductDetails) taobaoProductDetails.textContent = "Đang lấy dữ liệu...";
      setTaobaoStatus("Đang lấy thông tin sản phẩm...", "");
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        ensureImporterSupported(response, "Không thể lấy dữ liệu sản phẩm Taobao.");
        const payload = await response.json();
        if (payload?.ok === false) {
          throw new Error(payload?.message || "Không lấy được dữ liệu sản phẩm.");
        }
        renderTaobaoProductDetails(payload);
        setTaobaoStatus("Đã lấy dữ liệu sản phẩm.", "");
      } catch (error) {
        setTaobaoStatus(error.message || "Không thể lấy dữ liệu sản phẩm.", "");
        if (taobaoProductDetails)
          taobaoProductDetails.textContent = error.message || "Không có dữ liệu.";
      }
    };

    const handleTaobaoLogin = async () => {
      if (!settings.importEndpoint) {
        setTaobaoStatus("Chưa có Import URL.", "");
        return;
      }
      const endpoint = buildTaobaoServiceUrl("/taobao/login");
      if (!endpoint) {
        setTaobaoStatus("Không xác định được backend Taobao.", "");
        return;
      }
      if (taobaoLoginButton) taobaoLoginButton.disabled = true;
      setTaobaoStatus("Mở trình duyệt để đăng nhập Taobao...", "");
      try {
        const response = await fetch(endpoint, { method: "POST" });
        ensureImporterSupported(response, "Không thể đăng nhập Taobao.");
        const payload = await response.json();
        if (payload?.ok === false) {
          throw new Error(payload?.message || "Không thể đăng nhập Taobao.");
        }
        setTaobaoStatus("Đã lưu cookie Taobao cá nhân.", "");
        refreshTaobaoStatus();
      } catch (error) {
        setTaobaoStatus(error.message || "Đăng nhập thất bại.", "");
      } finally {
        if (taobaoLoginButton) taobaoLoginButton.disabled = false;
      }
    };

    const renderDataStatus = (message = "") => {
      if (!dataStatus) return;
      const snapshot = getSnapshot();
      const history = readStore(KEYS.backupHistory, []);
      const counts = {
        products: snapshot.products?.length || 0,
        orders: snapshot.orders?.length || 0,
        customers: Object.keys(snapshot.customers || {}).length,
        cart: snapshot.cart?.length || 0,
        wishlist: snapshot.wishlist?.length || 0,
        recent: snapshot.recent?.length || 0,
        backup: Array.isArray(history) ? history.length : 0,
      };
      const items = [
        `<span><strong>Cập nhật:</strong> ${formatDateTime(snapshot.meta?.updatedAt)}</span>`,
        `<span><strong>Sản phẩm:</strong> ${counts.products}</span>`,
        `<span><strong>Đơn hàng:</strong> ${counts.orders}</span>`,
        `<span><strong>Khách hàng:</strong> ${counts.customers}</span>`,
        `<span><strong>Giỏ hàng:</strong> ${counts.cart}</span>`,
        `<span><strong>Yêu thích:</strong> ${counts.wishlist}</span>`,
        `<span><strong>Vừa xem:</strong> ${counts.recent}</span>`,
        `<span><strong>Backup gần đây:</strong> ${counts.backup}</span>`,
        `<span><strong>Cổng thanh toán:</strong> ${
          settings.paymentGateOpen ? "Đang mở" : "Đang đóng"
        }</span>`,
      ];
      if (settings.syncEndpoint) {
        items.push(`<span><strong>Sync URL:</strong> ${settings.syncEndpoint}</span>`);
      }
      if (settings.syncKey) {
        items.push(`<span><strong>Sync Key:</strong> ${settings.syncKey}</span>`);
      }
      if (settings.importEndpoint) {
        items.push(`<span><strong>Import URL:</strong> ${settings.importEndpoint}</span>`);
      }
      if (settings.importCookie) {
        items.push("<span><strong>Import Cookie:</strong> đã cấu hình</span>");
      }
      if (settings.lastSync) {
        items.push(`<span><strong>Lần sync:</strong> ${formatDateTime(settings.lastSync)}</span>`);
      }
      if (message) items.push(`<span class="tag">${message}</span>`);
      dataStatus.innerHTML = items.join("");
    };

    syncSettingsForm();
    renderDataStatus();
    hydrateAutoImportPages();
    refreshAutoImportStatus();
    refreshTaobaoStatus();

    refreshLiveRates(true).then((result) => {
      if (result) {
        settings = getSettings();
        syncSettingsForm();
        renderDataStatus("Tỷ giá đã cập nhật tự động.");
      }
    });

    const buildSettings = () => ({
      ...settings,
      rateJPY: Number(rateJPY.value) || settings.rateJPY,
      rateVND: Number(rateVND.value) || settings.rateVND,
      rateUpdated: rateUpdated.value || settings.rateUpdated,
      fbLink: fbLink.value || settings.fbLink,
      bankJP: bankJP.value || settings.bankJP,
      bankVN: bankVN.value || settings.bankVN,
      paymentGateOpen: paymentGateOpen ? paymentGateOpen.checked : settings.paymentGateOpen,
      syncEndpoint: syncEndpoint ? syncEndpoint.value.trim() : settings.syncEndpoint,
      syncKey: syncKey ? syncKey.value.trim() : settings.syncKey,
      importEndpoint: importEndpoint ? importEndpoint.value.trim() : settings.importEndpoint,
      importCookie: importCookie ? importCookie.value.trim() : settings.importCookie,
    });

    const persistSettings = (message) => {
      const nextSettings = buildSettings();
      setSettings(nextSettings);
      settings = nextSettings;
      renderDataStatus(message);
      hydrateAutoImportPages();
      refreshAutoImportStatus();
      refreshTaobaoStatus();
    };

    if (saveSettings) {
      saveSettings.addEventListener("click", () => {
        persistSettings("Đã lưu cấu hình.");
      });
    }

    if (paymentGateOpen) {
      paymentGateOpen.addEventListener("change", () => {
        persistSettings(
          paymentGateOpen.checked ? "Đã mở cổng thanh toán." : "Đã đóng cổng thanh toán."
        );
      });
    }

    if (exportData) {
      exportData.addEventListener("click", () => {
        const date = new Date().toISOString().slice(0, 10);
        downloadJSON(getSnapshot(), `orderhub-backup-${date}.json`);
        renderDataStatus("Đã xuất dữ liệu.");
      });
    }

    if (importData) {
      importData.addEventListener("change", () => {
        const file = importData.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const payload = JSON.parse(reader.result);
            const success = applySnapshot(payload);
            if (success) {
              settings = getSettings();
              syncSettingsForm();
              renderDataStatus("Đã nhập dữ liệu.");
            } else {
              renderDataStatus("File không hợp lệ.");
            }
          } catch (error) {
            renderDataStatus("File không hợp lệ.");
          }
        };
        reader.readAsText(file);
      });
    }

    if (syncNow) {
      syncNow.addEventListener("click", async () => {
        const endpoint = syncEndpoint ? syncEndpoint.value.trim() : "";
        const key = syncKey ? syncKey.value.trim() : "";
        if (!endpoint) {
          renderDataStatus("Chưa có URL đồng bộ.");
          return;
        }
        settings = { ...settings, syncEndpoint: endpoint, syncKey: key };
        setSettings(settings);
        const result = await performSync({ reason: "manual" });
        if (result.ok) {
          settings = getSettings();
          settings.lastSync = new Date().toISOString();
          setSettings(settings);
          syncSettingsForm();
        }
        renderDataStatus(result.message || "Đã đồng bộ.");
      });
    }

    if (autoImportSavePages) {
      autoImportSavePages.addEventListener("click", saveAutoImportPages);
    }
    if (autoImportRun) {
      autoImportRun.addEventListener("click", runAutoImport);
    }
    if (autoImportRefresh) {
      autoImportRefresh.addEventListener("click", refreshAutoImportStatus);
    }
    if (taobaoLoginButton) {
      taobaoLoginButton.addEventListener("click", handleTaobaoLogin);
    }
    if (taobaoFetchProduct) {
      taobaoFetchProduct.addEventListener("click", fetchTaobaoProductDetails);
    }
    refreshAdminInsights();
  };

  const initAdminProducts = () => {
    if (!requireAdminAuth()) return;
    bindAdminLogout();

    const productList = document.getElementById("productList");
    const productSearch = document.getElementById("productSearch");
    const productSort = document.getElementById("productSort");
    const autoLink = document.getElementById("autoLink");
    const autoFill = document.getElementById("autoFill");
    const autoOpen = document.getElementById("autoOpen");
    const autoImportHint = document.getElementById("autoImportHint");
    const autoPaste = document.getElementById("autoPaste");
    const autoParse = document.getElementById("autoParse");
    const bulkExtract = document.getElementById("bulkExtract");
    const bulkImport = document.getElementById("bulkImport");
    const bulkCacheAll = document.getElementById("bulkCacheAll");
    const bulkLinks = document.getElementById("bulkLinks");
    const bulkLimit = document.getElementById("bulkLimit");
    const bulkImportHint = document.getElementById("bulkImportHint");
    const productName = document.getElementById("productName");
    const productDesc = document.getElementById("productDesc");
    const productPrice = document.getElementById("productPrice");
    const productCategory = document.getElementById("productCategory");
    const productSource = document.getElementById("productSource");
    const productLink = document.getElementById("productLink");
    const productTags = document.getElementById("productTags");
    const productSizes = document.getElementById("productSizes");
    const productColor = document.getElementById("productColor");
    const productDefaultSize = document.getElementById("productDefaultSize");
    const productImage = document.getElementById("productImage");
    const productImages = document.getElementById("productImages");
    const productVideo = document.getElementById("productVideo");
    const productImagePreview = document.getElementById("productImagePreview");
    const productHidden = document.getElementById("productHidden");
    const addProduct = document.getElementById("addProduct");
    const updateProduct = document.getElementById("updateProduct");
    const resetProduct = document.getElementById("resetProduct");
    const productDefaultStock = document.getElementById("productDefaultStock");
    const paletteInput = document.getElementById("productPaletteInput");
    const paletteAdd = document.getElementById("productPaletteAdd");
    const paletteChips = document.getElementById("productPaletteChips");
    const importPreviewName = document.querySelector("[data-import-name]");
    const importPreviewPrice = document.querySelector("[data-import-price]");
    const importPreviewSizes = document.querySelector("[data-import-sizes]");
    const importPreviewColors = document.querySelector("[data-import-colors]");
    const importPreviewImages = document.getElementById("importPreviewImages");
    const importPreviewNote = document.getElementById("importPreviewNote");
    const importPreviewSource = document.getElementById("importPreviewSource");
    const importPreviewSourceLink = document.getElementById("importPreviewSourceLink");
    const importPreviewColorChips = document.getElementById("importPreviewColorChips");
    const importPreviewQualityTag = document.getElementById("importPreviewQualityTag");
    const importPreviewRatingTag = document.getElementById("importPreviewRatingTag");
    const importPreviewDesc = document.getElementById("importPreviewDesc");
    const importPreviewImageSizes = document.getElementById("importPreviewImageSizes");
    const importPreviewImageSizeList = importPreviewImageSizes?.querySelector(".image-size-list");
    const importPreviewVideoPlayer = document.getElementById("importPreviewVideoPlayer");

    const quickEntryInputs = [
      productName,
      productDesc,
      productPrice,
      productCategory,
      productSizes,
      productTags,
      productLink,
      productColor,
      productDefaultSize,
    ].filter(Boolean);
    quickEntryInputs.forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          if (addProduct) addProduct.click();
        }
      });
    });

    if (!productList) return;

    const urlParams = new URLSearchParams(window.location.search);
    const highlightProductId = urlParams.get("product") || "";
    let activeProductId = highlightProductId || "";
    let importedImages = [];
    let bulkQueue = [];
    let bulkQueuePrices = new Map();
    let bulkQueueNames = new Map();
    let bulkQueueImages = new Map();
    let bulkQueueSizes = new Map();
    let bulkQueueDescs = new Map();
    let importedMeta = null;
    const DEFAULT_PALETTE = ["#2a2f45", "#374766", "#ffb347"];
    let selectedPalette = [...DEFAULT_PALETTE];

    const parseImageList = (value) =>
      String(value || "")
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);

    const mergeImages = (...lists) => {
      const set = new Set();
      lists.flat().forEach((item) => {
        if (item) set.add(item);
      });
      return Array.from(set);
    };

    const collectImageInputs = () => {
      const primary = productImage ? productImage.value.trim() : "";
      const extra = productImages ? parseImageList(productImages.value) : [];
      return mergeImages(primary ? [primary] : [], extra, importedImages);
    };

    const renderImagePreview = (value) => {
      if (!productImagePreview) return;
      const images = value ? [value] : collectImageInputs();
      if (!images.length) {
        productImagePreview.innerHTML = "<span class=\"tag\">Chưa có ảnh</span>";
        return;
      }
      const thumbs = images.slice(0, 3).map((src) => `<img src="${src}" alt="" />`).join("");
      const count = images.length > 3 ? `<span class="tag">+${images.length - 3}</span>` : "";
      productImagePreview.innerHTML = `<div class="image-stack">${thumbs}${count}</div>`;
    };

    let importMeasurementToken = 0;
    const renderImportPreviewImageSizes = (measurements) => {
      if (!importPreviewImageSizeList) return;
      if (!Array.isArray(measurements) || !measurements.length) {
        importPreviewImageSizeList.innerHTML =
          '<span class="helper small">Chưa đo kích thước ảnh.</span>';
        return;
      }
      importPreviewImageSizeList.innerHTML = measurements
        .map(
          (entry) => `
            <div class="image-size-row">
              <span>${escapeHtml(entry.label || "Ảnh")}</span>
              <span>${entry.width || "-"}×${entry.height || "-"}</span>
            </div>
          `
        )
        .join("");
    };

    const requestImportImageMeasurements = (sources) => {
      if (!importPreviewImageSizeList) return;
      const list = (Array.isArray(sources) ? sources : [])
        .map((value) => ensureUrl(value) || value)
        .filter(Boolean);
      if (!list.length) {
        renderImportPreviewImageSizes([]);
        return;
      }
      importPreviewImageSizeList.innerHTML =
        '<span class="helper small">Đang đo kích thước ảnh...</span>';
      const token = ++importMeasurementToken;
      measureImageSizes(list, { limit: 6 }).then((measurements) => {
        if (token !== importMeasurementToken) return;
        renderImportPreviewImageSizes(measurements);
      });
    };

    let importPreviewVideoHints = [];
    const setImportPreviewVideoSources = (sources) => {
      if (!importPreviewVideoPlayer) return;
      const list = Array.from(
        new Set((Array.isArray(sources) ? sources : []).filter(Boolean))
      );
      if (!list.length) {
        importPreviewVideoPlayer.innerHTML =
          "<span class=\"helper small\">Chưa có video.</span>";
        return;
      }
      const safeUrl = escapeHtml(list[0]);
      importPreviewVideoPlayer.innerHTML = `
        <video controls muted playsinline preload="metadata">
          <source src="${safeUrl}" />
        </video>
      `;
    };

    const refreshImportPreviewVideo = () => {
      const manual = productVideo?.value.trim();
      const sources = manual ? [manual, ...importPreviewVideoHints] : [...importPreviewVideoHints];
      setImportPreviewVideoSources(sources);
    };

    const updateImportPreviewVideoHints = (sources) => {
      importPreviewVideoHints = Array.from(
        new Set((Array.isArray(sources) ? sources : []).filter(Boolean))
      );
      refreshImportPreviewVideo();
    };

    const loadVideoHintsForUrl = async (url) => {
      if (!url) return;
      try {
        const hints = await fetchVideoHintsFromLink(url);
        if (!hints.length) return;
        updateImportPreviewVideoHints(hints);
        if (productVideo && !productVideo.value.trim()) {
          productVideo.value = hints[0];
          refreshImportPreviewVideo();
        }
      } catch (error) {
        console.warn("Không lấy được video:", error);
      }
    };

    const sanitizePaletteValue = (value) => cleanText(value || "");

    const renderPaletteChips = () => {
      if (!paletteChips) return;
      if (!selectedPalette.length) {
        paletteChips.innerHTML = "<span class=\"helper small\">Chưa chọn màu mở rộng</span>";
        return;
      }
      paletteChips.innerHTML = selectedPalette
        .map(
          (color) => `
          <span class="color-chip">
            <span class="color-chip-swatch" style="background:${color}"></span>
            ${escapeHtml(color)}
            <button
              type="button"
              class="remove-color"
              data-color="${escapeHtml(color)}"
              aria-label="Xóa ${escapeHtml(color)}"
            >&times;</button>
          </span>
        `
        )
        .join("");
    };

    const setPalette = (values) => {
      const list = (Array.isArray(values) ? values : [])
        .map((value) => sanitizePaletteValue(value))
        .filter(Boolean);
      selectedPalette = list.length ? list : [...DEFAULT_PALETTE];
      if (selectedPalette.length > 8) {
        selectedPalette = selectedPalette.slice(0, 8);
      }
      renderPaletteChips();
    };

    const addPaletteColorValue = (value) => {
      const cleaned = sanitizePaletteValue(value);
      if (!cleaned) return false;
      const exists = selectedPalette.some(
        (entry) => entry.toLowerCase() === cleaned.toLowerCase()
      );
      if (exists) return false;
      selectedPalette = [...selectedPalette, cleaned].slice(0, 8);
      renderPaletteChips();
      return true;
    };

    const getProductPalette = () => (selectedPalette.length ? selectedPalette : [...DEFAULT_PALETTE]);

    const getDefaultStockValue = () => {
      const raw = Number(productDefaultStock?.value);
      if (Number.isNaN(raw) || raw < 0) return 3;
      return Math.max(0, Math.round(raw));
    };

    const formatPreviewPrice = (value) => {
      const parsed = Number(value);
      if (Number.isNaN(parsed) || parsed <= 0) return "Chưa có giá";
      const settings = getSettings();
      const baseWithFee = applyProductFee(parsed);
      const converted = convertPrice(parsed, settings);
      return `${formatCurrency(baseWithFee, settings.baseCurrency)} · JPY ${formatNumber(
        converted.jpy
      )} · VND ${formatNumber(converted.vnd)}`;
    };

    const renderImportPreviewColorChips = (colors) => {
      if (!importPreviewColorChips) return;
      const normalized = (Array.isArray(colors) ? colors : [])
        .map((value) => sanitizePaletteValue(value))
        .filter(Boolean);
      if (!normalized.length) {
        importPreviewColorChips.innerHTML =
          '<span class="helper small">Chưa có màu sắc gợi ý.</span>';
        return;
      }
      importPreviewColorChips.innerHTML = normalized
        .map(
          (color) => `
            <span class="color-chip-preview">
              <span class="color-chip-swatch" style="background:${color}"></span>
              ${escapeHtml(color)}
            </span>
          `
        )
        .join("");
    };

    const buildDescriptionPreview = (value) => {
      const cleaned = cleanText(value);
      if (!cleaned) {
        return { snippet: "Chưa có mô tả từ link.", full: "" };
      }
      const limit = 160;
      const snippet = cleaned.length > limit ? `${cleaned.slice(0, limit).trim()}…` : cleaned;
      return { snippet, full: cleaned };
    };

    const renderImportPreview = (payload, note = "") => {
      if (!payload) {
        clearImportPreview();
        return;
      }
      const nameText = payload.name || "Chưa có dữ liệu";
      const priceText = payload.price ? formatPreviewPrice(payload.price) : "Chưa có giá";
      const sizeText =
        Array.isArray(payload.sizes) && payload.sizes.length
          ? payload.sizes.join(", ")
          : "Chưa có";
      const colorList = Array.isArray(payload.colors)
        ? payload.colors
            .map((color) => (typeof color === "string" ? color : color?.name || color?.text || ""))
            .filter(Boolean)
        : [];
      const colorText = colorList.length ? colorList.join(", ") : "Chưa có";
      const normalizedSource = ensureUrl(payload.sourceUrl || "");
      const quality = evaluateQuality(payload);
      const sourceText = sourceLabel(payload.source || "web");

      if (importPreviewName) importPreviewName.textContent = nameText;
      if (importPreviewPrice) importPreviewPrice.textContent = priceText;
      if (importPreviewSizes) importPreviewSizes.textContent = sizeText;
      if (importPreviewColors) importPreviewColors.textContent = colorText;
      if (importPreviewImages) {
        const images = Array.isArray(payload.images) ? payload.images.slice(0, 4) : [];
        importPreviewImages.innerHTML = images.length
          ? images
              .map((src) => `<img src="${src}" alt="" loading="lazy" />`)
              .join("")
          : '<span class="helper small">Không có ảnh</span>';
      }
      if (importPreviewSource) {
        importPreviewSource.textContent = `Nguồn: ${sourceText}`;
      }
      if (importPreviewSourceLink) {
        if (normalizedSource) {
          importPreviewSourceLink.href = normalizedSource;
          importPreviewSourceLink.textContent = "Xem link gốc";
          importPreviewSourceLink.classList.remove("muted");
        } else {
          importPreviewSourceLink.href = "#";
          importPreviewSourceLink.textContent = "Chưa có link";
          importPreviewSourceLink.classList.add("muted");
        }
      }
      if (importPreviewQualityTag) {
        const reason = quality.passed
          ? "Chất lượng dữ liệu ổn định"
          : quality.reasons[0] || "Thiếu dữ liệu đánh giá";
        importPreviewQualityTag.textContent = reason;
        importPreviewQualityTag.className = `tag ${quality.passed ? "primary" : "warning"}`;
      }
      if (importPreviewRatingTag) {
        importPreviewRatingTag.textContent = formatRatingText(
          payload.rating,
          payload.ratingCount
        );
      }
      if (importPreviewDesc) {
        const descPreview = buildDescriptionPreview(payload.desc);
        importPreviewDesc.textContent = descPreview.snippet;
        importPreviewDesc.title = descPreview.full;
      }
      const previewImages =
        Array.isArray(payload.images) && payload.images.length ? payload.images : [];
      const imageSources = previewImages.length
        ? previewImages
        : payload.image
        ? [payload.image]
        : [];
      requestImportImageMeasurements(imageSources);
      const videoSources = [];
      if (payload.video) videoSources.push(payload.video);
      if (payload.videoUrl) videoSources.push(payload.videoUrl);
      if (Array.isArray(payload.videos)) videoSources.push(...payload.videos);
      if (videoSources.length) {
        updateImportPreviewVideoHints(videoSources);
      } else {
        refreshImportPreviewVideo();
      }
      renderImportPreviewColorChips(colorList);
      if (importPreviewNote) {
        importPreviewNote.textContent =
          note?.trim() || "Kết quả sẽ hiển thị sau khi import dữ liệu.";
      }
    };

    const clearImportPreview = () => {
      if (importPreviewName) importPreviewName.textContent = "Chưa có dữ liệu";
      if (importPreviewPrice) importPreviewPrice.textContent = "0";
      if (importPreviewSizes) importPreviewSizes.textContent = "Chưa có";
      if (importPreviewColors) importPreviewColors.textContent = "Chưa có";
      if (importPreviewImages) {
        importPreviewImages.innerHTML = '<span class="helper small">Chưa có ảnh</span>';
      }
      if (importPreviewSource)
        importPreviewSource.textContent = "Nguồn: Chưa có";
      if (importPreviewSourceLink) {
        importPreviewSourceLink.href = "#";
        importPreviewSourceLink.textContent = "Chưa có link";
        importPreviewSourceLink.classList.remove("muted");
      }
      if (importPreviewQualityTag) {
        importPreviewQualityTag.textContent = "Chưa có đánh giá";
        importPreviewQualityTag.className = "tag";
      }
      if (importPreviewRatingTag) {
        importPreviewRatingTag.textContent = "Chưa có đánh giá";
      }
      if (importPreviewDesc) {
        importPreviewDesc.textContent = "Chưa có mô tả từ link.";
        importPreviewDesc.title = "";
      }
      renderImportPreviewColorChips([]);
      renderImportPreviewImageSizes([]);
      updateImportPreviewVideoHints([]);
      if (importPreviewNote) {
        importPreviewNote.textContent = "Kết quả sẽ hiển thị sau khi import.";
      }
    };

    if (paletteAdd) {
      paletteAdd.addEventListener("click", () => {
        if (addPaletteColorValue(paletteInput?.value || "")) {
          if (paletteInput) paletteInput.value = "";
        }
      });
    }
    if (paletteInput) {
      paletteInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (addPaletteColorValue(paletteInput.value)) {
            paletteInput.value = "";
          }
        }
      });
    }
    if (paletteChips) {
      paletteChips.addEventListener("click", (event) => {
        const target = event.target.closest(".remove-color");
        if (!target) return;
        const color = target.dataset.color;
        if (!color) return;
        selectedPalette = selectedPalette.filter(
          (entry) => entry.toLowerCase() !== color.toLowerCase()
        );
        if (!selectedPalette.length) {
          selectedPalette = [...DEFAULT_PALETTE];
        }
        renderPaletteChips();
      });
    }
    renderPaletteChips();
    const setAutoHint = (message) => {
      if (!autoImportHint) return;
      autoImportHint.textContent = message;
    };

    const setBulkHint = (message) => {
      if (!bulkImportHint) return;
      bulkImportHint.textContent = message;
    };

    const ensureUrl = (raw) => {
      const trimmed = raw.trim();
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
        const id = getProductIdFromUrl(url.href);
        const host = url.hostname;
        if (id && /taobao|tmall|tb\.cn/i.test(host)) {
          const canonicalHost = /tmall/i.test(host) ? "detail.tmall.com" : "item.taobao.com";
          return `https://${canonicalHost}/item.htm?id=${id}`;
        }
        return url.href;
      } catch (error) {
        return value;
      }
    };

    const inferSourceFromUrl = (url) => {
      try {
        const host = new URL(url).hostname;
        if (/taobao|tmall|tb\.cn/i.test(host)) return "taobao_link";
      } catch (error) {
        return "web";
      }
      return "web";
    };

    const inferCategoryFromName = (name) => {
      const value = (name || "").toLowerCase();
      if (/sneaker|giày|shoe/.test(value)) return "sneakers";
      if (/túi|bag|backpack|tote/.test(value)) return "bags";
      if (/áo|hoodie|jacket|khoác|sơ mi|shirt|coat/.test(value)) return "outerwear";
      return "lifestyle";
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

    const parseNumberFromText = (value) => {
      if (!value) return null;
      const match = String(value).match(/([0-9]+(?:\.[0-9]+)?)/);
      if (!match) return null;
      const number = Number(match[1]);
      if (Number.isNaN(number) || number <= 0 || number > 1000000) return null;
      return number;
    };

    const decodeEscapedText = (value) => {
      if (!value) return "";
      return String(value)
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
          String.fromCharCode(parseInt(code, 16))
        )
        .replace(/\\\//g, "/")
        .replace(/\\"/g, "\"")
        .replace(/\\\\/g, "\\")
        .trim();
    };

    const decodeHtmlEntities = (value) => {
      if (!value) return "";
      return String(value)
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
          String.fromCharCode(parseInt(code, 16))
        )
        .replace(/&#([0-9]+);/g, (_, code) =>
          String.fromCharCode(parseInt(code, 10))
        );
    };

    const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const BLOCKED_TEXT_RE =
      /access denied|访问被拒绝|安全验证|人机验证|验证码|请先登录|login required|sign in required/i;
    const BLOCKED_HTML_RE =
      /Access denied|访问被拒绝|安全验证|人机验证|验证码|请先登录|请登录后|登录后查看|开启 JavaScript|enable JavaScript|robot check|滑块验证/i;
    const isBlockedText = (value) => {
      const cleaned = cleanText(value).toLowerCase();
      if (!cleaned) return false;
      return BLOCKED_TEXT_RE.test(cleaned);
    };

    const pickFirst = (...values) =>
      values.find((value) => value && String(value).trim().length > 0) || "";

    const extractFromJsonPayload = (payload) => {
      const names = [];
      const descs = [];
      const prices = [];
      const images = [];
      const sizes = new Set();
      const colors = new Set();
      const ratings = [];
      const ratingCounts = [];
      const positiveRates = [];
      const soldCounts = [];
      const queue = [payload];
      const seen = new Set();
      let steps = 0;
      const pushString = (list, value, max = 160) => {
        const text = cleanText(value);
        if (text && text.length <= max) list.push(text);
      };
      const pushImage = (value) => {
        const text = cleanText(value);
        if (!text) return;
        if (/^https?:\/\//i.test(text) || text.startsWith("//")) images.push(text);
      };
      const pushColor = (value) => {
        const text = cleanText(value);
        if (!text) return;
        colors.add(text);
      };
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
      while (queue.length && steps < 5000) {
        const current = queue.shift();
        steps += 1;
        if (!current || typeof current !== "object") continue;
        if (seen.has(current)) continue;
        seen.add(current);
        if (Array.isArray(current)) {
          current.forEach((item) => queue.push(item));
          continue;
        }
        Object.entries(current).forEach(([key, value]) => {
          const keyText = String(key || "");
          if (/title|name|itemTitle|mainTitle|itemName/i.test(keyText)) {
            if (typeof value === "string") pushString(names, value);
          }
          if (/desc|description|subtitle|subTitle/i.test(keyText)) {
            if (typeof value === "string") pushString(descs, value, 300);
          }
          if (/color|colour|màu|颜色|kleur|farbe/i.test(keyText)) {
            if (typeof value === "string") pushColor(value);
            if (Array.isArray(value)) {
              value.forEach((item) => {
                if (typeof item === "string") pushColor(item);
              });
            }
          }
          if (/price|itemPrice|minPrice|maxPrice|priceText/i.test(keyText)) {
            if (typeof value === "string" || typeof value === "number") {
              const parsed = parseNumberFromText(value);
              if (parsed) prices.push(parsed);
            }
          }
          if (
            /ratingValue|avgStar|rateScore|commentScore|rating|score/i.test(keyText) &&
            !/count|num|total|quantity/i.test(keyText)
          ) {
            if (typeof value === "string" || typeof value === "number") pushRating(value);
          }
          if (/goodRate|positiveRate|goodRatePercent|positivePercent|praiseRate|favorableRate/i.test(keyText)) {
            if (typeof value === "string" || typeof value === "number") pushRate(value);
          }
          if (/rateCount|commentCount|reviewCount|ratingCount|totalComments|totalReview/i.test(keyText)) {
            if (typeof value === "string" || typeof value === "number") pushCount(ratingCounts, value);
          }
          if (
            /sellCount|soldCount|tradeCount|dealCount|salesCount|totalSoldQuantity|totalSales|soldTotal/i.test(
              keyText
            ) ||
            (/sell|sold|trade|deal|sales/i.test(keyText) &&
              /count|num|qty|quantity|total/i.test(keyText) &&
              !/price/i.test(keyText))
          ) {
            if (typeof value === "string" || typeof value === "number") pushCount(soldCounts, value);
          }
          if (/image|pic|img|pics|images|picUrl/i.test(keyText)) {
            if (typeof value === "string") pushImage(value);
            if (Array.isArray(value)) {
              value.forEach((item) => {
                if (typeof item === "string") pushImage(item);
              });
            }
          }
          if (/skuProps|props/i.test(keyText) && Array.isArray(value)) {
            extractSizesFromProps(value).forEach((size) => sizes.add(size));
          }
          if (/size|尺码|kích cỡ/i.test(keyText)) {
            if (typeof value === "string") sizes.add(cleanText(value));
            if (Array.isArray(value)) {
              value.forEach((item) => {
                if (typeof item === "string") sizes.add(cleanText(item));
              });
            }
          }
          if (value && typeof value === "object") queue.push(value);
        });
      }
      const name = names.sort((a, b) => b.length - a.length)[0] || "";
      const desc = descs.sort((a, b) => b.length - a.length)[0] || "";
      const price = prices.length ? Math.min(...prices) : null;
      const rating = ratings.length ? Math.max(...ratings) : null;
      const ratingCount = ratingCounts.length ? Math.max(...ratingCounts) : null;
      const positiveRate = positiveRates.length ? Math.max(...positiveRates) : null;
      const soldCount = soldCounts.length ? Math.max(...soldCounts) : null;
      return {
        name,
        desc,
        price,
        images,
        sizes: Array.from(sizes).filter(Boolean),
        colors: Array.from(colors).filter(Boolean),
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

    const parseSizesFromDom = (doc) => {
      const sizes = new Set();
      const pushSize = (value) => {
        const cleaned = cleanText(value);
        if (!cleaned || cleaned.length > 12) return;
        sizes.add(cleaned);
      };
      const scanOptions = (container) => {
        if (!container) return;
        container.querySelectorAll("li, a, span, option, button").forEach((el) => {
          const value =
            el.getAttribute("title") ||
            el.getAttribute("data-value") ||
            el.getAttribute("value") ||
            el.textContent;
          pushSize(value);
        });
      };
      const containers = doc.querySelectorAll("[data-property]");
      containers.forEach((node) => {
        const prop = node.getAttribute("data-property") || "";
        if (!/size|尺码|kích cỡ/i.test(prop)) return;
        scanOptions(node);
      });
      doc
        .querySelectorAll("#J_isku, .tb-sku, .sku, .sku-prop, .J_Prop, .tb-prop")
        .forEach((node) => scanOptions(node));
      doc.querySelectorAll("dt, label, span, div").forEach((node) => {
        const label = cleanText(node.textContent);
        if (!/size|尺码|kích cỡ/i.test(label)) return;
        const container =
          node.closest("dl, .tb-prop, .J_Prop, .tb-sku, .sku") || node.parentElement;
        scanOptions(container);
      });
      return Array.from(sizes);
    };

    const parseColorValues = (doc) => {
      if (!doc) return [];
      const colors = new Set();
      const pushColor = (value) => {
        const label = cleanText(value);
        if (!label || label.length > 24) return;
        colors.add(label);
      };

      const scanNode = (node) => {
        if (!node) return;
        const value =
          node.getAttribute("data-value") ||
          node.getAttribute("title") ||
          node.textContent ||
          "";
        pushColor(value);
        node.querySelectorAll("[data-value], [title], span, button").forEach((child) => {
          if (child === node) return;
          const text =
            child.getAttribute("data-value") ||
            child.getAttribute("title") ||
            child.textContent ||
            "";
          pushColor(text);
        });
      };

      doc
        .querySelectorAll("[data-property]")
        .forEach((node) => {
          const prop = (node.getAttribute("data-property") || "").toLowerCase();
          if (!/color|colour|màu|颜色|kleur|farbe/i.test(prop)) return;
          scanNode(node);
        });
      doc
        .querySelectorAll(
          ".sku-color, .tb-sku, .sku-prop, .prop-color, .J_Prop, .tb-color, .J_Color, .tb-sku a"
        )
        .forEach((node) => scanNode(node));
      return Array.from(colors);
    };

    const parseJsonLdProduct = (doc) => {
      const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
      for (const script of scripts) {
        const raw = script.textContent?.trim();
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
              offer.price ||
              offer.priceSpecification?.price ||
              offer.priceSpecification?.minPrice;
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

    const parseScriptData = (html) => {
      const matchValue = (...regexes) => {
        for (const regex of regexes) {
          const match = html.match(regex);
          if (match && match[1]) return decodeEscapedText(match[1]);
        }
        return "";
      };
      const collectImagesFromArray = (raw) => {
        const list = [];
        if (!raw) return list;
        const decoded = decodeEscapedText(raw);
        const urlRegex = /"(https?:\/\/[^"]+|\/\/[^"]+)"|'(https?:\/\/[^']+|\/\/[^']+)'/g;
        for (const match of decoded.matchAll(urlRegex)) {
          const url = match[1] || match[2];
          if (url) list.push(url);
        }
        return list;
      };
      const images = [];
      const pushImage = (value) => {
        const cleaned = cleanText(decodeEscapedText(value));
        if (!cleaned) return;
        if (!images.includes(cleaned)) images.push(cleaned);
      };
      const pushImages = (values) => {
        values.forEach((value) => pushImage(value));
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
      const desc = matchValue(
        /"itemDesc"\s*:\s*"([^"]+)"/,
        /'itemDesc'\s*:\s*'([^']+)'/,
        /"desc"\s*:\s*"([^"]{6,})"/,
        /'desc'\s*:\s*'([^']{6,})'/
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
            /"券后约"\s*:\s*"([0-9.]+)"/,
            /'券后约'\s*:\s*'([0-9.]+)'/,
            /"券后价"\s*:\s*"([0-9.]+)"/,
            /'券后价'\s*:\s*'([0-9.]+)'/,
            /"couponPrice"\s*:\s*"([0-9.]+)"/,
            /'couponPrice'\s*:\s*'([0-9.]+)'/,
            /"itemPrice"\s*:\s*"([0-9.]+)"/,
            /'itemPrice'\s*:\s*'([0-9.]+)'/,
            /"price"\s*:\s*"([0-9.]+)"/,
            /'price'\s*:\s*'([0-9.]+)'/
          );      const price = parseNumberFromText(priceText);
      const picsMatch =
        html.match(/"picsPath"\s*:\s*\[([^\]]+)\]/) ||
        html.match(/'picsPath'\s*:\s*\[([^\]]+)\]/);
      if (picsMatch) {
        picsMatch[1]
          .split(",")
          .map((entry) => entry.trim().replace(/^"|"$/g, ""))
          .map(decodeEscapedText)
          .filter(Boolean)
          .forEach((src) => pushImage(src));
      }
      const arrayRegexes = [
        /"images"\s*:\s*(\[[\s\S]*?\])/,
        /"itemImages"\s*:\s*(\[[\s\S]*?\])/,
        /"itemImgs"\s*:\s*(\[[\s\S]*?\])/,
        /"mainImages"\s*:\s*(\[[\s\S]*?\])/,
        /"picList"\s*:\s*(\[[\s\S]*?\])/,
      ];
      arrayRegexes.forEach((regex) => {
        const match = html.match(regex);
        if (!match || !match[1]) return;
        pushImages(collectImagesFromArray(match[1]));
      });
      if (pic) pushImage(pic);
      return {
        title,
        subtitle,
        desc,
        pic,
        price,
        images,
      };
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
        const directPrice = parseNumberFromText(
          parsed.searchParams.get("item_price") ||
            parsed.searchParams.get("price") ||
            parsed.searchParams.get("itemPrice")
        );
        if (directPrice) return { price: directPrice };
      } catch (error) {
        return {};
      }
      return {};
    };

    const normalizeTitleText = (value) =>
      cleanText(value)
        .replace(/[￥¥]\s*\d+(?:\.\d+)?/g, "")
        .replace(/\d+(?:\.\d+)?\s*元/g, "")
        .trim();

    const normalizeImageHint = (value) => {
      const cleaned = cleanText(value);
      if (!cleaned) return "";
      if (cleaned.startsWith("//")) return `https:${cleaned}`;
      if (/^https?:\/\//i.test(cleaned)) return cleaned;
      return cleaned;
    };

    const buildNameHintsFromRaw = (raw) => {
      const text = decodeHtmlEntities(decodeEscapedText(String(raw || "")));
      const nameById = new Map();
      const pushPair = (id, nameValue) => {
        if (!id || !nameValue) return;
        if (nameById.has(id)) return;
        const cleaned = normalizeTitleText(nameValue);
        if (!cleaned) return;
        nameById.set(id, cleaned);
      };
      const pairRegexes = [
        { regex: /"itemId"\s*:\s*"?(\d{6,})"?[\s\S]{0,200}?"shortTitle"\s*:\s*"([^"]+)"/gi, id: 1, value: 2 },
        { regex: /"shortTitle"\s*:\s*"([^"]+)"[\s\S]{0,200}?"itemId"\s*:\s*"?(\d{6,})"?/gi, id: 2, value: 1 },
        { regex: /"itemId"\s*:\s*"?(\d{6,})"?[\s\S]{0,200}?"itemTitle"\s*:\s*"([^"]+)"/gi, id: 1, value: 2 },
        { regex: /"itemTitle"\s*:\s*"([^"]+)"[\s\S]{0,200}?"itemId"\s*:\s*"?(\d{6,})"?/gi, id: 2, value: 1 },
        { regex: /"itemId"\s*:\s*"?(\d{6,})"?[\s\S]{0,200}?"title"\s*:\s*"([^"]+)"/gi, id: 1, value: 2 },
        { regex: /"title"\s*:\s*"([^"]+)"[\s\S]{0,200}?"itemId"\s*:\s*"?(\d{6,})"?/gi, id: 2, value: 1 },
        { regex: /"itemId"\s*:\s*"?(\d{6,})"?[\s\S]{0,200}?"name"\s*:\s*"([^"]+)"/gi, id: 1, value: 2 },
        { regex: /"name"\s*:\s*"([^"]+)"[\s\S]{0,200}?"itemId"\s*:\s*"?(\d{6,})"?/gi, id: 2, value: 1 },
      ];
      pairRegexes.forEach(({ regex, id, value }) => {
        for (const match of text.matchAll(regex)) {
          pushPair(match[id], match[value]);
        }
      });
      return nameById;
    };

    const buildImageHintsFromRaw = (raw) => {
      const text = decodeHtmlEntities(decodeEscapedText(String(raw || "")));
      const imageById = new Map();
      const pushPair = (id, imageValue) => {
        if (!id || !imageValue) return;
        if (imageById.has(id)) return;
        const cleaned = normalizeImageHint(imageValue);
        if (!cleaned) return;
        imageById.set(id, cleaned);
      };
      const pairRegexes = [
        { regex: /"itemId"\s*:\s*"?(\d{6,})"?[\s\S]{0,200}?"itemWhiteImg"\s*:\s*"([^"]+)"/gi, id: 1, value: 2 },
        { regex: /"itemWhiteImg"\s*:\s*"([^"]+)"[\s\S]{0,200}?"itemId"\s*:\s*"?(\d{6,})"?/gi, id: 2, value: 1 },
        { regex: /"itemId"\s*:\s*"?(\d{6,})"?[\s\S]{0,200}?"itemImage"\s*:\s*"([^"]+)"/gi, id: 1, value: 2 },
        { regex: /"itemImage"\s*:\s*"([^"]+)"[\s\S]{0,200}?"itemId"\s*:\s*"?(\d{6,})"?/gi, id: 2, value: 1 },
        { regex: /"itemId"\s*:\s*"?(\d{6,})"?[\s\S]{0,200}?"picUrl"\s*:\s*"([^"]+)"/gi, id: 1, value: 2 },
        { regex: /"picUrl"\s*:\s*"([^"]+)"[\s\S]{0,200}?"itemId"\s*:\s*"?(\d{6,})"?/gi, id: 2, value: 1 },
        { regex: /"itemId"\s*:\s*"?(\d{6,})"?[\s\S]{0,200}?"imgUrl"\s*:\s*"([^"]+)"/gi, id: 1, value: 2 },
        { regex: /"imgUrl"\s*:\s*"([^"]+)"[\s\S]{0,200}?"itemId"\s*:\s*"?(\d{6,})"?/gi, id: 2, value: 1 },
        { regex: /"itemId"\s*:\s*"?(\d{6,})"?[\s\S]{0,200}?"image"\s*:\s*"([^"]+)"/gi, id: 1, value: 2 },
        { regex: /"image"\s*:\s*"([^"]+)"[\s\S]{0,200}?"itemId"\s*:\s*"?(\d{6,})"?/gi, id: 2, value: 1 },
      ];
      pairRegexes.forEach(({ regex, id, value }) => {
        for (const match of text.matchAll(regex)) {
          pushPair(match[id], match[value]);
        }
      });
      return imageById;
    };

    const getProductIdFromUrl = (value) => {
      if (!value) return "";
      const raw = String(value);
      try {
        const parsed = new URL(ensureUrl(raw));
        const idKeys = ["id", "item_id", "itemId", "num_iid", "nid"];
        for (const key of idKeys) {
          const idValue = parsed.searchParams.get(key);
          if (idValue) return idValue;
        }
        const pathMatch = parsed.pathname.match(/(?:item|i)\/?(\d{6,})/i);
        if (pathMatch) return pathMatch[1];
        const fileMatch = parsed.pathname.match(/(\d{6,})\.htm/i);
        if (fileMatch) return fileMatch[1];
      } catch (error) {
        // ignore URL parse errors
      }
      const match = raw.match(
        /[?&](?:id|item_id|itemId|num_iid|nid)=(\d{6,})/i
      );
      if (match) return match[1];
      const fallbackPath = raw.match(/(?:item|i)\/?(\d{6,})/i);
      if (fallbackPath) return fallbackPath[1];
      const fallbackFile = raw.match(/(\d{6,})\.htm/i);
      return fallbackFile ? fallbackFile[1] : "";
    };

    const buildPriceHintsFromRaw = (raw) => {
      const text = decodeHtmlEntities(decodeEscapedText(String(raw || "")));
      const priceById = new Map();
      const pushPair = (id, priceValue) => {
        if (!id) return;
        const parsed = parseNumberFromText(priceValue);
        if (!parsed) return;
        if (!priceById.has(id)) priceById.set(id, parsed);
      };
      const pairRegexes = [
        /"itemId"\s*:\s*"?(\d{6,})"?[\s\S]{0,160}?"price"\s*:\s*"?([0-9.]+)"/gi,
        /"price"\s*:\s*"?([0-9.]+)"?[\s\S]{0,160}?"itemId"\s*:\s*"?(\d{6,})"/gi,
        /"item_id"\s*:\s*"?(\d{6,})"?[\s\S]{0,160}?"price"\s*:\s*"?([0-9.]+)"/gi,
        /"price"\s*:\s*"?([0-9.]+)"?[\s\S]{0,160}?"item_id"\s*:\s*"?(\d{6,})"/gi,
        /"num_iid"\s*:\s*"?(\d{6,})"?[\s\S]{0,160}?"price"\s*:\s*"?([0-9.]+)"/gi,
        /"price"\s*:\s*"?([0-9.]+)"?[\s\S]{0,160}?"num_iid"\s*:\s*"?(\d{6,})"/gi,
        /"nid"\s*:\s*"?(\d{6,})"?[\s\S]{0,160}?"price"\s*:\s*"?([0-9.]+)"/gi,
        /"price"\s*:\s*"?([0-9.]+)"?[\s\S]{0,160}?"nid"\s*:\s*"?(\d{6,})"/gi,
      ];
      pairRegexes.forEach((regex, index) => {
        for (const match of text.matchAll(regex)) {
          const id = index % 2 === 0 ? match[1] : match[2];
          const priceValue = index % 2 === 0 ? match[2] : match[1];
          pushPair(id, priceValue);
        }
      });
      return priceById;
    };

    const extractProductLinkEntriesFromRaw = (raw) => {
      const text = decodeHtmlEntities(decodeEscapedText(String(raw || "")));
      const links = new Map();
      const ids = new Set();
      const priceById = buildPriceHintsFromRaw(raw);
      const nameById = buildNameHintsFromRaw(raw);
      const imageById = buildImageHintsFromRaw(raw);
      const hostRegex = /(taobao|tmall|tb\.cn)/i;
      const productRegex = /item\.htm/i;
      const idParamRegex = /[?&]id=\d{6,}/i;

      const pushEntry = (value) => {
        const cleaned = decodeHtmlEntities(decodeEscapedText(String(value || "")));
        const url = ensureUrl(cleaned);
        if (!url) return;
        if (!hostRegex.test(url)) return;
        const normalized = normalizeProductUrl(url);
        const candidate = normalized || url;
        if (!productRegex.test(candidate) && !idParamRegex.test(candidate)) return;
        if (links.has(candidate)) return;
        const id = getProductIdFromUrl(candidate);
        const urlPrice = parseUrlHints(candidate).price;
        const price = urlPrice || (id ? priceById.get(id) : null) || null;
        const name = id ? nameById.get(id) || "" : "";
        const image = id ? imageById.get(id) || "" : "";
        links.set(candidate, { price, name, image });
      };

      const urlRegex = /(https?:\/\/[^\s"'<>]+|\/\/[^\s"'<>]+)/gi;
      for (const match of text.matchAll(urlRegex)) {
        pushEntry(match[0]);
      }

      const hrefRegex = /href=["']([^"']+)["']/gi;
      for (const match of text.matchAll(hrefRegex)) {
        pushEntry(match[1]);
      }

      const idRegexes = [
        /item\.htm\?[^"'\s>]*id=(\d{6,})/gi,
        /["'](?:itemId|item_id|num_iid|nid)["']\s*[:=]\s*["']?(\d{6,})["']?/gi,
        /(?:itemId|item_id|num_iid|nid)=(\d{6,})/gi,
      ];
      idRegexes.forEach((regex) => {
        for (const match of text.matchAll(regex)) {
          if (match[1]) ids.add(match[1]);
        }
      });

      ids.forEach((id) => {
        const canonical = normalizeProductUrl(`https://item.taobao.com/item.htm?id=${id}`);
        const url = canonical || `https://item.taobao.com/item.htm?id=${id}`;
        if (links.has(url)) return;
        const price = priceById.get(id) || null;
        const name = nameById.get(id) || "";
        const image = imageById.get(id) || "";
        links.set(url, { price, name, image });
      });

      return Array.from(links.entries()).map(([url, meta]) => ({
        url,
        price: meta?.price ?? null,
        name: meta?.name ?? "",
        image: meta?.image ?? "",
      }));
    };

    const extractProductLinksFromRaw = (raw) => {
      return extractProductLinkEntriesFromRaw(raw).map((entry) => entry.url);
    };

    const parseBulkLinkEntries = (value) => {
      const entries = [];
      const priceByUrl = new Map();
      const nameByUrl = new Map();
      const imageByUrl = new Map();
      const sizeByUrl = new Map();
      const descByUrl = new Map();
      const raw = String(value || "").trim();
      if (!raw) return { links: entries, priceByUrl, nameByUrl, imageByUrl, sizeByUrl, descByUrl };
      const hasExplicitPrice = raw.includes("|") || raw.includes("\t");
      const urlRegex = /(https?:\/\/[^\s"'<>]+|\/\/[^\s"'<>]+)/gi;
      const looksLikeSizeList = (text) => {
        const cleaned = cleanText(text);
        if (!cleaned || cleaned.length > 40) return false;
        if (/https?:\/\//i.test(cleaned)) return false;
        if (/[^\w\s,/-]/.test(cleaned)) return false;
        const parts = cleaned.split(/[,/]+/).map((part) => part.trim()).filter(Boolean);
        if (!parts.length) return false;
        return parts.every((part) => /^[A-Za-z]{1,4}$/.test(part) || /^[0-9]{1,3}$/.test(part));
      };
      const extractImagesFromToken = (token) => {
        const urls = [];
        for (const match of token.matchAll(urlRegex)) {
          const url = match[0];
          if (!url) continue;
          if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)) urls.push(url);
        }
        return urls;
      };
      const parseLine = (line) => {
        const tokens = line
          .split("|")
          .flatMap((chunk) => chunk.split("\t"))
          .map((chunk) => chunk.trim())
          .filter(Boolean);
        const urlMatch = line.match(urlRegex);
        const urlToken = tokens.find((token) => /https?:\/\//i.test(token) || token.startsWith("//"));
        const url = ensureUrl(urlToken || (urlMatch ? urlMatch[0] : ""));
        if (!url) return null;
        let price = null;
        let name = "";
        let desc = "";
        let sizes = [];
        const images = [];
        tokens.forEach((token) => {
          if (token === urlToken) return;
          if (!price && !looksLikeSizeList(token) && !/^(size|尺码|kích cỡ)/i.test(token)) {
            const parsed = parseNumberFromText(token);
            if (parsed) {
              price = parsed;
              return;
            }
          }
          if (!desc && /^(desc|description|mô tả)/i.test(token)) {
            const cleaned = token.replace(/^(desc|description|mô tả)\s*[:：-]?\s*/i, "");
            if (cleaned) desc = cleaned;
            return;
          }
          if (!sizes.length && /^(size|尺码|kích cỡ)/i.test(token)) {
            const cleaned = token.replace(/^(size|尺码|kích cỡ)\s*[:：-]?\s*/i, "");
            sizes = cleaned
              .split(/[,/]+/)
              .map((item) => item.trim())
              .filter(Boolean);
            return;
          }
          if (!sizes.length && looksLikeSizeList(token)) {
            sizes = token
              .split(/[,/]+/)
              .map((item) => item.trim())
              .filter(Boolean);
            return;
          }
          if (!images.length) {
            const found = extractImagesFromToken(token);
            if (found.length) {
              images.push(...found);
              return;
            }
          }
          if (!name && token.length > 2 && !/https?:\/\//i.test(token)) {
            name = token;
          }
        });
        return { url, price, name, desc, sizes, images };
      };

      if (!hasExplicitPrice) {
        const matches = raw.match(urlRegex) || [];
        if (matches.length > 1) {
          matches.forEach((url) => {
            const normalized = normalizeProductUrl(url) || ensureUrl(url);
            if (!normalized) return;
            entries.push(normalized);
            const price = parseUrlHints(normalized).price;
            if (price) priceByUrl.set(normalizeProductUrl(normalized) || normalized, price);
          });
          return { links: entries, priceByUrl, nameByUrl, imageByUrl, sizeByUrl, descByUrl };
        }
      }

      const lines = raw
        .split(/\n+/)
        .flatMap((line) => line.split(/,(?=\s*(https?:\/\/|\/\/))/i))
        .map((line) => line.trim())
        .filter(Boolean);
      lines.forEach((line) => {
        const parsed = parseLine(line);
        if (!parsed) return;
        const normalized = normalizeProductUrl(parsed.url) || ensureUrl(parsed.url);
        if (!normalized) return;
        entries.push(normalized);
        let price = parsed.price || parseUrlHints(normalized).price;
        if (price) priceByUrl.set(normalizeProductUrl(normalized) || normalized, price);
        if (parsed.name) nameByUrl.set(normalizeProductUrl(normalized) || normalized, parsed.name);
        if (parsed.desc) descByUrl.set(normalizeProductUrl(normalized) || normalized, parsed.desc);
        if (parsed.sizes?.length) sizeByUrl.set(normalizeProductUrl(normalized) || normalized, parsed.sizes);
        if (parsed.images?.length) imageByUrl.set(normalizeProductUrl(normalized) || normalized, parsed.images);
      });
      return { links: entries, priceByUrl, nameByUrl, imageByUrl, sizeByUrl, descByUrl };
    };

    const parseBulkLinks = (value) =>
      parseBulkLinkEntries(value).links;

    const parseManualLinkHints = (value) => {
      const parsed = parseBulkLinkEntries(value || "");
      const link = parsed.links[0] || "";
      const normalized = link ? normalizeProductUrl(link) || link : "";
      if (!normalized) return { url: "", price: null, name: "", desc: "", sizes: [], images: [] };
      return {
        url: normalized,
        price: parsed.priceByUrl.get(normalized) || null,
        name: parsed.nameByUrl.get(normalized) || "",
        desc: parsed.descByUrl.get(normalized) || "",
        sizes: parsed.sizeByUrl.get(normalized) || [],
        images: parsed.imageByUrl.get(normalized) || [],
      };
    };

    const mergeHintMap = (target, source, links) => {
      if (!target || !source || !source.size || !Array.isArray(links)) return;
      links.forEach((link) => {
        const normalized = normalizeProductUrl(link) || link;
        if (target.has(normalized)) return;
        if (source.has(normalized)) target.set(normalized, source.get(normalized));
      });
    };

    const hydrateBulkHintsFromRaw = (
      raw,
      links,
      priceByUrl,
      nameByUrl,
      imageByUrl
    ) => {
      const trimmed = String(raw || "").trim();
      if (!trimmed || !Array.isArray(links) || !links.length) return;
      const nameHints = buildNameHintsFromRaw(trimmed);
      const imageHints = buildImageHintsFromRaw(trimmed);
      const priceHints = buildPriceHintsFromRaw(trimmed);
      links.forEach((link) => {
        const normalized = normalizeProductUrl(link) || link;
        const id = getProductIdFromUrl(normalized);
        if (!id) return;
        if (nameByUrl && !nameByUrl.has(normalized) && nameHints.has(id)) {
          nameByUrl.set(normalized, nameHints.get(id));
        }
        if (imageByUrl && !imageByUrl.has(normalized) && imageHints.has(id)) {
          imageByUrl.set(normalized, imageHints.get(id));
        }
        if (priceByUrl && !priceByUrl.has(normalized) && priceHints.has(id)) {
          priceByUrl.set(normalized, priceHints.get(id));
        }
      });
    };

    const resolveCacheEndpoint = (settings) => {
      const raw = settings.syncEndpoint || settings.importEndpoint || "";
      if (!raw) return "";
      try {
        const url = new URL(raw);
        url.pathname = "/cache-image";
        url.search = "";
        if (settings.syncKey) url.searchParams.set("key", settings.syncKey);
        return url.toString();
      } catch (error) {
        return "";
      }
    };

    const cacheProductImages = async (urls, settings) => {
      const endpoint = resolveCacheEndpoint(settings);
      if (!endpoint || !Array.isArray(urls) || !urls.length) return urls;
      const candidates = [];
      const candidateIndexes = [];
      urls.forEach((value, index) => {
        if (!value) return;
        const raw = String(value).trim();
        if (!raw) return;
        if (raw.startsWith("data:")) return;
        if (raw.startsWith("assets/")) return;
        if (raw.includes("/media/")) return;
        candidates.push(raw);
        candidateIndexes.push(index);
      });
      if (!candidates.length) return urls;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: candidates }),
        });
        if (!response.ok) return urls;
        const payload = await response.json();
        if (Array.isArray(payload?.urls) && payload.urls.length) {
          const result = [...urls];
          candidateIndexes.forEach((idx, i) => {
            result[idx] = payload.urls[i] || candidates[i] || result[idx];
          });
          return result.filter(Boolean);
        }
      } catch (error) {
        return urls;
      }
      return urls;
    };

    const describeImageLabel = (src, index = 0) => {
      const text = extractTextFromUrl(src);
      const colorHint = guessColorFromText(text);
      if (colorHint) return `Màu ${colorHint}`;
      return `Ảnh ${index + 1}`;
    };

    const measureImageDimensions = (src, timeoutDuration = 6000) =>
      new Promise((resolve) => {
        if (!src || typeof window === "undefined" || typeof window.Image === "undefined") {
          resolve(null);
          return;
        }
        const image = new window.Image();
        let settled = false;
        const finalize = (result) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        image.onload = () => finalize({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => finalize(null);
        image.decoding = "async";
        image.src = src;
        setTimeout(() => finalize(null), timeoutDuration);
      });

    const measureImageSizes = async (urls, options = {}) => {
      const { limit = 5, timeout = 6000 } = options;
      if (!Array.isArray(urls) || !urls.length || typeof window === "undefined") return [];
      const unique = Array.from(
        new Set(
          urls
            .map((value) => ensureUrl(value) || value)
            .filter((value) => value)
            .slice(0, limit)
        )
      );
      if (!unique.length) return [];
      const tasks = unique.map(async (value, index) => {
        const measurement = await measureImageDimensions(value, timeout);
        if (!measurement) return null;
        return {
          src: value,
          width: measurement.width,
          height: measurement.height,
          label: describeImageLabel(value, index),
        };
      });
      const results = await Promise.all(tasks);
      return results.filter(Boolean);
    };

    const QUALITY_RULES = {
      minRating: 4,
      minPositiveRate: 0.8,
      minRatingCount: 10,
      minSales: 30,
    };

    const evaluateQuality = (data) => {
      const rating = Number(data?.rating);
      const ratingCount = Number(data?.ratingCount);
      let positiveRate = Number(data?.positiveRate);
      const soldCount = Number(data?.soldCount);

      const hasRating = !Number.isNaN(rating) && rating > 0;
      const hasRatingCount = !Number.isNaN(ratingCount) && ratingCount > 0;
      if (!Number.isNaN(positiveRate) && positiveRate > 1) positiveRate /= 100;
      const hasPositiveRate = !Number.isNaN(positiveRate) && positiveRate > 0;
      const hasSold = !Number.isNaN(soldCount) && soldCount > 0;

      const ratingOk = hasRating && rating >= QUALITY_RULES.minRating;
      const positiveOk = hasPositiveRate
        ? positiveRate >= QUALITY_RULES.minPositiveRate
        : hasRatingCount
        ? ratingCount >= QUALITY_RULES.minRatingCount
        : false;
      const salesOk = hasSold
        ? soldCount >= QUALITY_RULES.minSales
        : hasRatingCount
        ? ratingCount >= QUALITY_RULES.minSales
        : false;

      const reasons = [];
      if (!hasRating) reasons.push("thiếu điểm đánh giá");
      else if (!ratingOk) reasons.push(`điểm < ${QUALITY_RULES.minRating} sao`);

      if (hasPositiveRate) {
        if (!positiveOk) reasons.push("tỉ lệ bình luận tích cực thấp");
      } else if (hasRatingCount) {
        if (!positiveOk) reasons.push(`bình luận < ${QUALITY_RULES.minRatingCount}`);
      } else {
        reasons.push("thiếu dữ liệu bình luận");
      }

      if (hasSold) {
        if (!salesOk) reasons.push(`mua hàng < ${QUALITY_RULES.minSales}`);
      } else if (hasRatingCount) {
        if (!salesOk) reasons.push(`giao dịch < ${QUALITY_RULES.minSales}`);
      } else {
        reasons.push("thiếu dữ liệu mua hàng");
      }

      return {
        passed: ratingOk && positiveOk && salesOk,
        rating: hasRating ? rating : null,
        ratingCount: hasRatingCount ? ratingCount : null,
        positiveRate: hasPositiveRate ? positiveRate : null,
        soldCount: hasSold ? soldCount : null,
        reasons,
      };
    };

    const extractFromHtml = (html, sourceUrl, blocked = false) => {
      const raw = String(html || "").trim();
      let jsonExtract = {
        name: "",
        desc: "",
        price: null,
        images: [],
        sizes: [],
        colors: [],
      };
      if (raw.startsWith("{") || raw.startsWith("[")) {
        try {
          const parsed = JSON.parse(raw);
          jsonExtract = extractFromJsonPayload(parsed);
        } catch (error) {
          // ignore JSON parse errors
        }
      }
      const decodedHtml = decodeEscapedText(raw);
      const doc = new DOMParser().parseFromString(html, "text/html");
      const isBlocked = blocked || BLOCKED_HTML_RE.test(html);
      const jsonLd = parseJsonLdProduct(doc);
      const scriptData = parseScriptData(html);
      const htmlQuality = parseQualitySignals(html);
      const meta = (selector) => doc.querySelector(selector)?.getAttribute("content")?.trim();
      const titleDom =
        doc.querySelector("[itemprop='name']")?.getAttribute("content") ||
        doc.querySelector(".tb-main-title")?.getAttribute("data-title") ||
        doc.querySelector(".tb-main-title")?.textContent ||
        doc.querySelector(".item-title")?.textContent ||
        doc.querySelector("h1")?.textContent ||
        "";
      const titleRaw = pickFirst(
        jsonExtract.name,
        jsonLd.name,
        meta('meta[property="og:title"]'),
        meta('meta[name="twitter:title"]'),
        meta('meta[name="title"]'),
        titleDom,
        scriptData.title,
        doc.title
      );
      const descDom =
        doc.querySelector("[itemprop='description']")?.getAttribute("content") ||
        doc.querySelector(".tb-subtitle")?.textContent ||
        "";
      const descRaw = pickFirst(
        jsonExtract.desc,
        jsonLd.desc,
        meta('meta[property="og:description"]'),
        meta('meta[name="description"]'),
        descDom,
        scriptData.subtitle,
        scriptData.desc
      );
      const imgDom =
        doc.querySelector("#J_ImgBooth")?.getAttribute("data-src") ||
        doc.querySelector("#J_ImgBooth")?.getAttribute("src") ||
        doc.querySelector(".tb-main-pic img")?.getAttribute("data-src") ||
        doc.querySelector(".tb-main-pic img")?.getAttribute("src") ||
        doc.querySelector("img")?.getAttribute("src") ||
        "";
      const imageRaw = pickFirst(
        jsonExtract.images[0],
        jsonLd.image,
        meta('meta[property="og:image"]'),
        meta('meta[name="twitter:image"]'),
        scriptData.pic,
        scriptData.images[0],
        imgDom
      );
      const priceRaw = pickFirst(
        jsonExtract.price,
        jsonLd.price,
        meta('meta[property="product:price:amount"]'),
        meta('meta[property="og:price:amount"]'),
        meta('meta[property="og:price"]')
      );
      const priceCandidates = [
        priceRaw,
        jsonExtract.price,
        scriptData.price,
        html.match(/"itemPrice"\s*:\s*"([0-9.]+)"/)?.[1],
        html.match(/"itemPrice"\s*:\s*([0-9.]+)/)?.[1],
        html.match(/"price"\s*:\s*"([0-9.]+)"/)?.[1],
        html.match(/"price"\s*:\s*([0-9.]+)/)?.[1],
        html.match(/"defaultItemPrice"\s*:\s*"([0-9.]+)"/)?.[1],
        html.match(/data-price="([0-9.]+)"/)?.[1],
      ];
      const price = priceCandidates.map(parseNumberFromText).find((value) => value);
      const sizes = Array.from(
        new Set([
          ...jsonExtract.sizes,
          ...parseSkuSizes(html),
          ...parseSkuSizes(decodedHtml),
          ...parseSizesFromDom(doc),
        ])
      );
      const ratingCandidates = [jsonExtract.rating, jsonLd.rating, htmlQuality.rating]
        .map((value) => (typeof value === "number" ? value : parseNumberFromText(value)))
        .filter((value) => value && value <= 5);
      const rating = ratingCandidates.length ? Math.max(...ratingCandidates) : null;
      const ratingCountCandidates = [
        jsonExtract.ratingCount,
        jsonLd.ratingCount,
        htmlQuality.ratingCount,
      ]
        .map((value) => parseInt(value, 10))
        .filter((value) => !Number.isNaN(value) && value > 0);
      const ratingCount = ratingCountCandidates.length
        ? Math.max(...ratingCountCandidates)
        : null;
      const positiveRateCandidates = [jsonExtract.positiveRate, htmlQuality.positiveRate]
        .map((value) => {
          const parsed = parseNumberFromText(value);
          if (!parsed) return null;
          return parsed > 1 ? parsed / 100 : parsed;
        })
        .filter((value) => value && value <= 1);
      const positiveRate = positiveRateCandidates.length
        ? Math.max(...positiveRateCandidates)
        : null;
      const soldCountCandidates = [jsonExtract.soldCount, htmlQuality.soldCount]
        .map((value) => parseInt(value, 10))
        .filter((value) => !Number.isNaN(value) && value > 0);
      const soldCount = soldCountCandidates.length ? Math.max(...soldCountCandidates) : null;
      const colors = Array.from(
        new Set([
          ...(jsonExtract.colors || []),
          ...parseColorValues(doc),
          ...(scriptData.colors || []),
        ])
      );
      const cleanTitle = cleanText(titleRaw).replace(/\s*-\s*(Taobao|Tmall).*/i, "");
      const safeTitle = isBlocked && isBlockedText(cleanTitle) ? "" : cleanTitle;
      const cleanDesc = cleanText(descRaw);
      const safeDesc = isBlocked && isBlockedText(cleanDesc) ? "" : cleanDesc;
      const images = isBlocked
        ? []
        : mergeImages(jsonExtract.images, scriptData.images || [], imageRaw ? [imageRaw] : [])
            .map((src) => normalizeImageUrl(src, sourceUrl))
            .filter(Boolean);
      return {
        name: safeTitle,
        desc: safeDesc,
        image: isBlocked ? "" : normalizeImageUrl(imageRaw, sourceUrl),
        price,
        sizes,
        images,
        colors,
        rating,
        ratingCount,
        positiveRate,
        soldCount,
      };
    };

    const extractRawHintValue = (raw, regexes) => {
      if (!raw) return "";
      const text = decodeHtmlEntities(decodeEscapedText(String(raw)));
      for (const regex of regexes) {
        const match = regex.exec(text);
        if (!match) continue;
        for (let index = 1; index < match.length; index += 1) {
          const candidate = cleanText(match[index]);
          if (candidate) return candidate;
        }
      }
      return "";
    };

    const extractRawHintNumber = (raw, regexes, parser = parseNumberFromText) => {
      if (!raw) return null;
      const text = decodeHtmlEntities(decodeEscapedText(String(raw)));
      for (const regex of regexes) {
        const match = regex.exec(text);
        if (!match) continue;
        for (let index = 1; index < match.length; index += 1) {
          const candidate = parser(match[index]);
          if (candidate) return candidate;
        }
      }
      return null;
    };

    const extractRawColorHints = (raw) => {
      if (!raw) return [];
      const text = decodeHtmlEntities(decodeEscapedText(String(raw)));
      const matches = [];
      const regexes = [
        /["'](?:color|colour|colorName|colorway)["']\s*:\s*["']([^"']{1,80})["']/gi,
        /<span[^>]+class=["'][^"']*color[^"']*["'][^>]*>([^<]+)<\/span>/gi,
        /<div[^>]+class=["'][^"']*color[^"']*["'][^>]*>([^<]+)<\/div>/gi,
        /"màu"\s*:\s*["']([^"']{1,80})["']/gi,
        /"colorList"\s*:\s*\[([^\]]+)\]/gi,
      ];
      regexes.forEach((regex) => {
        for (const match of text.matchAll(regex)) {
          const value = match[1] || match[2] || "";
          const cleaned = cleanText(value);
          if (cleaned) matches.push(cleaned);
        }
      });
      return Array.from(new Set(matches));
    };

    const enhanceExtractedDataWithRawHints = (raw, extracted) => {
      if (!raw || !extracted) return extracted;
      if (!extracted.desc) {
        const desc = extractRawHintValue(raw, [
          /"description"\s*:\s*"([^"]+)"/i,
          /"desc"\s*:\s*"([^"]+)"/i,
          /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
          /<p[^>]+class=["'][^"']*(desc|description)[^"']*["'][^>]*>([^<]+)/i,
        ]);
        if (desc) extracted.desc = desc;
      }
      if (!extracted.colors?.length) {
        const colorHints = extractRawColorHints(raw);
        if (colorHints.length) extracted.colors = colorHints;
      }
      if (!extracted.rating) {
        const rating = extractRawHintNumber(raw, [
          /"ratingValue"\s*:\s*"([0-9.]+)"/i,
          /"rating"\s*:\s*"([0-9.]+)"/i,
          /"avgStar"\s*:\s*"([0-9.]+)"/i,
          /"rateScore"\s*:\s*"([0-9.]+)"/i,
        ]);
        if (rating) extracted.rating = rating;
      }
      if (!extracted.ratingCount) {
        const count = extractRawHintNumber(
          raw,
          [
            /"reviewCount"\s*:\s*"?(\\d+)"/i,
            /"ratingCount"\s*:\s*"?(\\d+)"/i,
            /"commentCount"\s*:\s*"?(\\d+)"/i,
            /"totalComments"\s*:\s*"?(\\d+)"/i,
          ],
          (value) => {
            const parsed = Number(String(value).replace(/[^0-9]/g, ""));
            return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
          }
        );
        if (count) extracted.ratingCount = count;
      }
      if (!extracted.positiveRate) {
        const positive = extractRawHintNumber(raw, [
          /"goodRatePercent"\s*:\s*"([0-9.]+)"/i,
          /"goodRate"\s*:\s*"([0-9.]+)"/i,
          /"positiveRate"\s*:\s*"([0-9.]+)"/i,
        ]);
        if (positive) extracted.positiveRate = positive;
      }
      return extracted;
    };

    const fetchProductHtml = async (url) => {
      const parsed = new URL(url);
      const protocol = parsed.protocol.replace(":", "");
      const proxyUrl = `https://r.jina.ai/${protocol}://${parsed.host}${parsed.pathname}${parsed.search}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("fetch_failed");
      const html = await response.text();
      const blocked = BLOCKED_HTML_RE.test(html);
      return { html, blocked };
    };

    const resolveRelativeUrl = (raw, base) => {
      if (!raw) return "";
      try {
        return new URL(raw, base || undefined).toString();
      } catch (error) {
        return ensureUrl(raw);
      }
    };

    const extractVideoHintsFromHtml = (html, baseUrl) => {
      if (!html) return [];
      const sources = new Set();
      const addSource = (value) => {
        const resolved = resolveRelativeUrl(value, baseUrl);
        if (resolved) sources.add(resolved);
      };
      const metaRegex =
        /<meta[^>]*(?:property|name)=["'](?:og:video(?::[a-z]+)?|og:video:url|og:video:secure_url|twitter:player:stream|twitter:player)["'][^>]*content=["']([^"']+)["']/gi;
      let match;
      while ((match = metaRegex.exec(html))) {
        addSource(match[1]);
      }
      const videoTagRegex = /<video[^>]*src=["']([^"']+)["']/gi;
      while ((match = videoTagRegex.exec(html))) {
        addSource(match[1]);
      }
      const sourceTagRegex = /<source[^>]*src=["']([^"']+)["']/gi;
      while ((match = sourceTagRegex.exec(html))) {
        addSource(match[1]);
      }
      return Array.from(sources);
    };

    const fetchVideoHintsFromLink = async (url) => {
      if (!url) return [];
      try {
        const { html, blocked } = await fetchProductHtml(url);
        if (blocked) return [];
        return extractVideoHintsFromHtml(html, url);
      } catch (error) {
        console.warn("Video extraction failed:", error);
        return [];
      }
    };

    const fetchImportedProduct = async (url, endpoint, cookie) => {
      const payload = { url };
      if (cookie) payload.cookie = cookie;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("import_failed");
      const responseBody = await response.json();
      if (responseBody?.ok === false) {
        throw new Error(responseBody.message || "import_failed");
      }
      if (responseBody?.data) {
        const sourceUrl = responseBody.url || url;
        return {
          ...responseBody.data,
          sourceUrl,
          _blocked: Boolean(responseBody.blocked),
          _warnings: responseBody.warnings || [],
        };
      }
      if (responseBody?.name) {
        const sourceUrl = responseBody.url || url;
        return {
          ...responseBody,
          sourceUrl,
          _blocked: Boolean(responseBody.blocked),
          _warnings: responseBody.warnings || [],
        };
      }
      throw new Error("import_failed");
    };

    const resetForm = () => {
      activeProductId = "";
      if (autoLink) autoLink.value = "";
      if (autoPaste) autoPaste.value = "";
      if (autoOpen) autoOpen.href = "#";
      importedImages = [];
      importedMeta = null;
      productName.value = "";
      productDesc.value = "";
      productPrice.value = "";
      productCategory.value = "lifestyle";
      productSource.value = "web";
      if (productLink) productLink.value = "";
      productTags.value = "";
      productSizes.value = "";
      if (productImage) productImage.value = "";
      if (productImages) productImages.value = "";
      if (productVideo) productVideo.value = "";
      if (productColor) productColor.value = "";
      if (productDefaultSize) productDefaultSize.value = "";
      if (productDefaultStock) productDefaultStock.value = "3";
      if (productHidden) productHidden.checked = false;
      renderImagePreview("");
      setAutoHint("Nhập link và bấm thử lấy dữ liệu.");
      setPalette(DEFAULT_PALETTE);
      clearImportPreview();
      if (productName) {
        productName.focus();
        productName.select();
      }
    };

    const fillProductForm = (product) => {
      if (!product) return;
      activeProductId = product.id;
      productName.value = product.name || "";
      productDesc.value = product.desc || "";
      productPrice.value = product.basePrice || "";
      productCategory.value = product.category || "lifestyle";
      productSource.value = product.source || "web";
      if (productLink) productLink.value = product.sourceUrl || product.link || "";
      productTags.value = (product.tags || []).join(", ");
      productSizes.value = [...(product.sizesText || []), ...(product.sizesNum || [])].join(",");
      if (productImage) productImage.value = product.image || "";
      if (productImages) productImages.value = (product.images || []).join(", ");
      if (productVideo) productVideo.value = product.video || product.videoUrl || "";
      if (productHidden) productHidden.checked = Boolean(product.hidden);
      importedImages = getProductImages(product);
      importedMeta = {
        rating: product.rating ?? null,
        ratingCount: product.ratingCount ?? null,
        positiveRate: product.positiveRate ?? null,
        soldCount: product.soldCount ?? null,
      };
      renderImagePreview(productImage ? productImage.value.trim() : "");
      if (productColor) productColor.value = product.defaultColor || "";
      if (productDefaultSize) productDefaultSize.value = product.defaultSize || "";
      const storedDefaultStock = product.defaultStock ?? getDefaultStockValue();
      if (productDefaultStock) productDefaultStock.value = storedDefaultStock;
      setPalette(product.palette || DEFAULT_PALETTE);
      renderImportPreview(
        {
          name: product.name,
          price: product.basePrice,
          sizes: Array.from(
            new Set([...(product.sizesText || []), ...(product.sizesNum || [])])
          ),
          colors: product.palette || [],
          images: product.images || [],
          video: product.video || product.videoUrl || "",
          videos: Array.isArray(product.videoHints) ? product.videoHints : [],
        },
        "Đang hiển thị dữ liệu sản phẩm"
      );
    };

    const parseSizes = () =>
      productSizes.value
        .split(",")
        .map((size) => size.trim())
        .filter(Boolean);

    const applyExtractedData = (extracted, options = {}) => {
      const { force = true, note = "", qualityGate = false } = options;
      if (qualityGate) {
        const quality = evaluateQuality(extracted);
        if (!quality.passed) {
          importedMeta = null;
          const reasonText = quality.reasons.join(", ");
          setAutoHint(
            `${note}Không đạt tiêu chí lọc: ${reasonText || "thiếu dữ liệu đánh giá."}`
          );
          return { fields: [], missing: [], blocked: true, quality };
        }
      }
      importedMeta = {
        rating: extracted.rating ?? null,
        ratingCount: extracted.ratingCount ?? null,
        positiveRate: extracted.positiveRate ?? null,
        soldCount: extracted.soldCount ?? null,
      };
      const fields = [];
      const applyValue = (el, value, label, applyForce = force) => {
        if (!el || !value) return;
        if (applyForce || !el.value) {
          el.value = value;
          fields.push(label);
        }
      };
      const applyDefaultField = (el, value, label, applyForce = force) => {
        if (!el || !value) return;
        if (applyForce || !el.value) {
          el.value = value;
          fields.push(label);
        }
      };
      applyValue(productName, extracted.name, "tên");
      applyValue(productDesc, extracted.desc, "mô tả", false);
      applyValue(productPrice, extracted.price, "giá");
      applyValue(
        productLink,
        extracted.sourceUrl || extracted.link,
        "link",
        false
      );
      if (Array.isArray(extracted.images) && extracted.images.length) {
        importedImages = extracted.images;
      } else if (extracted.image) {
        importedImages = [extracted.image];
      }
      if (productImage && extracted.image) {
        if (force || !productImage.value) {
          productImage.value = extracted.image;
          renderImagePreview(extracted.image);
          fields.push("ảnh");
        }
      }
      if (productImages && importedImages.length) {
        const existing = parseImageList(productImages.value);
        const merged = mergeImages(existing, importedImages);
        if (force || !productImages.value) {
          productImages.value = merged.join(", ");
          fields.push("ảnh");
          renderImagePreview(productImage ? productImage.value.trim() : "");
        }
      }
      if (extracted.sizes?.length) {
        if (force || !productSizes.value) {
          productSizes.value = extracted.sizes.join(",");
          fields.push("size");
        }
      }
      const suggestedColor =
        extracted.defaultColor ||
        extracted.colors?.[0]?.name ||
        extracted.variants?.find((variant) => variant.props?.color)?.props?.color ||
        "";
      const suggestedSize =
        extracted.defaultSize ||
        extracted.sizes?.[0] ||
        extracted.variants?.find((variant) => variant.props?.size)?.props?.size ||
        "";
      applyDefaultField(productColor, suggestedColor, "màu mặc định");
      applyDefaultField(productDefaultSize, suggestedSize, "size mặc định");
      if (productName.value) {
        productCategory.value = inferCategoryFromName(productName.value);
      }
      if (productTags) {
        const currentTags = productTags.value
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
        const autoTags = extracted.source === "taobao_link" ? ["taobao", "auto"] : ["auto"];
        const merged = Array.from(new Set([...currentTags, ...autoTags]));
        productTags.value = merged.join(", ");
      }
      const missing = [];
      if (!productName.value) missing.push("tên");
      if (!productPrice.value) missing.push("giá");
      const hasImage =
        (productImage && productImage.value) ||
        (productImages && productImages.value.trim());
      if (!hasImage) missing.push("ảnh");
      if (!productSizes.value) missing.push("size");
      const missingText = missing.length ? ` Thiếu: ${missing.join(", ")}.` : "";
      const baseText = fields.length ? `Đã lấy: ${fields.join(", ")}.` : "Chưa lấy được dữ liệu.";
      const previewNote = `${note}${baseText}${missingText}`.trim();
      setAutoHint(previewNote);
      const colorHints = (Array.isArray(extracted.colors) ? extracted.colors : [])
        .map((item) =>
          typeof item === "string" ? item : item?.name || item?.text || item?.value || ""
        )
        .filter(Boolean);
      if (colorHints.length) {
        setPalette(colorHints.slice(0, 8));
      }
      renderImportPreview(extracted, previewNote);
      return { fields, missing };
    };

    const getNextProductId = (items) => {
      const numbers = items
        .map((item) => Number(String(item.id).replace(/\\D/g, "")))
        .filter((value) => !Number.isNaN(value));
      const max = numbers.length ? Math.max(...numbers) : DEFAULT_PRODUCTS.length;
      const current = Number(store.getItem(KEYS.productSeq));
      const seed = Number.isNaN(current) || current <= max ? max + 1 : current;
      store.setItem(KEYS.productSeq, String(seed + 1));
      return `P${String(seed).padStart(3, "0")}`;
    };

    const getFilteredProducts = () => {
      const query = productSearch.value.trim().toLowerCase();
      let items = getProducts();
      if (query) {
        items = items.filter((product) => {
          const tagsText = (product.tags || []).join(" ").toLowerCase();
          return (
            product.id.toLowerCase().includes(query) ||
            product.name.toLowerCase().includes(query) ||
            tagsText.includes(query)
          );
        });
      }
      const sort = productSort.value;
      if (sort === "name") {
        items = [...items].sort((a, b) => a.name.localeCompare(b.name));
      }
      if (sort === "price-asc") {
        items = [...items].sort((a, b) => a.basePrice - b.basePrice);
      }
      if (sort === "price-desc") {
        items = [...items].sort((a, b) => b.basePrice - a.basePrice);
      }
      return items;
    };

    const renderProductList = () => {
      const items = getFilteredProducts();
      const settings = getSettings();
      if (!items.length) {
        productList.innerHTML = "<div class=\"card\">Chưa có sản phẩm.</div>";
        refreshAdminInsights();
        return;
      }
      productList.innerHTML = items
        .map((product) => {
          const images = getProductImages(product);
          const thumb = images[0];
          const fallback = (product.name || "SP").slice(0, 2).toUpperCase();
          const tags = (product.tags || []).slice(0, 2).map((tag) => `<span class="tag">${tag}</span>`).join("");
          const priced = applyProductFee(product.basePrice);
          const stockValues = getProductStockValues(product);
          const minStock = stockValues.length ? Math.min(...stockValues) : null;
          const stockTag =
            minStock !== null
              ? `<span class="tag">Tồn ${formatNumber(minStock)}</span>`
              : `<span class="tag warning">Kho chưa cập nhật</span>`;
          const lowStockTag = isProductLowStock(product) ? `<span class="tag warning">Low stock</span>` : "";
          const updatedTag = product.updatedAt
            ? `<span class="tag">Cập nhật ${formatDateTime(product.updatedAt)}</span>`
            : "";
          const imageSizes = Array.isArray(product.imageSizes) ? product.imageSizes : [];
          const imageSizeTag =
            imageSizes.length && imageSizes[0]?.width && imageSizes[0]?.height
              ? `<span class="tag">Ảnh ${imageSizes.length} · ${imageSizes[0].width}×${imageSizes[0].height}</span>`
              : imageSizes.length
              ? `<span class="tag">Ảnh ${imageSizes.length}</span>`
              : "";
          const videoTag = product.video || product.videoUrl ? `<span class="tag">Video</span>` : "";
          return `
            <div class="admin-item ${activeProductId === product.id ? "active" : ""}" data-product-id="${product.id}">
              <div class="admin-item-thumb">${
                thumb ? `<img src="${thumb}" alt="${product.name}" />` : `<span class="tag">${fallback}</span>`
              }</div>
              <div class="admin-item-body">
                <div class="admin-item-title">${product.name}</div>
                <div class="admin-item-meta">
                  <span class="tag">${product.id}</span>
                  <span class="tag">+25% ${formatCurrency(priced, settings.baseCurrency)}</span>
                  <span class="tag">${product.category || "-"}</span>
                  <span class="tag">${sourceLabel(product.source)}</span>
                  ${product.hidden ? '<span class="tag">Ẩn</span>' : ""}
                  ${tags}
                  ${lowStockTag}
                  ${stockTag}
                  ${updatedTag}
                  ${imageSizeTag}
                  ${videoTag}
                </div>
              </div>
              <div class="admin-item-actions">
                <button class="btn ghost small" data-action="edit" type="button">Sửa</button>
                <button class="btn ghost small" data-action="toggle" type="button">${
                  product.hidden ? "Hiện" : "Ẩn"
                }</button>
                <button class="btn ghost small" data-action="remove" type="button">Xoá</button>
              </div>
            </div>
          `;
        })
        .join("");
      refreshAdminInsights();
    };

    const updateProductStore = (callback) => {
      const products = getProducts();
      const index = products.findIndex((item) => item.id === activeProductId);
      if (index < 0) return;
      callback(products, index);
      setProducts(products);
      renderProductList();
    };

    productList.addEventListener("click", (event) => {
      const item = event.target.closest("[data-product-id]");
      if (!item) return;
      const id = item.dataset.productId;
      const actionBtn = event.target.closest("button[data-action]");
      const products = getProducts();
      const product = products.find((entry) => entry.id === id);
      if (!product) return;
      if (!actionBtn) {
        fillProductForm(product);
        renderProductList();
        return;
      }
      const action = actionBtn.dataset.action;
      if (action === "edit") {
        fillProductForm(product);
        renderProductList();
        return;
      }
      if (action === "toggle") {
        product.hidden = !product.hidden;
        product.updatedAt = Date.now();
        setProducts(products);
        renderProductList();
        if (activeProductId === id) fillProductForm(product);
        return;
      }
      if (action === "remove") {
        const confirmMessage = product.name
          ? `Bạn có chắc muốn xoá vĩnh viễn "${product.name}"?`
          : "Bạn có chắc muốn xoá vĩnh viễn sản phẩm này?";
        if (!window.confirm(confirmMessage)) return;
        const index = products.findIndex((entry) => entry.id === id);
        if (index >= 0) {
          products.splice(index, 1);
        }
        addDeletedProductId(id);
        setProducts(products);
        if (activeProductId === id) resetForm();
        renderProductList();
        setAutoHint("Đã xoá, sản phẩm không còn xuất hiện trong danh sách chính.");
        showOrderNotice(`Đã xoá sản phẩm ${product.name || product.id || id}.`);
        return;
      }
    });

    if (productImage) {
      renderImagePreview(productImage.value.trim());
      requestImportImageMeasurements(collectImageInputs());
      productImage.addEventListener("input", () => {
        const value = productImage.value.trim();
        renderImagePreview(value);
        requestImportImageMeasurements(collectImageInputs());
      });
    }

    if (productImages) {
      productImages.addEventListener("input", () => {
        renderImagePreview(productImage ? productImage.value.trim() : "");
        requestImportImageMeasurements(collectImageInputs());
      });
    }

    if (productVideo) {
      productVideo.addEventListener("input", () => {
        refreshImportPreviewVideo();
      });
    }

    if (productSearch) productSearch.addEventListener("input", renderProductList);
    if (productSort) productSort.addEventListener("change", renderProductList);

    if (autoLink) {
      autoLink.addEventListener("input", () => {
        const previewUrl = ensureUrl(autoLink.value);
        if (previewUrl && autoOpen) autoOpen.href = previewUrl;
      });
      autoLink.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (autoFill) autoFill.click();
        }
      });
    }

    if (autoFill) {
      autoFill.addEventListener("click", async () => {
        const raw = autoLink.value.trim();
        if (!raw) {
          setAutoHint("Vui lòng nhập link sản phẩm.");
          return;
        }
        const manualHints = parseManualLinkHints(raw);
        const hintSourceUrl = ensureUrl(raw);
        const urlHints = parseUrlHints(hintSourceUrl);
        const normalized = normalizeProductUrl(manualHints.url || raw);
        if (!normalized) {
          setAutoHint("Link không hợp lệ.");
          return;
        }
        autoLink.value = normalized;
        if (productLink) productLink.value = normalized;
        if (autoOpen) autoOpen.href = hintSourceUrl || normalized;
        setAutoHint("Đang phân tích link...");
        updateImportPreviewVideoHints([]);

        const source = inferSourceFromUrl(normalized);
        if (productSource) productSource.value = source;

        const settings = getSettings();
        const importEndpoint = settings.importEndpoint?.trim();
        const importCookie = settings.importCookie?.trim();
        if (importEndpoint) {
          setAutoHint("Đang lấy dữ liệu từ crawler...");
          try {
            const imported = await fetchImportedProduct(
              normalized,
              importEndpoint,
              importCookie
            );
            const { _blocked, ...importedData } = imported || {};
            if (!importedData.price && urlHints.price) {
              importedData.price = urlHints.price;
            }
            const payload = {
              ...importedData,
              source,
              sourceUrl: importedData.sourceUrl || normalized,
              image: importedData.image || importedData.images?.[0] || "",
              images: importedData.images || [],
            };
            if (!payload.name && manualHints.name) payload.name = manualHints.name;
            if (!payload.desc && manualHints.desc) payload.desc = manualHints.desc;
            if (!payload.price && manualHints.price) payload.price = manualHints.price;
            if (!payload.sizes?.length && manualHints.sizes?.length) {
              payload.sizes = manualHints.sizes;
            }
            if ((!payload.images?.length && !payload.image) && manualHints.images?.length) {
              payload.images = manualHints.images;
              payload.image = manualHints.images[0];
            }
            const noteParts = [];
            noteParts.push(
              _blocked
                ? "Trang đang yêu cầu xác thực, dữ liệu có thể thiếu."
                : "Đã lấy dữ liệu từ crawler."
            );
            if (urlHints.price && importedData.price === urlHints.price) {
              noteParts.push("Đã lấy giá từ URL.");
            }
            const note = `${noteParts.join(" ")} `;
            applyExtractedData(payload, { note, qualityGate: false });
            loadVideoHintsForUrl(normalized);
            return;
          } catch (error) {
            setAutoHint("Crawler không phản hồi, thử phương án dự phòng...");
          }
        }

        let extracted = {
          name: "",
          desc: "",
          image: "",
          price: null,
          sizes: [],
          rating: null,
          ratingCount: null,
          positiveRate: null,
          soldCount: null,
          source,
          sourceUrl: normalized,
        };
        let fetchError = "";
        try {
          const result = await fetchProductHtml(normalized);
          extracted = {
            ...extracted,
            ...extractFromHtml(result.html, normalized, result.blocked),
          };
          extracted = enhanceExtractedDataWithRawHints(result.html, extracted);
          if (result.blocked) {
            fetchError = "Taobao đang chặn truy cập, dữ liệu có thể thiếu.";
          }
        } catch (error) {
          fetchError = "Không đọc được dữ liệu từ link, vui lòng kiểm tra thủ công.";
        }
        if (!extracted.price && urlHints.price) extracted.price = urlHints.price;
        if (!extracted.price && manualHints.price) extracted.price = manualHints.price;
        if (!extracted.name && manualHints.name) extracted.name = manualHints.name;
        if (!extracted.desc && manualHints.desc) extracted.desc = manualHints.desc;
        if (!extracted.sizes?.length && manualHints.sizes?.length) {
          extracted.sizes = manualHints.sizes;
        }
        if ((!extracted.images?.length && !extracted.image) && manualHints.images?.length) {
          extracted.images = manualHints.images;
          extracted.image = manualHints.images[0];
        }

        const note = urlHints.price && extracted.price ? "Đã lấy giá từ URL. " : "";
        const errorText = fetchError ? `${fetchError} ` : "";
        applyExtractedData(extracted, { note: `${errorText}${note}`, qualityGate: false });
        loadVideoHintsForUrl(normalized);
      });
    }

    if (autoParse) {
      autoParse.addEventListener("click", () => {
        const raw = autoPaste?.value.trim();
        if (!raw) {
          setAutoHint("Vui lòng dán HTML/JSON trước khi phân tích.");
          return;
        }
        let baseUrl = autoLink?.value ? normalizeProductUrl(autoLink.value) : "";
        const detectedEntries = extractProductLinkEntriesFromRaw(raw);
        if (!baseUrl && detectedEntries.length > 1) {
          bulkQueue = detectedEntries.map((entry) => entry.url);
          bulkQueuePrices = new Map(
            detectedEntries
              .filter((entry) => entry.price)
              .map((entry) => [normalizeProductUrl(entry.url) || entry.url, entry.price])
          );
          bulkQueueNames = new Map(
            detectedEntries
              .filter((entry) => entry.name)
              .map((entry) => [normalizeProductUrl(entry.url) || entry.url, entry.name])
          );
          bulkQueueImages = new Map(
            detectedEntries
              .filter((entry) => entry.image)
              .map((entry) => [normalizeProductUrl(entry.url) || entry.url, entry.image])
          );
          bulkQueueSizes = new Map();
          bulkQueueDescs = new Map();
          if (bulkLinks) {
            bulkLinks.value = detectedEntries
              .map((entry) =>
                entry.price ? `${entry.url} | ${entry.price}` : entry.url
              )
              .join("\n");
          }
          const priced = detectedEntries.filter((entry) => entry.price).length;
          const named = detectedEntries.filter((entry) => entry.name).length;
          const imageCount = detectedEntries.filter((entry) => entry.image).length;
          const priceText = priced ? `, có ${priced} giá` : "";
          const namedText = named ? `, ${named} có tên` : "";
          const imageText = imageCount ? `, ${imageCount} có ảnh` : "";
          setAutoHint(
            `Nội dung có nhiều sản phẩm, đã tách ${detectedEntries.length} link. Hãy dùng “Import hàng loạt”.`
          );
          setBulkHint(
            `Đã tách ${detectedEntries.length} link${priceText}${namedText}${imageText}. Có thể chỉnh sửa trước khi import.`
          );
          return;
        }
        if (!baseUrl && detectedEntries.length === 1) {
          baseUrl = normalizeProductUrl(detectedEntries[0].url) || "";
        }
        if (productLink && baseUrl) productLink.value = baseUrl;
        let extracted = {
          ...extractFromHtml(raw, baseUrl || ""),
          source: baseUrl ? inferSourceFromUrl(baseUrl) : "web",
          sourceUrl: baseUrl || "",
        };
        extracted = enhanceExtractedDataWithRawHints(raw, extracted);
        if (baseUrl) {
          const id = getProductIdFromUrl(baseUrl);
          const nameHints = buildNameHintsFromRaw(raw);
          const imageHints = buildImageHintsFromRaw(raw);
          const priceHints = buildPriceHintsFromRaw(raw);
          if (!extracted.name && id && nameHints.get(id)) {
            extracted.name = nameHints.get(id);
          }
          if ((!extracted.image && !extracted.images?.length) && id && imageHints.get(id)) {
            const hinted = normalizeImageUrl(imageHints.get(id), baseUrl);
            if (hinted) {
              extracted.image = hinted;
              extracted.images = [hinted];
            }
          }
          if (!extracted.price && id && priceHints.get(id)) {
            extracted.price = priceHints.get(id);
          }
        }
        if (!extracted.sizes?.length) extracted.sizes = ["Free"];
        if (productSource) productSource.value = extracted.source;
        if (!extracted.price && baseUrl) {
          const urlHints = parseUrlHints(baseUrl);
          if (urlHints.price) extracted.price = urlHints.price;
        }
        applyExtractedData(extracted, { note: "Đã phân tích nội dung dán. ", qualityGate: false });
        if (baseUrl) loadVideoHintsForUrl(baseUrl);
      });
    }

    if (bulkExtract) {
      bulkExtract.addEventListener("click", () => {
        const raw = autoPaste?.value.trim();
        if (!raw) {
          setBulkHint("Vui lòng dán HTML/JSON trước khi quét link.");
          return;
        }
        const entries = extractProductLinkEntriesFromRaw(raw);
        bulkQueue = entries.map((entry) => entry.url);
        bulkQueuePrices = new Map(
          entries
            .filter((entry) => entry.price)
            .map((entry) => [normalizeProductUrl(entry.url) || entry.url, entry.price])
        );
        bulkQueueNames = new Map(
          entries
            .filter((entry) => entry.name)
            .map((entry) => [normalizeProductUrl(entry.url) || entry.url, entry.name])
        );
        bulkQueueImages = new Map(
          entries
            .filter((entry) => entry.image)
            .map((entry) => [normalizeProductUrl(entry.url) || entry.url, entry.image])
        );
        bulkQueueSizes = new Map();
        bulkQueueDescs = new Map();
        if (bulkLinks) {
          bulkLinks.value = entries
            .map((entry) =>
              entry.price ? `${entry.url} | ${entry.price}` : entry.url
            )
            .join("\n");
        }
        if (!entries.length) {
          setBulkHint("Không tìm thấy link sản phẩm.");
          return;
        }
        const priced = entries.filter((entry) => entry.price).length;
        const priceText = priced ? `, có ${priced} giá` : "";
        const named = entries.filter((entry) => entry.name).length;
        const namedText = named ? `, ${named} có tên` : "";
        const imageCount = entries.filter((entry) => entry.image).length;
        const imageText = imageCount ? `, ${imageCount} có ảnh` : "";
        setBulkHint(
          `Đã tách ${entries.length} link${priceText}${namedText}${imageText}. Có thể chỉnh sửa trước khi import.`
        );
      });
    }

    if (bulkImport) {
      bulkImport.addEventListener("click", async () => {
        const rawLinks = bulkLinks?.value.trim();
        const parsed = rawLinks
          ? parseBulkLinkEntries(rawLinks)
          : {
              links: bulkQueue,
              priceByUrl: bulkQueuePrices,
              nameByUrl: bulkQueueNames,
              imageByUrl: bulkQueueImages,
              sizeByUrl: bulkQueueSizes,
              descByUrl: bulkQueueDescs,
            };
        let links = parsed.links;
        let priceByUrl = parsed.priceByUrl;
        let nameByUrl = parsed.nameByUrl || new Map();
        let imageByUrl = parsed.imageByUrl || new Map();
        let sizeByUrl = parsed.sizeByUrl || new Map();
        let descByUrl = parsed.descByUrl || new Map();
        if (!links.length && autoPaste?.value.trim()) {
          const entries = extractProductLinkEntriesFromRaw(autoPaste.value.trim());
          links = entries.map((entry) => entry.url);
          priceByUrl = new Map(
            entries
              .filter((entry) => entry.price)
              .map((entry) => [normalizeProductUrl(entry.url) || entry.url, entry.price])
          );
          nameByUrl = new Map(
            entries
              .filter((entry) => entry.name)
              .map((entry) => [normalizeProductUrl(entry.url) || entry.url, entry.name])
          );
          imageByUrl = new Map(
            entries
              .filter((entry) => entry.image)
              .map((entry) => [normalizeProductUrl(entry.url) || entry.url, entry.image])
          );
          sizeByUrl = new Map();
          descByUrl = new Map();
          if (bulkLinks) {
            bulkLinks.value = entries
              .map((entry) =>
                entry.price ? `${entry.url} | ${entry.price}` : entry.url
              )
              .join("\n");
          }
        }
        const rawHintSource = autoPaste?.value.trim();
        if (rawHintSource) {
          hydrateBulkHintsFromRaw(
            rawHintSource,
            links,
            priceByUrl,
            nameByUrl,
            imageByUrl
          );
        }
        mergeHintMap(priceByUrl, bulkQueuePrices, links);
        mergeHintMap(nameByUrl, bulkQueueNames, links);
        mergeHintMap(imageByUrl, bulkQueueImages, links);
        mergeHintMap(sizeByUrl, bulkQueueSizes, links);
        mergeHintMap(descByUrl, bulkQueueDescs, links);
        if (!links.length) {
          setBulkHint("Chưa có link để import.");
          return;
        }

        const limit = Math.max(1, Number(bulkLimit?.value) || 30);
        const queue = links.slice(0, limit);
        const settings = getSettings();
        const importEndpoint = settings.importEndpoint?.trim();
        const importCookie = settings.importCookie?.trim();
        const products = getProducts();
        const existingUrls = new Set(
          products
            .map((product) => normalizeProductUrl(product.sourceUrl || product.link || ""))
            .filter(Boolean)
        );
        const addedProducts = [];
        let skipped = 0;
        let failed = 0;
        let incomplete = 0;
        let rejected = 0;

        for (let index = 0; index < queue.length; index += 1) {
          const normalized = normalizeProductUrl(queue[index]);
          if (!normalized) {
            failed += 1;
            continue;
          }
          if (existingUrls.has(normalized)) {
            skipped += 1;
            continue;
          }
          setBulkHint(`Đang import ${index + 1}/${queue.length}...`);

          const source = inferSourceFromUrl(normalized);
          const urlHints = parseUrlHints(normalized);
          let extracted = {
            name: "",
            desc: "",
            image: "",
            images: [],
            price: null,
            sizes: [],
            rating: null,
            ratingCount: null,
            positiveRate: null,
            soldCount: null,
            source,
            sourceUrl: normalized,
          };
          let blockedNote = "";
          const priceHint = priceByUrl?.get(normalized);
          const nameHint = nameByUrl?.get(normalized);
          const imageHint = imageByUrl?.get(normalized);
          const sizeHint = sizeByUrl?.get(normalized);
          const descHint = descByUrl?.get(normalized);
          const manualPrice = priceHint || urlHints.price || null;

          if (importEndpoint) {
            try {
              const imported = await fetchImportedProduct(
                normalized,
                importEndpoint,
                importCookie
              );
              const { _blocked, ...importedData } = imported || {};
              extracted = {
                ...extracted,
                ...importedData,
                source,
                sourceUrl: importedData.sourceUrl || normalized,
              };
              if (!extracted.price && urlHints.price) extracted.price = urlHints.price;
              if (!extracted.price && priceHint) extracted.price = priceHint;
              blockedNote = _blocked ? "blocked" : "";
            } catch (error) {
              // fall back to proxy fetch below
            }
          }

          if (!extracted.name && !extracted.price) {
            try {
              const result = await fetchProductHtml(normalized);
              extracted = {
                ...extracted,
                ...extractFromHtml(result.html, normalized, result.blocked),
              };
              if (!extracted.price && urlHints.price) extracted.price = urlHints.price;
              if (!extracted.price && priceHint) extracted.price = priceHint;
              if (result.blocked) blockedNote = "blocked";
            } catch (error) {
              failed += 1;
              continue;
            }
          }

          if (!extracted.name && nameHint) extracted.name = nameHint;
          if (!extracted.desc && descHint) extracted.desc = descHint;
          if ((!extracted.image || !extracted.images?.length) && imageHint) {
            const normalizedImages = (Array.isArray(imageHint) ? imageHint : [imageHint])
              .map((value) => normalizeImageUrl(value, normalized))
              .filter(Boolean);
            if (normalizedImages.length) {
              extracted.images = normalizedImages;
              extracted.image = normalizedImages[0];
            }
          }
          if (!extracted.sizes?.length && Array.isArray(sizeHint) && sizeHint.length) {
            extracted.sizes = sizeHint;
          }
          const quality = evaluateQuality(extracted);
          const qualityPassed = quality.passed || Boolean(manualPrice);
          if (!qualityPassed) {
            rejected += 1;
            continue;
          }

          let name = cleanText(extracted.name);
          const price = Number(extracted.price);
          if (!name && manualPrice) {
            const fallbackId = getProductIdFromUrl(normalized);
            name = fallbackId ? `Sản phẩm Taobao ${fallbackId}` : "Sản phẩm Taobao";
          }
          if (!name || Number.isNaN(price)) {
            failed += 1;
            continue;
          }

          let sizes = Array.from(new Set(extracted.sizes || [])).filter(Boolean);
          if (!sizes.length) sizes = ["Free"];
          const sizesText = sizes.filter((size) => /^[A-Za-z]+$/.test(size));
          const sizesNum = sizes.filter((size) => /^[0-9]+$/.test(size));
          const images = mergeImages(
            extracted.images || [],
            extracted.image ? [extracted.image] : []
          );
          const cachedImages = await cacheProductImages(images, settings);
          const finalImages = cachedImages.length ? cachedImages : images;
          const image = finalImages[0] || extracted.image || "";
          const now = Date.now();
          const hidden = !sizes.length || !image || blockedNote === "blocked";
          if (hidden) incomplete += 1;

          const autoTags = ["auto"];
          if (source === "taobao_link") autoTags.push("taobao");
          if (hidden) autoTags.push("review");
          const nextId = getNextProductId(products);
          const guessDefaultColor =
            extracted.defaultColor ||
            extracted.colors?.[0]?.name ||
            extracted.variants?.find((variant) => variant.props?.color)?.props?.color ||
            "";
          const guessDefaultSize =
            extracted.defaultSize ||
            extracted.sizes?.[0] ||
            extracted.variants?.find((variant) => variant.props?.size)?.props?.size ||
            "";
          const stockValue = getDefaultStockValue();
          const palette = getProductPalette();
          addedProducts.push({
            id: nextId,
            name,
            desc: cleanText(extracted.desc) || "Mô tả cập nhật thủ công.",
            basePrice: price,
            category: inferCategoryFromName(name),
            source,
            sourceUrl: extracted.sourceUrl || normalized,
            tags: autoTags,
          sizesText,
          sizesNum,
          stock: sizes.reduce((acc, size) => ({ ...acc, [size]: stockValue }), {}),
          palette,
          defaultStock: stockValue,
          image,
            images: finalImages,
            rating: qualityPassed && quality.passed ? quality.rating : null,
            ratingCount: qualityPassed && quality.passed ? quality.ratingCount : null,
            positiveRate: qualityPassed && quality.passed ? quality.positiveRate : null,
            soldCount: qualityPassed && quality.passed ? quality.soldCount : null,
            defaultColor: guessDefaultColor,
            defaultSize: guessDefaultSize,
            hidden,
            createdAt: now,
            updatedAt: now,
          });
          existingUrls.add(normalized);
        }

        if (addedProducts.length) {
          products.unshift(...addedProducts);
          setProducts(products);
          renderProductList();
        }
        const reviewNote = incomplete
          ? `, ${incomplete} mục cần kiểm tra thêm`
          : "";
        setBulkHint(
          `Hoàn tất: thêm ${addedProducts.length}, bỏ qua ${skipped}, loại ${rejected}, lỗi ${failed}${reviewNote}.`
        );
      });
    }

    if (bulkCacheAll) {
      bulkCacheAll.addEventListener("click", async () => {
        const settings = getSettings();
        const products = getProducts();
        if (!products.length) {
          setBulkHint("Chưa có sản phẩm để lưu ảnh.");
          return;
        }
        let cachedCount = 0;
        let skipped = 0;
        let failed = 0;
        for (let index = 0; index < products.length; index += 1) {
          const product = products[index];
          if (!product) continue;
          const images = getProductImages(product);
          const needsCache = images.some(
            (value) =>
              value &&
              !String(value).startsWith("data:") &&
              !String(value).startsWith("assets/") &&
              !String(value).includes("/media/")
          );
          if (!needsCache) {
            skipped += 1;
            continue;
          }
          setBulkHint(`Đang lưu ảnh ${index + 1}/${products.length}...`);
        try {
          const cachedImages = await cacheProductImages(images, settings);
          const finalImages = cachedImages.length ? cachedImages : images;
          const image = finalImages[0] || product.image || "";
          const measuredSizes = await measureImageSizes(finalImages);
          products[index] = {
            ...product,
            image,
            images: finalImages,
            imageSizes: measuredSizes,
            updatedAt: Date.now(),
          };
            cachedCount += 1;
          } catch (error) {
            failed += 1;
          }
        }
        setProducts(products);
        renderProductList();
        setBulkHint(`Hoàn tất: lưu ${cachedCount}, bỏ qua ${skipped}, lỗi ${failed}.`);
      });
    }

    if (addProduct) {
      addProduct.addEventListener("click", async () => {
        const name = productName.value.trim();
        const price = Number(productPrice.value);
        if (!name || Number.isNaN(price)) {
          setAutoHint("Vui lòng nhập tối thiểu tên và giá trước khi lưu.");
          return;
        }
        const desc = productDesc.value.trim() || "Mô tả cập nhật thủ công.";
        const sizes = parseSizes();
        const sizesText = sizes.filter((size) => /^[A-Za-z]+$/.test(size));
        const sizesNum = sizes.filter((size) => /^[0-9]+$/.test(size));
        const now = Date.now();
        const products = getProducts();
        const nextId = getNextProductId(products);
        const images = collectImageInputs();
        const cachedImages = await cacheProductImages(images, getSettings());
        const finalImages = cachedImages.length ? cachedImages : images;
        const image = finalImages[0] || (productImage ? productImage.value.trim() : "");
        const sourceUrl = productLink ? productLink.value.trim() : "";
        const videoUrl = productVideo?.value.trim() || "";
        const meta = importedMeta || {};
        const stockValue = getDefaultStockValue();
        const palette = getProductPalette();
        const measuredSizes = await measureImageSizes(finalImages);
        products.unshift({
          id: nextId,
          name,
          desc,
          basePrice: price,
          category: productCategory.value,
          source: productSource.value,
          sourceUrl,
          tags: productTags.value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          sizesText,
          sizesNum,
          defaultColor: productColor ? productColor.value.trim() : "",
          defaultSize: productDefaultSize ? productDefaultSize.value.trim() : "",
          stock: sizes.reduce((acc, size) => ({ ...acc, [size]: stockValue }), {}),
          palette,
          defaultStock: stockValue,
          image,
          images: finalImages,
          rating: meta.rating ?? null,
          ratingCount: meta.ratingCount ?? null,
          positiveRate: meta.positiveRate ?? null,
          soldCount: meta.soldCount ?? null,
          hidden: productHidden?.checked || false,
          video: videoUrl,
          videoHints: Array.from(importPreviewVideoHints),
          imageSizes: measuredSizes,
          createdAt: now,
          updatedAt: now,
        });
        setProducts(products);
        renderProductList();
        await performSync({ reason: "product-add", silent: true });
        setAutoHint("Đã lưu sản phẩm và đồng bộ.");
        resetForm();
      });
    }

    if (updateProduct) {
      updateProduct.addEventListener("click", async () => {
        if (!activeProductId) {
          setAutoHint("Vui lòng chọn sản phẩm trước khi cập nhật.");
          return;
        }
        const products = getProducts();
        const index = products.findIndex((item) => item.id === activeProductId);
        if (index < 0) return;

        const name = productName.value.trim();
        const price = Number(productPrice.value);
        if (!name || Number.isNaN(price)) {
          setAutoHint("Vui lòng nhập tối thiểu tên và giá trước khi lưu.");
          return;
        }
        const sizes = parseSizes();
        const sizesText = sizes.filter((size) => /^[A-Za-z]+$/.test(size));
        const sizesNum = sizes.filter((size) => /^[0-9]+$/.test(size));
        const currentStock = products[index].stock || {};
        const defaultStock = getDefaultStockValue();
        const stock = sizes.reduce((acc, size) => {
          acc[size] = currentStock[size] ?? defaultStock;
          return acc;
        }, {});
        const imagesInput = collectImageInputs();
        const existingImages = products[index].images || [];
        const pendingImages = imagesInput.length ? imagesInput : existingImages;
        const cachedImages = await cacheProductImages(pendingImages, getSettings());
        const finalImages = cachedImages.length ? cachedImages : pendingImages;
        const measuredSizes = await measureImageSizes(finalImages);
        const sourceUrl = productLink ? productLink.value.trim() : products[index].sourceUrl || "";
        const meta = importedMeta || {};
        const palette = getProductPalette();
        const videoUrl = productVideo?.value.trim() || products[index].video || products[index].videoUrl || "";
        products[index] = {
          ...products[index],
          name,
          desc: productDesc.value.trim() || products[index].desc || "",
          basePrice: price,
          category: productCategory.value,
          source: productSource.value,
          sourceUrl,
          tags: productTags.value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          sizesText,
          sizesNum,
          defaultColor: productColor ? productColor.value.trim() : products[index].defaultColor || "",
          defaultSize:
            productDefaultSize ? productDefaultSize.value.trim() : products[index].defaultSize || "",
          stock,
          image:
            finalImages[0] ||
            (productImage ? productImage.value.trim() : "") ||
            products[index].image ||
            "",
          images: finalImages,
          rating: meta.rating ?? products[index].rating ?? null,
          ratingCount: meta.ratingCount ?? products[index].ratingCount ?? null,
          positiveRate: meta.positiveRate ?? products[index].positiveRate ?? null,
          soldCount: meta.soldCount ?? products[index].soldCount ?? null,
          hidden: productHidden?.checked || false,
          palette,
          defaultStock,
          video: videoUrl,
          videoHints: Array.from(importPreviewVideoHints),
          imageSizes: measuredSizes,
          updatedAt: Date.now(),
        };
        setProducts(products);
        renderProductList();
        await performSync({ reason: "product-update", silent: true });
        setAutoHint("Đã cập nhật sản phẩm và đồng bộ.");
        fillProductForm(products[index]);
      });
    }

    if (resetProduct) {
      resetProduct.addEventListener("click", resetForm);
    }

    const requestListContainer = document.getElementById("adminRequestList");
    const renderCustomerRequests = () => {
      if (!requestListContainer) return;
      const entries = getCustomerRequests();
      if (!entries.length) {
        requestListContainer.innerHTML =
          '<p class="helper small">Chưa có yêu cầu nào từ khách hàng.</p>';
        return;
      }
      requestListContainer.innerHTML = entries
        .map((entry) => {
          const timestamp = formatDateTime(entry.createdAt);
          const fbLink = entry.facebook
            ? `<a href="${escapeHtml(entry.facebook)}" target="_blank" rel="noopener">Facebook</a>`
            : "";
          const notes = [
            entry.sizeNote ? `<span>Size: ${escapeHtml(entry.sizeNote)}</span>` : "",
            entry.colorNote ? `<span>Màu: ${escapeHtml(entry.colorNote)}</span>` : "",
            entry.otherNote ? `<span>Yêu cầu khác: ${escapeHtml(entry.otherNote)}</span>` : "",
          ]
            .filter(Boolean)
            .join("");
          const imageHints =
            entry.imageLinks && entry.imageLinks.length
              ? entry.imageLinks
                  .map(
                    (link) =>
                      `<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(
                        link
                      )}</a>`
                  )
                  .join(", ")
              : "";
          const linkMarkup = (entry.links || []).length
            ? entry.links
                .map((link) => {
                  const preview = link.preview || {};
                  const safeUrl = escapeHtml(link.url);
                  const title = escapeHtml(preview.name || link.url);
                  const priceLine = preview.price ? `<span>Giá: ${escapeHtml(preview.price)}</span>` : "";
                  const description = preview.desc
                    ? `<span>${escapeHtml(preview.desc)}</span>`
                    : "";
                  const leftBlock = preview.image
                    ? `<img src="${escapeHtml(preview.image)}" alt="" loading="lazy" />`
                    : `<span class="link-placeholder">Ảnh trống</span>`;
                  return `
                    <div class="admin-request-link">
                      ${leftBlock}
                      <div class="link-meta">
                        <a href="${safeUrl}" target="_blank" rel="noopener">${title}</a>
                        ${priceLine}
                        ${description}
                      </div>
                    </div>
                  `;
                })
                .join("")
            : '<p class="helper small">Chưa có link kèm thông tin.</p>';
          return `
            <article class="admin-request-card">
              <header>
                <strong>${escapeHtml(entry.name || "Khách hàng")}</strong>
                <span class="tag">${timestamp}</span>
              </header>
              <div class="request-meta">
                ${fbLink}
                ${notes}
              </div>
              ${imageHints ? `<div class="request-note">Ảnh tham khảo: ${imageHints}</div>` : ""}
              <div class="admin-request-links">
                ${linkMarkup}
              </div>
            </article>
          `;
        })
        .join("");
    };
    registerSyncListener(renderCustomerRequests);

    renderProductList();
    renderCustomerRequests();
    if (highlightProductId) {
      const product = getProducts().find((entry) => entry.id === highlightProductId);
      if (product) fillProductForm(product);
    }
  };

  const initAdminOrders = () => {
    if (!requireAdminAuth()) return;
    bindAdminLogout();
    const ordersTable = document.getElementById("ordersTable");
    const orderStatusFilter = document.getElementById("orderStatusFilter");
    const orderEditSelect = document.getElementById("orderEditSelect");
    const orderEditStatus = document.getElementById("orderEditStatus");
    const orderEditPaymentStatus = document.getElementById("orderEditPaymentStatus");
    const orderEditShipFee = document.getElementById("orderEditShipFee");
    const orderEditShipCurrency = document.getElementById("orderEditShipCurrency");
    const orderEditEta = document.getElementById("orderEditEta");
    const orderEditTracking = document.getElementById("orderEditTracking");
    const orderEditNote = document.getElementById("orderEditNote");
    const orderEditCustomerName = document.getElementById("orderEditCustomerName");
    const orderEditCustomerPhone = document.getElementById("orderEditCustomerPhone");
    const orderEditCustomerAddress = document.getElementById("orderEditCustomerAddress");
    const orderEditCustomerFb = document.getElementById("orderEditCustomerFb");
    const orderEditSave = document.getElementById("orderEditSave");
    const orderEditDelete = document.getElementById("orderEditDelete");
    const orderEditMessage = document.getElementById("orderEditMessage");
    const orderFilterChips = Array.from(
      document.querySelectorAll(".admin-filter-chips .chip")
    );
    const syncActiveOrderChip = () => {
      if (!orderFilterChips.length) return;
      const target = (orderStatusFilter?.value || "all").trim() || "all";
      orderFilterChips.forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.orderStatus === target);
      });
    };

    const params = new URLSearchParams(window.location.search);
    const orderFilterCode = params.get("order") || "";
    const initialCustomerFilter = params.get("customer") || "";
    const statusParam = params.get("status");
    let editingOrderCode = orderFilterCode || "";
    let currentCustomerFilter = initialCustomerFilter;

    if (orderStatusFilter && statusParam) {
      const hasOption = Array.from(orderStatusFilter.options).some(
        (option) => option.value === statusParam
      );
      if (hasOption) {
        orderStatusFilter.value = statusParam;
      }
    }

    const setEditorMessage = (message) => {
      if (orderEditMessage) orderEditMessage.textContent = message;
    };

    const refreshOrdersTable = () => {
      renderOrdersTable(
        ordersTable,
        orderStatusFilter ? orderStatusFilter.value : "all",
        currentCustomerFilter
      );
      renderAdminOrderLanes();
      syncActiveOrderChip();
      refreshAdminInsights();
    };

    const populateOrderEditor = (code) => {
      const order = getOrders().find((entry) => entry.code === code);
      const hasOrder = Boolean(order);
      if (orderEditSave) orderEditSave.disabled = !hasOrder;
      if (orderEditDelete) orderEditDelete.disabled = !hasOrder;
      if (!hasOrder) {
        if (orderEditStatus) orderEditStatus.value = "PENDING_QUOTE";
        if (orderEditPaymentStatus) orderEditPaymentStatus.value = "NOT_PAID";
        if (orderEditShipFee) orderEditShipFee.value = "";
        if (orderEditShipCurrency) orderEditShipCurrency.value = "JPY";
        if (orderEditEta) orderEditEta.value = "";
        if (orderEditTracking) orderEditTracking.value = "";
        if (orderEditNote) orderEditNote.value = "";
        if (orderEditCustomerName) orderEditCustomerName.value = "";
        if (orderEditCustomerPhone) orderEditCustomerPhone.value = "";
        if (orderEditCustomerAddress) orderEditCustomerAddress.value = "";
        if (orderEditCustomerFb) orderEditCustomerFb.value = "";
        setEditorMessage("Chưa có đơn để chỉnh sửa.");
        return;
      }
      const customer = order.customer || {};
      if (orderEditStatus) orderEditStatus.value = order.status || "PENDING_QUOTE";
      if (orderEditPaymentStatus)
        orderEditPaymentStatus.value = order.paymentStatus || "NOT_PAID";
      if (orderEditShipFee) orderEditShipFee.value = order.shipFee ?? "";
      if (orderEditShipCurrency) orderEditShipCurrency.value = order.shipCurrency || "JPY";
      if (orderEditEta) orderEditEta.value = order.eta || "";
      if (orderEditTracking) orderEditTracking.value = order.tracking || "";
      if (orderEditNote) orderEditNote.value = order.note || "";
      if (orderEditCustomerName) orderEditCustomerName.value = customer.name || "";
      if (orderEditCustomerPhone) orderEditCustomerPhone.value = customer.phone || "";
      if (orderEditCustomerAddress) orderEditCustomerAddress.value = customer.address || "";
      if (orderEditCustomerFb) orderEditCustomerFb.value = customer.fb || "";
      setEditorMessage(`Đang chỉnh sửa đơn ${order.code}.`);
    };

    const updateOrderEditorOptions = () => {
      if (!orderEditSelect) {
        editingOrderCode = "";
        populateOrderEditor("");
        return;
      }
      const nextCode = renderOrderSelect(orderEditSelect, editingOrderCode);
      editingOrderCode = nextCode;
      populateOrderEditor(editingOrderCode);
    };

    orderFilterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const status = chip.dataset.orderStatus || "all";
        if (orderStatusFilter) orderStatusFilter.value = status;
        refreshOrdersTable();
        chip.blur();
      });
    });

    const deleteOrder = (code) => {
      if (!code) return;
      if (!window.confirm(`Bạn chắc chắn muốn xoá vĩnh viễn đơn ${code}?`)) return;
      const ordersList = getOrders().filter((entry) => entry.code !== code);
      setOrders(ordersList);
      setEditorMessage(`Đã xoá vĩnh viễn đơn ${code}.`);
      showNotification(`Đã xoá vĩnh viễn đơn ${code}.`, "danger");
      editingOrderCode = "";
      refreshOrdersTable();
      updateOrderEditorOptions();
    };

    const handleOrderSave = () => {
      if (!editingOrderCode) {
        setEditorMessage("Không có đơn để lưu.");
        return;
      }
      const ordersList = getOrders();
      const index = ordersList.findIndex((entry) => entry.code === editingOrderCode);
      if (index < 0) {
        setEditorMessage("Đơn không tồn tại.");
        return;
      }
      const order = ordersList[index];
      if (orderEditStatus) order.status = orderEditStatus.value;
      if (orderEditPaymentStatus) order.paymentStatus = orderEditPaymentStatus.value;
      if (orderEditShipFee) {
        const feeValue = orderEditShipFee.value.trim();
        const parsedFee = feeValue === "" ? 0 : Number(feeValue);
        const fee = Number.isNaN(parsedFee) ? 0 : parsedFee;
        order.shipFee = fee;
        if (fee > 0) {
          order.shipFeeConfirmedAt = Date.now();
          order.paymentGateOpenedAt = Date.now();
        } else {
          order.shipFeeConfirmedAt = null;
          order.paymentGateOpenedAt = null;
        }
      }
      if (orderEditShipCurrency) order.shipCurrency = orderEditShipCurrency.value;
      if (orderEditEta) order.eta = orderEditEta.value.trim();
      if (orderEditTracking) order.tracking = orderEditTracking.value.trim();
      if (orderEditNote) order.note = orderEditNote.value.trim();
      const customer = order.customer || {};
      order.customer = {
        ...customer,
        name: orderEditCustomerName ? orderEditCustomerName.value.trim() : customer.name || "",
        phone: orderEditCustomerPhone
          ? orderEditCustomerPhone.value.trim()
          : customer.phone || "",
        address: orderEditCustomerAddress
          ? orderEditCustomerAddress.value.trim()
          : customer.address || "",
        fb: orderEditCustomerFb ? orderEditCustomerFb.value.trim() : customer.fb || "",
      };
      order.updatedAt = Date.now();
      pushTimeline(order, {
        status: order.status,
        paymentStatus: order.paymentStatus,
        actor: "admin",
        message: "Admin cập nhật thông tin đơn hàng.",
      });
      setOrders(ordersList);
      refreshOrdersTable();
      setEditorMessage("Đã lưu thay đổi.");
    };

    if (orderStatusFilter) {
      orderStatusFilter.addEventListener("change", () => {
        refreshOrdersTable();
      });
    }

    if (ordersTable) {
      ordersTable.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const action = button.dataset.action;
        const code = button.dataset.code;
        if (action === "edit") {
          editingOrderCode = code;
          updateOrderEditorOptions();
          return;
        }
        if (action === "delete") {
          deleteOrder(code);
        }
      });
    }

    if (orderEditSelect) {
      orderEditSelect.addEventListener("change", (event) => {
        editingOrderCode = event.target.value;
        populateOrderEditor(editingOrderCode);
      });
    }

    if (orderEditSave) {
      orderEditSave.addEventListener("click", handleOrderSave);
    }

    if (orderEditDelete) {
      orderEditDelete.addEventListener("click", () => deleteOrder(editingOrderCode));
    }

    refreshOrdersTable();
    updateOrderEditorOptions();
    if (initialCustomerFilter && orderEditMessage) {
      orderEditMessage.textContent = `Đang lọc đơn của khách ${initialCustomerFilter}.`;
    }
  };

  const initAdminQuotes = () => {
    if (!requireAdminAuth()) return;
    bindAdminLogout();
    const orderSelect = document.getElementById("orderSelect");
    const shipFee = document.getElementById("shipFee");
    const shipCurrency = document.getElementById("shipCurrency");
    const quoteNote = document.getElementById("quoteNote");
    const applyQuote = document.getElementById("applyQuote");
    const regenCode = document.getElementById("regenCode");
    const adminQuoteSummary = document.getElementById("adminQuoteSummary");
    const adminOrderItems = document.getElementById("adminOrderItems");

    let selectedCode = renderOrderSelect(orderSelect, "");

    const getPreviewShip = (order) => {
      const feeValue = shipFee ? shipFee.value : "";
      const fee = feeValue === "" ? null : Number(feeValue);
      const currency = "JPY";
      return {
        fee: Number.isNaN(fee) ? null : fee,
        currency,
      };
    };

    const renderQuotePanel = (preserveInput = false) => {
      const ordersList = getOrders();
      const order = ordersList.find((entry) => entry.code === selectedCode);
      if (!order) {
        if (adminQuoteSummary) adminQuoteSummary.innerHTML = "<p>Chưa có đơn để báo giá.</p>";
        if (adminOrderItems) adminOrderItems.innerHTML = "<p>Chưa có sản phẩm.</p>";
        return;
      }
      const products = getProducts();
      const preview = getPreviewShip(order);
      const totals = computeTotals(order, getSettings(), products, {
        shipFee: preview.fee,
        shipCurrency: preview.currency,
      });
      if (adminQuoteSummary) {
        adminQuoteSummary.innerHTML = `
          <span>Subtotal (+25%): ${formatCurrency(
            totals.subtotalBase,
            getSettings().baseCurrency
          )}</span>
          <span>Ship: JPY ${formatNumber(totals.shipJPY)} / VND ${formatNumber(totals.shipVND)}</span>
          <span>Thuế nội bộ 15%: JPY ${formatNumber(totals.taxJPY)} / VND ${formatNumber(
            totals.taxVND
          )}</span>
          <span>Tổng khách trả: JPY ${formatNumber(totals.totalJPY)} / VND ${formatNumber(
            totals.totalVND
          )}</span>
          <span>Mã thanh toán (mã đơn): ${order.paymentCode || order.code}</span>
        `;
      }
      if (!preserveInput) {
        if (shipFee) shipFee.value = order.shipFee || "";
        if (shipCurrency) shipCurrency.value = "JPY";
        if (quoteNote) quoteNote.value = order.note || "";
      }
    if (adminOrderItems) {
      adminOrderItems.innerHTML = renderOrderItems(order, products);
    }
    refreshAdminInsights();
  };

    const updateOrder = (callback) => {
      const ordersList = getOrders();
      const index = ordersList.findIndex((entry) => entry.code === selectedCode);
      if (index < 0) return;
      callback(ordersList[index]);
      setOrders(ordersList);
      renderQuotePanel();
    };

    if (orderSelect) {
      orderSelect.addEventListener("change", (event) => {
        selectedCode = event.target.value;
        renderQuotePanel();
      });
    }

    if (shipFee) {
      shipFee.addEventListener("input", () => renderQuotePanel(true));
    }

    if (shipCurrency) {
      shipCurrency.addEventListener("change", () => renderQuotePanel(true));
    }

    if (applyQuote) {
      applyQuote.addEventListener("click", () => {
        let messengerLink = "";
        updateOrder((order) => {
          const feeValue = shipFee.value;
          if (feeValue === "") return;
          const fee = Number(feeValue);
          if (Number.isNaN(fee)) return;
          order.shipFee = fee;
          order.shipCurrency = "JPY";
          order.shipFeeConfirmedAt = Date.now();
          order.paymentGateOpenedAt = Date.now();
          order.note = quoteNote.value.trim();
          order.paymentCode = order.code;
          order.paymentExpiresAt = Date.now() + 72 * 60 * 60 * 1000;
          order.paymentStatus = PAYMENT_STATUS.NOT_PAID;
          order.billSubmitted = false;
          order.status = STATUS.QUOTED_WAITING_PAYMENT;
          const settings = getSettings();
          if (!settings.paymentGateOpen) {
            settings.paymentGateOpen = true;
            setSettings(settings);
          }
          pushTimeline(order, {
            status: order.status,
            paymentStatus: order.paymentStatus,
            actor: "admin",
            message: `Đã báo giá ship ${fee} JPY.`,
          });
          messengerLink = notifyCustomerMessenger(order, { redirect: true });
          if (messengerLink) {
            order.lastMessengerLink = messengerLink;
            order.lastMessengerNotifiedAt = Date.now();
            pushTimeline(order, {
              status: order.status,
              paymentStatus: order.paymentStatus,
              actor: "admin",
              message: "Đã gửi tin nhắn Messenger thông báo phí ship.",
            });
          }
        });
        if (!messengerLink) {
          console.info("Không tìm thấy Facebook để gửi Messenger cho đơn", shipFee.value);
        }
      });
    }

    if (regenCode) {
      regenCode.addEventListener("click", () => {
        updateOrder((order) => {
          order.paymentCode = order.code;
          order.paymentExpiresAt = Date.now() + 72 * 60 * 60 * 1000;
          order.paymentStatus = PAYMENT_STATUS.NOT_PAID;
          order.billSubmitted = false;
          order.status = STATUS.QUOTED_WAITING_PAYMENT;
          pushTimeline(order, {
            status: order.status,
            paymentStatus: order.paymentStatus,
            actor: "admin",
            message: "Đã gia hạn mã thanh toán.",
          });
        });
      });
    }

    renderQuotePanel();
  };

  const initAdminPayments = () => {
    if (!requireAdminAuth()) return;
    bindAdminLogout();
    const paymentOrderSelect = document.getElementById("paymentOrderSelect");
    const adminPaymentSummary = document.getElementById("adminPaymentSummary");
    const adminPaymentBill = document.getElementById("adminPaymentBill");
    const markPaid = document.getElementById("markPaid");
    const markCancelled = document.getElementById("markCancelled");

    let selectedCode = renderOrderSelect(paymentOrderSelect, "");

    const renderPaymentPanel = () => {
      const ordersList = getOrders();
      const order = ordersList.find((entry) => entry.code === selectedCode);
      if (!order) {
        if (adminPaymentSummary) adminPaymentSummary.innerHTML = "<p>Chưa có đơn để xử lý.</p>";
        if (adminPaymentBill) adminPaymentBill.innerHTML = "Chưa có bill.";
        return;
      }
      const products = getProducts();
      const totals = computeTotals(order, getSettings(), products);
      if (adminPaymentSummary) {
        adminPaymentSummary.innerHTML = `
          <span><strong>Mã thanh toán:</strong> ${order.paymentCode || order.code}</span>
          <span><strong>Trạng thái:</strong> ${formatPaymentStatus(order.paymentStatus)}</span>
          <span><strong>Bill:</strong> ${order.billSubmitted ? "Đã gửi" : "Chưa có"}</span>
          <span><strong>Tổng khách trả:</strong> VND ${formatNumber(totals.totalVND)}</span>
        `;
      }
      if (adminPaymentBill) {
        if (order.billPreview) {
          adminPaymentBill.innerHTML = `<img src="${order.billPreview}" alt="Bill preview" />`;
        } else if (order.billFileName) {
          adminPaymentBill.innerHTML = `<span class="tag">${order.billFileName}</span>`;
        } else {
          adminPaymentBill.innerHTML = "Chưa có bill.";
        }
      }
    };
    refreshAdminInsights();

    const updateOrder = (callback) => {
      const ordersList = getOrders();
      const index = ordersList.findIndex((entry) => entry.code === selectedCode);
      if (index < 0) return;
      callback(ordersList[index]);
      setOrders(ordersList);
      renderPaymentPanel();
    };

    if (paymentOrderSelect) {
      paymentOrderSelect.addEventListener("change", (event) => {
        selectedCode = event.target.value;
        renderPaymentPanel();
      });
    }

    if (markPaid) {
      markPaid.addEventListener("click", () => {
        updateOrder((order) => {
          order.paymentStatus = PAYMENT_STATUS.CONFIRMED;
          order.status = STATUS.PAID;
          order.paymentConfirmedAt = Date.now();
          pushTimeline(order, {
            status: order.status,
            paymentStatus: order.paymentStatus,
            actor: "admin",
            message: "Admin xác nhận thanh toán thành công.",
          });
        });
      });
    }

    if (markCancelled) {
      markCancelled.addEventListener("click", () => {
        updateOrder((order) => {
          order.paymentStatus = PAYMENT_STATUS.REJECTED;
          order.status = STATUS.CANCELLED;
          pushTimeline(order, {
            status: order.status,
            paymentStatus: order.paymentStatus,
            actor: "admin",
            message: "Admin từ chối thanh toán.",
          });
        });
      });
    }

    renderPaymentPanel();
  };

  const initAdminTracking = () => {
    if (!requireAdminAuth()) return;
    bindAdminLogout();
    const orderSelect = document.getElementById("orderSelect");
    const orderEta = document.getElementById("orderEta");
    const orderTracking = document.getElementById("orderTracking");
    const saveTracking = document.getElementById("saveTracking");

    let selectedCode = renderOrderSelect(orderSelect, "");

    const renderTracking = () => {
      const order = getOrders().find((entry) => entry.code === selectedCode);
      if (!order) return;
      orderEta.value = order.eta || "";
      orderTracking.value = order.tracking || "";
      refreshAdminInsights();
    };

    if (orderSelect) {
      orderSelect.addEventListener("change", (event) => {
        selectedCode = event.target.value;
        renderTracking();
      });
    }

    if (saveTracking) {
      saveTracking.addEventListener("click", () => {
        const ordersList = getOrders();
        const index = ordersList.findIndex((entry) => entry.code === selectedCode);
        if (index < 0) return;
        ordersList[index].eta = orderEta.value;
        ordersList[index].tracking = orderTracking.value.trim();
        pushTimeline(ordersList[index], {
          status: ordersList[index].status,
          paymentStatus: ordersList[index].paymentStatus,
          actor: "admin",
          message: `Cập nhật lộ trình: ${ordersList[index].tracking || "Đang xử lý"}`,
        });
        setOrders(ordersList);
      });
    }

    renderTracking();
  };

  const initAdminCustomers = () => {
    if (!requireAdminAuth()) return;
    bindAdminLogout();
    const searchInput = document.getElementById("customerSearch");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        renderAdminNewCustomers(document.getElementById("customerList"), 12);
      });
    }
    renderAllCustomerSections();
  };

  const initAdminReports = () => {
    if (!requireAdminAuth()) return;
    bindAdminLogout();
    const revenueSummary = document.getElementById("revenueSummary");
    const exportReport = document.getElementById("exportReport");
    if (!revenueSummary) return;
    const products = getProducts();
    const paidOrders = getOrders().filter((entry) => entry.status === STATUS.PAID);
    const revenue = paidOrders.reduce((sum, entry) => {
      const totalsPaid = computeTotals(entry, getSettings(), products);
      return sum + totalsPaid.totalVND;
    }, 0);
    revenueSummary.innerHTML = `
      <span>Doanh thu hôm nay: ${formatNumber(revenue)} VND</span>
      <span>Doanh thu tháng: ${formatNumber(revenue)} VND</span>
    `;
    if (exportReport) {
      exportReport.addEventListener("click", () => {
        const rows = [
          ["orderCode", "customerName", "status", "totalVND"],
          ...paidOrders.map((order) => {
            const totals = computeTotals(order, getSettings(), products);
            const customerName = order.customer?.name || "Khách hàng";
            return [order.code, customerName, formatOrderStatus(order.status), totals.totalVND];
          }),
        ];
        const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "orderhub-report.csv";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      });
    }
    refreshAdminInsights();
  };

  const initReveal = () => {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("in-view");
        });
      },
      { threshold: 0.12 }
    );
    items.forEach((item) => observer.observe(item));
  };

  const initShortcuts = () => {
    const searchInput = document.querySelector("[data-search]");
    if (!searchInput) return;
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });
  };

  const initCatLinks = () => {
    document.querySelectorAll("[data-admin-cat]").forEach((btn) => {
      btn.addEventListener("dblclick", () => {
        window.location.href = "admin-login.html";
      });
    });
  };

  const initPage = () => {
    seedData();
    patchProductsForDefaults();
    refreshLiveRates();
    initOrderStream();
    initAdminGlobalTools();
    const page = document.body.dataset.page;
    setActiveNav(page);
    updateCartBadge();
    updateWishlistBadge();
    updateEmergencyLinks();
    initNotifications();
    initReveal();
    initShortcuts();
    initCatLinks();
    initSync();

    if (page === "home") initHome();
    if (page === "shop") initShop();
    if (page === "product") initProduct();
    if (page === "cart") initCart();
    if (page === "checkout") initCheckout();
    if (page === "payment") initPayment();
    if (page === "admin-login") initAdminLogin();
    if (page === "admin-dashboard") initAdminDashboard();
    if (page === "admin-products") initAdminProducts();
    if (page === "admin-orders") initAdminOrders();
    if (page === "admin-quotes") initAdminQuotes();
    if (page === "admin-payments") initAdminPayments();
    if (page === "admin-tracking") initAdminTracking();
    if (page === "admin-customers") initAdminCustomers();
    if (page === "admin-settings") initAdminSettings();
    if (page === "admin-reports") initAdminReports();
  };

  document.addEventListener("DOMContentLoaded", initPage);
})();
