const EXPORT_WIDTH = 390;
const EXPORT_SCALE = 2;
const MAX_PIXELS = 12_000_000;
const MAX_DIMENSION = 16_000;
const FILE_NAME = "番申AI产品运营就业课-线上课程详情.png";
let libraryPromise;
let exporting = false;

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

/** Generate a full-length phone PNG. Practice and controls are excluded. */
export async function createCoursePng(element) {
  if (exporting) throw new Error("课程图片正在生成，请稍候。");
  if (!(element instanceof HTMLElement) || !element.isConnected) {
    throw new Error("没有找到完整课程内容，请刷新页面后重试。");
  }
  exporting = true;
  let host;
  let canvas;
  try {
    const html2canvas = await loadHtml2Canvas();
    host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.inert = true;
    host.style.cssText = `position:absolute;left:-20000px;top:0;width:${EXPORT_WIDTH}px;pointer-events:none;`;
    const clone = element.cloneNode(true);
    clone.classList.add("export-mode");
    clone.querySelectorAll("[data-export-ignore]").forEach(node => node.remove());
    host.append(clone);
    document.body.append(host);
    clone.getBoundingClientRect();
    await Promise.all([
      document.fonts ? withTimeout(document.fonts.ready, 20_000, "字体加载超时，请稍后重试。") : Promise.resolve(),
      waitForImages(clone),
    ]);
    await nextLayout();
    const height = Math.ceil(Math.max(clone.scrollHeight, clone.getBoundingClientRect().height));
    if (!Number.isFinite(height) || height < 1) throw new Error("课程内容尺寸无效，请刷新页面后重试。");
    const scale = Math.min(EXPORT_SCALE, MAX_DIMENSION / height, Math.sqrt(MAX_PIXELS / (EXPORT_WIDTH * height)));
    canvas = await html2canvas(clone, {
      backgroundColor: null, width: EXPORT_WIDTH, height, scale,
      windowWidth: EXPORT_WIDTH, scrollX: 0, scrollY: 0,
      useCORS: true, allowTaint: false, imageTimeout: 20_000,
      logging: false, removeContainer: true,
    });
    if (!canvas.width || !canvas.height) throw new Error("浏览器未能生成图片，请重试。");
    const blob = await withTimeout(new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error("图片生成失败，请重试。")), "image/png");
    }), 30_000, "图片保存准备超时，请稍后重试。");
    return { blob, width: canvas.width, height: canvas.height, fileName: FILE_NAME };
  } finally {
    host?.remove();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    exporting = false;
  }
}
