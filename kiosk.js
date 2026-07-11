// Masjid Daar Us Sunnah — entrance signage TV controller.
// Static 6-panel community board (topbar + Next Prayer ring, Upcoming Events,
// Prayer Times list, Daily Reminder, Contact Information). No slide rotation.
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
const REMINDER_ROTATE_MS = 15000;   // Daily Reminder panel now advances on its own timer (was slide-driven)

// ---- theme: light (DUS App v5 terracotta/cream) is the sole permanent theme. ----
// Dark theme's CSS block stays in style.css in case it's wanted again later,
// but nothing here can select it — no default, no ?theme= override, no
// time-of-day logic. Applied immediately (not waiting on DOMContentLoaded)
// so there's no flash of the wrong theme on load.
const THEME = 'light';
document.documentElement.dataset.theme = THEME;

const state = {
  prayer:  { data:null, error:null, path:null, sunrise:null },
  events:  { list:[], error:null, path:'oneOffEvents' },
  lessons: { list:[], error:null, path:'lessons' },
};

// ---- Contact info: static, no Firestore collection backs this. ----
// WhatsApp QR image asset not yet provided — flagged as pending below, not fabricated.
const CONTACT = {
  imam:       { role:"Imam & Khatib",     name:"Abu Amarah",            phone:"020 7946 0111" },
  management: { role:"Masjid Management", name:"Daar Us Sunnah Office", phone:"020 7946 0958" },
  whatsapp:   { role:"WhatsApp Updates",  lead:"Message the Imam", tail:"— scan to chat on WhatsApp" },
};

// ---- HARDCODED verses (Muhsin Khan English). Arabic on top, translation below. ----
// Daily rotation Sun–Thu/Sat; Friday auto-trigger swaps to the Jumuʿah set.
const VERSES_DAILY = [
  { kicker:"The Noble Qur’an", ref:"Sūrah An-Nisā' [4:103]",
    ar:"فَإِذَا قَضَيْتُمُ ٱلصَّلَوٰةَ فَٱذْكُرُوا۟ ٱللَّهَ قِيَـٰمًۭا وَقُعُودًۭا وَعَلَىٰ جُنُوبِكُمْ ۚ فَإِذَا ٱطْمَأْنَنتُمْ فَأَقِيمُوا۟ ٱلصَّلَوٰةَ ۚ إِنَّ ٱلصَّلَوٰةَ كَانَتْ عَلَى ٱلْمُؤْمِنِينَ كِتَـٰبًۭا مَّوْقُوتًۭا",
    en:"When you have finished the Salat (prayer), remember Allah standing, sitting down, and lying down on your sides, but when you are free from danger, perform the Salat. Verily, the prayer is enjoined on the believers at fixed hours." },
  { kicker:"The Noble Qur’an", ref:"Sūrah Al-Baqarah [2:153]",
    ar:"يَـٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ ۚ إِنَّ ٱللَّهَ مَعَ ٱلصَّـٰبِرِينَ",
    en:"O you who believe! Seek help in patience and the Salat (prayer). Truly, Allah is with the patient (As-Sabirin)." },
  { kicker:"The Noble Qur’an", ref:"Sūrah Ar-Ra'd [13:28]",
    ar:"ٱلَّذِينَ ءَامَنُوا۟ وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ ٱللَّهِ ۗ أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ",
    en:"Those who believe, and whose hearts find rest in the remembrance of Allah. Verily, in the remembrance of Allah do hearts find rest." },
  { kicker:"The Noble Qur’an", ref:"Sūrah Al-'Ankabūt [29:45]",
    ar:"ٱتْلُ مَآ أُوحِىَ إِلَيْكَ مِنَ ٱلْكِتَـٰبِ وَأَقِمِ ٱلصَّلَوٰةَ ۖ إِنَّ ٱلصَّلَوٰةَ تَنْهَىٰ عَنِ ٱلْفَحْشَآءِ وَٱلْمُنكَرِ ۗ وَلَذِكْرُ ٱللَّهِ أَكْبَرُ ۗ وَٱللَّهُ يَعْلَمُ مَا تَصْنَعُونَ",
    en:"Recite what has been revealed to you of the Book, and perform the Salat. Verily, the Salat prevents from Al-Fahsha (great sins) and Al-Munkar (evil deeds), and the remembering of Allah is greater. And Allah knows what you do." },
  { kicker:"Du’ā · Entering the Mosque", ref:"Sahih Muslim 713",
    ar:"اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ",
    en:"O Allah, open for me the doors of Your mercy." },
  { kicker:"Du’ā · Leaving the Mosque", ref:"Sahih Muslim 713",
    ar:"اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ",
    en:"O Allah, I ask You of Your favor." },
];
const VERSES_FRIDAY = [
  { kicker:"The Noble Qur’an", ref:"Sūrah Al-Jumuʿah [62:9]",
    ar:"يَـٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوٓا۟ إِذَا نُودِىَ لِلصَّلَوٰةِ مِن يَوْمِ ٱلْجُمُعَةِ فَٱسْعَوْا۟ إِلَىٰ ذِكْرِ ٱللَّهِ وَذَرُوا۟ ٱلْبَيْعَ ۚ ذَٰلِكُمْ خَيْرٌۭ لَّكُمْ إِن كُنتُمْ تَعْلَمُونَ",
    en:"O you who believe! When the call is proclaimed for the Salat (prayer) on Friday (Jumuʿah), come to the remembrance of Allah and leave off business. That is better for you if you did but know!" },
  { kicker:"The Noble Qur’an", ref:"Sūrah Al-Aḥzāb [33:56]",
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
// windowed to the next 7 days (today through today+7). Previously there was no upper
// bound at all — any future date qualified indefinitely — so events window is now the
// one deliberate scope limit; lessons were never bounded by date either since they only
// ever carried a computed .date, not an .iso string, so this now applies uniformly to both
// via the same Date-object comparison instead of two different, inconsistent checks.
// Lessons are projected onto their next real calendar occurrence; a lesson cancelled this
// week rolls to the following week rather than showing a date it won't actually happen.
// Firestore's lessons.desc field conflates description with teacher
// attribution in one freeform sentence run (e.g. "Lesson in Russian. Taught
// by Ustādh Abu Mūsā."), and there's no separate structured field to read
// instead. Verified against all 11 real lesson docs: "Taught by ... ." always
// appears as a clean trailing clause ending at the next period, so stripping
// it is safe and doesn't touch genuine description text before it — this
// must never leak the teacher name back into the Events panel display.
function stripTeacherAttribution(desc){
  if(!desc) return null;
  const cleaned=String(desc).replace(/Taught by[^.]*\.?/gi,'').trim();
  return cleaned || null;
}

function combinedSchedule(){
  const now=new Date();
  const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const weekEnd=new Date(todayStart.getTime()+7*864e5);
  // oneOffEvents has a real `location` field; lessons has none (verified
  // against the live schema) — location stays null for lessons rather than
  // guessing at a venue.
  const events=state.events.list.map(ev=>{
    const title=String(pick(ev,['title','name'])||'Event');
    const desc=pick(ev,['description','desc','details','info']);
    return {
      date: toDate(pick(ev,['isoDate','date','datetime','start'])),
      title, desc,
      time: pick(ev,['time']),
      location: pick(ev,['location','venue']),
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
      location: null,
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

const RING_R = 88, RING_C = 2*Math.PI*RING_R;
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
function panelTitle(txt){
  const f=document.createDocumentFragment();
  f.append(el('h2','panel-title',txt));
  return f;
}

function renderRingPanel(){
  const panel=$('#panel-ring'); panel.innerHTML='';
  panel.append(panelTitle('Next Prayer'));
  if(!state.prayer.data) return;

  // Thin full-circle background track (low-opacity) with the progress arc
  // drawn on top — no separate "NEXT" label (the panel title "NEXT PRAYER"
  // already says that).
  const wrap=el('div','ring-wrap');
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 200 200'); svg.classList.add('ring-svg');
  const track=document.createElementNS(svgNS,'circle');
  track.setAttribute('cx','100'); track.setAttribute('cy','100'); track.setAttribute('r',String(RING_R));
  track.classList.add('ring-track');
  const prog=document.createElementNS(svgNS,'circle');
  prog.setAttribute('cx','100'); prog.setAttribute('cy','100'); prog.setAttribute('r',String(RING_R));
  prog.classList.add('ring-progress'); prog.id='ring-progress';
  prog.style.strokeDasharray=String(RING_C);
  svg.append(track,prog);

  const inner=el('div','ring-inner');
  const nameAr=ar('ring-name-ar',''); nameAr.id='ring-name-ar';
  const time=el('div',null,'--:--:--'); time.id='ring-time';
  const nameEn=el('div',null,''); nameEn.id='ring-name-en';
  inner.append(nameAr,time,nameEn);

  wrap.append(svg,inner);

  const trg=el('div',null,''); trg.id='jamaa-trigger';

  const content=el('div','ring-content');
  content.append(wrap,trg);
  panel.append(content);

  tickRing();
}

function tickRing(){
  const ringTime=$('#ring-time'); if(!ringTime) return;   // ring not rendered (no prayer data)
  const sched=computeSchedule();
  const nameAr=$('#ring-name-ar'), nameEn=$('#ring-name-en');
  const prog=$('#ring-progress'), trg=$('#jamaa-trigger');
  if(!sched.next){ ringTime.textContent='--:--:--'; return; }
  nameAr.textContent = sched.next.ar;
  nameEn.textContent = sched.rollover ? 'FIRST: '+sched.next.label.toUpperCase() : sched.next.label.toUpperCase();
  const diff=Math.max(0,Math.floor((sched.next.at.getTime()-Date.now())/1000));
  const h=Math.floor(diff/3600), m=Math.floor(diff%3600/60), s=diff%60;
  ringTime.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
  if(prog) prog.style.strokeDashoffset = String(RING_C*(1-ringProgress(sched)));
  if(trg){
    const jAt = sched.next.iqama ? timeOnDate(new Date(),sched.next.iqama) : sched.next.at;
    if(jAt && !sched.rollover){ trg.textContent=`Jamā'ah in ${fmtMins(jAt.getTime()-Date.now())}`; trg.style.visibility='visible'; }
    else { trg.style.visibility='hidden'; }
  }
}

function renderPrayersPanel(){
  const panel=$('#panel-prayers'); panel.innerHTML='';
  panel.append(panelTitle('Prayer Times'));
  if(!state.prayer.data) return;
  const sched=computeSchedule();
  const list=el('div','prayer-list');

  // Single-column layout: prayer name + one time only. r.iqama is still
  // computed by computeSchedule() from Firestore's jamā'ah fields (fj/zj/aj/
  // ij) — the data keeps flowing, it's just not rendered on this row anymore.
  sched.rows.forEach(r=>{
    const row=el('div','prow');
    const isNext = sched.next && r.id===sched.next.id && !sched.rollover;
    if(isNext) row.classList.add('next');
    else if(r.at && r.at.getTime()<sched.now && r.id!=='jumuah') row.classList.add('passed');
    const name=el('div','prow-name');
    name.append(ar('prow-ar', r.ar));
    name.append(el('div','prow-en', r.label));
    if(isNext) name.append(el('span','prow-tag','NEXT'));
    if(r.id==='jumuah') name.append(el('span','prow-tag','FRI'));
    row.append(name);
    row.append(el('div','prow-time', r.begin?fmt12(r.begin):'—'));
    list.append(row);
  });
  panel.append(list);
}

// Caps items per day (not just a flat total) so a single busy day can't crowd the
// rest of the week out of a fixed-height panel — combinedSchedule() already windows
// to 7 days. Real capacity only fits ~3 distinct days at 1080p (measured: 4 distinct
// days overflows by 60-70px with real content, and style.css is out of scope here),
// so with 4+ relevant days in a typical week something has to be left out. Rather than
// always taking the chronologically-first days (which silently drops the weekend if
// enough near-term weekdays are busy — the exact bug reported), today + the upcoming
// Saturday/Sunday are prioritized first, since a parent checking this board on any
// weekday still needs to see what's on this weekend; remaining slots fill with the
// nearest other weekdays.
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
  for(const k of dayKeys) if(!selected.includes(k) && selected.length<totalDaysCap) selected.push(k);
  const selectedSet=new Set(selected.slice(0,totalDaysCap));

  const items=[];
  for(const key of dayKeys){   // chronological order, not priority order
    if(!selectedSet.has(key)) continue;
    items.push(...byDay.get(key).slice(0,perDayCap));
  }
  return items;
}

function renderEventsPanel(){
  const panel=$('#panel-events'); panel.innerHTML='';
  panel.append(panelTitle('Upcoming Events'));
  const items=weekEventsForDisplay(1,2);   // cap so a fixed-height TV panel never scrolls
  if(!items.length) return;   // never render "no events" text — just the title
  const wrap=el('div','events-list');
  let lastKey=null;
  items.forEach(item=>{
    const key=localDateKey(item.date);
    if(key!==lastKey){
      wrap.append(el('div','day-head', item.date.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})));
      lastKey=key;
    }
    const c=el('div','ecard');

    const badge=el('div','edate-badge');
    badge.append(el('div','edate-day', item.date.toLocaleDateString('en-GB',{weekday:'short'}).toUpperCase()));
    badge.append(el('div','edate-num', String(item.date.getDate())));
    c.append(badge);

    const content=el('div','econtent');
    // Title + description only — no separate language/audience tag, since it
    // was always redundant with the description that already says the same
    // thing (e.g. "IN RUSSIAN" badge next to a "Lesson in Russian." line).
    content.append(el('div','en', item.title));
    if(item.desc) content.append(el('div','edesc', item.desc));
    c.append(content);

    // time + location: own right-aligned zone, sibling of econtent (not
    // nested inside it) so it forms a distinct 3rd column per the reference
    // layout. Deliberately no teacher/speaker text on this panel (still read
    // from Firestore, just not rendered here). Lessons have no `location`
    // field in Firestore (verified against the live schema) — left blank
    // rather than fabricated.
    if(item.time || item.location){
      const meta=el('div','emeta');
      if(item.time) meta.append(el('div','etime', String(item.time)));
      if(item.location) meta.append(el('div','eloc', item.location));
      c.append(meta);
    }
    wrap.append(c);
  });
  panel.append(wrap);
}

function renderReminderPanel(){
  const panel=$('#panel-reminder'); panel.innerHTML='';
  const isFriday=new Date().getDay()===5;
  panel.append(panelTitle(isFriday ? 'Jumuʿah Reminder' : 'Daily Reminder'));
  const set=versesForToday();
  const v=set[verseIndex % set.length];
  const card=el('div','rcard');
  card.append(el('div','kicker', v.kicker));
  card.append(ar('arabic', v.ar));
  card.append(el('div','divider'));
  card.append(el('div','body', '“'+v.en+'”'));
  card.append(el('div','ref', '— '+v.ref));
  panel.append(card);
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

// Feather Icons "phone" glyph (MIT licensed), stroke-based to match the
// existing QR placeholder's currentColor convention.
function phoneIcon(){
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 24 24'); svg.classList.add('phone-icon');
  const path=document.createElementNS(svgNS,'path');
  path.setAttribute('d','M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z');
  path.setAttribute('fill','none'); path.setAttribute('stroke','currentColor'); path.setAttribute('stroke-width','2');
  path.setAttribute('stroke-linecap','round'); path.setAttribute('stroke-linejoin','round');
  svg.append(path);
  return svg;
}

// Generic "QR" glyph (finder-pattern corners) — NOT a functional scannable code.
// No WhatsApp QR image asset has been provided yet; this is a flagged placeholder,
// not a fabricated code. Replace with a real <img> once the asset exists.
function qrPlaceholderIcon(){
  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 48 48'); svg.classList.add('qr-icon');
  [[4,4],[30,4],[4,30]].forEach(([x,y])=>{
    const outer=document.createElementNS(svgNS,'rect');
    outer.setAttribute('x',x); outer.setAttribute('y',y); outer.setAttribute('width',14); outer.setAttribute('height',14);
    outer.setAttribute('fill','none'); outer.setAttribute('stroke','currentColor'); outer.setAttribute('stroke-width','2');
    svg.append(outer);
    const inner=document.createElementNS(svgNS,'rect');
    inner.setAttribute('x',x+4); inner.setAttribute('y',y+4); inner.setAttribute('width',6); inner.setAttribute('height',6);
    inner.setAttribute('fill','currentColor');
    svg.append(inner);
  });
  return svg;
}

function renderContactPanel(){
  const panel=$('#panel-contact'); panel.innerHTML='';
  panel.append(panelTitle('Contact Information'));

  const list=el('div','contact-list');
  [CONTACT.imam, CONTACT.management].forEach(c=>{
    const row=el('div','crow');
    row.append(el('div','crow-avatar', initials(c.name)));
    const info=el('div','crow-info');
    info.append(el('div','crow-role', c.role));
    info.append(el('div','crow-value', c.name));
    const phoneLine=el('div','crow-phone-line');
    phoneLine.append(phoneIcon());
    phoneLine.append(el('span','crow-phone', c.phone));
    info.append(phoneLine);
    row.append(info);
    list.append(row);
  });
  panel.append(list);

  const wa=el('div','wa-block');
  const qr=el('div','qr-placeholder');
  qr.append(qrPlaceholderIcon());
  wa.append(qr);
  const waText=el('div','wa-text');
  waText.append(el('div','crow-role', CONTACT.whatsapp.role));
  const waValue=el('div','crow-value');
  waValue.append(el('span','wa-lead', CONTACT.whatsapp.lead));
  waValue.append(document.createTextNode(' '));
  waValue.append(el('span','wa-tail', CONTACT.whatsapp.tail));
  waText.append(waValue);
  waText.append(el('div','crow-phone', 'QR image pending'));
  wa.append(waText);
  panel.append(wa);
}

// ============================================================================
//  CLOCK / TIMERS
// ============================================================================
function tickClock(){ const t=$('#time-en'); if(t) t.textContent=fmtHM(new Date()); }
function setHeaderDate(){
  const d=new Date();
  $('#date-en').textContent=englishDate(d);
  $('#date-ar').textContent=hijriDate(d);
}
function startTimers(){
  setInterval(()=>{ tickRing(); tickClock(); }, 1000);
  setInterval(setHeaderDate, 60000);
  setInterval(advanceReminder, REMINDER_ROTATE_MS);
}

// ============================================================================
//  BOOT
// ============================================================================
async function boot(){
  setHeaderDate(); tickClock();
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
