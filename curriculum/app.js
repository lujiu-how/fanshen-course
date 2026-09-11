import { course } from './course-data.js';
import { exportCoursePng } from './export-png.js';

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icons = {
  plan: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  practice: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gain: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 12 3 3 7-7M20 12v7H4V5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const column = (label, items, type) => `<div class="unit-column ${type==='gain'?'gains':''}"><h4 class="column-label">${icons[type]}${label}</h4><ul>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`;
const total = course.groups.reduce((count,group)=>count+group.units.length,0);
let number = 0;
document.querySelector('#course-sections').innerHTML = course.groups.map((group,index)=>{
  const id=`stage-${index+1}`;
  return `<section class="course-stage" id="${id}" aria-labelledby="${id}-title"><div class="stage-heading"><span class="stage-number">${String(index+1).padStart(2,'0')}</span><div><h2 id="${id}-title">${escapeHtml(group.name)}</h2>${group.note?`<p class="stage-note">${escapeHtml(group.note)}</p>`:''}</div><span class="stage-count">${group.units.length} 个单元</span></div><div class="units">${group.units.map(unit=>{number++;return `<article class="course-unit" data-unit="${number}"><div class="unit-heading"><span class="unit-number">${escapeHtml(unit.number || String(number).padStart(2,'0'))}</span><div><h3>${escapeHtml(unit.title)}</h3>${unit.sub?`<p class="unit-subtitle">${escapeHtml(unit.sub)}</p>`:''}</div></div><div class="unit-body">${column('课程安排',unit.plan,'plan')}${column('实训内容',unit.practice,'practice')}${column('学员收获',unit.gain,'gain')}</div></article>`;}).join('')}</div></section>`;
}).join('');
document.querySelector('#course-nav').innerHTML = course.groups.map((group,index)=>`<a class="nav-item" href="#stage-${index+1}"><span class="nav-index">${String(index+1).padStart(2,'0')}</span><span>${escapeHtml(group.navLabel||group.name)}</span></a>`).join('');
document.querySelector('#unit-count').textContent=`${total} 单元`;
document.querySelector('#curriculum-count').textContent=`${course.groups.length} 个学习模块 / ${total} 个教学单元`;
document.querySelector('#updated-date').textContent=`课程内容更新于 ${course.updatedAt}`;
const links=[...document.querySelectorAll('.nav-item')];
const stages=[...document.querySelectorAll('.course-stage')];
function syncNavigation(){
  let selected=stages[0];
  for(const stage of stages){if(stage.getBoundingClientRect().top<=155)selected=stage;}
  for(const link of links){if(link.hash===`#${selected?.id}`)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}
}
let scrollScheduled=false;
window.addEventListener('scroll',()=>{if(scrollScheduled)return;scrollScheduled=true;requestAnimationFrame(()=>{syncNavigation();scrollScheduled=false;});},{passive:true});
syncNavigation();
document.querySelector('#export-button').addEventListener('click',()=>exportCoursePng({element:document.querySelector('#course-document'),button:document.querySelector('#export-button'),statusElement:document.querySelector('#export-status')}));
