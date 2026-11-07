(() => {
'use strict';
const cfg = window.WALL_CONFIG;
if (!cfg) throw new Error('Не завантажено assets/config.js');
const $ = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const TZ = cfg.timezone || 'Europe/Kyiv';
const params = new URLSearchParams(location.search);
const demo = ['alarm','clear','yellow','silence'].includes(params.get('preview')) ? params.get('preview') : '';
const silenceDemoStartedMs = Date.now();
const fmtClock = new Intl.DateTimeFormat('uk-UA',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:TZ});
const fmtDate = new Intl.DateTimeFormat('uk-UA',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:TZ});
const fmtWeekdayLong = new Intl.DateTimeFormat('uk-UA',{weekday:'long',timeZone:TZ});
const fmtWeekdayShort = new Intl.DateTimeFormat('uk-UA',{weekday:'short',timeZone:TZ});
const fmtParts = new Intl.DateTimeFormat('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:TZ});
const fmtDateParts = new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:TZ});
const fmtMemorialParts = new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:TZ});
const oblastAlias = [
 ['lvivska',['львів','lviv','lwow']],['vinnytska',['вінниц','vinnyts','vinnits']],['volynska',['волин','volyn']],
 ['dnipropetrovska',['дніпропетров','dnipropetrov']],['donetska',['донецьк','donetsk']],['zhytomyrska',['житомир','zhytomyr']],
 ['zakarpatska',['закарпат','zakarpat','transcarpath']],['zaporizka',['запоріз','zaporiz','zaporoz']],
 ['ivano-frankivska',['іванофранків','ivanofrank']],['kirovohradska',['кіровоград','kirovohrad','kirovograd']],
 ['kyivska',['київська','kyivska','kievska','kyivoblast','kievoblast']],['luhanska',['луганськ','luhansk','lugansk']],
 ['mykolaivska',['миколаїв','mykolaiv','mykolayiv']],['odeska',['одеськ','odes','odess']],['poltavska',['полтав','poltav']],
 ['rivnenska',['рівнен','rivn','rovno']],['sumska',['сумськ','sums','sumy']],['ternopilska',['тернопіл','ternopil']],
 ['kharkivska',['харків','kharkiv','kharkov']],['khersonska',['херсон','kherson']],['khmelnytska',['хмельниц','khmelnyts','khmelnits']],
 ['cherkaska',['черкас','cherkas']],['chernihivska',['чернігів','chernihiv']],['chernivetska',['чернівц','chernivets']],
 ['crimea',['крим','крым','crimea','krym']],['sevastopol',['севастопол','sevastopol']],['kyiv',['містокиїв','cityofkyiv','cityofkiev','київмісто','міськрадакиєва']]
];
let featuresOblast=[], featuresDistrict=[], fallbackOutline=[];
let geoLoaded=false, geoDistrictsLoaded=false;
let regionStatus=new Map(), districtStatus=new Map();
let lastGood=0, pollBusy=false, activeScheduleKey='';
let threatState='unknown', threatStartMs=0, threatEpisodeId='', threatObservedMs=0;
let timelineSegments=[], timelinePoints=[], activeSchedule=null;
let birthdayPeople=[], birthdayDataReady=false, birthdayRenderKey='';
const birthdayPageSize=4, birthdayPageDurationMs=20000, birthdayPageEpoch=Date.now();
let memorialSuppressedDate='';
const setText=(id,value)=>{const el=$(id);if(el)el.textContent=String(value);};
function S(tag,attrs={}){const el=document.createElementNS(svgNS,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);return el;}
function normalized(value){return String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[ʼ'’`\u2019\s._–—\-]/g,'').replace(/район|раион|raion|rayon|district/gu,'');}
function canonical(value){const n=normalized(value);if(n==='київ'||n==='kyiv'||n==='kiev')return 'kyiv';for(const [key,terms] of oblastAlias){if(terms.some(term=>n.includes(normalized(term))))return key;}return '';}
function coord(lon,lat){return [44+(lon-21.5)*41.8,32+(52.8-lat)*54.9];}
function pathFor(geometry){
 if(!geometry?.coordinates)return '';
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
 const chunks=[];
 for(const polygon of polygons){for(const ring of polygon){let path='';for(const pair of ring){if(!Array.isArray(pair)||pair.length<2)continue;const [x,y]=coord(Number(pair[0]),Number(pair[1]));if(!Number.isFinite(x)||!Number.isFinite(y))continue;path+=(path?'L':'M')+x.toFixed(2)+','+y.toFixed(2);}if(path)chunks.push(path+'Z');}}
 return chunks.join(' ');
}
function descriptors(feature){const props=feature.properties||{};return [...new Set(Object.values(props).filter(v=>typeof v==='string'&&v.length<140))];}
function bestName(feature){const p=feature.properties||{};return p.name||p.NAME_2||p.NAME_1||p.name_uk||p.shapeName||p.NAME||p.region||p.rayon||'Територія';}
function oblastFor(feature){
 const props=feature.properties||{};
 const order=['region','oblast','oblast_name','oblastName','name_1','NAME_1','ADMIN1','ADM1_UA','parent_name','parent','name','NAME','shapeName'];
 for(const key of order){if(typeof props[key]==='string'){const found=canonical(props[key]);if(found)return found;}}
 for(const value of descriptors(feature)){const found=canonical(value);if(found)return found;}
 return '';
}
function outerRings(feature){const g=feature?.geometry;if(!g)return[];if(g.type==='Polygon')return[g.coordinates?.[0]];if(g.type==='MultiPolygon')return g.coordinates.map(p=>p?.[0]);return[];}
function pointInRing(point,ring){if(!Array.isArray(ring))return false;let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(!a||!b)continue;const hit=((a[1]>point[1])!==(b[1]>point[1]))&&(point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]);if(hit)inside=!inside;}return inside;}
const parentRegionCache=new WeakMap();
function regionFromShape(feature){
 if(parentRegionCache.has(feature))return parentRegionCache.get(feature);
 let result='';const outer=outerRings(feature).sort((a,b)=>(b?.length||0)-(a?.length||0))[0];
 if(outer?.length){let lon=0,lat=0;for(const xy of outer){lon+=xy[0];lat+=xy[1];}const sample=[lon/outer.length,lat/outer.length];for(const oblast of featuresOblast){if(outerRings(oblast).some(ring=>pointInRing(sample,ring))){result=oblastFor(oblast);if(result)break;}}}
 parentRegionCache.set(feature,result);return result;
}
// ТІЛЬКИ ДВА перейменовані райони. Інші назви обробляються так само, як у V6.
function targetedDistrictKey(value) {
  const text = normalized(value);
  if (/(?:червоноград|шептицьк|chervonohrad|chervonograd|sheptytsk|sheptyts)/u.test(text))
    return 'fixed:sheptytskyi';
  if (/(?:сєвєродон|сєверодон|северодон|сіверськодон|sievierodon|sieverodon|severodon|siverskodon|siverodon)/u.test(text))
    return 'fixed:siverskodonetskyi';
  return '';
}
function nameKeys(value) {
    const n = normalized(value);
    if (!n) return [];
    const special = targetedDistrictKey(value);
    // Не міняємо стару нормалізацію для решти районів.
    if (special) return [special];
    const keys = [n];
    const stem = n.replace(
        /(ський|цький|зький|ska|skyi|skii|ski|skaya)$/u,
        ''
    );
    if (stem.length >= 4) keys.push(stem);
    return keys;
}
function districtMatches(feature){
 const featureKeys=new Set(descriptors(feature).flatMap(nameKeys));
 for(const entry of districtStatus.values()){
   for(const alias of entry.aliases){for(const key of nameKeys(alias)){if(key.length>=4&&featureKeys.has(key))return entry;}}
 }
 return null;
}
// Окреме постійне візуальне позначення Криму. НЕ є сигналом від API.
function isCrimeaRegion(region) { return region === 'crimea' || region === 'sevastopol'; }
function isCrimeaDistrict(feature, region) {
  if (isCrimeaRegion(region)) return true;
  // Перекопський район може мати порожню/хибну прив'язку до області у GeoJSON.
  // Стосується тільки геометрії Криму; решта районів не змінюється.
  if (descriptors(feature).some(name => /(?:перекоп|perekop)/iu.test(name))) return true;
  // Для районів інших областей з підтвердженою прив’язкою нічого не перераховуємо.
  if (region && region !== 'khersonska') return false;
  const crimeaShapes = featuresOblast.filter(shape => isCrimeaRegion(oblastFor(shape)));
  if (!crimeaShapes.length) return false;
  const ring = outerRings(feature).sort((a,b)=>(b?.length||0)-(a?.length||0))[0];
  if (!Array.isArray(ring) || ring.length < 4) return false;
  // Швидкий географічний фільтр, щоб не проходити контури всієї України.
  if (!ring.some(p => Array.isArray(p) && p[0] >= 32.2 && p[0] <= 37.0 && p[1] >= 44.0 && p[1] <= 46.55)) return false;
  // Вибірка вершин із геометрії району: більшість території має лежати в Криму.
  // Перевірка застосовується лише до статичного забарвлення, не до API-матчингу.
  const step = Math.max(1, Math.floor((ring.length - 1) / 45));
  let total = 0, inside = 0;
  for (let i = 0; i < ring.length - 1; i += step) {
    const point = ring[i];
    if (!Array.isArray(point) || point.length < 2) continue;
    total++;
    if (crimeaShapes.some(shape => outerRings(shape).some(outer => pointInRing(point, outer)))) inside++;
  }
  return total >= 3 && inside / total > 0.60;
}
function districtDisplayName(feature) {
  const name=bestName(feature), key=targetedDistrictKey(name);
  if(key==='fixed:sheptytskyi') return 'Шептицький район';
  if(key==='fixed:siverskodonetskyi') return 'Сіверськодонецький район';
  return name;
}
function pin(){const [x,y]=coord(cfg.lon,cfg.lat);for(const id of ['pin-halo','pin-main','pin-core']){const el=$(id);if(el){el.setAttribute('cx',x);el.setAttribute('cy',y);}}}
function drawMap(){
 const oblastLayer=$('oblasts-layer'),districtLayer=$('districts-layer'),bordersLayer=$('borders-layer');
 oblastLayer.replaceChildren();districtLayer.replaceChildren();bordersLayer.replaceChildren();
 const oblastFeatures=featuresOblast.length?featuresOblast:fallbackOutline;
 for(const feature of oblastFeatures){if(!feature?.geometry)continue;const slug=oblastFor(feature);const crimea=isCrimeaRegion(slug);const level=crimea?'red':regionStatus.get(slug)||'';const path=S('path',{d:pathFor(feature.geometry),class:'map-oblast '+level});const title=S('title');title.textContent=bestName(feature)+' · '+(crimea?'постійне умовне забарвлення Криму (не сигнал API)':level==='red'?'червоний рівень':level==='yellow'?'жовтий рівень':'активну тривогу не зафіксовано');path.append(title);oblastLayer.append(path);}
 if(featuresOblast.length){for(const feature of featuresOblast){if(!feature?.geometry)continue;const border=S('path',{d:pathFor(feature.geometry),class:'map-border'});bordersLayer.append(border);}}
 let matched=0;
 for(const feature of featuresDistrict){if(!feature?.geometry)continue;const region=oblastFor(feature)||regionFromShape(feature);const match=districtMatches(feature);const regional=regionStatus.get(region)||'';
   // Як у V6; додано тільки статичне червоне забарвлення Криму.
   const crimea=isCrimeaDistrict(feature,region);
   const level=(crimea||regional==='red'||match?.level==='red')?'red':(regional==='yellow'||match?.level==='yellow')?'yellow':'';
   if(match)matched++;
   const path=S('path',{d:pathFor(feature.geometry),class:'map-district '+level});const title=S('title');title.textContent=districtDisplayName(feature)+' · '+(crimea?'постійне умовне забарвлення Криму (не сигнал API)':level==='red'?'червоний рівень':level==='yellow'?'жовтий рівень':'активну тривогу не зафіксовано');path.append(title);districtLayer.append(path);
 }
 pin();
 const message=!geoLoaded?'Не вдалося завантажити межі областей.':!geoDistrictsLoaded?'Межі районів недоступні — перевірте доступ до геоданих.':'';
 setText('map-message',message);
 if(message){$('map-message').style.display='block';}else{$('map-message').style.display='none';}
 if(geoDistrictsLoaded&&regionStatus.size+districtStatus.size>0)setText('map-stats',`АКТИВНІ РІВНІ: ${regionStatus.size} ОБЛ. / ${districtStatus.size} РАЙОНІВ · ЗІСТАВЛЕНО ${matched}`);
}
async function fetchJson(url,timeoutMs=20000,cache='no-store'){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(url,{method:'GET',mode:'cors',cache,signal:controller.signal,headers:{'Accept':'application/json'}});
  if(!response.ok)throw new Error('HTTP '+response.status);
  return await response.json();
 }finally{clearTimeout(timer);}
}
async function readGeoJson(urls,minCount){
 for(const url of urls){
  try{
   const json=await fetchJson(url,35000,'force-cache');
   if(Array.isArray(json.features)&&json.features.length>=minCount)return json.features;
  }catch(_){/* спробувати наступне джерело */}
 }
 return null;
}
async function loadGeometry(){
 try{const outline=await fetchJson('assets/ukraine-outline.json',12000,'force-cache');fallbackOutline=Array.isArray(outline.features)?outline.features:[];}catch(_){fallbackOutline=[];}
 const geometry=cfg.api?.geometry||{};
 const [oblasts,districts]=await Promise.all([
  readGeoJson(['assets/oblasts.geojson',...(geometry.oblasts||[])],20),
  readGeoJson(['assets/districts.geojson',...(geometry.districts||[])],75)
 ]);
 featuresOblast=oblasts||[];featuresDistrict=districts||[];
 geoLoaded=featuresOblast.length>=20;geoDistrictsLoaded=featuresDistrict.length>=75;
 drawMap();
}
async function requestAlerts(timeoutMs=18000){
 const urls=[cfg.api.alertsUrl,cfg.api.alertsFallbackUrl].filter(Boolean);
 let lastError=null;
 for(const url of urls){
  try{
   const data=await fetchJson(url,timeoutMs,'no-store');
   if(!Array.isArray(data?.alerts))throw new Error('Некоректна відповідь API тривог');
   return {ok:true,data,fetched_at:Math.floor(Date.now()/1000),age_seconds:0,stale:false};
  }catch(error){lastError=error;}
 }
 throw lastError||new Error('API тривог недоступне');
}
async function requestWeather(timeoutMs=18000){
 const query=new URLSearchParams({
  latitude:String(cfg.lat),longitude:String(cfg.lon),timezone:TZ,forecast_days:'5',
  current:'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
  daily:'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset'
 });
 return fetchJson(cfg.api.weatherUrl+'?'+query.toString(),timeoutMs,'no-store');
}
function connection(ok,label){setText('connection-label',label);$('connection-light').className='status-light '+(ok?'connected':'failed');}
// Час початку тривоги з API (за наявності); інакше — час її першого виявлення.
function parseStartedAt(value){
 if(value===null||value===undefined||value==='')return 0;
 const n=typeof value==='number'?value:Number(value);
 let date=Number.isFinite(n)&&n>0?(n<1e12?n*1000:n):Date.parse(String(value));
 return Number.isFinite(date)&&date>0&&date<Date.now()+300000?date:0;
}
function findThreatStart(state,local,global){
 if(state!=='alarm'&&state!=='yellow')return 0;
 const want=state==='yellow'?'yellow':'red';const items=[];
 if(fresh(local)&&local.data){
  const localData=local.data;
  if(localData.active&&(localData.level===want||(!localData.level&&want==='red')))items.push(localData);
  if(Array.isArray(localData.districts_active))items.push(...localData.districts_active.filter(a=>locallyRelevant(a)&&a.level===want));
 }
 const globalItems=freshAlerts(global);
 if(globalItems){
  items.push(...globalItems.filter(a=>a.level===want&&((a.type==='district'&&locallyRelevant(a)&&a.oblast_slug===cfg.oblastSlug)||((a.type==='state'||a.type==='oblast')&&a.slug===cfg.oblastSlug))));
 }
 const times=items.map(a=>parseStartedAt(a.started_at||a.start_time||a.startAt||a.startedAt)).filter(Boolean);
 return times.length?Math.min(...times):0;
}
const threatStorageKey='vlnasv-info-wall-threat-v4';
function loadThreatRecord(){
 try{const record=JSON.parse(sessionStorage.getItem(threatStorageKey)||'null');return record&&typeof record==='object'?record:null;}catch(_){return null;}
}
function saveThreatRecord(record){try{sessionStorage.setItem(threatStorageKey,JSON.stringify(record));}catch(_){}}
function threatTransition(state,fromApi=0){
 const dangerous=state==='yellow'||state==='alarm';
 const now=Date.now();const previous=loadThreatRecord();
 const fromApiMs=parseStartedAt(fromApi);
 if(dangerous){
  // Якщо API надає час — саме він керує трихвилинним вступом.
  // Без нього зберігаємо час першого виявлення (і під час перезавантаження сторінки).
  const reuse=previous&&previous.state===state&&now-Number(previous.checked||0)<24*3600*1000;
  const start=fromApiMs||(reuse?Number(previous.observed||now):now);
  threatState=state;threatStartMs=start;threatObservedMs=reuse?Number(previous.observed||now):now;
  threatEpisodeId=state+':'+start;
  saveThreatRecord({state,observed:threatObservedMs,sourceStarted:fromApiMs||0,checked:now});
 }else{
  threatState=state;threatStartMs=0;threatEpisodeId='';threatObservedMs=0;
  // Короткий збій API не повинен запускати повторну анімацію давньої тривоги.
  // Але очищаємо запис після підтвердження відсутності тривоги.
  if(state==='clear'||state==='watch')saveThreatRecord({state,checked:now});
 }
 updateThreatAnimation();
}
function updateThreatAnimation(){
 const dangerous=threatState==='yellow'||threatState==='alarm';
 const elapsed=Date.now()-threatStartMs;
 const intro=dangerous&&threatStartMs>0&&elapsed>=0&&elapsed<180000;
 document.body.classList.toggle('danger-active',dangerous);
 document.body.classList.toggle('alarm-intro',intro);
 const badge=$('alarm-intro-indicator'),meter=$('alarm-intro-meter'),fill=$('alarm-intro-progress');
 if(badge)badge.hidden=!intro;
 if(meter)meter.hidden=!intro;
 if(fill)fill.style.width=intro?Math.max(0,100*(180000-elapsed)/180000).toFixed(1)+'%':'0%';
 setText('danger-strip-message',dangerous?'УВАГА · '+(threatState==='yellow'?'ЖОВТИЙ РІВЕНЬ · ':'ЧЕРВОНИЙ РІВЕНЬ · ')+'ПЕРЕЙДІТЬ В УКРИТТЯ':'ІНФОРМАЦІЙНИЙ ЕКРАН / ПОВІТРЯНА БЕЗПЕКА');
}
function alertState(state,time,startedAt=0){
 document.body.classList.remove('state-alarm','state-yellow','state-clear','state-watch','state-unknown');
 document.body.classList.add('state-'+state);
 const options={
  alarm:['● ЧЕРВОНИЙ РІВЕНЬ','ПОВІТРЯНА ТРИВОГА','ПЕРЕЙДІТЬ<br>В УКРИТТЯ','ЧЕРВОНИЙ РІВЕНЬ ЗАГРОЗИ · НЕГАЙНО ПРЯМУЙТЕ В УКРИТТЯ'],
  yellow:['● ЖОВТИЙ РІВЕНЬ','ЗАГРОЗА БПЛА','ПЕРЕЙДІТЬ<br>В УКРИТТЯ','ЖОВТИЙ РІВЕНЬ ЗАГРОЗИ · ПРЯМУЙТЕ В УКРИТТЯ'],
  clear:['● ЛОКАЛЬНОЇ ТРИВОГИ НЕМАЄ','ЛОКАЛЬНИЙ СТАТУС','ТРИВОГУ НЕ<br>ЗАФІКСОВАНО','За отриманими даними для району тривоги не зафіксовано.'],
  watch:['● Є ТРИВОГА В ІНШИХ РАЙОНАХ','УВАГА','ТРИВОГА<br>В ОБЛАСТІ','У деяких інших районах Львівської області є активні повідомлення.'],
  unknown:['● ДАНІ НЕ ПІДТВЕРДЖЕНО','СТАТУС','СТАТУС<br>НЕВІДОМИЙ','Немає підтверджених свіжих даних.']
 };
 const current=options[state]||options.unknown;
 setText('live-mark',current[0]);setText('alert-label',current[1]);$('alert-headline').innerHTML=current[2];
 setText('alert-description',current[3]);setText('local-time',time||'—');
 threatTransition(state,startedAt);
}
function fresh(result){return Boolean(result?.ok&&Number(result.age_seconds)<=180);}
function freshAlerts(result){if(!fresh(result)||!Array.isArray(result.data?.alerts))return null;const timestamp=Date.parse(result.data.updated_at||'');if(Number.isFinite(timestamp)&&Date.now()-timestamp>180000)return null;return result.data.alerts;}
function locallyRelevant(alert){const text=normalized([alert?.name_uk,alert?.name_en,alert?.name,alert?.slug].join(' '));return (cfg.districtPatterns||[]).some(pattern=>text.includes(normalized(pattern)));}
function levelState(level){return level==='yellow'?'yellow':'alarm';}
function localState(local,global){
 if(fresh(local)&&typeof local.data?.active==='boolean'){
   const item=local.data;
   const districts=Array.isArray(item.districts_active)?item.districts_active:[];
   const matching=districts.find(locallyRelevant);
   if(matching?.level==='red')return 'alarm';
   if(item.active&&item.level==='red')return 'alarm';
   if(matching?.level==='yellow')return 'yellow';
   if(item.active)return levelState(item.level);
   if(item.active_anywhere||districts.length)return 'watch';
   return 'clear';
 }
 const alerts=freshAlerts(global);if(!alerts)return 'unknown';
 const wholeOblast=alerts.find(item=>item.slug===cfg.oblastSlug&&(item.type==='state'||item.type==='oblast'));
 const localDistrict=alerts.find(locallyRelevant);
 if(wholeOblast?.level==='red'||localDistrict?.level==='red')return 'alarm';
 if(wholeOblast?.level==='yellow'||localDistrict?.level==='yellow')return 'yellow';
 const nearby=alerts.filter(item=>item.oblast_slug===cfg.oblastSlug);
 return nearby.length?'watch':'clear';
}
function addStatus(map,key,level){if(!key)return;const previous=map.get(key);map.set(key,previous==='red'||level==='red'?'red':'yellow');}
function processAlerts(result){
 regionStatus.clear();districtStatus.clear();const alerts=freshAlerts(result);if(!alerts)return false;
 for(const alert of alerts){
   const level=alert.level==='yellow'?'yellow':'red';
   if(alert.type==='state'||alert.type==='oblast'){addStatus(regionStatus,canonical(alert.slug)||alert.slug,level);}
   else if(alert.type==='district'){
     const aliases=[alert.name_uk,alert.name_en,alert.name,alert.slug].filter(Boolean);
     if(aliases.length)districtStatus.set(alert.slug||normalized(aliases[0]),{aliases,level,oblast:alert.oblast_slug,slug:alert.slug});
   }
 }
 const red=alerts.filter(item=>item.level!=='yellow').length,yellow=alerts.filter(item=>item.level==='yellow').length;
 setText('map-stats',`АКТИВНІ: ${red} ЧЕРВ. / ${yellow} ЖОВТ.`);return true;
}
function timeFromEpoch(timestamp){const value=Number(timestamp);return Number.isFinite(value)&&value>0?fmtClock.format(new Date(value*1000)):'—';}
async function pollAlerts(){
 if(demo||pollBusy)return;pollBusy=true;
 try{
   // Один загальний запит містить активні тривоги по областях і районах.
   // Це зменшує навантаження порівняно з окремим запитом для Львівської області.
   const response=await requestAlerts();
   const globalOk=processAlerts(response);
   const local=localState(null,response);
   const fetched=globalOk?response.fetched_at:0;
   alertState(local,timeFromEpoch(fetched),findThreatStart(local,null,response));
   setText('map-time',globalOk?timeFromEpoch(response.fetched_at):'НЕМАЄ ДАНИХ');
   connection(Boolean(fetched),fetched?'ДЖЕРЕЛО ПІДКЛЮЧЕНО':'ДЖЕРЕЛО НЕДОСТУПНЕ');
   if(fetched)lastGood=Date.now();
   if(!globalOk)setText('map-stats','НЕМАЄ АКТУАЛЬНОЇ ІНФОРМАЦІЇ');
   drawMap();
 }catch(_){
   regionStatus.clear();districtStatus.clear();alertState('unknown','—');
   connection(false,'ПОМИЛКА API');setText('map-time','НЕМАЄ ДАНИХ');
   setText('map-stats','НЕМАЄ АКТУАЛЬНОЇ ІНФОРМАЦІЇ');drawMap();
 }
 finally{pollBusy=false;}
}
function wmo(code){const n=Number(code);if(n===0)return ['☀','Ясно'];if(n<=2)return ['⛅','Мінлива хмарність'];if(n===3)return ['☁','Хмарно'];if(n===45||n===48)return ['≋','Туман'];if(n>=51&&n<=67)return ['☂','Дощ / мряка'];if(n>=71&&n<=86)return ['❄','Сніг / опади'];if(n>=95)return ['ϟ','Гроза'];return ['◌','Поточна погода'];}
const round=value=>value===null||value===undefined||!Number.isFinite(Number(value))?null:Math.round(Number(value));
function dateKeyInTZ(date){const parts=fmtDateParts.formatToParts(date);const p=Object.fromEntries(parts.map(part=>[part.type,part.value]));return `${p.year}-${p.month}-${p.day}`;}
function birthdayCountLabel(count){
 const lastTwo=count%100,last=count%10;
 if(last===1&&lastTwo!==11)return `${count} ОСОБА`;
 if(last>=2&&last<=4&&(lastTwo<12||lastTwo>14))return `${count} ОСОБИ`;
 return `${count} ОСІБ`;
}
function renderBirthdays(now=new Date()){
 if(!birthdayDataReady)return;
 const banner=$('birthday-banner'),list=$('birthday-list'),sidebar=document.querySelector('.sidebar');
 if(!banner||!list)return;
 const today=dateKeyInTZ(now).slice(5);
 const matches=birthdayPeople.filter(person=>person&&person.active!==false&&person.date===today);
 if(!matches.length){
  banner.hidden=true;
  sidebar?.classList.remove('has-birthdays');
  birthdayRenderKey='';
  return;
 }
 const pageCount=Math.ceil(matches.length/birthdayPageSize);
 const pageIndex=pageCount>1?Math.floor(Math.max(0,now.getTime()-birthdayPageEpoch)/birthdayPageDurationMs)%pageCount:0;
 const renderKey=`${dateKeyInTZ(now)}:${pageIndex}:${matches.length}`;
 banner.hidden=false;
 sidebar?.classList.add('has-birthdays');
 if(renderKey===birthdayRenderKey)return;
 birthdayRenderKey=renderKey;
 setText('birthday-caption',matches.length===1?'СЬОГОДНІ ІМЕНИННИК':'СЬОГОДНІ ІМЕНИННИКИ');
 setText('birthday-count',birthdayCountLabel(matches.length));
 const page=$('birthday-page');
 if(page){
  page.hidden=pageCount<=1;
  page.textContent=pageCount>1?`СТОРІНКА ${pageIndex+1} / ${pageCount}`:'';
 }
 list.replaceChildren();
 const visiblePeople=matches.slice(pageIndex*birthdayPageSize,(pageIndex+1)*birthdayPageSize);
 for(const person of visiblePeople){
  const card=document.createElement('div');card.className='birthday-person';
  const head=document.createElement('div');head.className='birthday-person-head';
  const name=document.createElement('strong');name.className='birthday-name';name.textContent=person.name||'Іменинник';
  const category=document.createElement('span');category.className='birthday-category';category.textContent=person.category||'Працівники';
  const position=document.createElement('span');position.className='birthday-position';position.textContent=person.position||(person.category==='Ліцеїсти'?'Ліцеїст(ка)':'');
  head.append(name,category);card.append(head);if(position.textContent)card.append(position);list.append(card);
 }
 list.classList.remove('birthday-page-enter');
 if(pageCount>1){
  void list.offsetWidth;
  list.classList.add('birthday-page-enter');
 }
}
async function loadBirthdays(){
 try{
  const response=await fetch('data/birthdays.json',{cache:'no-store',headers:{'Accept':'application/json'}});
  if(!response.ok)throw new Error('birthdays_http_'+response.status);
  const data=await response.json();
  if(!Array.isArray(data.people))throw new Error('birthdays_format');
  birthdayPeople=data.people.filter(person=>person&&/^\d{2}-\d{2}$/.test(String(person.date||''))&&typeof person.name==='string');
  birthdayDataReady=true;birthdayRenderKey='';refreshBirthdays(new Date());
 }catch(_){
  const banner=$('birthday-banner');if(banner)banner.hidden=true;
  document.querySelector('.sidebar')?.classList.remove('has-birthdays');
 }
}
function refreshBirthdays(now){
 renderBirthdays(now);
}
function minuteSilenceTick(now){
 const overlay=$('minute-silence-overlay');if(!overlay)return;
 const demoLabel=$('silence-demo-label');
 let visible=false,elapsed=0;
 if(demo==='silence'){
  elapsed=now.getTime()-silenceDemoStartedMs;
  visible=elapsed>=0&&elapsed<60000;
 }else if(!demo){
  const parts=Object.fromEntries(fmtMemorialParts.formatToParts(now).map(part=>[part.type,part.value]));
  const dateKey=dateKeyInTZ(now),inMinute=parts.hour==='09'&&parts.minute==='00';
  const danger=threatState==='yellow'||threatState==='alarm';
  if(inMinute&&danger)memorialSuppressedDate=dateKey;
  const statusKnown=threatState==='clear'||threatState==='watch';
  visible=inMinute&&statusKnown&&!danger&&memorialSuppressedDate!==dateKey;
  if(visible)elapsed=Number(parts.second)*1000+now.getMilliseconds();
 }
 if(demoLabel)demoLabel.hidden=demo!=='silence'||!visible;
 if(overlay.hidden===visible){overlay.hidden=!visible;overlay.setAttribute('aria-hidden',visible?'false':'true');}
 if(visible){
  const progress=Math.max(0,Math.min(100,100*(1-elapsed/60000)));
  const bar=$('minute-silence-progress');if(bar)bar.style.width=progress.toFixed(1)+'%';
 }
}
function forecastDayLabel(dateString,index){if(index===0)return 'Сьогодні';if(index===1)return 'Завтра';const d=new Date(dateString+'T12:00:00Z');return new Intl.DateTimeFormat('uk-UA',{weekday:'short',timeZone:TZ}).format(d).replace('.','');}
function showWeather(current,daily,updated){
 const temperature=round(current?.temperature_2m);if(temperature===null)throw new Error('temperature');
 $('temperature').replaceChildren(document.createTextNode(String(temperature)),(()=>{const sup=document.createElement('sup');sup.textContent='°';return sup;})());
 const [icon,description]=wmo(current.weather_code);setText('weather-symbol',icon);setText('weather-description',description);setText('feels-like',(round(current.apparent_temperature)??'—')+'°');setText('wind',(round(current.wind_speed_10m)??'—')+' км/год');setText('weather-time',updated);
 const wrap=$('forecast-row');wrap.replaceChildren();const dates=daily?.time||[];const highs=daily?.temperature_2m_max||[];const lows=daily?.temperature_2m_min||[];const codes=daily?.weather_code||[];const rain=daily?.precipitation_probability_max||[];
 for(let i=0;i<Math.min(5,dates.length);i++){
   const card=document.createElement('div');card.className='forecast-box';
   const values=[['fc-day',forecastDayLabel(dates[i],i)],['fc-symbol',wmo(codes[i])[0]],['fc-high',(round(highs[i])??'—')+'°'],['fc-low',(round(lows[i])??'—')+'°'],['fc-rain',rain[i]===null||rain[i]===undefined?'—':(round(rain[i])+'%')]];
   for(const [className,value] of values){const el=document.createElement('div');el.className=className;el.textContent=value;card.append(el);}card.title=`${dates[i]} · максимум ${highs[i]}°, мінімум ${lows[i]}°, імовірність опадів ${rain[i]??'—'}%`;wrap.append(card);
 }
 if(!dates.length){const empty=document.createElement('div');empty.className='forecast-empty';empty.textContent='Немає даних прогнозу на наступні дні';wrap.append(empty);}
}
async function pollWeather(){
 if(demo)return;
 try{
  const weather=await requestWeather();
  if(!weather?.current||!weather?.daily)throw new Error('Немає погодних даних');
  showWeather(weather.current,weather.daily,timeFromEpoch(Math.floor(Date.now()/1000)));
 }catch(_){
  setText('temperature','—°');setText('weather-description','Погода недоступна');setText('weather-time','НЕМАЄ ДАНИХ');
 }
}
function toMinute(value){const [hour,minute]=String(value).split(':').map(Number);return hour*60+minute;}
function toTime(value){return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;}
function dayKey(date){const weekday=fmtParts.formatToParts(date).find(part=>part.type==='weekday')?.value;return weekday==='Sat'?'saturday':weekday==='Sun'?'sunday':'weekday';}
function buildSegments(schedule){
 const start=toMinute(schedule.start),end=toMinute(schedule.end);const items=[...(schedule.items||[])].map(item=>({...item,from:toMinute(item.start),to:toMinute(item.end)})).sort((a,b)=>a.from-b.from);const result=[];let cursor=start,previous=null;
 for(const item of items){
   if(item.from>cursor){const adjacentLessons=previous?.type==='lesson'&&item.type==='lesson';result.push({from:cursor,to:item.from,type:'gap',label:adjacentLessons?'Перерва між уроками':'Час між заходами',short:'',note:'Інтервал між заходами; окремий захід у документі не зазначено.'});}
   if(item.from<cursor){continue;}
   result.push(item);cursor=item.to;previous=item;
 }
 if(cursor<end)result.push({from:cursor,to:end,type:'gap',label:'Час після останнього заходу',short:'',note:'Час після останнього заходу в межах шкали.'});
 return result;
}
function buildTimeline(schedule){
 activeSchedule=schedule;timelineSegments=buildSegments(schedule);timelinePoints=(schedule.points||[]).map(point=>({...point,minute:toMinute(point.time)}));
 const start=toMinute(schedule.start),end=toMinute(schedule.end),range=end-start;const wrap=$('timeline');wrap.replaceChildren();
 for(const segment of timelineSegments){
   const element=document.createElement('div');element.className='timeline-segment '+segment.type;
   const left=((segment.from-start)/range)*100,width=((segment.to-segment.from)/range)*100;
   element.style.left=left+'%';element.style.width=width+'%';
   const note=segment.inferred?' · Часовий інтервал розміщено за об’єднаною клітинкою таблиці; окремі межі в документі не вказані.':'';
   element.title=`${segment.label}: ${toTime(segment.from)}–${toTime(segment.to)}${note}`;
   if(segment.type!=='gap'&&width>=3.1){const title=document.createElement('strong');title.textContent=segment.short||segment.label;element.append(title);}
   if(segment.type!=='gap'&&width>=4.7){const time=document.createElement('small');time.textContent=`${toTime(segment.from)}–${toTime(segment.to)}`;element.append(time);}
   segment.element=element;wrap.append(element);
 }
 for(const point of timelinePoints){const marker=document.createElement('div');marker.className='timeline-point';marker.style.left=(((point.minute-start)/range)*100)+'%';marker.title=`${point.label} · ${point.time}`;wrap.append(marker);}
 const now=document.createElement('div');now.className='timeline-now';now.id='timeline-now';now.hidden=true;wrap.append(now);
 const ruler=$('timeline-ruler');ruler.replaceChildren();const candidates=[start,9*60,12*60,15*60,18*60,20*60,end];const times=[...new Set(candidates.filter(value=>value>=start&&value<=end))].sort((a,b)=>a-b);
 for(const minute of times){const tick=document.createElement('span');tick.className='ruler-tick';tick.style.left=(((minute-start)/range)*100)+'%';tick.textContent=toTime(minute);ruler.append(tick);}
 setText('schedule-start-time',schedule.start);setText('schedule-end-time',schedule.end);activeScheduleKey=schedule===cfg.schedules.weekday?'weekday':schedule===cfg.schedules.saturday?'saturday':'sunday';
}
function scheduleTick(date){
 const weekdayCode=fmtParts.formatToParts(date).find(part=>part.type==='weekday')?.value;const key=dayKey(date);const schedule=cfg.schedules[key]||cfg.schedules.weekday;
 if(activeScheduleKey!==key)buildTimeline(schedule);
 const dayLabel=fmtWeekdayLong.format(date).toLocaleUpperCase('uk-UA');setText('schedule-day',key==='weekday'?`${dayLabel} · ПН–ПТ`:dayLabel);
 const byType=Object.fromEntries(fmtParts.formatToParts(date).map(part=>[part.type,part.value]));const minutes=Number(byType.hour)*60+Number(byType.minute);const start=toMinute(schedule.start),end=toMinute(schedule.end);
 for(const segment of timelineSegments)segment.element.classList.toggle('active',minutes>=segment.from&&minutes<segment.to&&segment.type!=='gap');
 const marker=$('timeline-now');marker.hidden=minutes<start||minutes>end;if(!marker.hidden)marker.style.left=(((minutes-start)/(end-start))*100)+'%';
 const exactPoint=timelinePoints.find(point=>point.minute===minutes);
 const active=timelineSegments.find(segment=>minutes>=segment.from&&minutes<segment.to);
 const next=schedule.items.map(item=>({...item,from:toMinute(item.start),to:toMinute(item.end)})).filter(item=>item.from>minutes).sort((a,b)=>a.from-b.from)[0];
 const nextText=next?`Далі: ${next.short||next.label} о ${next.start}`:'';
 if(exactPoint){setText('schedule-status',exactPoint.label.toUpperCase());setText('schedule-next',nextText||`Час за розпорядком: ${exactPoint.time}`);return;}
 if(minutes<start){setText('schedule-status','ДО ПОЧАТКУ РОЗПОРЯДКУ');setText('schedule-next',`Початок дня: ${schedule.points?.[0]?.label||'підйом'} о ${schedule.start}`);return;}
 if(minutes>=end){setText('schedule-status','ВІДБІЙ');setText('schedule-next',`За розпорядком — о ${schedule.end}.`);return;}
 if(active&&active.type!=='gap'){
   const left=active.to-minutes;setText('schedule-status',(active.short||active.label).toLocaleUpperCase('uk-UA'));
   setText('schedule-next',`До завершення ${left} хв · ${toTime(active.from)}–${toTime(active.to)}${next?' · '+nextText:''}`);return;
 }
 const prev=[...timelineSegments].reverse().find(segment=>segment.to<=minutes&&segment.type!=='gap');
 if(minutes<start+10&&schedule.points?.some(point=>toMinute(point.time)===start))setText('schedule-status','ПІСЛЯ ПІДЙОМУ');
 else if(active?.label==='Перерва між уроками')setText('schedule-status','ПЕРЕРВА МІЖ УРОКАМИ');
 else setText('schedule-status','МІЖ ЗАХОДАМИ');
 const gapLeft=active?active.to-minutes:null;setText('schedule-next',`${gapLeft!==null?`До наступного заходу ${gapLeft} хв. `:''}${nextText||'Наступний захід не визначений.'}`);
}
function clockTick(){updateThreatAnimation();const now=new Date();$('clock').replaceChildren(document.createTextNode(fmtClock.format(now)),(()=>{const seconds=document.createElement('span');seconds.className='seconds';seconds.textContent=':'+String(now.getSeconds()).padStart(2,'0');return seconds;})());setText('date',fmtDate.format(now));scheduleTick(now);refreshBirthdays(now);minuteSilenceTick(now);}
function demoMode(){
 const danger=demo==='alarm';$('demo-watermark').hidden=false;alertState(danger?'alarm':demo==='yellow'?'yellow':'clear','ТЕСТ · 12:45',Date.now());connection(true,'ДЕМОНСТРАЦІЯ');setText('map-time','ТЕСТОВИЙ РЕЖИМ');
 regionStatus=new Map(danger?[['lvivska','red'],['kharkivska','red'],['donetska','yellow']]:demo==='yellow'?[['lvivska','yellow'],['kharkivska','red'],['donetska','yellow']]:[['kharkivska','red'],['donetska','yellow']]);
 districtStatus=new Map([['brovarskii-raion',{aliases:['Броварський район','Brovarskyi district','brovarskii-raion'],level:'yellow'}],['sumskii-raion',{aliases:['Сумський район','Sumy district'],level:'yellow'}],['shostkynskyi-raion',{aliases:['Шосткинський район','Shostka district'],level:'red'}]]);
 setText('map-stats','ТЕСТОВІ СТАТУСИ');
 const now=new Date();const base=dateKeyInTZ(now);
 showWeather({temperature_2m:12,apparent_temperature:9,weather_code:3,wind_speed_10m:13,time:base+'T13:00'},
  {time:[base,base,base,base,base],temperature_2m_max:[14,13,12,11,10],temperature_2m_min:[7,6,5,4,3],weather_code:[3,2,61,71,3],precipitation_probability_max:[10,20,40,55,15]},'ТЕСТ');
 drawMap();
}
clockTick();setInterval(clockTick,1000);loadBirthdays();setInterval(loadBirthdays,cfg.refresh?.birthdaysMs||900000);if(demo)demoMode();loadGeometry();
if(!demo){
 pollAlerts();pollWeather();
 setInterval(pollAlerts,cfg.refresh?.alertsMs||30000);
 setInterval(pollWeather,cfg.refresh?.weatherMs||600000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){clockTick();pollAlerts();pollWeather();loadBirthdays();}});
 setInterval(()=>{if(lastGood&&Date.now()-lastGood>(cfg.refresh?.staleAfterMs||210000)){regionStatus.clear();districtStatus.clear();alertState('unknown','ЗАСТАРІЛІ ДАНІ');connection(false,'ДЖЕРЕЛО НЕДОСТУПНЕ');drawMap();}},30000);
}
})();
