/* VLNASV map aliases. Keep old and current names mapped to the same district ID.
 * This file contains names only: it never invents an air-raid alert.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.VLNASVGeoAliases=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const groups={
    'sheptytskyi': [
      'Шептицький','Червоноградський','Sheptytskyi','Sheptytsky','Sheptytskii',
      'Chervonohradskyi','Chervonohradsk','Chervonogradsky','Chervonogradskiy',
      'шептицьк','червоноградськ','sheptytsk','chervonohrad','chervonograd'
    ],
    'samarivskyi': [
      'Самарівський','Новомосковський','Samarivskyi','Samarivsky',
      'Novomoskovskyi','Novomoskovsk','Novomoskovsky','самарівськ','новомосковськ'
    ],
    'siverskodonetskyi': [
      'Сіверськодонецький','Сєвєродонецький','Северодонецький','Северодонецкий',
      'Сіверодонецький','Siverskodonetskyi','Siverskodonetsk','Sievierodonetskyi',
      'Sievierodonetsk','Sievierodonetsky','Severodonetskyi','Severodonetsk',
      'Severodoneck','Syevierodonetskyi','сєвєродон','сіверськодон','северодон'
    ],
    'zviahelskyi': [
      'Звягельський','Новоград-Волинський','Новоград Волинський',
      'Zviahelskyi','Zviahel','Zvyagelsky','Zvyagel',
      'Novohrad-Volynskyi','Novohrad-Volynsky','Novograd-Volynskyi',
      'Novograd-Volynsky','Novograd-Volynskiy','новоградволин','звягельськ'
    ],
    'berestynskyi': [
      'Берестинський','Красноградський','Berestynskyi','Berestynsky',
      'Krasnohradskyi','Krasnogradskyi','Krasnogradsky','берестинськ','красноградськ'
    ]
  };
  function norm(v){return String(v||'').toLocaleLowerCase('uk-UA').normalize('NFC')
    .replace(/[ʼ’'`\u2019\s._–—\-]/g,'')
    .replace(/\b(район|раион|raion|rayon|district)\b/gu,'')
    .replace(/район|раион|raion|rayon|district/gu,'');}
  // Full normalized variants and their stems, limited to explicitly known aliases.
  const aliasIndex=new Map();
  for(const [id,names] of Object.entries(groups)){
    for(const name of names){
      const n=norm(name);
      if(n)aliasIndex.set(n,id);
    }
  }
  function districtKey(value){
    const n=norm(value);
    if(!n)return '';
    if(aliasIndex.has(n))return aliasIndex.get(n);
    // Handle API slugs with inflection suffixes, never by a 3-letter substring.
    for(const [alias,id] of aliasIndex){
      if(alias.length>=7&&(n.startsWith(alias)||alias.startsWith(n)&&n.length>=7))return id;
    }
    return n;
  }
  function matches(a,b){const x=districtKey(a),y=districtKey(b);return Boolean(x&&y&&x===y);}
  const districtPropertyNames=[
    'name','NAME_2','name_2','Name_2','NAME','name_uk','name_UA','name_ru',
    'shapeName','rayon','rayon_name','raion','raion_name','district','district_name',
    'ADM2_UA','ADMIN2','NAME_UA','ukr_name','title','region_2','namer','name_new'
  ];
  function namesFromFeature(feature){
    const p=feature?.properties||{};
    const names=districtPropertyNames.map(k=>p[k]).filter(v=>typeof v==='string'&&v.trim());
    // Some older GeoJSON dumps only use nonstandard property keys.
    if(!names.length){
      for(const [k,v] of Object.entries(p)){
        if(typeof v==='string'&&v.length<90&&!/oblast|region|admin1|parent/i.test(k))names.push(v);
      }
    }
    return [...new Set(names)];
  }
  function findMatch(feature,region,entries){
    const names=namesFromFeature(feature);
    let best=null,score=-1;
    for(const entry of entries){
      if(region&&entry.oblast&&region!==entry.oblast)continue;
      const matched=names.some(name=>entry.aliases.some(alias=>matches(name,alias)));
      if(!matched)continue;
      const currentScore=region&&entry.oblast===region?3:region&&!entry.oblast?2:1;
      if(currentScore>score){best=entry;score=currentScore;}
    }
    return best;
  }
  function isKyivCity(item){
    const slug=norm(item?.slug),name=norm(item?.name_uk||item?.name||item?.name_en);
    // Kyiv Oblast must NOT be interpreted as the separate city.
    return ['kyiv','kiev','kyivcity','kievcity','cityofkyiv','cityofkiev','містокиїв','мкиїв','київмісто'].includes(slug)
      || ['київ','містокиїв','мкиїв','kyivcity','kievcity','cityofkyiv','cityofkiev'].includes(name);
  }
  return {norm,districtKey,matches,namesFromFeature,findMatch,isKyivCity,groups};
});
