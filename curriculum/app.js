import { course } from './course-data.js?v=c414df72d59b';

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function formatText(value) {
  const blocks = [];
  let items = [];
  const endList = () => {
    if (items.length) blocks.push(`<ul>${items.join('')}</ul>`);
    items = [];
  };
  for (const line of String(value).split(/\r?\n/)) {
    const text = line.trim();
    if (text.startsWith('• ')) items.push(`<li>${escapeHtml(text.slice(2))}</li>`);
    else {
      endList();
      if (text) blocks.push(`<p>${escapeHtml(text)}</p>`);
    }
  }
  endList();
  return blocks.join('');
}
function renderCourse(course, root = document) {
const total = course.groups.reduce((count, group) => count + group.units.length, 0);
root.querySelector('#curriculum-count').textContent = `${course.groups.length} 个模块 / ${total} 节课程`;
root.querySelector('#course-sections').innerHTML = course.groups.map((group, index) => `
  <section class="course-stage" id="stage-${index + 1}" aria-labelledby="stage-${index + 1}-title">
    <div class="stage-heading"><span class="stage-number">${String(index + 1).padStart(2, '0')}</span><h3 id="stage-${index + 1}-title">${escapeHtml(group.name)}</h3></div>
    ${group.note ? `<p class="stage-note">${escapeHtml(group.note)}</p>` : ''}
    <div class="units">${group.units.map((unit, lessonIndex) => `
      <article class="course-unit" data-source-number="${escapeHtml(unit.number)}">
        <div class="unit-heading"><span class="unit-number">${String(lessonIndex + 1).padStart(2, '0')}</span><h4>${escapeHtml(unit.title)}</h4></div>
        <div class="unit-copy"><div class="unit-plan">${formatText(unit.plan)}</div>${unit.practice ? `<div class="unit-practice" data-export-ignore><span>实训</span><div class="unit-practice-content">${formatText(unit.practice)}</div></div>` : ''}</div>
      </article>`).join('')}</div>
  </section>`).join('');
}
renderCourse(course);

function loadCurrentStyle(href) {
  const previous = document.querySelector('link[rel="stylesheet"]');
  if (previous?.href === href) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    const timer = setTimeout(fail, 15_000);
    function fail() {
      clearTimeout(timer);
      link.remove();
      reject(new Error('课程样式加载失败，请检查网络后重试。'));
    }
    link.onerror = fail;
    link.onload = () => {
      clearTimeout(timer);
      previous?.remove();
      resolve();
    };
    document.head.append(link);
  });
}

// Check the published page at download time, including after a tab is restored.
// The entry HTML pins the data and CSS versions from the same publication.
async function refreshCourseForDownload() {
  const url = new URL('index.html', document.baseURI);
  url.searchParams.set('_fresh', Date.now());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let latest;
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('course page unavailable');
    latest = new DOMParser().parseFromString(await response.text(), 'text/html');
  } catch {
    throw new Error('暂时无法获取最新课程，请检查网络后重试。');
  } finally {
    clearTimeout(timer);
  }
  const main = latest.querySelector('#course-document');
  const dataPath = latest.querySelector('meta[name="course-data"]')?.content;
  const stylePath = latest.querySelector('link[rel="stylesheet"]')?.getAttribute('href');
  if (!main || !/^\.\/course-data\.js\?v=[a-f0-9]+$/.test(dataPath || '')
    || !/^styles\.css\?v=[a-f0-9]+$/.test(stylePath || '')) {
    throw new Error('最新课程尚未准备完成，请稍后重试。');
  }
  const { course: current } = await import(new URL(dataPath, url).href);
  if (!current?.groups?.length) throw new Error('最新课程内容不完整，请稍后重试。');
  const root = document.importNode(main, true);
  renderCourse(current, root);
  await loadCurrentStyle(new URL(stylePath, url).href);
  document.querySelector('#course-document').replaceWith(root);
  return root;
}

const shareButton = document.querySelector('#share-button');
let downloadPending = false;
shareButton.addEventListener('click', async () => {
  if (downloadPending) return;
  downloadPending = true;
  const wasDisabled = shareButton.disabled;
  shareButton.disabled = true;
  const statusElement = document.querySelector('#share-status');
  const mobile = navigator.userAgentData?.mobile === true
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let fileHandle = null;
  try {
    statusElement.textContent = '';
    if (!mobile && typeof window.showSaveFilePicker === 'function') {
      // Open the picker in the original click, before imports or PNG rendering.
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: '番申AI产品运营就业课-线上课程详情.png',
          types: [{ description: 'PNG 图片', accept: { 'image/png': ['.png'] } }],
        });
      } catch (error) {
        if (error?.name === 'AbortError') return;
        // Embedded browsers may expose the API while blocking the picker.
        if (!['SecurityError', 'NotSupportedError'].includes(error?.name)) throw error;
      }
    }
    statusElement.textContent = '正在获取最新课程并生成图片…';
    const element = await refreshCourseForDownload();
    const { shareCoursePng } = await import('./share-course.js?v=5a63c7383bfd');
    await shareCoursePng({
      element,
      button: shareButton,
      statusElement,
      dialog: document.querySelector('#share-dialog'),
      download: !mobile,
      fileHandle,
    });
  } catch (error) {
    statusElement.textContent = `图片下载暂未完成：${error instanceof Error ? error.message : '请再试一次。'}`;
  } finally {
    shareButton.disabled = wasDisabled;
    downloadPending = false;
  }
});
