// browser-reported diagnostics only; importing this module does not collect anything.
const finiteNumber = (value) => (Number.isFinite(value) ? value : null);
const text = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function isIPad(nav) {
  return (
    /iPad/i.test(nav.userAgent) ||
    (/Macintosh/i.test(nav.userAgent) && nav.maxTouchPoints > 1)
  );
}

function readBrands(value) {
  return Array.isArray(value)
    ? value
        .filter((item) => item && typeof item.brand === "string")
        .map((item) => ({ brand: item.brand, version: text(item.version) }))
    : [];
}

function getBrowserInfo(ua, hints) {
  const result = (name, version = null, versionSource = null) => ({
    name,
    version,
    versionSource,
  });
  // explicit app markers take precedence over the embedded browser's identity.
  const apps = [
    ["Instagram", /\bInstagram(?:[ /]([\d.]+))?/i],
    ["Facebook", /\bFBAV\/([\d.]+)/i],
    ["LinkedIn", /\bLinkedInApp(?:[ /]([\d.]+))?/i],
    ["Snapchat", /\bSnapchat(?:[ /]([\d.]+))?/i],
    ["Google App", /\bGSA\/([\d.]+)/i],
  ];
  for (const [name, pattern] of apps) {
    const match = ua.match(pattern);
    if (match)
      return result(name, match[1] || null, match[1] ? "user-agent" : null);
  }
  const brands = [
    ...readBrands(hints?.fullVersionList),
    ...readBrands(hints?.brands),
  ];
  const known = [
    [["Brave"], "Brave"],
    [["Opera GX"], "Opera GX"],
    [["Microsoft Edge"], "Edge"],
    [["Opera"], "Opera"],
    [["Samsung Internet"], "Samsung Internet"],
    [["YaBrowser", "Yandex Browser", "Yandex"], "Yandex"],
    [["DuckDuckGo"], "DuckDuckGo"],
  ];
  for (const [aliases, name] of known) {
    const entry = brands.find((item) => aliases.includes(item.brand));
    // brave's client hint version identifies chromium, not the brave app release.
    if (entry)
      return name === "Brave"
        ? result(name)
        : result(name, entry.version, entry.version ? "client-hints" : null);
  }
  if (/\bBrave(?:\/\d+)?\b/i.test(ua)) return result("Brave");
  const patterns = [
    ["Edge", /(?:EdgA|EdgiOS|Edg|Edge)\/([\d.]+)/],
    ["Opera", /(?:OPR|OPiOS|OPT)\/([\d.]+)/],
    ["Meta Quest Browser", /OculusBrowser\/([\d.]+)/],
    ["Silk", /\bSilk\/([\d._-]+)\b/],
    ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
    ["Yandex", /YaBrowser\/([\d.]+)/],
    ["DuckDuckGo", /(?:Ddg|DuckDuckGo)\/([\d.]+)/i],
    ["UC Browser", /(?:UCBrowser|UCWEB)\/([\d.]+)/i],
    ["MIUI Browser", /(?:MiuiBrowser|MiBrowser)\/([\d.]+)/i],
    ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
  ];
  for (const [name, pattern] of patterns) {
    if (name === "Silk" && /PlayStation/i.test(ua)) continue;
    const match = ua.match(pattern);
    if (match) return result(name, match[1], "user-agent");
  }
  // explicit browser names win; a generic chromium token only identifies a webview's engine.
  if (/Android/i.test(ua) && /;\s*wv\)/i.test(ua))
    return result("Android WebView");
  const chrome = brands.find((item) => item.brand === "Google Chrome");
  if (chrome)
    return result(
      "Chrome",
      chrome.version,
      chrome.version ? "client-hints" : null,
    );
  const chromium = brands.find((item) => item.brand === "Chromium");
  if (chromium)
    return result(
      "Chromium",
      chromium.version,
      chromium.version ? "client-hints" : null,
    );
  for (const [name, pattern] of [
    ["Chromium", /Chromium\/([\d.]+)/],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari/],
  ]) {
    const match = ua.match(pattern);
    if (match) return result(name, match[1], "user-agent");
  }
  // this fallback identifies a webview-like ua, not which app hosts it.
  if (
    /\b(?:iPhone|iPad|iPod)\b/.test(ua) &&
    /AppleWebKit\//.test(ua) &&
    /Mobile\//.test(ua) &&
    !/\bSafari\//.test(ua)
  )
    return result("iOS WebView");
  return result("Unknown");
}

function getOS(nav, hints) {
  const ua = nav.userAgent;
  if (isIPad(nav)) return "iPadOS";
  if (/iPhone|iPod/i.test(ua)) return "iOS";
  if (/Windows Phone/i.test(ua)) return "Windows Phone";
  const platforms = {
    Android: "Android",
    Windows: "Windows",
    macOS: "macOS",
    Linux: "Linux",
    "Chrome OS": "ChromeOS",
    "Chromium OS": "ChromeOS",
    iOS: "iOS",
    Fuchsia: "Fuchsia",
  };
  if (Object.prototype.hasOwnProperty.call(platforms, hints?.platform))
    return platforms[hints.platform];
  if (/Android/i.test(ua)) return "Android";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

function getOSVersion(ua, hints, os) {
  const version = text(hints?.platformVersion);
  const knownVersion =
    version && /^\d+(?:\.\d+)*$/.test(version) && !/^0(?:\.0)*$/.test(version);
  if (knownVersion && os === "Windows") {
    const major = Number(version.split(".")[0]);
    if (major >= 13) return { version: "11 or later", source: "client-hints" };
    if (major >= 1 && major <= 10)
      return { version: "10", source: "client-hints" };
  }
  if (
    knownVersion &&
    ["Android", "macOS", "ChromeOS", "iOS", "iPadOS"].includes(os)
  ) {
    return { version, source: "client-hints" };
  }
  let reported = null;
  if (os === "Android") {
    reported = ua.match(/Android\s+([\d.]+)/i)?.[1];
    const firefoxVersion = Number(ua.match(/Firefox\/(\d+)/)?.[1]);
    if (
      /Android 10;\s*K(?:[;)])/i.test(ua) ||
      (reported === "10" && firefoxVersion >= 122)
    )
      reported = null;
  }
  if (os === "iOS" || os === "iPadOS") {
    reported = ua
      .match(/(?:CPU (?:iPhone )?OS|iPhone OS)\s+([\d_]+)/i)?.[1]
      ?.replace(/_/g, ".");
    // safari 26+ freezes this token; the safari version is not an exact os version.
    if (Number(ua.match(/Version\/(\d+)/)?.[1]) >= 26) reported = null;
    // firefox on ios also uses a fixed pre-26 os token across supported releases.
    if (/FxiOS\//.test(ua) && /^18\.(?:6|7)(?:\.\d+)?$/.test(reported || ""))
      reported = null;
    // without a safari version marker these values may be real or frozen; prefer unknown.
    if (
      !/Version\/\d+/.test(ua) &&
      /^18\.(?:6|7)(?:\.\d+)?$/.test(reported || "")
    )
      reported = null;
  }
  if (os === "macOS") {
    reported = ua.match(/Mac OS X\s+([\d_.]+)/i)?.[1]?.replace(/_/g, ".");
    if (/^10\.15(?:\.0|\.7)?$/.test(reported || "")) reported = null;
  }
  if (os === "Windows") {
    const versions = {
      6.3: "8.1",
      6.2: "8",
      6.1: "7",
      "6.0": "Vista",
      5.1: "XP",
    };
    reported = versions[ua.match(/Windows NT\s+([\d.]+)/i)?.[1]] || null;
    // windows nt 10.0 is shared by windows 10 and 11; do not guess between them.
  }
  return { version: reported || null, source: reported ? "user-agent" : null };
}

function getDeviceType(nav, hints) {
  const factors = Array.isArray(hints?.formFactors) ? hints.formFactors : [];
  const ua = nav.userAgent;
  for (const [factor, type] of [
    ["XR", "xr"],
    ["Watch", "watch"],
    ["Automotive", "automotive"],
    ["EInk", "ereader"],
  ]) {
    if (factors.includes(factor)) return type;
  }
  if (/OculusBrowser/i.test(ua)) return "xr";
  if (
    /SmartTV|SMART-TV|Tizen.+TV|Web0S|WebOS.+TV|CrKey|\bAFT\w+|BRAVIA|HbbTV|Android\s?TV|\bMIBOX\d*\b|\bGoogleTV\b|\bChromecast\b/i.test(
      ua,
    )
  )
    return "tv";
  if (factors.includes("Tablet")) return "tablet";
  if (factors.includes("Mobile")) return "mobile";
  // chromium also reports desktop for android tablets; keep the android ua distinction.
  if (
    factors.includes("Desktop") &&
    hints?.platform !== "Android" &&
    !/Android/i.test(ua)
  )
    return "desktop";
  if (
    isIPad(nav) ||
    /Tablet/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua))
  )
    return "tablet";
  if (hints?.mobile === true || /iPhone|iPod|Mobile|Android/i.test(ua))
    return "mobile";
  if (/Windows|Macintosh|Mac OS X|Linux|CrOS/i.test(ua)) return "desktop";
  return "unknown";
}

function getModel(ua, hints) {
  const hinted = text(hints?.model);
  if (hinted && hinted !== "K")
    return { model: hinted, source: "client-hints" };
  if (!/Android/i.test(ua)) return { model: null, source: null };
  // the model may contain parentheses; prefer the system comment's engine delimiter.
  const segment =
    ua.match(/Android[^;)]*;(.*?)\)\s+(?:AppleWebKit|Gecko)\//i)?.[1] ??
    ua.match(/Android[^;)]*;([^)]*)/i)?.[1];
  const parts = segment?.split(";") || [];
  for (const part of parts) {
    const model = part.replace(/\s+Build\/.*/i, "").trim();
    if (
      !model ||
      /^(?:K|wv|U|Mobile|Tablet|[a-z]{2}(?:[-_][a-z]{2})?|rv:[\d.]+)$/i.test(
        model,
      )
    )
      continue;
    return { model, source: "user-agent" };
  }
  return { model: null, source: null };
}

function getManufacturer(nav, model) {
  if (isIPad(nav) || /iPhone|iPod|Macintosh/i.test(nav.userAgent))
    return "Apple";
  // only recognizable reported brands/model prefixes are used; screen size is not a model identifier.
  const brands = [
    ["Samsung", /^(?:SAMSUNG\b|SM-|GT-|SCH-|SGH-)/i],
    ["Google", /^Pixel(?:\s|$)/i],
    ["OnePlus", /^OnePlus\b/i],
    ["Xiaomi", /^(?:Xiaomi|Redmi|POCO|Mi\s)\b/i],
    ["Motorola", /^(?:Motorola|moto)\b/i],
    ["Huawei", /^HUAWEI\b/i],
    ["Honor", /^HONOR\b/i],
    ["OPPO", /^OPPO\b/i],
    ["vivo", /^vivo\b/i],
    ["Nokia", /^Nokia\b/i],
    ["Sony", /^Sony\b/i],
    ["realme", /^(?:realme\b|RMX\d{4}[A-Z0-9]*(?:[_-][A-Z0-9]+)*$)/i],
    ["OPPO / OnePlus", /^CPH\d{4}$/i],
    ["vivo", /^[VI]2\d{3}[A-Z]*(?:[_-][A-Z0-9]+)*$/i],
    ["TECNO", /^TECNO\b/i],
    ["Infinix", /^Infinix\b/i],
    ["itel", /^itel\b/i],
  ];
  const brand = brands.find(([, pattern]) => pattern.test(model || ""))?.[0];
  if (brand) return brand;
  // this bare code is shared by redmi and a rebranded device; do not pick a maker.
  if (/^220333QAG$/i.test(model || "")) return null;
  // bounded xiaomi-family formats avoid known collisions such as m1867g and 2306004m.
  if (
    /^(?:M(?:19|20|21)\d{2}[A-Z][A-Z0-9]*|2\d{3,6}[A-Z][A-Z0-9]{1,5})$/i.test(
      model || "",
    )
  )
    return "Xiaomi";
  return null;
}

async function readHints(uaData, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() =>
        uaData.getHighEntropyValues([
          "formFactors",
          "fullVersionList",
          "model",
          "platformVersion",
        ]),
      ),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Timed out")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function getDeviceInfo(options = {}) {
  if (typeof window === "undefined" || !window.navigator || !window.document)
    return null;
  const timeoutMs = options?.timeoutMs ?? 2000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647) {
    throw new RangeError(
      "timeoutMs must be a positive finite number no greater than 2147483647",
    );
  }
  const log = (...args) => {
    if (options?.debug === true) console.log(...args);
  };
  log("device info: collection started");
  const errors = {};
  const safe = (name, read, fallback = null) => {
    try {
      return read();
    } catch (error) {
      errors[name] = error?.message || "Unavailable";
      log("device info: field unavailable", name);
      return fallback;
    }
  };
  const nav = window.navigator;
  const identity = {
    userAgent: safe("userAgent", () => text(nav.userAgent), "") || "",
    maxTouchPoints: safe("maxTouchPoints", () =>
      finiteNumber(nav.maxTouchPoints),
    ),
  };
  const uaData = safe("hints.access", () => nav.userAgentData);
  let hints = uaData
    ? {
        brands: safe("hints.brands", () => readBrands(uaData.brands), []),
        mobile: safe("hints.mobile", () =>
          typeof uaData.mobile === "boolean" ? uaData.mobile : null,
        ),
        platform: safe("hints.platform", () => text(uaData.platform)),
      }
    : null;
  if (
    safe(
      "hints.method",
      () => typeof uaData?.getHighEntropyValues === "function",
      false,
    )
  ) {
    try {
      const detailed = await readHints(uaData, timeoutMs);
      if (detailed && typeof detailed === "object") {
        hints = {
          ...hints,
          fullVersionList: safe(
            "hints.fullVersionList",
            () => readBrands(detailed.fullVersionList),
            [],
          ),
          formFactors: safe(
            "hints.formFactors",
            () =>
              Array.isArray(detailed.formFactors)
                ? detailed.formFactors.filter(
                    (item) => typeof item === "string",
                  )
                : [],
            [],
          ),
          model: safe("hints.model", () => text(detailed.model)),
          platformVersion: safe("hints.platformVersion", () =>
            text(detailed.platformVersion),
          ),
          platform:
            safe("hints.highEntropy.platform", () => text(detailed.platform)) ||
            hints.platform,
        };
      }
    } catch (error) {
      errors["hints.highEntropy"] = error?.message || "Unavailable";
      log("device info: detailed browser hints unavailable");
    }
  }
  const ua = identity.userAgent;
  const browser = safe("browser", () => getBrowserInfo(ua, hints), {
    name: "Unknown",
    version: null,
    versionSource: null,
  });
  const os = safe("os", () => getOS(identity, hints), "Unknown");
  const osVersion = safe("osVersion", () => getOSVersion(ua, hints, os), {
    version: null,
    source: null,
  });
  const deviceType = safe(
    "deviceType",
    () => getDeviceType(identity, hints),
    "unknown",
  );
  const model = safe("model", () => getModel(ua, hints), {
    model: null,
    source: null,
  });
  const preference = (feature, yes, no) => {
    if (typeof window.matchMedia !== "function") return null;
    if (window.matchMedia(`(${feature}: ${yes})`).matches) return true;
    return window.matchMedia(`(${feature}: ${no})`).matches ? false : null;
  };
  const saveData = safe("saveData", () => {
    const connection =
      nav.connection || nav.mozConnection || nav.webkitConnection;
    return typeof connection?.saveData === "boolean"
      ? connection.saveData
      : null;
  });
  const reducedData = safe("reducedData", () =>
    preference("prefers-reduced-data", "reduce", "no-preference"),
  );
  const details = {
    browser,
    os,
    osVersion: osVersion.version,
    osVersionSource: osVersion.source,
    deviceType,
    manufacturer: safe("manufacturer", () =>
      getManufacturer(identity, model.model),
    ),
    model: model.model,
    modelSource: model.source,
    // screen and viewport values are css pixels, not guaranteed physical panel resolution.
    // preserve browser-reported orientation; do not swap dimensions based on os assumptions.
    screen: {
      width: safe("screenWidth", () => finiteNumber(window.screen?.width)),
      height: safe("screenHeight", () => finiteNumber(window.screen?.height)),
      devicePixelRatio: safe("pixelRatio", () =>
        finiteNumber(window.devicePixelRatio),
      ),
    },
    viewport: {
      innerWidth: safe("viewportWidth", () => finiteNumber(window.innerWidth)),
      innerHeight: safe("viewportHeight", () =>
        finiteNumber(window.innerHeight),
      ),
    },
    preferences: {
      darkMode: safe("darkMode", () =>
        preference("prefers-color-scheme", "dark", "light"),
      ),
      // null means unavailable; this is a browser preference, not proof of os low-data mode.
      dataSaver:
        saveData === true || reducedData === true
          ? true
          : (saveData ?? reducedData),
    },
    // localhost may be secure over http; api absence is not proof of a hardware limitation.
    secureContext: safe("secureContext", () =>
      typeof window.isSecureContext === "boolean"
        ? window.isSecureContext
        : null,
    ),
    errors,
  };
  // each call refreshes screen and preferences; no canvas, gpu, media or battery probes are needed.
  log("device info: collection completed", {
    unavailableFields: Object.keys(errors),
  });
  return details;
}

export { getDeviceInfo as handleGetBrowserDetails };
export default getDeviceInfo;
