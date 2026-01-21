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
    orders: readStore(KEYS.orders, []),
    customers: readStore(KEYS.customers, {}),
    cart: readStore(KEYS.cart, []),
    wishlist: readStore(KEYS.wishlist, []),
    recent: readStore(KEYS.recent, []),
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
      ].includes(key)
    ) {
      updateBackup();
    }
    if (!suppressSync && SYNC_KEYS.includes(key)) {
      syncDirty = true;
      scheduleSync("local-change");
    }
  };

  const EXCHANGE_RATE_API =
    "https://api.exchangerate.host/latest?base=CNY&symbols=JPY,VND";
  const RATE_FETCH_KEY = "oh_rate_fetch_at";
  const RATE_FETCH_TTL = 30 * 60 * 1000;

  const refreshLiveRates = async (force = false) => {
    try {
      const now = Date.now();
      const lastFetch = Number(store.getItem(RATE_FETCH_KEY) || "0");
      if (!force && now - lastFetch < RATE_FETCH_TTL) {
        return false;
      }
      const response = await fetch(EXCHANGE_RATE_API, { cache: "no-store" });
      if (!response.ok) throw new Error("rate_fetch_failed");
      const payload = await response.json();
      const rates = payload?.rates || {};
      const jpyRate =
        typeof rates.JPY === "number" ? rates.JPY : parseNumberFromText(rates.JPY);
      const vndRate =
        typeof rates.VND === "number" ? rates.VND : parseNumberFromText(rates.VND);
      store.setItem(RATE_FETCH_KEY, String(now));
      if (!jpyRate && !vndRate) {
        return true;
      }
      const current = getSettings();
      const next = { ...current };
      let changed = false;
      if (typeof jpyRate === "number" && jpyRate !== current.rateJPY) {
        next.rateJPY = jpyRate;
        changed = true;
      }
      if (typeof vndRate === "number" && vndRate !== current.rateVND) {
        next.rateVND = vndRate;
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
      const totalLabel =
        typeof order.totalJPY === "number" && typeof order.totalVND === "number"
          ? `${order.totalJPY.toLocaleString("en-US")} ¥ / ${order.totalVND.toLocaleString()} ₫`
          : "Đang tính tổng";
      const timestamp = order.createdAt
        ? new Date(order.createdAt).toLocaleString("vi-VN")
        : "-";
      const statusLabel = formatOrderStatus(order.status);
      const note =
        Array.isArray(order.notes) && order.notes.length
          ? order.notes[order.notes.length - 1].text
          : "";
      return `
        <article class="card">
          <div class="segment">
            <strong>Mã:</strong> ${order.id}
            <span class="status">${statusLabel}</span>
          </div>
          <p><strong>Khách:</strong> ${order.customer?.name || "Khách vãng lai"}</p>
          <p><strong>Tổng:</strong> ${totalLabel}</p>
          <p><strong>Thời gian:</strong> ${timestamp}</p>
          <p class="helper">${note || "Chưa có ghi chú admin."}</p>
          <button class="btn secondary small confirm-ship" data-order-id="${order.id}" type="button">
            Xác nhận ship
          </button>
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
    if (meta) meta.textContent = `Đã cập nhật ${new Date().toLocaleTimeString("vi-VN")}`;
  };

  const CUSTOMER_SECTION_IDS = ["adminNewCustomersList", "customerList"];

  const renderAdminNewCustomers = (container, limit = 6) => {
    if (!container) return;
    const customers = Object.values(getCustomers());
    if (!customers.length) {
      container.innerHTML =
        '<div class="card soft"><p>Chưa có khách hàng được ghi nhận trên hệ thống.</p></div>';
      return;
    }
    const ordersList = getOrders();
    const products = getProducts();
    const settings = getSettings();
    const sorted = customers
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
        return `
          <article class="customer-card ${isFresh ? "customer-card--fresh" : ""}">
            <div class="customer-card-head">
              <div>
                <strong>${customer.name || "Khách hàng"}</strong>
                <span class="helper">${customer.phone || "Chưa có số điện thoại"}</span>
              </div>
              <div class="customer-card-head-meta">
                <span class="helper">${createdLabel}</span>
                <span class="badge">Mã ${customer.code}</span>
              </div>
            </div>
            <div class="customer-card-stats">
              <span>Đơn: ${customerOrders.length}</span>
              <span>Đã TT: ${formatNumber(totalPaid)} ₫</span>
              <span>Chưa TT: ${formatNumber(outstanding)} ₫</span>
            </div>
            <div class="customer-card-meta">
              <span>${customer.fb || "Facebook chưa cập nhật"}</span>
              <span class="helper">Mới nhất: ${lastOrderLabel}</span>
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
  };

  const renderAllCustomerSections = () => {
    CUSTOMER_SECTION_IDS.forEach((id) => {
      renderAdminNewCustomers(document.getElementById(id));
    });
  };

  const handleCustomerCardAction = (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const code = button.dataset.code;
    if (!code) return;
    if (action === "delete-customer") {
      const customers = getCustomers();
      if (!customers[code]) return;
      delete customers[code];
      setCustomers(customers);
      renderAllCustomerSections();
      showOrderNotice(`Đã xóa khách hàng ${code}.`);
      return;
    }
    if (action === "view-orders") {
      window.location.href = `admin-orders.html?customer=${code}`;
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
    if (snapshot.orders) writeStore(KEYS.orders, snapshot.orders);
    if (snapshot.customers) writeStore(KEYS.customers, snapshot.customers);
    if (snapshot.cart) writeStore(KEYS.cart, snapshot.cart);
    if (snapshot.wishlist) writeStore(KEYS.wishlist, snapshot.wishlist);
    if (snapshot.recent) writeStore(KEYS.recent, snapshot.recent);
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
    if (!existingProducts || !Array.isArray(existingProducts) || !existingProducts.length) {
      writeStore(KEYS.products, DEFAULT_PRODUCTS);
    } else {
      const defaultMap = new Map(DEFAULT_PRODUCTS.map((item) => [item.id, item]));
      const merged = existingProducts.map((item) =>
        defaultMap.has(item.id) ? { ...defaultMap.get(item.id), ...item } : item
      );
      const existingIds = new Set(existingProducts.map((item) => item.id));
      DEFAULT_PRODUCTS.forEach((item) => {
        if (!existingIds.has(item.id)) merged.push(item);
      });
      writeStore(KEYS.products, merged);
    }
    if (!store.getItem(KEYS.cart)) writeStore(KEYS.cart, []);
    if (!store.getItem(KEYS.orders)) writeStore(KEYS.orders, []);
    if (!store.getItem(KEYS.customers)) writeStore(KEYS.customers, {});
    if (!store.getItem(KEYS.wishlist)) writeStore(KEYS.wishlist, []);
    if (!store.getItem(KEYS.recent)) writeStore(KEYS.recent, []);
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
    updateBackup();
  };

  const getSettings = () =>
    normalizeSettings(readStore(KEYS.settings, DEFAULT_SETTINGS));
  const setSettings = (settings) =>
    writeStore(KEYS.settings, { ...normalizeSettings(settings), updatedAt: Date.now() });

  const getProducts = () => readStore(KEYS.products, DEFAULT_PRODUCTS);
  const setProducts = (products) => writeStore(KEYS.products, products);

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

  const getVisibleProducts = () =>
    getProducts().filter((product) => !product.hidden && !product.deletedAt);

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

    if (sortFilter.value === "price-asc") {
      results = results.sort(
        (a, b) => applyProductFee(a.basePrice) - applyProductFee(b.basePrice)
      );
    }
    if (sortFilter.value === "price-desc") {
      results = results.sort(
        (a, b) => applyProductFee(b.basePrice) - applyProductFee(a.basePrice)
      );
    }
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

  const SYNC_KEYS = [KEYS.settings, KEYS.products, KEYS.orders, KEYS.customers];
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

  const renderPaymentSummary = (orders) => {
    const settings = getSettings();
    const products = getProducts();
    const stats = orders.reduce(
      (acc, order) => {
        if (order.status === STATUS.CANCELLED) return acc;
        const totals = computeTotals(order, settings, products);
        const confirmed = order.paymentStatus === PAYMENT_STATUS.CONFIRMED;
        if (!confirmed) {
          acc.pending += 1;
          acc.outstandingJPY += totals.totalJPY;
          acc.outstandingVND += totals.totalVND;
        } else {
          acc.paid += 1;
        }
        if (order.status === STATUS.SHIP_CONFIRMED) acc.shipConfirmed += 1;
        return acc;
      },
      { pending: 0, paid: 0, shipConfirmed: 0, outstandingJPY: 0, outstandingVND: 0 }
    );
    const latestOrder = orders[orders.length - 1];
    const latestTotals = latestOrder
      ? computeTotals(latestOrder, settings, products)
      : null;
    return `
      <div class="payment-summary-grid">
        <article class="payment-summary-card">
          <p class="helper">Đơn đang theo dõi</p>
          <strong>${orders.length}</strong>
          <span>${stats.pending} chưa thanh toán · ${stats.paid} đã hoàn tất</span>
        </article>
        <article class="payment-summary-card">
          <p class="helper">Giá trị cần thanh toán</p>
          <strong>JPY ${formatNumber(stats.outstandingJPY)} · VND ${formatNumber(
            stats.outstandingVND
          )}</strong>
          <span>${stats.shipConfirmed} đơn đã xác nhận ship</span>
        </article>
        <article class="payment-summary-card">
          <p class="helper">Đơn mới nhất</p>
          <strong>${latestOrder ? latestOrder.code : "-"}</strong>
          <span>${
            latestTotals
              ? `JPY ${formatNumber(latestTotals.totalJPY)} · VND ${formatNumber(
                  latestTotals.totalVND
                )}`
              : "Chưa có đơn hàng"
          }</span>
        </article>
      </div>
    `;
  };

  const renderPaymentHistory = (orders) => {
    const products = getProducts();
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

  const hashString = (value) => {
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
      return hashString(parts).slice(0, 6).padStart(4, "0");
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

  const showNotification = (message = "", variant = "info", duration = 3200) => {
    const trimmedMessage = message.toString().trim();
    if (!trimmedMessage) return;
    const center = ensureNotificationCenter();
    const toast = document.createElement("div");
    toast.className = `toast toast-${variant}`;
    toast.textContent = trimmedMessage;
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
    const timeoutId = setTimeout(dismiss, duration);
    toast.addEventListener("click", () => {
      clearTimeout(timeoutId);
      dismiss();
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
      const highlightBadge = (product.tags && product.tags.length ? product.tags[0] : "New").toString().toUpperCase();
      const displayName = escapeHtml(getDisplayName(product));
      const imageMarkup = heroImage
        ? `<img class="product-image-inner" src="${escapeHtml(heroImage)}" loading="eager" alt="${displayName}" />`
        : "";
      return `
      <article class="card product-card ${wished ? "is-wish" : ""}" data-product-card data-id="${product.id}" tabindex="0">
        <button class="wish-btn ${wished ? "active" : ""}" type="button" data-wish="${product.id}" aria-pressed="${wished}" aria-label="${wished ? "Bỏ lưu" : "Lưu"}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21s-6.7-4.4-9.3-8.2C.6 9.4 2.2 5.8 5.7 5.1c2-.4 3.8.3 5 1.8 1.2-1.5 3-2.2 5-1.8 3.5.7 5.1 4.3 3 7.7C18.7 16.6 12 21 12 21z"></path>
          </svg>
        </button>
        <div class="product-image">
          <span class="product-highlight-badge">${highlightBadge}</span>
          ${imageMarkup}
          <div class="product-image-gloss"></div>
          <div class="product-meta-overlay">
            <h3 class="product-title">${displayName}</h3>
            <div class="price price-main">${formatCurrency(baseWithFee, settings.baseCurrency)}</div>
          </div>
        </div>
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

    if (!products.length) {
      removeSentinel();
      container.innerHTML = "<div class=\"card empty-state\">Không tìm thấy sản phẩm phù hợp.</div>";
      return;
    }

    const cardsHtml = products.map((product) => buildProductCard(product, settings)).join("");

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

  const setupInfiniteScroll = (container, allProducts, renderCallback) => {
    let intersectionObserver = null;
    const loadMore = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target); // Stop observing current sentinel
          const currentOffset = Number(entry.target.dataset.offset);
          renderCallback(currentOffset, container); // Call the function to render more products
        }
      });
    };

    intersectionObserver = new IntersectionObserver(loadMore, {
      root: null, // viewport
      rootMargin: "0px",
      threshold: 0.1, // Trigger when 10% of the sentinel is visible
    });

    // Observe the sentinel only if it exists
    const sentinel = container.querySelector(".load-more-sentinel");
    if (sentinel) {
      intersectionObserver.observe(sentinel);
    }
    return intersectionObserver; // Return the observer so it can be disconnected later
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
    const featuredGrid = document.getElementById("featuredGrid");
    renderRatePanel(document.getElementById("homeRates"), settings);
    if (featuredGrid) {
      renderProductGrid(products.slice(0, 3), featuredGrid, "compact");
    }
    renderWishlistSections();
    bindSearchRedirect(
      document.getElementById("homeSearch"),
      document.getElementById("homeSearchBtn"),
      "shop.html"
    );
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
    const PRODUCTS_PER_PAGE = 12; // batch size used for both teaser and infinite scroll
    let allFilteredProducts = [];
    let productsRendered = 0;
    let infiniteScrollObserver = null;
    let viewMode = store.getItem(KEYS.viewMode) || "grid";
    if (grid) {
      grid.innerHTML = '<div class="card empty-state">Đang tải sản phẩm từ server...</div>';
      const teaserProducts = getProducts().slice(0, PRODUCTS_PER_PAGE);
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

    const renderProductBatch = (offset, currentContainer, append = false) => {
      const productsToRender = allFilteredProducts.slice(offset, offset + PRODUCTS_PER_PAGE);
      const hasMore = offset + productsToRender.length < allFilteredProducts.length;
      const nextOffset = hasMore ? offset + productsToRender.length : 0;
      renderProductGrid(productsToRender, currentContainer, viewMode, append, nextOffset);
      productsRendered = offset + productsToRender.length;

      // Disconnect previous observer if exists
      if (infiniteScrollObserver) {
        infiniteScrollObserver.disconnect();
        infiniteScrollObserver = null;
      }

      // If there are more products to load, setup new observer
      if (productsRendered < allFilteredProducts.length) {
        infiniteScrollObserver = setupInfiniteScroll(currentContainer, allFilteredProducts, (newOffset, newContainer) => {
          renderProductBatch(newOffset, newContainer, true);
        });
      }
    };

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

      productsRendered = 0; // Reset rendered count on new filter
      if (infiniteScrollObserver) {
        infiniteScrollObserver.disconnect(); // Disconnect old observer
        infiniteScrollObserver = null;
      }

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
      
      grid.innerHTML = ''; // Clear existing products before rendering new ones
      renderProductBatch(0, grid); // Render the first batch
    };

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

    [searchInput, priceMin, priceMax].forEach((input) => {
      input.addEventListener("input", applyFilters);
    });
    [sizeFilter, categoryFilter, sortFilter].forEach((select) => {
      select.addEventListener("change", applyFilters);
    });

    const metadataStatus = document.getElementById("shopMetadataStatus");
    if (metadataStatus) {
      metadataStatus.classList.remove("success", "error");
      metadataStatus.textContent = "Đang cập nhật bộ lọc...";
    }
    const metadata = await fetchShopMetadata();
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

    setViewMode(viewMode);
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
    const products = getProducts();
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

    if (!product || product.hidden || product.deletedAt) {
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
      return;
    }

    let selectedSize = "";
    addRecent(product.id);
    const price = convertPrice(product.basePrice, settings);
    const baseWithFee = applyProductFee(product.basePrice);
    const palette = product.palette?.length ? product.palette : ["#2a2f45", "#374766", "#ffb347"];
    const images = getProductImages(product);

    if (images.length) {
      productMain.innerHTML = `<img src="${images[0]}" alt="${product.name}" />`;
      productMain.style.background = "none";
    } else {
      productMain.innerHTML = "";
      productMain.style.background = `linear-gradient(140deg, ${palette.join(", ")})`;
    }

    if (images.length) {
      productThumbs.innerHTML = images
        .map(
          (src, index) =>
            `<button class="thumb ${index === 0 ? "active" : ""}" type="button" data-src="${src}" aria-label="Ảnh ${index + 1}">\n              <img src="${src}" alt=\"\" loading=\"lazy\" />\n            </button>`
        )
        .join("");
    } else {
      productThumbs.innerHTML = palette
        .map((color) => `<div class="card" style="height:70px;background:${color};"></div>`)
        .join("");
    }
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
    if (productStock) {
      const totalStock = Object.values(product.stock || {}).reduce((sum, qty) => sum + qty, 0);
      productStock.textContent = totalStock > 0 ? "Còn hàng" : "Hết hàng";
      productStock.className = `status ${totalStock > 0 ? "green" : "red"}`;
    }
    productName.textContent = product.name;
    productDesc.textContent = product.desc;
    productPrices.innerHTML = `
      <strong>${formatCurrency(baseWithFee, settings.baseCurrency)}</strong>
      <span>JPY ${formatNumber(price.jpy)}</span>
      <span>VND ${formatNumber(price.vnd)}</span>
    `;

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
      if (stickyBuyPrice) {
        stickyBuyPrice.textContent = `${formatCurrency(
          baseWithFee,
          settings.baseCurrency
        )} · JPY ${formatNumber(price.jpy)}`;
      }
      if (stickyBuySize) stickyBuySize.textContent = "Chưa chọn size";
      if (stickyAdd) stickyAdd.disabled = true;
      if (stickyBuyNow) stickyBuyNow.disabled = true;
    }

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
      productMain.innerHTML = `<img src="${src}" alt="${product.name}" />`;
      document.querySelectorAll(".thumb").forEach((node) => node.classList.remove("active"));
      btn.classList.add("active");
    });

    const addToCart = () => {
      if (!selectedSize) return false;
      const cart = getCart();
      const color = product.defaultColor || "";
      const existing = cart.find((item) => {
        const entryColor = item.color || product?.defaultColor || "";
        return (
          item.id === product.id &&
          item.size === selectedSize &&
          entryColor === color
        );
      });
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({ id: product.id, size: selectedSize, qty: 1, source: product.source, color });
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
        sizeHint.textContent = "Vui lòng chọn size trước khi thêm giỏ.";
      }
    };
    const handleBuy = () => {
      if (addToCart()) window.location.href = "cart.html";
      else sizeHint.textContent = "Vui lòng chọn size trước khi mua ngay.";
    };

    addToCartBtn.addEventListener("click", handleAdd);
    buyNowBtn.addEventListener("click", handleBuy);
    if (stickyAdd) stickyAdd.addEventListener("click", handleAdd);
    if (stickyBuyNow) stickyBuyNow.addEventListener("click", handleBuy);

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
          return `
            <div class="card cart-item">
              <div class="cart-thumb">${thumbMarkup}</div>
              <div class="cart-info">
                <div class="segment">
                  <strong>${product.name}</strong>
                  <span class="tag">Size ${item.size}</span>
                  ${colorLabel ? `<span class="tag">Màu ${colorLabel}</span>` : ""}
                  <span class="tag">${sourceLabel(item.source)}</span>
                </div>
                <div class="price">
                  <span>${formatCurrency(baseWithFee, settings.baseCurrency)}</span>
                  <span>JPY ${formatNumber(price.jpy)}</span>
                  <span>VND ${formatNumber(price.vnd)}</span>
                </div>
                <div class="segment">
                  <button class="btn ghost small" data-action="dec" data-id="${item.id}" data-size="${item.size}" data-color="${colorLabel}">-</button>
                  <span>${item.qty}</span>
                  <button class="btn ghost small" data-action="inc" data-id="${item.id}" data-size="${item.size}" data-color="${colorLabel}">+</button>
                  <button class="btn ghost small" data-action="remove" data-id="${item.id}" data-size="${item.size}" data-color="${colorLabel}">Xoá</button>
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
      const cart = getCart();
      const products = getProducts();
      const item = cart.find((entry) => {
        const product = products.find((prod) => prod.id === entry.id);
        const entryColor = entry.color || product?.defaultColor || "";
        return entry.id === id && entry.size === size && entryColor === color;
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
        };
      });
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
      const ordersList = getOrders();
      ordersList.push(order);
      setOrders(ordersList);
      setCart([]);
      updateCartBadge();
      form.reset();
      fillCheckoutFormWithProfile();
      persistOrderToBackend(order);
      showNotification("Đơn hàng gửi thành công. Chuyển sang phần thanh toán...", "success");
      setTimeout(() => redirectToPaymentPage(order.code), 1200);
    });
  };

  const renderPaymentResult = (order) => {
    const settings = getSettings();
    const products = getProducts();
    const totals = computeTotals(order, settings, products);
    const expired = order.paymentExpiresAt && Date.now() > order.paymentExpiresAt;
    const quoteReady = Boolean(order.shipFee && !Number.isNaN(order.shipFee) && order.shipFee > 0);
    const paymentGateActive = Boolean(settings.paymentGateOpen && quoteReady);
    const paymentBlocked = expired || !paymentGateActive;
    const disablePayment = paymentBlocked;
    const itemsMarkup = renderOrderItems(order, products);
    const timelineMarkup = renderTimeline(order);
    const customerCode = order.customerCode || getDeviceCustomerCode();
    const gateLabel = quoteReady ? "Cổng thanh toán mở" : "Cổng thanh toán tạm đóng";
    const gateClass = quoteReady ? "green" : "orange";
    const gateHint = quoteReady
      ? `Ship: JPY ${formatNumber(totals.shipJPY)} · VND ${formatNumber(totals.shipVND)}`
      : "Admin sẽ cập nhật giá ship và gửi tin nhắn Messenger khi có thông tin.";
    const gateAlert = expired
      ? "Mã đã hết hạn, vui lòng liên hệ admin để tạo lại mã thanh toán."
      : !quoteReady
      ? "Cổng thanh toán chỉ mở sau khi admin báo giá ship."
      : !settings.paymentGateOpen
      ? "Cổng đang đóng vì admin chưa bật cổng thanh toán."
      : "";
    const messengerNote = order.lastMessengerNotifiedAt
      ? `Đã gửi Messenger lúc ${formatDateTime(order.lastMessengerNotifiedAt)}.`
      : "Admin sẽ gửi Messenger thông báo.";
    const statusClass = expired ? "red" : quoteReady ? "green" : "orange";
    const statusLabel = expired ? "Đã hết hạn" : quoteReady ? "Cổng mở" : "Chờ báo giá";
    return `
      <div class="card payment-basic-info">
        <div class="segment">
          <div>
            <p class="helper">Mã đơn</p>
            <strong>${order.code}</strong>
          </div>
          <span class="status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="segment compact">
          <p><strong>Trạng thái:</strong> ${formatOrderStatus(order.status)}</p>
          <p><strong>Thanh toán:</strong> ${formatPaymentStatus(order.paymentStatus)}</p>
          <p><strong>Mã thanh toán:</strong> ${order.paymentCode || order.code}</p>
        </div>
      </div>
      <div class="card total-glow">
        <p class="helper">Tổng khách cần trả</p>
        <strong>JPY ${formatNumber(totals.totalJPY)}</strong>
        <span>VND ${formatNumber(totals.totalVND)}</span>
      </div>
      <div class="card gate-card">
        <div class="gate-status">
          <span class="status ${gateClass}">${gateLabel}</span>
          <p class="helper">${gateHint}</p>
        </div>
      </div>
      <div class="card">
        <h4>Sản phẩm khách mua</h4>
        ${itemsMarkup}
      </div>
      <div class="card">
        <h4>Tiến trình đơn hàng</h4>
        <div class="timeline">${timelineMarkup}</div>
      </div>
      <div class="grid-2">
        <div class="card soft">
          <h4>Chuyển khoản JP</h4>
          <p>${settings.bankJP}</p>
        </div>
        <div class="card soft">
          <h4>Chuyển khoản VN</h4>
          <p>${settings.bankVN}</p>
        </div>
      </div>
      <div class="card">
        <div class="field">
          <label>Upload bill (jpg/png/pdf ≤ 5MB)</label>
          <input id="billUpload" type="file" accept=".jpg,.jpeg,.png,.pdf" ${disablePayment ? "disabled" : ""} />
        </div>
        <button class="btn primary" id="submitBill" type="button" ${disablePayment ? "disabled" : ""}>Gửi bill</button>
        ${
          gateAlert
            ? `<p class="alert">${gateAlert}</p>`
            : ""
        }
      </div>
    `;
  };

  const initPayment = () => {
    const activity = document.getElementById("paymentActivity");
    const modal = document.getElementById("paymentDetailModal");
    const modalContent = document.getElementById("paymentDetailContent");
    const modalClose = document.getElementById("paymentDetailClose");
    const highlightOrderCode = new URLSearchParams(window.location.search).get("order");

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

    const openOrderDetail = (order) => {
      if (!modal || !modalContent) return;
      modalContent.innerHTML = renderPaymentResult(order);
      modal.dataset.activeOrder = order.code;
      modal.classList.remove("hidden");
      copyCustomerCodeToClipboard();
    };

    const closeOrderDetail = () => {
      if (!modal) return;
      modal.classList.add("hidden");
      modal.dataset.activeOrder = "";
    };

    const renderActivity = () => {
      if (!activity) return;
      const orders = getCustomerOrders();
      activity.innerHTML = `
        ${renderPaymentSummary(orders)}
        ${renderPaymentHistory(orders)}
      `;
    };

    const findOrderByCode = (code) => {
      const orders = getOrders();
      return orders.find((entry) => entry.paymentCode === code || entry.code === code);
    };

    const handleActivityClick = (event) => {
      const nearby = event.target.closest("[data-order-code]");
      const card = event.target.closest(".history-card");
      const code = nearby?.dataset?.orderCode || card?.dataset?.orderCode;
      if (!code) return;
      const order = findOrderByCode(code);
      if (!order) return;
      openOrderDetail(order);
    };

    const handleBillSubmission = (event) => {
      if (event.target.id !== "submitBill") return;
      const code = modal?.dataset?.activeOrder;
      if (!code) return;
      const orders = getOrders();
      const orderIndex = orders.findIndex(
        (entry) => entry.paymentCode === code || entry.code === code
      );
      if (orderIndex < 0) return;
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
      const order = orders[orderIndex];
      const finalizeBill = (preview) => {
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
          message: "Khách đã upload bill chuyển khoản.",
        });
        setOrders(orders);
        const updatedSettings = getSettings();
        if (updatedSettings.paymentGateOpen) {
          updatedSettings.paymentGateOpen = false;
          setSettings(updatedSettings);
        }
        renderActivity();
        closeOrderDetail();
        showOrderNotice("Thanh toán đã được xác nhận, cổng thanh toán đã đóng.");
      };
      if (file.type.startsWith("image/")) {
        generateBillPreview(file).then((preview) => finalizeBill(preview));
      } else {
        finalizeBill("");
      }
    };

    renderActivity();

    if (highlightOrderCode) {
      const focusOrder = findOrderByCode(highlightOrderCode);
      if (focusOrder) {
        setTimeout(() => openOrderDetail(focusOrder), 220);
      }
    }

    if (activity) {
      activity.addEventListener("click", handleActivityClick);
    }
    if (modal) {
      modalClose?.addEventListener("click", closeOrderDetail);
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeOrderDetail();
      });
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

  const STATUS_OVERVIEW = [
    { status: STATUS.PENDING_QUOTE, label: "Chờ báo giá", hint: "Liên hệ khách khi có báo giá" },
    { status: STATUS.QUOTED_WAITING_PAYMENT, label: "Chờ thanh toán", hint: "Đã gửi hóa đơn" },
    { status: STATUS.PAYMENT_UNDER_REVIEW, label: "Đang xác nhận", hint: "Kiểm tra bill ngân hàng" },
    { status: STATUS.PAID, label: "Đã thanh toán", hint: "Chuyển sang giao hàng" },
    { status: STATUS.CANCELLED, label: "Đã hủy", hint: "Cần xác nhận nguyên nhân" },
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
        <div class="card soft status-card" data-status="${entry.status}">
          <span class="status-card-badge">•</span>
          <strong>${count}</strong>
          <p>${entry.label}</p>
          <span class="hint">${entry.hint}</span>
        </div>
      `;
    }).join("");
  };

  const fetchAutoImportStatusPayload = async () => {
    const settings = getSettings();
    const endpoint = buildAutoImportUrl(settings, "/auto-import/status");
    if (!endpoint) return null;
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        headers: settings.apiKey ? { "x-api-key": settings.apiKey } : {},
      });
      ensureImporterSupported(response, "Không lấy được trạng thái auto import.");
      return await response.json();
    } catch (error) {
      console.warn("Auto import status unavailable:", error);
      return null;
    }
  };

  const createAdminInsightCard = ({ value, label, hint }) => `
    <div class="card soft admin-insight-card">
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(label)}</p>
      ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ""}
    </div>
  `;

  const updateDashboardAutoImportHint = (stateLabel, detailLine) => {
    const hintEl = document.getElementById("dashboardAutoImportHint");
    if (!hintEl) return;
    const detailSegment = detailLine ? ` · ${detailLine}` : "";
    hintEl.textContent = `Auto import: ${stateLabel || "chưa khởi chạy"}${detailSegment}`;
  };

  const renderAdminInsights = async (container) => {
    if (!container) return;
    const placeholder = `<div class="card soft admin-insight-card"><p>Đang thu thập dữ liệu...</p></div>`;
    container.innerHTML = placeholder;
    const settings = getSettings();
    const orders = getOrders();
    const products = getProducts();
    const visibleProducts = getVisibleProducts().length;
    const snapshot = getSnapshot();
    const orderCount = orders.length;
    const totalRevenueVND = orders.reduce((sum, order) => {
      const totals = computeTotals(order, settings, products);
      return sum + (totals.totalVND || 0);
    }, 0);
    const paidOrders = orders.filter((order) => order.paymentStatus === PAYMENT_STATUS.CONFIRMED);
    const syncTimestamp = snapshot?.meta?.updatedAt || settings.lastSync;
    const autoImportPayload = await fetchAutoImportStatusPayload();
    const autoState = autoImportPayload?.state || {};
    const autoStatusLabel = autoState.running ? "Đang chạy" : "Tạm dừng";
    const autoStatusHint = autoState.message
      ? autoState.message
      : autoImportPayload
      ? "Sẵn sàng"
      : "Chưa khởi tạo";
    const autoLogSnippet = autoImportPayload?.log
      ? autoImportPayload.log.split("\n").slice(-2).join(" / ")
      : "";
    const autoHintText = [autoStatusHint, autoLogSnippet].filter(Boolean).join(" · ");
    updateDashboardAutoImportHint(autoStatusLabel, autoHintText);
    const syncDisplay = syncTimestamp ? formatDateTime(syncTimestamp) : "Chưa sync";
    const syncHint = snapshot?.meta?.updatedAt
      ? `Đã cập nhật ${formatNumber(snapshot.products?.length || 0)} sản phẩm`
      : "Chưa đồng bộ";
    const cards = [
      {
        value: formatNumber(orderCount),
        label: "Tổng đơn hàng",
        hint: `${formatNumber(paidOrders.length)} đơn đã thanh toán`,
      },
      {
        value: formatCurrency(totalRevenueVND, "VND"),
        label: "Doanh thu ước tính (VND)",
        hint: `${formatNumber(paidOrders.length)} đơn đã xác nhận`,
      },
      {
        value: formatNumber(visibleProducts),
        label: "Sản phẩm hiển thị",
        hint: `${formatNumber(products.length)} mục trong kho`,
      },
      {
        value: syncDisplay,
        label: "Lần sync gần nhất",
        hint: syncHint,
      },
      {
        value: autoStatusLabel,
        label: "Auto-import",
        hint: autoHintText,
      },
    ];
    container.innerHTML = cards.map(createAdminInsightCard).join("");
  };

  const renderOrdersTable = (container, statusFilter = "all") => {
    if (!container) return;
    const products = getProducts();
    const settings = getSettings();
    let ordersList = getOrders();
    if (statusFilter && statusFilter !== "all") {
      ordersList = ordersList.filter((order) => order.status === statusFilter);
    }
    const rows = ordersList.length
      ? ordersList
          .map((order) => {
            const totals = computeTotals(order, settings, products);
            return `
              <tr>
                <td>${order.code}</td>
                <td>${order.customerCode}</td>
                <td>${formatOrderStatus(order.status)}</td>
                <td>${formatPaymentStatus(order.paymentStatus)}</td>
                <td>${formatNumber(totals.totalVND)}</td>
                <td>${renderOrderItems(order, products)}</td>
                <td>
                  <div class="segment" style="gap:.2rem;">
                    <button class="btn ghost small" data-action="edit" data-code="${order.code}" type="button">Sửa</button>
                    <button class="btn ghost small" data-action="delete" data-code="${order.code}" type="button">Xóa</button>
                  </div>
                </td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="7">Chưa có đơn hàng.</td></tr>`;
    container.innerHTML = `
      <tr>
        <th>Mã đơn</th>
        <th>Mã khách</th>
        <th>Trạng thái</th>
        <th>Thanh toán</th>
        <th>Tổng (VND)</th>
        <th>Sản phẩm</th>
        <th>Hành động</th>
      </tr>
      ${rows}
    `;
  };

  const renderOrderSelect = (select, selectedCode = "") => {
    if (!select) return "";
    const ordersList = getOrders();
    if (!ordersList.length) {
      select.innerHTML = "<option value=\"\">Chưa có đơn</option>";
      return "";
    }
    select.innerHTML = ordersList
      .map((order) => `<option value="${order.code}">${order.code}</option>`)
      .join("");
    const nextCode = selectedCode || ordersList[ordersList.length - 1].code;
    select.value = nextCode;
    return nextCode;
  };

  const initAdminDashboard = () => {
    if (!requireAdminAuth()) return;
    bindAdminLogout();
    const autoImportQuickBtn = document.getElementById("dashboardAutoImportRun");
    const autoImportOpenBtn = document.getElementById("dashboardAutoImportOpen");
    if (autoImportQuickBtn) {
      autoImportQuickBtn.addEventListener("click", async () => {
        autoImportQuickBtn.disabled = true;
        try {
          await runAutoImport();
        } finally {
          autoImportQuickBtn.disabled = false;
          renderAdminInsights(document.getElementById("overviewStats")).catch((error) => {
            console.error("Không thể làm mới insight sau auto import:", error);
          });
        }
      });
    }
    if (autoImportOpenBtn) {
      autoImportOpenBtn.addEventListener("click", () => {
        window.location.href = "admin-settings.html#autoImport";
      });
    }
    renderStatusStats(document.getElementById("statusStats"));
    renderAdminInsights(document.getElementById("overviewStats")).catch((error) => {
      console.error("Không thể tải thông tin tổng quan admin:", error);
    });
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
    renderAllCustomerSections();
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
      const lines = [
        `Tên: ${data.name || "-"}`,
        `Giá: ${
          typeof data.price === "number" ? `${formatNumber(data.price)} CNY` : data.price || "-"
        }`,
        `Mô tả: ${data.desc || "-"}`,
        `Sizes: ${
          Array.isArray(data.sizes) && data.sizes.length ? data.sizes.join(", ") : "-"
        }`,
      ];
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
    const productImagePreview = document.getElementById("productImagePreview");
    const productHidden = document.getElementById("productHidden");
    const addProduct = document.getElementById("addProduct");
    const updateProduct = document.getElementById("updateProduct");
    const resetProduct = document.getElementById("resetProduct");

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

    let activeProductId = "";
    let importedImages = [];
    let bulkQueue = [];
    let bulkQueuePrices = new Map();
    let bulkQueueNames = new Map();
    let bulkQueueImages = new Map();
    let bulkQueueSizes = new Map();
    let bulkQueueDescs = new Map();
    let importedMeta = null;

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
      let jsonExtract = { name: "", desc: "", price: null, images: [], sizes: [] };
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
        rating,
        ratingCount,
        positiveRate,
        soldCount,
      };
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
      if (productColor) productColor.value = "";
      if (productDefaultSize) productDefaultSize.value = "";
      if (productHidden) productHidden.checked = false;
      renderImagePreview("");
      setAutoHint("Nhập link và bấm thử lấy dữ liệu.");
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
      setAutoHint(`${note}${baseText}${missingText}`.trim());
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
      let items = getProducts().filter((product) => !product.deletedAt);
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
        return;
      }
      productList.innerHTML = items
        .map((product) => {
          const images = getProductImages(product);
          const thumb = images[0];
          const fallback = (product.name || "SP").slice(0, 2).toUpperCase();
          const tags = (product.tags || []).slice(0, 2).map((tag) => `<span class=\"tag\">${tag}</span>`).join("");
          const priced = applyProductFee(product.basePrice);
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
        product.deletedAt = Date.now();
        product.hidden = true;
        product.updatedAt = Date.now();
        setProducts(products);
        if (activeProductId === id) resetForm();
        renderProductList();
      }
    });

    if (productImage) {
      renderImagePreview(productImage.value.trim());
      productImage.addEventListener("input", () => {
        renderImagePreview(productImage.value.trim());
      });
    }

    if (productImages) {
      productImages.addEventListener("input", () => {
        renderImagePreview(productImage ? productImage.value.trim() : "");
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
        const extracted = {
          ...extractFromHtml(raw, baseUrl || ""),
          source: baseUrl ? inferSourceFromUrl(baseUrl) : "web",
          sourceUrl: baseUrl || "",
        };
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
            stock: sizes.reduce((acc, size) => ({ ...acc, [size]: 3 }), {}),
            palette: ["#2a2f45", "#374766", "#ffb347"],
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
            products[index] = {
              ...product,
              image,
              images: finalImages,
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
        const meta = importedMeta || {};
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
        stock: sizes.reduce((acc, size) => ({ ...acc, [size]: 3 }), {}),
          palette: ["#2a2f45", "#374766", "#ffb347"],
          image,
          images: finalImages,
          rating: meta.rating ?? null,
          ratingCount: meta.ratingCount ?? null,
          positiveRate: meta.positiveRate ?? null,
          soldCount: meta.soldCount ?? null,
          hidden: productHidden?.checked || false,
          createdAt: now,
          updatedAt: now,
        });
        setProducts(products);
        renderProductList();
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
        const stock = sizes.reduce((acc, size) => {
          acc[size] = currentStock[size] ?? 3;
          return acc;
        }, {});
        const imagesInput = collectImageInputs();
        const existingImages = products[index].images || [];
        const pendingImages = imagesInput.length ? imagesInput : existingImages;
        const cachedImages = await cacheProductImages(pendingImages, getSettings());
        const finalImages = cachedImages.length ? cachedImages : pendingImages;
        const sourceUrl = productLink ? productLink.value.trim() : products[index].sourceUrl || "";
        const meta = importedMeta || {};
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
          updatedAt: Date.now(),
        };
        setProducts(products);
        renderProductList();
        fillProductForm(products[index]);
      });
    }

    if (resetProduct) {
      resetProduct.addEventListener("click", resetForm);
    }

    renderProductList();
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

    let editingOrderCode = "";

    const setEditorMessage = (message) => {
      if (orderEditMessage) orderEditMessage.textContent = message;
    };

    const refreshOrdersTable = () => {
      renderOrdersTable(ordersTable, orderStatusFilter ? orderStatusFilter.value : "all");
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

    const deleteOrder = (code) => {
      if (!code) return;
      if (!window.confirm(`Bạn chắc chắn muốn xoá đơn ${code}?`)) return;
      const ordersList = getOrders().filter((entry) => entry.code !== code);
      setOrders(ordersList);
      setEditorMessage(`Đã xoá đơn ${code}.`);
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
        const fee = orderEditShipFee.value.trim();
        order.shipFee = fee ? Number(fee) || 0 : 0;
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
          ["orderCode", "customerCode", "status", "totalVND"],
          ...paidOrders.map((order) => {
            const totals = computeTotals(order, getSettings(), products);
            return [order.code, order.customerCode, formatOrderStatus(order.status), totals.totalVND];
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
