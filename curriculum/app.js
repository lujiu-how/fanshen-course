import { course } from './course-data.js?v=0745a8c07163';

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
const total = course.groups.reduce((count, group) => count + group.units.length, 0);
document.querySelector('#curriculum-count').textContent = `${course.groups.length} 个模块 / ${total} 节课程`;
document.querySelector('#course-sections').innerHTML = course.groups.map((group, index) => `
  <section class="course-stage" id="stage-${index + 1}" aria-labelledby="stage-${index + 1}-title">
    <div class="stage-heading"><span class="stage-number">${String(index + 1).padStart(2, '0')}</span><h3 id="stage-${index + 1}-title">${escapeHtml(group.name)}</h3></div>
    ${group.note ? `<p class="stage-note">${escapeHtml(group.note)}</p>` : ''}
    <div class="units">${group.units.map((unit, lessonIndex) => `
      <article class="course-unit" data-source-number="${escapeHtml(unit.number)}">
        <div class="unit-heading"><span class="unit-number">${String(lessonIndex + 1).padStart(2, '0')}</span><h4>${escapeHtml(unit.title)}</h4></div>
        <div class="unit-copy"><div class="unit-plan">${formatText(unit.plan)}</div>${unit.practice ? `<div class="unit-practice" data-export-ignore><span>实训</span><div class="unit-practice-content">${formatText(unit.practice)}</div></div>` : ''}</div>
      </article>`).join('')}</div>
  </section>`).join('');

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
    const { shareCoursePng } = await import('./share-course.js?v=2fed100c7304');
    await shareCoursePng({
      element: document.querySelector('#course-document'),
      button: shareButton,
      statusElement,
      dialog: document.querySelector('#share-dialog'),
      download: !mobile,
      fileHandle,
    });
  } catch {
    statusElement.textContent = '图片下载暂未完成，请再试一次。';
  } finally {
    shareButton.disabled = wasDisabled;
    downloadPending = false;
  }
});
