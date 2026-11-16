// Focused mobile view. Secondary controls stay in dialogs.
extras.view='list';
extras.officialTrack='';
const beforeTrackFilter=filtered;
filtered=function(){return beforeTrackFilter().filter(t=>!extras.officialTrack||(extras.officialTrack==='__none'? !t.track:t.track===extras.officialTrack))};
const beforeTrackReset=resetExtras;
resetExtras=function(){beforeTrackReset();extras.officialTrack=''};
const beforeTrackDay=setDay;
setDay=function(value){extras.officialTrack='';beforeTrackDay(value)};
let comparingTime=null;
let cardView='list', undoSelection=null;
$('.count').insertAdjacentHTML('afterbegin','<button id="personal-tracks" hidden aria-haspopup="dialog"></button>');
$('.count').insertAdjacentHTML('beforeend','<button id="jump-time" class="text-action" aria-haspopup="dialog">К времени</button><button id="view-settings" class="text-action">Вид и порядок</button>');
$('main').insertAdjacentHTML('beforeend','<div id="undo-bar" hidden></div>');
function selectionState(id){return {id,going:chosen.has(id),recording:later.has(id)}}
function rememberRemoval(before){
 if((before.going&&!chosen.has(before.id))||(before.recording&&!later.has(before.id)))undoSelection=before;
 else if(undoSelection?.id===before.id)undoSelection=null;
 renderUndo();
}
const saveBeforeUndo=save;
save=function(id){const before=selectionState(id);saveBeforeUndo(id);rememberRemoval(before)};
// Moving to recordings calls save internally; retain the state before the whole move.
const laterBeforeUndo=toggleLater;
toggleLater=function(id){const before=selectionState(id);laterBeforeUndo(id);rememberRemoval(before)};
function renderUndo(){
 const bar=$('#undo-bar');bar.hidden=!undoSelection;
 bar.innerHTML=undoSelection?`<span role="status">${undoSelection.going?'Убрано из «Пойду»':'Убрано из записей'}: ${esc(talks.find(t=>t.id===undoSelection.id)?.name||'доклад')}</span><button id="undo-selection">Отменить</button><button id="dismiss-undo" aria-label="Закрыть сообщение">Закрыть</button>`:'';
 if(undoSelection){$('#undo-selection').onclick=restoreSelection;$('#dismiss-undo').onclick=()=>{undoSelection=null;renderUndo();$('#mine').focus()}}
}
function restoreSelection(){
 if(!undoSelection)return;
 const before=undoSelection;undoSelection=null;
 before.going?chosen.add(before.id):chosen.delete(before.id);
 before.recording?later.add(before.id):later.delete(before.id);
 try{localStorage.setItem('mm26-chosen',JSON.stringify([...chosen]))}catch{$('#status').textContent='Браузер не разрешил сохранение. Выбор доступен до закрытия страницы.'}
 extraStore();render();
 if(modal.open){details(before.id);$('#detail-save').focus()}
 else (document.querySelector(`[data-save="${before.id}"]`)||$('#mine')).focus();
}
function jumpTimes(){return [...new Set(filtered().map(t=>t.start))].sort()}
function contextDayDialog(){
 openDialog(`<h2 id="dialog-title">День конференции</h2><div class="day-choices">${[['26','26 ноября'],['27','27 ноября'],['17','17 ноября · онлайн']].map(([value,label])=>`<button data-context-day="${value}" aria-pressed="${day===value}">${label}</button>`).join('')}</div>`);
 modal.querySelectorAll('[data-context-day]').forEach(button=>button.onclick=()=>{
  setDay(button.dataset.contextDay);
  returnFocus=document.querySelector(`[data-day="${day}"]`);
  modal.close();window.scrollTo(0,0);
 });
}
function jumpTimeDialog(){
 openDialog(`<h2 id="dialog-title">К времени · ${day} ноября</h2><div class="time-choices">${jumpTimes().map(time=>`<button data-jump-time="${time}">${time}</button>`).join('')}</div>`);
 modal.querySelectorAll('[data-jump-time]').forEach(b=>b.onclick=()=>{
  const time=b.dataset.jumpTime;
  const target=document.querySelector(`#time-${time.replace(':','')}`)||document.querySelector(`[data-start="${time}"]`);
  if(target){target.setAttribute('tabindex','-1');returnFocus=target}
  modal.close();
  if(target)requestAnimationFrame(()=>{target.focus({preventScroll:true});target.scrollIntoView({block:'start'})});
 });
}
function eventCount(n){const last=n%10, pair=n%100;return `${n} ${pair>=11&&pair<=14?'событий':last===1?'событие':last>=2&&last<=4?'события':'событий'}`}

function trackLabel(value){return value==='KEYNOTES'?'Keynotes':value==='HR-ТРЕК'?'HR-трек':value==='СЕМАНТИЧЕСКИЙ СЛОЙ И АНАЛИТИЧЕСКИЕ АГЕНТЫ'?'Семантический слой и аналитические агенты':value==='БЕЗОПАСНОСТЬ ИИ'?'Безопасность ИИ':value.charAt(0)+value.slice(1).toLocaleLowerCase('ru')}
function officialTracksDialog(){
 const items=talks.filter(t=>t.day===day),names=[...new Set(items.map(t=>t.track).filter(Boolean))];
 const choices=[['','Все треки',items.length],...names.map(name=>[name,trackLabel(name),items.filter(t=>t.track===name).length])];
 const missing=items.filter(t=>!t.track).length;if(missing)choices.push(['__none','Без указанного трека',missing]);
 openDialog(`<h2 id="dialog-title">Треки · ${day} ноября</h2><div class="track-choices">${choices.map(([value,label,count])=>`<button data-official-track="${esc(value)}" aria-pressed="${extras.officialTrack===value}"><span>${esc(label)}</span><span>${count}</span></button>`).join('')}</div><details><summary>Источник треков</summary><p>Треки взяты из табличной программы организаторов. Время и залы — из сохранённой программы LMS. Для онлайн-дня и двух офлайн-событий принадлежность к трекам в таблице не указана.</p></details>`);
 modal.querySelectorAll('[data-official-track]').forEach(b=>b.onclick=()=>{extras.officialTrack=b.dataset.officialTrack;render();modal.close()});
}
function timeGroups(items){
 const groups=[];
 for(const item of items){let g=groups.find(g=>g.start===item.start);if(!g){g={start:item.start,items:[]};groups.push(g)}g.items.push(item)}
 return groups;
}
function ongoingAt(start){return talks.filter(t=>t.day===day&&t.start<start&&t.end>start)}
function fullProgramMatches(text){
 const needle=normalize(text.trim());
 if(!needle)return [];
 return talks.filter(t=>normalize([t.name,t.speaker,t.speakerInfo,t.room,t.summary,t.description].join(' ')).includes(needle));
}
function openSearchResult(id){
 const result=talks.find(t=>t.id===id);if(!result)return;
 const requestedQuery=query;
 resetExtras();query=requestedQuery;$('#search').value=requestedQuery;mine=false;
 setDay(result.day);
}
function activeFilterItems(){
 return [
  ['query',query,`Поиск: ${query}`],['hall',hall,`Зал: ${hall}`],
  ['company',extras.company,extras.company],['speaker',extras.speaker,extras.speaker],
  ['length',extras.length,`До ${extras.length} минут`],['after',extras.after,`Не раньше ${extras.after}`],
  ['topic',extras.topic,extras.topic],['officialTrack',extras.officialTrack,trackLabel(extras.officialTrack)]
 ].filter(([,value])=>value);
}
function removeActiveFilter(key){
 if(key==='hall')hall='';
 else if(key==='query'){query='';$('#search').value=''}
 else if(['company','speaker','length','after','topic','officialTrack'].includes(key))extras[key]='';
 else return;
 render();
 const remaining=$('#active-filters').querySelector('button');
 (remaining||$('#filters')).focus();
}
function compactCard(t){
 const clash=chosen.has(t.id)?conflicts(t):[];
 const selection=comparingTime!==null||compareIds.has(t.id);
 const multiple=(t.portraits||[]).length>1&&extras.view!=='photos';
 const portraits=extras.view!=='photos'?`<div class="speaker-portraits">${(t.portraits||[]).map(p=>`<button class="speaker-picture" data-detail="${t.id}" aria-label="Открыть доклад: ${esc(t.name)}"><img src="${p.src}" alt="${esc(p.name)}" loading="lazy" decoding="async"></button>`).join('')}</div>`:'';
 return `<article data-start="${t.start}" class="event compact-event ${chosen.has(t.id)?'is-chosen':''}">
 <div class="card-schedule">${extras.view==='route'&&mine&&extras.section==='going'?`<strong class="plan-time">${t.start}–${t.end}</strong><span class="venue">${esc(t.room)}</span>`:`<span class="venue">${esc(t.room)}</span><span>${t.start}–${t.end}</span>`}</div>
 ${extras.view==='photos'&&t.poster?`<button class="card-image" data-detail="${t.id}" aria-label="Открыть доклад: ${esc(t.name)}"><img src="${t.poster}" alt="" loading="lazy" decoding="async"></button>`:''}
 <div class="compact-content${multiple?' multiple-speakers':''}"><div><button class="title" data-detail="${t.id}"><h3>${esc(t.name)}</h3></button>${!multiple&&t.speaker?`<p class="speaker">${esc(t.speaker)}</p>`:''}</div>${multiple?`<div class="speaker-row"><p class="speaker">${esc(t.speaker)}</p>${portraits}</div>`:portraits}</div>
 ${extras.view==='expanded'?`<p class="excerpt">${esc(t.summary||'')}</p>`:''}
 <div class="compact-actions"><button class="save" data-save="${t.id}" aria-pressed="${chosen.has(t.id)}" aria-label="${chosen.has(t.id)?'Убрать из программы':'Добавить в программу'}: ${esc(t.name)}">${chosen.has(t.id)?'✓ Пойду':'+ Пойду'}</button>${selection?`<button data-compare="${t.id}" aria-pressed="${compareIds.has(t.id)}">${compareIds.has(t.id)?'✓ Выбрано':'Выбрать для сравнения'}</button>`:''}${notes[t.id]?'<span class="meta">Есть заметка</span>':''}</div>
 ${clash.length?`<div class="conflict">Пересекается с выбранным докладом<button class="text-action" data-pair="${t.id},${clash[0].id}">Сравнить и решить</button></div>`:''}</article>`;
}
render=function(){
 if(extras.view==='route'&&(!mine||extras.section!=='going'))extras.view=cardView;
 if(extras.view!=='route')cardView=extras.view;
 const visible=filtered();
 $('#heading').textContent=mine?'Моя программа':'Программа';
 $('#mine').textContent=`Моя программа${chosen.size?' · '+chosen.size:''}`;
 $('#mine').setAttribute('aria-pressed',mine);$('#all').setAttribute('aria-pressed',!mine);
 const active=[hall,extras.company,extras.speaker,extras.topic,extras.length,extras.after].filter(Boolean).length;
 const availableTracks=[...new Set(talks.filter(t=>t.day===day).map(t=>t.track).filter(Boolean))];
 $('#trackbar').innerHTML=`<button id="official-tracks" ${availableTracks.length?'':'disabled'} aria-haspopup="dialog"><span>Треки</span><strong>${!availableTracks.length?'Для онлайн-дня не указаны':extras.officialTrack==='__none'?'Без указанного трека':extras.officialTrack?esc(trackLabel(extras.officialTrack)):'Все направления'}</strong><svg class="track-chevron" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4"/></svg></button>`;
 $('#official-tracks').onclick=officialTracksDialog;
 $('#trackbar').hidden=mine;
 $('.count').className=mine?'count personal-controls':'count';
 $('#personal-tracks').hidden=!mine;
 $('#personal-tracks').disabled=!availableTracks.length;
 $('#personal-tracks').innerHTML=`<span>Треки: ${!availableTracks.length?'не указаны':extras.officialTrack==='__none'?'без трека':extras.officialTrack?esc(trackLabel(extras.officialTrack)):'все'}</span><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>`;
 $('#personal-tracks').onclick=officialTracksDialog;
 $('#filters').textContent=`Фильтры${active?' · '+active:''}`;
 $('#count').textContent=eventCount(visible.length);
 $('#reset').hidden=!active&&!query&&!extras.officialTrack;
 const applied=activeFilterItems();
 $('#toolbar').innerHTML=`<div id="active-filters" aria-label="Применённые фильтры" ${applied.length?'':'hidden'}>${applied.map(([key,,label])=>`<button type="button" data-remove-filter="${key}" aria-label="Убрать условие: ${esc(label)}"><span>${esc(label)}</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M6 6L18 18M18 6L6 18"/></svg></button>`).join('')}</div>`;
 $('#active-filters').onclick=e=>{const button=e.target.closest('[data-remove-filter]');if(button)removeActiveFilter(button.dataset.removeFilter)};
 $('#view-settings').onclick=viewSettings;
 $('#jump-time').hidden=!visible.length;
 $('#jump-time').onclick=jumpTimeDialog;
 $('#personal').hidden=!mine;
 const goingToday=talks.filter(t=>t.day===day&&chosen.has(t.id)).length;
 const laterToday=talks.filter(t=>t.day===day&&later.has(t.id)).length;
 const personalTotal=extras.section==='later'?laterToday:goingToday;
 $('#count').hidden=mine&&visible.length===personalTotal;
 if(mine)$('#count').textContent=`Показано ${visible.length} из ${personalTotal}`;
 $('#personal').innerHTML=mine?`<div class="personal-tabs"><button data-section="going" aria-pressed="${extras.section==='going'}">Пойду · ${goingToday}</button><button data-section="later" aria-pressed="${extras.section==='later'}">В записи · ${laterToday}</button>${extras.section==='going'?'<button id="calendar" aria-label="Выгрузить все доклады из списка Пойду в календарь" title="Выгрузить в календарь">Выгрузить<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/></svg></button>':''}</div>${extras.section==='later'?'<p class="meta">Доступность записей определяется организаторами.</p>':''}`:'';
 if(mine&&extras.section==='going')$('#calendar').onclick=exportCalendar;
 if(mine&&extras.section==='going'){
  $('#personal').insertAdjacentHTML('beforeend',`<div class="route-switch" role="group" aria-label="Вид личной программы"><button data-personal-view="cards" aria-pressed="${extras.view!=='route'}">Доклады</button><button data-personal-view="route" aria-pressed="${extras.view==='route'}">Мой план дня</button></div>`);
 }
 $('#list').className='grouped-program'+(extras.view==='photos'?' with-posters':'')+(extras.view==='route'&&mine&&extras.section==='going'?' day-plan':'');
 if(!visible.length){
  const elsewhere=fullProgramMatches(query);
  if(elsewhere.length){
   if(!mine)$('#count').textContent=`В полной программе: ${elsewhere.length}`;
   $('#list').innerHTML=`<section class="search-elsewhere"><h2>Нашлось в полной программе</h2><p class="meta">В выбранном дне или фильтрах совпадений нет.</p>${elsewhere.map(t=>`<article><p class="venue">${t.day} ноября · ${t.start}–${t.end} · ${esc(t.room)}</p><button class="title" data-detail="${t.id}"><h3>${esc(t.name)}</h3></button>${t.speaker?`<p class="speaker">${esc(t.speaker)}</p>`:''}<button data-search-result="${t.id}">Показать в программе ${t.day} ноября</button></article>`).join('')}</section>`;
  }else{
   $('#list').innerHTML=`<div class="empty"><h2>${active||query||extras.officialTrack?'Ничего не найдено':mine?'На этот день пока ничего не выбрано':'Нет событий'}</h2><p>${active||query||extras.officialTrack?'Попробуй убрать часть фильтров.':'Добавь интересные выступления из программы.'}</p><button id="empty-action">${active||query||extras.officialTrack?'Сбросить фильтры':'Открыть все доклады'}</button></div>`;
  }
 }else if(extras.view==='route'&&mine&&extras.section==='going'){
  let end=null,previous=null;
  $('#list').innerHTML=[...visible].sort((a,b)=>a.start.localeCompare(b.start)).map(t=>{
   let gap='';if(previous){const diff=minutes(t.start)-end;gap=`<p class="route-gap">${diff<0?'Пересечение: '+(-diff)+' мин':diff===0?'Следующий доклад сразу':diff+' мин между докладами'}${previous.room!==t.room?' · '+esc(previous.room)+' → '+esc(t.room):''}</p>`}
   if(end===null||minutes(t.end)>end){end=minutes(t.end);previous=t}
   return gap+compactCard(t);
  }).join('');
 }else if(extras.sort==='title'){
  $('#list').innerHTML=visible.map(compactCard).join('');
 }else{
  $('#list').innerHTML=timeGroups(visible).map(group=>{
   const ongoing=ongoingAt(group.start);
   return `<section class="time-group" aria-labelledby="time-${group.start.replace(':','')}"><div class="time-heading"><div><h2 id="time-${group.start.replace(':','')}">${group.start}</h2><span>${group.items.length===1?'1 выступление':'Вариантов: '+group.items.length}</span></div>${group.items.length>1?`<button data-group-compare="${group.start}">${comparingTime===group.start?'Завершить выбор':'Сравнить варианты'}</button>`:''}</div>${ongoing.length?`<details class="ongoing"><summary>В это время ещё идут · ${ongoing.length}</summary>${ongoing.map(t=>`<button data-detail="${t.id}"><span>${esc(t.room)} · до ${t.end}</span>${esc(t.name)}</button>`).join('')}</details>`:''}<div class="slot-talks">${group.items.map(compactCard).join('')}</div></section>`;
  }).join('');
 }
 $('#comparebar').hidden=!compareIds.size;
 $('#comparebar').innerHTML=`<span>Выбрано ${compareIds.size} из 2</span><button id="compare-open" ${compareIds.size===2?'':'disabled'}>Сравнить</button><button id="compare-clear">Отмена</button>`;
 $('#compare-open').onclick=showComparison;
 $('#compare-clear').onclick=()=>{compareIds.clear();comparingTime=null;render();$('#jump-time').focus()};
 renderUndo();
};
function viewSettings(){
 openDialog(`<h2 id="dialog-title">Вид программы</h2><label for="view-mode">Карточки</label><select id="view-mode"><option value="list">Компактные с миниатюрами</option><option value="photos">С большими постерами</option><option value="expanded">С краткими описаниями</option>${mine&&extras.section==='going'?'<option value="route">Мой план дня</option>':''}</select><label for="view-sort">Порядок</label><select id="view-sort"><option value="time">По времени · с ранних</option><option value="late">По времени · с поздних</option><option value="title">По названию</option></select><button class="primary" id="view-apply">Применить</button>`);
 $('#view-mode').value=extras.view==='route'&&!mine?'list':extras.view;$('#view-sort').value=extras.sort;
 $('#view-apply').onclick=()=>{extras.view=$('#view-mode').value;extras.sort=$('#view-sort').value;if(extras.view==='route'){resetExtras();extras.sort='time'}render();modal.close()};
}
$('#list').addEventListener('click',e=>{const b=e.target.closest('[data-group-compare]');if(b){comparingTime=comparingTime===b.dataset.groupCompare?null:b.dataset.groupCompare;compareIds.clear();render();document.querySelector(`[data-group-compare="${b.dataset.groupCompare}"]`)?.focus()}const c=e.target.closest('[data-compare]');if(c)document.querySelector(`[data-compare="${c.dataset.compare}"]`)?.focus()});
$('#personal').onclick=e=>{
 const section=e.target.closest('[data-section]'),view=e.target.closest('[data-personal-view]');
 if(section){extras.section=section.dataset.section;render();document.querySelector(`[data-section="${extras.section}"]`)?.focus()}
 if(view){const value=view.dataset.personalView;extras.view=value==='route'?'route':cardView;render();document.querySelector(`[data-personal-view="${value}"]`)?.focus()}
};
const previousListClick=$('#list').onclick;
$('#list').onclick=e=>{
 const found=e.target.closest('[data-search-result]');
 if(found){openSearchResult(found.dataset.searchResult);return}
 if(e.target.closest('#empty-action')){
  const hasFilters=[hall,query,extras.officialTrack,extras.company,extras.speaker,extras.topic,extras.length,extras.after].some(Boolean);
  if(!hasFilters)mine=false;
  resetExtras();render();return;
 }
 previousListClick(e);
 if(e.target.closest('[data-save]')&&undoSelection&&!modal.open&&document.activeElement===document.body)$('#undo-selection')?.focus();
};
const detailedView=details;
details=function(id){
 detailedView(id);
 $('#detail-actions').insertAdjacentHTML('beforeend',`<button id="detail-compare">${compareIds.has(id)?'Убрать из сравнения':'Добавить к сравнению'}</button>`);
 $('#detail-compare').onclick=()=>{if(compareIds.has(id))compareIds.delete(id);else if(compareIds.size<2)compareIds.add(id);else{$('#status').textContent='Сначала сбрось выбранную пару для сравнения.';modal.close();return}render();modal.close();if(compareIds.size===2)showComparison()};
 modal.insertAdjacentHTML('beforeend','<div class="detail-footer"><button id="detail-close-bottom">Закрыть</button></div>');
 $('#detail-close-bottom').onclick=()=>modal.close();
 if(undoSelection?.id===id){modal.insertAdjacentHTML('beforeend','<button id="detail-undo">Отменить изменение списка</button>');$('#detail-undo').onclick=restoreSelection}
};
// Keep fixed controls and keyboard focus clear of the dynamically sized bottom panels.
if(typeof ResizeObserver!=='undefined'&&document.documentElement){
 const nav=document.querySelector('nav'),bar=$('#comparebar'),undo=$('#undo-bar');
 const syncPanels=()=>{
  const navHeight=nav.getBoundingClientRect().height;
  const compareHeight=bar.hidden?0:bar.getBoundingClientRect().height+8;
  const undoHeight=undo.hidden?0:undo.getBoundingClientRect().height+8;
  document.documentElement.style.setProperty('--nav-height',`${navHeight}px`);
  document.documentElement.style.setProperty('--compare-height',`${compareHeight}px`);
  document.documentElement.style.setProperty('--bottom-clearance',`${navHeight+compareHeight+undoHeight+24}px`);
 };
 const observer=new ResizeObserver(syncPanels);[nav,bar,undo].forEach(el=>observer.observe(el));
 document.addEventListener('focusin',e=>{
  if(modal.open||!$('#list').contains(e.target))return;
  requestAnimationFrame(()=>{
   const bounds=e.target.getBoundingClientRect(),bottom=innerHeight-parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom-clearance'));
   const top=(document.querySelector('#scroll-context')?.getBoundingClientRect().height||0)+16;
   if(bounds.top<top||bounds.bottom>bottom)e.target.scrollIntoView({block:'center'});
  });
 });
 syncPanels();
}
render();

// A single compact scroll context replaces sticky group headings.
if(document.documentElement&&typeof requestAnimationFrame==='function'){
 document.body.insertAdjacentHTML('beforeend','<div id="scroll-context" hidden aria-label="Текущее время и день программы"><div class="scroll-context-inner"><strong id="context-time"></strong><button id="context-day" aria-haspopup="dialog"><span id="context-date"></span><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></button></div></div>');
 const context=$('#scroll-context');$('#context-day').onclick=contextDayDialog;
 let frame=null;
 const syncContext=()=>{
  frame=null;
  const list=$('#list'),groups=[...list.querySelectorAll('.time-group')];
  const anchors=groups.length?groups:[...list.querySelectorAll('.compact-event[data-start]')];
  const show=anchors.length>0&&anchors[0].getBoundingClientRect().top<=0&&list.getBoundingClientRect().bottom>0;
  context.hidden=!show;
  if(!show){document.documentElement.style.setProperty('--context-height','0px');return}
  const height=context.getBoundingClientRect().height;
  let current=anchors[0];
  for(const anchor of anchors){if(anchor.getBoundingClientRect().top<=height+1)current=anchor;else break}
  const time=current.dataset.start||current.querySelector('.time-heading h2')?.textContent||'';
  if($('#context-time').textContent!==time)$('#context-time').textContent=time;
  const date=`${day}.11${day==='17'?' · онлайн':''}`;
  if($('#context-date').textContent!==date)$('#context-date').textContent=date;
  $('#context-day').setAttribute('aria-label',`${day} ноября${day==='17'?', онлайн':''}. Сменить день`);
  document.documentElement.style.setProperty('--context-height',`${context.getBoundingClientRect().height}px`);
 };
 const scheduleContext=()=>{if(frame===null)frame=requestAnimationFrame(syncContext)};
 window.addEventListener('scroll',scheduleContext,{passive:true});window.addEventListener('resize',scheduleContext);
 new MutationObserver(scheduleContext).observe($('#list'),{childList:true});
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(scheduleContext).observe(context);
 scheduleContext();
}

if(document.body&&typeof MutationObserver!=='undefined'){
 const typeset=node=>{
  const fix=text=>{
   if(!text.parentElement||text.parentElement.closest('script,style,textarea,input,select,option,pre,code,[contenteditable]'))return;
   const next=readableText(text.nodeValue);if(next!==text.nodeValue)text.nodeValue=next;
  };
  if(node.nodeType===3)fix(node);
  else {const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);while(walker.nextNode())fix(walker.currentNode)}
 };
 typeset(document.body);
 new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')typeset(record.target);else record.addedNodes.forEach(typeset)}}).observe(document.body,{childList:true,subtree:true,characterData:true});
}
