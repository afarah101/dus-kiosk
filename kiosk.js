// Masjid Daar Us Sunnah — entrance signage TV controller.
// Static 6-panel community board (topbar + Next Prayer ring, Upcoming Events,
// Prayer Times list, Daily Reminder, Contact Information). No slide rotation.
// Single unified theme (designer mockup) — no dark theme, no [data-theme].
// Live from Firestore: prayerTimes, oneOffEvents, lessons. Verses are HARDCODED — see VERSES below.
//
// Firestore structure (path logged on read):
//   prayerTimes/{YYYY-MM}   -> { entries:[ {_dayNum, d, f,fj, s, z,zj, a,aj, m, i,ij}, ... ] }
//   oneOffEvents/{id}       -> {title,speaker,location,description?,time,date,isoDate,poster}
//   lessons/{id}            -> {day,title,time,desc,teacher|speaker,cancelled,cancelledThisWeek}
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, doc, getDoc, collection, getDocs }
  from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const LOG = '[kiosk]';
const REMINDER_ROTATE_MS = 15000;   // Daily Reminder panel advances on its own timer

const state = {
  prayer:  { data:null, error:null, path:null, sunrise:null },
  events:  { list:[], error:null, path:'oneOffEvents' },
  lessons: { list:[], error:null, path:'lessons' },
};

// ---- Contact info: static, no Firestore collection backs this. ----
// WhatsApp QR image asset not yet provided — see qrCodeSvg() below.
const CONTACT = {
  contactUs:  { role:"Contact Us", subtitle:"Masjid Admin", avatar:"AD", phone:"+44 7535 545816", email:"admin@dusunnah.com" },
  management: { role:"Masjid Management", name:"Daar Us Sunnah Office", phone:"020 7946 0958" },
  whatsapp:   { lead:"Message the Imam" },
};

// ---- HARDCODED verses (Muhsin Khan English). Arabic on top, translation below. ----
// Daily rotation Sun–Thu/Sat; Friday auto-trigger swaps to the Jumuʿah set.
const VERSES_DAILY = [
  { ref:"Sūrah An-Nisā' [4:103]",
    ar:"فَإِذَا قَضَيْتُمُ ٱلصَّلَوٰةَ فَٱذْكُرُوا۟ ٱللَّهَ قِيَـٰمًۭا وَقُعُودًۭا وَعَلَىٰ جُنُوبِكُمْ ۚ فَإِذَا ٱطْمَأْنَنتُمْ فَأَقِيمُوا۟ ٱلصَّلَوٰةَ ۚ إِنَّ ٱلصَّلَوٰةَ كَانَتْ عَلَى ٱلْمُؤْمِنِينَ كِتَـٰبًۭا مَّوْقُوتًۭا",
    en:"When you have finished the Salat (prayer), remember Allah standing, sitting down, and lying down on your sides, but when you are free from danger, perform the Salat. Verily, the prayer is enjoined on the believers at fixed hours." },
  { ref:"Sūrah Al-Baqarah [2:153]",
    ar:"يَـٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ ۚ إِنَّ ٱللَّهَ مَعَ ٱلصَّـٰبِرِينَ",
    en:"O you who believe! Seek help in patience and the Salat (prayer). Truly, Allah is with the patient (As-Sabirin)." },
  { ref:"Sūrah Ar-Ra'd [13:28]",
    ar:"ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ",
    en:"Those who believe, and whose hearts find rest in the remembrance of Allah. Verily, in the remembrance of Allah do hearts find rest." },
  { ref:"Sūrah Al-'Ankabūt [29:45]",
    ar:"ٱتْلُ مَآ أُوحِىَ إِلَيْكَ مِنَ ٱلْكِتَـٰبِ وَأَقِمِ ٱلصَّلَوٰةَ ۖ إِنَّ ٱلصَّلَوٰةَ تَنْهَىٰ عَنِ ٱلْفَحْشَآءِ وَٱلْمُنكَرِ ۗ وَلَذِكْرُ ٱللَّهِ أَكْبَرُ ۗ وَٱللَّهُ يَعْلَمُ مَا تَصْنَعُونَ",
    en:"Recite what has been revealed to you of the Book, and perform the Salat. Verily, the Salat prevents from Al-Fahsha (great sins) and Al-Munkar (evil deeds), and the remembering of Allah is greater. And Allah knows what you do." },
  { ref:"Sahih Muslim 713",
    ar:"اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ",
    en:"O Allah, open for me the doors of Your mercy." },
  { ref:"Sahih Muslim 713",
    ar:"اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ",
    en:"O Allah, I ask You of Your favor." },
];
const VERSES_FRIDAY = [
  { ref:"Sūrah Al-Jumuʿah [62:9]",
    ar:"يَـٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوٓا۟ إِذَا نُودِىَ لِلصَّلَوٰةِ مِن يَوْمِ ٱلْجُمُعَةِ فَٱسْعَوْا۟ إِلَىٰ ذِكْرِ ٱللَّهِ وَذَرُوا۟ ٱلْبَيْعَ ۚ ذَٰلِكُمْ خَيْرٌۭ لَّكُمْ إِن كُنتُمْ تَعْلَمُونَ",
    en:"O you who believe! When the call is proclaimed for the Salat (prayer) on Friday (Jumuʿah), come to the remembrance of Allah and leave off business. That is better for you if you did but know!" },
  { ref:"Sūrah Al-Aḥzāb [33:56]",
    ar:"إِنَّ ٱللَّهَ وَمَلَـٰٓئِكَتَهُۥ يُصَلُّونَ عَلَى ٱلنَّبِىِّ ۚ يَـٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ صَلُّوا۟ عَلَيْهِ وَسَلِّمُوا۟ تَسْلِيمًا",
    en:"Allah sends His Salat (Graces, Honours, Blessings, Mercy) on the Prophet (Muhammad), and also His angels. O you who believe! Send your Salat on him, and greet him with the Islamic greeting." },
];
// which verse set applies today (Friday = day 5) and rotates on a timer
function versesForToday(){ return new Date().getDay()===5 ? VERSES_FRIDAY : VERSES_DAILY; }
let verseIndex = 0;

const $ = (s,r=document)=>r.querySelector(s);
const el = (tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
// Arabic element: isolated RTL so Quranic marks & bidi never leak into layout
const ar = (cls,txt)=>{const e=el('span',cls,txt);e.setAttribute('dir','rtl');e.setAttribute('lang','ar');e.style.unicodeBidi='isolate';return e;};
const pad = n => String(n).padStart(2,'0');
// Local calendar-day key (YYYY-MM-DD). NOT date.toISOString().slice(0,10) — that
// converts to UTC first, so in any UTC+ timezone (this runs in Europe/London,
// BST=UTC+1 in summer) a local midnight can shift into the *previous* UTC day,
// silently merging e.g. Saturday's events into Friday's day-bucket.
const localDateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

// ---- date / time helpers ---------------------------------------------------
function monthKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; }
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
// next calendar date (today or later) matching a weekday name, e.g. "Tuesday"
function nextOccurrence(dayName, fromDate=new Date()){
  const idx = DAYS.findIndex(d=>d.toLowerCase()===String(dayName||'').trim().toLowerCase());
  if(idx<0) return null;
  const d=new Date(fromDate); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + ((idx - d.getDay() + 7) % 7));
  return d;
}

function englishDate(d){ return d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }
function hijriDate(d){
  try{ return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',
    {day:'numeric',month:'long',year:'numeric',weekday:'long'}).format(d); }
  catch(_){ return ''; }
}
function timeOnDate(base, raw){
  if(raw==null) return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if(!m) return null;
  let h=parseInt(m[1],10); const min=parseInt(m[2],10); const ap=m[3]?m[3].toLowerCase():null;
  if(ap==='pm' && h<12) h+=12;
  if(ap==='am' && h===12) h=0;
  const d=new Date(base); d.setHours(h,min,0,0); return d;
}
function fmt12(raw){ const d=timeOnDate(new Date(),raw); return d?fmtHM(d):(raw?String(raw):'—'); }
function fmtHM(d){ let h=d.getHours(),m=d.getMinutes(); const ap=h>=12?'PM':'AM'; h=h%12||12; return `${h}:${pad(m)} ${ap}`; }
function fmtMins(ms){ const m=Math.max(0,Math.round(ms/60000)); if(m<60) return m+'m'; const h=Math.floor(m/60),mm=m%60; return mm?`${h}h ${mm}m`:`${h}h`; }
function toDate(v){ if(!v) return null; if(typeof v?.toDate==='function') return v.toDate(); const d=new Date(v); return isNaN(d)?null:d; }
function pick(obj, keys){ for(const k of keys){ if(obj && obj[k]!=null && obj[k]!=='') return obj[k]; } return null; }

// ---- prayer definitions (6 rows: Fajr, Dhuhr, Asr, Maghrib, Isha, Jumu'ah) --
const PRAYERS = [
  {id:'fajr',   label:'Fajr',    ar:'الفجر'},
  {id:'dhuhr',  label:'Dhuhr',   ar:'الظهر'},
  {id:'asr',    label:'Asr',     ar:'العصر'},
  {id:'maghrib',label:'Maghrib', ar:'المغرب'},
  {id:'isha',   label:'Isha',    ar:'العشاء'},
  {id:'jumuah', label:"Jumu'ah", ar:'الجمعة'},
];

// ============================================================================
//  DATA LOADING — every read wrapped; failure => console.error(reason + path)
// ============================================================================
async function loadConfig(){
  let res;
  try{ res = await fetch('/api/config',{cache:'no-store'}); }
  catch(e){ throw {code:'config-missing', detail:`fetch /api/config failed: ${e.message}`}; }
  if(!res.ok) throw {code:'config-missing', detail:`/api/config returned ${res.status}`};
  const cfg = await res.json();
  if(!cfg.apiKey || !cfg.projectId) throw {code:'config-missing', detail:'apiKey/projectId absent from /api/config'};
  return cfg;
}
function reasonFor(err){
  const c=(err && (err.code||err.message))||'unknown-error';
  if(String(c).includes('permission-denied')) return 'permission-denied';
  return String(c);
}

async function loadPrayer(db){
  const today=new Date(), mk=monthKey(today), dayNum=today.getDate();
  const path=`prayerTimes/${mk} [entry _dayNum=${dayNum}]`;
  state.prayer.path=path;
  console.info(`${LOG} reading prayer doc:`, path);
  try{
    const snap=await getDoc(doc(db,'prayerTimes',mk));
    if(!snap.exists()){
      state.prayer.error='no-doc-for-today';
      console.error(`${LOG} prayer read failed -> reason=no-doc-for-today path=prayerTimes/${mk}`);
      return;
    }
    const entries=snap.data().entries||[];
    const row=entries.find(e=>String(e._dayNum)===String(dayNum))
            || entries.find(e=>String(pick(e,['d'])||'').startsWith(String(dayNum)+' '));
    if(!row){
      state.prayer.error='no-doc-for-today';
      console.error(`${LOG} prayer read failed -> reason=no-entry-for-day path=prayerTimes/${mk} _dayNum=${dayNum}`);
      return;
    }
    state.prayer.data={
      fajr:   {begin:row.f, iqama:row.fj},
      dhuhr:  {begin:row.z, iqama:row.zj},
      asr:    {begin:row.a, iqama:row.aj},
      maghrib:{begin:row.m, iqama:null},
      isha:   {begin:row.i, iqama:row.ij},
      jumuah: {begin:row.zj, iqama:row.zj},
    };
    state.prayer.sunrise=row.s||null;
    console.info(`${LOG} prayer entry loaded for _dayNum=${dayNum}`);
  }catch(e){
    state.prayer.error=reasonFor(e);
    console.error(`${LOG} prayer read failed -> reason=${reasonFor(e)} path=prayerTimes/${mk}`, e);
  }
}

async function loadEvents(db){
  console.info(`${LOG} reading collection:`, 'oneOffEvents');
  try{
    const snap=await getDocs(collection(db,'oneOffEvents'));
    state.events.list=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(!state.events.list.length) console.error(`${LOG} events empty -> reason=no-doc-for-today path=oneOffEvents`);
    else console.info(`${LOG} events loaded (${state.events.list.length})`);
  }catch(e){
    state.events.error=reasonFor(e);
    console.error(`${LOG} events read failed -> reason=${reasonFor(e)} path=oneOffEvents`, e);
  }
}
async function loadLessons(db){
  console.info(`${LOG} reading collection:`, 'lessons');
  try{
    const snap=await getDocs(collection(db,'lessons'));
    state.lessons.list=snap.docs.map(d=>({id:d.id,...d.data()}))
      .filter(l=>pick(l,['day']) && pick(l,['title']) && l.cancelled!==true);
    if(!state.lessons.list.length){ state.lessons.error='no-doc-for-today'; console.error(`${LOG} lessons empty -> reason=no-doc-for-today path=lessons`); }
    else console.info(`${LOG} lessons loaded (${state.lessons.list.length})`);
  }catch(e){
    state.lessons.error=reasonFor(e);
    console.error(`${LOG} lessons read failed -> reason=${reasonFor(e)} path=lessons`, e);
  }
}

// Combine one-off events + recurring weekly lessons into one chronologically sorted list,
// windowed to the next 7 days (today through today+7). Lessons are projected onto their
// next real calendar occurrence; a lesson cancelled this week rolls to the following week
// rather than showing a date it won't actually happen.
// Firestore's lessons.desc field conflates description with teacher
// attribution in one freeform sentence run (e.g. "Lesson in Russian. Taught
// by Ustādh Abu Mūsā."), and there's no separate structured field to read
// instead. Verified against all 11 real lesson docs: "Taught by ... ." always
// appears as a clean trailing clause ending at the next period, so stripping
// it is safe and doesn't touch genuine description text before it.
function stripTeacherAttribution(desc){
  if(!desc) return null;
  const cleaned=String(desc).replace(/Taught by[^.]*\.?/gi,'').trim();
  return cleaned || null;
}

// Location isn't reliable from Firestore for either collection — lessons
// never carry the field at all, and oneOffEvents only carries it
// inconsistently (verified against the live schema) — so this is a fixed,
// explicit title-based mapping instead, per product decision, not a
// Firestore read. "Sisters Class" is the one exception; everything else
// defaults to the main hall.
function locationForTitle(title){
  return /sisters/i.test(String(title||'')) ? "Sisters' Section" : 'Main Prayer Hall';
}

function combinedSchedule(){
  const now=new Date();
  const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const weekEnd=new Date(todayStart.getTime()+7*864e5);
  const events=state.events.list.map(ev=>{
    const title=String(pick(ev,['title','name'])||'Event');
    const desc=pick(ev,['description','desc','details','info']);
    return {
      date: toDate(pick(ev,['isoDate','date','datetime','start'])),
      title, desc,
      time: pick(ev,['time']),
      location: locationForTitle(title),
    };
  }).filter(x=>x.date);

  const lessons=state.lessons.list.map(les=>{
    let date=nextOccurrence(pick(les,['day','weekday']));
    if(!date) return null;
    if(les.cancelledThisWeek===true) date=new Date(date.getTime()+7*864e5);
    const title=String(pick(les,['title','name'])||'Lesson');
    const rawDesc=pick(les,['desc','description']);
    return {
      date, title,
      desc: stripTeacherAttribution(rawDesc),
      time: pick(les,['time','start']),
      location: locationForTitle(title),
    };
  }).filter(Boolean);

  return [...events,...lessons]
    .filter(x=>x.date>=todayStart && x.date<weekEnd)
    .sort((a,b)=>a.date-b.date || String(a.time||'').localeCompare(String(b.time||'')));
}

// ============================================================================
//  SCHEDULE / RING MATH
// ============================================================================
function computeSchedule(){
  const base=new Date(), isFriday=base.getDay()===5;
  const rows=PRAYERS.map(p=>{
    const t=state.prayer.data?state.prayer.data[p.id]:null;
    return {...p, begin:t?t.begin:null, iqama:t?t.iqama:null, at:t?timeOnDate(base,t.begin):null};
  });
  const now=base.getTime();
  const eligible=rows.filter(r=>r.at && (r.id!=='jumuah' || isFriday));
  let next=eligible.filter(r=>r.at.getTime()>now).sort((a,b)=>a.at-b.at)[0]||null;
  let rollover=false;
  if(!next){ const fajr=rows.find(r=>r.id==='fajr' && r.at); if(fajr){ next={...fajr, at:new Date(fajr.at.getTime()+864e5)}; rollover=true; } }
  return {rows,next,rollover,now};
}

// Ring geometry matches the mockup's SVG exactly (viewBox 0 0 240 240, r=112).
const RING_R = 112, RING_C = 2*Math.PI*RING_R;
// progress = how far through the window between the previous prayer and the next one
function ringProgress(sched){
  if(!sched.next) return 0;
  const rows=sched.rows.filter(r=>r.at && (r.id!=='jumuah' || new Date().getDay()===5));
  const idx=rows.findIndex(r=>r.id===sched.next.id);
  let prevAt;
  if(sched.rollover){
    const isha=rows.find(r=>r.id==='isha');
    prevAt = isha ? isha.at : new Date(new Date().setHours(0,0,0,0));
  } else if(idx>0){
    prevAt = rows[idx-1].at;
  } else {
    prevAt = new Date(new Date().setHours(0,0,0,0));
  }
  const total=sched.next.at.getTime()-prevAt.getTime();
  if(total<=0) return 0;
  return Math.min(1, Math.max(0, (Date.now()-prevAt.getTime())/total));
}

// ============================================================================
//  PANEL RENDERERS — each panel is independent; empty data = title-only, never absence text
// ============================================================================
function renderRingPanel(){
  const panel=$('#panel-ring');
  // Keep the static hero-eyebrow (first child, from index.html); rebuild only
  // the dynamic ring/jamā'ah content beneath it.
  while(panel.children.length>1) panel.removeChild(panel.lastChild);
  if(!state.prayer.data) return;

  const wrap=el('div','ring-wrap');
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 240 240'); svg.classList.add('ring'); svg.setAttribute('aria-hidden','true');
  const track=document.createElementNS(svgNS,'circle');
  track.setAttribute('cx','120'); track.setAttribute('cy','120'); track.setAttribute('r',String(RING_R));
  track.classList.add('ring-track');
  const prog=document.createElementNS(svgNS,'circle');
  prog.setAttribute('cx','120'); prog.setAttribute('cy','120'); prog.setAttribute('r',String(RING_R));
  prog.classList.add('ring-prog'); prog.id='ringProg';
  prog.style.strokeDasharray=String(RING_C);
  svg.append(track,prog);

  const center=el('div','ring-center');
  const nameAr=ar('hero-ar',''); nameAr.id='cdAr';
  const time=el('div','cd-time','0:00:00'); time.id='cdTime';
  const nameEn=el('div','hero-en',''); nameEn.id='cdName';
  center.append(nameAr,time,nameEn);

  wrap.append(svg,center);
  panel.append(wrap);

  const jam=el('div','hero-jam',''); jam.id='cdJam';
  panel.append(jam);

  tickRing();
}

function tickRing(){
  const time=$('#cdTime'); if(!time) return;   // ring not rendered (no prayer data)
  const sched=computeSchedule();
  const nameAr=$('#cdAr'), nameEn=$('#cdName');
  const prog=$('#ringProg'), trg=$('#cdJam');
  if(!sched.next){ time.textContent='0:00:00'; return; }
  nameAr.textContent = sched.next.ar;
  nameEn.textContent = sched.rollover ? 'FIRST: '+sched.next.label.toUpperCase() : sched.next.label.toUpperCase();
  const diff=Math.max(0,Math.floor((sched.next.at.getTime()-Date.now())/1000));
  const h=Math.floor(diff/3600), m=Math.floor(diff%3600/60), s=diff%60;
  time.textContent = (h>0?h+':':'')+pad(m)+':'+pad(s);
  if(prog) prog.style.strokeDashoffset = String(RING_C*(1-ringProgress(sched)));
  if(trg){
    const jAt = sched.next.iqama ? timeOnDate(new Date(),sched.next.iqama) : sched.next.at;
    if(jAt && !sched.rollover){ trg.textContent=`Jamā'ah in ${fmtMins(jAt.getTime()-Date.now())}`; trg.style.visibility='visible'; }
    else { trg.style.visibility='hidden'; }
  }
}

function renderPrayersPanel(){
  const list=$('#prayerList'); list.innerHTML='';
  if(!state.prayer.data) return;
  const sched=computeSchedule();
  sched.rows.forEach(r=>{
    const isNext = sched.next && r.id===sched.next.id && !sched.rollover;
    const row=el('div','prow'+(isNext?' next':'')+(r.id==='jumuah'?' jumuah':''));
    const meta=el('div','pmeta');
    meta.append(el('span','pname', r.label));
    meta.append(ar('par', r.ar));
    if(r.id==='jumuah') meta.append(el('span','fritag','Fri'));
    if(isNext) meta.append(el('span','pill-next','Next'));
    row.append(meta);
    row.append(el('span','ptime', r.begin?fmt12(r.begin):'—'));
    list.append(row);
  });
}

// Caps items per day (not just a flat total) so a single busy day can't crowd the
// rest of the week out of a fixed-height panel — combinedSchedule() already windows
// to 7 days. Today + the upcoming Saturday/Sunday are prioritized first, since a
// parent checking this board on any weekday still needs to see what's on this
// weekend; remaining slots fill with the nearest other weekdays.
function weekEventsForDisplay(perDayCap, totalDaysCap){
  const all=combinedSchedule();   // already 7-day windowed & chronologically sorted
  const byDay=new Map();
  for(const item of all){
    const key=localDateKey(item.date);
    if(!byDay.has(key)) byDay.set(key,[]);
    byDay.get(key).push(item);
  }
  const dayKeys=[...byDay.keys()];   // chronological, since `all` is sorted
  const weekendKeys=dayKeys.filter(k=>{
    const [y,m,d]=k.split('-').map(Number);
    const day=new Date(y,m-1,d).getDay();
    return day===0 || day===6;   // Sunday=0, Saturday=6
  });
  const todayKey=localDateKey(new Date());
  const selected=[];
  if(dayKeys.includes(todayKey)) selected.push(todayKey);
  for(const k of weekendKeys) if(!selected.includes(k)) selected.push(k);
  for(const k of dayKeys) if(!selected.includes(k) && selected.length<2) selected.push(k);
  const selectedSet=new Set(selected.slice(0,totalDaysCap));

  const items=[];
  for(const key of dayKeys){   // chronological order, not priority order
    if(!selectedSet.has(key)) continue;
    items.push(...byDay.get(key).slice(0,perDayCap));
  }
  return items;
}

function renderEventsPanel(){
  const list=$('#eventsList'); list.innerHTML='';
  // perDayCap=2 so a weekend day with more than one event isn't silently
  // truncated to a single item; totalDaysCap=3 guarantees 3 events display
  // even when the weekend itself only carries 1-2.
  const items=weekEventsForDisplay(2,3);
  items.forEach(item=>{
    const wd=item.date.toLocaleDateString('en-GB',{weekday:'short'});
    const mo=item.date.toLocaleDateString('en-GB',{month:'short'});
    const row=el('div','event');

    const dateBox=el('div','edate');
    dateBox.append(el('div','ewd', `${wd} ${mo}`));
    dateBox.append(el('div','eday', String(item.date.getDate())));
    row.append(dateBox);

    const info=el('div','einfo');
    info.append(el('div','etitle', item.title));
    if(item.desc) info.append(el('div','edesc', item.desc));
    row.append(info);

    // Lessons have no `location` field in Firestore (verified against the
    // live schema) — locationForTitle() always resolves one anyway, so this
    // branch is effectively always populated for both events and lessons.
    if(item.time || item.location){
      const meta=el('div','emeta');
      if(item.time) meta.append(el('div','etime', String(item.time)));
      if(item.location) meta.append(el('div','eloc', item.location));
      row.append(meta);
    }
    list.append(row);
  });
}

function renderReminderPanel(){
  const isFriday=new Date().getDay()===5;
  const title=$('#reminderTitle'); if(title) title.textContent = isFriday ? 'Jumuʿah Reminder' : 'Daily Reminder';
  const set=versesForToday();
  const v=set[verseIndex % set.length];
  $('#remAr').textContent = v.ar;
  $('#remTr').textContent = '“'+v.en+'”';
  $('#remRef').textContent = '— '+v.ref;
}
function advanceReminder(){
  verseIndex = (verseIndex+1) % versesForToday().length;
  renderReminderPanel();
}

// Two-letter avatar initials — first letter of the first two words at least
// 3 characters long, so short connector words ("Us", "Of") get skipped
// (e.g. "Daar Us Sunnah Office" -> "DS", not "DU").
function initials(name){
  const words=String(name||'').split(/\s+/).filter(w=>w.length>2);
  return words.slice(0,2).map(w=>w[0].toUpperCase()).join('') || '?';
}

// Feather Icons "phone" glyph (MIT licensed).
function phoneIcon(){
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(svgNS,'path');
  path.setAttribute('d','M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z');
  svg.append(path);
  return svg;
}

// WhatsApp glyph (from the designer mockup, verbatim).
function whatsappIcon(){
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(svgNS,'path');
  path.setAttribute('d','M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.8.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3z');
  svg.append(path);
  return svg;
}

function renderContactPanel(){
  const list=$('#contactList'); list.innerHTML='';

  // "Contact Us" row uses the same avatar+crole+cname structure as Masjid
  // Management below, but still rendered separately (not folded into that
  // shared forEach) because it also carries a second, stacked email line
  // (.cphone-stack/.cemail) that Masjid Management's row doesn't have.
  const cu=CONTACT.contactUs;
  const cuRow=el('div','crow');
  cuRow.append(el('div','avatar', cu.avatar));
  const cuInfo=el('div','cinfo');
  cuInfo.append(el('div','crole', cu.role));
  cuInfo.append(el('div','cname', cu.subtitle));
  cuRow.append(cuInfo);
  const cuMeta=el('div','cphone-stack');
  const cuPhone=el('div','cphone');
  cuPhone.append(phoneIcon());
  cuPhone.append(document.createTextNode(cu.phone));
  cuMeta.append(cuPhone);
  cuMeta.append(el('div','cemail', cu.email));
  cuRow.append(cuMeta);
  list.append(cuRow);

  [CONTACT.management].forEach(c=>{
    const row=el('div','crow');
    row.append(el('div','avatar', initials(c.name)));
    const info=el('div','cinfo');
    info.append(el('div','crole', c.role));
    info.append(el('div','cname', c.name));
    row.append(info);
    const phone=el('div','cphone');
    phone.append(phoneIcon());
    phone.append(document.createTextNode(c.phone));
    row.append(phone);
    list.append(row);
  });

  const qrRow=el('div','cqr');
  const qr=el('div','qr');
  const qrImg=document.createElement('img');
  qrImg.src='assets/whatsapp-qr.png';
  qrImg.alt="WhatsApp QR code for Masjid Daar us Sunnah — scans to wa.me/447535545816";
  qr.append(qrImg);
  qrRow.append(qr);
  const txt=el('div','cqr-txt');
  const t1=el('div','t1');
  t1.append(whatsappIcon());
  t1.append(document.createTextNode(CONTACT.whatsapp.lead));
  txt.append(t1);
  txt.append(el('div','t2', 'Scan to chat on WhatsApp'));
  qrRow.append(txt);
  list.append(qrRow);
}

// ============================================================================
//  CLOCK / TIMERS
// ============================================================================
function tickClock(){
  const now=new Date();
  const dline=$('#dateline'); if(dline) dline.textContent=now.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long'});
  const clk=$('#clock'); if(clk) clk.textContent=fmtHM(now);
}
function setHeaderHijri(){
  const h=$('#hijri'); if(h) h.textContent=hijriDate(new Date());
}
function startTimers(){
  setInterval(()=>{ tickRing(); tickClock(); }, 1000);
  setInterval(setHeaderHijri, 60000);
  setInterval(advanceReminder, REMINDER_ROTATE_MS);
  startUpdateChecks();
}

// ============================================================================
//  SELF-UPDATE POLLING — this is an unattended kiosk display with no way for
//  anyone to manually refresh it, so it has to notice its own new deploys.
//  Fetches its own source (kiosk.js) rather than a separate version-marker
//  file: this file changes on every real deploy already, so a dedicated
//  marker would just be one more file to remember to touch/keep in sync for
//  no real benefit. Hash-compares against the version that's actually
//  running (captured on the first check, right after boot) rather than
//  diffing raw text — cheaper to store/compare and avoids false positives
//  from incidental whitespace-only or encoding differences.
// ============================================================================
const UPDATE_CHECK_MS = 7*60*1000;   // 7 min — middle of the requested 5-10 min range
let runningSourceHash = null;

async function sha256Hex(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function checkForUpdate(){
  try{
    // cache:'no-store' + a timestamp query param: belt-and-braces against
    // both the browser's own HTTP cache and any CDN/edge cache Vercel puts
    // in front of the static file — either alone can silently serve a stale
    // copy, which would either mask a real update or (worse) make an
    // unchanged file look different every time from a cache-varying response.
    const res = await fetch(`kiosk.js?_=${Date.now()}`, {cache:'no-store'});
    if(!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const hash = await sha256Hex(await res.text());
    if(runningSourceHash===null){
      runningSourceHash = hash;   // first check just establishes the baseline — never reloads
      return;
    }
    if(hash!==runningSourceHash){
      console.info(`${LOG} new deploy detected, reloading`);
      location.reload();
    }
  }catch(e){
    // Network blip / transient failure — never reload or surface an error
    // for a single failed check; just try again next interval.
    console.error(`${LOG} update check failed (will retry next interval):`, e.message);
  }
}

function startUpdateChecks(){
  checkForUpdate();   // establish the baseline hash immediately, not after the first 7-minute wait
  setInterval(checkForUpdate, UPDATE_CHECK_MS);
}

// ============================================================================
//  BOOT
// ============================================================================
async function boot(){
  tickClock(); setHeaderHijri();
  renderReminderPanel();   // hardcoded verse — no data dependency, show immediately
  renderContactPanel();    // static placeholder — no data dependency, show immediately

  let db=null;
  try{
    const cfg=await loadConfig();
    const app=initializeApp({apiKey:cfg.apiKey, projectId:cfg.projectId, authDomain:`${cfg.projectId}.firebaseapp.com`});
    db=getFirestore(app);
    console.info(`${LOG} firebase initialised for project`, cfg.projectId);
    await Promise.allSettled([loadPrayer(db), loadEvents(db), loadLessons(db)]);
  }catch(e){
    const reason=e.code||e.detail||e.message||'config-missing';
    console.error(`${LOG} config/init failed -> reason=config-missing detail=${reason}`);
  }

  renderRingPanel();
  renderPrayersPanel();
  renderEventsPanel();
  startTimers();
  console.info(`${LOG} render complete`);
}
document.addEventListener('DOMContentLoaded',boot);
