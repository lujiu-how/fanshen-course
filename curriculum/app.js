import { course } from './course-data.js';
import { exportCoursePng } from './export-png.js';

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

document.querySelector('#export-button').addEventListener('click', () => exportCoursePng({
  element: document.querySelector('#course-document'),
  button: document.querySelector('#export-button'),
  statusElement: document.querySelector('#export-status'),
}));
