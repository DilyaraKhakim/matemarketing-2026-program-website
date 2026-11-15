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
 return `<article class="event compact-event ${chosen.has(t.id)?'is-chosen':''}">
 <div class="card-schedule"><span class="venue">${esc(t.room)}</span><span>${t.start}–${t.end}</span></div>
 ${extras.view==='photos'&&t.poster?`<button class="card-image" data-detail="${t.id}" aria-label="Открыть доклад: ${esc(t.name)}"><img src="${t.poster}" alt="" loading="lazy" decoding="async"></button>`:''}
 <div class="compact-content"><div><button class="title" data-detail="${t.id}"><h3>${esc(t.name)}</h3></button>${t.speaker?`<p class="speaker">${esc(t.speaker)}</p>`:''}</div>${extras.view!=='photos'?`<div class="speaker-portraits">${(t.portraits||[]).map(p=>`<button class="speaker-picture" data-detail="${t.id}" aria-label="Открыть доклад: ${esc(t.name)}"><img src="${p.src}" alt="${esc(p.name)}" loading="lazy" decoding="async"></button>`).join('')}</div>`:''}</div>
 ${extras.view==='expanded'?`<p class="excerpt">${esc(t.summary||'')}</p>`:''}
 <div class="compact-actions"><button class="save" data-save="${t.id}" aria-pressed="${chosen.has(t.id)}" aria-label="${chosen.has(t.id)?'Убрать из программы':'Добавить в программу'}: ${esc(t.name)}">${chosen.has(t.id)?'✓ Пойду':'+ Пойду'}</button>${selection?`<button data-compare="${t.id}" aria-pressed="${compareIds.has(t.id)}">${compareIds.has(t.id)?'✓ Выбрано':'Выбрать для сравнения'}</button>`:''}${notes[t.id]?'<span class="meta">Есть заметка</span>':''}</div>
 ${clash.length?`<div class="conflict">Пересекается с выбранным докладом<button class="text-action" data-pair="${t.id},${clash[0].id}">Сравнить и решить</button></div>`:''}</article>`;
}
render=function(){
 const visible=filtered();
 $('#heading').textContent=mine?'Моя программа':'Программа';
 $('#mine').textContent=`Моя программа${chosen.size?' · '+chosen.size:''}`;
 $('#mine').setAttribute('aria-pressed',mine);$('#all').setAttribute('aria-pressed',!mine);
 const active=[hall,extras.company,extras.speaker,extras.topic,extras.length,extras.after].filter(Boolean).length;
 const availableTracks=[...new Set(talks.filter(t=>t.day===day).map(t=>t.track).filter(Boolean))];
 $('#trackbar').innerHTML=`<button id="official-tracks" ${availableTracks.length?'':'disabled'} aria-haspopup="dialog"><span>Треки</span><strong>${!availableTracks.length?'Для онлайн-дня не указаны':extras.officialTrack==='__none'?'Без указанного трека':extras.officialTrack?esc(trackLabel(extras.officialTrack)):'Все направления'}</strong><svg class="track-chevron" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4"/></svg></button>`;
 $('#official-tracks').onclick=officialTracksDialog;
 $('#filters').textContent=`Фильтры${active?' · '+active:''}`;
 $('#count').textContent=`${visible.length} событий${hall?' · '+hall:''}${extras.company?' · '+extras.company:''}${extras.topic?' · '+extras.topic:''}`;
 $('#reset').hidden=!active&&!query&&!extras.officialTrack;
 const applied=activeFilterItems();
 $('#toolbar').innerHTML=`<div id="active-filters" aria-label="Применённые фильтры" ${applied.length?'':'hidden'}>${applied.map(([key,,label])=>`<button type="button" data-remove-filter="${key}" aria-label="Убрать условие: ${esc(label)}"><span>${esc(label)}</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M6 6L18 18M18 6L6 18"/></svg></button>`).join('')}</div><button id="view-settings" class="text-action">Вид и порядок</button>`;
 $('#active-filters').onclick=e=>{const button=e.target.closest('[data-remove-filter]');if(button)removeActiveFilter(button.dataset.removeFilter)};
 $('#view-settings').onclick=viewSettings;
 $('#personal').hidden=!mine;
 const goingToday=talks.filter(t=>t.day===day&&chosen.has(t.id)).length;
 const laterToday=talks.filter(t=>t.day===day&&later.has(t.id)).length;
 $('#personal').innerHTML=mine?`<div class="personal-tabs"><button data-section="going" aria-pressed="${extras.section==='going'}">Пойду · ${goingToday}</button><button data-section="later" aria-pressed="${extras.section==='later'}">Посмотрю в записи · ${laterToday}</button><button id="calendar" aria-label="Выгрузить выбранные доклады в календарь">Выгрузить в календарь</button></div>${extras.section==='later'?'<p class="meta">Доступность записей определяется организаторами.</p>':''}`:'';
 if(mine)$('#calendar').onclick=exportCalendar;
 $('#list').className='grouped-program'+(extras.view==='photos'?' with-posters':'');
 if(!visible.length){
  const elsewhere=fullProgramMatches(query);
  if(elsewhere.length){
   $('#count').textContent=`В полной программе: ${elsewhere.length}`;
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
 $('#compare-clear').onclick=()=>{compareIds.clear();comparingTime=null;render()};
};
function viewSettings(){
 openDialog(`<h2 id="dialog-title">Вид программы</h2><label for="view-mode">Карточки</label><select id="view-mode"><option value="list">Компактные с миниатюрами</option><option value="photos">С большими постерами</option><option value="expanded">С краткими описаниями</option>${mine&&extras.section==='going'?'<option value="route">Мой маршрут с перерывами</option>':''}</select><label for="view-sort">Порядок</label><select id="view-sort"><option value="time">По времени · с ранних</option><option value="late">По времени · с поздних</option><option value="title">По названию</option></select><button class="primary" id="view-apply">Применить</button>`);
 $('#view-mode').value=extras.view==='route'&&!mine?'list':extras.view;$('#view-sort').value=extras.sort;
 $('#view-apply').onclick=()=>{extras.view=$('#view-mode').value;extras.sort=$('#view-sort').value;if(extras.view==='route'){resetExtras();extras.sort='time'}render();modal.close()};
}
$('#list').addEventListener('click',e=>{const b=e.target.closest('[data-group-compare]');if(b){comparingTime=comparingTime===b.dataset.groupCompare?null:b.dataset.groupCompare;compareIds.clear();render()}});
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
};
const detailedView=details;
details=function(id){
 detailedView(id);
 $('#detail-actions').insertAdjacentHTML('beforeend',`<button id="detail-compare">${compareIds.has(id)?'Убрать из сравнения':'Добавить к сравнению'}</button>`);
 $('#detail-compare').onclick=()=>{if(compareIds.has(id))compareIds.delete(id);else if(compareIds.size<2)compareIds.add(id);else{$('#status').textContent='Сначала сбрось выбранную пару для сравнения.';modal.close();return}render();modal.close();if(compareIds.size===2)showComparison()};
 modal.insertAdjacentHTML('beforeend','<div class="detail-footer"><button id="detail-close-bottom">Закрыть</button></div>');
 $('#detail-close-bottom').onclick=()=>modal.close();
};
render();
