let chosen=new Set();
const $=s=>document.querySelector(s), modal=$('#modal');
const legacy={bunin:'Как измерить внедрение AI в большой компании',neychev:'ИИ-агенты: как прогресс становится повседневной практикой (и где уже можно обойтись без подписки)',linnikov:'Что такое AI-harness и почему система важнее конкретной модели',datalens:'DataLens Platform: от источника данных до продуктового инсайта',tikh:'HTML против дашборда: что мы теряем, когда AI-агент может визуализировать всё'};
try {
  const data=JSON.parse(localStorage.getItem('mm26-chosen')||'[]');
  if(Array.isArray(data)) for(const id of data){
    const t=talks.find(t=>t.id===id||t.name===legacy[id]||(id==='goloshchapova'&&t.speaker==='Ирина Голощапова'));
    if(t)chosen.add(t.id);
  }
} catch {}
let day='26',mine=false,hall='',query='';
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function normalize(s){return s.toLocaleLowerCase('ru').replaceAll('ё','е')}
function overlaps(a,b){return a.id!==b.id&&a.day===b.day&&a.start<b.end&&b.start<a.end}
function conflicts(t){return talks.filter(x=>chosen.has(x.id)&&overlaps(t,x))}
function save(id){
  chosen.has(id)?chosen.delete(id):chosen.add(id);
  try{localStorage.setItem('mm26-chosen',JSON.stringify([...chosen]))}
  catch{$('#status').textContent='Браузер не разрешил сохранение. Выбор доступен до закрытия страницы.'}
  render();
}
function filtered(){return talks.filter(t=>t.day===day&&(!mine||chosen.has(t.id))&&(!hall||t.room===hall)&&normalize([t.name,t.speaker,t.speakerInfo,t.room,t.summary,t.description].join(' ')).includes(normalize(query)))}
function render(){
  const visible=filtered();
  $('#heading').textContent=mine?'Моя программа':'Программа';
  $('#mine').textContent=`Моя программа · ${chosen.size}`;
  $('#mine').setAttribute('aria-pressed',mine);
  $('#all').setAttribute('aria-pressed',!mine);
  $('#count').textContent=`${visible.length} из ${talks.filter(t=>t.day===day&&(!mine||chosen.has(t.id))).length} событий${hall?' · '+hall:''}`;
  $('#reset').hidden=!query&&!hall;
  $('#reset').textContent='Сбросить';
  $('#filters').textContent=hall?'Залы · 1':'Залы';
  let previous='';
  $('#list').innerHTML=visible.map(t=>{
    const slot=t.start!==previous?`<h2 class="slot">${t.start}</h2>`:'';previous=t.start;
    const clash=chosen.has(t.id)?conflicts(t):[];
    return `${slot}<article><div class="row"><p class="meta">${t.start}–${t.end}<br>${esc(t.room)}</p><button class="save" data-save="${t.id}" aria-pressed="${chosen.has(t.id)}" aria-label="${chosen.has(t.id)?'Убрать из программы':'Сохранить'}: ${esc(t.name)}">${chosen.has(t.id)?'✓ В программе':'+ Сохранить'}</button></div><button class="title" data-detail="${t.id}"><h2>${esc(t.name)}</h2></button>${t.speaker?`<p class="speaker">${esc(t.speaker)}</p>`:''}${clash.length?`<p class="conflict">Пересечение по времени:</p>${clash.map(x=>`<button class="conflict-link" data-detail="${x.id}">${esc(x.speaker||x.name)} · ${esc(x.room)} · ${x.start}–${x.end}</button>`).join('')}`:''}</article>`;
  }).join('')||`<div class="empty"><h2>${query||hall?'Ничего не найдено':mine?'На этот день пока ничего не выбрано':'Нет событий'}</h2><p>${query||hall?'Попробуй другой запрос или сбрось фильтры.':'Сохрани интересные выступления в общей программе.'}</p><button id="empty-action">${query||hall?'Сбросить фильтры':'Открыть все доклады'}</button></div>`;
}
let returnFocus=null;
function openDialog(html){
  if(!modal.open)returnFocus=document.activeElement;
  modal.innerHTML='<button class="close" type="button" aria-label="Закрыть" title="Закрыть" autofocus><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6L18 18M18 6L6 18"/></svg></button>'+html;
  modal.querySelector('.close').onclick=()=>modal.close();
  if(!modal.open)modal.showModal();
  modal.scrollTop=0;
}
modal.addEventListener('close',()=>{
  if(returnFocus?.isConnected)returnFocus.focus();
  else if(returnFocus?.dataset.detail)document.querySelector(`[data-detail="${returnFocus.dataset.detail}"]`)?.focus();
});
function details(id){
  const t=talks.find(t=>t.id===id);
  const clash=chosen.has(id)?conflicts(t):[];
  openDialog(`<h2 id="dialog-title">${esc(t.name)}</h2><p>${t.day} ноября, ${t.start}–${t.end} (МСК)<br>${esc(t.room)}</p>${t.speaker?`<p>${esc(t.speaker)}</p>`:''}${t.speakerInfo?`<p class="meta">${esc(t.speakerInfo)}</p>`:''}${clash.length?`<p class="conflict">Пересекается с выбранным: ${clash.map(x=>esc(x.speaker||x.name)+' ('+x.start+'–'+x.end+')').join('; ')}.</p>`:''}<button class="primary" id="detail-save">${chosen.has(id)?'Убрать из моей программы':'Добавить в мою программу'}</button><div class="description">${esc(t.description||'Организаторы пока не добавили описание.')}</div>`);
  $('#detail-save').onclick=()=>{save(id);details(id);$('#detail-save').focus()};
}
$('#list').onclick=e=>{
  const saveButton=e.target.closest('[data-save]'),detail=e.target.closest('[data-detail]');
  if(saveButton){save(saveButton.dataset.save);document.querySelector(`[data-save="${saveButton.dataset.save}"]`)?.focus()}
  if(detail)details(detail.dataset.detail);
  if(e.target.closest('#empty-action')){if(!query&&!hall)mine=false;query='';hall='';$('#search').value='';render()}
};
function setDay(value){day=value;hall='';document.querySelectorAll('[data-day]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.day===day));render()}
document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>setDay(b.dataset.day));
$('#search').oninput=e=>{query=e.target.value.trim();render()};
$('#reset').onclick=()=>{query='';hall='';$('#search').value='';render()};
$('#all').onclick=()=>{mine=false;render();window.scrollTo(0,0)};
$('#mine').onclick=()=>{mine=true;query='';hall='';$('#search').value='';render();window.scrollTo(0,0)};
$('#filters').onclick=()=>{
  openDialog(`<h2 id="dialog-title">Залы · ${day} ноября</h2><label for="hall">Показать выступления</label><select id="hall"><option value="">Все залы</option>${[...new Set(talks.filter(t=>t.day===day).map(t=>t.room))].sort().map(x=>`<option ${x===hall?'selected':''}>${esc(x)}</option>`).join('')}</select><button class="primary" id="apply">Показать программу</button>`);
  $('#apply').onclick=()=>{hall=$('#hall').value;render();modal.close()};
};
$('#about').onclick=()=>openDialog(`<h2 id="dialog-title">Программа ММ’26</h2><p>Все 92 события из предоставленной выгрузки LMS: 39 на 26 ноября, 38 на 27 ноября и 15 на онлайн-день 17 ноября.</p><p>Залы и время взяты из CSV, описания — из Markdown. Дополнительные сведения о спикерах — из сохранённой страницы. Время московское. Это сохранённая копия, обновления LMS автоматически не загружаются.</p><p>В исходнике есть незаполненный слот «ЗДЕСЬ БУДЕТ ЕЩЕ ОДНА ТЕМА». Он оставлен в программе.</p><p>Выбор сохраняется в этом браузере, если он разрешает локальное хранение. Пересечения проверяются между всеми выбранными событиями, включая скрытые фильтром.</p><p><a href="https://lms.matemarketing.ru/events/all/6/program" target="_blank" rel="noopener">Открыть актуальную программу организаторов</a></p>`);
render();
