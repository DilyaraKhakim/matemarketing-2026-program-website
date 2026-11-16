// Original interaction layer: discovery, comparison and a personal day plan.
const extras={speaker:'',topic:'',length:'',after:'',sort:'time',view:'photos',section:'going',company:''};
const compareIds=new Set();
let later=new Set(),notes={};
try{const x=JSON.parse(localStorage.getItem('mm26-extra')||'{}');later=new Set(Array.isArray(x.later)?x.later.filter(id=>talks.some(t=>t.id===id)):[]);notes=x.notes&&typeof x.notes==='object'&&!Array.isArray(x.notes)?x.notes:{}}catch{}
const topics={
 'ИИ и агенты':/\bai\b|\bllm\b|ии|агент|нейросет/i,
 'Эксперименты':/a\/b|а\/б|эксперимент|каузаль|причинн/i,
 'Маркетинг':/маркетинг|атрибуц|реклам|crm|ltv|клиент/i,
 'Данные и BI':/\bbi\b|sql|данных|datalens|дашборд|витрин/i,
 'Карьера и команды':/карьер|найм|професси|руковод|команд|обучени/i,
 'Безопасность':/безопасност|утеч|персональн|152-фз|правов/i
};
const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
function speakerNames(t){return (t.speaker||'').split(',').map(name=>name.trim()).filter(Boolean)}
function daySpeakers(){return [...new Set(talks.filter(t=>t.day===day).flatMap(speakerNames))].sort((a,b)=>a.localeCompare(b,'ru'))}
function extraStore(){try{localStorage.setItem('mm26-extra',JSON.stringify({later:[...later],notes}));return true}catch{$('#status').textContent='Изменения доступны только до закрытия страницы: браузер запретил сохранение.';return false}}
function toggleLater(id){if(later.has(id))later.delete(id);else{later.add(id);if(chosen.has(id))save(id)}extraStore();render()}
const oldSave=save;
save=function(id){if(!chosen.has(id)&&later.has(id)){later.delete(id);extraStore()}oldSave(id)};
filtered=function(){
 let result=talks.filter(t=>t.day===day&&(!mine||(extras.section==='later'?later.has(t.id):chosen.has(t.id)))&&(!hall||t.room===hall)&&(!extras.company||(t.companies||[]).includes(extras.company))&&(!extras.speaker||speakerNames(t).includes(extras.speaker))&&(!extras.topic||topics[extras.topic].test(t.name+' '+t.summary))&&(!extras.length||minutes(t.end)-minutes(t.start)<=Number(extras.length))&&(!extras.after||t.start>=extras.after)&&normalize([t.name,t.speaker,t.speakerInfo,t.room,t.summary,t.description].join(' ')).includes(normalize(query)));
 return result.sort(extras.sort==='title'?(a,b)=>a.name.localeCompare(b.name,'ru'):extras.sort==='late'?(a,b)=>b.start.localeCompare(a.start):(a,b)=>a.start.localeCompare(b.start)||a.room.localeCompare(b.room,'ru'));
};
function resetExtras(){extras.company='';extras.speaker='';extras.topic='';extras.length='';extras.after='';hall='';query='';$('#search').value=''}
const baseRender=render;
render=function(){
 baseRender();
 const active=[hall,extras.speaker,extras.topic,extras.length,extras.after,extras.company].filter(Boolean).length;
 $('#filters').textContent=active?`Фильтры · ${active}`:'Фильтры';
 $('#reset').hidden=!active&&!query;
 $('#count').textContent=`Найдено: ${filtered().length}${extras.topic?' · '+extras.topic:''}${hall?' · '+hall:''}`;
 $('#toolbar').innerHTML=`<div class="display-options"><button data-mode="photos" aria-pressed="${extras.view==='photos'}">С фото</button><button data-mode="list" aria-pressed="${extras.view==='list'}">Список</button><button data-mode="expanded" aria-pressed="${extras.view==='expanded'}">С описаниями</button>${mine&&extras.section==='going'?`<button data-mode="route" aria-pressed="${extras.view==='route'}">Мой план дня</button>`:''}</div><label class="sort-label"><span class="sr">Порядок докладов</span><select id="sort"><option value="time">По времени</option><option value="late">Сначала поздние</option><option value="title">По названию</option></select></label>`;
 $('#sort').value=extras.sort;$('#sort').disabled=extras.view==='route'&&mine;$('#sort').onchange=e=>{extras.sort=e.target.value;render()};
 $('#personal').hidden=!mine;
 $('#personal').innerHTML=mine?`<div class="personal-tabs"><button data-section="going" aria-pressed="${extras.section==='going'}">Пойду · ${chosen.size}</button><button data-section="later" aria-pressed="${extras.section==='later'}">Посмотрю в записи · ${later.size}</button><button id="calendar">Скачать календарь</button></div>${extras.section==='later'?'<p class="meta">Список на будущее. Доступ к записям зависит от условий организаторов.</p>':''}`:'';
 if($('#calendar'))$('#calendar').onclick=exportCalendar;
 $('#list').className=extras.view==='photos'?'photo-grid':'';
 const visible=filtered();
 if(visible.length){
  const ordered=extras.view==='route'&&mine&&extras.section==='going'?[...visible].sort((a,b)=>a.start.localeCompare(b.start)):visible;
  let end=null,prev=null;
  $('#list').innerHTML=ordered.map(t=>{
   let transition='';
   if(extras.view==='route'&&mine&&extras.section==='going'){
    if(prev){const gap=minutes(t.start)-end;transition=`<p class="route-gap">${gap<0?'Пересечение: '+(-gap)+' мин':gap===0?'Следующий доклад сразу':gap+' мин между докладами'}${prev.room!==t.room?' · '+esc(prev.room)+' → '+esc(t.room):''}</p>`}
    if(end===null||minutes(t.end)>end){end=minutes(t.end);prev=t}
   }
   const clash=chosen.has(t.id)?conflicts(t):[];
   return `${transition}<article class="event"><div class="event-time"><strong>${t.start}</strong><span>${t.end}</span><span>${minutes(t.end)-minutes(t.start)} мин</span></div><div class="event-body">${extras.view==='photos'&&t.poster?`<button class="card-image" data-detail="${t.id}" aria-label="Открыть доклад: ${esc(t.name)}"><img src="${t.poster}" alt="" loading="lazy" decoding="async"></button>`:''}<p class="venue">${esc(t.room)}</p><button class="title" data-detail="${t.id}"><h2>${esc(t.name)}</h2></button>${t.speaker?`<p class="speaker">${esc(t.speaker)}</p>`:''}${extras.view==='expanded'?`<p class="excerpt">${esc(t.summary||t.description||'Описание пока не опубликовано.')}</p>`:''}${clash.length?`<div class="conflict">Пересекается с ${clash.length} выбранными<button class="text-action" data-pair="${t.id},${clash[0].id}">Сравнить и выбрать</button></div>`:''}${notes[t.id]?'<p class="meta">Есть моя заметка</p>':''}<div class="event-actions"><button class="save" data-save="${t.id}" aria-pressed="${chosen.has(t.id)}">${chosen.has(t.id)?'✓ Пойду':'+ В программу'}</button><button data-compare="${t.id}" aria-pressed="${compareIds.has(t.id)}">${compareIds.has(t.id)?'✓ К сравнению':'Сравнить'}</button><button data-later="${t.id}" aria-pressed="${later.has(t.id)}">${later.has(t.id)?'✓ Посмотрю в записи':'Посмотрю в записи'}</button></div></div></article>`
  }).join('');
 }
 $('#comparebar').hidden=compareIds.size===0;
 $('#comparebar').innerHTML=`<span>Для сравнения: ${compareIds.size} / 2</span><button id="compare-open" ${compareIds.size===2?'':'disabled'}>Сравнить</button><button id="compare-clear">Сбросить</button>`;
 $('#compare-open').onclick=showComparison;$('#compare-clear').onclick=()=>{compareIds.clear();render()};
};
function filterDialog(){
 if(extras.view==='route'){extras.view='list';render()}
 const options=(values,selected)=>values.map(x=>`<option value="${esc(x)}" ${x===selected?'selected':''}>${esc(x)}</option>`).join('');
 openDialog(`<h2 id="dialog-title">Найти своё</h2><div class="filter-grid"><label>Зал<select id="f-hall"><option value="">Все залы</option>${options([...new Set(talks.filter(t=>t.day===day).map(t=>t.room))].sort(),hall)}</select></label><label>Компания<select id="f-company"><option value="">Все компании</option>${options([...new Set(talks.flatMap(t=>t.companies||[]))].sort(),extras.company)}</select></label><label>Спикер<select id="f-speaker"><option value="">Все спикеры</option>${options(daySpeakers(),extras.speaker)}</select></label><label>Длительность<select id="f-length"><option value="">Любая</option>${['35','60','90'].map(x=>`<option value="${x}" ${extras.length===x?'selected':''}>До ${x} минут</option>`).join('')}</select></label><label>Начало не раньше<input id="f-after" type="time" value="${extras.after}"></label></div><button class="primary" id="f-apply">Показать доклады</button><button id="f-reset">Сбросить фильтры</button>`);
 $('#f-apply').onclick=()=>{hall=$('#f-hall').value;extras.company=$('#f-company').value;extras.speaker=$('#f-speaker').value;extras.length=$('#f-length').value;extras.after=$('#f-after').value;render();modal.close()};
 $('#f-reset').onclick=()=>{resetExtras();render();modal.close()};
}
const baseDetails=details;
details=function(id){
 baseDetails(id);const t=talks.find(t=>t.id===id);
 $('#detail-save').insertAdjacentHTML('afterend',`<div id="detail-actions" class="detail-actions"><button id="detail-later">${later.has(id)?'Убрать из списка записей':'Посмотрю в записи'}</button></div>`);
 modal.insertAdjacentHTML('beforeend',`${t.poster?`<figure class="detail-poster"><img src="${t.poster}" alt="Постер: ${esc(t.name)}"></figure>`:''}<section class="my-note"><label for="note">Моя заметка</label><textarea id="note" rows="4" aria-describedby="note-status" placeholder="Вопрос спикеру или мысль, которую хочется сохранить">${esc(notes[id]||'')}</textarea><span id="note-status" role="status">Сохраняется автоматически на этом устройстве</span></section>`);
 const saveNote=()=>{const hadNote=Boolean(notes[id]);notes[id]=$('#note').value;const saved=extraStore();$('#note-status').textContent=saved?'Сохранено':'Не удалось сохранить на устройстве. Не закрывайте страницу.';if(hadNote!==Boolean(notes[id]))render()};
 $('#note').oninput=saveNote;
 $('#detail-later').onclick=()=>{toggleLater(id);details(id)};
};
function showComparison(){
 if(compareIds.size!==2)return;
 const items=[...compareIds].map(id=>talks.find(t=>t.id===id));
 openDialog(`<h2 id="dialog-title">Выбрать доклад</h2><p>${overlaps(...items)?'Доклады пересекаются по времени.':'Эти доклады можно совместить по времени.'}</p><div class="comparison">${items.map(t=>`<section><p class="venue">${t.day} ноября · ${t.start}–${t.end}<br>${esc(t.room)}</p><h3>${esc(t.name)}</h3><p>${esc(t.speaker||'Спикер не указан')}</p><p class="meta">${esc(t.speakerInfo||'')}</p><p>${esc(t.summary||t.description||'Описание пока не опубликовано.')}</p><button data-choose="${t.id}">Пойду на этот</button><button data-record="${t.id}">${later.has(t.id)?'✓ В списке записей':'Посмотрю в записи'}</button></section>`).join('')}</div>`);
 modal.querySelectorAll('[data-choose]').forEach(b=>b.onclick=()=>{const other=items.find(t=>t.id!==b.dataset.choose);if(overlaps(...items)&&chosen.has(other.id))save(other.id);if(!chosen.has(b.dataset.choose))save(b.dataset.choose);modal.close();compareIds.clear();render()});
 modal.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>{toggleLater(b.dataset.record);showComparison()});
}
function icsText(s){return String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,')}
function calendarText(items){
 const stamp=t=>t.replaceAll('-','').replaceAll(':','');
 const utc=(t,time)=>new Date(`${t.date}T${time}:00+03:00`).toISOString().replace(/[-:]/g,'').replace('.000','');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MM26 Personal Program//RU','CALSCALE:GREGORIAN'];
 for(const t of items)lines.push('BEGIN:VEVENT',`UID:${t.id}@mm26.local`,`DTSTAMP:${stamp(new Date().toISOString().replace(/\.\d{3}/,''))}`,`DTSTART:${utc(t,t.start)}`,`DTEND:${utc(t,t.end)}`,`SUMMARY:${icsText(t.name)}`,`LOCATION:${icsText(t.room)}`,`DESCRIPTION:${icsText((t.speaker||'')+'\n'+(notes[t.id]||''))}`,'END:VEVENT');
 lines.push('END:VCALENDAR');
 return lines.map(line=>{let out='',part='';for(const ch of line){if(new TextEncoder().encode(part+ch).length>73){out+=part+'\r\n';part=' '}part+=ch}return out+part}).join('\r\n')+'\r\n';
}
function exportCalendar(){const selected=talks.filter(t=>chosen.has(t.id));if(!selected.length){$('#status').textContent='Сначала добавь доклады в раздел «Пойду».';return}const url=URL.createObjectURL(new Blob([calendarText(selected)],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Моя-программа-ММ26.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#filters').onclick=filterDialog;
$('#search').oninput=e=>{if(extras.view==='route')extras.view='list';query=e.target.value.trim();render()};
$('#reset').onclick=()=>{resetExtras();render()};
$('#toolbar').onclick=e=>{const b=e.target.closest('[data-mode]');if(b){extras.view=b.dataset.mode;if(extras.view==='route'){resetExtras();extras.sort='time'}render()}};
$('#personal').onclick=e=>{const b=e.target.closest('[data-section]');if(b){extras.section=b.dataset.section;render()}};
$('#list').addEventListener('click',e=>{
 const compare=e.target.closest('[data-compare]'),record=e.target.closest('[data-later]'),pair=e.target.closest('[data-pair]');
 if(compare){const id=compare.dataset.compare;if(compareIds.has(id))compareIds.delete(id);else if(compareIds.size<2)compareIds.add(id);else{$('#status').textContent='Для сравнения выбери два доклада. Сбрось текущую пару, чтобы выбрать другую.'}render()}
 if(record)toggleLater(record.dataset.later);
 if(pair){compareIds.clear();pair.dataset.pair.split(',').forEach(id=>compareIds.add(id));showComparison()}
 if(e.target.closest('#empty-action')){resetExtras();render()}
});
const previousSetDay=setDay;
setDay=function(value){extras.speaker='';previousSetDay(value)};
$('#mine').onclick=()=>{mine=true;resetExtras();render();window.scrollTo(0,0)};
$('#all').onclick=()=>{mine=false;resetExtras();render();window.scrollTo(0,0)};
render();
