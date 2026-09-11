import { course } from './course-data.js?v=721234b3ca6f';

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const total = course.groups.reduce((count, group) => count + group.units.length, 0);
document.querySelector('#curriculum-count').textContent = `${course.groups.length} 个模块 / ${total} 节课程`;
document.querySelector('#course-sections').innerHTML = course.groups.map((group, index) => `
  <section class="course-stage" id="stage-${index + 1}" aria-labelledby="stage-${index + 1}-title">
    <div class="stage-heading"><span class="stage-number">${String(index + 1).padStart(2, '0')}</span><h3 id="stage-${index + 1}-title">${escapeHtml(group.name)}</h3></div>
    ${group.note ? `<p class="stage-note">${escapeHtml(group.note)}</p>` : ''}
    <div class="units">${group.units.map((unit, lessonIndex) => `
      <article class="course-unit" data-source-number="${escapeHtml(unit.number)}">
        <div class="unit-heading"><span class="unit-number">${String(lessonIndex + 1).padStart(2, '0')}</span><h4>${escapeHtml(unit.title)}</h4></div>
        <div class="unit-copy"><p class="unit-plan">${escapeHtml(unit.plan)}</p><p class="unit-practice" data-export-ignore><span>实训</span>${escapeHtml(unit.practice)}</p></div>
      </article>`).join('')}</div>
  </section>`).join('');

const shareButton = document.querySelector('#share-button');
shareButton.addEventListener('click', async () => {
  try {
    const { shareCoursePng } = await import('./share-course.js?v=f72162a7c71f');
    await shareCoursePng({
      element: document.querySelector('#course-document'),
      button: shareButton,
      statusElement: document.querySelector('#share-status'),
      dialog: document.querySelector('#share-dialog'),
    });
  } catch {
    document.querySelector('#share-status').textContent = '分享组件暂未加载成功，请再试一次。';
  }
});
