import { createCoursePng } from './export-png.js?v=e0da0db84997';

// The course is loaded once. Cache by its DOM root, including a pending render.
const images = new WeakMap();
const dialogs = new WeakMap();
const liveUrls = new Set();
let sharing = false;

window.addEventListener('pagehide', event => {
  // A page in the back/forward cache can be restored with its preview intact.
  if (event.persisted) return;
  for (const url of liveUrls) URL.revokeObjectURL(url);
  liveUrls.clear();
});

function status(element, message) {
  if (!element) return;
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-atomic', 'true');
  element.textContent = message;
}

function message(state, text) {
  status(state.statusElement, text);
  status(state.description, text);
}

function loading(button, text) {
  if (!button) return () => {};
  const previous = {
    disabled: button.disabled,
    busy: button.getAttribute('aria-busy'),
    children: [...button.childNodes],
  };
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.replaceChildren(document.createTextNode(text));
  return () => {
    button.disabled = previous.disabled;
    if (previous.busy === null) button.removeAttribute('aria-busy');
    else button.setAttribute('aria-busy', previous.busy);
    button.replaceChildren(...previous.children);
  };
}

function canShareImage(image) {
  if (!image?.file || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [image.file] }) === true;
  } catch {
    return false;
  }
}

function getImage(element) {
  const cached = images.get(element);
  if (cached) return cached;
  const record = { value: null, pending: null };
  images.set(element, record);
  record.pending = (async () => {
    const result = await createCoursePng(element);
    if (!(result?.blob instanceof Blob) || result.blob.type !== 'image/png' || result.blob.size === 0) {
      throw new Error('没有生成有效的 PNG 图片，请重试。');
    }
    const fileName = typeof result.fileName === 'string' && /\.png$/i.test(result.fileName)
      ? result.fileName : '番申AI产品运营课程详情.png';
    // Older embedded browsers can still show/save the Blob without File support.
    let file = null;
    if (typeof File === 'function') {
      try { file = new File([result.blob], fileName, { type: 'image/png' }); } catch { /* Preview/save still works. */ }
    }
    record.value = { ...result, fileName, file };
    return record.value;
  })().catch(error => {
    if (images.get(element) === record) images.delete(element);
    throw error;
  });
  return record;
}

function bindImage(state, image) {
  if (state.image !== image) {
    const url = URL.createObjectURL(image.blob);
    if (state.url) {
      URL.revokeObjectURL(state.url);
      liveUrls.delete(state.url);
    }
    liveUrls.add(url);
    state.image = image;
    state.url = url;
    state.nativeUnsupported = false;
    state.preview.src = url;
    state.download.href = url;
    state.download.download = image.fileName;
    state.download.target = '_blank';
    state.download.rel = 'noopener';
  }
  state.submit.hidden = state.nativeUnsupported || !canShareImage(image);
}

function openDialog(state, text) {
  bindImage(state, state.image);
  message(state, text);
  if (!state.dialog.open) {
    if (typeof state.dialog.showModal === 'function') state.dialog.showModal();
    else state.dialog.setAttribute('open', '');
    state.openedByController = true;
  }
}

const READY = '图片已生成，点击“分享给好友”打开系统分享面板。也可以长按图片保存后发送。';
const FALLBACK = '当前浏览器不支持直接分享图片。请长按下方图片，或点击“保存 PNG 图片”，保存后在微信中发送。';

// This function invokes navigator.share BEFORE its first await. In particular,
// the dialog's click handler must not import code or regenerate the PNG first.
async function nativeShare(state) {
  if (sharing || state.sharing) return { ok: false, busy: true };
  if (state.nativeUnsupported || !canShareImage(state.image)) {
    openDialog(state, FALLBACK);
    return { ok: true, mode: 'fallback' };
  }
  sharing = true;
  state.sharing = true;
  const restore = loading(state.submit, '正在打开分享…');
  try {
    const pending = navigator.share({ files: [state.image.file] });
    await pending;
    message(state, '已将图片交给系统分享。图片已保留，可再次分享或保存。');
    return { ok: true, mode: 'shared' };
  } catch (error) {
    if (error?.name === 'AbortError') {
      message(state, '已取消分享，图片已保留。');
      return { ok: true, mode: 'cancelled', cancelled: true };
    }
    if (error?.name === 'NotSupportedError') state.nativeUnsupported = true;
    openDialog(state, state.nativeUnsupported ? FALLBACK : '未能打开系统分享。可以点击“分享给好友”重试，或长按图片保存后发送。');
    return { ok: false, mode: 'fallback', error };
  } finally {
    restore();
    state.sharing = false;
    sharing = false;
  }
}

function getDialog(dialog) {
  let state = dialogs.get(dialog);
  if (state) return state;
  if (!dialog || typeof dialog.querySelector !== 'function' || typeof dialog.hasAttribute !== 'function') {
    throw new Error('分享预览尚未准备好，请刷新后重试。');
  }
  const nodes = {
    description: dialog.querySelector('#share-description'),
    preview: dialog.querySelector('#share-image'),
    submit: dialog.querySelector('#native-share'),
    download: dialog.querySelector('#save-image'),
    close: dialog.querySelector('#share-close'),
  };
  if (Object.values(nodes).some(node => !node)) throw new Error('分享预览缺少必要内容，请刷新后重试。');
  state = {
    dialog, ...nodes, statusElement: null, image: null, url: null,
    generating: false, sharing: false, openedByController: false, nativeUnsupported: false,
  };
  state.submit.addEventListener('click', event => {
    event.preventDefault();
    if (!state.image || state.generating || state.sharing) return;
    // Deliberately no await before nativeShare: this is the renewed user gesture.
    void nativeShare(state).catch(() => message(state, '分享预览暂时无法打开，请重试。'));
  });
  state.close.addEventListener('click', event => {
    event.preventDefault();
    // Close only this controller's explicitly supplied dialog, never another one.
    if (!state.openedByController || !state.dialog.open) return;
    if (typeof state.dialog.close === 'function') state.dialog.close();
    else state.dialog.removeAttribute('open');
    state.openedByController = false;
    status(state.statusElement, '');
  });
  state.dialog.addEventListener('close', () => {
    state.openedByController = false;
    status(state.statusElement, '');
  });
  state.dialog.addEventListener('cancel', () => { status(state.statusElement, ''); });
  dialogs.set(dialog, state);
  return state;
}

async function downloadImage(state, fileHandle) {
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(state.image.blob);
      await writable.close();
    } catch (error) {
      try { await writable.abort(); } catch { /* Preserve the original error. */ }
      throw error;
    }
    status(state.statusElement, '课程详情图片已保存。');
    return { ok: true, mode: 'saved' };
  }
  const link = document.createElement('a');
  link.href = state.url;
  link.download = state.image.fileName;
  link.hidden = true;
  document.body.append(link);
  try { link.click(); } finally { link.remove(); }
  status(state.statusElement, '已开始下载课程详情图片，请查看浏览器下载记录。');
  return { ok: true, mode: 'downloaded' };
}

/**
 * Share a generated PNG File, or present an image the user can long-press/save.
 * Desktop downloads use a handle selected in the original click, or an anchor.
 * Requires the fixed dialog IDs supplied by index.html.
 * Returns { ok, mode } (shared / ready / fallback / cancelled / saved / downloaded), or { ok: false }.
 * Images are cached by the static course root; closing a dialog keeps its image.
 */
export async function shareCoursePng({ element, button, statusElement, dialog, download = false, fileHandle = null } = {}) {
  let state;
  let ownsGeneration = false;
  let restore = () => {};
  try {
    if (!element || !element.isConnected) throw new Error('没有找到完整课程内容，请刷新后重试。');
    state = getDialog(dialog);
    if (state.generating || state.sharing || sharing) return { ok: false, busy: true };
    state.statusElement = statusElement;
    state.generating = true;
    ownsGeneration = true;
    restore = loading(button, '正在生成图片…');
    const record = getImage(element);
    // Cached images must reach nativeShare without an await that loses activation.
    if (!record.value) message(state, '正在生成课程图片，请稍候…');
    const image = record.value || await record.pending;
    bindImage(state, image);
    if (download) return await downloadImage(state, fileHandle);
    state.generating = false;
    if (!state.nativeUnsupported && canShareImage(image) && navigator.userActivation?.isActive === true) {
      return await nativeShare(state);
    }
    const supported = !state.nativeUnsupported && canShareImage(image);
    openDialog(state, supported ? READY : FALLBACK);
    return { ok: true, mode: supported ? 'ready' : 'fallback' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : '请稍后重试。';
    const text = `图片${download ? '下载' : '分享'}未完成：${detail}`;
    if (state) message(state, text);
    else status(statusElement, text);
    return { ok: false, error };
  } finally {
    restore();
    if (state && ownsGeneration) state.generating = false;
  }
}
