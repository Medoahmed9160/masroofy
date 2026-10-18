(function(){
'use strict';
var CFG=window.MASROFY_CONFIG||{};
function plug(n){try{return (window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins[n])||null;}catch(e){return null;}}
var NATIVE=false;
try{NATIVE=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());}catch(e){}
var WINDOW_DAYS=62,PAGE=40,MAX_CATS=60;
var TABS=[['home','الرئيسية','home'],['tx','الحركات','list'],['grp','التجميع','layers'],['ins','الاقتراحات','bulb'],['plan','الخطة','target']];
var ICONS={
  home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'
};
function ico(n){return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">'+ICONS[n]+'</svg>';}

/* ---------- helpers ---------- */
function $(s,r){return (r||document).querySelector(s);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function pad(n){return String(n).padStart(2,'0');}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function parseIso(s){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2],12);}
function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
function weekStart(d){return addDays(d,-((d.getDay()+1)%7));}
function monthRange(d){return [iso(new Date(d.getFullYear(),d.getMonth(),1,12)),iso(new Date(d.getFullYear(),d.getMonth()+1,0,12))];}
function dt(d,o){try{return d.toLocaleDateString('ar-EG-u-nu-latn',o);}catch(e){return d.toLocaleDateString('en-GB',o);}}
var nf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
function fm(n){n=Number(n)||0;return nf.format(Math.abs(n)>=1000?Math.round(n):Math.round(n*100)/100);}
function sum(l){var s=0;for(var i=0;i<l.length;i++)s+=l[i].amount;return s;}
function num(s){return String(s).replace(/[٠-٩]/g,function(d){return d.charCodeAt(0)-1632;}).replace(/[۰-۹]/g,function(d){return d.charCodeAt(0)-1776;}).replace(/[٫]/g,'.').replace(/[,٬\s]/g,'');}
function norm(s){return String(s||'').toLowerCase().replace(/[ً-ٰٟـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/^ال/,'').replace(/\s+/g,' ').trim();}
function niceMax(v){if(v<=0)return 100;var p=Math.pow(10,Math.floor(Math.log10(v)));var f=v/p;return (f<=1?1:f<=2?2:f<=5?5:10)*p;}
function uniq(a){var s={},o=[];a.forEach(function(x){if(x&&!s[x]){s[x]=1;o.push(x);}});return o;}
function N(v){return '<span class="n">'+fm(v)+'</span>';}
function money(v){return N(v)+'<span class="cur">ج.م</span>';}
function hap(){try{var H=plug('Haptics');if(H&&H.impact)H.impact({style:'LIGHT'});}catch(e){}}

/* ---------- state ---------- */
var S={sb:null,uid:null,email:'',ready:false,started:false,recovering:false,tab:'home',
  cats:[],cmap:{},goals:[],win:[],
  list:{items:[],loading:false,done:false,stale:true,type:'all',cat:'',q:'',tok:0,err:false},
  gPeriod:'month',gMode:'cat',gAll:null,gAllBusy:false,openGrp:{},iOff:0,sync:'warn',
  editing:null,sheetType:'exp',lastCat:{},catEdit:null,catType:'exp',catColor:0,delOpen:false,
  authMode:'in',authEmail:'',fails:0,lockUntil:0,resendAt:0,fromCache:false,lockAvail:false};

/* ---------- normalisers ---------- */
function normCat(r){return {id:r.id,type:r.type,name:r.name,color:Number(r.color)||0,budget:r.budget==null?0:Number(r.budget),archived:!!r.archived};}
function normGoal(r){return {id:r.id,name:r.name,target:Number(r.target)||0,saved:Number(r.saved)||0};}
function normTx(r){return {id:r.id,type:r.type,amount:Number(r.amount)||0,category_id:r.category_id,name:r.name||'',date:String(r.date).slice(0,10),created_at:r.created_at||''};}
function rebuildCats(){S.cmap={};S.cats.forEach(function(c){S.cmap[c.id]=c;});}
function cname(t){var c=S.cmap[t.category_id];return c?c.name:'—';}
function cnameById(id){var c=S.cmap[id];return c?c.name:'—';}
function ccolor(id){var c=S.cmap[id];return 'var(--c'+(((c?c.color:0)%8)+1)+')';}
function sortWin(){S.win.sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:(a.created_at<b.created_at?1:a.created_at>b.created_at?-1:0);});}
function upsertWin(t){
  if(t.date<S.winFrom){removeWin(t.id);return;}
  for(var i=0;i<S.win.length;i++){if(S.win[i].id===t.id){S.win[i]=t;sortWin();return;}}
  S.win.push(t);sortWin();
}
function removeWin(id){S.win=S.win.filter(function(t){return t.id!==id;});}

/* ---------- aggregation ---------- */
function byCat(list){
  var m={},out=[];
  list.forEach(function(t){var k=t.category_id;var o=m[k];if(!o){o=m[k]={id:k,name:cname(t),total:0,count:0,items:[]};out.push(o);}o.total+=t.amount;o.count++;o.items.push(t);});
  return out.sort(function(a,b){return b.total-a.total;});
}
function mergeByName(list){
  var m={},out=[];
  list.forEach(function(t){
    var label=t.name||cname(t);var key=norm(label)+'|'+t.category_id;var o=m[key];
    if(!o){o=m[key]={label:label,catId:t.category_id,cat:cname(t),total:0,count:0};out.push(o);}
    o.total+=t.amount;o.count++;
  });
  return out.sort(function(a,b){return b.total-a.total;});
}
function periodRange(p){
  var now=new Date();
  if(p==='week'){var ws=weekStart(now);return [iso(ws),iso(addDays(ws,6))];}
  return monthRange(now);
}
function inR(list,a,b){return list.filter(function(t){return t.date>=a&&t.date<=b;});}
function ofType(list,type){return list.filter(function(t){return t.type===type;});}
function weekReport(off){
  var today=new Date();var ws=addDays(weekStart(today),off*7);var we=addDays(ws,6);
  var elapsed=off===0?((today.getDay()+1)%7)+1:7;
  var pws=addDays(ws,-7);
  var a=iso(ws),b=iso(addDays(ws,elapsed-1)),c=iso(pws),d=iso(addDays(pws,elapsed-1));
  var exp=ofType(S.win,'exp');
  var cur=inR(exp,a,b),prev=inR(exp,c,d);
  return {off:off,ws:ws,we:we,elapsed:elapsed,cur:cur,prev:prev,curTot:sum(cur),prevTot:sum(prev)};
}
function pill(cur,prev){
  if(!(prev>0))return '';
  var p=Math.round((cur-prev)/prev*100);
  if(p===0)return '<span class="pill">زي اللي قبله</span>';
  return '<span class="pill '+(p>0?'up':'down')+'">'+(p>0?'▲':'▼')+' <span class="n">'+Math.abs(p)+'%</span></span>';
}

/* ---------- insights (rule based, from the user's own numbers) ---------- */
function buildInsights(rep){
  var items=[],today=new Date();
  var m=monthRange(today);
  var mTx=inR(S.win,m[0],m[1]),mExp=ofType(mTx,'exp'),mInc=ofType(mTx,'inc');
  var expT=sum(mExp),incT=sum(mInc);
  var dim=new Date(today.getFullYear(),today.getMonth()+1,0).getDate(),dp=today.getDate();
  var cm={},cn={},svc={},cur0=rep.off===0,mf=30/Math.max(rep.elapsed,1);
  byCat(mExp).forEach(function(c){cm[c.id]=c.total;cn[c.id]=c.count;});
  var budgeted=S.cats.filter(function(c){return c.type==='exp'&&c.budget>0&&!c.archived;});
  (cur0?budgeted:[]).forEach(function(c){
    var b=c.budget,sp=cm[c.id]||0;
    if(sp>b){items.push({lv:'warn',pr:0,t:'عدّيت ميزانية '+c.name,b:'صرفت '+fm(sp)+' من '+fm(b)+' ج.م ('+Math.round(sp/b*100)+'%). وقّف الصرف في البند ده لحد آخر الشهر لو تقدر.'});}
    else if(dp>=7&&(cn[c.id]||0)>=3&&sp<b){
      var proj=sp/dp*dim;
      if(proj>b*1.05){var rem=dim-dp;var cut=rem>0?Math.ceil((proj-b)/rem):0;
        items.push({lv:'warn',pr:1,t:c.name+' ماشية ناحية تعدّي الميزانية',b:'بالمعدل الحالي هتوصل لحوالي '+fm(proj)+' ج.م من '+fm(b)+'. قلّل حوالي '+fm(cut)+' ج.م في اليوم من دلوقتي.'});}
    }
  });
  var cc={},pc={};
  byCat(rep.cur).forEach(function(c){cc[c.id]=c.total;});byCat(rep.prev).forEach(function(c){pc[c.id]=c.total;});
  Object.keys(cc).forEach(function(id){
    var c=cc[id],p=pc[id]||0;
    if(p>0&&c>=p*1.3&&c-p>=50){var d=c-p;items.push({lv:'warn',pr:2,t:cnameById(id)+' زادت '+Math.round((c-p)/p*100)+'% عن الفترة اللي قبلها',b:'زيادة '+fm(d)+' ج.م. لو رجّعتها لمستواها العادي توفّر تقريبًا '+fm(d*mf)+' ج.م في الشهر.',sv:d*mf});svc[id]=1;}
  });
  mergeByName(rep.cur).forEach(function(g){
    if(g.count>=3&&g.total/g.count<=200){items.push({lv:'tip',pr:3,t:'اشتريت "'+g.label+'" '+g.count+' مرات',b:'إجمالي '+fm(g.total)+' ج.م في الفترة دي. لو قلّلتها للنص توفّر حوالي '+fm(g.total/2*mf)+' ج.م في الشهر.',sv:svc[g.catId]?0:g.total/2*mf});}
  });
  var top=byCat(rep.cur)[0];
  if(top&&rep.curTot>=300&&top.total/rep.curTot>=0.4&&!(S.cmap[top.id]&&S.cmap[top.id].budget>0)){items.push({lv:'tip',pr:4,t:top.name+' واخدة '+Math.round(top.total/rep.curTot*100)+'% من مصروفك',b:'ده أكبر بند عندك. حط له ميزانية من تبويب الخطة وتابعه.'});}
  if(cur0&&incT>0&&expT>0){
    var rate=(incT-expT)/incT;
    if(rate<0.1){items.push({lv:'warn',pr:2,t:'نسبة الادخار الشهر ده '+Math.max(0,Math.round(rate*100))+'%',b:'الهدف المريح 20%. ده معناه تدّخر حوالي '+fm(incT*0.2)+' ج.م من دخل الشهر.'});}
    else if(rate>=0.2&&dp>=10){items.push({lv:'good',pr:6,t:'ادخارك الشهر ده '+Math.round(rate*100)+'%',b:'ممتاز. فكّر تحوّل جزء منه لهدف محدد من تبويب الخطة.'});}
  }
  if(cur0&&incT===0&&expT>0){items.push({lv:'tip',pr:3,t:'مفيش دخل متسجل الشهر ده',b:'سجّل مصادر دخلك عشان نحسب الادخار ونسبة الصرف بشكل صح.'});}
  if(rep.prevTot>=200&&rep.curTot<=rep.prevTot*0.85){items.push({lv:'good',pr:5,t:'مصروفك نزل '+Math.round((1-rep.curTot/rep.prevTot)*100)+'% عن الفترة اللي قبلها',b:'كمّل على نفس الإيقاع.'});}
  var dd={};rep.cur.forEach(function(t){dd[t.date]=1;});
  if(rep.elapsed>=4&&Object.keys(dd).length<2){items.push({lv:'tip',pr:5,t:'تسجيلك قليل الأسبوع ده',b:'سجّل كل مصروف أول بأول عشان الاقتراحات تبقى دقيقة.'});}
  if(cur0&&expT>0&&!budgeted.length){items.push({lv:'tip',pr:5,t:'مفيش ميزانيات متحددة',b:'ابدأ بميزانية لأكبر 3 فئات من تبويب الخطة، ودي أسرع طريقة تتحكم بيها.'});}
  if(cur0&&S.goals.length&&expT>0){items.push({lv:'tip',pr:6,t:'خلّي التوفير ماشي ناحية هدف',b:'أي مبلغ بتوفّره الأسبوع ده حوّله لهدف "'+S.goals[0].name+'" من تبويب الخطة.'});}
  items.sort(function(a,b){return a.pr-b.pr;});
  items=items.slice(0,7);
  var save=0;items.forEach(function(i){if(i.sv)save+=i.sv;});
  return {items:items,save:save};
}

/* ---------- views ---------- */
function dailyChart(){
  var end=new Date(),days=[],idx={};
  for(var i=13;i>=0;i--){var d=addDays(end,-i);idx[iso(d)]=days.length;days.push({d:d,v:0});}
  S.win.forEach(function(t){if(t.type==='exp'&&idx[t.date]!==undefined)days[idx[t.date]].v+=t.amount;});
  var total=0,mx=0;days.forEach(function(x){total+=x.v;if(x.v>mx)mx=x.v;});
  var max=niceMax(mx),avg=total/14;
  var W=340,H=170,pl=40,pr=6,pt=10,pb=24,pw=W-pl-pr,ph=H-pt-pb,slot=pw/14,bw=slot*0.62;
  var g='';
  [0,0.5,1].forEach(function(f){var y=pt+ph-ph*f;g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)" stroke-width="1"/><text x="'+(pl-5)+'" y="'+(y+3)+'" text-anchor="end">'+fm(max*f)+'</text>';});
  days.forEach(function(x,i){
    var h=max>0?x.v/max*ph:0;var cx=pl+slot*i+slot/2;
    g+='<rect x="'+(cx-bw/2)+'" y="'+(pt+ph-h)+'" width="'+bw+'" height="'+Math.max(h,x.v>0?1.5:0)+'" rx="2" fill="'+(i===13?'var(--accent)':'var(--bar)')+'"><title>'+esc(dt(x.d,{day:'numeric',month:'long'}))+': '+fm(x.v)+' ج.م</title></rect>';
    g+='<text x="'+cx+'" y="'+(H-8)+'" text-anchor="middle">'+x.d.getDate()+'</text>';
  });
  if(avg>0){var ya=pt+ph-ph*(avg/max);g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+ya+'" y2="'+ya+'" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="4 3"/>';}
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="المصروف اليومي في آخر 14 يوم">'+g+'</svg>'+
    '<div class="legend"><span><s></s>المتوسط اليومي '+money(avg)+'</span><span>الإجمالي '+money(total)+'</span></div>';
}
function budgetMeter(spent,b){
  if(!(b>0))return '';
  var p=spent/b,cl=p>1?'over':p>=0.8?'warn':'';
  return '<div class="meter '+cl+'" role="img" aria-label="'+Math.round(p*100)+'% من الميزانية"><i style="width:'+Math.min(100,p*100)+'%"></i></div>'+
    '<div class="rmeta"><span>الميزانية <span class="n">'+fm(b)+'</span> ج.م</span><span>'+(p>1?'عدّيت بـ <span class="n">'+fm(spent-b)+'</span>':'فاضل <span class="n">'+fm(b-spent)+'</span>')+'</span></div>';
}
function viewHome(){
  var now=new Date(),m=monthRange(now);
  var mTx=inR(S.win,m[0],m[1]),mExp=ofType(mTx,'exp'),mInc=ofType(mTx,'inc');
  var inc=sum(mInc),exp=sum(mExp),net=inc-exp,rate=inc>0?Math.round(net/inc*100):null;
  var w=weekReport(0);
  var sign=net>0?'+':net<0?'−':'';
  var pmd=new Date(now.getFullYear(),now.getMonth()-1,1,12),pmr=monthRange(pmd),pdim=new Date(now.getFullYear(),now.getMonth(),0).getDate();
  var prevExp=pmr[0]>=S.winFrom?sum(ofType(inR(S.win,pmr[0],pmr[0].slice(0,8)+pad(Math.min(now.getDate(),pdim))),'exp')):0;
  var monthCmp=prevExp>0?'<p class="hero-week">مصروف الشهر ده مقارنة بنفس الفترة من الشهر اللي فات (<b class="n">'+fm(prevExp)+'</b> ج.م) '+pill(exp,prevExp)+'</p>':'';
  var h='';
  if(!S.cats.length){
    h+='<div class="empty"><h2>ابدأ بفئاتك</h2><p class="muted">الفئات بتاعتك إنت: اعمل فئة لكل حاجة بتصرف عليها، ومصدر لكل دخل، وسمّيها بالاسم اللي يناسبك. تقدر تعدّلها أو تضيف عليها في أي وقت.</p><div class="acts"><button class="btn primary" data-act="newcat" data-v="exp" type="button">+ فئة مصروف</button><button class="btn" data-act="newcat" data-v="inc" type="button">+ مصدر دخل</button></div></div>';
  }else if(!S.win.length){
    h+='<div class="empty"><h2>ابدأ بأول حركة</h2><p class="muted">سجّل مصروف أو دخل، وهتظهر هنا الملخصات والتجميع والاقتراحات الأسبوعية.</p><button class="btn primary" data-act="add" type="button">+ ضيف أول حركة</button></div>';
  }
  h+='<section class="hero" aria-label="ملخص الشهر"><div class="hero-top"><p class="eyebrow">صافي شهر '+esc(dt(now,{month:'long'}))+'</p><button class="eye" type="button" data-act="hide" aria-pressed="'+(hideOn()?'true':'false')+'" aria-label="إخفاء الأرقام">'+eyeSvg(hideOn())+'</button></div>'+
    '<p class="hero-num"><span class="n">'+sign+fm(Math.abs(net))+'</span><span class="cur">ج.م</span></p>'+
    '<dl class="hero-stats"><div><dt>دخل</dt><dd class="n">'+fm(inc)+'</dd></div><div><dt>مصروف</dt><dd class="n">'+fm(exp)+'</dd></div><div><dt>ادخار</dt><dd class="n">'+(rate===null?'—':rate+'%')+'</dd></div></dl>'+
    '<p class="hero-week">مصروف الأسبوع ده <b class="n">'+fm(w.curTot)+'</b> ج.م '+pill(w.curTot,w.prevTot)+'</p>'+monthCmp+'</section>';
  var cats=byCat(mExp);
  var stack=cats.map(function(c){return '<span style="width:'+(exp>0?c.total/exp*100:0)+'%;background:'+ccolor(c.id)+'" title="'+esc(c.name)+'"></span>';}).join('');
  var rows=cats.map(function(c){
    var cat=S.cmap[c.id];
    return '<li class="rrow"><span class="dot" style="background:'+ccolor(c.id)+'"></span><span class="rname">'+esc(c.name)+' <span class="muted n" style="font-size:12px">'+Math.round(c.total/exp*100)+'%</span></span><span class="ramt">'+money(c.total)+'</span>'+budgetMeter(c.total,cat?cat.budget:0)+'</li>';
  }).join('');
  var incRows=byCat(mInc).map(function(c){return '<li class="rrow"><span class="dot" style="background:'+ccolor(c.id)+'"></span><span class="rname">'+esc(c.name)+(c.count>1?' <span class="muted n" style="font-size:12px">×'+c.count+'</span>':'')+'</span><span class="ramt">'+money(c.total)+'</span></li>';}).join('');
  h+='<div class="grid two"><section class="card"><h2>المصروف اليومي</h2>'+dailyChart()+'</section>'+
    '<section class="card"><h2>المصروف حسب الفئة</h2>'+(cats.length?'<div class="stack" aria-hidden="true">'+stack+'</div><ul class="rows">'+rows+'</ul>':'<p class="muted">لسه مفيش مصاريف الشهر ده.</p>')+'</section></div>'+
    '<section class="card"><h2>مصادر الدخل الشهر ده</h2>'+(incRows?'<ul class="rows">'+incRows+'</ul>':'<p class="muted">لسه مفيش دخل متسجل الشهر ده.</p>')+'</section>';
  return h;
}
function txRowHtml(t){
  var inc=t.type==='inc';
  return '<button type="button" class="tx '+(inc?'inc':'')+'" data-act="edit" data-id="'+esc(t.id)+'"><span class="sg" aria-hidden="true">'+(inc?'+':'−')+'</span><span class="t1">'+esc(t.name||cname(t))+'</span><span class="am n">'+(inc?'+':'−')+fm(t.amount)+'</span><span class="t2"><span class="tag"><i class="dot" style="background:'+ccolor(t.category_id)+'"></i>'+esc(cname(t))+'</span>'+'</span></button>';
}
function dayLabel(s){
  var d=parseIso(s),today=new Date();
  if(s===iso(today))return 'النهارده';
  if(s===iso(addDays(today,-1)))return 'إمبارح';
  return dt(d,{weekday:'long',day:'numeric',month:'long'});
}
function viewTx(){
  var cats=S.cats.slice().sort(function(a,b){return a.name<b.name?-1:1;});
  return '<div class="head"><h1>الحركات</h1></div>'+
    '<div class="filters"><div class="seg" role="group" aria-label="النوع">'+[['all','الكل'],['exp','مصروفات'],['inc','دخل']].map(function(x){return '<button type="button" data-act="ftype" data-v="'+x[0]+'" aria-pressed="'+(S.list.type===x[0])+'">'+x[1]+'</button>';}).join('')+'</div>'+
    '<select class="field" id="f-fcat" aria-label="الفئة"><option value="">كل الفئات</option>'+cats.map(function(c){return '<option value="'+esc(c.id)+'"'+(S.list.cat===c.id?' selected':'')+'>'+esc(c.name)+(c.archived?' (مؤرشفة)':'')+'</option>';}).join('')+'</select>'+
    '<input class="field" id="f-q" type="text" placeholder="ابحث بالاسم" maxlength="60" value="'+esc(S.list.q)+'" autocomplete="off"></div><div id="txlist"></div>';
}
function localList(show){
  var L=S.list,q=norm(L.q||'');
  L.items=S.win.filter(function(t){return (L.type==='all'||t.type===L.type)&&(!L.cat||t.category_id===L.cat)&&(!q||norm(t.name).indexOf(q)>-1);});
  L.done=true;L.offline=show!==false;L.loading=false;L.err=false;
  paintTxList();
}
function paintTxList(){
  var el=$('#txlist');if(!el)return;
  var L=S.list;
  var offNote=L.offline?'<p class="note offnote">بتشوف آخر شهرين من على الجهاز، وهيكتمل لما النت يرجع.</p>':'';
  if(!L.items.length){
    if(L.loading){el.innerHTML='<div class="loading" role="status">بيحمّل…</div>';return;}
    if(L.err){el.innerHTML='<div class="empty"><h2>مقدرتش أحمّل الحركات</h2><button class="btn" data-act="retrylist" type="button">جرّب تاني</button></div>';return;}
    var filtered=L.type!=='all'||L.cat||L.q;
    el.innerHTML=offNote+'<div class="empty"><h2>'+(filtered?'مفيش نتائج':'لسه مفيش حركات')+'</h2><p class="muted">'+(filtered?'جرّب تغيّر الفلتر أو البحث.':'اضغط على زر الإضافة وسجّل أول مصروف أو دخل.')+'</p></div>';return;
  }
  var h=offNote,cur='',groups=[];
  L.items.forEach(function(t){if(t.date!==cur){cur=t.date;groups.push({d:cur,items:[]});}groups[groups.length-1].items.push(t);});
  groups.forEach(function(g){
    var e=sum(ofType(g.items,'exp'));
    h+='<div class="day"><span>'+esc(dayLabel(g.d))+'</span>'+(e>0?'<span>مصروف <span class="n">'+fm(e)+'</span></span>':'')+'</div>'+g.items.map(txRowHtml).join('');
  });
  if(!L.done)h+='<button class="btn" data-act="more" type="button" style="width:100%"'+(L.loading?' disabled':'')+'>'+(L.loading?'بيحمّل…':'عرض المزيد')+'</button>';
  el.innerHTML=h;
}
async function loadList(reset){
  var L=S.list;if(!S.sb||!S.uid)return;
  var tok=++L.tok;
  if(reset){L.items=[];L.done=false;L.err=false;}
  if(navigator.onLine===false){L.stale=false;localList(true);return;}
  if(loadQ().length>0){L.stale=false;localList(false);return;}
  L.loading=true;L.stale=false;paintTxList();
  var from=L.items.length;
  var q=S.sb.from('transactions').select('*').order('date',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,from+PAGE-1);
  if(L.type!=='all')q=q.eq('type',L.type);
  if(L.cat)q=q.eq('category_id',L.cat);
  if(L.q)q=q.ilike('name','%'+L.q.replace(/[\\%_]/g,'\\$&')+'%');
  var r;try{r=await q;}catch(e){r={error:e};}
  if(tok!==L.tok)return;
  L.loading=false;
  if(r.error){if(isNetErr(r.error)){localList(true);return;}L.err=true;paintTxList();return;}
  L.offline=false;
  var rows=(r.data||[]).map(normTx);
  L.items=L.items.concat(rows);
  if(rows.length<PAGE)L.done=true;
  paintTxList();
}
var qTimer=null;

function viewGroups(){
  var h='<div class="head"><h1>التجميع</h1><p class="sub">المصاريف المتشابهة متجمعة مع بعض</p></div>'+
    '<div class="bar-line"><div class="seg" role="group" aria-label="الفترة">'+[['week','الأسبوع'],['month','الشهر'],['all','الكل']].map(function(x){return '<button type="button" data-act="gper" data-v="'+x[0]+'" aria-pressed="'+(S.gPeriod===x[0])+'">'+x[1]+'</button>';}).join('')+'</div>'+
    '<div class="seg" role="group" aria-label="طريقة التجميع">'+[['cat','حسب الفئة'],['name','حسب الاسم']].map(function(x){return '<button type="button" data-act="gmode" data-v="'+x[0]+'" aria-pressed="'+(S.gMode===x[0])+'">'+x[1]+'</button>';}).join('')+'</div></div>';
  if(S.gPeriod==='all'){
    if(!S.gAll||S.gAll.key!==S.gMode){if(!S.gAllBusy)setTimeout(loadGAll,0);return h+'<div class="loading" role="status">بيحسب…</div>';}
    if(S.gAll.err)return h+'<div class="empty"><h2>مقدرتش أحسب التجميع</h2><button class="btn" data-act="gretry" type="button">جرّب تاني</button></div>';
    var rws=S.gAll.rows||[];
    if(!rws.length)return h+'<div class="empty"><h2>مفيش مصاريف لسه</h2><p class="muted">سجّل مصاريفك وهنجمع المتشابه منها هنا.</p></div>';
    var tot=0;rws.forEach(function(r){tot+=Number(r.total)||0;});
    h+='<p class="card" style="flex-direction:row;justify-content:space-between;flex-wrap:wrap;gap:8px"><span>إجمالي كل المصروفات '+money(tot)+'</span></p><section class="card"><ul class="rows">';
    rws.forEach(function(r){
      var label=S.gMode==='cat'?cnameById(r.category_id):(r.label||cnameById(r.category_id));
      var t=Number(r.total)||0,c=Number(r.cnt)||0;
      h+='<li class="rrow"><span class="dot" style="background:'+ccolor(r.category_id)+'"></span><span class="rname">'+esc(label)+(S.gMode==='name'?' <span class="tag">'+esc(cnameById(r.category_id))+'</span>':'')+(c>1?' <span class="muted n" style="font-size:12px">×'+c+'</span>':'')+'</span><span class="ramt">'+money(t)+'</span><div class="meter"><i style="width:'+(tot>0?t/tot*100:0)+'%;background:'+ccolor(r.category_id)+'"></i></div></li>';
    });
    return h+'</ul></section>';
  }
  var r=periodRange(S.gPeriod),list=ofType(inR(S.win,r[0],r[1]),'exp'),total=sum(list);
  if(!list.length)return h+'<div class="empty"><h2>مفيش مصاريف في الفترة دي</h2><p class="muted">سجّل مصاريفك وهنجمع المتشابه منها هنا تلقائيًا. استخدم نفس الاسم للحاجة المتكررة (مثلاً: قهوة) عشان تتجمع صح.</p></div>';
  var merged=mergeByName(list),rep=merged.filter(function(x){return x.count>=3;});
  h+='<p class="card" style="flex-direction:row;justify-content:space-between;flex-wrap:wrap;gap:8px"><span>إجمالي المصروف '+money(total)+'</span><span class="muted"><span class="n">'+list.length+'</span> حركة · <span class="n">'+merged.length+'</span> بند'+(rep.length?' · <span class="n">'+rep.length+'</span> بند متكرر':'')+'</span></p>';
  if(S.gMode==='name'){
    return h+'<section class="card"><ul class="rows">'+merged.map(function(g){
      return '<li class="mrow"><span class="rname">'+esc(g.label)+'</span><span class="ramt">'+money(g.total)+'</span><span class="sm"><span class="tag"><i class="dot" style="background:'+ccolor(g.catId)+'"></i>'+esc(g.cat)+'</span>'+(g.count>1?'<span class="tag'+(g.count>=3?' rep':'')+'">×<span class="n">'+g.count+'</span>'+(g.count>=3?' متكرر':'')+'</span><span>متوسط <span class="n">'+fm(g.total/g.count)+'</span></span>':'')+'</span></li>';
    }).join('')+'</ul></section>';
  }
  byCat(list).forEach(function(c){
    var k='c:'+c.id,mg=mergeByName(c.items);
    h+='<details class="grp" data-k="'+esc(k)+'"'+(S.openGrp[k]?' open':'')+'><summary><span class="dot" style="background:'+ccolor(c.id)+'"></span><span class="rname">'+esc(c.name)+' <span class="muted" style="font-size:12.5px">· <span class="n">'+c.count+'</span> حركة</span></span><span class="ramt">'+money(c.total)+'</span><div class="meter" style="grid-column:1/-1" role="img" aria-label="'+Math.round(c.total/total*100)+'% من المصروف"><i style="width:'+(c.total/total*100)+'%;background:'+ccolor(c.id)+'"></i></div></summary><div class="inner">'+
      mg.map(function(g){return '<div class="mrow"><span class="rname">'+esc(g.label)+'</span><span class="ramt">'+money(g.total)+'</span><span class="sm">'+(g.count>1?'<span class="tag'+(g.count>=3?' rep':'')+'">×<span class="n">'+g.count+'</span></span><span>متوسط <span class="n">'+fm(g.total/g.count)+'</span></span>':'<span>مرة واحدة</span>')+'</span></div>';}).join('')+'</div></details>';
  });
  return h;
}
async function loadGAll(){
  if(S.gAllBusy||!S.sb)return;
  S.gAllBusy=true;var key=S.gMode;
  try{
    var a='2000-01-01',b='2100-01-01';
    var r=key==='cat'?await S.sb.rpc('spend_by_category',{p_from:a,p_to:b,p_type:'exp'}):await S.sb.rpc('spend_by_name',{p_from:a,p_to:b,p_type:'exp',p_limit:100});
    if(r.error)throw r.error;
    S.gAll={key:key,rows:r.data||[]};
  }catch(e){S.gAll={key:key,rows:[],err:true};}
  S.gAllBusy=false;
  if(S.tab==='grp'&&S.gPeriod==='all'&&S.gAll.key!==S.gMode){S.gAll=null;}
  render();
}

function viewInsights(){
  var rep=weekReport(S.iOff),ins=buildInsights(rep);
  var lab=dt(rep.ws,{day:'numeric',month:'long'})+' إلى '+dt(rep.we,{day:'numeric',month:'long'});
  var h='<div class="head"><h1>اقتراحات الأسبوع</h1><div class="seg" role="group" aria-label="الأسبوع">'+[[0,'الأسبوع ده'],[-1,'الأسبوع اللي فات']].map(function(x){return '<button type="button" data-act="ioff" data-v="'+x[0]+'" aria-pressed="'+(S.iOff===x[0])+'">'+x[1]+'</button>';}).join('')+'</div></div>'+
    '<p class="sub">الأسبوع بيبدأ السبت · '+esc(lab)+(S.iOff===0?' (لحد النهارده، مقارنة بنفس الأيام من الأسبوع اللي قبله)':'')+'</p>'+
    '<section class="card"><div class="bar-line"><span>مصروف الفترة '+money(rep.curTot)+'</span><span class="muted">اللي قبلها '+money(rep.prevTot)+' '+pill(rep.curTot,rep.prevTot)+'</span></div>';
  var cc=byCat(rep.cur),pc={};byCat(rep.prev).forEach(function(c){pc[c.id]=c;});
  var seen={};cc.forEach(function(c){seen[c.id]=1;});
  var rows=cc.map(function(c){return {name:c.name,c:c.total,p:pc[c.id]?pc[c.id].total:0};});
  Object.keys(pc).forEach(function(k){if(!seen[k])rows.push({name:pc[k].name,c:0,p:pc[k].total});});
  if(rows.length){
    h+='<div class="tblwrap"><table><thead><tr><th>الفئة</th><th>الفترة دي</th><th>اللي قبلها</th><th>الفرق</th></tr></thead><tbody>'+rows.map(function(r){
      var d=r.c-r.p;return '<tr><td class="nm">'+esc(r.name)+'</td><td><span class="n">'+fm(r.c)+'</span></td><td><span class="n">'+fm(r.p)+'</span></td><td><span class="n" style="color:'+(d>0?'var(--exp)':d<0?'var(--inc)':'var(--muted)')+'">'+(d>0?'+':d<0?'−':'')+fm(Math.abs(d))+'</span></td></tr>';
    }).join('')+'</tbody></table></div>';
  }else h+='<p class="muted">مفيش مصاريف متسجلة في الفترة دي.</p>';
  h+='</section>';
  h+='<section class="card"><h2>اقتراحات للتوفير</h2>'+(ins.items.length?'<div style="display:flex;flex-direction:column;gap:10px">'+ins.items.map(function(i){
    return '<div class="sug '+i.lv+'"><span class="lv" aria-hidden="true">'+(i.lv==='warn'?'!':i.lv==='good'?'✓':'↗')+'</span><h3>'+esc(i.t)+'</h3><p>'+esc(i.b)+'</p></div>';
  }).join('')+'</div>'+(ins.save>0?'<p class="note">توفير محتمل لو طبّقت الاقتراحات اللي فيها رقم: حوالي <span class="n">'+fm(ins.save)+'</span> ج.م في الشهر (تقدير تقريبي).</p>':''):'<p class="muted">لما تسجّل مصاريف أكتر هتظهر هنا اقتراحات مبنية على أرقامك.</p>')+'</section>';
  return h;
}

function catSection(type,title){
  var list=S.cats.filter(function(c){return c.type===type&&!c.archived;}).sort(function(a,b){return a.name<b.name?-1:1;});
  var h='<div><div class="cathead"><h3>'+title+'</h3><button class="btn small" data-act="newcat" data-v="'+type+'" type="button">+ إضافة</button></div>';
  if(!list.length)h+='<p class="note" style="margin-top:6px">لسه مفيش. اضغط إضافة وسمّي فئتك بالاسم اللي يناسبك.</p>';
  else h+=list.map(function(c){return '<button type="button" class="catrow" data-act="editcat" data-id="'+esc(c.id)+'"><span class="dot" style="background:'+ccolor(c.id)+'"></span><span class="cn">'+esc(c.name)+'</span><span class="cb">'+(c.budget>0?'ميزانية <span class="n">'+fm(c.budget)+'</span>':'')+'</span></button>';}).join('');
  return h+'</div>';
}
function viewPlan(){
  var arch=S.cats.filter(function(c){return c.archived;});
  var h='<div class="head"><h1>الخطة</h1><p class="sub">فئاتك وأهدافك وحسابك</p></div>'+
    '<section class="card"><h2>فئاتك</h2><p class="note">إنت اللي بتسمّي فئاتك وبتحدد ميزانية كل فئة. الفئة اللي عليها حركات تقدر تأرشفها (بتختفي من القايمة وحركاتها القديمة تفضل زي ما هي).</p>'+catSection('exp','فئات المصروف')+catSection('inc','مصادر الدخل')+
    (arch.length?'<details><summary class="note" style="cursor:pointer;min-height:36px">المؤرشفة ('+arch.length+')</summary>'+arch.map(function(c){return '<button type="button" class="catrow" data-act="editcat" data-id="'+esc(c.id)+'"><span class="dot" style="background:'+ccolor(c.id)+'"></span><span class="cn">'+esc(c.name)+'</span><span class="cb">'+(c.type==='inc'?'دخل':'مصروف')+'</span></button>';}).join('')+'</details>':'')+'</section>';
  h+='<section class="card"><h2>أهداف الادخار</h2>'+(S.goals.length?S.goals.map(function(g){
    var p=g.target>0?Math.min(100,g.saved/g.target*100):0;
    return '<div class="goal"><div class="gt"><strong>'+esc(g.name)+'</strong><span class="muted"><span class="n">'+fm(g.saved)+'</span> / <span class="n">'+fm(g.target)+'</span> ج.م</span></div><div class="meter" role="img" aria-label="'+Math.round(p)+'%"><i style="width:'+p+'%"></i></div><div class="ga"><input type="text" inputmode="decimal" id="ga-'+esc(g.id)+'" placeholder="مبلغ تضيفه" maxlength="14" autocomplete="off" aria-label="مبلغ تضيفه لهدف '+esc(g.name)+'"><button class="btn small" type="button" data-act="gadd" data-id="'+esc(g.id)+'">إضافة</button><button class="btn small" type="button" data-act="gdel" data-id="'+esc(g.id)+'">حذف</button></div></div>';
  }).join(''):'<p class="muted">لسه مفيش أهداف. مثلاً: لابتوب جديد، طوارئ، سفر.</p>')+
    '<div class="gform"><input type="text" id="g-name" placeholder="اسم الهدف" maxlength="60" autocomplete="off" aria-label="اسم الهدف"><input type="text" id="g-target" inputmode="decimal" placeholder="المبلغ المطلوب" maxlength="14" autocomplete="off" aria-label="المبلغ المطلوب"><button class="btn primary" type="button" data-act="gnew">إضافة هدف</button></div></section>';
  h+='<section class="card"><h2>المظهر</h2><p class="note">اختار الوضع الفاتح أو الداكن، أو سيبه تلقائي ويمشي مع موبايلك.</p><div class="acts themes">'+[['auto','تلقائي'],['light','فاتح'],['dark','داكن']].map(function(o){return '<button class="btn" type="button" data-act="theme" data-v="'+o[0]+'" aria-pressed="'+(themePref()===o[0]?'true':'false')+'">'+o[1]+'</button>';}).join('')+'</div></section>';
  if(NATIVE&&plug('LocalNotifications')){var rp=remPref();h+='<section class="card"><h2>التذكير اليومي</h2><p class="note">إشعار على موبايلك كل يوم لو لسه مسجلتش حاجة النهارده. بيتبعت من جهازك هو ومبيتبعتش أي بيانات لحد.</p><div class="acts"><button class="btn'+(rp.on?'':' primary')+'" type="button" data-act="rem-toggle" aria-pressed="'+(rp.on?'true':'false')+'">'+(rp.on?'إيقاف التذكير':'تفعيل التذكير')+'</button><label>الساعة <input type="time" id="rem-time" value="'+rp.time+'"></label></div></section>';}
  h+='<section class="card"><h2>استيراد من Excel</h2><p class="note">عندك دفتر أو شيت قديم؟ اختار ملف Excel أو CSV وهتعرّف على أعمدته لوحدي (تاريخ، مبلغ، فئة...)، وتراجع كل حاجة قبل ما يتضاف أي شيء.</p><div class="acts"><button class="btn primary" type="button" data-act="import">اختار ملف</button></div></section>';
  h+=lockCard();
  h+='<section class="card"><h2>الحساب</h2><p class="note">الإيميل: <span class="n" style="font-family:var(--f-body)">'+esc(S.email)+'</span></p>'+
    '<p>بياناتك محفوظة على حسابك وخاصة بيك، وبتظهر على أي جهاز تسجّل منه بنفس الحساب.</p>'+
    '<div class="links"><a href="privacy.html">سياسة الخصوصية</a><a href="terms.html">شروط الاستخدام</a></div>'+
    '<div class="acts"><button class="btn" type="button" data-act="xlsx">تنزيل كل حركاتي (Excel)</button><button class="btn" type="button" data-act="csv">تنزيل كل حركاتي (CSV)</button><button class="btn" type="button" data-act="signout">تسجيل خروج</button></div>'+
    (S.delOpen?'<div class="danger-zone"><p><b>حذف الحساب نهائي.</b> هيتمسح حسابك وكل فئاتك وحركاتك وأهدافك ومينفعش نرجّعها. لو متأكد اكتب كلمة <b>حذف</b> تحت.</p><input type="text" id="del-confirm" autocomplete="off" aria-label="اكتب كلمة حذف للتأكيد"><div class="acts"><button class="btn danger" type="button" data-act="delgo" id="del-go" disabled>احذف حسابي نهائيًا</button><button class="btn" type="button" data-act="delcancel">إلغاء</button></div></div>':'<div class="acts"><button class="btn danger" type="button" data-act="delopen">حذف الحساب</button></div>')+'</section>';
  return h;
}

/* ---------- render ---------- */
var pendingRender=false;
function paintNav(){
  var html=TABS.map(function(t){return '<button type="button" class="tab" data-act="tab" data-v="'+t[0]+'"'+(S.tab===t[0]?' aria-current="page"':'')+'>'+ico(t[2])+'<span>'+t[1]+'</span></button>';}).join('');
  $('#nav-m').innerHTML=html;$('#nav-d').innerHTML=html;
}
function render(){applyHide();applyTheme();
  var v=$('#view');if(!v)return;
  var a=document.activeElement;
  if(a&&v.contains(a)&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)&&S.ready){pendingRender=true;return;}
  pendingRender=false;
  paintNav();
  if(!S.ready)return;
  scheduleSave();
  var h=S.tab==='home'?viewHome():S.tab==='tx'?viewTx():S.tab==='grp'?viewGroups():S.tab==='ins'?viewInsights():viewPlan();
  v.innerHTML=(S.tab==='home'?(welcomeCard()||tipCard('home')):tipCard(S.tab))+h;
  if(S.tab==='tx'){paintTxList();if(S.list.stale&&!S.list.loading)loadList(true);}
}
function paintSync(){
  var map={ok:['ok','متزامن مع حسابك'],warn:['warn','بيتزامن…'],err:['err','غير متصل']};
  var x=(map[S.sync]||map.warn).slice();
  var pend=S.uid?loadQ().length:0;
  if(pend>0){if(S.sync==='err')x[1]='غير متصل · '+pend+' في الانتظار';else{x[0]='warn';x[1]='بيرفع '+pend+' تعديل…';}}
  ['#sync-m','#sync-d'].forEach(function(id){var el=$(id);el.setAttribute('data-s',x[0]);el.lastElementChild.textContent=x[1];});
}
var toastT=null;
function say(msg){var t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true;},3200);}
function showMsg(title,body){$('#view').innerHTML='<div class="empty"><h2>'+esc(title)+'</h2><p class="muted">'+esc(body)+'</p></div>';}
function dataChanged(){S.list.stale=true;S.gAll=null;remKick();}

/* ---------- data layer ---------- */
function errText(e){
  var c=e&&e.code,m=String((e&&e.message)||'');
  if(c==='54000'||/limit reached/i.test(m))return 'وصلت للحد الأقصى المسموح.';
  if(c==='23505')return 'الاسم ده موجود قبل كده.';
  if(c==='23514'||c==='23503')return 'البيانات مش مظبوطة، راجعها وجرّب تاني.';
  if(/failed to fetch|network/i.test(m))return 'مفيش اتصال بالإنترنت.';
  return 'حصل خطأ، جرّب تاني.';
}
async function loadCats(){
  var r=await S.sb.from('categories').select('*').order('created_at',{ascending:true}).limit(200);
  if(r.error)throw r.error;
  S.cats=(r.data||[]).map(normCat);rebuildCats();
}
async function loadGoals(){
  var r=await S.sb.from('goals').select('*').order('created_at',{ascending:true}).limit(100);
  if(r.error)throw r.error;
  S.goals=(r.data||[]).map(normGoal);
}
async function loadWindow(){
  S.winFrom=iso(addDays(new Date(),-WINDOW_DAYS));
  var all=[],off=0;
  for(var i=0;i<10;i++){
    var r=await S.sb.from('transactions').select('*').gte('date',S.winFrom).order('date',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(off,off+999);
    if(r.error)throw r.error;
    all=all.concat(r.data||[]);
    if(!r.data||r.data.length<1000)break;
    off+=1000;
  }
  S.win=all.map(normTx);
}
async function loadAll(){await Promise.all([loadCats(),loadGoals(),loadWindow()]);overlayQueue();saveCacheNow();}

/* ---------- offline: local cache + write queue ---------- */
var LS={
  get:function(k){try{return window.localStorage.getItem(k);}catch(e){return null;}},
  set:function(k,v){try{window.localStorage.setItem(k,v);return true;}catch(e){return false;}},
  del:function(k){try{window.localStorage.removeItem(k);}catch(e){}}
};
var CACHE_KEY='masrofy:cache:v1';
function uuid(){
  try{if(window.crypto&&window.crypto.randomUUID)return window.crypto.randomUUID();}catch(e){}
  var b=new Uint8Array(16);
  try{window.crypto.getRandomValues(b);}catch(e){for(var i=0;i<16;i++)b[i]=Math.floor(Math.random()*256);}
  b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  var h=Array.prototype.map.call(b,function(x){return (x+256).toString(16).slice(1);}).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
function isNetErr(e){
  var m=String((e&&e.message)||e||'');
  return navigator.onLine===false||/failed to fetch|network|load failed|fetch failed|networkerror/i.test(m)||!!(e&&(e.name==='AuthRetryableFetchError'||e.status===0));
}
function isAuthRetry(e){return !!(e&&(e.code==='PGRST301'||e.code==='PGRST303'||/jwt/i.test(String(e.message||''))));}
var saveT=null;
function saveCacheNow(){
  if(!S.uid)return;
  LS.set(CACHE_KEY,JSON.stringify({v:1,uid:S.uid,email:S.email,cats:S.cats,goals:S.goals,win:S.win,winFrom:S.winFrom,at:Date.now()}));
}
function scheduleSave(){clearTimeout(saveT);saveT=setTimeout(saveCacheNow,400);}
function loadCache(){
  var r=LS.get(CACHE_KEY);if(!r)return null;
  try{var c=JSON.parse(r);if(c&&c.v===1&&c.uid&&Array.isArray(c.cats)&&Array.isArray(c.win)&&Array.isArray(c.goals))return c;}catch(e){}
  return null;
}
function clearCache(){clearTimeout(saveT);LS.del(CACHE_KEY);}
function qKey(){return 'masrofy:q:'+S.uid;}
function loadQ(){
  if(!S.uid)return [];
  var r=LS.get(qKey());if(!r)return [];
  try{var a=JSON.parse(r);return Array.isArray(a)?a:[];}catch(e){return [];}
}
function saveQ(a){if(a.length)LS.set(qKey(),JSON.stringify(a));else LS.del(qKey());paintSync();}
var lastN=0,inflight=null;
function nextN(){lastN=Math.max(Date.now(),lastN+1);return lastN;}
function qFind(q,k,id){for(var i=q.length-1;i>=0;i--){var o=q[i];if(o.k===k&&o.id===id&&o.n!==inflight)return i;}return -1;}
function queueTxSave(rec,editing){
  var q=loadQ(),now=new Date().toISOString(),id,created;
  if(editing){
    id=editing.id;created=editing.created_at||now;
    var i=qFind(q,'tx',id);
    if(i>-1&&(q[i].a==='ins'||q[i].a==='upd')){q[i].rec=q[i].a==='ins'?Object.assign({id:id},rec):rec;}
    else q.push({n:nextN(),k:'tx',a:'upd',id:id,rec:rec,t:now});
  }else{
    id=rec.id;created=now;
    q.push({n:nextN(),k:'tx',a:'ins',id:id,rec:rec,t:now});
  }
  saveQ(q);
  return normTx(Object.assign({created_at:created},rec,{id:id}));
}
function queueTxDelete(id){
  var q=loadQ(),i=qFind(q,'tx',id);
  if(i>-1&&q[i].a==='ins'){q=q.filter(function(o){return !(o.k==='tx'&&o.id===id&&o.n!==inflight);});}
  else{q=q.filter(function(o){return !(o.k==='tx'&&o.id===id&&o.a==='upd'&&o.n!==inflight);});q.push({n:nextN(),k:'tx',a:'del',id:id,t:new Date().toISOString()});}
  saveQ(q);
}
function queueCat(type,name,color,budget){
  var col=color==null?nextColor():color;
  var c={id:uuid(),type:type,name:name,color:col,budget:budget>0?budget:0,archived:false};
  S.cats.push(c);rebuildCats();
  var rec={id:c.id,type:type,name:name,color:col};if(budget>0)rec.budget=budget;
  var q=loadQ();q.push({n:nextN(),k:'cat',a:'ins',id:c.id,rec:rec,t:new Date().toISOString()});saveQ(q);
  return c;
}
function overlayQueue(){
  if(!S.uid)return;
  loadQ().forEach(function(o){
    if(o.k==='cat'&&o.a==='ins'){if(!S.cmap[o.id]){S.cats.push(normCat(o.rec));rebuildCats();}}
    else if(o.k==='tx'){
      if(o.a==='del'){removeWin(o.id);return;}
      var prev=S.win.filter(function(x){return x.id===o.id;})[0];
      upsertWin(normTx(Object.assign({created_at:prev?prev.created_at:o.t},prev||{},o.rec,{id:o.id})));
    }
  });
}
async function remapCat(o){
  await loadCats();
  if(S.cmap[o.id])return;
  var ex=S.cats.filter(function(c){return c.type===o.rec.type&&norm(c.name)===norm(o.rec.name);})[0];
  if(!ex)throw {code:'23505',message:'duplicate'};
  var q=loadQ();
  q.forEach(function(x){if(x.k==='tx'&&x.rec&&x.rec.category_id===o.id)x.rec.category_id=ex.id;});
  saveQ(q);
  S.win=S.win.map(function(t){return t.category_id===o.id?Object.assign({},t,{category_id:ex.id}):t;});
  q.forEach(function(x){if(x.k==='cat'&&x.a==='ins'&&x.id!==o.id&&!S.cmap[x.id]){S.cats.push(normCat(x.rec));}});
  rebuildCats();
}
async function applyOp(o){
  var r;
  if(o.k==='tx'){
    if(o.a==='ins'){r=await S.sb.from('transactions').insert(o.rec);if(r.error&&r.error.code!=='23505')throw r.error;}
    else if(o.a==='upd'){r=await S.sb.from('transactions').update(o.rec).eq('id',o.id);if(r.error)throw r.error;}
    else{r=await S.sb.from('transactions').delete().eq('id',o.id);if(r.error)throw r.error;}
  }else if(o.k==='cat'){
    r=await S.sb.from('categories').insert(o.rec);
    if(r.error){if(r.error.code==='23505')await remapCat(o);else throw r.error;}
  }
}
var flushing=false;
function flushSoon(){setTimeout(flushQueue,0);}
async function flushQueue(){
  if(flushing||!S.sb||!S.uid||navigator.onLine===false)return;
  if(!loadQ().length)return;
  flushing=true;var done=0,failed=0;
  try{
    try{await S.sb.auth.getSession();}catch(e){}
    for(var guard=0;guard<1000;guard++){
      var q=loadQ();if(!q.length)break;
      var o=q[0];inflight=o.n;
      try{await applyOp(o);}
      catch(e){
        inflight=null;
        if(isNetErr(e)||isAuthRetry(e))break;
        failed++;
      }
      inflight=null;
      saveQ(loadQ().filter(function(x){return x.n!==o.n;}));done++;
    }
  }finally{inflight=null;flushing=false;}
  paintSync();
  if(failed)say(failed===1?'حركة واحدة اتسجلت أوفلاين مقدرناش نحفظها. راجع بياناتك.':failed+' حركات اتسجلوا أوفلاين مقدرناش نحفظهم. راجع بياناتك.');
  if(done){try{await loadAll();dataChanged();render();}catch(e){}}
}
function startFromCache(c){
  S.started=true;S.fromCache=true;S.uid=c.uid;S.email=c.email||'';
  S.cats=c.cats;rebuildCats();S.goals=c.goals;S.win=c.win;S.winFrom=c.winFrom||iso(addDays(new Date(),-WINDOW_DAYS));
  overlayQueue();
  $('#auth').hidden=true;
  S.ready=true;S.tab='home';S.list.stale=true;S.gAll=null;S.sync='err';paintSync();render();
  try{var SP=plug('SplashScreen');if(SP&&SP.hide)SP.hide();}catch(e){}
}

var chan=null;
function startRealtime(){
  if(chan)S.sb.removeChannel(chan);
  var f='user_id=eq.'+S.uid;
  function onTx(p){
    if(p.eventType==='DELETE'){if(p.old&&p.old.id)removeWin(p.old.id);}
    else if(p.new)upsertWin(normTx(p.new));
    dataChanged();
    if(S.ready){render();}
  }
  function onCat(p){
    if(p.eventType==='DELETE'){if(p.old&&p.old.id){S.cats=S.cats.filter(function(c){return c.id!==p.old.id;});}}
    else if(p.new){var c=normCat(p.new),i=-1;S.cats.forEach(function(x,k){if(x.id===c.id)i=k;});if(i>-1)S.cats[i]=c;else S.cats.push(c);}
    rebuildCats();if(S.ready)render();
  }
  function onGoal(p){
    if(p.eventType==='DELETE'){if(p.old&&p.old.id){S.goals=S.goals.filter(function(g){return g.id!==p.old.id;});}}
    else if(p.new){var g=normGoal(p.new),i=-1;S.goals.forEach(function(x,k){if(x.id===g.id)i=k;});if(i>-1)S.goals[i]=g;else S.goals.push(g);}
    if(S.ready)render();
  }
  chan=S.sb.channel('masrofy-'+S.uid)
    .on('postgres_changes',{event:'*',schema:'public',table:'transactions',filter:f},onTx)
    .on('postgres_changes',{event:'*',schema:'public',table:'categories',filter:f},onCat)
    .on('postgres_changes',{event:'*',schema:'public',table:'goals',filter:f},onGoal)
    .subscribe(function(st){
      S.sync=st==='SUBSCRIBED'?'ok':(st==='CLOSED'||st==='CHANNEL_ERROR'||st==='TIMED_OUT')?'err':'warn';paintSync();
    });
}

/* ---------- categories ---------- */
function nextColor(){
  var used={};S.cats.forEach(function(c){used[c.color]=(used[c.color]||0)+1;});
  var best=0,bc=1e9;for(var i=0;i<8;i++){var n=used[i]||0;if(n<bc){bc=n;best=i;}}
  return best;
}
async function createCategory(type,name,color,budget){
  name=String(name||'').trim();
  var ex=S.cats.filter(function(c){return c.type===type&&norm(c.name)===norm(name);})[0];
  if(ex&&!ex.archived)return ex;
  if(navigator.onLine!==false&&loadQ().length===0){
    try{return await createCategoryOnline(type,name,color,budget);}
    catch(e){if(!isNetErr(e))throw e;}
  }
  if(ex)throw {message:'failed to fetch'};
  var c=queueCat(type,name,color,budget);flushSoon();return c;
}
async function createCategoryOnline(type,name,color,budget){
  var ex=S.cats.filter(function(c){return c.type===type&&norm(c.name)===norm(name);})[0];
  if(ex){
    if(ex.archived){var u=await S.sb.from('categories').update({archived:false}).eq('id',ex.id).select().single();if(u.error)throw u.error;ex=normCat(u.data);S.cats=S.cats.map(function(c){return c.id===ex.id?ex:c;});rebuildCats();}
    return ex;
  }
  var rec={type:type,name:name,color:color==null?nextColor():color};
  if(budget>0)rec.budget=budget;
  var r=await S.sb.from('categories').insert(rec).select().single();
  if(r.error)throw r.error;
  var c=normCat(r.data);S.cats.push(c);rebuildCats();
  return c;
}
function paintSwatches(){
  $('#c-colors').innerHTML=[0,1,2,3,4,5,6,7].map(function(i){return '<button type="button" class="sw" data-col="'+i+'" style="background:var(--c'+(i+1)+')" aria-label="لون '+(i+1)+'" aria-pressed="'+(S.catColor===i)+'"></button>';}).join('');
}
function setCatType(t){
  S.catType=t;
  document.querySelectorAll('#c-type button').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-t')===t));});
  $('#c-budget-w').hidden=t!=='exp';
}
function openCat(c,type){
  S.catEdit=c||null;
  $('#c-title').textContent=c?'تعديل الفئة':(type==='inc'?'مصدر دخل جديد':'فئة جديدة');
  $('#c-err').textContent='';
  $('#tip-cat').innerHTML=c?'':tipCard('cat');
  $('#c-type').hidden=!!c;
  setCatType(c?c.type:(type||'exp'));
  $('#c-name').value=c?c.name:'';
  $('#c-budget').value=c&&c.budget>0?String(c.budget):'';
  S.catColor=c?c.color:nextColor();paintSwatches();
  $('#c-arch').hidden=!c;$('#c-arch').textContent=c&&c.archived?'استرجاع':'أرشفة';
  $('#c-del').hidden=!c;$('#c-del').textContent='حذف';
  $('#ov2').hidden=false;
  setTimeout(function(){$('#c-name').focus();},30);
}
function closeCat(){$('#ov2').hidden=true;S.catEdit=null;if(pendingRender)render();}
function cerr(m){$('#c-err').textContent=m;}
var cSaving=false;
async function submitCat(){
  if(cSaving)return;
  var name=$('#c-name').value.trim();
  if(!name){cerr('اكتب اسم الفئة');return;}
  if(name.length>40){cerr('الاسم طويل (أقصاه 40 حرف)');return;}
  var b=parseFloat(num($('#c-budget').value));
  if($('#c-budget').value.trim()&&(!(b>0)||!isFinite(b))){cerr('اكتب ميزانية صحيحة أو سيبها فاضية');return;}
  var budget=S.catType==='exp'&&b>0?Math.round(b*100)/100:null;
  var dup=S.cats.filter(function(c){return c.type===S.catType&&norm(c.name)===norm(name)&&(!S.catEdit||c.id!==S.catEdit.id);})[0];
  if(dup){cerr('عندك فئة بنفس الاسم دي');return;}
  if(!S.catEdit&&S.cats.length>=MAX_CATS){cerr('وصلت للحد الأقصى ('+MAX_CATS+' فئة). أرشف أو احذف فئات مش بتستخدمها.');return;}
  cSaving=true;$('#c-save').disabled=true;cerr('');
  try{
    if(S.catEdit){
      var r=await S.sb.from('categories').update({name:name,color:S.catColor,budget:budget}).eq('id',S.catEdit.id).select().single();
      if(r.error)throw r.error;
      var c=normCat(r.data);S.cats=S.cats.map(function(x){return x.id===c.id?c:x;});rebuildCats();
    }else{
      await createCategory(S.catType,name,S.catColor,budget);
    }
    hap();say('اتحفظت الفئة');dataChanged();closeCat();render();
  }catch(e){cerr(errText(e));}
  cSaving=false;$('#c-save').disabled=false;
}
async function toggleArchive(){
  var c=S.catEdit;if(!c)return;
  try{
    var r=await S.sb.from('categories').update({archived:!c.archived}).eq('id',c.id).select().single();
    if(r.error)throw r.error;
    var n=normCat(r.data);S.cats=S.cats.map(function(x){return x.id===n.id?n:x;});rebuildCats();
    say(n.archived?'اتأرشفت الفئة':'اتسترجعت الفئة');closeCat();render();
  }catch(e){cerr(errText(e));}
}
var cDelArmed=false,cDelTimer=null;
async function deleteCat(){
  var c=S.catEdit;if(!c)return;
  if(!cDelArmed){cDelArmed=true;$('#c-del').textContent='تأكيد الحذف؟';clearTimeout(cDelTimer);cDelTimer=setTimeout(function(){cDelArmed=false;$('#c-del').textContent='حذف';},4000);return;}
  cDelArmed=false;
  try{
    var cnt=await S.sb.from('transactions').select('id',{count:'exact',head:true}).eq('category_id',c.id);
    if(cnt.error)throw cnt.error;
    if(cnt.count>0){cerr('الفئة دي عليها '+cnt.count+' حركة، فمينفعش تتحذف. أرشفها بدل كده.');$('#c-del').textContent='حذف';return;}
    var r=await S.sb.from('categories').delete().eq('id',c.id);
    if(r.error)throw r.error;
    S.cats=S.cats.filter(function(x){return x.id!==c.id;});rebuildCats();
    say('اتحذفت الفئة');closeCat();render();
  }catch(e){cerr(errText(e));$('#c-del').textContent='حذف';}
}

/* ---------- transaction sheet ---------- */
var delArmed=false,delTimer=null,saving=false;
function fillCatSelect(type,selectedId){
  var list=S.cats.filter(function(c){return c.type===type&&(!c.archived||c.id===selectedId);}).sort(function(a,b){return a.name<b.name?-1:1;});
  var sel=$('#f-cat');
  sel.innerHTML=list.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.name)+(c.archived?' (مؤرشفة)':'')+'</option>';}).join('')+'<option value="__new">+ فئة جديدة…</option>';
  var pick=selectedId||S.lastCat[type];
  if(!list.length)sel.value='__new';
  else if(pick&&list.some(function(c){return c.id===pick;}))sel.value=pick;
  else sel.value=list[0].id;
  $('#f-newcat').hidden=sel.value!=='__new';
}
function setSheetType(t,selectedId){
  S.sheetType=t;
  document.querySelectorAll('#f .seg button').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-t')===t));});
  fillCatSelect(t,selectedId);
  $('#f-cat-l').textContent=t==='inc'?'مصدر الدخل':'الفئة';
  $('#f-name-l').textContent=t==='inc'?'تفاصيل (مثلاً: اسم العميل أو المشروع)':'التفاصيل';
}
function openSheet(t){
  S.editing=t||null;saving=false;delArmed=false;
  $('#sh-title').textContent=t?'تعديل حركة':'حركة جديدة';
  $('#f-err').textContent='';
  $('#tip-sheet').innerHTML=t?'':tipCard('sheet');
  $('#f-newcat').value='';
  var names=S.win.map(function(x){return x.name;});
  $('#names').innerHTML=uniq(names).slice(0,80).map(function(n){return '<option value="'+esc(n)+'"></option>';}).join('');
  setSheetType(t?t.type:'exp',t?t.category_id:null);
  $('#f-amt').value=t?String(t.amount):'';
  $('#f-name').value=t?(t.name||''):'';
  $('#f-date').value=t?t.date:iso(new Date());
  $('#f-del').hidden=!t;$('#f-del').textContent='حذف';
  $('#f-more').hidden=!!t;
  $('#ov').hidden=false;
  setTimeout(function(){$('#f-amt').focus();},30);
}
function closeSheet(){$('#ov').hidden=true;S.editing=null;if(pendingRender)render();}
function ferr(m){$('#f-err').textContent=m;}
async function saveTx(rec,editing){
  if(navigator.onLine!==false&&loadQ().length===0){
    try{
      var r=editing?await S.sb.from('transactions').update(rec).eq('id',editing.id).select().single():await S.sb.from('transactions').insert(rec).select().single();
      if(r.error)throw r.error;
      return {tx:normTx(r.data),queued:false};
    }catch(e){if(!isNetErr(e))throw e;}
  }
  var tx=queueTxSave(rec,editing);
  flushSoon();
  return {tx:tx,queued:true};
}
async function submitSheet(again){
  if(saving)return;
  var amt=parseFloat(num($('#f-amt').value));
  if(!(amt>0)||!isFinite(amt)||amt>=1e9){ferr('اكتب مبلغ صحيح أكبر من صفر');return;}
  var type=S.sheetType,catId=$('#f-cat').value;
  var newName='';
  if(catId==='__new'){newName=$('#f-newcat').value.trim();if(!newName){ferr('اكتب اسم الفئة الجديدة');return;}if(newName.length>40){ferr('اسم الفئة طويل (أقصاه 40 حرف)');return;}}
  else if(!catId){ferr('اختار فئة');return;}
  saving=true;$('#f-save').disabled=true;ferr('');
  try{
    if(catId==='__new'){
      if(S.cats.length>=MAX_CATS&&!S.cats.some(function(c){return c.type===type&&norm(c.name)===norm(newName);}))throw {code:'54000'};
      var nc=await createCategory(type,newName);catId=nc.id;
    }
    var rec={type:type,amount:Math.round(amt*100)/100,category_id:catId,name:$('#f-name').value.trim().slice(0,100),date:$('#f-date').value||iso(new Date())};
    if(!S.editing)rec.id=uuid();
    var bb=budgetBefore(rec),firstTx=!S.editing&&S.win.length===0;
    var res=await saveTx(rec,S.editing);
    upsertWin(res.tx);dataChanged();
    S.lastCat[type]=catId;
    var bal=budgetAlert(rec,bb);
    hap();say((res.queued?'اتسجّلت على جهازك وهتترفع لما النت يرجع':(S.editing?'اتعدّلت الحركة':'اتسجّلت الحركة'))+(bal?' — '+bal:'')+(firstTx?' · تقدر تراجعها وتعدّلها من تبويب الحركات':''));
    saving=false;$('#f-save').disabled=false;
    if(again&&!S.editing){$('#f-amt').value='';$('#f-name').value='';setSheetType(type,catId);$('#f-amt').focus();render();}
    else{closeSheet();render();}
  }catch(e){saving=false;$('#f-save').disabled=false;ferr(errText(e));}
}
async function deleteTx(){
  if(!S.editing)return;
  if(!delArmed){delArmed=true;$('#f-del').textContent='تأكيد الحذف؟';clearTimeout(delTimer);delTimer=setTimeout(function(){delArmed=false;$('#f-del').textContent='حذف';},4000);return;}
  try{
    var id=S.editing.id,queued=false;
    if(navigator.onLine!==false&&loadQ().length===0){
      try{var r=await S.sb.from('transactions').delete().eq('id',id);if(r.error)throw r.error;}
      catch(e){if(!isNetErr(e))throw e;queueTxDelete(id);queued=true;}
    }else{queueTxDelete(id);queued=true;}
    removeWin(id);dataChanged();say(queued?'اتحذفت، وهتتزامن لما النت يرجع':'اتحذفت الحركة');closeSheet();render();
    if(queued)flushSoon();
  }catch(e){ferr(errText(e));}
}

/* ---------- goals ---------- */
async function goalNew(){
  var n=($('#g-name').value||'').trim(),tg=parseFloat(num($('#g-target').value));
  if(!n||!(tg>0)||!isFinite(tg)||tg>=1e9){say('اكتب اسم الهدف والمبلغ المطلوب');return;}
  try{
    var r=await S.sb.from('goals').insert({name:n.slice(0,60),target:Math.round(tg*100)/100}).select().single();
    if(r.error)throw r.error;
    S.goals.push(normGoal(r.data));render();say('اتضاف الهدف');
  }catch(e){say(errText(e));}
}
async function goalAdd(id){
  var inp=$('#ga-'+id),v=inp?parseFloat(num(inp.value)):0;
  if(!(v>0)||!isFinite(v)){say('اكتب مبلغ صحيح');return;}
  try{
    var r=await S.sb.rpc('add_to_goal',{p_id:id,p_amount:Math.round(v*100)/100});
    if(r.error)throw r.error;
    S.goals=S.goals.map(function(g){return g.id===id?{id:g.id,name:g.name,target:g.target,saved:Math.min(g.saved+v,999999999.99)}:g;});
    render();say('اتضاف المبلغ للهدف');
  }catch(e){say(errText(e));}
}
async function goalDel(id){
  try{
    var r=await S.sb.from('goals').delete().eq('id',id);
    if(r.error)throw r.error;
    S.goals=S.goals.filter(function(g){return g.id!==id;});render();
  }catch(e){say(errText(e));}
}

/* ---------- export ---------- */
function csvCell(c){
  var s=String(c==null?'':c);
  if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
async function fetchAllTx(){
  var rows=[],off=0;
  for(var i=0;i<300;i++){
    var r=await S.sb.from('transactions').select('*').order('date',{ascending:false}).order('id',{ascending:true}).range(off,off+999);
    if(r.error)throw r.error;
    rows=rows.concat(r.data||[]);
    if(!r.data||r.data.length<1000)break;
    off+=1000;
  }
  return rows;
}
async function exportXlsx(){
  say('بيجهّز الملف…');
  try{
    if(!window.MasrofyXlsx)throw new Error('xlsx');
    var rows=await fetchAllTx();
    if(!rows.length){say('مفيش حركات تتنزل');return;}
    var u8=window.MasrofyXlsx.build({sheet:'حركاتي',header:['التاريخ','النوع','الفئة','التفاصيل','المبلغ'],kinds:['d','s','s','s','n'],widths:[13,10,20,30,13],
      rows:rows.map(function(t){return [String(t.date).slice(0,10),t.type==='inc'?'دخل':'مصروف',cnameById(t.category_id),t.name||'',Number(t.amount)];})});
    var fname='masrofy-'+iso(new Date())+'.xlsx',FS=NATIVE?plug('Filesystem'):null,SH=NATIVE?plug('Share'):null;
    if(FS&&SH){
      var b64='';for(var i=0;i<u8.length;i+=0x8000)b64+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));
      var w=await FS.writeFile({path:fname,data:btoa(b64),directory:'CACHE'});
      await SH.share({title:'حركاتي',url:w.uri});
    }else{
      var url=URL.createObjectURL(new Blob([u8],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      var a=document.createElement('a');a.href=url;a.download=fname;document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(url);},3000);
      say('اتجهّز الملف');
    }
  }catch(e){say('مقدرتش أجهّز الملف');}
}
async function exportCsv(){
  say('بيجهّز الملف…');
  try{
    var rows=await fetchAllTx();
    if(!rows.length){say('مفيش حركات تتنزل');return;}
    var lines=[['التاريخ','النوع','الفئة','التفاصيل','المبلغ']].concat(rows.map(function(t){
      return [String(t.date).slice(0,10),t.type==='inc'?'دخل':'مصروف',cnameById(t.category_id),t.name||'',Number(t.amount)];
    }));
    var csv='﻿'+lines.map(function(l,idx){return l.map(function(c){return idx===0||typeof c==='number'?'"'+String(c).replace(/"/g,'""')+'"':csvCell(c);}).join(',');}).join('\r\n');
    var fname='masrofy-'+iso(new Date())+'.csv';
    var FS=NATIVE?plug('Filesystem'):null,SH=NATIVE?plug('Share'):null;
    if(FS&&SH){
      var w=await FS.writeFile({path:fname,data:csv,directory:'CACHE',encoding:'utf8'});
      await SH.share({title:'حركاتي',url:w.uri});
    }else{
      var url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      var a=document.createElement('a');a.href=url;a.download=fname;document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(url);},3000);
      say('اتجهّز الملف');
    }
  }catch(e){say('مقدرتش أجهّز الملف');}
}

/* ---------- password policy ---------- */
var COMMON=['password','passw0rd','qwerty','letmein','welcome','iloveyou','admin','abc123','monkey','dragon','football','masrofy','egypt','123456','111111','000000'];
function isWeakPattern(pw,local){
  var l=pw.toLowerCase();
  for(var i=0;i<COMMON.length;i++){if(l.indexOf(COMMON[i])>-1)return true;}
  if(local&&local.length>=4&&l.indexOf(local)>-1)return true;
  if(/(.)\1{3,}/.test(pw))return true;
  if(/0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef/i.test(pw))return true;
  return false;
}
function pwRules(pw,email){
  var local=String(email||'').split('@')[0].toLowerCase();
  return [
    {t:'12 حرف على الأقل',ok:pw.length>=12},
    {t:'حرف صغير (a-z)',ok:/[a-z]/.test(pw)},
    {t:'حرف كبير (A-Z)',ok:/[A-Z]/.test(pw)},
    {t:'رقم (0-9)',ok:/\d/.test(pw)},
    {t:'رمز مثل ! @ # $ %',ok:/[^A-Za-z0-9\s]/.test(pw)},
    {t:'مش كلمة شائعة ولا أرقام متتالية ولا فيها الإيميل',ok:pw.length>0&&!isWeakPattern(pw,local)}
  ];
}
function pwLevel(rules,pw){
  var p=rules.filter(function(r){return r.ok;}).length;
  if(p===rules.length)return pw.length>=16?4:3;
  if(p>=4)return 2;
  return p>=1?1:0;
}
var LEVEL_TXT=['اكتب كلمة سر قوية','ضعيفة','متوسطة','قوية','قوية جدًا'];

/* ---------- auth ---------- */
var resendTimer=null;
function authShell(inner){return '<div class="authcard card"><div class="brand"><span class="mark" aria-hidden="true">م</span><span>دفتر مصروفي</span></div>'+inner+'</div>';}
function emailField(ac){return '<div><label for="a-mail">الإيميل</label><input id="a-mail" name="email" type="email" autocomplete="'+(ac||'email')+'" inputmode="email" autocapitalize="off" spellcheck="false" maxlength="254" value="'+esc(S.authEmail)+'"></div>';}
function pwField(id,label,ac){return '<div><label for="'+id+'">'+label+'</label><div class="pwwrap"><input id="'+id+'" type="password" autocomplete="'+ac+'" autocapitalize="off" spellcheck="false" maxlength="72"><button class="pwbtn" type="button" data-act="pw-toggle" data-for="'+id+'" aria-label="إظهار كلمة السر">إظهار</button></div></div>';}
function codeField(){return '<div><label for="a-code">الكود اللي وصلك على الإيميل</label><input id="a-code" class="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="••••••"></div>';}
function rulesBlock(){
  return '<div class="strength" id="a-str" data-l="0" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p class="strengthlbl" id="a-strl" aria-live="polite">'+LEVEL_TXT[0]+'</p><ul class="rules" id="a-rules">'+pwRules('','').map(function(r){return '<li data-ok="0">'+esc(r.t)+'</li>';}).join('')+'</ul>';
}
function resendBlock(){return '<button class="linkbtn" id="a-resend" type="button" data-act="resend">ابعت الكود تاني</button>';}
function showAuth(mode,msg,ok){
  S.authMode=mode;clearInterval(resendTimer);
  var a=$('#auth');a.hidden=false;
  var h='',title='',btn='';
  var msgHtml='<p class="'+(ok?'okmsg':'err')+'" id="a-msg" role="alert">'+esc(msg||'')+'</p>';
  var ids='';
  if(mode==='in'){
    title='سجّل دخول';btn='دخول';
    h=emailField('username')+pwField('a-pass','كلمة السر','current-password')+msgHtml+'<button class="btn primary" id="a-go" type="submit">'+btn+'</button></form><div class="authlinks"><button class="linkbtn" type="button" data-act="auth-mode" data-v="up">معنديش حساب، أعمل حساب</button><button class="linkbtn" type="button" data-act="auth-mode" data-v="reset">نسيت كلمة السر</button></div>';
  }else if(mode==='up'){
    title='اعمل حساب جديد';btn='إنشاء الحساب';
    h=emailField('username')+pwField('a-pass','كلمة السر','new-password')+rulesBlock()+
      '<p class="muted">لما جهازك يعرض عليك تحفظ كلمة السر، وافق. وده بيفيدك لو نسيتها.</p>'+
      '<label class="chk"><input id="a-terms" type="checkbox"><span>أوافق على <a href="terms.html">شروط الاستخدام</a> و<a href="privacy.html">سياسة الخصوصية</a></span></label>'+
      msgHtml+'<button class="btn primary" id="a-go" type="submit" disabled>'+btn+'</button></form><div class="authlinks"><button class="linkbtn" type="button" data-act="auth-mode" data-v="in">عندي حساب، سجّل دخول</button></div>';
  }else if(mode==='verify'){
    title='أكّد الإيميل';btn='تأكيد';
    h='<p class="muted">بعتنا كود على <b class="n" style="font-family:var(--f-body)">'+esc(S.authEmail)+'</b>. اكتبه هنا (شوف الـ Spam لو مجاش).</p>'+codeField()+msgHtml+'<button class="btn primary" id="a-go" type="submit">'+btn+'</button></form><div class="authlinks">'+resendBlock()+'<button class="linkbtn" type="button" data-act="auth-mode" data-v="in">رجوع</button></div>';
  }else if(mode==='reset'){
    title='استرجاع كلمة السر';btn='ابعتلي الكود';
    h=emailField()+msgHtml+'<button class="btn primary" id="a-go" type="submit">'+btn+'</button></form><div class="authlinks"><button class="linkbtn" type="button" data-act="auth-mode" data-v="in">رجوع</button></div>';
  }else if(mode==='recover'){
    title='كلمة سر جديدة';btn='غيّر كلمة السر';
    h='<p class="muted">لو الإيميل <b class="n" style="font-family:var(--f-body)">'+esc(S.authEmail)+'</b> مسجّل عندنا هيوصله كود. اكتبه واختار كلمة سر جديدة.</p>'+codeField()+pwField('a-pass','كلمة السر الجديدة','new-password')+rulesBlock()+msgHtml+'<button class="btn primary" id="a-go" type="submit" disabled>'+btn+'</button></form><div class="authlinks">'+resendBlock()+'<button class="linkbtn" type="button" data-act="auth-mode" data-v="in">رجوع</button></div>';
  }else{
    title='كلمة سر جديدة';btn='حفظ كلمة السر';
    h=pwField('a-pass','كلمة السر الجديدة','new-password')+rulesBlock()+msgHtml+'<button class="btn primary" id="a-go" type="submit" disabled>'+btn+'</button></form>';
  }
  a.innerHTML=authShell('<h1>'+title+'</h1><form id="auth-f" novalidate>'+h);
  if(mode==='verify'||mode==='recover')startResendTimer();
  var first=a.querySelector('input');if(first&&!NATIVE)setTimeout(function(){try{first.focus();}catch(e){}},30);
}
function startResendTimer(){
  var b=$('#a-resend');if(!b)return;
  function tick(){
    var left=Math.ceil((S.resendAt-Date.now())/1000),el=$('#a-resend');
    if(!el){clearInterval(resendTimer);return;}
    if(left>0){el.disabled=true;el.textContent='ابعت الكود تاني ('+left+')';}
    else{el.disabled=false;el.textContent='ابعت الكود تاني';clearInterval(resendTimer);}
  }
  tick();resendTimer=setInterval(tick,1000);
}
function updateRules(){
  var pw=($('#a-pass')||{}).value||'';
  var email=($('#a-mail')||{}).value||S.authEmail;
  var rules=pwRules(pw,email),lv=pwLevel(rules,pw);
  var li=document.querySelectorAll('#a-rules li');
  rules.forEach(function(r,i){if(li[i])li[i].setAttribute('data-ok',r.ok?'1':'0');});
  var s=$('#a-str');if(s)s.setAttribute('data-l',String(lv));
  var l=$('#a-strl');if(l)l.textContent=pw?LEVEL_TXT[lv]:LEVEL_TXT[0];
  var go=$('#a-go');
  if(go&&(S.authMode==='up'||S.authMode==='recover'||S.authMode==='newpass')){
    var ok=rules.every(function(r){return r.ok;});
    if(S.authMode==='up')ok=ok&&!!($('#a-terms')||{}).checked;
    go.disabled=!ok;
  }
}
function authMsg(m,ok){var el=$('#a-msg');if(el){el.className=ok?'okmsg':'err';el.textContent=m;}}
function authErr(e){
  var m=String((e&&e.message)||''),c=String((e&&(e.code||e.error_code))||'');
  if(/invalid login/i.test(m))return 'الإيميل أو كلمة السر غلط';
  if(/not confirmed/i.test(m)||c==='email_not_confirmed')return 'EMAIL_NOT_CONFIRMED';
  if(/expired|invalid/i.test(m)&&/token|otp|code/i.test(m+c))return 'الكود غلط أو انتهت صلاحيته';
  if(c==='otp_expired')return 'الكود غلط أو انتهت صلاحيته';
  if(/rate limit|too many|over_email_send_rate_limit|over_request_rate_limit/i.test(m+c))return 'محاولات كتير. استنى شوية وجرّب تاني';
  if(c==='weak_password'||/password should|weak/i.test(m))return 'كلمة السر ضعيفة. لازم 12 حرف على الأقل فيها حرف كبير وصغير ورقم ورمز';
  if(/same password|different from the old/i.test(m))return 'اختار كلمة سر مختلفة عن القديمة';
  if(/failed to fetch|network/i.test(m))return 'مفيش اتصال بالإنترنت';
  return 'حصل خطأ، جرّب تاني';
}
var EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function authSubmit(){
  var mode=S.authMode,sb=S.sb;
  var mail=(($('#a-mail')||{}).value||S.authEmail||'').trim().toLowerCase();
  var pass=($('#a-pass')||{}).value||'';
  var code=(($('#a-code')||{}).value||'').replace(/\s/g,'');
  var go=$('#a-go');if(go)go.disabled=true;
  try{
    if(mode==='in'){
      if(Date.now()<S.lockUntil){authMsg('محاولات كتير غلط. استنى '+Math.ceil((S.lockUntil-Date.now())/1000)+' ثانية');return;}
      if(!EMAIL_RE.test(mail)||!pass){authMsg('اكتب الإيميل وكلمة السر');return;}
      S.authEmail=mail;
      var r1=await sb.auth.signInWithPassword({email:mail,password:pass});
      if(r1.error)throw r1.error;
      S.fails=0;
    }else if(mode==='up'){
      var rules=pwRules(pass,mail);
      if(!EMAIL_RE.test(mail)){authMsg('اكتب إيميل صحيح');return;}
      if(!rules.every(function(r){return r.ok;})){authMsg('كلمة السر لسه مش مستوفية الشروط');return;}
      if(!($('#a-terms')||{}).checked){authMsg('لازم توافق على الشروط وسياسة الخصوصية');return;}
      S.authEmail=mail;
      var r2=await sb.auth.signUp({email:mail,password:pass});
      if(r2.error)throw r2.error;
      if(!r2.data||!r2.data.session){S.resendAt=Date.now()+60000;showAuth('verify');return;}
    }else if(mode==='verify'){
      if(code.length<6){authMsg('اكتب الكود كامل');return;}
      var r3=await sb.auth.verifyOtp({email:S.authEmail,token:code,type:'signup'});
      if(r3.error)throw r3.error;
    }else if(mode==='reset'){
      if(!EMAIL_RE.test(mail)){authMsg('اكتب إيميل صحيح');return;}
      S.authEmail=mail;
      var r4=await sb.auth.resetPasswordForEmail(mail);
      if(r4.error&&!/not found/i.test(r4.error.message||''))throw r4.error;
      S.resendAt=Date.now()+60000;showAuth('recover');return;
    }else if(mode==='recover'){
      var rl=pwRules(pass,S.authEmail);
      if(code.length<6){authMsg('اكتب الكود كامل');return;}
      if(!rl.every(function(r){return r.ok;})){authMsg('كلمة السر لسه مش مستوفية الشروط');return;}
      S.recovering=true;
      var r5=await sb.auth.verifyOtp({email:S.authEmail,token:code,type:'recovery'});
      if(r5.error)throw r5.error;
      var r6=await sb.auth.updateUser({password:pass});
      if(r6.error)throw r6.error;
      S.recovering=false;
      var gs=await sb.auth.getSession();
      if(gs.data&&gs.data.session){S.started=false;startSession(gs.data.session);say('اتغيّرت كلمة السر');}
    }else{
      var rn=pwRules(pass,S.email||S.authEmail);
      if(!rn.every(function(r){return r.ok;})){authMsg('كلمة السر لسه مش مستوفية الشروط');return;}
      S.recovering=true;
      var r7=await sb.auth.updateUser({password:pass});
      if(r7.error)throw r7.error;
      S.recovering=false;
      var g2=await sb.auth.getSession();
      if(g2.data&&g2.data.session){S.started=false;startSession(g2.data.session);say('اتغيّرت كلمة السر');}
    }
  }catch(err){
    S.recovering=false;
    var m=authErr(err);
    if(mode==='in'&&m==='الإيميل أو كلمة السر غلط'){S.fails++;if(S.fails>=5){S.lockUntil=Date.now()+Math.min(300000,30000*Math.pow(2,S.fails-5));S.fails=S.fails>=8?8:S.fails;m='محاولات كتير غلط. استنى شوية وجرّب تاني';}}
    if(m==='EMAIL_NOT_CONFIRMED'){
      S.authEmail=mail;
      try{await sb.auth.resend({type:'signup',email:mail});}catch(e){}
      S.resendAt=Date.now()+60000;showAuth('verify','الإيميل لسه متأكدش. بعتنا لك كود جديد.',true);return;
    }
    authMsg(m);
  }finally{
    var g=$('#a-go');if(g&&(S.authMode==='in'||S.authMode==='verify'||S.authMode==='reset'))g.disabled=false;
    else updateRules();
  }
}
async function resendCode(){
  if(Date.now()<S.resendAt)return;
  S.resendAt=Date.now()+60000;startResendTimer();
  try{
    if(S.authMode==='verify'){var r=await S.sb.auth.resend({type:'signup',email:S.authEmail});if(r.error)throw r.error;}
    else{var r2=await S.sb.auth.resetPasswordForEmail(S.authEmail);if(r2.error)throw r2.error;}
    authMsg('بعتنا كود جديد',true);
  }catch(e){authMsg(authErr(e));}
}

/* ---------- session ---------- */
async function startSession(session){
  if(S.started&&S.uid===session.user.id){
    if(S.fromCache&&navigator.onLine!==false){S.fromCache=false;flushQueue().then(function(){return refreshAll();}).then(function(){startRealtime();});}
    return;
  }
  S.started=true;S.uid=session.user.id;S.email=session.user.email||'';
  $('#auth').hidden=true;S.sync='warn';paintSync();
  $('#view').innerHTML='<div class="loading" role="status">بيحمّل دفترك…</div>';
  try{
    await loadAll();
    S.ready=true;S.tab='home';S.list.stale=true;S.gAll=null;
    render();startRealtime();flushQueue();remKick();
    try{var SP=plug('SplashScreen');if(SP&&SP.hide)SP.hide();}catch(e){}
  }catch(e){
    var cc=loadCache();
    if(cc&&cc.uid===session.user.id&&(isNetErr(e)||isAuthRetry(e))){startFromCache(cc);return;}
    S.started=false;S.sync='err';paintSync();
    showMsg('مقدرتش أحمّل بياناتك','اتأكد من الإنترنت وحدّث الصفحة. لو المشكلة مستمرة اتأكد إن قاعدة البيانات اتجهزت (ملف schema.sql).');
  }
}


/* ---------- المظهر: تلقائي / فاتح / داكن ---------- */
var THEME_KEY='masrofy:theme';
function themePref(){var v=LS.get(THEME_KEY);return v==='light'||v==='dark'?v:'auto';}
function themeIsDark(){var v=themePref();if(v!=='auto')return v==='dark';try{return window.matchMedia('(prefers-color-scheme: dark)').matches;}catch(e){return false;}}
function applyTheme(){
  var v=themePref(),root=document.documentElement;
  if(v==='auto')root.removeAttribute('data-theme');else root.setAttribute('data-theme',v);
  var dark=themeIsDark(),metas=document.querySelectorAll('meta[name="theme-color"]');
  if(metas.length>1){
    if(v==='auto'){metas[0].setAttribute('content','#F1EADB');metas[1].setAttribute('content','#121110');}
    else{metas[0].setAttribute('content',dark?'#121110':'#F1EADB');metas[1].setAttribute('content',dark?'#121110':'#F1EADB');}
  }
  var SUN='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',MOON='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  document.querySelectorAll('.themebtn').forEach(function(b){b.innerHTML=dark?SUN:MOON;b.setAttribute('aria-label',dark?'التحويل للوضع الفاتح':'التحويل للوضع الداكن');b.setAttribute('title',dark?'الوضع الفاتح':'الوضع الداكن');});
  var SB=NATIVE&&plug('StatusBar');
  if(SB){
    try{SB.setStyle({style:dark?'DARK':'LIGHT'});}catch(e){}
    try{SB.setBackgroundColor({color:dark?'#121110':'#F1EADB'});}catch(e){}
  }
}
try{window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){if(themePref()==='auto')applyTheme();});}catch(e){}

/* ---------- إرشادات أول استخدام (للحسابات الجديدة) ---------- */
var TIPS={
 home:['الرئيسية','ده ملخص شهرك: الصافي = دخلك ناقص مصروفك. الرسم بيوريك مصروف آخر 14 يوم، وأيقونة العين بتخفي الأرقام لو حد جنبك.'],
 tx:['الحركات','هنا كل حركاتك. فلتر بالنوع أو دوّر بالاسم، واضغط على أي حركة عشان تعدّلها أو تحذفها.'],
 grp:['التجميع','بيوريك فلوسك رايحة فين: مجمّعة بالفئة أو بالاسم، للأسبوع أو الشهر. اضغط على أي فئة تشوف حركاتها.'],
 ins:['اقتراحات الأسبوع','الاقتراحات بتتحسب من أرقامك إنت، وبتقارن أسبوعك بنفس الأيام من الأسبوع اللي قبله. كل ما تسجّل أكتر بتبقى أدق.'],
 plan:['الخطة','هنا فئاتك: حط لكل فئة ميزانية شهرية وهتتنبّه لما تقرّب منها. وكمان أهداف التوفير، والاستيراد من Excel، وإعدادات حسابك.'],
 sheet:['سجّل حركة في ثواني','اكتب المبلغ واختار الفئة وخلاص. التفاصيل اختيارية، ولو الفئة مش موجودة اختار «فئة جديدة» من القايمة.'],
 cat:['إزاي تظبط الفئة','اكتب اسم الفئة واختار لون. الميزانية الشهرية اختيارية، ولو حطيتها هتتنبّه لما توصل 80% منها.']
};
var TIP_KEYS=['home','tx','grp','ins','plan','sheet','cat','welcome'];
function tipsKey(){return 'masrofy:tips:'+(S.uid||'');}
function tipsGet(){
  var m={};if(!S.uid)return m;
  var raw=LS.get(tipsKey());
  if(raw){try{(JSON.parse(raw)||[]).forEach(function(k){m[k]=1;});}catch(e){}return m;}
  if(S.cats.length||S.win.length)TIP_KEYS.forEach(function(k){m[k]=1;});
  LS.set(tipsKey(),JSON.stringify(Object.keys(m)));
  return m;
}
function tipSeen(k){return !!tipsGet()[k];}
function tipMark(k){var m=tipsGet();m[k]=1;LS.set(tipsKey(),JSON.stringify(Object.keys(m)));}
function tipCard(k){
  if(!TIPS[k]||tipSeen(k))return '';
  return '<aside class="tip" role="note"><div><b>'+esc(TIPS[k][0])+'</b><p>'+esc(TIPS[k][1])+'</p></div><button class="btn small" type="button" data-act="tipok" data-id="'+k+'">فهمت</button></aside>';
}
function welcomeCard(){
  if(tipSeen('welcome'))return '';
  var steps=[
    [S.cats.some(function(c){return !c.archived;}),'ضيف فئاتك','فئات مصروفك (أكل، مواصلات...) ومصادر دخلك.','newcat','exp','أضف فئة'],
    [S.win.length>0,'سجّل أول حركة','اضغط زرار + واكتب المبلغ.','add','','سجّل حركة'],
    [S.cats.some(function(c){return c.type==='exp'&&c.budget>0&&!c.archived;}),'حدد ميزانية لأهم فئة','من تبويب الخطة تعدّل أي فئة وتكتب ميزانيتها الشهرية.','tab','plan','افتح الخطة']];
  if(steps.every(function(s){return s[0];})){tipMark('welcome');return '';}
  return '<section class="card tip welcome" aria-label="ابدأ من هنا"><h2>أهلًا بيك في دفتر مصروفي</h2><p class="note">ابدأ في 3 خطوات بسيطة:</p><ol class="steps">'+steps.map(function(s,i){
    return '<li'+(s[0]?' class="done"':'')+'><span class="chkmark" aria-hidden="true">'+(s[0]?'✓':(i+1))+'</span><div><b>'+s[1]+'</b><p class="muted">'+s[2]+'</p>'+(s[0]?'':'<button class="btn small" type="button" data-act="'+s[3]+'"'+(s[4]?' data-v="'+s[4]+'"':'')+'>'+s[5]+'</button>')+'</div></li>';
  }).join('')+'</ol><button class="btn small" type="button" data-act="tipok" data-id="welcome">إخفاء</button></section>';
}

/* ---------- إخفاء الأرقام ---------- */
var HIDE_KEY='masrofy:hide';
function hideOn(){return LS.get(HIDE_KEY)==='1';}
function applyHide(){document.body.classList.toggle('hide-n',hideOn());}
function eyeSvg(off){return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(off?'<path d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.1 3.9M6.6 6.7C3.9 8.4 2 12 2 12s3.5 6 10 6c1.7 0 3.2-.4 4.5-1"/>':'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>')+'</svg>';}

/* ---------- تنبيه الميزانية ---------- */
function catMonthSpent(catId,date){var m=monthRange(parseIso(date));return sum(inR(S.win,m[0],m[1]).filter(function(t){return t.type==='exp'&&t.category_id===catId;}));}
function budgetBefore(rec){return rec.type==='exp'?catMonthSpent(rec.category_id,rec.date):null;}
function budgetAlert(rec,before){
  if(before===null||rec.type!=='exp')return '';
  var c=S.cmap[rec.category_id],b=c&&Number(c.budget)||0;if(!(b>0))return '';
  var m=monthRange(new Date());if(rec.date<m[0]||rec.date>m[1])return '';
  var after=catMonthSpent(rec.category_id,rec.date);
  if(after>=b&&before<b)return 'عدّيت ميزانية «'+c.name+'» بـ '+fm(after-b)+' ج.م';
  if(after>=b*0.8&&before<b*0.8)return 'وصلت '+Math.round(after/b*100)+'% من ميزانية «'+c.name+'» (فاضل '+fm(b-after)+' ج.م)';
  return '';
}

/* ---------- التذكير اليومي (إشعار محلي على الموبايل) ---------- */
var REM_KEY='masrofy:rem',remT=0;
function remPref(){try{var p=JSON.parse(LS.get(REM_KEY)||'null');if(p&&typeof p==='object'&&/^\d{2}:\d{2}$/.test(p.time||''))return {on:!!p.on,time:p.time};}catch(e){}return {on:false,time:'21:00'};}
function remSave(p){LS.set(REM_KEY,JSON.stringify(p));}
function remKick(){clearTimeout(remT);remT=setTimeout(remSchedule,1500);}
function remIds(){var a=[];for(var i=0;i<14;i++)a.push({id:7001+i});return a;}
async function remCancel(){var LN=plug('LocalNotifications');if(LN){try{await LN.cancel({notifications:remIds()});}catch(e){}}}
async function remSchedule(){
  var LN=plug('LocalNotifications');if(!LN||!NATIVE||!S.ready)return;
  try{
    await remCancel();
    var p=remPref();if(!p.on)return;
    var hm=p.time.split(':').map(Number),now=new Date(),today=iso(now),has=S.win.some(function(t){return t.date===today;}),list=[];
    for(var k=0;k<14;k++){
      var d=addDays(now,k);d.setHours(hm[0],hm[1],0,0);
      if(d<=now)continue;if(k===0&&has)continue;
      list.push({id:7001+k,title:'دفتر مصروفي',body:'سجّلت مصاريف النهارده؟ خد دقيقة وسجّلها.',schedule:{at:d,allowWhileIdle:true}});
    }
    if(list.length)await LN.schedule({notifications:list});
  }catch(e){}
}
async function remToggle(){
  var LN=plug('LocalNotifications'),p=remPref();if(!LN)return;
  if(!p.on){
    try{var r=await LN.requestPermissions();if(!r||r.display!=='granted'){say('لازم تسمح بالإشعارات من إعدادات الموبايل');return;}}
    catch(e){say('مقدرتش أفعّل الإشعارات');return;}
    p.on=true;
  }else p.on=false;
  remSave(p);remSchedule();render();
}
document.addEventListener('change',function(e){
  var t=e.target;
  if(t&&t.id==='rem-time'&&/^\d{2}:\d{2}$/.test(t.value||'')){var p=remPref();p.time=t.value;remSave(p);remSchedule();}
});

/* ---------- الاستيراد من Excel/CSV ---------- */
function importPick(){
  if(!window.MasrofyImport){say('أداة الاستيراد مش متحمّلة. حدّث الصفحة وجرّب تاني.');return;}
  var inp=document.createElement('input');inp.type='file';inp.style.display='none';
  inp.accept='.xlsx,.xlsm,.xls,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
  inp.onchange=function(){var f=inp.files&&inp.files[0];inp.remove();if(f)window.MasrofyImport.open(f,importApi);};
  document.body.appendChild(inp);inp.click();
}
var importApi={commit:importCommit,after:function(){dataChanged();S.gAll=null;render();}};
async function importCommit(recs,prog){
  if(!S.ready||!S.sb)throw {message:'سجّل دخول الأول وجرّب تاني.'};
  if(navigator.onLine===false||loadQ().length>0)throw {message:'الاستيراد محتاج إنترنت، وكل حركاتك لازم تكون اتزامنت. جرّب تاني بعد شوية.'};
  var min=recs[0].date,max=min;
  recs.forEach(function(r){if(r.date<min)min=r.date;if(r.date>max)max=r.date;});
  var ex={},off=0,k;
  for(var g=0;g<80;g++){
    var q=await S.sb.from('transactions').select('date,type,amount,name,category_id').gte('date',min).lte('date',max).order('date').order('id').range(off,off+999);
    if(q.error)throw q.error;
    (q.data||[]).forEach(function(t){var c=S.cmap[t.category_id];k=String(t.date).slice(0,10)+'|'+t.type+'|'+Number(t.amount).toFixed(2)+'|'+norm(t.name)+'|'+(c?norm(c.name):'');ex[k]=(ex[k]||0)+1;});
    if(!q.data||q.data.length<1000)break;off+=1000;
  }
  var want={},have={};
  recs.forEach(function(r){var key=r.type+'|'+norm(r.cat);(want[key]||(want[key]={type:r.type,name:r.cat,n:0})).n++;});
  S.cats.forEach(function(c){have[c.type+'|'+norm(c.name)]=c;});
  var fresh=Object.keys(want).filter(function(x){return !have[x];}).map(function(x){return want[x];}).sort(function(a,b){return b.n-a.n;});
  var free=MAX_CATS-S.cats.length,keep=fresh.length,fb={exp:'أخرى',inc:'دخل آخر'},remap={},cm={},made=0,merged=false;
  var needFb=function(n){var t={};fresh.slice(n).forEach(function(f){t[f.type]=1;});return Object.keys(t).filter(function(ty){return !have[ty+'|'+norm(fb[ty])];}).length;};
  if(fresh.length>free){
    keep=Math.min(fresh.length,free);
    while(keep>0&&keep+needFb(keep)>free)keep--;
    if(keep+needFb(keep)>free)throw {message:'وصلت للحد الأقصى للفئات ('+MAX_CATS+'). أرشف أو امسح فئات مش محتاجها وجرّب تاني.'};
    merged=true;
  }
  var f2,i;
  for(i=0;i<keep;i++){f2=fresh[i];cm[f2.type+'|'+norm(f2.name)]=await createCategory(f2.type,f2.name);made++;}
  for(i=keep;i<fresh.length;i++){
    f2=fresh[i];var fk=f2.type+'|'+norm(fb[f2.type]);
    if(!have[fk]&&!cm[fk]){cm[fk]=await createCategory(f2.type,fb[f2.type]);made++;}
    remap[f2.type+'|'+norm(f2.name)]=fk;
  }
  var rows=[],dups=0;
  recs.forEach(function(r){
    var key=r.type+'|'+norm(r.cat);key=remap[key]||key;
    var c=cm[key]||have[key];if(!c)return;
    var dk=r.date+'|'+r.type+'|'+r.amount.toFixed(2)+'|'+norm(r.name)+'|'+norm(c.name);
    if(ex[dk]>0){ex[dk]--;dups++;return;}
    rows.push({id:uuid(),type:r.type,amount:r.amount,category_id:c.id,name:r.name,date:r.date});
  });
  var done=0;
  for(i=0;i<rows.length;i+=200){
    var chunk=rows.slice(i,i+200),r2=await S.sb.from('transactions').insert(chunk);
    if(r2.error)throw r2.error;
    done+=chunk.length;if(prog)prog(done,rows.length);
  }
  await refreshAll();
  return {added:rows.length,dups:dups,newCats:made,merged:merged};
}
function resetState(){
  remCancel();
  if(S.sb&&chan){try{S.sb.removeChannel(chan);}catch(e){}}chan=null;
  S.cats=[];S.cmap={};S.goals=[];S.win=[];S.list={items:[],loading:false,done:false,stale:true,type:'all',cat:'',q:'',tok:0,err:false};
  S.ready=false;S.started=false;S.uid=null;S.email='';S.tab='home';S.gAll=null;S.delOpen=false;S.sync='warn';paintSync();
  $('#ov').hidden=true;$('#ov2').hidden=true;
}
async function refreshAll(){
  if(!S.ready||!S.sb)return;
  try{await loadAll();dataChanged();render();S.sync='ok';paintSync();}catch(e){S.sync='err';paintSync();}
}
async function deleteAccount(){
  var b=$('#del-go');if(b)b.disabled=true;
  try{
    var r=await S.sb.rpc('delete_my_account');
    if(r.error)throw r.error;
    LS.del(qKey());clearCache();LS.del(LOCK_KEY);
    try{await S.sb.auth.signOut();}catch(e){}
    resetState();S.authEmail='';showAuth('in','اتحذف حسابك وكل بياناتك.',true);
  }catch(e){say(errText(e));if(b)b.disabled=false;}
}

/* ---------- events ---------- */
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');
  if(!b){var sw=e.target.closest('.sw');if(sw){S.catColor=Number(sw.getAttribute('data-col'));paintSwatches();}return;}
  var a=b.getAttribute('data-act'),v=b.getAttribute('data-v'),id=b.getAttribute('data-id');
  if(a==='add'){if(S.ready){if(!S.cats.length){openCat(null,'exp');return;}openSheet(null);}}
  else if(a==='tab'){S.tab=v;render();window.scrollTo(0,0);}
  else if(a==='edit'){var t=S.list.items.filter(function(x){return x.id===id;})[0]||S.win.filter(function(x){return x.id===id;})[0];if(t)openSheet(t);}
  else if(a==='ftype'){S.list.type=v;loadList(true);render();}
  else if(a==='more'){loadList(false);}
  else if(a==='retrylist'){loadList(true);}
  else if(a==='gper'){S.gPeriod=v;render();}
  else if(a==='gmode'){S.gMode=v;render();}
  else if(a==='gretry'){S.gAll=null;render();}
  else if(a==='ioff'){S.iOff=Number(v);render();}
  else if(a==='newcat'){openCat(null,v);}
  else if(a==='editcat'){var c=S.cmap[id];if(c)openCat(c);}
  else if(a==='gnew'){goalNew();}
  else if(a==='gadd'){goalAdd(id);}
  else if(a==='gdel'){
    if(b.getAttribute('data-arm')!=='1'){b.setAttribute('data-arm','1');b.textContent='تأكيد؟';setTimeout(function(){if(b.isConnected){b.removeAttribute('data-arm');b.textContent='حذف';}},3500);return;}
    goalDel(id);
  }
  else if(a==='csv'){exportCsv();}
  else if(a==='xlsx'){exportXlsx();}
  else if(a==='import'){importPick();}
  else if(a==='tipok'){tipMark(id);if(id==='sheet')$('#tip-sheet').innerHTML='';else if(id==='cat')$('#tip-cat').innerHTML='';else render();}
  else if(a==='theme'){LS.set(THEME_KEY,b.getAttribute('data-v'));render();}
  else if(a==='themecycle'){LS.set(THEME_KEY,themeIsDark()?'light':'dark');render();}
  else if(a==='hide'){LS.set(HIDE_KEY,hideOn()?'0':'1');render();}
  else if(a==='rem-toggle'){remToggle();}
  else if(a==='signout'){LS.del(LOCK_KEY);if(S.sb)S.sb.auth.signOut();}
  else if(a==='unlock'){tryUnlock(false);}
  else if(a==='lock-out'){LS.del(LOCK_KEY);hideLock();if(S.sb)S.sb.auth.signOut();}
  else if(a==='lock-on'){enableLock();}
  else if(a==='lock-off'){disableLock();}
  else if(a==='delopen'){S.delOpen=true;render();}
  else if(a==='delcancel'){S.delOpen=false;render();}
  else if(a==='delgo'){deleteAccount();}
  else if(a==='auth-mode'){if(v==='in'||v==='up'||v==='reset'){var em=$('#a-mail');if(em&&em.value)S.authEmail=em.value.trim().toLowerCase();}showAuth(v);}
  else if(a==='pw-toggle'){var inp=$('#'+b.getAttribute('data-for'));if(inp){var show=inp.type==='password';inp.type=show?'text':'password';b.textContent=show?'إخفاء':'إظهار';b.setAttribute('aria-label',show?'إخفاء كلمة السر':'إظهار كلمة السر');}}
  else if(a==='resend'){resendCode();}
});
document.addEventListener('change',function(e){
  var el=e.target;
  if(el.id==='f-fcat'){S.list.cat=el.value;loadList(true);}
  else if(el.id==='f-cat'){var nw=el.value==='__new';$('#f-newcat').hidden=!nw;if(nw)$('#f-newcat').focus();}
  else if(el.id==='a-terms'){updateRules();}
});
document.addEventListener('input',function(e){
  var id=e.target.id;
  if(id==='f-q'){S.list.q=e.target.value.trim();clearTimeout(qTimer);qTimer=setTimeout(function(){loadList(true);},350);}
  else if(id==='a-pass'||id==='a-mail'){if(document.querySelector('#a-rules'))updateRules();}
  else if(id==='del-confirm'){var g=$('#del-go');if(g)g.disabled=e.target.value.trim()!=='حذف';}
  else if(id==='a-code'){e.target.value=e.target.value.replace(/[^0-9٠-٩]/g,'').replace(/[٠-٩]/g,function(d){return d.charCodeAt(0)-1632;});}
});
document.addEventListener('focusout',function(){setTimeout(function(){if(pendingRender&&$('#ov').hidden&&$('#ov2').hidden){var a=document.activeElement;var v=$('#view');if(!(a&&v.contains(a)&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)))render();}},60);});
$('#view').addEventListener('toggle',function(e){var d=e.target;if(d&&d.classList&&d.classList.contains('grp')){S.openGrp[d.getAttribute('data-k')]=d.open;}},true);
$('#sh-x').addEventListener('click',closeSheet);
$('#ov').addEventListener('click',function(e){if(e.target.id==='ov')closeSheet();});
$('#c-x').addEventListener('click',closeCat);
$('#ov2').addEventListener('click',function(e){if(e.target.id==='ov2')closeCat();});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(!$('#ov2').hidden)closeCat();else if(!$('#ov').hidden)closeSheet();}});
document.querySelectorAll('#f .seg button').forEach(function(b){b.addEventListener('click',function(){setSheetType(b.getAttribute('data-t'));});});
document.querySelectorAll('#c-type button').forEach(function(b){b.addEventListener('click',function(){setCatType(b.getAttribute('data-t'));});});
$('#f').addEventListener('submit',function(e){e.preventDefault();submitSheet(false);});
$('#f-more').addEventListener('click',function(){submitSheet(true);});
$('#f-del').addEventListener('click',deleteTx);
$('#cf').addEventListener('submit',function(e){e.preventDefault();submitCat();});
$('#c-arch').addEventListener('click',toggleArchive);
$('#c-del').addEventListener('click',deleteCat);
document.addEventListener('submit',function(e){if(e.target.id==='auth-f'){e.preventDefault();authSubmit();}});

/* ---------- boot ---------- */
function initNative(){
  if(!NATIVE)return;
  try{
    var A=plug('App');
    if(A&&A.addListener){
      A.addListener('backButton',function(){
        if(!$('#ov2').hidden){closeCat();return;}
        if(!$('#ov').hidden){closeSheet();return;}
        if(S.ready&&S.tab!=='home'){S.tab='home';render();return;}
        if(A.exitApp)A.exitApp();
      });
      A.addListener('appStateChange',function(st){if(st&&st.isActive)refreshAll();});
    }
  }catch(e){}
}
function makeStorage(){
  var ss=NATIVE?plug('SecureStoragePlugin'):null;
  if(!ss)return undefined;
  return {
    getItem:async function(k){try{var r=await ss.get({key:k});return r&&r.value!=null?r.value:null;}catch(e){return null;}},
    setItem:async function(k,v){try{await ss.set({key:k,value:v});}catch(e){}},
    removeItem:async function(k){try{await ss.remove({key:k});}catch(e){}}
  };
}
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden'){hiddenAt=Date.now();return;}
  if(document.visibilityState==='visible'){
    if(readLock()&&lockSupported()&&!locked&&hiddenAt&&Date.now()-hiddenAt>LOCK_AFTER_MS){showLock();tryUnlock(true);}
    flushQueue();refreshAll();
  }
});
window.addEventListener('offline',function(){S.sync='err';paintSync();});
window.addEventListener('online',function(){
  if(!S.ready)return;
  S.fromCache=false;
  (async function(){
    try{await S.sb.auth.getSession();}catch(e){}
    await flushQueue();await refreshAll();startRealtime();
  })();
});

function boot(){
  paintNav();paintSync();initNative();
  if(!CFG.url||!CFG.anonKey||!window.supabase){
    S.sync='err';paintSync();
    $('#auth').hidden=false;
    $('#auth').innerHTML=authShell('<h1>التطبيق لسه متربطش بقاعدة البيانات</h1><p class="muted">افتح ملف config.js وحط رابط مشروع Supabase والمفتاح العام. الخطوات في ملف README.</p>');
    return;
  }
  var opts={auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:!NATIVE}};
  var st=makeStorage();if(st)opts.auth.storage=st;
  S.sb=window.supabase.createClient(CFG.url,CFG.anonKey,opts);
  initLock();
  if(navigator.onLine===false){var c0=loadCache();if(c0)startFromCache(c0);}
  S.sb.auth.onAuthStateChange(function(ev,session){
    setTimeout(function(){
      if(ev==='PASSWORD_RECOVERY'){S.email=session&&session.user?session.user.email||'':'';S.recovering=true;showAuth('newpass');return;}
      if(ev==='SIGNED_OUT'){clearCache();LS.del(LOCK_KEY);hideLock();S.recovering=false;resetState();showAuth('in');return;}
      if(session&&(ev==='INITIAL_SESSION'||ev==='SIGNED_IN')){if(!S.recovering)startSession(session);return;}
      if(!session&&ev==='INITIAL_SESSION'){
        if(S.fromCache&&navigator.onLine===false)return;
        if(S.fromCache){clearCache();resetState();}
        showAuth('in');
      }
    },0);
  });
}

/* ---------- app lock (fingerprint / Face ID through WebAuthn) ---------- */
var LOCK_KEY='masrofy:lock:v1',LOCK_AFTER_MS=30000,locked=false,hiddenAt=0;
function b64e(buf){var s='',b=new Uint8Array(buf);for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function b64d(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';var r=atob(s),b=new Uint8Array(r.length);for(var i=0;i<r.length;i++)b[i]=r.charCodeAt(i);return b.buffer;}
function rnd(n){var b=new Uint8Array(n);try{window.crypto.getRandomValues(b);}catch(e){for(var i=0;i<n;i++)b[i]=Math.floor(Math.random()*256);}return b;}
function lockSupported(){return !NATIVE&&!!(window.PublicKeyCredential&&navigator.credentials&&navigator.credentials.create&&navigator.credentials.get&&window.isSecureContext!==false);}
function readLock(){var r=LS.get(LOCK_KEY);if(!r)return null;try{var c=JSON.parse(r);return c&&c.id?c:null;}catch(e){return null;}}
async function verifyLock(){
  var c=readLock();if(!c)return true;
  var a=await navigator.credentials.get({publicKey:{challenge:rnd(32),allowCredentials:[{type:'public-key',id:b64d(c.id),transports:['internal']}],userVerification:'required',timeout:60000}});
  return !!a;
}
function hideLock(){locked=false;var el=$('#lock');if(el){el.hidden=true;el.innerHTML='';}}
function showLock(msg){
  locked=true;var el=$('#lock');if(!el)return;el.hidden=false;
  el.innerHTML='<div class="authcard card lockcard"><div class="brand"><span class="mark" aria-hidden="true">م</span><span>دفتر مصروفي</span></div><h1>التطبيق مقفول</h1><p class="muted">افتحه بالبصمة أو Face ID.</p><p class="err" role="alert" id="lk-msg">'+esc(msg||'')+'</p><button class="btn primary" type="button" data-act="unlock">فتح</button><div class="authlinks"><button class="linkbtn" type="button" data-act="lock-out">مش قادر تفتح؟ سجّل خروج</button></div></div>';
}
async function tryUnlock(auto){
  try{if(await verifyLock()){hideLock();return true;}}
  catch(e){if(!auto){var m=$('#lk-msg');if(m)m.textContent='معرفناش نتحقق. جرّب تاني.';}}
  return false;
}
async function enableLock(){
  try{
    var cred=await navigator.credentials.create({publicKey:{rp:{name:'دفتر مصروفي'},user:{id:rnd(16),name:S.email||'user',displayName:S.email||'user'},challenge:rnd(32),pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'discouraged'},attestation:'none',timeout:60000}});
    if(!cred)throw new Error('none');
    LS.set(LOCK_KEY,JSON.stringify({id:b64e(cred.rawId),uid:S.uid}));
    say('اتفعّل القفل. هيطلب البصمة لما تفتح التطبيق.');render();
  }catch(e){say(e&&e.name==='NotAllowedError'?'اتلغت العملية، القفل لسه مش مفعّل.':'جهازك مقدرش يفعّل القفل.');}
}
async function disableLock(){
  try{await verifyLock();LS.del(LOCK_KEY);say('اتقفل القفل.');render();}
  catch(e){say('مقدرناش نتحقق، فالقفل لسه شغّال.');}
}
function lockCard(){
  if(!S.lockAvail)return '';
  var on=!!readLock();
  return '<section class="card"><h2>قفل التطبيق</h2><p class="note">'+(on?'القفل شغّال. التطبيق بيطلب البصمة أو Face ID لما تفتحه.':'اطلب البصمة أو Face ID كل ما حد يفتح التطبيق على الموبايل ده.')+'</p><div class="acts"><button class="btn'+(on?'':' primary')+'" type="button" data-act="'+(on?'lock-off':'lock-on')+'">'+(on?'إيقاف القفل':'تفعيل القفل')+'</button></div><p class="note">القفل بيمنع أي حد يمسك موبايلك وهو مفتوح من دخول دفترك. وهو شغّال على الجهاز ده بس.</p></section>';
}
function initLock(){
  try{
    if(!lockSupported())return;
    if(window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable){
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function(v){S.lockAvail=!!v;if(S.ready)render();}).catch(function(){});
    }
    if(readLock()){showLock();tryUnlock(true);}
  }catch(e){}
}
boot();
try{
  if('serviceWorker' in navigator&&!NATIVE&&(location.protocol==='https:'||location.hostname==='localhost')){
    window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});
  }
}catch(e){}
})();
