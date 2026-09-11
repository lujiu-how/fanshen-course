const EXPORT_WIDTH = 1200;
const MAX_PIXELS = 12_000_000;
const MAX_DIMENSION = 16_000;
const FILE_NAME = "番申产品运营课程详情.png";
const URL_LIFETIME = 10 * 60 * 1000;

let libraryPromise;
let exporting = false;
let lastResult;

function withTimeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

function loadHtml2Canvas() {
  if (typeof window.html2canvas === "function") return Promise.resolve(window.html2canvas);
  if (libraryPromise) return libraryPromise;

  libraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    // Resolve against the page, so the dependency is ./vendor/html2canvas.min.js.
    script.src = new URL("vendor/html2canvas.min.js", document.baseURI).href;
    script.async = true;
    const timer = setTimeout(() => fail(), 20_000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      reject(new Error("图片导出组件加载失败，请检查网络后重试。"));
    }
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timer);
      if (typeof window.html2canvas !== "function") return fail();
      resolve(window.html2canvas);
    };
    document.head.append(script);
  }).catch((error) => {
    libraryPromise = undefined;
    throw error;
  });
  return libraryPromise;
}

function setStatus(element, message) {
  if (!element) return;
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.setAttribute("aria-atomic", "true");
  element.textContent = message;
}

async function waitForImages(root) {
  await Promise.all(Array.from(root.querySelectorAll("img"), async (img) => {
    img.loading = "eager";
    await withTimeout(new Promise((resolve, reject) => {
      const done = () => {
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
        if (img.naturalWidth > 0) resolve();
        else reject(new Error("页面中的图片尚未加载成功，请稍后重试。"));
      };
      if (img.complete) done();
      else {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      }
    }), 20_000, "图片加载超时，请稍后重试。");
    if (img.decode) {
      await withTimeout(img.decode(), 20_000, "图片解码超时，请稍后重试。");
    }
  }));
}

function nextLayout() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function showResult(url, anchorElement, downloadSupported) {
  lastResult?.remove();
  const box = document.createElement("div");
  box.dataset.exportIgnore = "";
  box.className = "course-export-result";
  box.style.cssText = "margin-top:12px;font:inherit;line-height:1.6;overflow-wrap:anywhere;";

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.style.cssText = "color:inherit;text-decoration:underline;text-underline-offset:4px;";
  if (downloadSupported) {
    link.download = FILE_NAME;
    link.textContent = "再次下载完整 PNG";
  } else {
    link.textContent = "打开完整 PNG，长按图片保存";
  }
  box.append(link);
  if (anchorElement.getAttribute("role") === "status") {
    anchorElement.append(box);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "export-status-close";
    close.textContent = "关闭提示";
    close.addEventListener("click", () => anchorElement.replaceChildren());
    box.append(close);
  } else anchorElement.insertAdjacentElement("afterend", box);
  lastResult = box;

  // Keep the URL usable for browsers that defer opening or saving large files.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    if (box.isConnected) {
      box.replaceChildren(document.createTextNode("图片链接已过期，可重新生成。"));
    }
  }, URL_LIFETIME);
  return link;
}

/**
 * Export the entire visible course element, including its final section, as one PNG.
 * The page supplies .export-mode styles and vendor/html2canvas.min.js (v1.4.1).
 * UI controls inside the element must have data-export-ignore.
 * Returns { ok, width, height, fileName } or { ok: false, error | busy }.
 */
export async function exportCoursePng({ element, button, statusElement } = {}) {
  if (exporting) return { ok: false, busy: true };
  if (!(element instanceof HTMLElement) || !element.isConnected) {
    const error = new Error("没有找到完整课程内容，请刷新页面后重试。");
    setStatus(statusElement, error.message);
    return { ok: false, error };
  }

  exporting = true;
  const previousButton = button ? {
    disabled: button.disabled,
    busy: button.getAttribute("aria-busy"),
    children: Array.from(button.childNodes),
  } : null;
  let host;
  let canvas;
  let objectUrl;
  let hasResult = false;

  try {
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.replaceChildren(document.createTextNode("正在生成 PNG…"));
    }
    setStatus(statusElement, "正在生成包含全部课程的完整长图，请稍候…");
    const html2canvas = await loadHtml2Canvas();

    host = document.createElement("div");
    host.className = "course-png-export-host";
    host.setAttribute("aria-hidden", "true");
    host.inert = true;
    host.style.cssText = `position:absolute;left:-20000px;top:0;width:${EXPORT_WIDTH}px;pointer-events:none;`;
    const style = document.createElement("style");
    style.textContent = ".course-png-export-host *,.course-png-export-host *::before,.course-png-export-host *::after{animation:none!important;transition:none!important;caret-color:transparent!important;}";

    const clone = element.cloneNode(true);
    clone.classList.add("export-mode");
    Object.assign(clone.style, {
      width: `${EXPORT_WIDTH}px`, minWidth: `${EXPORT_WIDTH}px`, maxWidth: `${EXPORT_WIDTH}px`,
      boxSizing: "border-box", height: "auto", maxHeight: "none", minHeight: "0",
      overflow: "visible", margin: "0", position: "relative", top: "auto", left: "auto",
      right: "auto", bottom: "auto", transform: "none", contentVisibility: "visible",
    });
    clone.querySelectorAll("[data-export-ignore]").forEach((node) => node.remove());
    host.append(style, clone);
    document.body.append(host);
    // Trigger font discovery for the clone before reading FontFaceSet.ready.
    clone.getBoundingClientRect();

    await Promise.all([
      document.fonts ? withTimeout(document.fonts.ready, 20_000, "字体加载超时，请稍后重试。") : Promise.resolve(),
      waitForImages(clone),
    ]);
    await nextLayout();

    const height = Math.ceil(Math.max(clone.scrollHeight, clone.offsetHeight, clone.getBoundingClientRect().height));
    if (!Number.isFinite(height) || height < 1) throw new Error("课程内容尺寸无效，请刷新页面后重试。");
    const scale = Math.min(1, MAX_DIMENSION / height, Math.sqrt(MAX_PIXELS / (EXPORT_WIDTH * height)));

    canvas = await html2canvas(clone, {
      backgroundColor: null,
      width: EXPORT_WIDTH,
      height,
      scale,
      windowWidth: EXPORT_WIDTH,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      allowTaint: false,
      imageTimeout: 20_000,
      logging: false,
      removeContainer: true,
      ignoreElements: (node) => node.hasAttribute("data-export-ignore"),
    });
    if (!canvas.width || !canvas.height) throw new Error("浏览器未能生成图片，请重试。");
    const dimensions = { width: canvas.width, height: canvas.height };
    const blob = await withTimeout(new Promise((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("图片生成失败，请重试。")), "image/png");
    }), 30_000, "图片保存准备超时，请稍后重试。");

    objectUrl = URL.createObjectURL(blob);
    const supportsDownload = "download" in document.createElement("a");
    if (supportsDownload) {
      setStatus(statusElement, "完整 PNG 已生成，已请求浏览器下载。若未开始，请点击下方下载链接。");
    } else {
      setStatus(statusElement, "完整 PNG 已生成。请点击下方链接打开图片并保存。");
    }
    const resultLink = showResult(objectUrl, statusElement || button || element, supportsDownload);
    hasResult = true;
    if (supportsDownload) resultLink.click();
    return { ok: true, ...dimensions, fileName: FILE_NAME };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知错误";
    setStatus(statusElement, `导出失败：${detail}`);
    return { ok: false, error };
  } finally {
    host?.remove();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    if (objectUrl && !hasResult) setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    if (button && previousButton) {
      button.disabled = previousButton.disabled;
      if (previousButton.busy === null) button.removeAttribute("aria-busy");
      else button.setAttribute("aria-busy", previousButton.busy);
      button.replaceChildren(...previousButton.children);
    }
    exporting = false;
  }
}
