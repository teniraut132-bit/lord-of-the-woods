/* Хозяин леса — общий мир на Supabase; резервные копии создаются вручную через экспорт. */
(() => {
  'use strict';
  const DB_KEY = 'lordOfTheWoods.manager.v1'; // legacy local database: migration source only
  const BACKUP_CACHE_KEY = 'lordOfTheWoods.backupCache.v1';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const fmt = v => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:2}).format(number(v));

  const blessings = [
    {id:'fertile',name:'Плодородная земля',group:'Гражданские',cost:5,min:20,kind:'Региональное',duration:'1 игровой год',desc:'+5% к производству еды в выбранном регионе.',effect:'+5% еды',needsRegion:true,conflict:'food'},
    {id:'growth',name:'Благословение роста',group:'Гражданские',cost:10,min:20,kind:'Региональное',duration:'1 игровой год',desc:'+0,25 процентного пункта к годовому приросту населения. Не действует во время голода.',effect:'+0,25 п.п. прироста',needsRegion:true,conflict:'growth'},
    {id:'quiet',name:'Тихая чаща',group:'Гражданские',cost:5,min:20,kind:'Региональное',duration:'1 игровой год',desc:'Устраняет кризис нападения диких зверей и защищает регион от повторения этого кризиса.',effect:'Устранение кризиса зверей',needsRegion:true},
    {id:'medicine',name:'Лекарство леса',group:'Гражданские',cost:10,min:40,kind:'Региональное',duration:'1 игровой год',desc:'Уменьшает последствия поветрия на 50%. Не заменяет лечение магией крови.',effect:'−50% последствий поветрия',needsRegion:true},
    {id:'rest',name:'Отдых земли',group:'Гражданские',cost:10,min:40,kind:'Региональное',duration:'1 игровой год',desc:'Уменьшает последствия опустошения земель на 50%, но не снимает кризис полностью.',effect:'−50% последствий опустошения',needsRegion:true},
    {id:'greenReturn',name:'Возвращение зелени',group:'Гражданские',cost:15,min:60,kind:'Великое',duration:'Постепенно',desc:'Постепенное восстановление повреждённой природной территории. Требует существующей почвы и условий для роста.',effect:'Восстановление природной территории',needsRegion:true,requiresGrove:true,great:true},
    {id:'eyes',name:'Глаза леса',group:'Военные',cost:5,min:40,kind:'Разведка',duration:'Одно разведывательное действие',desc:'Разведка перемещений, лагерей, обозов и небольших скрывающихся отрядов через животных и грибницу.',effect:'Разведывательные сведения',needsForest:true,needsRegion:true},
    {id:'trail',name:'Тропа зверя',group:'Военные',cost:5,min:40,kind:'Передвижение',duration:'Одно перемещение',desc:'Скрытное перемещение одного отряда по непрерывной лесной территории. Не телепортация.',effect:'Скрытное перемещение отряда',needsForest:true,needsRegion:true},
    {id:'roots',name:'Корни-стражи',group:'Военные',cost:10,min:60,kind:'Оборона',duration:'Одно сражение',desc:'+10% к оборонительной эффективности в одном сражении на лесной территории.',effect:'+10% обороны',needsForest:true,battle:'defense',conflict:'battle'},
    {id:'pack',name:'Зов стаи',group:'Военные',cost:10,min:60,kind:'Поддержка',duration:'Одно сражение',desc:'Однократное вмешательство местных животных; может снизить боевой дух выбранного вражеского подразделения на 5 процентных пунктов.',effect:'−5 п.п. боевого духа врага',needsForest:true,battle:'pack'},
    {id:'greenMantle',name:'Покров зелёного леса',group:'Военные',cost:20,min:60,kind:'Великое боевое',duration:'Одно сражение',desc:'+5 процентных пунктов к начальному боевому духу выбранной армии в лесной местности.',effect:'+5 п.п. боевого духа',needsForest:true,battle:'morale',conflict:'battle',great:true},
    {id:'hearing',name:'Слух земли',group:'Дары друидам',cost:5,min:40,kind:'Личное благословение',duration:'Постоянное (персональное)',desc:'Чувство присутствия живых существ, состояния растительности и нарушений природной среды поблизости.',effect:'Природное чутьё',druid:true},
    {id:'beast',name:'Милость зверя',group:'Дары друидам',cost:5,min:40,kind:'Личное благословение',duration:'Пока сохраняется связь',desc:'Одно животное становится спутником друида, лучше понимает сигналы и помогает в разведке. Сохраняет собственную волю.',effect:'Животное-спутник',druid:true},
    {id:'breath',name:'Дыхание леса',group:'Дары друидам',cost:10,min:40,kind:'Личное благословение',duration:'Постоянное (персональное)',desc:'Усиленное восстановление повреждённой растительности и поддержка её развития.',effect:'Ускоренное восстановление растений',druid:true},
    {id:'guardian',name:'Облик хранителя',group:'Дары друидам',cost:10,min:60,kind:'Личное благословение',duration:'Постоянное (персональное)',desc:'Совершенствование звериного облика: сохранение человеческого сознания и адаптация к новому телу.',effect:'Улучшенный звериный облик',druid:true},
    {id:'thicket',name:'Зов древней чащи',group:'Дары друидам',cost:15,min:60,kind:'Сильное личное благословение',duration:'Одно применение',desc:'Сложное природное воздействие через растительность, грибницы и местных животных.',effect:'Комплексное воздействие на природу',druid:true,needsForest:true,needsRegion:true},
    {id:'crown',name:'Корона чащи',group:'Дары друидам',cost:20,min:80,kind:'Высшее личное благословение',duration:'Одно применение',desc:'Воздействие на значительную лесную территорию и координация растений, грибниц и зверей.',effect:'Масштабное управление природной средой',druid:true,needsForest:true,needsRegion:true,requiresGrove:true,great:true,master:true}
  ];

  const contractsCatalog = [
    {id:'keeper',name:'Договор хранителя',size:'Малый',cost:5,min:20,duration:'3 игровых хода',turns:3,requiresRegion:true,desc:'Государство сохраняет выбранную территорию и не допускает бессмысленного уничтожения жизни.',terms:['Защищать выбранный регион от разорения.','Не уничтожать животных и растения без необходимости.'],reward:'Малое покровительство региона и +3 благосклонности.',gain:3},
    {id:'tracker',name:'Договор следопыта',size:'Малый',cost:7,min:25,duration:'Одна военная кампания',turns:null,desc:'Государство использует знания о местности для разведки и защиты, а не для бессмысленного разорения.',terms:['Не использовать лесные убежища для уничтожения экосистемы.','Не истреблять фауну ради развлечения.'],reward:'Одно применение разведывательного дара и +4 благосклонности.',gain:4},
    {id:'seed',name:'Договор семени',size:'Малый',cost:7,min:30,duration:'3 игровых хода',turns:3,requiresRegion:true,desc:'Государство восстанавливает выбранную повреждённую территорию.',terms:['Восстановить указанную территорию.','Сохранить восстановленную среду после завершения договора.'],reward:'Поддержка восстановления земель и +4 благосклонности.',gain:4},
    {id:'harvest',name:'Договор урожая',size:'Малый',cost:8,min:30,duration:'3 игровых хода',turns:3,requiresRegion:true,desc:'Земледельцы сохраняют часть урожая для посева и не истощают почву ради одного сезона.',terms:['Оставить семенной запас.','Не сжигать и не засаливать поля намеренно.'],reward:'Благословение плодородия на выбранный регион и +4 благосклонности.',gain:4},
    {id:'accord',name:'Договор согласия',size:'Малый',cost:6,min:30,duration:'3 игровых хода',turns:3,desc:'Правитель обязуется не разжигать межсословную вражду и защищать мирные общины.',terms:['Не применять коллективные наказания к мирным жителям.','Разбирать споры сословий без бессмысленных казней и расправ.'],reward:'+5 единства по решению вармастера и +4 благосклонности.',gain:4},
    {id:'path',name:'Договор живого пути',size:'Малый',cost:8,min:40,duration:'Одна торговая или военная кампания',turns:null,desc:'Дороги, перевалы и переправы сохраняются проходимыми для мирных жителей и живых существ.',terms:['Не перекрывать пути без военной необходимости.','Не уничтожать природные переходы и водоёмы без причины.'],reward:'Одно благословение безопасного пути и +5 благосклонности.',gain:5},
    {id:'lastRoot',name:'Договор последнего корня',size:'Большой',cost:12,min:60,duration:'До исполнения обязательств',turns:null,requiresRegion:true,desc:'Соглашение для чрезвычайной ситуации: государство берёт на себя масштабное обязательство по сохранению жизни. Священная роща не требуется.',terms:['Принять масштабное обязательство по сохранению жизни.','Выполнить особое условие, согласованное с Владыкой и вармастером.'],reward:'Одно масштабное вмешательство Владыки по согласованному сценарию и +7 благосклонности.',gain:7},
    {id:'source',name:'Договор хранителя источника',size:'Большой',cost:15,min:65,duration:'До завершения добычи',turns:null,requiresRegion:true,desc:'Государство получает право разрабатывать необычное месторождение на условиях бережного отношения к окружающей местности.',terms:['Добывать ресурс в обозначенных пределах.','Не отравлять воду и не разрушать соседние поселения.','Согласовать масштаб работ с вармастером.'],reward:'Разрешение на необычную разработку месторождения после решения Владыки и +8 благосклонности.',gain:8},
    {id:'restoration',name:'Договор зелёного возрождения',size:'Большой',cost:18,min:75,duration:'5 игровых ходов',turns:5,requiresRegion:true,desc:'Комплексное восстановление опустошённой земли, леса или водоёма. Строительство священной рощи не требуется.',terms:['Восстановить выбранную территорию.','Выделить людей и ресурсы на уход за ней.','Не допустить повторного разрушения в течение срока договора.'],reward:'Великое природное покровительство и +10 благосклонности.',gain:10},
    {id:'landshield',name:'Договор щита живых земель',size:'Большой',cost:16,min:70,duration:'Одна война или 5 игровых ходов',turns:5,requiresRegion:true,desc:'Государство обязуется защищать выбранную область и её население от разорения в ходе войны.',terms:['Не использовать мирных жителей как расходный ресурс.','Не сжигать поселения без необходимости.','После войны восстановить нарушенные угодья.'],reward:'Одно сильное защитное благословение и +8 благосклонности.',gain:8},
    {id:'refuge',name:'Договор тихого убежища',size:'Малый',cost:7,min:25,duration:'3 игровых хода',turns:3,requiresRegion:true,desc:'Государство выделяет безопасное место для беженцев, раненых и мирных жителей, не требуя от них исповедовать веру Владыки.',terms:['Не выдавать укрывающихся мирных жителей ради выгоды.','Обеспечить им воду и временное убежище.'],reward:'+4 благосклонности и малый защитный дар.',gain:4},
    {id:'river',name:'Договор чистой воды',size:'Малый',cost:8,min:35,duration:'4 игровых хода',turns:4,requiresRegion:true,desc:'Государство берёт на себя очистку и защиту реки, озера или источника от отравления и намеренного загрязнения.',terms:['Не сбрасывать отходы в водоём.','Назначить ответственных за очистку берегов и водозаборов.'],reward:'+5 благосклонности и временная поддержка урожая.',gain:5},
    {id:'seedvault',name:'Договор семенного запаса',size:'Малый',cost:9,min:40,duration:'До следующего урожая',turns:null,requiresRegion:true,desc:'Государство создаёт резерв семян и продовольствия, чтобы пережить неурожай без массового голода.',terms:['Отложить семенной фонд.','Не расходовать его на обычные нужды без чрезвычайной причины.'],reward:'+5 благосклонности и право просить о плодородии.',gain:5},
    {id:'oath',name:'Клятва хранителя рубежа',size:'Большой',cost:20,min:75,duration:'Одна война или 6 игровых ходов',turns:6,requiresRegion:true,desc:'Правитель берёт на себя ответственность за целый рубеж: защиту поселений, лесов, вод и путей миграции зверей.',terms:['Не превращать всю приграничную землю в выжженную полосу.','Защищать мирные поселения и источники воды.','После войны восстановить разрушенные участки.'],reward:'+12 благосклонности и одно великое защитное вмешательство.',gain:12},
    {id:'deepSource',name:'Договор глубинного дара',size:'Большой',cost:22,min:80,duration:'До завершения согласованной разработки',turns:null,requiresRegion:true,desc:'Редкое разрешение на поиск и разработку необычного месторождения с заранее ограниченным масштабом работ.',terms:['Указать точные границы добычи.','Не вести разработку под жилыми кварталами и священными природными зонами.','Остановить работы при обнаружении опасности.'],reward:'Рассмотрение особого месторождения и +12 благосклонности.',gain:12}
  ];

  const defaultDB = () => ({version:2,activeStateId:null,states:[],journal:[],playerName:'',createdAt:new Date().toISOString()});
  let db = defaultDB();
  let currentView = 'dashboard';
  let worshipFilter = 'Все';
  let pendingAction = null;
  let preselectDruidId = null;

  function normalizeStateRecord(state={}){
    // Older campaign backups could omit favor entirely; initialize them rather than leaving NaN/undefined.
    if(state.favor===null||state.favor===undefined||state.favor==='')state.favor=10;
    else state.favor=Math.max(0,Math.min(100,number(state.favor)));
    state.clerics=Math.max(0,number(state.clerics));state.priests=Math.max(0,number(state.priests));
    state.regions ||= [];state.contracts ||= [];state.druids ||= [];state.effects ||= [];
    state.temples ||= {chapel:false,root:false,abode:false};state.unity=Math.max(0,Math.min(100,number(state.unity??50)));state.annualIncome=Math.max(0,number(state.annualIncome));state.civicEffects ||= [];state.resourceRequests ||= [];state.turn=Math.max(0,number(state.turn));delete state.rosterId;const raceAliases={'Нэкомата':'Некомата','Валессийцы':'Валесийцы','Таунгуры':'Тангуры','Та-Рун':'Рун','Барзум-уруки':'Тёмные орки','Сатиры':'Ксатры','Грандины':'Грандийцы','Багбиры':'Бругачи'};state.race=raceAliases[state.race]||state.race||'';state.population??=null;state.feudals??=null;
    return state;
  }
  let sharedAppRevision = 0;
  let sharedAppReady = false;
  let sharedAppSaving = false;
  let sharedAppPending = false;
  let sharedAppConflict = false;
  let sharedAppSaveTimer = null;
  let sharedAppSyncedPayload = null;

  function readLegacyLocalDB(){
    try{
      const raw=localStorage.getItem(DB_KEY);
      if(!raw)return null;
      const parsed=JSON.parse(raw);
      if(!parsed||!Array.isArray(parsed.states))return null;
      parsed.states=parsed.states.map(normalizeStateRecord);
      parsed.journal ||= [];
      parsed.playerName ||= '';
      delete parsed.armyRegistry;
      return parsed;
    }catch(error){console.warn('[LOTW] Legacy local backup could not be read:',error);return null;}
  }
  function appSharedPayload(){
    const payload=JSON.parse(JSON.stringify(db));
    delete payload.playerName;
    delete payload.activeStateId;
    return payload;
  }
  async function flushSharedApp(){
    if(!sharedAppReady||sharedAppSaving||!sharedAppPending||sharedAppConflict)return;
    sharedAppSaving=true;
    sharedAppPending=false;
    const payload=appSharedPayload();
    try{
      const result=await window.LOTWBackend.saveSharedPart('app',payload,sharedAppRevision);
      if(result.conflict){
        sharedAppConflict=true;
        window.LOTWBackend && window.LOTWBackend.status && console.warn('[LOTW] Shared app revision conflict:',result.revision);
        $('#saveStatus').textContent='Конфликт изменений. Обновите страницу, чтобы загрузить последнюю версию общего мира.';
        toast('Другой участник изменил общий мир одновременно. Чтобы не потерять данные, сохранение остановлено. Обновите страницу и повторите действие.','error');
      }else{
        sharedAppRevision=result.revision;
        sharedAppSyncedPayload=payload;
        updateLocalBackupCache();
        if(!sharedAppPending)$('#saveStatus').textContent='Все изменения сохранены в общей базе';
      }
    }catch(error){
      $('#saveStatus').textContent='Ошибка сохранения общей базы: '+(error.message||String(error));
      toast('Не удалось сохранить общий мир: '+(error.message||String(error)),'error');
      console.error('[LOTW] Shared app save failed:',error);
    }finally{
      sharedAppSaving=false;
      if(sharedAppPending&&!sharedAppConflict){
        clearTimeout(sharedAppSaveTimer);
        sharedAppSaveTimer=setTimeout(flushSharedApp,250);
      }
    }
  }
  function saveDB(){
    if(!sharedAppReady||sharedAppConflict)return;
    sharedAppPending=true;
    $('#saveStatus').textContent='Ожидание сохранения изменений в общей базе…';
    clearTimeout(sharedAppSaveTimer);
    sharedAppSaveTimer=setTimeout(flushSharedApp,450);
  }
  function updateLocalBackupCache(){
    try{
      const snapshot={...JSON.parse(JSON.stringify(db)),militaryAdvisor:window.MilitaryAdvisor?.exportData?.()||null,backupUpdatedAt:new Date().toISOString()};
      localStorage.setItem(BACKUP_CACHE_KEY,JSON.stringify(snapshot));
    }catch(error){console.warn('[LOTW] Could not update local backup cache:',error);}
  }
  window.LOTWUpdateBackupCache=updateLocalBackupCache;

  async function savePlayerProfile(){
    if(!sharedAppReady||!window.LOTWBackend?.saveProfile)return;
    try{
      await window.LOTWBackend.saveProfile({player_name:db.playerName,active_state_id:db.activeStateId});
    }catch(error){
      toast('Не удалось сохранить профиль игрока: '+(error.message||String(error)),'error');
    }
  }
  async function refreshSharedApp(){
    if(!sharedAppReady||sharedAppPending||sharedAppSaving||sharedAppConflict)return;
    try{
      const remote=await window.LOTWBackend.loadSharedPart('app');
      if(remote.revision<=sharedAppRevision)return;
      const profileName=db.playerName,profileState=db.activeStateId;
      const payload=remote.payload||{};
      db={...defaultDB(),...payload,states:Array.isArray(payload.states)?payload.states.map(normalizeStateRecord):[],journal:Array.isArray(payload.journal)?payload.journal:[],playerName:profileName,activeStateId:profileState};
      if(!db.states.some(st=>st.id===db.activeStateId))db.activeStateId=db.states[0]?.id||null;
      sharedAppRevision=remote.revision;
      sharedAppSyncedPayload=appSharedPayload();
      updateLocalBackupCache();
      renderAll();
      $('#saveStatus').textContent='Общий мир обновлён · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
    }catch(error){console.warn('[LOTW] Shared world refresh failed:',error);}
  }
  async function bootstrapSharedWorld(){
    try{
      const backend=window.LOTWBackend;
      if(!backend?.isConfigured?.())throw new Error('Не заданы настройки Supabase.');
      const auth=await backend.initialize();
      if(auth.error||backend.status()==='error')throw new Error(auth.error||'Не удалось войти в общую базу.');
      const [appRemote,profile,militaryRemote]=await Promise.all([
        backend.loadSharedPart('app'),
        backend.getProfile(),
        backend.loadSharedPart('military')
      ]);
      const payload=appRemote.payload||{};
      db={...defaultDB(),...payload,states:Array.isArray(payload.states)?payload.states.map(normalizeStateRecord):[],journal:Array.isArray(payload.journal)?payload.journal:[],playerName:profile.player_name||'',activeStateId:profile.active_state_id||payload.activeStateId||null};
      if(!db.states.some(st=>st.id===db.activeStateId))db.activeStateId=db.states[0]?.id||null;
      sharedAppRevision=appRemote.revision;
      sharedAppSyncedPayload=appSharedPayload();
      sharedAppReady=true;
      window.LOTW_PLAYER_NAME=db.playerName;
      if(window.MilitaryAdvisor){
        window.MilitaryAdvisor.setSharedData(militaryRemote.payload,militaryRemote.revision);
      }
      updateLocalBackupCache();

      // One-time import bridge for browsers that used the old local-only build.
      // It merges previously separate state lists into the shared world; it never
      // replaces cloud states that already exist.
      const legacyMarker='lordOfTheWoods.legacyMigration.v1';
      const legacyAlreadyHandled=localStorage.getItem(legacyMarker)==='done';
      if(!legacyAlreadyHandled){
        const legacy=readLegacyLocalDB();
        if(legacy?.states?.length){
          const existingIds=new Set(db.states.map(st=>String(st.id)));
          const existingNames=new Set(db.states.map(st=>String(st.name||'').trim().toLocaleLowerCase('ru')));
          const additions=legacy.states.map(normalizeStateRecord).filter(st=>{
            const id=String(st.id||'');
            const name=String(st.name||'').trim().toLocaleLowerCase('ru');
            return id&&!existingIds.has(id)&&name&&!existingNames.has(name);
          });
          const knownStateIds=new Set([...db.states,...additions].map(st=>String(st.id)));
          const journalById=new Map((db.journal||[]).map(entry=>[String(entry.id),entry]));
          const journalAdditions=(legacy.journal||[]).filter(entry=>
            entry?.id&&!journalById.has(String(entry.id))&&(!entry.stateId||knownStateIds.has(String(entry.stateId)))
          );
          if((additions.length||journalAdditions.length)&&confirm(
            `Найдена отдельная старая локальная летопись: государств для добавления — ${additions.length}, записей журнала — ${journalAdditions.length}. Добавить их в общий мир? Существующие облачные государства не будут заменены.`
          )){
            db.states=[...db.states,...additions];
            db.journal=[...db.journal,...journalAdditions].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,500);
            if(!db.playerName&&legacy.playerName)db.playerName=String(legacy.playerName).slice(0,48);
            if(!db.activeStateId&&legacy.activeStateId&&knownStateIds.has(String(legacy.activeStateId)))db.activeStateId=legacy.activeStateId;
            sharedAppPending=true;
            await flushSharedApp();
            await savePlayerProfile();
            updateLocalBackupCache();
          }
        }

        try{
          const rawMilitary=localStorage.getItem('lordOfTheWoods.militaryAdvisor.v1');
          const legacyMilitary=rawMilitary?JSON.parse(rawMilitary):null;
          const cloudMilitary=militaryRemote.payload||{};
          const cloudMilitaryEmpty=!(cloudMilitary.army_a?.units?.length||cloudMilitary.army_b?.units?.length||cloudMilitary.history?.length||cloudMilitary.last_report);
          const localMilitaryHasData=!!(legacyMilitary?.army_a||legacyMilitary?.army_b)&&!!(
            legacyMilitary.army_a?.units?.length||legacyMilitary.army_b?.units?.length||legacyMilitary.history?.length||legacyMilitary.last_report
          );
          if(cloudMilitaryEmpty&&localMilitaryHasData&&confirm('В этом браузере найдена старая локальная военная кампания, а общая кампания пока пуста. Перенести армии и историю боёв в общий мир?')){
            window.MilitaryAdvisor?.setSharedData(legacyMilitary,militaryRemote.revision);
            await window.MilitaryAdvisor?.saveSharedNow();
            updateLocalBackupCache();
          }
        }catch(error){console.warn('[LOTW] Legacy military campaign migration failed:',error);}
        try{localStorage.setItem(legacyMarker,'done');}catch(error){console.warn('[LOTW] Could not set legacy migration marker:',error);}
      }
      if(window.MilitaryAdvisor)window.MilitaryAdvisor.init();
      renderAll();
      window.setInterval(refreshSharedApp,12000);
      if(window.MilitaryAdvisor?.refreshShared)window.setInterval(window.MilitaryAdvisor.refreshShared,12000);
      $('#saveStatus').textContent='Подключено к общему миру · изменения сохраняются в Supabase';
    }catch(error){
      console.error('[LOTW] Shared world bootstrap failed:',error);
      $('#saveStatus').textContent='Общая база недоступна: '+(error.message||String(error));
      renderAll();
      const notice=document.createElement('div');
      notice.className='notice red';
      notice.style.margin='12px 0';
      notice.innerHTML='<b>Общий мир не загружен.</b><br>'+esc(error.message||String(error))+'<br>Проверьте, что в Supabase включён Anonymous Sign-Ins. Данные не будут записываться локально.';
      $('#view-dashboard')?.prepend(notice);
    }
  }

  function activeState(){return db.states.find(s=>s.id===db.activeStateId)||db.states[0]||null;}
  function setActiveState(id){db.activeStateId=id;savePlayerProfile();renderAll();}
  function addJournal(stateId,type,title,detail='',clericDelta=0,favorDelta=0){
    const state=db.states.find(x=>x.id===stateId)||null;const entry={id:uid(),stateId,type,title,detail,clericDelta:number(clericDelta),favorDelta:number(favorDelta),date:new Date().toISOString()};
    db.journal.unshift(entry);if(db.journal.length>500)db.journal.length=500;
    if(window.LOTWBackend?.trackEvent)window.LOTWBackend.trackEvent({stateId,stateName:state?.name||'Без государства',eventType:type,title,details:detail,clericDelta:number(clericDelta),favorDelta:number(favorDelta),playerName:db.playerName||'Не указано'});
  }
  function changeFavor(state,requestedDelta,type,title,detail=''){
    if(!state||!state.id)throw new Error('Не выбрано государство для изменения благосклонности.');
    normalizeStateRecord(state);
    const before=Math.max(0,Math.min(100,number(state.favor)));
    const requested=number(requestedDelta);
    const after=Math.max(0,Math.min(100,before+requested));
    const actual=after-before;state.favor=after;
    addJournal(state.id,type,title,detail||`Благосклонность: ${actual>0?'+':''}${fmt(actual)}.`,0,actual);
    return actual;
  }
  function toast(message,type='ok'){
    const el=document.createElement('div');el.className='toast'+(type==='error'?' error':'');el.textContent=message;$('#toastRegion').append(el);setTimeout(()=>el.remove(),3600);
  }
  function favorStatus(v){return v<20?'Чужак':v<40?'Замеченный':v<60?'Признанный':v<80?'Доверенный':'Избранный';}
  function stateTemples(s){return !!(s.temples?.chapel||s.temples?.root||s.temples?.abode);}
  function hasGrove(s){return (s.regions||[]).some(r=>r.grove);}
  function groveRegion(s){return (s.regions||[]).find(r=>r.grove)||null;}
  function effectiveStateRace(s){return s?.race||'';}
  function annualClericIncome(s){const base=Math.floor(number(s.priests)/100)+number(s.extraIncome);return effectiveStateRace(s)==='Королевские рыцари Жардана'?Math.floor(base*.5):base;}
  function activeCivicEffects(s,kind=null){return (s?.civicEffects||[]).filter(e=>e.remainingTurns>0&&(!kind||e.kind===kind));}
  function civicPct(s,kind,regionId=null){return activeCivicEffects(s,kind).filter(e=>!regionId||e.regionId===regionId).reduce((sum,e)=>sum+number(e.value),0);}
  function adjustedAnnualIncome(s){return Math.round(number(s?.annualIncome)*(1+civicPct(s,'income')/100));}
  function advanceStateTurn(){const s=activeState();if(!s)return;s.turn=number(s.turn)+1;const expired=[];(s.civicEffects||[]).forEach(e=>{e.remainingTurns=Math.max(0,number(e.remainingTurns)-1);if(e.remainingTurns===0)expired.push(e.name);});s.civicEffects=(s.civicEffects||[]).filter(e=>e.remainingTurns>0);addJournal(s.id,'turn',`Завершён игровой ход ${s.turn}`,expired.length?`Истекли эффекты: ${expired.join(', ')}.`:'Временные гражданские эффекты продолжают действовать.');saveDB();renderAll();toast(`Ход ${s.turn} завершён.`);}
  function currency(v){return `${fmt(v)} Клирики`;}
  function getRegion(s,id){return (s.regions||[]).find(r=>r.id===id)||null;}
  function regionOptions(s,onlyForest=false){return (s.regions||[]).filter(r=>!onlyForest||r.terrain==='Лес').map(r=>`<option value="${esc(r.id)}">${esc(r.name)} · ${esc(r.terrain)}${r.grove?' · Священная роща':''}</option>`).join('');}
  function regionEffectStats(s,r){const active=(s.effects||[]).filter(e=>e.status==='active'&&e.regionId===r.id);const has=id=>active.some(e=>e.actionId===id);const crisis=r.crises||{};const fertile=has('fertile'),growth=has('growth'),rest=has('rest')&&!!crisis.devastation,medicine=has('medicine')&&!!crisis.plague;let food=number(r.foodProduction??0);if(crisis.devastation)food*=rest?0.925:0.85;if(fertile)food*=1.05;const temporaryFoodPct=civicPct(s,'food',r.id);if(temporaryFoodPct)food*=1+temporaryFoodPct/100;let popGrowth=number(r.populationGrowth??1)+(growth?0.25:0);if(crisis.famine)popGrowth=0;if(crisis.plague)popGrowth-=medicine?2.5:5;if(crisis.wildBeasts)popGrowth-=2;const loyalty=Math.min(100,number(r.peasantLoyalty??55)+(s.temples?.root&&s.rootTempleRegionId===r.id?2:0));const crises=[];if(crisis.famine)crises.push('голод');if(crisis.plague)crises.push(`поветрие ${medicine?'(−2,5%)':'(−5%)'}`);if(crisis.devastation)crises.push(`опустошение ${rest?'(−7,5% еды)':'(−15% еды)'}`);if(crisis.wildBeasts)crises.push('дикие звери');return {food,popGrowth,loyalty,fertile,growth,rest,medicine,crises};}
  function addState(data){
    const s={id:uid(),name:data.name,officialReligion:data.officialReligion||'Не указана',race:data.race||'',population:data.population??null,feudals:data.feudals??null,favor:10,unity:Math.max(0,Math.min(100,number(data.unity??50))),annualIncome:Math.max(0,number(data.annualIncome)),civicEffects:[],resourceRequests:[],turn:0,clerics:number(data.clerics),priests:number(data.priests),extraIncome:number(data.extraIncome),temples:{chapel:false,root:false,abode:false},rootTempleRegionId:null,regions:[],contracts:[],druids:[],effects:[],createdAt:new Date().toISOString()};
    db.states.push(s);db.activeStateId=s.id;addJournal(s.id,'system','Создано государство',`Создана запись летописи: ${data.name}. Начальная благосклонность: 10/100.`);saveDB();renderAll();toast('Государство добавлено в летопись.');
  }
  function getAction(id){return blessings.find(a=>a.id===id);}
  function hasActiveSame(s,a,regionId,opts={}){return (s.effects||[]).some(e=>e.status==='active'&&e.actionId===a.id&&(a.druid?e.druidId===opts.druidId:(!a.needsRegion||e.regionId===regionId)));}
  function hasGreatEffect(s){return (s.effects||[]).some(e=>e.status==='active'&&e.great);}
  function canUseBlessing(s,a,opts={}){
    if(!s)return 'Сначала создайте или выберите государство.';
    if(number(s.favor)<a.min)return `Нужна благосклонность не ниже ${a.min}. Сейчас: ${s.favor}.`;
    if(number(s.clerics)<a.cost)return `Недостаточно Клирики: требуется ${a.cost}, доступно ${s.clerics}.`;
    if(a.needsRegion&&!opts.regionId)return 'Выберите регион для применения.';
    const r=a.needsRegion?getRegion(s,opts.regionId):null;
    if(a.needsRegion&&!r)return 'Выбранный регион не найден.';
    if(a.needsForest&&r?.terrain!=='Лес')return 'Эта способность требует лесной местности.';
    if(a.id==='growth'&&r?.crises?.famine)return 'Благословение роста не действует во время голода. Сначала устраните кризис.';
    if(a.requiresGrove&&!hasGrove(s))return 'Требуется хотя бы одна священная роща.';
    if(a.great&&hasGreatEffect(s))return 'У государства уже действует одно великое благословение.';
    if(hasActiveSame(s,a,opts.regionId,opts))return 'Такое благословение уже действует в выбранном регионе или на выбранном друиде.';
    if(a.druid){
      if(!s.temples?.abode)return 'Для особых даров требуется Обитель хранителей.';
      const d=s.druids.find(x=>x.id===opts.druidId);
      if(!d)return 'Выберите друида.';
      if(!d.dedicated)return 'Особые дары доступны только посвящённым друидам.';
      if(a.master&&d.skill!=='Мастер')return 'Требуется друид уровня «Мастер».';
      if(d.gifts?.length)return 'Посвящённый друид уже получил одно персональное благословение. По регламенту второй личный дар не выдаётся.';
    }
    if(a.conflict==='battle'&&(s.effects||[]).some(e=>e.status==='active'&&e.group==='Военные'&&e.conflict==='battle'))return 'На государстве уже действует другое боевое благословение. Окончание предыдущего требуется зафиксировать вручную.';
    if(a.conflict==='food'&&(s.effects||[]).some(e=>e.status==='active'&&e.regionId===opts.regionId&&['fertile','growth'].includes(e.actionId)))return 'В регионе уже действует сельскохозяйственное благословение.';
    if(a.conflict==='growth'&&(s.effects||[]).some(e=>e.status==='active'&&e.regionId===opts.regionId&&['fertile','growth'].includes(e.actionId)))return 'В регионе уже действует сельскохозяйственное благословение.';
    return null;
  }
  function applyBlessing(id,opts={}){
    const s=activeState(),a=getAction(id);if(!s||!a)return;
    const err=canUseBlessing(s,a,opts);if(err){toast(err,'error');return;}
    s.clerics-=a.cost;
    const region=a.needsRegion?getRegion(s,opts.regionId):null;
    if(a.druid){const d=s.druids.find(x=>x.id===opts.druidId);d.gifts.push(a.id);d.giftNames.push(a.name);}
    if(a.id==='quiet'&&region?.crises)region.crises.wildBeasts=false;
    const effect={id:uid(),actionId:a.id,title:a.name,group:a.group,regionId:region?.id||null,regionName:region?.name||'',cost:a.cost,duration:a.duration,effect:a.effect,great:!!a.great,conflict:a.conflict||null,status:'active',createdAt:new Date().toISOString(),druidId:opts.druidId||null,druidName:opts.druidId?s.druids.find(d=>d.id===opts.druidId)?.name:''};
    s.effects.push(effect);s.lastBlessing={id:a.id,regionId:region?.id||null,druidId:opts.druidId||null};const note=opts.note?` Примечание: ${String(opts.note).trim()}`:'';addJournal(s.id,'blessing',`Применено благословение: ${a.name}`,`${region?`Регион: ${region.name}. `:''}${effect.duration}.${note}`,-a.cost,0);saveDB();closeModal();renderAll();toast(`Благословение «${a.name}» применено.`);
  }
  function openModal(title,body,footer){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;$('#modalFooter').innerHTML=footer||'';$('#modalBackdrop').hidden=false;document.body.style.overflow='hidden';}
  function closeModal(){$('#modalBackdrop').hidden=true;$('#modalBody').innerHTML='';$('#modalFooter').innerHTML='';document.body.style.overflow='';pendingAction=null;preselectDruidId=null;}
  function showModalStateForm(state=null){
    const editing=!!state;
    const raceOptions=['Не указана','Люди','Эльфы','Дворфы','Орки','Полурослики','Нежить','Аренцы','Вампиры','Рун','Шаньди','Некомата','Гобы','Валесийцы','Грандийцы','Инверсы','Мазуры','Скавены','Тёмные орки','Ксатры','Тавуры','Тангуры','Бругачи','Друкхари','Королевские рыцари Жардана'];
    const currentRace=state?.race||'Не указана';const stateRaceOptions=raceOptions.includes(currentRace)?raceOptions:[...raceOptions,currentRace];
    const body=`<form id="stateForm"><div class="field-grid">
      <div class="field full"><label>Название государства *</label><input name="name" required maxlength="90" value="${esc(state?.name||'')}" placeholder="Например, Княжество Китежское"></div>
      <div class="field"><label>Официальная религия</label><input name="officialReligion" value="${esc(state?.officialReligion||'Не указана')}" placeholder="Не указана"></div>
      <div class="field"><label>Раса</label><select name="race">${stateRaceOptions.map(r=>`<option value="${esc(r)}" ${currentRace===r?'selected':''}>${esc(r)}${!raceOptions.includes(r)?' · прежняя запись':''}</option>`).join('')}</select></div>
      <div class="field"><label>Население</label><input name="population" type="number" min="0" step="1" value="${state?.population??''}" placeholder="Не указано"></div>
      <div class="field"><label>Феодалы</label><input name="feudals" type="number" min="0" step="1" value="${state?.feudals??''}" placeholder="Не указано"></div>
      <div class="field"><label>Текущий запас Клирики</label><input name="clerics" type="number" min="0" step="0.25" value="${number(state?.clerics)}"></div>
      <div class="field"><label>Численность священников</label><input name="priests" type="number" min="0" step="1" value="${number(state?.priests)}"></div>
      <div class="field"><label>Дополнительный прирост Клирики в год</label><input name="extraIncome" type="number" min="0" step="0.25" value="${number(state?.extraIncome)}"></div><div class="field"><label>Единство государства (0–100)</label><input name="unity" type="number" min="0" max="100" step="1" value="${number(state?.unity??50)}"></div><div class="field full"><label>Годовой доход государства (монеты)</label><input name="annualIncome" type="number" min="0" step="1" value="${number(state?.annualIncome)}"><div class="field-help">Нужно для расчёта молитв, временно увеличивающих доход.</div></div>
      <div class="field full"><div class="notice">Государство создаётся непосредственно в летописи. Статистику населения, феодалов, религию и расу можно в любой момент изменить вручную. Импортируемого реестра государств больше нет.</div></div>
    </div></form>`;
    openModal(editing?'Редактирование государства':'Добавить государство',body,`<button class="btn ghost" data-modal-cancel>Отмена</button><button class="btn" id="saveStateBtn">${editing?'Сохранить изменения':'Добавить в летопись'}</button>`);
    $('#saveStateBtn').onclick=()=>{
      const f=$('#stateForm');if(!f.reportValidity())return;const fd=new FormData(f);const name=String(fd.get('name')||'').trim();
      if(db.states.some(x=>x.id!==state?.id&&String(x.name||'').trim().toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru'))){toast(`Государство «${name}» уже есть в летописи.`,'error');return;}
      const numberOrNull=value=>String(value??'').trim()===''?null:Math.max(0,number(value));
      const next={name,officialReligion:String(fd.get('officialReligion')||'Не указана').trim()||'Не указана',race:stateRaceOptions.includes(fd.get('race'))?fd.get('race'):'',population:numberOrNull(fd.get('population')),feudals:numberOrNull(fd.get('feudals')),clerics:Math.max(0,number(fd.get('clerics'))),priests:Math.max(0,number(fd.get('priests'))),extraIncome:Math.max(0,number(fd.get('extraIncome'))),unity:Math.max(0,Math.min(100,number(fd.get('unity')))),annualIncome:Math.max(0,number(fd.get('annualIncome')))};
      if(editing){
        const changedReligion=state.officialReligion!==next.officialReligion;const oldClerics=number(state.clerics);
        if(changedReligion&&!confirm('При смене государственной религии запас Клирики обнуляется. Продолжить?'))return;
        Object.assign(state,next);delete state.rosterId;
        if(changedReligion){state.clerics=0;addJournal(state.id,'religion','Изменена государственная религия','Запас Клирики обнулён согласно базовому правилу.',-oldClerics,0);toast('Религия изменена. Запас Клирики обнулён.');}
        else addJournal(state.id,'system','Обновлена карточка государства','Изменены название, религия или статистика государства.');
        saveDB();closeModal();renderAll();toast('Карточка государства обновлена.');
      }else{addState(next);closeModal();}
    };
  }
  function showRegionForm(state,region=null){
    const editing=!!region;const c=region?.crises||{};const body=`<form id="regionForm"><div class="field-grid">
      <div class="field full"><label>Название региона *</label><input name="name" required maxlength="70" value="${esc(region?.name||'')}" placeholder="Например, Сердце чащи"></div>
      <div class="field"><label>Тип местности</label><select name="terrain">${['Лес','Равнина','Горы','Пустошь','Болото','Иное'].map(x=>`<option ${region?.terrain===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label class="checkbox-line"><input type="checkbox" name="grove" ${region?.grove?'checked':''}> Священная роща расположена здесь</label><div class="field-help">Для контрактов и великих природных благословений.</div></div>
      <div class="field"><label>Базовое производство еды (ед./год)</label><input name="foodProduction" type="number" min="0" step="0.1" value="${number(region?.foodProduction)}"></div>
      <div class="field"><label>Базовый прирост населения (%/год)</label><input name="populationGrowth" type="number" min="0" max="100" step="0.01" value="${region?.populationGrowth??1}"></div>
      <div class="field"><label>Базовая лояльность крестьян (%)</label><input name="peasantLoyalty" type="number" min="0" max="100" step="1" value="${region?.peasantLoyalty??55}"></div>
      <div class="field full"><div class="field-help">Отметьте действующие кризисы. Благословения Владыки будут учитывать их при расчёте итоговых показателей.</div></div>
      <div class="field full"><label class="checkbox-line"><input type="checkbox" name="crisisFamine" ${c.famine?'checked':''}> Голод</label><label class="checkbox-line"><input type="checkbox" name="crisisPlague" ${c.plague?'checked':''}> Поветрие</label><label class="checkbox-line"><input type="checkbox" name="crisisDevastation" ${c.devastation?'checked':''}> Опустошение земель</label><label class="checkbox-line"><input type="checkbox" name="crisisWildBeasts" ${c.wildBeasts?'checked':''}> Нападение диких зверей</label></div>
    </div></form>`;
    openModal(editing?'Изменить регион':'Добавить регион',body,`<button class="btn ghost" data-modal-cancel>Отмена</button><button class="btn" id="saveRegionBtn">Сохранить</button>`);
    $('#saveRegionBtn').onclick=()=>{const f=$('#regionForm');if(!f.reportValidity())return;const fd=new FormData(f);const data={name:fd.get('name').trim(),terrain:fd.get('terrain'),grove:fd.get('grove')==='on',foodProduction:Math.max(0,number(fd.get('foodProduction'))),populationGrowth:Math.max(0,number(fd.get('populationGrowth'))),peasantLoyalty:Math.max(0,Math.min(100,number(fd.get('peasantLoyalty')))),crises:{famine:fd.get('crisisFamine')==='on',plague:fd.get('crisisPlague')==='on',devastation:fd.get('crisisDevastation')==='on',wildBeasts:fd.get('crisisWildBeasts')==='on'}};if(data.grove){state.regions.forEach(r=>r.grove=false);}if(editing)Object.assign(region,data);else state.regions.push({id:uid(),...data});addJournal(state.id,'region',editing?'Изменён регион':'Добавлен регион',`${data.name} · ${data.terrain}${data.grove?' · священная роща':''}`);saveDB();closeModal();renderAll();toast('Регион сохранён.');};
  }
  function updateTemple(state,key,value){state.temples[key]=value;if(key==='root'){if(!value)state.rootTempleRegionId=null;else if(!state.rootTempleRegionId)state.rootTempleRegionId=state.regions[0]?.id||null;}addJournal(state.id,'temple','Изменён статус сооружения',`${({chapel:'Часовня леса',root:'Храм корней',abode:'Обитель хранителей'})[key]}: ${value?'построено':'отмечено как отсутствующее'}.`);saveDB();renderAll();}

  function renderHeader(){
    const select=$('#globalStateSelect');const current=select.value||db.activeStateId||'';
    select.innerHTML='<option value="">Не выбрано</option>'+db.states.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    select.value=db.states.some(s=>s.id===current)?current:(db.activeStateId||'');
    if(select.value)db.activeStateId=select.value;
    const selectedState=activeState(),repeatButton=$('#repeatBlessingBtn');const playerInput=$('#playerNameInput');window.LOTW_PLAYER_NAME=db.playerName||'';if(playerInput&&document.activeElement!==playerInput)playerInput.value=db.playerName||'';
    if(repeatButton){const last=selectedState?.lastBlessing;repeatButton.hidden=!last;repeatButton.title=last?`Повторить: ${getAction(last.id)?.name||'последнее благословение'}`:'Последнее благословение ещё не применялось';}
    const names={dashboard:['Обзор','Состояние покровительства и последние действия.'],map:['Карта мира','Интерактивная карта проекта «Хроника государств».'],advisor:['Военный советник','Самостоятельный штаб кампании и расчёт сражений.'],states:['Государства','Учёт государств, регионов, храмов и священных рощ.'],worship:['Молитвы и дары','Каталог благословений, доступность и применение за Клирику.'],contracts:['Контракты','Договоры, обязательства и контроль исполнения.'],druids:['Друиды','Учёт магов, посвящения и персональных даров.'],journal:['Журнал действий','История молитв, расходов, даров и изменений благосклонности.'],admin:['Режим администратора','Общая очередь обращений игроков и ответы Владыки.'],rules:['Правила и догматы','Справочник игровых ограничений и принципов Владыки.'],races:['Расы мира','Энциклопедия народов: внешний вид, продолжительность жизни и физические особенности.']};
    const info=names[currentView]||names.dashboard;$('#crumbTitle').textContent=info[0];$('#pageTitle').textContent=currentView==='dashboard'?'Хозяин леса':info[0];$('#pageDescription').textContent=currentView==='dashboard'?'«Я был до вас. Я был при вас. Я буду после вас».':info[1];
  }
  function renderDashboard(){
    const root=$('#view-dashboard'),s=activeState();
    if(!s){root.innerHTML=`<div class="section-head"><div><div class="section-kicker">НАЧАЛО ЛЕТОПИСИ</div><h2>Покровительство ещё не установлено</h2><p>Создайте первое государство, чтобы вести его отношения с Владыкой, учитывать Клирику, контракты и благословения.</p></div><button class="btn" data-action="new-state">＋ Добавить государство</button></div><div class="empty-state"><div class="empty-icon">♧</div><h3>Здесь начнётся новая летопись</h3><p>Каждое государство получает собственную шкалу благосклонности, запас Клирики, регионы, храмы, друидов и контракты. Данные будут сохраняться в общей базе и доступны всем участникам.</p><button class="btn" data-action="new-state">Создать государство</button></div>`;return;}
    const income=annualClericIncome(s),recent=db.journal.filter(j=>j.stateId===s.id).slice(0,5),activeEffects=(s.effects||[]).filter(e=>e.status==='active'),contracts=(s.contracts||[]).filter(c=>c.status==='active');
    root.innerHTML=`<div class="section-head"><div><div class="section-kicker">СОСТОЯНИЕ ПОКРОВИТЕЛЬСТВА</div><h2>${esc(s.name)}</h2><p>Текущие отношения с Владыкой. Благосклонность закрепляется за государством и не переносится между державами.</p></div><button class="btn secondary" data-action="edit-state">✎ Настроить государство</button></div>
      <div class="grid kpis">
        <div class="card"><div class="card-title">Благосклонность <span class="kpi-icon">✧</span></div><div class="kpi-value">${fmt(s.favor)}<small style="font-size:17px;color:#829079"> / 100</small></div><div class="bar"><span style="width:${Math.max(0,Math.min(100,s.favor))}%"></span></div><div class="kpi-note">${favorStatus(s.favor)}</div></div>
        <div class="card"><div class="card-title">Запас Клирики <span class="kpi-icon">◈</span></div><div class="kpi-value">${fmt(s.clerics)}</div><div class="kpi-note">Годовой прирост: +${fmt(income)}</div></div>
        <div class="card"><div class="card-title">Регионы <span class="kpi-icon">⌖</span></div><div class="kpi-value">${s.regions.length}</div><div class="kpi-note">Священных рощ: ${s.regions.filter(r=>r.grove).length}</div></div><div class="card"><div class="card-title">Единство</div><div class="kpi-value">${fmt(s.unity)}<small style="font-size:15px"> / 100</small></div><div class="bar"><span style="width:${Math.max(0,Math.min(100,s.unity))}%"></span></div><div class="kpi-note">Общая сплочённость державы</div></div>
        <div class="card"><div class="card-title">Активные обязательства <span class="kpi-icon">⚖</span></div><div class="kpi-value">${contracts.length+activeEffects.length}</div><div class="kpi-note">Контрактов: ${contracts.length} · Благословений: ${activeEffects.length}</div></div>
      </div>
      <div class="grid two" style="margin-top:14px">
        <div class="card"><div class="card-title">Связь с Владыкой <span class="pill gold">${favorStatus(s.favor)}</span></div><div class="metric-list" style="margin-top:15px"><div class="metric-row"><span>Официальная религия</span><strong>${esc(s.officialReligion)}</strong></div><div class="metric-row"><span>Священники</span><strong>${fmt(s.priests)}</strong></div><div class="metric-row"><span>Базовая Клирика от священников</span><strong>+${fmt(Math.floor(s.priests/100))}/год</strong></div><div class="metric-row"><span>Дополнительный прирост</span><strong>+${fmt(s.extraIncome)}/год</strong></div><div class="metric-row"><span>Годовой доход</span><strong>${fmt(s.annualIncome)} → ${fmt(adjustedAnnualIncome(s))} монет</strong></div><div class="metric-row"><span>Активная надбавка к доходу</span><strong>+${fmt(civicPct(s,'income'))}%</strong></div><div class="metric-row"><span>Посвящённые сооружения</span><strong>${[s.temples.chapel&&'Часовня',s.temples.root&&'Храм корней',s.temples.abode&&'Обитель'].filter(Boolean).join(', ')||'Нет'}</strong></div><div class="metric-row"><span>Храм корней</span><strong>${s.temples.root?(getRegion(s,s.rootTempleRegionId)?.name||'Регион не выбран'):'Не построен'}</strong></div></div></div>
        <div class="card"><div class="card-title">Быстрые действия <span class="kpi-icon">✦</span></div><div class="list" style="margin-top:13px"><div class="list-row"><div class="list-row-main"><strong>Зафиксировать поступок</strong><small>Изменить благосклонность за подтверждённое действие</small></div><button class="btn small secondary" data-action="favor-action">Записать</button></div><div class="list-row"><div class="list-row-main"><strong>Вознести молитву</strong><small>Записать обращение; сама молитва не гарантирует благосклонности</small></div><button class="btn small secondary" data-action="prayer">Открыть</button></div><div class="list-row"><div class="list-row-main"><strong>Быстрое благословение</strong><small>Выбрать дар и применить из одного окна</small></div><button class="btn small" data-action="quick-blessing">Призвать</button></div>${s.lastBlessing?`<div class="list-row"><div class="list-row-main"><strong>Повторить последнее благословение</strong><small>${esc(getAction(s.lastBlessing.id)?.name||'Последний дар')} · прежняя цель</small></div><button class="btn small secondary" data-action="repeat-blessing">Повторить</button></div>`:''}<div class="list-row"><div class="list-row-main"><strong>Каталог благословений</strong><small>Все дары, требования и стоимость</small></div><button class="btn small secondary" data-nav="worship">Каталог</button></div><div class="list-row"><div class="list-row-main"><strong>Заключить договор</strong><small>Выбрать малый или великий контракт</small></div><button class="btn small secondary" data-nav="contracts">Контракты</button></div><div class="list-row"><div class="list-row-main"><strong>Начислить годовой прирост</strong><small>+${fmt(income)} Клирики по священникам и доп. источникам</small></div><button class="btn small secondary" data-action="accrue-clerics">Начислить</button></div><div class="list-row"><div class="list-row-main"><strong>Изменить запас Клирики</strong><small>Учесть поступление или расход вручную</small></div><button class="btn small secondary" data-action="ledger">Журнал</button></div><div class="list-row"><div class="list-row-main"><strong>Завершить игровой ход</strong><small>Сократить сроки временных благословений и контрактов</small></div><button class="btn small secondary" data-action="advance-state-turn">Ход ${number(s.turn)+1}</button></div></div></div>
      </div>
      <div class="grid two" style="margin-top:14px"><div class="card"><div class="card-title">Действующие благословения</div>${activeEffects.length?`<div class="list" style="margin-top:12px">${activeEffects.slice(0,4).map(e=>`<div class="list-row"><div class="list-row-main"><strong>${esc(e.title)}</strong><small>${esc(e.regionName||e.druidName||e.duration)}</small></div><button class="btn small ghost" data-action="finish-effect" data-id="${e.id}">Завершить</button></div>`).join('')}</div>`:'<div class="empty-inline">Нет активных благословений</div>'}</div><div class="card"><div class="card-title">Последние записи</div>${recent.length?`<div class="list" style="margin-top:12px">${recent.map(j=>`<div class="list-row"><div class="list-row-main"><strong>${esc(j.title)}</strong><small>${new Date(j.date).toLocaleDateString('ru-RU')} · ${esc(j.detail)}</small></div><span class="${j.favorDelta>0?'good':j.favorDelta<0?'bad':'muted'}">${j.favorDelta>0?'+':''}${j.favorDelta||''}</span></div>`).join('')}</div>`:'<div class="empty-inline">Записей пока нет</div>'}</div></div>`;
  }
  function renderStates(){
    const root=$('#view-states');
    root.innerHTML=`<div class="section-head"><div><div class="section-kicker">ЛЕТОПИСЬ ДЕРЖАВ</div><h2>Государства и покровительство</h2><p>Здесь ведутся отдельные записи благосклонности, Клирики, регионов, храмов, друидов и контрактов. Внешнего реестра государств и импорта таблиц больше нет.</p></div><button class="btn" data-action="new-state">＋ Добавить государство</button></div>`;
    if(!db.states.length){root.innerHTML+=`<div class="empty-state"><div class="empty-icon">♧</div><h3>Летопись пока пуста</h3><p>Добавьте государство вручную. Оно получит собственную шкалу благосклонности, запас Клирики, регионы, храмы, друидов и контракты.</p><button class="btn" data-action="new-state">Создать государство</button></div>`;return;}
    root.innerHTML+=`<div class="grid two">${db.states.map(s=>`<article class="card state-card"><div class="state-head"><div><h3>${esc(s.name)}</h3><div class="state-meta"><span class="pill gold">${favorStatus(s.favor)} · ${fmt(s.favor)}/100</span><span class="pill">Клирика: ${fmt(s.clerics)}</span></div></div><button class="btn small ${db.activeStateId===s.id?'':'secondary'}" data-action="select-state" data-id="${s.id}">${db.activeStateId===s.id?'Выбрано':'Выбрать'}</button></div><div class="metric-list"><div class="metric-row"><span>Религия</span><strong>${esc(s.officialReligion)}</strong></div>${effectiveStateRace(s)?`<div class="metric-row"><span>Раса</span><strong>${esc(effectiveStateRace(s))}</strong></div>`:''}<div class="metric-row"><span>Население / феодалы</span><strong>${s.population==null?'—':fmt(s.population)} / ${s.feudals==null?'—':fmt(s.feudals)}</strong></div><div class="metric-row"><span>Клирика в год</span><strong>+${fmt(annualClericIncome(s))}</strong></div><div class="metric-row"><span>Регионы / рощи</span><strong>${s.regions.length} / ${s.regions.filter(r=>r.grove).length}</strong></div><div class="metric-row"><span>Друиды</span><strong>${s.druids.length} (${s.druids.filter(d=>d.dedicated).length} посвящ.)</strong></div></div><div class="region-chips" style="display:grid;gap:6px;margin:12px 0">${s.regions.length?s.regions.map(r=>`<div class="list-row"><div class="list-row-main"><strong>${esc(r.name)}</strong><small>${esc(r.terrain)}${r.grove?' · Священная роща':''} · Еда: ${fmt(regionEffectStats(s,r).food)} ед./год · Прирост: ${fmt(regionEffectStats(s,r).popGrowth)}% · Лояльность крестьян: ${fmt(regionEffectStats(s,r).loyalty)}%${regionEffectStats(s,r).crises.length?' · Кризисы: '+regionEffectStats(s,r).crises.join(', '):' · Кризисов нет'}</small></div><div class="list-actions"><button class="btn small ghost" data-action="edit-region" data-id="${r.id}" data-state="${s.id}">Изменить</button><button class="btn small danger" data-action="delete-region" data-id="${r.id}" data-state="${s.id}">×</button></div></div>`).join(''):'<span class="small-note">Регионы не добавлены</span>'}</div><div class="card-actions"><button class="btn small secondary" data-action="edit-state" data-id="${s.id}">Редактировать</button><button class="btn small secondary" data-action="add-region" data-id="${s.id}">＋ Регион</button><button class="btn small ghost" data-action="temples" data-id="${s.id}">Сооружения</button><button class="btn small danger" data-action="delete-state" data-id="${s.id}">Удалить из летописи</button></div></article>`).join('')}</div>`;
  }
  function renderWorship(){
    const root=$('#view-worship'),s=activeState();const groups=['Все','Гражданские','Военные','Дары друидам'];
    root.innerHTML=`<div class="section-head"><div><div class="section-kicker">ОБРАЩЕНИЯ К ВЛАДЫКЕ</div><h2>Молитвы и благословения</h2><p>Молитва доступна всем государствам. Благословение требует достаточной благосклонности и запаса Клирики. Особые дары предназначены посвящённым друидам.</p></div><button class="btn" data-action="quick-blessing">✦ Быстрое благословение</button></div>`;
    if(!s){root.innerHTML+=`<div class="empty-state"><h3>Сначала добавьте государство</h3><p>Каталог доступен для просмотра, но для применения способностей необходимо выбрать державу.</p><button class="btn" data-action="new-state">Добавить государство</button></div>`;return;}
    root.innerHTML+=`<div class="grid kpis" style="margin-bottom:14px"><div class="card"><div class="card-title">Благосклонность</div><div class="kpi-value">${s.favor}/100</div><div class="kpi-note">${favorStatus(s.favor)}</div></div><div class="card"><div class="card-title">Доступная Клирика</div><div class="kpi-value">${fmt(s.clerics)}</div><div class="kpi-note">Расход списывается при применении</div></div><div class="card"><div class="card-title">Единство</div><div class="kpi-value">${fmt(s.unity)}/100</div><div class="kpi-note">Можно укреплять молитвой</div></div><div class="card"><div class="card-title">Посвящённые храмы</div><div class="kpi-value">${[s.temples.chapel,s.temples.root,s.temples.abode].filter(Boolean).length}/3</div><div class="kpi-note">Необходимы для дополнительных возможностей</div></div><div class="card"><div class="card-title">Священная роща</div><div class="kpi-value">${hasGrove(s)?'Есть':'Нет'}</div><div class="kpi-note">Требуется для великих даров</div></div></div>
      <div class="tabs">${groups.map(g=>`<button class="tab ${worshipFilter===g?'active':''}" data-filter="${g}">${g}</button>`).join('')}</div>
      <div class="catalog-grid">${blessings.filter(a=>worshipFilter==='Все'||a.group===worshipFilter).map(a=>{const ok=s.favor>=a.min&&s.clerics>=a.cost;return `<article class="card catalog-card"><div class="card-title"><span>${esc(a.group)}</span><span class="pill ${a.great?'gold':''}">${esc(a.kind)}</span></div><h3>${esc(a.name)}</h3><p>${esc(a.desc)}</p><div class="catalog-meta"><span class="cost">${a.cost} Клирики</span><span class="muted" style="font-size:9px">Благосклонность: ${a.min}+</span></div><div class="small-note">Длительность: ${esc(a.duration)}</div><button class="btn small ${ok?'':'secondary'}" style="margin-top:12px" data-action="cast" data-id="${a.id}">${ok?'Применить':'Проверить условия'}</button></article>`;}).join('')}</div><div class="section-head" style="margin-top:24px"><div><div class="section-kicker">ДЕЙСТВУЮЩИЕ ЭФФЕКТЫ</div><h2 style="font-size:25px">Активное покровительство</h2></div></div>${s.effects.filter(e=>e.status==='active').length?`<div class="list">${s.effects.filter(e=>e.status==='active').map(e=>`<div class="list-row"><div class="list-row-main"><strong>${esc(e.title)}</strong><small>${esc(e.regionName||e.druidName||e.duration)} · ${esc(e.effect)}</small></div><button class="btn small ghost" data-action="finish-effect" data-id="${e.id}">Завершить</button></div>`).join('')}</div>`:'<div class="empty-inline">Нет активных эффектов</div>'}`;
  }
  function showCastModal(action){
    const s=activeState();if(!s)return;const regionField=action.needsRegion?`<div class="field"><label>Регион</label><select name="regionId" required><option value="">Выберите регион</option>${regionOptions(s,!!action.needsForest)}</select></div>`:'';
    const druidField=action.druid?`<div class="field"><label>Посвящённый друид</label><select name="druidId" required><option value="">Выберите друида</option>${s.druids.filter(d=>d.dedicated).map(d=>`<option value="${d.id}" ${preselectDruidId===d.id?'selected':''}>${esc(d.name)} · ${esc(d.skill)}</option>`).join('')}</select></div>`:'';
    const body=`<div class="notice green">${esc(action.desc)}</div><div class="metric-list" style="margin:14px 0"><div class="metric-row"><span>Стоимость</span><strong>${action.cost} Клирики</strong></div><div class="metric-row"><span>Требуемая благосклонность</span><strong>${action.min}/100</strong></div><div class="metric-row"><span>Длительность</span><strong>${esc(action.duration)}</strong></div></div><form id="castForm"><div class="field-grid">${regionField}${druidField}<div class="field full"><label>Примечание для летописи (необязательно)</label><textarea name="note" placeholder="Цель применения, обстоятельства или условие вармастера"></textarea></div></div></form><div class="small-note" style="margin-top:12px">Применение списывает Клирику, создаёт запись в журнале и фиксирует активный эффект. Подтверждение результата в игровом мире остаётся за вармастером.</div>`;
    openModal(action.name,body,`<button class="btn ghost" data-modal-cancel>Отмена</button><button class="btn" id="confirmCast">Применить за ${action.cost} Клирики</button>`);
    $('#confirmCast').onclick=()=>{const f=$('#castForm');if(!f.reportValidity())return;const fd=new FormData(f);const opts={regionId:fd.get('regionId'),druidId:fd.get('druidId')};const err=canUseBlessing(s,action,opts);if(err){toast(err,'error');return;}preselectDruidId=null;applyBlessing(action.id,opts);if(fd.get('note')){const j=db.journal.find(x=>x.title===`Применено благословение: ${action.name}`);if(j)j.detail+=' Примечание: '+fd.get('note');saveDB();}};
  }
  function showQuickBlessingModal(){
    const s=activeState();if(!s){toast('Сначала создайте или выберите государство.','error');return;}
    const preferred=s.lastBlessing?.id&&getAction(s.lastBlessing.id)?s.lastBlessing.id:'fertile';
    const options=blessings.map(a=>`<option value="${a.id}" ${a.id===preferred?'selected':''}>${esc(a.name)} · ${a.cost} Клирики</option>`).join('');
    const body=`<div class="notice green">Быстрое обращение: выберите дар, при необходимости укажите регион или посвящённого друида и примените его из одного окна. Все требования, стоимость и ограничения остаются в силе.</div>
      <form id="quickBlessingForm" style="margin-top:14px"><div class="field-grid">
      <div class="field full"><label>Благословение</label><select name="actionId" id="quickBlessingAction">${options}</select></div>
      <div class="field full" id="quickBlessingInfo"></div>
      <div class="field full" id="quickBlessingRegionField"><label>Регион</label><select name="regionId" id="quickBlessingRegion"><option value="">Выберите регион</option>${regionOptions(s)}</select></div>
      <div class="field full" id="quickBlessingDruidField" hidden><label>Посвящённый друид</label><select name="druidId" id="quickBlessingDruid"><option value="">Выберите друида</option>${s.druids.filter(d=>d.dedicated).map(d=>`<option value="${esc(d.id)}">${esc(d.name)} · ${esc(d.skill)}</option>`).join('')}</select></div>
      <div class="field full"><label>Примечание для летописи (необязательно)</label><textarea name="note" rows="2" placeholder="Цель применения или условие вармастера"></textarea></div>
      </div></form><div id="quickBlessingStatus" class="small-note" style="margin-top:12px"></div>`;
    openModal('Быстрое благословение',body,`<button class="btn ghost" data-modal-cancel>Отмена</button><button class="btn" id="quickBlessingApply">Применить благословение</button>`);
    const update=()=>{
      const a=getAction($('#quickBlessingAction').value);if(!a)return;
      const regionField=$('#quickBlessingRegionField'),druidField=$('#quickBlessingDruidField'),regionSel=$('#quickBlessingRegion'),druidSel=$('#quickBlessingDruid');
      const rememberedRegion=(s.lastBlessing?.id===a.id&&s.lastBlessing.regionId)?s.lastBlessing.regionId:regionSel.value;
      regionSel.innerHTML='<option value="">Выберите регион</option>'+regionOptions(s,!!a.needsForest);
      regionField.hidden=!a.needsRegion;regionSel.required=!!a.needsRegion;druidField.hidden=!a.druid;druidSel.required=!!a.druid;
      if(a.needsRegion&&s.regions.some(r=>r.id===rememberedRegion&&(!a.needsForest||r.terrain==='Лес')))regionSel.value=rememberedRegion;
      if(a.druid&&s.lastBlessing?.id===a.id&&s.lastBlessing.druidId)druidSel.value=s.lastBlessing.druidId;
      $('#quickBlessingInfo').innerHTML=`<div class="notice"><strong>${esc(a.desc)}</strong><br>Стоимость: ${a.cost} Клирики · Благосклонность: ${a.min}+ · ${esc(a.duration)}</div>`;
      const err=canUseBlessing(s,a,{regionId:a.needsRegion?regionSel.value:null,druidId:a.druid?druidSel.value:null});
      $('#quickBlessingStatus').textContent=err||'Условия предварительно выполнены. Применение спишет Клирику и запишет эффект в летопись.';
      $('#quickBlessingApply').disabled=!!err;
    };
    $('#quickBlessingAction').onchange=update;$('#quickBlessingRegion').onchange=update;$('#quickBlessingDruid').onchange=update;update();
    $('#quickBlessingApply').onclick=()=>{const f=$('#quickBlessingForm');if(!f.reportValidity())return;const fd=new FormData(f),a=getAction(fd.get('actionId')),opts={regionId:fd.get('regionId'),druidId:fd.get('druidId'),note:fd.get('note')};const err=canUseBlessing(s,a,opts);if(err){toast(err,'error');update();return;}preselectDruidId=null;applyBlessing(a.id,opts);};
  }
  function repeatLastBlessing(){
    const s=activeState(),last=s?.lastBlessing;if(!s||!last||!getAction(last.id)){toast('В этом государстве ещё нет последнего благословения для повтора.','error');return;}
    const a=getAction(last.id),opts={regionId:last.regionId,druidId:last.druidId};const err=canUseBlessing(s,a,opts);if(err){toast(`Повтор недоступен: ${err}`,'error');showQuickBlessingModal();return;}applyBlessing(a.id,opts);
  }

  function renderContracts(){
    const root=$('#view-contracts'),s=activeState();root.innerHTML=`<div class="section-head"><div><div class="section-kicker">ВЗАИМНЫЕ ОБЯЗАТЕЛЬСТВА</div><h2>Контракты с Владыкой</h2><p>Договор заключается за Клирику и предполагает обязательства государства. Нарушение условий приводит к потере благосклонности и отзыву покровительства.</p></div></div>`;
    if(!s){root.innerHTML+=`<div class="empty-state"><h3>Выберите государство</h3><p>Контракты заключаются отдельно каждой державой.</p><button class="btn" data-action="new-state">Добавить государство</button></div>`;return;}
    const active=(s.contracts||[]).filter(c=>c.status==='active'),small=active.filter(c=>c.size==='Малый').length,large=active.filter(c=>c.size==='Большой').length;
    root.innerHTML+=`<div class="grid kpis" style="margin-bottom:14px"><div class="card"><div class="card-title">Активные контракты</div><div class="kpi-value">${active.length}</div><div class="kpi-note">Один малый и один большой максимум</div></div><div class="card"><div class="card-title">Малый слот</div><div class="kpi-value">${small?'Занят':'Свободен'}</div><div class="kpi-note">${small}/1</div></div><div class="card"><div class="card-title">Большой слот</div><div class="kpi-value">${large?'Занят':'Свободен'}</div><div class="kpi-note">${large}/1</div></div><div class="card"><div class="card-title">Клирика</div><div class="kpi-value">${fmt(s.clerics)}</div><div class="kpi-note">Доступно для новых соглашений</div></div></div>
      <div class="section-head"><div><div class="section-kicker">ПРЕДЛОЖЕНИЯ ВЛАДЫКИ</div><h2 style="font-size:25px">Выбрать договор</h2></div></div>
      <div class="grid two">${contractsCatalog.map(c=>{const slotFree=c.size==='Малый'?small===0:large===0;const eligible=s.favor>=c.min&&s.clerics>=c.cost&&slotFree&&(!c.requiresForestRegion||s.regions.some(r=>r.terrain==='Лес'))&&(!c.requiresRegion||s.regions.length>0);return `<article class="card contract-card ${c.size==='Большой'?'large':''}"><div class="card-title"><span>${c.size==='Большой'?'ВЕЛИКИЙ КОНТРАКТ':'МАЛЫЙ КОНТРАКТ'}</span><span class="pill ${c.size==='Большой'?'gold':''}">${c.cost} Клирики</span></div><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p><div class="contract-terms"><strong>Обязательства:</strong><ul>${c.terms.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><strong>Вознаграждение:</strong> ${esc(c.reward)}</div><div class="catalog-meta"><span class="muted" style="font-size:9px">Благосклонность: ${c.min}+</span><span class="muted" style="font-size:9px">${esc(c.duration)}</span></div><button class="btn small ${eligible?'':'secondary'}" data-action="contract-start" data-id="${c.id}" ${eligible?'':'disabled'}>${eligible?'Заключить договор':!slotFree?'Слот занят':'Условия не выполнены'}</button></article>`;}).join('')}</div>
      <div class="section-head" style="margin-top:25px"><div><div class="section-kicker">ЛЕТОПИСЬ СОГЛАШЕНИЙ</div><h2 style="font-size:25px">Действующие контракты</h2></div></div>
      ${active.length?`<div class="list">${active.map(c=>`<article class="card"><div class="state-head"><div><div class="card-title">${esc(c.size)} · ${esc(c.duration)}</div><h3 style="font-family:'Cormorant Garamond';font-size:23px;margin:6px 0;color:#e8d9aa">${esc(c.name)}</h3><div class="small-note">Заключён: ${new Date(c.startedAt).toLocaleDateString('ru-RU')} · ${esc(c.regionName||'Без привязки к региону')}</div></div><span class="pill">Активен</span></div><p class="small-note">${esc(c.desc)}</p><div class="card-actions"><button class="btn small" data-action="contract-fulfill" data-id="${c.id}">Отметить исполненным</button><button class="btn small danger" data-action="contract-breach" data-id="${c.id}">Нарушить договор</button></div></article>`).join('')}</div>`:'<div class="empty-inline">Активных контрактов нет</div>'}
      <div class="section-head" style="margin-top:25px"><div><div class="section-kicker">ИСТОРИЯ</div><h2 style="font-size:25px">Завершённые договоры</h2></div></div>${(s.contracts||[]).filter(c=>c.status!=='active').length?`<div class="list">${s.contracts.filter(c=>c.status!=='active').map(c=>`<div class="list-row"><div class="list-row-main"><strong>${esc(c.name)}</strong><small>${new Date(c.endedAt||c.startedAt).toLocaleDateString('ru-RU')} · ${esc(c.status==='fulfilled'?'Исполнен':'Нарушен')}</small></div><span class="pill ${c.status==='fulfilled'?'':'red'}">${c.status==='fulfilled'?'Исполнен':'Нарушен'}</span></div>`).join('')}</div>`:'<div class="empty-inline">История пока пуста</div>'}`;
  }
  function startContract(id){
    const s=activeState(),c=contractsCatalog.find(x=>x.id===id);if(!s||!c)return;
    const active=s.contracts.filter(x=>x.status==='active');if(active.some(x=>x.size===c.size)){toast(`Слот «${c.size.toLowerCase()} контракт» уже занят.`,'error');return;}if(s.favor<c.min||s.clerics<c.cost||(c.requiresForestRegion&&!s.regions.some(r=>r.terrain==='Лес'))||(c.requiresRegion&&!s.regions.length)){toast('Не выполнены условия контракта или не добавлен подходящий регион.','error');return;}
    const needsRegion=!!(c.requiresRegion||c.requiresForestRegion);
    const regionList=(s.regions||[]).filter(r=>!c.requiresForestRegion||r.terrain==='Лес');
    const body=`<div class="notice">${esc(c.desc)}</div><div class="contract-terms"><strong>Вы принимаете обязательства:</strong><ul>${c.terms.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>${needsRegion?`<div class="field"><label>Регион договора *</label><select id="contractRegion" required><option value="">Выберите регион</option>${regionList.map(r=>`<option value="${r.id}">${esc(r.name)} · ${esc(r.terrain)}${r.grove?' · Священная роща':''}</option>`).join('')}</select></div>`:''}<div class="small-note" style="margin-top:10px">Вознаграждение: ${esc(c.reward)}. Нарушение условий приведёт к потере благосклонности.</div>`;
    openModal(`Заключить: ${c.name}`,body,`<button class="btn ghost" data-modal-cancel>Отмена</button><button class="btn" id="contractConfirm">Подтвердить за ${c.cost} Клирики</button>`);
    $('#contractConfirm').onclick=()=>{const regionSelect=$('#contractRegion');if(regionSelect?.required&&!regionSelect.value){toast('Выберите регион для договора.','error');return;}const regionId=regionSelect?.value||'';s.clerics-=c.cost;s.contracts.push({id:uid(),typeId:c.id,name:c.name,size:c.size,cost:c.cost,min:c.min,duration:c.duration,turns:c.turns,status:'active',startedAt:new Date().toISOString(),desc:c.desc,terms:c.terms,reward:c.reward,gain:c.gain,regionId,regionName:getRegion(s,regionId)?.name||''});addJournal(s.id,'contract',`Заключён контракт: ${c.name}`,`Слот: ${c.size}. ${c.duration}.`,-c.cost,0);saveDB();closeModal();renderAll();toast('Контракт заключён. Обязательства внесены в летопись.');};
  }
  function finishContract(id,breach=false){
    const s=activeState(),c=s?.contracts.find(x=>x.id===id&&x.status==='active');if(!c)return;
    const penalty=breach?(c.size==='Большой'?20:10):0;const title=breach?'Нарушить договор':'Подтвердить исполнение';
    openModal(title,`<div class="notice ${breach?'red':'green'}">${breach?`Вы фиксируете нарушение «${esc(c.name)}». Благосклонность уменьшится на ${penalty} пунктов, божественное покровительство будет отозвано.`:`Вы подтверждаете, что обязательства по договору «${esc(c.name)}» выполнены. Благосклонность увеличится на ${number(c.gain??5)} пунктов.`}</div>`, `<button class="btn ghost" data-modal-cancel>Отмена</button><button class="btn ${breach?'danger':''}" id="finishContractConfirm">${breach?'Подтвердить нарушение':'Подтвердить исполнение'}</button>`);
    $('#finishContractConfirm').onclick=()=>{c.status=breach?'breached':'fulfilled';c.endedAt=new Date().toISOString();const actualFavor=changeFavor(s,breach?-penalty:number(c.gain??5),'contract',`${breach?'Нарушен':'Исполнен'} контракт: ${c.name}`,breach?'Договор нарушен. Покровительство отозвано.':'Обязательства по договору выполнены.');saveDB();closeModal();renderAll();toast(breach?'Договор нарушен. Покровительство отозвано.':'Договор исполнен. Благосклонность возросла.');};
  }
  function renderDruids(){
    const root=$('#view-druids'),s=activeState();root.innerHTML=`<div class="section-head"><div><div class="section-kicker">ПОСВЯЩЁННЫЕ ХРАНИТЕЛИ</div><h2>Друиды и особые дары</h2><p>Друидизм открыт для изучения всем магам. Посвящение Владыке открывает доступ к его персональным благословениям.</p></div><button class="btn" data-action="add-druid">＋ Добавить мага</button></div>`;
    if(!s){root.innerHTML+=`<div class="empty-state"><h3>Нет выбранного государства</h3><p>Учёт друидов ведётся отдельно по каждой державе.</p><button class="btn" data-action="new-state">Добавить государство</button></div>`;return;}
    root.innerHTML+=`<div class="grid three" style="margin-bottom:14px"><div class="card"><div class="card-title">Друиды</div><div class="kpi-value">${s.druids.length}</div><div class="kpi-note">Все маги, изучающие друидизм</div></div><div class="card"><div class="card-title">Посвящённые</div><div class="kpi-value">${s.druids.filter(d=>d.dedicated).length}</div><div class="kpi-note">Имеют право на особые дары</div></div><div class="card"><div class="card-title">Обитель хранителей</div><div class="kpi-value">${s.temples.abode?'Построена':'Отсутствует'}</div><div class="kpi-note">Нужна для посвящения и выдачи даров</div></div></div>
      ${!s.temples.abode?'<div class="notice">Для посвящения друидов и выдачи особых даров отметьте постройку «Обитель хранителей» в разделе «Государства → Сооружения». Само изучение друидизма от наличия обители не зависит.</div>':''}
      ${s.druids.length?`<div class="grid two" style="margin-top:14px">${s.druids.map(d=>`<article class="card"><div class="druid-card"><div class="druid-avatar">❧</div><div style="flex:1"><div class="state-head"><div><h3 style="font-family:'Cormorant Garamond';font-size:23px;margin:0;color:#ecdfb9">${esc(d.name)}</h3><div class="small-note">${esc(d.skill)} · ${d.dedicated?'Посвящён Владыке':'Не посвящён'}</div></div><span class="pill ${d.dedicated?'gold':'gray'}">${d.dedicated?'Посвящён':'Маг'}</span></div></div></div><div class="metric-row" style="margin-top:13px"><span>Особые дары</span><strong>${d.gifts.length}</strong></div><div class="small-note" style="margin-top:8px">${d.giftNames.length?d.giftNames.map(esc).join(' · '):'Пока не получены'}</div><div class="card-actions"><button class="btn small secondary" data-action="druid-gift" data-id="${d.id}" ${d.dedicated?'':'disabled'}>Выдать дар</button><button class="btn small ghost" data-action="druid-edit" data-id="${d.id}">Изменить</button><button class="btn small danger" data-action="druid-delete" data-id="${d.id}">Удалить</button></div></article>`).join('')}</div>`:'<div class="empty-state" style="margin-top:14px"><div class="empty-icon">❧</div><h3>Друиды ещё не внесены</h3><p>Добавьте мага, изучающего друидизм. При наличии Обители хранителей его можно посвятить Владыке.</p><button class="btn" data-action="add-druid">Добавить первого друида</button></div>'}`;
  }
  function showDruidForm(s,d=null){
    const editing=!!d;const body=`<form id="druidForm"><div class="field-grid"><div class="field full"><label>Имя персонажа *</label><input name="name" required maxlength="70" value="${esc(d?.name||'')}" placeholder="Имя друида"></div><div class="field"><label>Уровень владения друидизмом</label><select name="skill">${['Ученик','Опытный','Мастер'].map(x=>`<option ${d?.skill===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label class="checkbox-line"><input type="checkbox" name="dedicated" ${d?.dedicated?'checked':''} ${!s.temples.abode?'disabled':''}> Посвящён Владыке</label><div class="field-help">Посвящение доступно при наличии Обители хранителей и благосклонности от 40.</div></div></div></form>`;
    openModal(editing?'Изменить друида':'Добавить друида',body,`<button class="btn ghost" data-modal-cancel>Отмена</button><button class="btn" id="saveDruidBtn">Сохранить</button>`);
    $('#saveDruidBtn').onclick=()=>{const f=$('#druidForm');if(!f.reportValidity())return;const fd=new FormData(f);const ded=fd.get('dedicated')==='on';if(ded&&(!s.temples.abode||s.favor<40)){toast('Для посвящения нужны Обитель хранителей и благосклонность 40+.','error');return;}const data={name:fd.get('name').trim(),skill:fd.get('skill'),dedicated:ded};if(editing){Object.assign(d,data);}else{s.druids.push({id:uid(),...data,gifts:[],giftNames:[]});}addJournal(s.id,'druid',editing?'Изменён друид':'Добавлен друид',`${data.name} · ${data.skill}${ded?' · посвящён':''}`);saveDB();closeModal();renderAll();toast('Запись друида сохранена.');};
  }
  function finishEffect(id){const s=activeState(),e=s?.effects.find(x=>x.id===id&&x.status==='active');if(!e)return;if(!confirm(`Отметить эффект «${e.title}» как завершённый?`))return;e.status='completed';e.endedAt=new Date().toISOString();addJournal(s.id,'effect',`Завершено благословение: ${e.title}`,`${e.regionName?`Регион: ${e.regionName}. `:''}${e.duration}.`);saveDB();renderAll();toast('Благословение отмечено как завершённое.');}
  function renderJournal(){
    const root=$('#view-journal'),s=activeState();root.innerHTML=`<div class="section-head"><div><div class="section-kicker">ПАМЯТЬ О ПОСТУПКАХ</div><h2>Журнал действий</h2><p>Все обращения, благословения, расходы, подношения и изменения благосклонности записываются в летопись государства.</p></div><button class="btn" data-action="ledger">＋ Добавить запись</button></div>`;
    if(!s){root.innerHTML+=`<div class="empty-state"><h3>Выберите государство</h3><p>Журнал хранит отдельную историю каждой державы.</p></div>`;return;}
    const rows=db.journal.filter(j=>j.stateId===s.id);
    root.innerHTML+=`<div class="grid kpis" style="margin-bottom:14px"><div class="card"><div class="card-title">Записей в летописи</div><div class="kpi-value">${rows.length}</div></div><div class="card"><div class="card-title">Текущая Клирика</div><div class="kpi-value">${fmt(s.clerics)}</div></div><div class="card"><div class="card-title">Благосклонность</div><div class="kpi-value">${s.favor}/100</div></div><div class="card"><div class="card-title">Годовой прирост Клирики</div><div class="kpi-value">+${fmt(annualClericIncome(s))}</div></div></div>
      ${rows.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Дата</th><th>Тип</th><th>Событие</th><th>Детали</th><th>Клирика</th><th>Благосклонность</th></tr></thead><tbody>${rows.map(j=>`<tr><td>${new Date(j.date).toLocaleString('ru-RU')}</td><td><span class="pill">${esc(j.type)}</span></td><td><strong>${esc(j.title)}</strong></td><td>${esc(j.detail||'—')}</td><td class="${j.clericDelta<0?'bad':j.clericDelta>0?'good':''}">${j.clericDelta>0?'+':''}${fmt(j.clericDelta)}</td><td class="${j.favorDelta<0?'bad':j.favorDelta>0?'good':''}">${j.favorDelta>0?'+':''}${fmt(j.favorDelta)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-inline">Записей пока нет. Начните с молитвы или подношения.</div>'}`;
  }
  function showLedgerModal(){
    const s=activeState();if(!s){toast('Сначала выберите государство.','error');return;}
    const body=`<form id="ledgerForm"><div class="field-grid"><div class="field full"><label>Тип записи</label><select name="type"><option value="prayer">Молитва</option><option value="offering">Подношение</option><option value="income">Поступление Клирики</option><option value="favor">Изменение благосклонности</option><option value="note">Примечание летописи</option></select></div><div class="field full"><label>Название *</label><input name="title" required maxlength="90" placeholder="Например, Подношение семян и трав"></div><div class="field"><label>Изменение Клирики (+/−)</label><input name="clerics" type="number" step="0.25" value="0"></div><div class="field"><label>Изменение благосклонности (+/−)</label><input name="favor" type="number" step="1" value="0"></div><div class="field full"><label>Описание</label><textarea name="detail" placeholder="Обстоятельства обращения или принятое решение"></textarea></div></div></form><div class="small-note" style="margin-top:10px">После сохранения значения будут применены к текущему государству. Благосклонность ограничена диапазоном 0–100, запас Клирики не может стать отрицательным.</div>`;
    openModal('Новая запись летописи',body,`<button class="btn ghost" data-modal-cancel>Отмена</button><button class="btn" id="saveLedgerBtn">Сохранить запись</button>`);
    $('#saveLedgerBtn').onclick=()=>{const f=$('#ledgerForm');if(!f.reportValidity())return;const fd=new FormData(f);let cd=number(fd.get('clerics')),fdv=number(fd.get('favor'));if(s.clerics+cd<0){toast('Запас Клирики не может стать отрицательным.','error');return;}const actualFavor=Math.max(-s.favor,Math.min(100-s.favor,fdv));s.clerics+=cd;s.favor=Math.max(0,Math.min(100,s.favor+actualFavor));addJournal(s.id,fd.get('type'),fd.get('title').trim(),fd.get('detail').trim(),cd,actualFavor);saveDB();closeModal();renderAll();toast('Запись добавлена в летопись.');};
  }
  function showFavorActionModal(){
    const s=activeState();if(!s){toast('Сначала выберите государство.','error');return;}
    const actions=[
      {value:'protect',label:'Защита мирных жителей и живых существ',delta:2,detail:'Подтверждённый поступок по защите жизни.'},
      {value:'restore',label:'Восстановление повреждённой природной территории',delta:3,detail:'Подтверждённое восстановление природной среды.'},
      {value:'grove',label:'Сохранение священной рощи от угрозы',delta:3,detail:'Государство защитило священную рощу.'},
      {value:'slaughter',label:'Бессмысленное уничтожение животных или экосистемы',delta:-5,detail:'Зафиксировано бессмысленное уничтожение жизни.'},
      {value:'defile',label:'Осквернение или вырубка священной рощи',delta:-10,detail:'Священная роща осквернена или уничтожена.'},
      {value:'breach',label:'Нарушение данного обещания',delta:-10,detail:'Государство нарушило данное обязательство.'},
      {value:'admin',label:'Решение вармастера / ручная корректировка',delta:0,detail:'Изменение внесено вармастером по результатам игрового события.',custom:true}
    ];
    const body=`<div class="notice">Благосклонность не растёт от числа священников, накопления Клирики или одной лишь молитвы. Владыка судит по поступкам. Отметьте только событие, которое действительно произошло; исполнение контракта по-прежнему начисляет +5 отдельно.</div><form id="favorActionForm" style="margin-top:14px"><div class="field-grid"><div class="field full"><label>Поступок государства</label><select name="action">${actions.map(a=>`<option value="${a.value}">${a.label} (${a.custom?'указать вручную':`${a.delta>0?'+':''}${a.delta}`})</option>`).join('')}</select></div><div class="field" id="customFavorField" hidden><label>Изменение благосклонности (от −100 до +100)</label><input name="customDelta" type="number" min="-100" max="100" step="1" value="0"></div><div class="field full"><label>Подтверждение / обстоятельства</label><textarea name="detail" rows="3" placeholder="Кратко опишите, что произошло и чем это подтверждается" required></textarea></div></div><div id="favorActionPreview" class="small-note" style="margin-top:10px"></div></form>`;
    openModal('Зафиксировать поступок',body,`<button class="btn ghost" data-modal-cancel>Отмена</button><button class="btn" id="saveFavorActionBtn">Применить изменение</button>`);
    const form=$('#favorActionForm');
    const update=()=>{const a=actions.find(x=>x.value===form.elements.action.value);const custom=!!a?.custom;$('#customFavorField').hidden=!custom;const delta=custom?number(form.elements.customDelta.value):number(a?.delta);$('#favorActionPreview').textContent=`Изменение: ${delta>0?'+':''}${fmt(delta)} · текущая благосклонность ${fmt(s.favor)}/100 · после записи ${fmt(Math.max(0,Math.min(100,number(s.favor)+delta)))}/100.`;};
    form.elements.action.onchange=update;form.elements.customDelta.oninput=update;update();
    $('#saveFavorActionBtn').onclick=()=>{if(!form.reportValidity())return;const fd=new FormData(form),a=actions.find(x=>x.value===fd.get('action'));if(!a)return;const detail=String(fd.get('detail')||'').trim();const delta=a.custom?Math.max(-100,Math.min(100,number(fd.get('customDelta')))):a.delta;if(delta===0){toast('Укажите ненулевое изменение благосклонности.','error');return;}const actual=changeFavor(s,delta,'deed',a.label,`${a.detail} Подтверждение: ${detail}`);saveDB();closeModal();renderAll();toast(`Благосклонность ${actual>0?'+':''}${fmt(actual)}. Текущее значение: ${fmt(s.favor)}/100.`);};
  }
  function accrueClerics(){const s=activeState();if(!s)return;const amount=annualClericIncome(s);if(amount<=0){toast('Годовой прирост равен нулю. Проверьте численность священников и дополнительные источники.','error');return;}s.clerics=number(s.clerics)+amount;addJournal(s.id,'income','Начислен годовой прирост Клирики',`Священники: ${Math.floor(s.priests/100)} · дополнительные источники: ${fmt(s.extraIncome)}.` ,amount,0);saveDB();renderAll();toast(`Начислено ${fmt(amount)} Клирики.`);}
  function showPrayerModal(){
    const s=activeState();if(!s){toast('Сначала выберите государство.','error');return;}
    const prayerKinds=[
      {id:'plain',name:'Обычная просьба или совет',cost:0,desc:'Обращение без гарантированного численного эффекта.'},
      {id:'thanks',name:'Благодарность',cost:0,desc:'Зафиксировать благодарность за уже полученную помощь.'},
      {id:'unity',name:'Корни согласия',cost:5,desc:'+5 к единству государства (не выше 100).'},
      {id:'income',name:'Монетный ручей',cost:10,desc:'+5% к годовому доходу на 3 игровых хода.'},
      {id:'harvest',name:'Щедрый сезон',cost:7,desc:'+10% к производству пищи выбранного региона на 3 игровых хода.'},
      {id:'loyalty',name:'Шёпот примирения',cost:8,desc:'+5 к лояльности крестьян выбранного региона.'},
      {id:'resource',name:'Просьба об необычной жиле',cost:5,desc:'Запрос на обнаружение необычного месторождения. Месторождение не появляется автоматически: решение и результат утверждает Владыка/вармастер.'},
      {id:'protection',name:'Просьба о защите',cost:0,desc:'Просьба о вмешательстве или совете; решение остаётся за Владыкой.'}
    ];
    const options=prayerKinds.map(x=>`<option value="${x.id}">${esc(x.name)} · ${x.cost?`${x.cost} Клирики`:'без платы'}</option>`).join('');
    const regions=(s.regions||[]).map(r=>`<option value="${esc(r.id)}">${esc(r.name)} · ${esc(r.terrain||'Регион')}</option>`).join('');
    const resources=['Необычное железо','Янтарная жила','Синий кристалл','Редкая соль','Глубинный уголь','Древесная смола','Неизвестный ресурс'];
    const body=`<div class="notice green">Молитвы доступны независимо от официальной религии. Некоторые просьбы дают ограниченные гражданские эффекты и требуют Клирику; необычные месторождения всегда ожидают решения Владыки/вармастера.</div>
      <form id="prayerForm" style="margin-top:14px"><div class="field-grid">
      <div class="field full"><label>Тип обращения</label><select name="type" id="prayerType">${options}</select></div>
      <div class="field full" id="prayerDescription"></div>
      <div class="field" id="prayerRegionField" hidden><label>Регион *</label><select name="regionId" id="prayerRegion"><option value="">Выберите регион</option>${regions}</select></div>
      <div class="field" id="prayerResourceField" hidden><label>Что искать *</label><select name="resourceType">${resources.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div>
      <div class="field full"><label>Текст обращения / обстоятельства *</label><textarea name="detail" required rows="4" placeholder="Опишите, чего просит государство и почему"></textarea></div>
      <div class="field full"><label>Материальный дар (необязательно)</label><input name="offering" maxlength="100" placeholder="Семена, плоды, травы, резьба по дереву…"></div>
      </div></form><div class="small-note" style="margin-top:10px">После отправки обращение попадёт в летопись государства и, при подключённой общей базе, в очередь Владыки. Потраченная Клирика не возвращается автоматически.</div>`;
    openModal('Вознести молитву',body,`<button class="btn ghost" data-modal-cancel>Отмена</button><button class="btn" id="savePrayerBtn">Отправить обращение</button>`);
    const form=$('#prayerForm'),typeEl=$('#prayerType');
    const update=()=>{const kind=prayerKinds.find(x=>x.id===typeEl.value);const hasRegion=['harvest','loyalty','resource'].includes(typeEl.value);$('#prayerRegionField').hidden=!hasRegion;$('#prayerRegion').required=hasRegion;$('#prayerResourceField').hidden=typeEl.value!=='resource';$('#prayerDescription').innerHTML=`<div class="notice"><strong>${esc(kind.desc)}</strong><br>Стоимость: ${kind.cost} Клирики · доступно: ${fmt(s.clerics)}</div>`;};
    typeEl.onchange=update;update();
    $('#savePrayerBtn').onclick=()=>{if(!form.reportValidity())return;const fd=new FormData(form),kind=prayerKinds.find(x=>x.id===fd.get('type')),cost=kind.cost,region=getRegion(s,fd.get('regionId')||'');if(cost>s.clerics){toast('Недостаточно Клирики.','error');return;}if(['harvest','loyalty','resource'].includes(kind.id)&&!region){toast('Выберите регион.','error');return;}
      let detail=String(fd.get('detail')||'').trim(),title=`Молитва: ${kind.name}`,delta=0;
      if(fd.get('offering'))detail+=` · Материальный дар: ${fd.get('offering')}`;
      s.clerics-=cost;
      if(kind.id==='unity'){const before=s.unity;s.unity=Math.min(100,number(s.unity)+5);delta=s.unity-before;detail+=` · Единство ${before} → ${s.unity} (+${delta}).`;}
      if(kind.id==='income'){s.civicEffects.push({id:uid(),name:'Монетный ручей',kind:'income',value:5,remainingTurns:3});detail+=' · Активирован бонус +5% к годовому доходу на 3 хода.';}
      if(kind.id==='harvest'){s.civicEffects.push({id:uid(),name:'Щедрый сезон',kind:'food',regionId:region.id,value:10,remainingTurns:3});detail+=` · Для региона ${region.name}: +10% пищи на 3 хода.`;}
      if(kind.id==='loyalty'){const before=number(region.peasantLoyalty??55);region.peasantLoyalty=Math.min(100,before+5);detail+=` · Лояльность крестьян региона ${region.name}: ${before} → ${region.peasantLoyalty}.`;}
      if(kind.id==='resource'){const request={id:uid(),kind:'unusual-resource',resourceType:fd.get('resourceType'),regionId:region.id,regionName:region.name,detail,status:'pending',createdAt:new Date().toISOString()};s.resourceRequests.push(request);title=`Запрос месторождения: ${request.resourceType}`;detail+=` · Запрошено месторождение «${request.resourceType}» в регионе «${region.name}». Статус: ожидает решения. ID запроса: ${request.id}.`;}
      addJournal(s.id,kind.id==='resource'?'resource-request':'prayer',title,detail,-cost,0);saveDB();closeModal();renderAll();toast(kind.id==='resource'?'Запрос отправлен. Он ожидает решения Владыки/вармастера.':'Молитва записана; гражданский эффект применён.');
    };
  }
  function showTemplesModal(s){
    const body=`<div class="notice">Отмечайте только реально построенные сооружения. Храм корней усиливает лояльность крестьян именно того региона, где он расположен.</div><div class="list" style="margin-top:14px">${[['chapel','Часовня леса','Посвящённое место для молитв и малых обрядов'],['root','Храм корней','+2 п.п. лояльности крестьян в выбранном регионе'],['abode','Обитель хранителей','Посвящение друидов и особые дары']].map(([key,name,desc])=>`<label class="list-row"><div class="list-row-main"><strong>${name}</strong><small>${desc}</small></div><input type="checkbox" data-temple="${key}" ${s.temples[key]?'checked':''}></label>`).join('')}</div><div class="field" style="margin-top:14px"><label>Регион Храма корней</label><select id="rootTempleRegion"><option value=">Не выбран</option>${regionOptions(s)}</select><div class="field-help">Если храм не построен, бонус лояльности не применяется.</div></div>`;
    openModal('Посвящённые сооружения',body,`<button class="btn" data-modal-cancel>Готово</button>`);
    $('#rootTempleRegion').value=s.rootTempleRegionId||'';
    $$('[data-temple]').forEach(el=>el.onchange=()=>updateTemple(s,el.dataset.temple,el.checked));
    $('#rootTempleRegion').onchange=()=>{s.rootTempleRegionId=$('#rootTempleRegion').value||null;saveDB();renderAll();toast('Регион Храма корней обновлён.');};
  }
  let mapFrameCreated=false;
  function renderMap(){
    const root=$('#view-map');if(mapFrameCreated)return;
    root.innerHTML=`<div class="section-head"><div><div class="section-kicker">ХРОНИКА ГОСУДАРСТВ</div><h2>Интерактивная карта мира</h2><p>Карта проекта встроена отдельно от системы покровительства. Можно перемещаться, масштабировать, включать слои и просматривать государства, ресурсы и интересные места.</p></div><a class="btn" href="https://serbakovboris56-cyber.github.io/LustDAY/" target="_blank" rel="noopener noreferrer">Открыть карту отдельно ↗</a></div>
      <div class="map-embed-card"><div class="map-embed-toolbar"><span><i class="status-dot"></i> Внешняя интерактивная карта проекта</span><span class="small-note">Для загрузки требуется подключение к интернету</span></div><iframe id="worldMapFrame" class="world-map-frame" src="https://serbakovboris56-cyber.github.io/LustDAY/" title="Интерактивная карта Хроника государств" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="fullscreen"></iframe><div class="map-embed-fallback"><span>Если карта не отображается внутри приложения, откройте её в отдельной вкладке.</span><a href="https://serbakovboris56-cyber.github.io/LustDAY/" target="_blank" rel="noopener noreferrer">Открыть карту ↗</a></div></div>
      <div class="notice" style="margin-top:12px">Карта загружается с GitHub Pages владельца проекта. Её содержимое и данные не копируются в систему Хозяина леса, поэтому обновления исходной карты будут отображаться автоматически. Если настройки браузера или самой страницы запретят встраивание, используйте кнопку открытия в отдельной вкладке.</div>`;
    mapFrameCreated=true;
  }

  async function renderMyResponses(){
    if(currentView!=='dashboard')return;const root=$('#view-dashboard');if(!root)return;
    let box=$('#myRemoteResponses');if(!box){box=document.createElement('section');box.id='myRemoteResponses';box.className='card';box.style.marginTop='14px';root.append(box);}
    const backend=window.LOTWBackend;
    if(!backend?.isConfigured?.()){box.innerHTML='<div class="card-title">Ответы Владыки</div><div class="small-note">Общая база недоступна. Подключитесь к Supabase, чтобы отправлять обращения и получать ответы Владыки.</div>';return;}
    box.innerHTML='<div class="card-title">Ответы Владыки</div><div class="small-note">Загружаем ответы на обращения этого браузера…</div>';
    const result=await backend.myResponses();
    if(!$('#myRemoteResponses'))return;
    if(result.error){box.innerHTML=`<div class="card-title">Ответы Владыки</div><div class="small-note">Не удалось загрузить ответы: ${esc(result.error)}</div>`;return;}
    const rows=result.rows||[];
    rows.forEach(r=>{const match=String(r.details||'').match(/ID запроса:\s*([A-Za-z0-9-]+)/);if(match){const requestId=match[1];for(const state of db.states){const req=(state.resourceRequests||[]).find(x=>x.id===requestId);if(req){req.status=r.status;req.adminReply=r.admin_reply;req.respondedAt=r.replied_at;}}}});
    if(rows.length)saveDB();
    box.innerHTML=`<div class="card-title">Ответы Владыки <button class="btn small ghost" id="refreshMyResponses">Обновить</button></div>${rows.length?`<div class="list" style="margin-top:10px">${rows.map(r=>`<article class="list-row" style="align-items:flex-start"><div class="list-row-main"><strong>${esc(r.title)}</strong><small>${esc(r.state_name)} · ${new Date(r.replied_at||r.created_at).toLocaleString('ru-RU')} · ${esc(r.status)}</small><p style="color:#dfd4af;font-size:11px;line-height:1.6;margin:8px 0 0">${esc(r.admin_reply)}</p></div></article>`).join('')}</div>`:'<div class="empty-inline">Пока нет ответов на ваши обращения.</div>'}`;
    $('#refreshMyResponses')?.addEventListener('click',renderMyResponses);
  }

  let adminInboxLoading=false;
  async function loadAdminInbox({force=false}={}){
    const target=$('#adminInboxContent');if(!target||adminInboxLoading)return;
    // A periodic refresh must never destroy a draft or an input currently being edited.
    const activeForm=target.querySelector('form[data-admin-reply-form][data-dirty="true"]');
    const focused=target.contains(document.activeElement);
    if(!force&&(activeForm||focused))return;
    adminInboxLoading=true;
    try{
      const rows=await window.LOTWBackend.adminInbox();
      if(!$('#adminInboxContent'))return;
      // The user may have started typing while the request was in flight.
      if(target.querySelector('form[data-admin-reply-form][data-dirty="true"]')||target.contains(document.activeElement))return;
      const drafts=new Map([...target.querySelectorAll('form[data-admin-reply-form]')].map(f=>[f.dataset.id,{
        reply:f.elements.reply?.value||'',status:f.elements.status?.value||'answered',dirty:f.dataset.dirty==='true'
      }]));
      target.innerHTML=rows.length?`<div class="list">${rows.map(r=>`<article class="card admin-event-card"><div class="state-head"><div><div class="card-title">${esc(r.player_name||'Игрок без имени')} · ${esc(r.state_name||'Без государства')} · ID ${esc(String(r.actor_id||'').slice(0,8))}</div><h3 style="font-family:'Cormorant Garamond';font-size:21px;color:#ecdfb9;margin:6px 0">${esc(r.title)}</h3></div><span class="pill ${r.status==='new'?'gold':r.status==='rejected'?'red':'gray'}">${esc(r.status)}</span></div><div class="small-note">${new Date(r.created_at).toLocaleString('ru-RU')} · ${esc(r.event_type)} · Клирика ${fmt(r.cleric_delta)} · Благосклонность ${fmt(r.favor_delta)}</div><p style="font-size:11px;line-height:1.65;color:#c3cbb9;white-space:pre-wrap;margin:10px 0">${esc(r.details||'—')}</p>${r.admin_reply?`<div class="notice green"><b>Предыдущий ответ:</b><br>${esc(r.admin_reply)}</div>`:''}<form data-admin-reply-form data-id="${esc(r.id)}" style="margin-top:12px"><div class="field-grid"><div class="field full"><label>Ответ игроку</label><textarea name="reply" rows="3" required placeholder="Решение Владыки, указания или уточняющий вопрос">${esc(r.admin_reply||'')}</textarea></div><div class="field"><label>Статус обращения</label><select name="status"><option value="answered" ${r.status==='answered'?'selected':''}>Отвечено</option><option value="approved" ${r.status==='approved'?'selected':''}>Одобрено</option><option value="rejected" ${r.status==='rejected'?'selected':''}>Отклонено</option><option value="needs-info" ${r.status==='needs-info'?'selected':''}>Нужны сведения</option></select></div><div class="field" style="align-self:end"><button class="btn small" type="submit">Отправить ответ</button></div></div></form></article>`).join('')}</div>`:'<div class="empty-state"><h3>Очередь пуста</h3><p>Когда игроки отправят молитвы, просьбы, заявки на ресурсы или совершат другие действия, они появятся здесь.</p></div>';
      // Restore drafts that were not submitted, even after a manual refresh.
      for(const [id,draft] of drafts){
        const form=target.querySelector(`form[data-admin-reply-form][data-id="${CSS.escape(id)}"]`);
        if(form&&draft.dirty){form.elements.reply.value=draft.reply;form.elements.status.value=draft.status;form.dataset.dirty='true';}
      }
    }catch(e){target.innerHTML=`<div class="notice red">Не удалось загрузить очередь: ${esc(e.message||e)}. Проверьте SQL/RLS и роль администратора.</div>`;}
    finally{adminInboxLoading=false;}
  }

  async function renderAdmin(){
    const root=$('#view-admin');if(!root)return;if(currentView!=='admin'){root.innerHTML='';return;}
    const backend=window.LOTWBackend;
    root.innerHTML=`<div class="section-head"><div><div class="section-kicker">ЗАКРЫТЫЙ ИНСТРУМЕНТ ВЛАДЫКИ</div><h2>Режим администратора</h2><p>Общая очередь молитв и действий игроков. Только учётная запись с назначенной ролью администратора может читать и отвечать.</p></div></div>`;
    if(!backend?.isConfigured?.()){
      root.innerHTML+=`<div class="notice">Общая база ещё не подключена. Заполните <b>backend-config.js</b> публичным URL и anon/publishable key Supabase, выполните <b>supabase/schema.sql</b> и назначьте себе роль owner. Пароль администратора в исходники не записывается.</div><div class="card" style="margin-top:14px"><h3>Порядок настройки</h3><ol style="font-size:11px;color:#bbc6b4;line-height:1.8"><li>Создать проект Supabase и включить Anonymous Sign-Ins и Email/Password.</li><li>Выполнить SQL-схему из архива.</li><li>Создать пользователя администратора и назначить его UUID в lotw_admins.</li><li>Вписать Project URL и публичный anon key в backend-config.js.</li></ol><p class="small-note">Подробная инструкция находится в SUPABASE_SETUP_RU.md.</p></div>`;return;
    }
    const session=await backend.getAdminSession();
    if(!session.loggedIn){
      root.innerHTML+=`<div class="card" style="max-width:520px"><h3 style="font-family:'Cormorant Garamond';font-size:24px;color:#ebdfbd">Вход создателя / администратора</h3><p class="small-note">Используйте email и пароль пользователя Supabase, которому выдана роль admin или owner.</p><form id="adminLoginForm" style="margin-top:14px"><div class="field-grid"><div class="field full"><label>Email</label><input name="email" type="email" autocomplete="username" required></div><div class="field full"><label>Пароль</label><input name="password" type="password" autocomplete="current-password" required></div><div class="field full"><button class="btn" type="submit">Войти в режим администратора</button></div></div></form><div id="adminLoginError" class="small-note" style="margin-top:10px"></div></div>`;return;
    }
    root.innerHTML+=`<div class="grid kpis" style="margin-bottom:14px"><div class="card"><div class="card-title">Доступ</div><div class="kpi-value" style="font-size:25px">${esc(session.role)}</div><div class="kpi-note">${esc(session.email)}</div></div><div class="card"><div class="card-title">Общая очередь</div><div class="kpi-value">↻</div><div class="kpi-note">Молитвы, заявки, контракты и прочие действия</div></div></div><div class="section-head"><div><h2 style="font-size:25px">Обращения и действия игроков</h2><p>Ответ отправляется в личный блок «Ответы Владыки» того браузера, из которого пришло обращение.</p></div><div class="card-actions"><button class="btn small secondary" data-action="admin-refresh">Обновить</button><button class="btn small ghost" data-action="admin-logout">Выйти</button></div></div><div id="adminInboxContent"></div>`;
    await loadAdminInbox();
  }

  function renderRules(){
    const root=$('#view-rules');root.innerHTML=`<div class="section-head"><div><div class="section-kicker">СПРАВОЧНИК ВЛАДЫКИ</div><h2>Правила и догматы</h2><p>Краткая памятка для игроков и вармастера. Значения приложения не заменяют решения вармастера и базовые правила проекта.</p></div></div>
      <div class="grid two"><div class="card"><div class="tagline">«Не верьте богам. Ни одному. Даже мне».</div><div class="rule-block"><h3>О вере</h3><p>Молитвы Владыке доступны без смены государственной религии. Посвящённые храмы открывают дополнительные возможности. Клирика подпитывает божество, но не покупает благосклонность.</p></div><div class="rule-block"><h3>О свободе</h3><p>Владыка предоставляет возможности, но не выбирает путь за государство. Свобода не освобождает от последствий.</p></div><div class="rule-block"><h3>О жизни</h3><p>Он признаёт жизнь независимо от происхождения, внешности и природы. Обычное использование ресурсов не является нарушением; бессмысленное уничтожение жизни — является.</p></div><div class="rule-block"><h3>О договорах</h3><p>Контракт связывает обе стороны. За исполнение полагается благосклонность, за нарушение — отзыв покровительства и санкции.</p></div></div>
      <div class="card"><div class="rule-block"><h3>Шкала благосклонности</h3><ul><li>0–19 — Чужак</li><li>20–39 — Замеченный</li><li>40–59 — Признанный</li><li>60–79 — Доверенный</li><li>80–100 — Избранный</li></ul></div><div class="rule-block"><h3>Ограничения</h3><ul><li>Нет воскрешения и бессмертия.</li><li>Нет создания жизни из ничего.</li><li>Нет бесплатных армий и ресурсов.</li><li>Нет прямых бонусов торговле и ремеслу.</li><li>Нет покровительства школам крови, камня, пламени, путей, света и тени, духовным школам и некромантии.</li></ul></div><div class="rule-block"><h3>Важно для ведущего</h3><p>Численные эффекты — предлагаемые настройки регламента. Применение благословения фиксируется в приложении, но фактическое действие в мире подтверждает вармастер.</p></div></div></div>
      <div class="card" style="margin-top:14px"><div class="card-title">Справочник доступных школ</div><div class="table-wrap" style="margin-top:12px"><table class="data-table"><thead><tr><th>Школа</th><th>Покровительство</th><th>Комментарий</th></tr></thead><tbody>${[['Друидизм','Прямое','Основная школа Владыки'],['Кровь','Нет','Можно изучать самостоятельно'],['Камень','Нет','Можно изучать самостоятельно'],['Пламя','Нет','Можно изучать самостоятельно'],['Пути','Нет','Можно изучать самостоятельно'],['Свет и тень','Нет','Можно изучать самостоятельно'],['Сны, мысль, воля','Нет','Духовная сфера без покровительства'],['Души, некромантия, печати','Нет','Не предоставляются божественные усиления']].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function renderAll(){renderHeader();renderDashboard();renderMap();renderStates();renderWorship();renderContracts();renderDruids();renderJournal();renderAdmin();renderRules();renderMyResponses();if(window.MilitaryAdvisor){window.MilitaryAdvisor.render();window.MilitaryAdvisor.renderRaceCatalog($('#view-races'));}$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${currentView}`));$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));}
  function navigate(view){if(!$('#view-'+view))return;currentView=view;renderAll();$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});}
  function exportBackup(){
    let snapshot={...JSON.parse(JSON.stringify(db)),militaryAdvisor:window.MilitaryAdvisor?.exportData?.()||null};
    if(!sharedAppReady){
      try{const cached=JSON.parse(localStorage.getItem(BACKUP_CACHE_KEY)||'null');if(cached?.states&&Array.isArray(cached.states))snapshot=cached;}catch(error){console.warn('[LOTW] Backup cache could not be read:',error);}
    }
    snapshot.exportedAt=new Date().toISOString();
    const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=`Хозяин_леса_резервная_копия_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
    toast(sharedAppReady?'Резервная копия общего мира подготовлена.':'Подготовлена последняя локальная резервная копия; проверьте её дату.','ok');
  }
  function importBackup(file){const reader=new FileReader();reader.onload=()=>{try{const incoming=JSON.parse(reader.result);if(!incoming||!Array.isArray(incoming.states)||!Array.isArray(incoming.journal))throw new Error('Формат файла не распознан.');if(!confirm(`Импортировать ${incoming.states.length} государств? Текущие данные будут заменены.`))return;incoming.states.forEach(s=>{normalizeStateRecord(s);delete s.rosterId;s.race||='';s.population??=null;s.feudals??=null;s.temples ||= {chapel:false,root:false,abode:false};s.rootTempleRegionId ||= null;s.regions ||= [];s.regions.forEach(r=>{r.crises ||= {famine:false,plague:false,devastation:false,wildBeasts:false};r.foodProduction ??= 0;r.populationGrowth ??= 1;r.peasantLoyalty ??= 55;});s.contracts ||= [];s.druids ||= [];s.effects ||= [];s.druids.forEach(d=>{d.gifts ||= [];d.giftNames ||= [];});});db={version:1,activeStateId:incoming.activeStateId||incoming.states[0]?.id||null,states:incoming.states,journal:incoming.journal,createdAt:incoming.createdAt||new Date().toISOString()};if(incoming.militaryAdvisor&&window.MilitaryAdvisor)window.MilitaryAdvisor.importData(incoming.militaryAdvisor);saveDB();savePlayerProfile();renderAll();toast('Резервная копия отправлена в общий мир.');}catch(e){toast('Не удалось прочитать резервную копию: '+e.message,'error');}};reader.readAsText(file);}

  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-view],[data-nav]');if(nav){navigate(nav.dataset.view||nav.dataset.nav);return;}
    const filter=e.target.closest('[data-filter]');if(filter){worshipFilter=filter.dataset.filter;renderWorship();return;}
    const cancel=e.target.closest('[data-modal-cancel]');if(cancel){closeModal();return;}
    const a=e.target.closest('[data-action]');if(!a)return;const action=a.dataset.action,id=a.dataset.id,s=activeState();
    switch(action){
      case 'new-state':showModalStateForm();break;
      case 'edit-state':{const st=id?db.states.find(x=>x.id===id):s;if(st)showModalStateForm(st);break;}
      case 'select-state':setActiveState(id);toast('Выбрано государство.');break;
      case 'add-region':{const st=db.states.find(x=>x.id===id)||s;if(st)showRegionForm(st);break;}
      case 'edit-region':{const st=db.states.find(x=>x.id===a.dataset.state)||s;const rg=st?.regions.find(x=>x.id===id);if(st&&rg)showRegionForm(st,rg);break;}
      case 'delete-region':{const st=db.states.find(x=>x.id===a.dataset.state)||s;const rg=st?.regions.find(x=>x.id===id);if(st&&rg&&confirm(`Удалить регион «${rg.name}»? Связанные благословения останутся в журнале.`)){if(st.rootTempleRegionId===id)st.rootTempleRegionId=null;st.regions=st.regions.filter(x=>x.id!==id);st.effects.forEach(e=>{if(e.regionId===id&&e.status==='active')e.status='completed';});addJournal(st.id,'region',`Удалён регион: ${rg.name}`,'Регион удалён из реестра.');saveDB();renderAll();}break;}
      case 'temples':{const st=db.states.find(x=>x.id===id)||s;if(st)showTemplesModal(st);break;}
      case 'delete-state':{const st=db.states.find(x=>x.id===id);if(st&&confirm(`Удалить государство «${st.name}» и его записи?`)){db.states=db.states.filter(x=>x.id!==id);db.journal=db.journal.filter(x=>x.stateId!==id);db.activeStateId=db.states[0]?.id||null;saveDB();renderAll();toast('Государство удалено.');}break;}
      case 'cast':{const b=getAction(id);if(b)showCastModal(b);break;}
      case 'quick-blessing':showQuickBlessingModal();break;
      case 'repeat-blessing':repeatLastBlessing();break;
      case 'contract-start':startContract(id);break;
      case 'contract-fulfill':finishContract(id,false);break;
      case 'contract-breach':finishContract(id,true);break;
      case 'add-druid':if(s)showDruidForm(s);else toast('Сначала добавьте государство.','error');break;
      case 'druid-edit':{const d=s?.druids.find(x=>x.id===id);if(d)showDruidForm(s,d);break;}
      case 'druid-delete':{const d=s?.druids.find(x=>x.id===id);if(d&&confirm(`Удалить запись друида «${d.name}»?`)){s.druids=s.druids.filter(x=>x.id!==id);addJournal(s.id,'druid',`Удалён друид: ${d.name}`,'Запись удалена.');saveDB();renderAll();}break;}
      case 'druid-gift':{const d=s?.druids.find(x=>x.id===id);if(d){preselectDruidId=d.id;navigate('worship');worshipFilter='Дары друидам';renderWorship();toast(`Выберите персональный дар для ${d.name}.`);}break;}
      case 'finish-effect':finishEffect(id);break;
      case 'accrue-clerics':accrueClerics();break;
      case 'ledger':showLedgerModal();break;
      case 'prayer':showPrayerModal();break;
      case 'favor-action':showFavorActionModal();break;
      case 'advance-state-turn':advanceStateTurn();break;
      case 'admin-refresh':loadAdminInbox({force:true});break;
      case 'admin-logout':window.LOTWBackend?.adminLogout?.().then(()=>{renderAll();toast('Вы вышли из режима администратора.');}).catch(err=>toast(err.message,'error'));break;
    }
  });
  $('#globalStateSelect').addEventListener('change',e=>setActiveState(e.target.value));
  $('#playerNameInput').addEventListener('change',e=>{db.playerName=String(e.target.value||'').trim().slice(0,48);window.LOTW_PLAYER_NAME=db.playerName;savePlayerProfile();toast(db.playerName?`Имя игрока сохранено: ${db.playerName}`:'Имя игрока очищено.');});
  // Capture admin form submissions before the browser's default submit/navigation action.
  document.addEventListener('submit',async e=>{
    if(e.target.id==='adminLoginForm'){
      e.preventDefault();e.stopPropagation();
      const f=e.target,fd=new FormData(f),err=$('#adminLoginError'),button=f.querySelector('button[type="submit"]');
      if(button)button.disabled=true;
      try{await window.LOTWBackend.loginAdmin(fd.get('email'),fd.get('password'));renderAll();toast('Режим администратора открыт.');}
      catch(error){if(err)err.textContent=error.message||String(error);}
      finally{if(button)button.disabled=false;}
      return;
    }
    if(e.target.matches('[data-admin-reply-form]')){
      e.preventDefault();e.stopPropagation();
      const f=e.target,fd=new FormData(f),button=f.querySelector('button[type="submit"]');
      if(button)button.disabled=true;
      f.dataset.saving='true';
      try{
        await window.LOTWBackend.replyToActivity(f.dataset.id,fd.get('reply'),fd.get('status'));
        f.dataset.dirty='false';
        toast('Ответ отправлен игроку.');
        await loadAdminInbox({force:true});
      }catch(error){toast(error.message||String(error),'error');}
      finally{if(button&&button.isConnected)button.disabled=false;delete f.dataset.saving;}
      return;
    }
  },true);
  document.addEventListener('input',e=>{const f=e.target.closest?.('form[data-admin-reply-form]');if(f)f.dataset.dirty='true';});
  document.addEventListener('change',e=>{const f=e.target.closest?.('form[data-admin-reply-form]');if(f)f.dataset.dirty='true';});
  $('#modalClose').onclick=closeModal;
  $('#exportBtn').onclick=exportBackup;$('#importBtn').onclick=()=>$('#importFile').click();$('#importFile').onchange=e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value='';};
  $('#mobileMenu').onclick=()=>$('#sidebar').classList.toggle('open');
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){const form=$('#modalBody form');if(form&&form.querySelector('input,select,textarea'))return;closeModal();}});

  // Keep the owner's shared activity inbox fresh while the admin view is open.
  setInterval(async()=>{
    if(currentView!=='admin'||!$('#adminInboxContent')||!window.LOTWBackend?.getAdminSession)return;
    try{const session=await window.LOTWBackend.getAdminSession();if(session.loggedIn)await loadAdminInbox();}
    catch(error){console.warn('[LOTW] Admin inbox refresh:',error?.message||error);}
  },15000);

  if(typeof navigator!=='undefined'&&'serviceWorker' in navigator&&typeof location!=='undefined'&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){navigator.serviceWorker.register('./sw.js').catch(()=>{});}

  // The cloud is the sole active source of game state. localStorage is read only
  // by the one-time migration prompt and is never written by normal gameplay.
  bootstrapSharedWorld();
})();
