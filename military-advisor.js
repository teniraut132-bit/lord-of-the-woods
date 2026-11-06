/* Военный советник 2.6 — браузерная реализация расчётного ядра из Python-версии. */
(() => {
  'use strict';
  const STORAGE_KEY = 'lordOfTheWoods.militaryAdvisor.v1';
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `ma-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, n(v)));
  const fmt = v => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:1}).format(n(v));
  const sessionGet = key => { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } };
  const sessionSet = (key,value) => { try { sessionStorage.setItem(key,value); } catch { /* file:///ограниченный режим: настройки останутся в памяти вкладки */ } };
  const UNIT_TYPES = ['пехота','стрелки','конница','осадные','магия','особое'];
  const UNIT_CATEGORIES = ['сброд','специалисты'];
  const RACES = ['Не указана','Нежить','Аренцы','Вампиры','Рун','Шаньди','Нэкомата','Гобы','Валессийцы','Грандийцы','Инверсы','Мазуры','Тёмные орки','Скавены','Сатиры','Тавуры','Таунгуры','Бругачи','Друкхари','Люди','Эльфы','Дворфы','Орки','Полурослики'];
  const UNIQUE_UNITS = {
    'Аренцы':['Всадники на тушканчиках','Знахарь'],
    'Грандийцы':['Летучие отряды'],
    'Инверсы':['Тяжёлая пехота инверсов'],
    'Мазуры':['Стая мазуров'],
    'Тёмные орки':['Уруки'],
    'Скавены':['Трэллы']
  };
  const ARMOR = {
    'стёганка':1.00,'варёная кожа':1.10,'чешуя':1.20,'кольчуга':1.30,
    'бригантина':1.40,'полулаты':1.50,'полные латы':1.60
  };
  const WEAPONS = {
    'древковое':1.10,'одноручное':1.00,'двуручное':1.20,
    'ударно-дробящее':1.10,'лёгкое дистанционное':0.90,
    'тяжёлое дистанционное':1.00,'огнестрельное':1.30
  };
  const TRAINING_TIERS = [[0,15,'Сброд'],[15,30,'Новобранцы'],[30,50,'Регулярные'],[50,70,'Профессионалы'],[70,90,'Ветераны'],[90,101,'Живые мифы']];
  const MORALE_TIERS = [[0,1,'Полностью разбиты'],[1,15,'Низкая мораль'],[15,30,'Средняя мораль'],[30,50,'Высокая мораль'],[50,70,'Преданные'],[70,90,'Фанатики'],[90,101,'Верность за гранью безумия']];
  const SIEGE = {
    'Баллиста':{damage:'Средний',dmg:15,costRem:30,costMon:100},
    'Таран':{damage:'Высокий',dmg:25,costRem:20,costMon:50},
    'Катапульта':{damage:'Высокий',dmg:30,costRem:40,costMon:150},
    'Требушет':{damage:'Очень высокий',dmg:45,costRem:60,costMon:250},
    'Осадная башня':{damage:'Высокий',dmg:35,costRem:50,costMon:200},
    'Бомбарда':{damage:'Максимальный',dmg:60,costRem:100,costMon:500,needs:['железо','уголь']},
    'Мортира':{damage:'Максимальный',dmg:70,costRem:120,costMon:600,needs:['железо','уголь']}
  };
  const ORDERS = {
    'Атака в лоб':{power:1.10,morale:0.85,siege:1,cleric:0,req:null,desc:'+10% к силе, −15% к духу. Универсальный приказ.'},
    'Оборона':{power:0.90,morale:1.20,siege:1,cleric:0,req:null,desc:'+20% к духу, −10% к силе. Держать позиции.'},
    'Обходной манёвр':{power:1.25,morale:1,siege:1,cleric:0,req:'cavalry',desc:'+25% к силе. Требует конницу ≥20% армии.'},
    'Стреловой залп':{power:1.15,morale:1,siege:1,cleric:0,req:'ranged',desc:'+15% к силе. Требует стрелков ≥30%.'},
    'Осадный штурм':{power:1,morale:1,siege:1.5,cleric:0,req:'siege',desc:'×1,5 к урону осадных. Требует осадные орудия.'},
    'Магический удар':{power:1.50,morale:1,siege:1,cleric:5,req:'magic',desc:'+50% к силе, −5 Клирики. Требует магов.'},
    'Отступление':{power:0.50,morale:0.80,siege:1,cleric:0,req:null,desc:'×0,50 к силе и ×0,80 к духу. См. примечание о потерях ниже.'},
    'Воодушевление':{power:1,morale:1.20,siege:1,cleric:0,req:'priests',desc:'+20% к духу. Требует ≥100 священников.'}
  };
  const SYSTEM_INSTRUCTIONS = 'Ты — военный советник в фэнтезийной средневековой стратегии. Отвечай на русском. Используй только переданное состояние армии и фактический отчёт. Чётко различай расчётные факты и тактические предположения. Не утверждай, что приказ исполнен, что отряд совершил фланговый манёвр или атаковал конкретную цель, если игровой движок этого не моделировал. Текущий движок поддерживает только фиксированные приказы, указанные в контексте. При анализе свободного текста предложи, какие встроенные приказы ближе всего к плану, отметь ограничения и риски. Не запускай бой и не меняй состояние игры — лишь анализируй и составляй сводки. Будь ясным, структурированным и не выдумывай числа, потери, проценты победы или события, которых нет в отчёте. Учитывай только прямые расовые эффекты на обученность и боевой дух. Вампиры: специалисты имеют минимум 50% обученности. Друкхари: эффективный боевой дух каждого отряда увеличивается на 20%, максимум 100%. Бругачи: эффективный боевой дух отряда численностью строго больше 100 уменьшается на 10%. Расовые модификаторы не меняют базовое поле морали. Все остальные расовые/небоевые эффекты не влияют на бой. Уникальный отряд — только расовая маркировка, специальных боевых способностей пока нет.';

  const defaultArmy = (name) => ({name,units:[],siege_engines:[],fortification:0,priests:0,cleric:100,feudal_loyalty:60,feudal_count:100});
  const defaultData = () => ({version:1,turn:0,army_a:defaultArmy('Армия A'),army_b:defaultArmy('Армия B'),order_a:'Атака в лоб',order_b:'Оборона',history:[],last_report:null});
  let data = load();
  let rootNode = null;
  let handlersBound = false;
  let aiKey = '';
  let aiModel = sessionGet('ma.ai.model') || 'gpt-6-luna';
  let chatHistory = [];
  let aiBusy = false;

  function normalizeUnit(u={}) {
    const race = RACES.includes(u.race) ? u.race : 'Не указана';
    const category = UNIT_CATEGORIES.includes(u.category) ? u.category : 'сброд';
    const floor = race === 'Вампиры' && category === 'специалисты' ? 50 : 0;
    const allowedUnique = UNIQUE_UNITS[race] || [];
    return {id:u.id||uid(),name:String(u.name||'Новый отряд'),type:UNIT_TYPES.includes(u.type)?u.type:'пехота',category,
      count:Math.max(0,Math.floor(n(u.count??100))),training:clamp(Math.max(n(u.training??30),floor),floor,100),morale:clamp(u.morale??50,0,100),
      armor:Object.hasOwn(ARMOR,u.armor)?u.armor:'стёганка',weapon:Object.hasOwn(WEAPONS,u.weapon)?u.weapon:'одноручное',
      iron_sources:clamp(Math.floor(u.iron_sources??0),0,10),arsenal:!!u.arsenal,citadel:!!u.citadel,race,
      unique_unit:allowedUnique.includes(u.unique_unit)?u.unique_unit:''};
  }
  function normalizeArmy(a={},name='Армия') {
    const out={...defaultArmy(name),...a};
    out.name=String(out.name||name);out.units=(out.units||[]).map(normalizeUnit);
    out.siege_engines=(out.siege_engines||[]).filter(x=>Object.hasOwn(SIEGE,x.type)&&n(x.count)>0).map(x=>({type:x.type,count:Math.max(0,Math.floor(n(x.count)))}));
    out.fortification=Math.max(0,n(out.fortification));out.priests=Math.max(0,n(out.priests));out.cleric=n(out.cleric);
    out.feudal_count=Math.max(0,n(out.feudal_count));out.feudal_loyalty=clamp(out.feudal_loyalty,0,100);
    return out;
  }
  function load() {
    try { const d=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); if(!d)return defaultData(); return {...defaultData(),...d,army_a:normalizeArmy(d.army_a,'Армия A'),army_b:normalizeArmy(d.army_b,'Армия B'),history:Array.isArray(d.history)?d.history:[]}; }
    catch { return defaultData(); }
  }
  function save(){ try { localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); const el=$('#saveStatus'); if(el)el.textContent='Изменения сохраняются в этом браузере'; } catch(e) { console.warn('Military adviser save failed',e); } }
  function notify(message,type='ok'){const region=$('#toastRegion');if(!region){console[type==='error'?'error':'log'](message);return;}const el=document.createElement('div');el.className='toast'+(type==='error'?' error':'');el.textContent=message;region.append(el);setTimeout(()=>el.remove(),4200);}
  function trainingFloor(u){return u.race==='Вампиры'&&u.category==='специалисты'?50:0;}
  function moraleMultiplier(u){if(u.race==='Друкхари')return 1.2;if(u.race==='Бругачи'&&u.count>100)return .9;return 1;}
  function effectiveMorale(u){return clamp(u.morale*moraleMultiplier(u),0,100);}
  function effectiveTraining(u){return Math.max(u.training,trainingFloor(u));}
  function tier(value,tiers){const t=tiers.find(([lo,hi])=>value>=lo&&value<hi);return t?t[2]:String(value)+'%';}
  function totalCount(a){return a.units.reduce((sum,u)=>sum+u.count,0);}
  function composition(a){const total=totalCount(a);if(!total)return {};const out={};a.units.forEach(u=>out[u.type]=(out[u.type]||0)+u.count);Object.keys(out).forEach(k=>out[k]=out[k]/total*100);return out;}
  function upkeep(u){const discount=Math.min(u.iron_sources*.05,.20)+(u.arsenal?.10:0)+(u.citadel?.15:0);return Math.round(u.count*(1-Math.min(discount,.45))*100)/100;}
  function upkeepSummary(a){return {units:totalCount(a),upkeep:Math.round(a.units.reduce((s,u)=>s+upkeep(u),0)*100)/100,siegePurchaseCost:a.siege_engines.reduce((s,e)=>s+(SIEGE[e.type]?.costMon||0)*e.count,0)};}
  function recruitmentPool(a){const penalty=a.feudal_loyalty<20?.5:1;return {specialists:Math.floor(a.feudal_count*.5*penalty),rabble:Math.floor(a.feudal_count*2*penalty),penalty_applied:penalty<1,loyalty:a.feudal_loyalty};}
  function unitPower(u,enemyTypes){let base=u.count*(effectiveTraining(u)/100)*(effectiveMorale(u)/100);if(base<=0)return 0;let power=base*(ARMOR[u.armor]||1)*(WEAPONS[u.weapon]||1);if(u.type==='осадные')power*=.2;else if(u.type==='магия')power*=1.5;else if(u.type==='особое')power*=1.1;if(enemyTypes?.has('конница')&&u.weapon==='древковое')power*=1.20;if(u.weapon==='ударно-дробящее')power*=1.05;return power;}
  function siegeDamage(a){return a.siege_engines.reduce((s,e)=>s+(SIEGE[e.type]?.dmg||0)*e.count,0);}
  function orderAvailable(orderName,a){const o=ORDERS[orderName];if(!o)return {ok:false,reason:'Неизвестный приказ'};const comp=composition(a),units=totalCount(a);if(o.req==='cavalry'&&(comp['конница']||0)<20)return {ok:false,reason:`Нужно ≥20% конницы (сейчас ${(comp['конница']||0).toFixed(0)}%)`};if(o.req==='ranged'&&(comp['стрелки']||0)<30)return {ok:false,reason:`Нужно ≥30% стрелков (сейчас ${(comp['стрелки']||0).toFixed(0)}%)`};if(o.req==='siege'&&!a.siege_engines.length)return {ok:false,reason:'Нужны осадные орудия'};if(o.req==='magic'){if((comp['магия']||0)<=0)return {ok:false,reason:'Нужны маги'};if(a.cleric<o.cleric)return {ok:false,reason:`Недостаточно Клирики (${a.cleric})`};}if(o.req==='priests'&&a.priests<100)return {ok:false,reason:`Нужно ≥100 священников (сейчас ${a.priests})`};return {ok:true,reason:''};}
  function distributeLosses(a,totalLosses){const units=a.units;if(totalLosses<=0||!units.length)return units.map(()=>0);const total=totalCount(a);if(!total)return units.map(()=>0);let assigned=0;return units.map((u,i)=>{let loss;if(i===units.length-1)loss=totalLosses-assigned;else{loss=Math.floor(totalLosses*(u.count/total));assigned+=loss;}return clamp(loss,0,u.count);});}
  function snapshot(a){return a.units.map(u=>({count:u.count,morale:u.morale,effective_morale:effectiveMorale(u),training:effectiveTraining(u),race:u.race}));}
  function resolveBattle() {
    const a=data.army_a,b=data.army_b,oa=data.order_a,ob=data.order_b,orderA=ORDERS[oa],orderB=ORDERS[ob];
    if(totalCount(a)===0&&totalCount(b)===0)throw new Error('Обе армии пусты. Добавьте хотя бы одно подразделение.');
    const availableA=orderAvailable(oa,a),availableB=orderAvailable(ob,b);
    if(!availableA.ok)throw new Error(`Приказ армии A недоступен: ${availableA.reason}`);
    if(!availableB.ok)throw new Error(`Приказ армии B недоступен: ${availableB.reason}`);
    // Проверки обеих сторон выполняются до списания Клирики.
    const snapA=snapshot(a),snapB=snapshot(b),enemyTypesA=new Set(Object.keys(composition(b))),enemyTypesB=new Set(Object.keys(composition(a)));
    if(orderA.cleric)a.cleric-=orderA.cleric;if(orderB.cleric)b.cleric-=orderB.cleric;
    let powerA=a.units.reduce((s,u)=>s+unitPower(u,enemyTypesA),0)*orderA.power*orderA.morale;
    let powerB=b.units.reduce((s,u)=>s+unitPower(u,enemyTypesB),0)*orderB.power*orderB.morale;
    const feudalPenaltyA=a.feudal_loyalty<20,feudalPenaltyB=b.feudal_loyalty<20;if(feudalPenaltyA)powerA*=.85;if(feudalPenaltyB)powerB*=.85;
    const damageA=siegeDamage(a)*orderA.siege,damageB=siegeDamage(b)*orderB.siege,fortABefore=a.fortification,fortBBefore=b.fortification;
    if(b.fortification>0){b.fortification=Math.max(0,b.fortification-damageA);if(b.fortification===0)powerB*=.70;}
    if(a.fortification>0){a.fortification=Math.max(0,a.fortification-damageB);if(a.fortification===0)powerA*=.70;}
    const totalA=totalCount(a),totalB=totalCount(b);let ratioA=.5,ratioB=.5;if(powerA+powerB!==0){ratioA=powerA/(powerA+powerB);ratioB=powerB/(powerA+powerB);}
    const lossesA=Math.floor(totalA*(1-ratioA)*.30),lossesB=Math.floor(totalB*(1-ratioB)*.30),mapA=distributeLosses(a,lossesA),mapB=distributeLosses(b,lossesB);
    a.units.forEach((u,i)=>u.count=Math.max(0,u.count-mapA[i]));b.units.forEach((u,i)=>u.count=Math.max(0,u.count-mapB[i]));
    let winner='Ничья';if(powerA>powerB){winner='A';a.units.forEach(u=>{u.morale=Math.min(100,u.morale+10);u.training=clamp(Math.max(u.training,trainingFloor(u))+2,0,100);});b.units.forEach(u=>{u.morale=Math.max(0,u.morale-15);u.training=clamp(Math.max(u.training,trainingFloor(u))+1,0,100);});}else if(powerB>powerA){winner='B';b.units.forEach(u=>{u.morale=Math.min(100,u.morale+10);u.training=clamp(Math.max(u.training,trainingFloor(u))+2,0,100);});a.units.forEach(u=>{u.morale=Math.max(0,u.morale-15);u.training=clamp(Math.max(u.training,trainingFloor(u))+1,0,100);});}else{a.units.forEach(u=>u.training=clamp(Math.max(u.training,trainingFloor(u))+1,0,100));b.units.forEach(u=>u.training=clamp(Math.max(u.training,trainingFloor(u))+1,0,100));}
    if(winner==='A'){a.feudal_loyalty=clamp(a.feudal_loyalty+3,0,100);b.feudal_loyalty=clamp(b.feudal_loyalty-4,0,100);}else if(winner==='B'){b.feudal_loyalty=clamp(b.feudal_loyalty+3,0,100);a.feudal_loyalty=clamp(a.feudal_loyalty-4,0,100);}
    const cards=(army,snap)=>army.units.map((u,i)=>{const before=snap[i];return {name:u.name,type:u.type,race:u.race,unique_unit:u.unique_unit,count_before:before.count,count_after:u.count,loss:before.count-u.count,morale_before:before.morale,morale_after:u.morale,morale_delta:u.morale-before.morale,effective_morale_before:before.effective_morale,effective_morale_after:effectiveMorale(u),effective_morale_delta:effectiveMorale(u)-before.effective_morale,training_before:before.training,training_after:effectiveTraining(u),training_delta:effectiveTraining(u)-before.training};});
    data.turn+=1;
    const report={turn:data.turn,winner,power_a:Math.round(powerA*10)/10,power_b:Math.round(powerB*10)/10,ratio_a:Math.round(ratioA*1000)/1000,ratio_b:Math.round(ratioB*1000)/1000,losses_a:lossesA,losses_b:lossesB,fort_a_before:fortABefore,fort_a_after:a.fortification,fort_b_before:fortBBefore,fort_b_after:b.fortification,siege_dmg_to_b:Math.floor(damageA),siege_dmg_to_a:Math.floor(damageB),order_a:oa,order_b:ob,cleric_a:a.cleric,cleric_b:b.cleric,feudal_loyalty_a:a.feudal_loyalty,feudal_loyalty_b:b.feudal_loyalty,feudal_penalty_a:feudalPenaltyA,feudal_penalty_b:feudalPenaltyB,cards_a:cards(a,snapA),cards_b:cards(b,snapB)};
    data.history.push(report);if(data.history.length>100)data.history.shift();data.last_report=report;save();return report;
  }
  function unitNote(u){const bits=[];if(u.race==='Вампиры'&&u.category==='специалисты')bits.push('обученность не ниже 50%');if(u.race==='Друкхари')bits.push('эффективный боевой дух +20% (макс. 100%)');if(u.race==='Бругачи'&&u.count>100)bits.push('эффективный боевой дух −10% при численности >100');return bits.join('; ')||'прямых расовых модификаторов обученности/духа нет';}
  function renderArmy(tag,a) {
    const total=totalCount(a),comp=composition(a),up=upkeepSummary(a),pool=recruitmentPool(a);
    const compStr=Object.entries(comp).map(([k,v])=>`${k}: ${fmt(v)}%`).join(' · ')||'Нет подразделений';
    const unitsHtml=a.units.length?`<div class="ma-unit-list">${a.units.map(u=>`<article class="ma-unit-row"><div class="ma-unit-info"><strong>${esc(u.name)}</strong><small>${esc(u.race)} · ${esc(u.type)} · ${esc(u.category)}${u.unique_unit?' · '+esc(u.unique_unit):''}</small><small>${u.count.toLocaleString('ru-RU')} бойцов · обученность ${effectiveTraining(u)}% (${esc(tier(effectiveTraining(u),TRAINING_TIERS))}) · дух ${fmt(effectiveMorale(u))}% (${esc(tier(effectiveMorale(u),MORALE_TIERS))})</small><small class="muted">${esc(unitNote(u))}</small></div><div class="ma-unit-buttons"><button class="btn small secondary" data-ma-action="edit-unit" data-army="${tag}" data-id="${u.id}">Изменить</button><button class="btn small danger" data-ma-action="delete-unit" data-army="${tag}" data-id="${u.id}">Удалить</button></div></article>`).join('')}</div>`:'<div class="empty-inline">В этой армии пока нет подразделений.</div>';
    const siegeText=a.siege_engines.length?a.siege_engines.map(e=>`${esc(e.type)} × ${e.count}`).join(' · '):'Нет осадных орудий';
    return `<section class="card ma-army-card"><div class="ma-army-heading"><div><div class="section-kicker">СТОРОНА ${tag}</div><h3>${esc(a.name)}</h3><p>${total.toLocaleString('ru-RU')} бойцов · содержание ${fmt(up.upkeep)} монет/год</p></div><span class="pill ${a.feudal_loyalty<20?'red':'gold'}">${a.feudal_loyalty<20?'Бунт феодалов':'Лояльность '+a.feudal_loyalty+'%'}</span></div>
      <div class="ma-army-fields"><label>Название армии<input data-ma-field="name" data-army="${tag}" value="${esc(a.name)}" maxlength="60"></label><label>Укрепления<input type="number" min="0" data-ma-field="fortification" data-army="${tag}" value="${a.fortification}"></label><label>Священники<input type="number" min="0" data-ma-field="priests" data-army="${tag}" value="${a.priests}"></label><label>Клирика<input type="number" data-ma-field="cleric" data-army="${tag}" value="${a.cleric}"></label><label>Феодалы<input type="number" min="0" data-ma-field="feudal_count" data-army="${tag}" value="${a.feudal_count}"></label><label>Лояльность феодалов<input type="number" min="0" max="100" data-ma-field="feudal_loyalty" data-army="${tag}" value="${a.feudal_loyalty}"></label></div>
      <div class="ma-summary"><div><span>Состав армии</span><strong>${esc(compStr)}</strong></div><div><span>Осадный урон за приказ</span><strong>${siegeDamage(a)}</strong></div><div><span>Пул специалистов / сброда</span><strong>${pool.specialists} / ${pool.rabble}${pool.penalty_applied?' · призыв урезан вдвое':''}</strong></div><div><span>Закупочная стоимость осадных</span><strong>${fmt(up.siegePurchaseCost)} монет</strong></div></div>
      <div class="ma-toolbar"><button class="btn small" data-ma-action="add-unit" data-army="${tag}">＋ Добавить отряд</button><button class="btn small secondary" data-ma-action="siege" data-army="${tag}">Осадные орудия (${a.siege_engines.reduce((s,e)=>s+e.count,0)})</button><button class="btn small secondary" data-ma-action="recruitment" data-army="${tag}">Пул призыва</button><button class="btn small ghost" data-ma-action="export-army" data-army="${tag}">Экспорт армии</button></div>
      <div class="ma-section-label">ПОДРАЗДЕЛЕНИЯ</div>${unitsHtml}<div class="ma-section-label">ОСАДНЫЕ ОРУДИЯ</div><div class="small-note">${siegeText}</div></section>`;
  }
  function renderReport(r) {
    if(!r)return '<div class="empty-state"><div class="empty-icon">⚔</div><h3>Сражений ещё не было</h3><p>Добавьте подразделения обеим сторонам, выберите приказы и рассчитайте бой.</p></div>';
    const winnerName=r.winner==='A'?'Победа армии A':r.winner==='B'?'Победа армии B':'Ничья';
    const cards=[...r.cards_a.map(c=>({...c,army:'A'})),...r.cards_b.map(c=>({...c,army:'B'}))];
    return `<div class="ma-result-banner ${r.winner==='Ничья'?'draw':''}"><div><div class="section-kicker">ХОД ${r.turn}</div><h3>${winnerName}</h3><p>Сила A ${fmt(r.power_a)} (${fmt(r.ratio_a*100)}%) · Сила B ${fmt(r.power_b)} (${fmt(r.ratio_b*100)}%)</p></div><span class="pill gold">Потери A: ${r.losses_a} · B: ${r.losses_b}</span></div>
      <div class="grid kpis ma-result-kpis"><div class="card"><div class="card-title">Потери армии A</div><div class="kpi-value">${r.losses_a}</div></div><div class="card"><div class="card-title">Потери армии B</div><div class="kpi-value">${r.losses_b}</div></div><div class="card"><div class="card-title">Осадный урон A → B</div><div class="kpi-value">${r.siege_dmg_to_b}</div><div class="kpi-note">Стены B: ${r.fort_b_before} → ${r.fort_b_after}</div></div><div class="card"><div class="card-title">Осадный урон B → A</div><div class="kpi-value">${r.siege_dmg_to_a}</div><div class="kpi-note">Стены A: ${r.fort_a_before} → ${r.fort_a_after}</div></div></div>
      <div class="table-wrap" style="margin-top:14px"><table class="data-table ma-results-table"><thead><tr><th>Армия</th><th>Подразделение / раса</th><th>Численность</th><th>Боевой дух (было → стало)</th><th>Обученность (было → стало)</th></tr></thead><tbody>${cards.map(c=>{const lossClass=c.count_before>0&&c.loss/c.count_before>.5?'loss-heavy':c.loss>0?'loss-small':'';const outcome=c.army===r.winner?'unit-win':r.winner==='Ничья'?'': 'unit-lose';return `<tr class="${lossClass} ${outcome}"><td>${c.army}</td><td><strong>${esc(c.name)}</strong><br><span class="muted">${esc(c.type)} / ${esc(c.race)}${c.unique_unit?' / '+esc(c.unique_unit):''}</span></td><td>${c.count_before} → ${c.count_after}${c.loss?` <span class="bad">(−${c.loss})</span>`:''}</td><td>${fmt(c.effective_morale_before)}% → ${fmt(c.effective_morale_after)}% <span class="muted">(баз. ${c.morale_before} → ${c.morale_after})</span></td><td>${fmt(c.training_before)}% → ${fmt(c.training_after)}%${c.training_delta?` <span class="good">(+${c.training_delta})</span>`:''}</td></tr>`;}).join('')}</tbody></table></div>
      <div class="notice" style="margin-top:12px">Приказы: A — ${esc(r.order_a)}, B — ${esc(r.order_b)}. Клирика после приказов: A — ${fmt(r.cleric_a)}, B — ${fmt(r.cleric_b)}. Лояльность феодалов: A — ${r.feudal_loyalty_a}%, B — ${r.feudal_loyalty_b}%. ${r.feudal_penalty_a?'⚠ Армия A получила штраф силы −15% из-за лояльности феодалов ниже 20%. ':''}${r.feudal_penalty_b?'⚠ Армия B получила штраф силы −15% из-за лояльности феодалов ниже 20%. ':''}</div>`;
  }
  function renderAI() {
    return `<section class="card ma-ai-card"><div class="section-head"><div><div class="section-kicker">ИИ-ШТАБ</div><h2>Военный советник</h2><p>Анализ текстовых приказов, состава армий и сводка последнего боя. Советник не запускает бой и не меняет состояние кампании.</p></div><span class="pill gold">2.6</span></div>
      <div class="notice">ИИ использует только переданное состояние кампании. Уникальные подразделения пока являются маркировкой, а не источником дополнительных боевых способностей. Для анализа требуется отдельный OpenAI API-ключ и оплачиваемый API-доступ.</div>
      <details class="ma-ai-settings"><summary>Настройки ИИ</summary><div class="ma-ai-settings-fields"><label>OpenAI API key<input id="maApiKey" type="password" autocomplete="off" placeholder="sk-…"></label><label>Модель<select id="maApiModel">${["gpt-6-luna","gpt-6-sol","gpt-6-astra","gpt-5.4-mini","gpt-4.1-mini"].map(m=>`<option value="${m}" ${aiModel===m?"selected":""}>${m}</option>`).join("")}</select></label><button class="btn small secondary" type="button" data-ma-action="save-ai-settings">Сохранить настройки на этот сеанс</button></div><p class="small-note">Ключ хранится только в sessionStorage текущей вкладки и не попадает в экспорт кампании. Важно: для публичного размещения безопаснее подключить серверный прокси; прямой браузерный запрос раскрывает ключ владельцу браузера и не подходит для общего ключа проекта.</p></details>
      <div class="ma-chat-toolbar"><button class="btn small secondary" type="button" data-ma-action="analyze-order">Анализировать текстовый приказ</button><button class="btn small secondary" type="button" data-ma-action="summarize-battle" ${data.last_report?'':'disabled'}>Сводка последнего боя</button><button class="btn small ghost" type="button" data-ma-action="clear-chat">Очистить чат</button></div>
      <div class="ma-chat-log" id="maChatLog">${chatHistory.length?chatHistory.map(m=>`<div class="ma-chat-message ${m.role}"><strong>${m.role==='user'?'Вы':m.role==='error'?'Ошибка ИИ':'Военный советник'}</strong><p>${esc(m.text).replace(/\n/g,'<br>')}</p></div>`).join(''):'<div class="empty-inline">Военный советник готов. Задайте вопрос или отправьте текстовый приказ.</div>'}</div>
      <form id="maChatForm" class="ma-chat-form"><textarea name="message" rows="3" placeholder="Введите вопрос или текстовый приказ…" required></textarea><div class="ma-chat-bottom"><span id="maAIStatus" class="small-note">${aiKey?'API-ключ задан для этого сеанса':'ИИ не подключён'}</span><button class="btn" type="submit" ${aiBusy?'disabled':''}>${aiBusy?'Советник думает…':'Отправить советнику'}</button></div></form>
    </section>`;
  }
  function render() {
    if(!rootNode)return;
    const oa=ORDERS[data.order_a]||ORDERS['Атака в лоб'],ob=ORDERS[data.order_b]||ORDERS['Оборона'];
    const checkA=orderAvailable(data.order_a,data.army_a),checkB=orderAvailable(data.order_b,data.army_b);
    rootNode.innerHTML=`<div class="section-head"><div><div class="section-kicker">ШТАБ КАМПАНИИ · ВЕРСИЯ 2.6</div><h2>Военный советник</h2><p>Самостоятельная боевая механика. Она не связана с благосклонностью Хозяина леса и не расходует Клирику, кроме приказа «Магический удар» внутри самого военного советника.</p></div><div class="ma-top-actions"><button class="btn small secondary" data-ma-action="export-campaign">⇩ Экспорт кампании</button><button class="btn small secondary" data-ma-action="import-campaign">⇧ Импорт кампании</button><input id="maImportFile" type="file" accept="application/json,.json" hidden></div></div>
      <div class="notice">Расчёт сохраняет исходную механику советника 2.6. Прямые расовые модификаторы: Вампиры — минимум 50% обученности у специалистов; Друкхари — +20% эффективного боевого духа, максимум 100%; Бругачи — −10% эффективного духа при численности строго больше 100. Орочьи экономические эффекты остаются справочными и не входят в боевую формулу.</div>
      <div class="ma-armies-grid">${renderArmy('A',data.army_a)}${renderArmy('B',data.army_b)}</div>
      <section class="card ma-command-card"><div class="section-kicker">ПРИКАЗЫ И РАСЧЁТ СРАЖЕНИЯ</div><div class="ma-orders-grid"><label>Приказ армии A<select data-ma-order="order_a">${Object.keys(ORDERS).map(k=>`<option ${data.order_a===k?'selected':''}>${esc(k)}</option>`).join('')}</select><small>${esc(oa.desc)} ${checkA.ok?'':'⚠ Недоступен: '+esc(checkA.reason)}</small></label><label>Приказ армии B<select data-ma-order="order_b">${Object.keys(ORDERS).map(k=>`<option ${data.order_b===k?'selected':''}>${esc(k)}</option>`).join('')}</select><small>${esc(ob.desc)} ${checkB.ok?'':'⚠ Недоступен: '+esc(checkB.reason)}</small></label></div><div class="ma-command-footer"><span class="small-note">Ход кампании: ${data.turn} · Боёв в истории: ${data.history.length}</span><button class="btn danger" type="button" data-ma-action="fight" ${checkA.ok&&checkB.ok?'':'disabled'}>⚔ Рассчитать бой</button></div><div class="small-note">Примечание к приказу «Отступление»: в исходном коде применяются множители силы ×0,50 и духа ×0,80. Отдельный множитель потерь в формуле не реализован, поэтому приложение воспроизводит фактический расчёт, а не текстовое обещание −50% потерь.</div></section>
      <section class="card ma-report-card"><div class="section-head"><div><div class="section-kicker">ПОСЛЕДНИЙ РАСЧЁТ</div><h2>Результаты сражения</h2></div><button class="btn small secondary" data-ma-action="summarize-battle" ${data.last_report?'':'disabled'}>Составить сводку</button></div><div id="maReport">${renderReport(data.last_report)}</div></section>
      ${renderAI()}`;
    bind();
  }
  function bind(){
    rootNode.querySelectorAll('[data-ma-field]').forEach(el=>el.addEventListener('change',()=>{const army=el.dataset.army==='A'?data.army_a:data.army_b;const k=el.dataset.maField;army[k]=k==='name'?el.value:(k==='cleric'?n(el.value):k==='feudal_loyalty'?clamp(el.value,0,100):Math.max(0,n(el.value)));save();render();}));
    rootNode.querySelectorAll('[data-ma-order]').forEach(el=>el.addEventListener('change',()=>{data[el.dataset.maOrder]=el.value;save();render();}));
    if(!handlersBound){rootNode.addEventListener('click',onRootClick);rootNode.addEventListener('submit',onRootSubmit);rootNode.addEventListener('change',onRootChange);handlersBound=true;}
  }
  function openOverlay(html){const old=$('.ma-modal-backdrop',rootNode);old?.remove();const wrap=document.createElement('div');wrap.className='ma-modal-backdrop';wrap.innerHTML=html;rootNode.append(wrap);return wrap;}
  function openUnitDialog(tag,unitId=null){
    const army=tag==='A'?data.army_a:data.army_b,old=unitId?army.units.find(x=>x.id===unitId):null,u=old?{...old}:normalizeUnit({name:'Новый отряд'}),floor=trainingFloor(u),unique=UNIQUE_UNITS[u.race]||[];
    const wrap=openOverlay(`<section class="ma-dialog" role="dialog" aria-modal="true"><header><div><div class="section-kicker">АРМИЯ ${tag}</div><h3>${old?'Изменить подразделение':'Новое подразделение'}</h3></div><button type="button" class="close-btn" data-ma-action="close-overlay">×</button></header><form id="maUnitForm" data-army="${tag}" data-unit-id="${old?old.id:''}"><div class="ma-form-grid"><label class="full">Название<input name="name" value="${esc(u.name)}" maxlength="60" required></label><label>Тип<select name="type">${UNIT_TYPES.map(x=>`<option ${u.type===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Категория<select name="category">${UNIT_CATEGORIES.map(x=>`<option ${u.category===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Раса<select name="race">${RACES.map(x=>`<option ${u.race===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Уникальный отряд<select name="unique_unit"><option value="">${unique.length?'Не выбран':'Нет уникальных отрядов для этой расы'}</option>${unique.map(x=>`<option ${u.unique_unit===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>Численность<input name="count" type="number" min="0" max="1000000" value="${u.count}" required></label><label>Обученность (%)<input name="training" type="number" min="${floor}" max="100" value="${u.training}" required><small data-ma-training-hint>${floor?`Расовый минимум: ${floor}%`: 'От 0 до 100%'}</small></label><label>Боевой дух (%)<input name="morale" type="number" min="0" max="100" value="${u.morale}" required></label><label>Броня<select name="armor">${Object.keys(ARMOR).map(x=>`<option ${u.armor===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Оружие<select name="weapon">${Object.keys(WEAPONS).map(x=>`<option ${u.weapon===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Источники железа<input name="iron_sources" type="number" min="0" max="10" value="${u.iron_sources}"></label><label class="ma-check"><input name="arsenal" type="checkbox" ${u.arsenal?'checked':''}> Арсенал (−10% содержания)</label><label class="ma-check"><input name="citadel" type="checkbox" ${u.citadel?'checked':''}> Цитадель (−15% содержания)</label></div><div class="notice" data-ma-race-note>${esc(unitNote(u))}</div><footer><button type="button" class="btn secondary" data-ma-action="close-overlay">Отмена</button><button class="btn" type="submit">Сохранить отряд</button></footer></form></section>`);
    wrap.querySelector('form').dataset.army=tag;
  }
  function openSiegeDialog(tag){const army=tag==='A'?data.army_a:data.army_b,current=Object.fromEntries(army.siege_engines.map(x=>[x.type,x.count]));openOverlay(`<section class="ma-dialog" role="dialog" aria-modal="true"><header><div><div class="section-kicker">АРМИЯ ${tag}</div><h3>Осадные орудия</h3></div><button type="button" class="close-btn" data-ma-action="close-overlay">×</button></header><form id="maSiegeForm" data-army="${tag}"><div class="ma-siege-list">${Object.entries(SIEGE).map(([name,info])=>`<label><span><strong>${name}</strong><small>${info.damage} урон · ${info.dmg} ед. · ${info.costMon} монет за единицу</small></span><input type="number" min="0" max="999" name="${esc(name)}" value="${current[name]||0}"></label>`).join('')}</div><footer><button type="button" class="btn secondary" data-ma-action="close-overlay">Отмена</button><button type="submit" class="btn">Сохранить</button></footer></form></section>`);}
  function showRecruitment(tag){const a=tag==='A'?data.army_a:data.army_b,p=recruitmentPool(a);notify(`Армия ${tag}: специалисты ${p.specialists}, сброд ${p.rabble}${p.penalty_applied?' · лояльность ниже 20%, призыв урезан вдвое':''}`);}
  function onRootClick(e){const b=e.target.closest('[data-ma-action]');if(!b)return;const act=b.dataset.maAction,tag=b.dataset.army,id=b.dataset.id;
    if(act==='add-unit')openUnitDialog(tag);if(act==='edit-unit')openUnitDialog(tag,id);if(act==='delete-unit'){const a=tag==='A'?data.army_a:data.army_b;if(confirm('Удалить подразделение?')){a.units=a.units.filter(u=>u.id!==id);save();render();}}
    if(act==='siege')openSiegeDialog(tag);if(act==='close-overlay')$('.ma-modal-backdrop',rootNode)?.remove();if(act==='recruitment')showRecruitment(tag);
    if(act==='fight'){try{const r=resolveBattle();render();const report=$('#maReport',rootNode);if(report)report.scrollIntoView({behavior:'smooth',block:'start'});}catch(err){alert(err.message);}}
    if(act==='export-campaign')exportCampaign();if(act==='import-campaign')$('#maImportFile',rootNode)?.click();if(act==='export-army')exportArmy(tag);
    if(act==='save-ai-settings'){aiKey=$('#maApiKey',rootNode)?.value.trim()||'';aiModel=$('#maApiModel',rootNode)?.value.trim()||'gpt-6-luna';sessionSet('ma.ai.key',aiKey);sessionSet('ma.ai.model',aiModel);const status=$('#maAIStatus',rootNode);if(status)status.textContent=aiKey?'API-ключ задан для этого сеанса':'ИИ не подключён';notify(aiKey?'Настройки ИИ сохранены только в этом сеансе.':'Ключ очищен.');}
    if(act==='clear-chat'){chatHistory=[];render();}
    if(act==='analyze-order'){const text=$('#maChatForm textarea',rootNode)?.value.trim();sendAI(text||'Проанализируй текущие выбранные приказы армий A и B и предложи оптимальный доступный приказ каждой стороне.','order');}
    if(act==='summarize-battle'){if(!data.last_report){notify('Сначала рассчитайте бой.','error');return;}sendAI('Составь итоговую военную сводку по последнему рассчитанному бою. Отдельно укажи фактический исход, реальные потери, изменение численности/морали/обученности по отрядам, воздействие укреплений и лояльности, сильные и слабые решения сторон, а также осторожные рекомендации на следующий ход. Не выдумывай события, которых нет в данных.','battle');}
  }
  function onRootChange(e){if(e.target.matches('#maImportFile')){const f=e.target.files?.[0];if(f)importCampaignFile(f);e.target.value='';return;}
    if(e.target.matches('#maUnitForm select[name="race"], #maUnitForm select[name="category"], #maUnitForm input[name="count"]')){const form=e.target.closest('form'),race=form.elements.race.value,category=form.elements.category.value,floor=race==='Вампиры'&&category==='специалисты'?50:0;form.elements.training.min=floor;if(n(form.elements.training.value)<floor)form.elements.training.value=floor;const unique=UNIQUE_UNITS[race]||[],sel=form.elements.unique_unit,current=sel.value;sel.innerHTML=`<option value="">${unique.length?'Не выбран':'Нет уникальных отрядов для этой расы'}</option>`+unique.map(x=>`<option>${esc(x)}</option>`).join('');if(unique.includes(current))sel.value=current;const temp={race,category,count:n(form.elements.count.value)};const note=$('[data-ma-race-note]',form);note.textContent=unitNote(temp);const hint=$('[data-ma-training-hint]',form);hint.textContent=floor?`Расовый минимум: ${floor}%`:'От 0 до 100%';}
  }
  function onRootSubmit(e){if(e.target.id==='maUnitForm'){e.preventDefault();const f=e.target,fd=new FormData(f),tag=f.dataset.army,a=tag==='A'?data.army_a:data.army_b,id=f.dataset.unitId||'',u=normalizeUnit({id:id||uid(),name:fd.get('name'),type:fd.get('type'),category:fd.get('category'),race:fd.get('race'),unique_unit:fd.get('unique_unit'),count:fd.get('count'),training:fd.get('training'),morale:fd.get('morale'),armor:fd.get('armor'),weapon:fd.get('weapon'),iron_sources:fd.get('iron_sources'),arsenal:fd.get('arsenal')==='on',citadel:fd.get('citadel')==='on'});const ix=a.units.findIndex(x=>x.id===id);if(ix>=0)a.units[ix]=u;else a.units.push(u);save();render();}
    if(e.target.id==='maSiegeForm'){e.preventDefault();const f=e.target,tag=f.dataset.army,a=tag==='A'?data.army_a:data.army_b,fd=new FormData(f);a.siege_engines=Object.keys(SIEGE).map(type=>({type,count:Math.max(0,Math.floor(n(fd.get(type))))})).filter(x=>x.count>0);save();render();}
    if(e.target.id==='maChatForm'){e.preventDefault();const text=new FormData(e.target).get('message').trim();if(text)sendAI(text,'chat');}
  }
  function campaignContext(){const armyData=a=>({name:a.name,total_count:totalCount(a),composition_percent:Object.fromEntries(Object.entries(composition(a)).map(([k,v])=>[k,Math.round(v*10)/10])),fortification:a.fortification,priests:a.priests,cleric:a.cleric,feudal_count:a.feudal_count,feudal_loyalty:a.feudal_loyalty,units:a.units.map(u=>({name:u.name,type:u.type,category:u.category,race:u.race,unique_unit:u.unique_unit,count:u.count,training:effectiveTraining(u),morale_base:u.morale,morale_effective:effectiveMorale(u),racial_rule:unitNote(u),armor:u.armor,weapon:u.weapon})),siege_engines:a.siege_engines.map(e=>({type:e.type,count:e.count}))});return {turn:data.turn,armies:{A:armyData(data.army_a),B:armyData(data.army_b)},current_selected_orders:{A:data.order_a,B:data.order_b},available_builtin_orders:Object.fromEntries(Object.entries(ORDERS).map(([k,v])=>[k,v.desc])),available_races:RACES,unique_units_by_race:UNIQUE_UNITS,unique_unit_rule:'Уникальный отряд — только расовое обозначение в этой версии; специальных боевых способностей и бонусов нет.',race_noncombat_reference_effects:{Орки:['Содержание армии −50% (справочно, не применяется)','Численность сброда +100% (справочно, не применяется)','Коэффициент прироста населения +75% (справочно, не применяется)','Численность специалистов −50% (справочно, не применяется)','Единство −15% (справочно, не применяется)']},engine_limits:'Движок не моделирует позиции на карте, фланговые маршруты, выбор целей, движение резервов, перемещение отдельных подразделений или специальные механики уникальных расовых отрядов.',last_battle_report:data.last_report};}
  async function sendAI(userText,mode='chat'){
    if(aiBusy)return;if(!aiKey) {notify('Для ИИ откройте «Настройки ИИ» и укажите API-ключ.','error');const det=$('.ma-ai-settings',rootNode);if(det)det.open=true;return;}
    const task=mode==='order'?'РЕЖИМ: АНАЛИЗ ТЕКСТОВОГО ПРИКАЗА. Разбери намерения пользователя; сравни с составом и готовностью войск; назови преимущества, риски и недостающие условия. Сопоставь с доступными встроенными приказами для A и B. Не объявляй манёвры выполненными.':mode==='battle'?'РЕЖИМ: ИТОГОВАЯ СВОДКА ПО ФАКТИЧЕСКИ РАССЧИТАННОМУ БОЮ. Числа и изменения бери только из отчёта и состояния. Отдели факты от предположений.':'РЕЖИМ: ДИАЛОГ С ВОЕННЫМ СОВЕТНИКОМ. Отвечай в контексте этой кампании. Если пользователь пишет приказ, анализируй его, но не меняй состояние и не запускай бой.';
    const context=JSON.stringify(campaignContext(),null,2),history=chatHistory.slice(-8).map(m=>`${m.role}: ${m.text}`).join('\n');
    const prompt=`${task}\n\nСОСТОЯНИЕ ИГРЫ (JSON):\n${context}\n\nПОСЛЕДНИЕ СООБЩЕНИЯ:\n${history}\n\nТЕКУЩЕЕ СООБЩЕНИЕ:\n${userText}`;
    chatHistory.push({role:'user',text:userText});aiBusy=true;renderChatOnly();
    try{
      const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${aiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:aiModel||'gpt-6-luna',instructions:SYSTEM_INSTRUCTIONS,input:prompt,max_output_tokens:1300})});
      const payload=await response.json();if(!response.ok)throw new Error(payload?.error?.message||`API вернул HTTP ${response.status}`);
      let answer=payload.output_text||'';if(!answer&&Array.isArray(payload.output)){answer=payload.output.filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text'||x.type==='text').map(x=>x.text).join('\n');}
      if(!answer)throw new Error('ИИ вернул пустой ответ. Проверьте модель и доступ API.');chatHistory.push({role:'assistant',text:answer});
    }catch(err){chatHistory.push({role:'error',text:`Не удалось получить ответ: ${err.message}. Браузер может блокировать прямой API-запрос; для публичной версии нужен серверный прокси.`});}
    finally{aiBusy=false;renderChatOnly();}
  }
  function renderChatOnly(){const log=$('#maChatLog',rootNode);if(log)log.innerHTML=chatHistory.length?chatHistory.map(m=>`<div class="ma-chat-message ${m.role}"><strong>${m.role==='user'?'Вы':m.role==='error'?'Ошибка ИИ':'Военный советник'}</strong><p>${esc(m.text).replace(/\n/g,'<br>')}</p></div>`).join(''):'<div class="empty-inline">Военный советник готов.</div>';if(log)log.scrollTop=log.scrollHeight;const status=$('#maAIStatus',rootNode);if(status)status.textContent=aiBusy?'Советник думает…':aiKey?'API-ключ задан для этого сеанса':'ИИ не подключён';const btn=$('#maChatForm button[type="submit"]',rootNode);if(btn){btn.disabled=aiBusy;btn.textContent=aiBusy?'Советник думает…':'Отправить советнику';}}
  function exportCampaign(){const blob=new Blob([JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Военный_советник_кампания_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);}
  function exportArmy(tag){const army=tag==='B'?data.army_b:data.army_a;const blob=new Blob([JSON.stringify(army,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Армия_${tag}_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);notify(`Армия ${tag} экспортирована.`);}
  function importCampaignFile(file){const reader=new FileReader();reader.onload=()=>{try{const x=JSON.parse(reader.result);if(!x.army_a||!x.army_b)throw new Error('В файле отсутствуют армии A и B.');if(!confirm('Загрузить кампанию? Текущие армии и история будут заменены.'))return;data={...defaultData(),...x,army_a:normalizeArmy(x.army_a,'Армия A'),army_b:normalizeArmy(x.army_b,'Армия B'),history:Array.isArray(x.history)?x.history:[]};data.last_report=x.last_report||data.history[data.history.length-1]||null;save();render();notify('Кампания военного советника загружена.');}catch(err){notify('Ошибка импорта: '+err.message,'error');}};reader.readAsText(file);}
  function importData(incoming){if(!incoming||!incoming.army_a||!incoming.army_b)return;data={...defaultData(),...incoming,army_a:normalizeArmy(incoming.army_a,'Армия A'),army_b:normalizeArmy(incoming.army_b,'Армия B'),history:Array.isArray(incoming.history)?incoming.history:[]};data.last_report=incoming.last_report||data.history[data.history.length-1]||null;save();render();}
  function exportData(){return JSON.parse(JSON.stringify(data));}
  function init(){rootNode=$('#view-advisor');aiKey=sessionGet('ma.ai.key');render();}
  window.MilitaryAdvisor={init,render,exportData,importData};
})();
