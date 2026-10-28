(() => {
'use strict';
const cfg = window.WALL_CONFIG;
if (!cfg?.schedules) throw new Error('assets/config.js was not loaded');
const $ = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const TZ = cfg.timezone || 'Europe/Kyiv';
const params = new URLSearchParams(location.search);
const demo = ['alarm','clear','yellow'].includes(params.get('preview')) ? params.get('preview') : '';
const fmtClock = new Intl.DateTimeFormat('uk-UA',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:TZ});
const fmtDate = new Intl.DateTimeFormat('uk-UA',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:TZ});
const fmtWeekdayLong = new Intl.DateTimeFormat('uk-UA',{weekday:'long',timeZone:TZ});
const fmtWeekdayShort = new Intl.DateTimeFormat('uk-UA',{weekday:'short',timeZone:TZ});
const fmtParts = new Intl.DateTimeFormat('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:TZ});
const fmtDateParts = new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:TZ});
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
 ['crimea',['крим','crimea','krym']],['sevastopol',['севастопол','sevastopol']],['kyiv',['містокиїв','cityofkyiv','cityofkiev','київмісто','міськрадакиєва']]
];
let featuresOblast=[], featuresDistrict=[], fallbackOutline=[];
let geoLoaded=false, geoDistrictsLoaded=false;
let regionStatus=new Map(), districtStatus=new Map();
let lastGood=0, pollBusy=false, activeScheduleKey='';
let localAlertStarted=0, localAlertObserved=0, localAlertKind='unknown', lastGlobalAlerts=[];
let mapUnmatched=[],globalAlertsValid=false;
let timelineSegments=[], timelinePoints=[], activeSchedule=null;
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
 if(outer?.length){
   // Центр ваги вершин може опинитися поза увігнутим полігоном.
   // Беремо кілька контрольних точок уздовж контуру району.
   let lon=0,lat=0;for(const xy of outer){lon+=xy[0];lat+=xy[1];}
   const probes=[[lon/outer.length,lat/outer.length],outer[0],outer[Math.floor(outer.length/3)],outer[Math.floor(outer.length*2/3)]];
   for(const oblast of featuresOblast){
     const rings=outerRings(oblast);
     const hits=probes.filter(p=>rings.some(r=>pointInRing(p,r))).length;
     if(hits>=2){result=oblastFor(oblast);if(result)break;}
   }
 }
 parentRegionCache.set(feature,result);return result;
}
// Порівняння назв GeoJSON (2020) із назвами API (2026): кирилиця,
// латиниця, транслітерація, відмінки. Не зіставляємо різні області.
const UKR_ROMAN = Object.freeze({'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ie','ж':'zh','з':'z','и':'y','і':'i','ї':'i','й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'iu','я':'ia'});
function roman(value){return Array.from(normalized(value)).map(c=>UKR_ROMAN[c]??c).join('');}
function districtStem(value){
 let n=roman(value).replace(/[^a-z0-9]/g,'');
 n=n.replace(/(?:rayon|raion|district)$/,'').replace(/(?:skyi|skij|skii|skyy|skaya|skyi|s'kyi|sky|ska|ske|sk)$/,'');
 // Колишній Червоноградський район, перейменований на Шептицький.
 if(n.startsWith('chervonohrad')||n.startsWith('sheptyt'))return 'sheptyts';
 return n;
}
function districtKeys(value){
 const raw=normalized(value);if(!raw)return [];
 const root=districtStem(value);return [...new Set([raw,roman(value),root].filter(k=>k.length>=4))];
}
function districtAliases(feature){
 const p=feature.properties||{};
 const named=['name_ua','name_uk','name','NAME','NAME_2','name_2','shapeName','rayon','raion','район','district','title','назва'];
 const names=named.map(k=>p[k]).filter(v=>typeof v==='string'&&!/област|oblast|region|обл\./iu.test(v));
 return [...new Set(names.length?names:descriptors(feature).filter(v=>!/област|oblast|region|обл\./iu.test(v)))];
}
function districtMatches(feature,region){
 if(!region)return null;
 const keys=new Set(districtAliases(feature).flatMap(districtKeys));
 if(!keys.size)return null;
 const candidates=[];
 for(const entry of districtStatus.values()){
   if(entry.oblast!==region)continue;
   const entryKeys=entry.keys || (entry.keys=entry.aliases.flatMap(districtKeys));
   if(entryKeys.some(k=>keys.has(k)))candidates.push(entry);
 }
 // Не робимо випадковий збіг, коли дві активні одиниці мають схожі назви.
 return candidates.length===1?candidates[0]:null;
}
function pin(){const [x,y]=coord(cfg.lon,cfg.lat);for(const id of ['pin-halo','pin-main','pin-core']){const el=$(id);if(el){el.setAttribute('cx',x);el.setAttribute('cy',y);}}}
function drawMap(){
 const oblastLayer=$('oblasts-layer'),districtLayer=$('districts-layer'),bordersLayer=$('borders-layer');
 oblastLayer.replaceChildren();districtLayer.replaceChildren();bordersLayer.replaceChildren();
 const oblastFeatures=featuresOblast.length?featuresOblast:fallbackOutline;
 for(const feature of oblastFeatures){if(!feature?.geometry)continue;const slug=oblastFor(feature);const level=regionStatus.get(slug)||'';
   const path=S('path',{d:pathFor(feature.geometry),class:'map-oblast '+level});const title=S('title');title.textContent=bestName(feature)+' · '+(level==='red'?'червоний рівень':level==='yellow'?'жовтий рівень':'немає підтвердженої активної загрози');path.append(title);oblastLayer.append(path);
 }
 const matchedSlugs=new Set();
 for(const feature of featuresDistrict){if(!feature?.geometry)continue;
   const region=oblastFor(feature)||regionFromShape(feature);
   const match=districtMatches(feature,region);
   if(match)matchedSlugs.add(match.slug);
   const regional=regionStatus.get(region)||'';
   // Рівень області поширюється на всі райони, районні загрози — на один район.
   const level=(regional==='red'||match?.level==='red')?'red':(regional==='yellow'||match?.level==='yellow')?'yellow':'';
   const path=S('path',{d:pathFor(feature.geometry),class:'map-district '+level});
   const title=S('title');title.textContent=bestName(feature)+' · '+(level==='red'?'червоний рівень':level==='yellow'?'жовтий рівень':'активну загрозу не підтверджено');path.append(title);districtLayer.append(path);
 }
 for(const feature of featuresOblast){if(!feature?.geometry)continue;bordersLayer.append(S('path',{d:pathFor(feature.geometry),class:'map-border'}));}
 pin();
 mapUnmatched=[...districtStatus.values()].filter(entry=>!matchedSlugs.has(entry.slug)).map(entry=>entry.aliases[0]+' ('+entry.oblast+')');
 let message='';
 if(!geoLoaded)message='Карта: недоступні межі областей.';
 else if(!geoDistrictsLoaded)message='Карта: недоступні межі районів. Повне відображення тривог неможливе.';
 else if(!globalAlertsValid&&!demo)message='Немає актуальних даних про тривоги. Карта не відображає поточний статус.';
 else if(mapUnmatched.length)message='Карта: '+mapUnmatched.length+' район(ів) не зіставлено з контурами. Частина статусів може бути не показана.';
 setText('map-message',message);$('map-message').style.display=message?'block':'none';
 if(lastGlobalAlerts.length){
   const red=lastGlobalAlerts.filter(a=>a.level==='red').length;
   const yellow=lastGlobalAlerts.filter(a=>a.level==='yellow').length;
   setText('map-stats',`ЧЕРВОНІ ${red} · ЖОВТІ ${yellow}`);
 }
 if(new URLSearchParams(location.search).has('debug')&&mapUnmatched.length)console.warn('[Карта] Незіставлені райони:',mapUnmatched);
}
const REMOTE={
 all:'https://tryvoha.online/api/v1/alerts',
 local:'https://tryvoha.online/api/v1/alerts/'+encodeURIComponent(cfg.oblastSlug),
  regions:'https://tryvoha.online/api/v1/regions',
  weather:'https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({
  latitude:String(cfg.lat), longitude:String(cfg.lon), timezone:cfg.timezone,
  forecast_days:'5',current:'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
  daily:'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset'
 }).toString()
};
// На GitHub Pages немає PHP-проксі. Всі запити GET йдуть до публічних CORS API.
async function fetchJSON(url,timeoutMs=18000,cache='no-store'){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{const response=await fetch(url,{signal:controller.signal,mode:'cors',cache,headers:{'Accept':'application/json'}});
   if(!response.ok)throw new Error('HTTP '+response.status+' for '+url);
   const json=await response.json();if(!json||typeof json!=='object')throw new Error('invalid_json');return json;
 }finally{clearTimeout(timer);}
}
function wrapped(data){return {ok:true,data,fetched_at:Math.floor(Date.now()/1000),age_seconds:0,stale:false};}
async function request(mode,timeoutMs=20000){
 if(mode==='alerts'){
  const [all,local]=await Promise.allSettled([fetchJSON(REMOTE.all,timeoutMs),fetchJSON(REMOTE.local,timeoutMs)]);
  return {ok:all.status==='fulfilled'&&local.status==='fulfilled',mode,
    all:all.status==='fulfilled'?wrapped(all.value):{ok:false,error:String(all.reason)},
    local:local.status==='fulfilled'?wrapped(local.value):{ok:false,error:String(local.reason)}};
 }
 if(mode==='weather'){
  const data=await fetchJSON(REMOTE.weather,timeoutMs);
  return {ok:true,mode,weather:wrapped(data)};
 }
 throw new Error('unknown mode');
}
async function getGeoJSON(filename,minCount){
 const sources=[
  ...(cfg.geometryLocal?['assets/'+filename+'.geojson']:[]),
  'https://cdn.jsdelivr.net/gh/Astaryon/UA_geojson@main/'+(filename==='oblasts'?'regiony.geojson':'rayony.geojson'),
  'https://raw.githubusercontent.com/Astaryon/UA_geojson/main/'+(filename==='oblasts'?'regiony.geojson':'rayony.geojson')
 ];
 for(const url of sources){
  try{const data=await fetchJSON(url,19000,url.startsWith('assets/')?'force-cache':'default');
    if(data.type==='FeatureCollection'&&Array.isArray(data.features)&&data.features.length>=minCount)return data.features;
  }catch(error){ if(url===sources[sources.length-1]) console.warn('Геодані:',filename,error.message);}
 }
 return [];
}
async function loadGeometry(){
 try{const outline=await fetchJSON('assets/ukraine-outline.json',12000,'force-cache');fallbackOutline=outline.features||[];}catch(_){fallbackOutline=[];}
 const [oblasts,districts]=await Promise.all([getGeoJSON('oblasts',20),getGeoJSON('districts',75)]);
 featuresOblast=oblasts;featuresDistrict=districts;
 geoLoaded=featuresOblast.length>=20;geoDistrictsLoaded=featuresDistrict.length>=75;
 drawMap();
}
function connection(ok,label){setText('connection-label',label);$('connection-light').className='status-light '+(ok?'connected':'failed');}
function alertState(state,time,startedAt=0){
 const danger=state==='alarm'||state==='yellow';
 document.body.classList.remove('state-alarm','state-yellow','state-clear','state-watch','state-unknown');
 document.body.classList.add('state-'+state);
 // 3 хвилини від початку поточного епізоду за started_at із API.
 // Коли час відсутній, запам'ятовуємо перше виявлення до зміни стану.
 if(state!==localAlertKind){localAlertObserved=Date.now();localAlertKind=state;}
 localAlertStarted=danger?(startedAt||localAlertObserved):0;
 const options={
  alarm:['● ЧЕРВОНИЙ РІВЕНЬ','ПОВІТРЯНА ТРИВОГА','ПЕРЕЙДІТЬ<br>В УКРИТТЯ','ЧЕРВОНИЙ РІВЕНЬ ЗАГРОЗИ · НЕГАЙНО ПРЯМУЙТЕ В УКРИТТЯ'],
  yellow:['● ЖОВТИЙ РІВЕНЬ','ЗАГРОЗА БПЛА','ПЕРЕЙДІТЬ<br>В УКРИТТЯ','ЖОВТИЙ РІВЕНЬ ЗАГРОЗИ · ПРЯМУЙТЕ В УКРИТТЯ'],
  clear:['● ТРИВОГИ НЕ ЗАФІКСОВАНО','ЛОКАЛЬНИЙ СТАТУС','ТРИВОГУ НЕ<br>ЗАФІКСОВАНО','За останнім оновленням активної загрози для району немає.'],
  watch:['● ЗАГРОЗА В ІНШИХ РАЙОНАХ','УВАГА','ТРИВОГА<br>В ОБЛАСТІ','Тривогу оголошено в інших районах Львівської області.'],
  unknown:['● НЕМАЄ АКТУАЛЬНИХ ДАНИХ','СТАТУС','СТАТУС<br>НЕВІДОМИЙ','Немає актуальної інформації про повітряну загрозу.']
 };
 const current=options[state]||options.unknown;
 setText('live-mark',current[0]);setText('alert-label',current[1]);$('alert-headline').innerHTML=current[2];setText('alert-description',current[3]);setText('local-time',time||'—');
 updateAlarmAnimation();
}
function updateAlarmAnimation(){
 const danger=localAlertKind==='alarm'||localAlertKind==='yellow';
 const elapsed=Date.now()-localAlertStarted;
 const animate=danger&&elapsed>=0&&elapsed<180000;
 document.body.classList.toggle('alarm-intro',animate);
 document.body.classList.toggle('danger-active',danger);
 const remaining=animate?Math.ceil((180000-elapsed)/1000):0;
 const mark=$('alarm-intro-indicator');
 if(mark){mark.hidden=!animate;mark.textContent=animate?'ПЕРШІ ХВИЛИНИ ТРИВОГИ':'';}
 const bar=$('alarm-intro-progress');
 if(bar)bar.style.width=animate?(100*remaining/180)+'%':'0%';
 const strip=$('danger-strip-message');
 if(strip)strip.textContent=danger?'ТРИВОГА · ПЕРЕЙДІТЬ В УКРИТТЯ':'ІНФОРМАЦІЙНИЙ ЕКРАН / ПОВІТРЯНА БЕЗПЕКА';
}
function fresh(result){return Boolean(result?.ok&&Number(result.age_seconds)<=180);}
function freshAlerts(result){if(!fresh(result)||!Array.isArray(result.data?.alerts))return null;const timestamp=Date.parse(result.data.updated_at||'');if(!Number.isFinite(timestamp)||Math.abs(Date.now()-timestamp)>180000)return null;return result.data.alerts;}
function locallyRelevant(alert){const text=normalized([alert?.name_uk,alert?.name_en,alert?.name,alert?.slug].join(' '));return (cfg.districtPatterns||[]).some(pattern=>text.includes(normalized(pattern)));}
function levelState(level){return level==='yellow'?'yellow':'alarm';}
function parseStart(value){const n=Date.parse(value||'');return Number.isFinite(n)&&n>0&&n<=Date.now()+300000?n:0;}
function latestDanger(items){
 const ordered=[...items].filter(a=>a&&(a.level==='yellow'||a.level==='red'));
 ordered.sort((a,b)=>(a.level==='red'?0:1)-(b.level==='red'?0:1));
 const first=ordered[0];return first?{state:first.level==='red'?'alarm':'yellow',startedAt:parseStart(first.started_at)}:null;
}
function localState(local,global){
 const globalAlerts=freshAlerts(global);
 const whole=globalAlerts?.filter(a=>a.slug===cfg.oblastSlug&&(a.type==='state'||a.type==='oblast'))||[];
 const district=globalAlerts?.filter(a=>a.type==='district'&&a.oblast_slug===cfg.oblastSlug&&locallyRelevant(a))||[];
 const globalLocal=latestDanger([...district,...whole]);
 if(fresh(local)&&typeof local.data?.active==='boolean'){
   const item=local.data;
   const districts=Array.isArray(item.districts_active)?item.districts_active:[];
   const matching=districts.filter(locallyRelevant);
   const localDanger=latestDanger([...matching,...(item.active?[item]:[])]);
   // API області і загальний список мають узгоджуватися. Не допускаємо,
   // щоб локальна відсутність активної тривоги приховала підтверджену районну.
   const confirmed=latestDanger([...matching,...(item.active?[item]:[]),...district,...whole]);
   if(confirmed)return confirmed;
   if(item.active&&item.level!==null)return {state:'alarm',startedAt:parseStart(item.started_at)};
   if(item.active)return {state:'alarm',startedAt:parseStart(item.started_at)};
   if(item.active_anywhere||districts.length)return {state:'watch',startedAt:0};
   return {state:'clear',startedAt:0};
 }
 if(!globalAlerts)return {state:'unknown',startedAt:0};
 if(globalLocal)return globalLocal;
 return {state:globalAlerts.some(a=>a.oblast_slug===cfg.oblastSlug)?'watch':'clear',startedAt:0};
}
function addStatus(map,key,level){if(!key)return;const previous=map.get(key);map.set(key,previous==='red'||level==='red'?'red':'yellow');}
function processAlerts(result){
 const alerts=freshAlerts(result);
 if(!alerts){regionStatus.clear();districtStatus.clear();lastGlobalAlerts=[];globalAlertsValid=false;return false;}
 const newRegion=new Map(),newDistrict=new Map();
 for(const alert of alerts){
   const level=alert.level==='red'?'red':alert.level==='yellow'?'yellow':null;
   if(!level)continue; // Не трактуємо невідомі рівні як червоні.
   if(alert.type==='state'||alert.type==='oblast')addStatus(newRegion,canonical(alert.slug)||alert.slug,level);
   else if(alert.type==='district'){
     const aliases=[alert.name_uk,alert.name_en,alert.name,alert.slug].filter(Boolean);
     if(aliases.length)newDistrict.set(alert.slug||normalized(aliases[0]),{aliases,level,oblast:canonical(alert.oblast_slug)||alert.oblast_slug,slug:alert.slug||normalized(aliases[0])});
   }
 }
 regionStatus=newRegion;districtStatus=newDistrict;lastGlobalAlerts=alerts;globalAlertsValid=true;
 return true;
}
function timeFromEpoch(timestamp){const value=Number(timestamp);return Number.isFinite(value)&&value>0?fmtClock.format(new Date(value*1000)):'—';}
async function pollAlerts(){
 if(demo||pollBusy)return;pollBusy=true;
 try{
   const response=await request('alerts',22000);
   const globalOk=processAlerts(response.all);
   const local=localState(response.local,response.all);
   const fetched=fresh(response.local)?response.local.fetched_at:fresh(response.all)?response.all.fetched_at:0;
   const localSource=fresh(response.local)&&typeof response.local.data?.active==='boolean';
   alertState(local.state,timeFromEpoch(fetched),local.startedAt);
   setText('map-time',globalOk?timeFromEpoch(response.all.fetched_at):'НЕМАЄ ДАНИХ');
   connection(Boolean(globalOk&&localSource),globalOk&&localSource?'ДАНІ ОНОВЛЕНО':'НЕПОВНІ ДАНІ API');
   if(globalOk&&localSource)lastGood=Date.now();
   if(!globalOk)setText('map-stats','КАРТА: НЕМАЄ АКТУАЛЬНОЇ ІНФОРМАЦІЇ');
   drawMap();
   if(!globalOk)setText('map-stats','КАРТА: НЕМАЄ АКТУАЛЬНОЇ ІНФОРМАЦІЇ');
 }catch(error){
   regionStatus.clear();districtStatus.clear();lastGlobalAlerts=[];globalAlertsValid=false;
   alertState('unknown','—');connection(false,'ПОМИЛКА API');
   setText('map-time','НЕМАЄ ДАНИХ');drawMap();setText('map-stats','НЕМАЄ АКТУАЛЬНОЇ ІНФОРМАЦІЇ');
   console.warn('Tryvoha API:',error?.message||error);
 }finally{pollBusy=false;}
}
function wmo(code){const n=Number(code);if(n===0)return ['☀','Ясно'];if(n<=2)return ['⛅','Мінлива хмарність'];if(n===3)return ['☁','Хмарно'];if(n===45||n===48)return ['≋','Туман'];if(n>=51&&n<=67)return ['☂','Дощ / мряка'];if(n>=71&&n<=86)return ['❄','Сніг / опади'];if(n>=95)return ['ϟ','Гроза'];return ['◌','Поточна погода'];}
const round=value=>value===null||value===undefined||!Number.isFinite(Number(value))?null:Math.round(Number(value));
function dateKeyInTZ(date){const parts=fmtDateParts.formatToParts(date);const p=Object.fromEntries(parts.map(part=>[part.type,part.value]));return `${p.year}-${p.month}-${p.day}`;}
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
async function pollWeather(){if(demo)return;try{const response=await request('weather');const weather=response.weather;if(!weather?.ok||Number(weather.age_seconds)>14400||!weather.data?.current||!weather.data?.daily)throw new Error('unavailable');showWeather(weather.data.current,weather.data.daily,timeFromEpoch(weather.fetched_at));}catch(_){setText('temperature','—°');setText('weather-description','Погода недоступна');setText('weather-time','НЕМАЄ ДАНИХ');}}
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
function clockTick(){const now=new Date();$('clock').replaceChildren(document.createTextNode(fmtClock.format(now)),(()=>{const seconds=document.createElement('span');seconds.className='seconds';seconds.textContent=':'+String(now.getSeconds()).padStart(2,'0');return seconds;})());setText('date',fmtDate.format(now));scheduleTick(now);}
function demoMode(){
 const danger=demo==='alarm';$('demo-watermark').hidden=false;alertState(danger?'alarm':demo==='yellow'?'yellow':'clear','ТЕСТ · 12:45',Date.now());connection(true,'ДЕМОНСТРАЦІЯ');setText('map-time','ТЕСТОВИЙ РЕЖИМ');
 regionStatus=new Map(danger?[['lvivska','red'],['kharkivska','red'],['donetska','yellow']]:[['kharkivska','red'],['donetska','yellow']]);
 districtStatus=new Map([['brovarskii-raion',{aliases:['Броварський район','Brovarskyi district','brovarskii-raion'],level:'yellow'}],['sumskii-raion',{aliases:['Сумський район','Sumy district'],level:'yellow'}],['shostkynskyi-raion',{aliases:['Шосткинський район','Shostka district'],level:'red'}]]);
 lastGlobalAlerts=[];setText('map-stats','ТЕСТОВІ СТАТУСИ');
 const now=new Date();const base=dateKeyInTZ(now);
 showWeather({temperature_2m:12,apparent_temperature:9,weather_code:3,wind_speed_10m:13,time:base+'T13:00'},
  {time:[base,base,base,base,base],temperature_2m_max:[14,13,12,11,10],temperature_2m_min:[7,6,5,4,3],weather_code:[3,2,61,71,3],precipitation_probability_max:[10,20,40,55,15]},'ТЕСТ');
 drawMap();
}
clockTick();setInterval(()=>{clockTick();updateAlarmAnimation();},1000);if(demo)demoMode();loadGeometry();
if(!demo){pollAlerts();pollWeather();setInterval(pollAlerts,45000);setInterval(pollWeather,600000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){pollAlerts();pollWeather();}});setInterval(()=>{if(lastGood&&Date.now()-lastGood>210000){regionStatus.clear();districtStatus.clear();alertState('unknown','ЗАСТАРІЛІ ДАНІ');connection(false,'ДЖЕРЕЛО НЕДОСТУПНЕ');drawMap();}},30000);}
})();
