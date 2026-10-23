/* استيراد من Excel/CSV: بيقرا أي ملف، ويتعرّف على أعمدته لوحده، وبيخليك تراجع قبل ما يتضاف أي حاجة.
   الملف ده مستقل: بيجهّز قايمة حركات والتطبيق هو اللي بيحفظها (api.commit). */
(function(root){
'use strict';
function E(m){var e=new Error(m);e.ar=true;return e;}
function norm(s){return String(s==null?'':s).toLowerCase().replace(/[\u064B-\u0652\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/^ال/,'').replace(/\s+/g,' ').trim();}
function dig(s){return String(s).replace(/[٠-٩]/g,function(d){return d.charCodeAt(0)-1632;}).replace(/[۰-۹]/g,function(d){return d.charCodeAt(0)-1776;}).replace(/٫/g,'.');}
function K(a){return a.map(norm);}
var MD={};
[['يناير','جانفي','january','jan'],['فبراير','فيفري','february','feb'],['مارس','march','mar'],['ابريل','افريل','april','apr'],['مايو','ماي','may'],['يونيو','يونيه','جوان','june','jun'],['يوليو','يوليه','جويليه','july','jul'],['اغسطس','اوت','august','aug'],['سبتمبر','september','sep','sept'],['اكتوبر','october','oct'],['نوفمبر','november','nov'],['ديسمبر','december','dec']].forEach(function(a,i){a.forEach(function(n){MD[norm(n)]=i+1;});});
function monthOf(s){
  var w=dig(String(s)).replace(/[0-9.\-_\/,()]/g,' ').split(/\s+/);
  for(var i=0;i<w.length;i++){var n=norm(w[i]);if(n&&MD[n])return MD[n];}
  return 0;
}
var KW={
  ign:K(['رصيد','balance','اجمالي','مجموع','total','sum','مسلسل','serial','#','رقم','no','م','id','subtotal']),
  cat:K(['فئه','تصنيف','قسم','category','group','نوع المصروف','نوع الايراد','نوع الدخل','بند الصرف']),
  date:K(['تاريخ','date','يوم','day','الوقت','time']),
  nm:K(['بيان','تفاصيل','وصف','بند','صنف','ملاحظات','ملاحظه','اسم','description','details','note','notes','item','name','memo','payee','غرض','مستفيد','شرح']),
  exp:K(['مصروف','مصروفات','مصاريف','منصرف','صرف','خروج','خارج','مدين','سحب','expense','expenses','debit','out','withdrawal','spent','paid','dr']),
  inc:K(['دخل','ايراد','ايرادات','وارد','واردات','ايداع','قبض','استلام','دائن','income','credit','deposit','received','revenue','cr']),
  amt:K(['مبلغ','قيمه','amount','value','سعر','price','cost','تكلفه']),
  type:K(['نوع','type','حركه','نوع الحركه','نوع العمليه','عمليه'])
};
var TI=K(['دخل','ايراد','ايرادات','وارد','قبض','استلام','ايداع','income','in','credit','deposit','+','دائن','received','revenue']);
var TE=K(['مصروف','مصروفات','صرف','خرج','منصرف','خروج','expense','out','debit','withdrawal','-','مدين','سحب','paid','spent']);
var TOT=K(['اجمالي','مجموع','total','sum','subtotal','رصيد','balance','صافي','ترحيل','متبقي']);
function hasKw(h,list){
  var n=norm(h),w=n.split(/[\s\/\\\-_()]+/);
  for(var i=0;i<list.length;i++){var k=list[i];if(!k)continue;if(k.indexOf(' ')>=0?n.indexOf(k)>=0:w.indexOf(k)>=0)return true;}
  return false;
}
function roleFromHeader(h){
  if(h==null||h==='')return '';
  if(typeof h==='object')return 'month';
  if(hasKw(h,KW.ign))return 'ignore';
  var o=['cat','date','nm','exp','inc','amt','type'],r=['cat','date','name','exp','inc','amount','type'];
  for(var i=0;i<o.length;i++)if(hasKw(h,KW[o[i]]))return r[i];
  return '';
}
function typeOf(v){var n=norm(v);if(!n)return null;if(TI.indexOf(n)>=0)return 'inc';if(TE.indexOf(n)>=0)return 'exp';return null;}
function isTotalText(v){if(typeof v!=='string')return false;var w=norm(v).split(' ')[0];return TOT.indexOf(w)>=0;}

/* ---------- أرقام وتواريخ ---------- */
function toNum(v){
  if(typeof v==='number')return isFinite(v)?v:null;
  if(typeof v!=='string')return null;
  var s=dig(v).trim();
  if(!s||/[\/:]/.test(s))return null;
  var neg=/^\(.*\)$/.test(s)||/-\s*$/.test(s);
  s=s.replace(/[()\s٬]/g,'').replace(/ج\.?م\.?|جنيه|جم|egp|l\.?e\.?|£|\$|ريال|sar|usd/gi,'').replace(/-$/,'');
  var c=s.lastIndexOf(','),d=s.lastIndexOf('.');
  if(c>=0&&d>=0){s=c>d?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');}
  else if(c>=0){
    if(/^[-+]?\d{1,3}(,\d{3})+$/.test(s))s=s.replace(/,/g,'');
    else if(/^[-+]?\d+,\d{1,2}$/.test(s))s=s.replace(',','.');
    else return null;
  }else if(/^[-+]?\d{1,3}(\.\d{3}){2,}$/.test(s))s=s.replace(/\./g,'');
  if(!/^[-+]?\d+(\.\d+)?$/.test(s))return null;
  var n=Number(s);if(!isFinite(n))return null;
  return neg&&n>0?-n:n;
}
function okDate(y,m,d){
  if(y<2000||y>2100||m<1||m>12||d<1)return null;
  if(d>new Date(y,m,0).getDate())return null;
  return y+'-'+(m<10?'0':'')+m+'-'+(d<10?'0':'')+d;
}
function serialToIso(n,d1904){
  var ms=(d1904?Date.UTC(1904,0,1):Date.UTC(1899,11,30))+Math.floor(n)*864e5;
  return new Date(ms).toISOString().slice(0,10);
}
function parseDate(v,order){
  if(v==null||v==='')return null;
  if(typeof v==='object'&&v.d)return okDate(+v.d.slice(0,4),+v.d.slice(5,7),+v.d.slice(8,10))||null;
  if(typeof v==='number'){return v>=36526&&v<=73050?serialToIso(v,false):null;}
  var s=dig(String(v)).trim(),m;
  if((m=/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s)))return okDate(+m[1],+m[2],+m[3]);
  if((m=/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/.exec(s))){
    var a=+m[1],b=+m[2],y=+m[3];if(y<100)y+=2000;
    var d=a,mo=b;
    if(order==='mdy'){mo=a;d=b;if(a>12&&b<=12){d=a;mo=b;}}
    else if(b>12&&a<=12){mo=a;d=b;}
    return okDate(y,mo,d);
  }
  if((m=/^(\d{1,2})\s+([^\d\s,.]+)\.?,?\s+(\d{4})/.exec(s))){var mm=monthOf(m[2]);return mm?okDate(+m[3],mm,+m[1]):null;}
  if((m=/^([^\d\s,.]+)\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s))){var m2=monthOf(m[1]);return m2?okDate(+m[3],m2,+m[2]):null;}
  return null;
}

/* ---------- قراءة الملفات ---------- */
function u16(b,o){return b[o]|b[o+1]<<8;}
function u32(b,o){return (b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24)>>>0;}
function utf8(u8){return new TextDecoder('utf-8').decode(u8);}
async function inflate(u8){
  var ds=new DecompressionStream('deflate-raw'),w=ds.writable.getWriter();
  w.write(u8);w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
function zipIndex(b){
  var e=-1;
  for(var i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(b[i]===0x50&&b[i+1]===0x4b&&b[i+2]===5&&b[i+3]===6){e=i;break;}}
  if(e<0)throw E('الملف مش Excel سليم');
  var n=u16(b,e+10),p=u32(b,e+16),files={};
  for(var k=0;k<n;k++){
    if(u32(b,p)!==0x02014b50)break;
    var nl=u16(b,p+28),el=u16(b,p+30),cl=u16(b,p+32);
    files[utf8(b.subarray(p+46,p+46+nl))]={m:u16(b,p+10),c:u32(b,p+20),u:u32(b,p+24),o:u32(b,p+42)};
    p+=46+nl+el+cl;
  }
  return files;
}
async function zipRead(b,f){
  if(!f)return null;
  if(f.u>80*1048576)throw E('الملف ده أكبر من اللازم');
  var nl=u16(b,f.o+26),el=u16(b,f.o+28),s=f.o+30+nl+el,d=b.subarray(s,s+f.c);
  if(f.m===0)return utf8(d);
  if(f.m===8)return utf8(await inflate(d));
  throw E('طريقة ضغط الملف مش مدعومة');
}
function xdec(s){
  return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g,function(m,g){
    if(g==='amp')return '&';if(g==='lt')return '<';if(g==='gt')return '>';if(g==='quot')return '"';if(g==='apos')return "'";
    var c=(g[1]==='x'||g[1]==='X')?parseInt(g.slice(2),16):parseInt(g.slice(1),10);
    try{return String.fromCodePoint(c);}catch(e){return '';}
  });
}
function attr(s,n){var m=new RegExp('(?:^|\\s)'+n+'="([^"]*)"').exec(s);return m?xdec(m[1]):null;}
function colIdx(ref){var m=/^([A-Za-z]+)/.exec(ref),n=0;if(!m)return 0;for(var i=0;i<m[1].length;i++)n=n*26+(m[1].toUpperCase().charCodeAt(i)-64);return n-1;}
function textOf(x){var out='',re=/<t\b[^>]*>([\s\S]*?)<\/t>/g,m;x=x.replace(/<rPh\b[\s\S]*?<\/rPh>/g,'');while((m=re.exec(x)))out+=xdec(m[1]);return out;}
function isDateFmt(id,code){
  if((id>=14&&id<=22)||(id>=27&&id<=36)||(id>=45&&id<=47)||(id>=50&&id<=58))return true;
  if(!code||/^general$/i.test(code))return false;
  var c=code.replace(/"[^"]*"/g,'').replace(/\[[^\]]*\]/g,'').replace(/\\./g,'');
  return /[dyh]|m{1,5}|ss?/i.test(c)&&!/^[#0.,%\s;()?*_-]+$/.test(c);
}
function parseSheetXml(xml,sst,xfDate,d1904){
  var rows=[],maxc=0,ri=0,rowRe=/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g,m;
  while((m=rowRe.exec(xml))){
    var rr=attr(m[1],'r');ri=rr?parseInt(rr,10)-1:ri;
    if(ri>=30000)break;
    var body=m[2]||'',row=rows[ri]=rows[ri]||[],cRe=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,c,ci=0;
    while((c=cRe.exec(body))){
      var ref=attr(c[1],'r');if(ref)ci=colIdx(ref);
      var t=attr(c[1],'t'),s=attr(c[1],'s'),inner=c[2]||'',v=null,vm=/<v>([\s\S]*?)<\/v>/.exec(inner);
      if(t==='s'){v=vm?(sst[+vm[1]]==null?null:sst[+vm[1]]):null;}
      else if(t==='inlineStr'){v=textOf(inner);}
      else if(t==='str'){v=vm?xdec(vm[1]):null;}
      else if(t==='b'||t==='e'){v=null;}
      else if(vm&&vm[1]!==''){var nn=Number(vm[1]);if(isFinite(nn))v=(s!=null&&xfDate[+s]&&nn>=1&&nn<=73050)?{d:serialToIso(nn,d1904)}:nn;}
      if(v!==null&&v!==''){row[ci]=v;if(ci+1>maxc)maxc=ci+1;}
      ci++;
    }
    ri++;
  }
  var out=[];
  for(var i=0;i<rows.length;i++){var r=rows[i],a=[];for(var j=0;j<maxc;j++)a.push(r&&r[j]!==undefined?r[j]:null);out.push(a);}
  return out;
}
async function parseXlsx(buf){
  if(typeof DecompressionStream==='undefined')throw E('الموبايل ده قديم ومش بيقرا ملفات xlsx. احفظ الملف CSV وارفعه تاني.');
  var b=new Uint8Array(buf),f=zipIndex(b);
  if(!f['xl/workbook.xml']){
    if(f['content.xml'])throw E('ملفات ODS مش مدعومة. افتح الملف واحفظه xlsx أو CSV.');
    throw E('مش قادر أقرا الملف ده كـ Excel.');
  }
  var wb=await zipRead(b,f['xl/workbook.xml']),rels=await zipRead(b,f['xl/_rels/workbook.xml.rels'])||'';
  var d1904=/<workbookPr\b[^>]*date1904="(1|true)"/.test(wb),rid={};
  (rels.match(/<Relationship\b[^>]*>/g)||[]).forEach(function(t){var id=attr(t,'Id'),tg=attr(t,'Target');if(id&&tg)rid[id]=tg.charAt(0)==='/'?tg.slice(1):'xl/'+tg;});
  var sst=[],sx=await zipRead(b,f['xl/sharedStrings.xml']);
  if(sx){var re=/<si\b[^>]*?\/>|<si\b[^>]*>([\s\S]*?)<\/si>/g,m;while((m=re.exec(sx)))sst.push(m[1]?textOf(m[1]):'');}
  var xfDate=[],st=await zipRead(b,f['xl/styles.xml']);
  if(st){
    var codes={};(st.match(/<numFmt\b[^>]*>/g)||[]).forEach(function(t){var id=attr(t,'numFmtId');if(id!=null)codes[id]=attr(t,'formatCode');});
    var blk=/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(st);
    if(blk)(blk[1].match(/<xf\b[^>]*>/g)||[]).forEach(function(t,i){var id=+attr(t,'numFmtId');xfDate[i]=isDateFmt(id,codes[id]);});
  }
  var sheets=[],tags=wb.match(/<sheet\b[^>]*>/g)||[];
  for(var i=0;i<tags.length;i++){
    var nm=attr(tags[i],'name')||('Sheet'+(i+1)),path=rid[attr(tags[i],'r:id')];
    if(!path||!f[path])continue;
    var rows=parseSheetXml(await zipRead(b,f[path]),sst,xfDate,d1904);
    if(rows.some(function(r){return r.some(function(c){return c!==null;});}))sheets.push({name:nm,rows:rows});
  }
  return sheets;
}
function parseCsv(text){
  text=text.replace(/^\uFEFF/,'');
  var head=text.split(/\r?\n/).slice(0,6).join('\n'),best=',',bc=-1;
  [',',';','\t','|'].forEach(function(d){var c=head.split(d).length;if(c>bc){bc=c;best=d;}});
  var rows=[],row=[],cell='',q=false;
  for(var i=0;i<text.length;i++){
    var ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=ch;}
    else if(ch==='"'&&cell==='')q=true;
    else if(ch===best){row.push(cell);cell='';}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';rows.push(row);row=[];if(rows.length>=30000)break;}
    else cell+=ch;
  }
  if(cell!==''||row.length){row.push(cell);rows.push(row);}
  var maxc=0;rows.forEach(function(r){if(r.length>maxc)maxc=r.length;});
  return rows.map(function(r){var a=[];for(var j=0;j<maxc;j++){var v=r[j];v=v==null?'':String(v).trim();a.push(v===''?null:v);}return a;});
}
async function parseFile(buf,name){
  var b=new Uint8Array(buf);
  if(b.length>12*1048576)throw E('الملف كبير (الحد الأقصى 12 ميجا).');
  if(b[0]===0x50&&b[1]===0x4b)return parseXlsx(buf);
  if(b[0]===0xD0&&b[1]===0xCF)throw E('ده ملف Excel قديم (xls). افتحه في Excel واحفظه كـ xlsx أو CSV وارفعه تاني.');
  var text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(b);}
  catch(e){try{text=new TextDecoder('windows-1256').decode(b);}catch(e2){throw E('مش قادر أقرا ترميز الملف.');}}
  if(text.indexOf('\u0000')>=0)throw E('الملف ده مش Excel ولا CSV.');
  var rows=parseCsv(text);
  if(!rows.length)throw E('الملف فاضي.');
  return [{name:String(name||'ملف').replace(/\.[^.]+$/,''),rows:rows}];
}

/* ---------- التعرّف على الأعمدة ---------- */
function ctype(v){
  if(v==null||v==='')return '';
  if(typeof v==='object')return 'd';
  if(typeof v==='number')return 'n';
  if(toNum(v)!==null)return 'n';
  if(parseDate(v,'dmy'))return 'd';
  return 't';
}
function isMonthHead(h){
  if(h==null)return false;
  if(typeof h==='object')return true;
  if(typeof h!=='string')return false;
  return h.trim().split(/\s+/).length<=3&&monthOf(h)>0;
}
function colStats(R,from,j){
  var s={ne:0,n:0,d:0,t:0,sr:0,day:0,dist:{},nd:0,len:0,neg:0,pos:0};
  for(var i=from;i<R.length&&i<from+600;i++){
    var v=R[i][j],t=ctype(v);
    if(!t)continue;
    s.ne++;
    if(t==='n'){
      s.n++;var x=toNum(v);
      if(x<0)s.neg++;else if(x>0)s.pos++;
      if(typeof v==='number'){if(v>=36526&&v<=73050&&Math.floor(v)===v)s.sr++;if(Number.isInteger(v)&&v>=1&&v<=31)s.day++;}
      else if(/^\d{1,2}$/.test(dig(v).trim())&&+dig(v)>=1&&+dig(v)<=31)s.day++;
    }
    else if(t==='d')s.d++;
    else{s.t++;s.len+=String(v).length;var k=norm(v);if(!s.dist[k]){s.dist[k]=1;s.nd++;}}
  }
  return s;
}
function buildPlan(rows,sheetName,hrOverride){
  var R=rows.map(function(r){return r.slice(0,60);}),maxc=0;
  R.forEach(function(r){if(r.length>maxc)maxc=r.length;});
  var hr=-1;
  if(hrOverride!==undefined)hr=hrOverride;
  else{
    for(var i=0;i<Math.min(R.length,40)&&hr<0;i++){
      var ne=0,tx=0,mo=0,nu=0;
      for(var j=0;j<maxc;j++){var t=ctype(R[i][j]);if(t){ne++;if(t==='t')tx++;if(t==='n')nu++;if(isMonthHead(R[i][j]))mo++;}}
      if(ne<2||nu>0&&!mo)continue;
      if(!(tx>=Math.ceil(ne*0.6)||(mo>=3&&tx+mo>=ne*0.6)))continue;
      for(var k=i+1;k<Math.min(R.length,i+7);k++){if(R[k].some(function(c){return ctype(c)==='n';})){hr=i;break;}}
    }
  }
  var from=hr+1,cols=[],st=[],j;
  for(j=0;j<maxc;j++)st.push(colStats(R,from,j));
  var plan={hr:hr,cols:[],sheet:sheetName||'',layout:'table'};
  for(j=0;j<maxc;j++)plan.cols.push({i:j,title:hr>=0?R[hr][j]:null,role:''});
  var mc=[];
  if(hr>=0)for(j=0;j<maxc;j++)if(isMonthHead(R[hr][j]))mc.push(j);
  var role=function(j,r){plan.cols[j].role=r;};
  var has=function(r){return plan.cols.some(function(c){return c.role===r;});};
  if(mc.length>=3){
    var lab=-1,lb=-1;
    for(j=0;j<maxc;j++){if(mc.indexOf(j)>=0)continue;if(st[j].t>lb){lb=st[j].t;lab=j;}}
    mc.forEach(function(x){role(x,'month');});
    if(lab>=0)role(lab,'cat');
    for(j=0;j<maxc;j++)if(!plan.cols[j].role)role(j,'ignore');
    plan.layout='months';return plan;
  }
  for(j=0;j<maxc;j++){
    var h=hr>=0?roleFromHeader(R[hr][j]):'',s=st[j],ne2=Math.max(s.ne,1);
    if(h==='date'&&(s.d+s.sr+s.day)>=ne2*0.5)role(j,'date');
    else if((h==='exp'||h==='inc'||h==='amount')&&s.n>=ne2*0.5)role(j,h);
    else if((h==='name'||h==='cat'||h==='type')&&s.t>=ne2*0.5)role(j,h);
    else if(h==='ignore')role(j,'ignore');
  }
  if(!has('date')){for(j=0;j<maxc;j++)if(!plan.cols[j].role&&st[j].ne>0&&st[j].d>=st[j].ne*0.7){role(j,'date');break;}}
  var num=[];
  for(j=0;j<maxc;j++)if(!plan.cols[j].role&&st[j].ne>0&&st[j].n>=st[j].ne*0.7)num.push(j);
  if(!has('amount')&&!has('exp')&&!has('inc')){
    var titled=num.filter(function(x){return typeof plan.cols[x].title==='string'&&plan.cols[x].title.trim();});
    var hasNm=function(x){var l=plan.cols[x-1],r2=plan.cols[x+1];return !!((l&&l.role==='name')||(r2&&r2.role==='name'));};
    var paired=titled.length===num.length&&num.length>=1&&num.every(hasNm)&&!has('date')&&!has('cat');
    if(num.length>=3&&titled.length===num.length||num.length>=2&&titled.length===num.length&&has('date')||paired){
      num.forEach(function(x){role(x,hasKw(plan.cols[x].title,KW.inc)?'inccol':'catcol');});
    }else if(num.length===1){role(num[0],'amount');}
    else if(num.length>=2){
      var a=num[0],b2=num[1],both=0,either=0;
      for(var r=from;r<R.length&&r<from+600;r++){var x1=toNum(R[r][a]),x2=toNum(R[r][b2]);if(x1||x2)either++;if(x1&&x2)both++;}
      if(either>0&&both/either<0.15){role(a,'exp');role(b2,'inc');}
      else{role(a,'amount');role(b2,'ignore');}
      for(var q=2;q<num.length;q++)role(num[q],'ignore');
    }
  }
  var txt=[];
  for(j=0;j<maxc;j++)if(!plan.cols[j].role&&st[j].t>0&&st[j].t>=st[j].ne*0.5)txt.push(j);
  if(!has('type')){
    for(var t2=0;t2<txt.length;t2++){
      var cj=txt[t2],ks=Object.keys(st[cj].dist);
      if(ks.length&&ks.length<=4&&ks.every(function(k){return typeOf(k)!==null;})){role(cj,'type');txt.splice(t2,1);break;}
    }
  }
  txt.sort(function(x,y){return st[y].len/Math.max(st[y].t,1)-st[x].len/Math.max(st[x].t,1);});
  if(!has('name')&&txt.length&&(txt.length>1||st[txt[0]].nd/Math.max(st[txt[0]].t,1)>0.3||has('cat')))role(txt.shift(),'name');
  if(!has('cat')&&txt.length){
    txt.sort(function(x,y){return st[x].nd/Math.max(st[x].t,1)-st[y].nd/Math.max(st[y].t,1);});
    if(st[txt[0]].nd<=60)role(txt.shift(),'cat');
  }
  if(!has('name')&&!has('cat')&&txt.length)role(txt.shift(),'cat');
  for(j=0;j<maxc;j++)if(!plan.cols[j].role)role(j,'ignore');
  plan.layout=has('catcol')||has('inccol')?'matrix':'table';
  return plan;
}

/* ---------- استخراج الحركات ---------- */
function unq(s){return String(s==null?'':s).trim().replace(/^'(?=[=+\-@])/,'');}
function sheetMonth(name){
  var n=String(name||''),dn=dig(n),m=monthOf(n),y=/(20\d\d)/.exec(dn);
  if(!m&&(/شهر|month/i.test(n)||/^\s*\d{1,2}\s*$/.test(dn))){
    var rest=dn.replace(/20\d\d/g,' '),re=/(?:^|[^\d])(\d{1,2})(?!\d)/g,x;
    while((x=re.exec(rest))){var v=+x[1];if(v>=1&&v<=12){m=v;break;}}
  }
  return {m:m,y:y?+y[1]:0};
}
function mDist(y1,m1,y2,m2){return Math.abs((y1*12+m1)-(y2*12+m2));}
/* بيدوّر على تاريخ جوه نص الملاحظات (زي «لحمه. 26/8») ويختار التفسير الأقرب لشهر الشيت */
function textDate(s,sm,yearBase,order){
  var str=String(s==null?'':s),t=dig(str),m=/(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?/.exec(t);
  if(!m)return null;
  var a=+m[1],b=+m[2],yy=m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):0,cands=[];
  if(a>12)cands.push([a,b]);else if(b>12)cands.push([b,a]);
  else{cands.push([a,b],[b,a]);if(order==='mdy')cands.reverse();}
  var best=null;
  cands.forEach(function(c){
    (yy?[yy]:[yearBase-1,yearBase,yearBase+1]).forEach(function(y){
      var iso=okDate(y,c[1],c[0]);if(!iso)return;
      var dist=sm.m?mDist(y,c[1],yearBase,sm.m):Math.abs(y-yearBase)*12;
      if(!best||dist<best.dist)best={iso:iso,dist:dist};
    });
  });
  if(!best||(sm.m&&!yy&&best.dist>2))return null;
  var rest=(str.slice(0,m.index)+' '+str.slice(m.index+m[0].length)).replace(/\s+/g,' ').replace(/^[\s.,،\-:]+|[\s.,،\-:]+$/g,'');
  return {iso:best.iso,rest:rest};
}
function extract(rows,plan,opts){
  var out={records:[],skipped:{},dropped:[],neg:0,pos:0,min:'',max:'',noDate:false,guessed:0};
  var rs=(opts&&opts.restore)||{};
  var skip=function(why){out.skipped[why]=(out.skipped[why]||0)+1;};
  var by={},j;
  plan.cols.forEach(function(c){(by[c.role]=by[c.role]||[]).push(c.i);});
  var C=function(r){return by[r]&&by[r][0]!==undefined?by[r][0]:-1;};
  var sm=sheetMonth(plan.sheet),year=sm.y||opts.year||new Date().getFullYear();
  var dateC=C('date'),nameC=C('name'),catC=C('cat'),typeC=C('type'),amtC=C('amount'),expC=C('exp'),incC=C('inc');
  var months=by.month||[],cc=by.catcol||[],ic=by.inccol||[],nameCols=by.name||[];
  var mval={};
  months.forEach(function(x){var h=plan.cols[x].title,mm=0,yy=0;if(h&&typeof h==='object'){mm=+h.d.slice(5,7);yy=+h.d.slice(0,4);}else{mm=monthOf(h);var y2=/(20\d\d)/.exec(dig(String(h)));yy=y2?+y2[1]:0;}mval[x]=[mm,yy||year];});
  var layout=months.length?'months':(cc.length||ic.length)?'matrix':'table';
  if(layout==='table'&&amtC<0&&expC<0&&incC<0)return out;
  var nameFor=function(x){var best=-1,bd=1e9;nameCols.forEach(function(k){var d=Math.abs(k-x)+(k<x?0.5:0);if(d<bd){bd=d;best=k;}});return best;};
  var add=function(date,type,amt,name,cat,ri){
    if(!(amt>0)||amt>=1e9){skip('مبلغ مش صالح');return;}
    amt=Math.round(amt*100)/100;
    var c=unq(cat).slice(0,40)||(type==='inc'?'دخل آخر':'غير مصنّف');
    out.records.push({date:date,type:type,amount:amt,name:unq(name).slice(0,100),cat:c,row:ri+1});
    if(!out.min||date<out.min)out.min=date;
    if(!out.max||date>out.max)out.max=date;
  };
  function iso(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
  var rowDate=function(r){
    var v=r[dateC],d=parseDate(v,opts.dateOrder);
    if(!d&&sm.m){var dn=toNum(v);if(dn!==null&&Number.isInteger(dn)&&dn>=1&&dn<=31)d=okDate(year,sm.m,dn);}
    return {d:d,ok:!!d};
  };
  var lastD={};
  var pickDate=function(key,text){
    var td=textDate(text,sm,year,opts.dateOrder);
    if(td){lastD[key]=td.iso;return {d:td.iso,rest:td.rest,g:false};}
    if(lastD[key])return {d:lastD[key],rest:null,g:true};
    var f=sm.m?okDate(year,sm.m,1):null;
    if(f)return {d:f,rest:null,g:true};
    out.noDate=true;return {d:iso(new Date()),rest:null,g:true};
  };
  var totalRow=function(r){
    if(!r)return false;
    var li=catC>=0?catC:nameC;
    return (li>=0&&isTotalText(r[li]))||isTotalText(r.filter(function(c){return typeof c==='string';})[0]);
  };
  /* صف الإجمالي من غير كلمة «إجمالي»: بنشيله بس لو شكله إجمالي فعلاً:
     أول (أو آخر) رقم في العمود بيساوي مجموع الباقي، وكل خانات التاريخ والتفاصيل والفئة فيه فاضية.
     أي حركة ليها تاريخ أو اسم بتفضل زي ما هي حتى لو مبلغها صدفة بيساوي مجموع الباقي. وكل صف بيتشال بيتعرض مبلغه في المعاينة وتقدر ترجّعه. */
  var skipCell={},labelCols={};
  [dateC,nameC,catC,typeC].concat(nameCols).forEach(function(k){if(k>=0)labelCols[k]=1;});
  var hasLabelCols=Object.keys(labelCols).length>0;
  var blankLabels=function(r){for(var k in labelCols){var c=r[k];if(c!==null&&c!==undefined&&String(c).trim()!=='')return false;}return true;};
  [].concat(by.amount||[],by.exp||[],by.inc||[],cc,ic).forEach(function(x){
    var idx=[];
    for(var r=plan.hr+1;r<rows.length;r++){if(totalRow(rows[r]))continue;var v=toNum(rows[r]&&rows[r][x]);if(v!==null&&v!==0)idx.push(r);}
    if(idx.length<2||!hasLabelCols)return;
    var cands=[idx[0],idx[idx.length-1]];
    for(var k=0;k<2;k++){
      var r0=cands[k],rest=0;
      idx.forEach(function(r){if(r!==r0)rest+=Math.abs(toNum(rows[r][x]));});
      if(Math.abs(Math.abs(toNum(rows[r0][x]))-rest)<0.5&&blankLabels(rows[r0])){skipCell[r0+':'+x]=1;break;}
    }
  });
  var dropCell=function(ri,x,amt){
    var key=ri+':'+x;if(!skipCell[key])return false;
    var back=!!rs[key];out.dropped.push({key:key,row:ri+1,amount:Math.abs(amt),back:back});
    if(back)return false;
    skip('إجمالي (مجموع)');return true;
  };
  var amountCols=[].concat(by.amount||[],by.exp||[],by.inc||[],cc,ic);
  for(var ri=plan.hr+1;ri<rows.length;ri++){
    var r=rows[ri];
    if(!r||!r.some(function(c){return c!==null&&c!=='';}))continue;
    if(totalRow(r)){
      var wk=ri+':w',wback=!!rs[wk],wmx=0;
      amountCols.forEach(function(ci){var n=toNum(r[ci]);if(n!==null&&Math.abs(n)>wmx&&Math.abs(n)<1e9)wmx=Math.abs(n);});
      if(wmx>0)out.dropped.push({key:wk,row:ri+1,amount:wmx,back:wback,word:true});
      if(!wback){skip('صف إجمالي');continue;}
    }
    if(layout==='months'){
      var lab=catC>=0?r[catC]:null;
      if(lab==null||String(lab).trim()===''){continue;}
      months.forEach(function(x){
        var v=toNum(r[x]);if(v===null||v===0)return;
        var md=mval[x];if(!md[0])return;
        var dd=okDate(md[1],md[0],1);if(!dd){skip('تاريخ مش صالح');return;}
        var type=opts.def==='inc'?'inc':'exp';
        if(opts.def==='sign'){type=v<0?'exp':'inc';v=Math.abs(v);}
        add(dd,type,Math.abs(v),'',String(lab),ri);
      });
      continue;
    }
    var D=dateC>=0?rowDate(r):null;
    if(D&&!D.ok){skip('تاريخ ناقص أو مش مفهوم');continue;}
    var dsel=function(key,text){
      if(D)return {d:D.d,rest:null};
      var p=pickDate(key,text);if(p.g)out.guessed++;return p;
    };
    if(layout==='matrix'){
      var any=false;
      cc.concat(ic).forEach(function(x){
        var v=toNum(r[x]);if(v===null||v===0)return;
        if(dropCell(ri,x,v)){any=true;return;}
        var nk=nameFor(x),nt=nk>=0?r[nk]:'',p=dsel('c'+x,nt);
        any=true;add(p.d,ic.indexOf(x)>=0?'inc':'exp',Math.abs(v),p.rest!==null?p.rest:nt,plan.cols[x].title,ri);
      });
      if(!any)skip('صف من غير مبالغ');
      continue;
    }
    var nm=nameC>=0?r[nameC]:'',ct=catC>=0?r[catC]:'',p0=dsel('t',nm),nm2=p0.rest!==null?p0.rest:nm;
    if(expC>=0||incC>=0){
      var e=expC>=0?toNum(r[expC]):null,i2=incC>=0?toNum(r[incC]):null,done=false,dr=false;
      if(e){if(dropCell(ri,expC,e))dr=true;else{add(p0.d,'exp',Math.abs(e),nm2,ct,ri);done=true;}}
      if(i2){if(dropCell(ri,incC,i2))dr=true;else{add(p0.d,'inc',Math.abs(i2),nm2,ct,ri);done=true;}}
      if(!done&&!dr)skip('صف من غير مبالغ');
      continue;
    }
    var v2=toNum(r[amtC]);
    if(v2===null||v2===0){skip('صف من غير مبالغ');continue;}
    if(dropCell(ri,amtC,v2))continue;
    if(v2<0)out.neg++;else out.pos++;
    var ty=typeC>=0?typeOf(r[typeC]):null;
    if(!ty){ty=opts.def==='inc'?'inc':opts.def==='sign'?(v2<0?'exp':'inc'):'exp';}
    add(p0.d,ty,Math.abs(v2),nm2,ct,ri);
  }
  return out;
}

/* ---------- الواجهة ---------- */
var ROLES=[['ignore','تجاهل'],['date','التاريخ'],['amount','المبلغ'],['exp','مبلغ مصروف'],['inc','مبلغ دخل'],['name','التفاصيل'],['cat','الفئة'],['type','النوع (دخل/مصروف)'],['catcol','عمود مصروف: العنوان هو الفئة'],['inccol','عمود دخل: العنوان هو المصدر'],['month','عمود شهر: العنوان هو الشهر']];
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmN(n){return (Math.round(n*100)/100).toLocaleString('en-US');}
function colName(i){var s='';i++;while(i>0){var m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;}
function shown(v){if(v==null)return '';if(typeof v==='object')return v.d;return String(v).slice(0,24);}

async function open(file,api){
  var old=document.getElementById('imp');if(old)old.remove();
  var ov=document.createElement('div');ov.className='ov';ov.id='imp';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
  ov.innerHTML='<div class="sheet"><div class="sh-head"><h2>استيراد من Excel</h2><button class="xbtn" type="button" id="imp-x" aria-label="إغلاق">×</button></div><p class="note" id="imp-st">بيقرا الملف…</p><div id="imp-body"></div></div>';
  document.body.appendChild(ov);
  var $=function(s){return ov.querySelector(s);};
  var busy=false,close=function(){if(!busy)ov.remove();};
  $('#imp-x').onclick=close;
  ov.addEventListener('click',function(e){if(e.target===ov)close();});
  var sheets;
  try{
    if(file.size>12*1048576)throw E('الملف كبير (الحد الأقصى 12 ميجا).');
    sheets=await parseFile(await file.arrayBuffer(),file.name);
    if(!sheets.length)throw E('مفيش بيانات في الملف.');
  }catch(e){$('#imp-st').textContent=e&&e.ar?e.message:'مقدرتش أقرا الملف. اتأكد إنه Excel (xlsx) أو CSV.';$('#imp-st').className='err';return;}
  var opts={def:'exp',dateOrder:'dmy',year:new Date().getFullYear()};
  var S=sheets.map(function(s){return {name:s.name,rows:s.rows,plan:buildPlan(s.rows,s.name),on:true,ex:null,restore:{}};});
  var neg=0,pos=0;
  S.forEach(function(s){var e=extract(s.rows,s.plan,opts);neg+=e.neg;pos+=e.pos;});
  if(neg>0&&pos>0)opts.def='sign';
  $('#imp-st').textContent='الملف: '+file.name+'. راجع اللي اتعرّف عليه، وعدّل لو في حاجة غلط.';
  var body=$('#imp-body');
  body.innerHTML=
   '<div class="card" style="gap:8px"><label>المبالغ اللي من غير نوع واضح تتحسب<select id="imp-def"><option value="exp">مصروف</option><option value="inc">دخل</option><option value="sign">الموجب دخل والسالب مصروف</option></select></label>'+
   '<label>ترتيب التاريخ في الملف<select id="imp-ord"><option value="dmy">يوم / شهر / سنة</option><option value="mdy">شهر / يوم / سنة</option></select></label>'+
   '<label>السنة (لو الملف فيه أسماء شهور من غير سنة)<input type="text" id="imp-year" inputmode="numeric" maxlength="4" autocomplete="off"></label></div>'+
   '<div id="imp-sheets"></div><div class="card" id="imp-sum" style="gap:8px"></div><p class="err" id="imp-err" role="alert"></p>'+
   '<div class="acts"><button class="btn primary" type="button" id="imp-go">استيراد</button><button class="btn" type="button" id="imp-cancel">إلغاء</button></div>';
  $('#imp-def').value=opts.def;$('#imp-ord').value=opts.dateOrder;$('#imp-year').value=String(opts.year);
  var openMap=-1;
  function roleSel(i,j,v){return '<select data-m="'+i+':'+j+'" aria-label="دور العمود">'+ROLES.map(function(r){return '<option value="'+r[0]+'"'+(r[0]===v?' selected':'')+'>'+r[1]+'</option>';}).join('')+'</select>';}
  function mapHtml(i){
    var s=S[i],p=s.plan,h='<div style="margin-top:6px"><label>صف العناوين (0 = مفيش عناوين)<input type="text" data-hr="'+i+'" inputmode="numeric" maxlength="3" value="'+(p.hr+1)+'" autocomplete="off"></label>';
    p.cols.forEach(function(c){
      var sample='';for(var r=p.hr+1;r<s.rows.length&&!sample;r++){sample=shown(s.rows[r][c.i]);}
      h+='<div class="maprow"><span class="muted n">'+colName(c.i)+'</span><span style="min-width:0;overflow-wrap:anywhere"><b>'+esc(shown(c.title)||'—')+'</b><br><span class="muted" style="font-size:12.5px">'+esc(sample)+'</span></span>'+roleSel(i,c.i,c.role)+'</div>';
    });
    return h+'</div>';
  }
  function paintSheets(){
    $('#imp-sheets').innerHTML=S.map(function(s,i){
      return '<div class="card" style="gap:8px;margin-top:10px"><label class="chk"><input type="checkbox" data-on="'+i+'"'+(s.on?' checked':'')+'><span><b>'+esc(s.name)+'</b> <span class="muted" id="imp-n'+i+'"></span></span></label>'+
        '<button class="btn small" type="button" data-edit="'+i+'">'+(openMap===i?'إخفاء الأعمدة':'تعديل الأعمدة')+'</button>'+(openMap===i?mapHtml(i):'')+'</div>';
    }).join('');
    recompute();
  }
  function recompute(){
    var recs=[],skipped={},mn='',mx='',noDate=false,en=0,ne=0,guessed=0,drop=[];
    S.forEach(function(s,i){
      s.ex=extract(s.rows,s.plan,Object.assign({},opts,{restore:s.restore}));
      var n=s.ex.records.length;var el=$('#imp-n'+i);if(el)el.textContent='('+n+' حركة)';
      if(!s.on)return;
      en++;recs=recs.concat(s.ex.records);(s.ex.dropped||[]).forEach(function(d){drop.push({i:i,sheet:s.name,d:d});});guessed+=s.ex.guessed||0;if(s.ex.noDate)noDate=true;
      Object.keys(s.ex.skipped).forEach(function(k){skipped[k]=(skipped[k]||0)+s.ex.skipped[k];});
      if(s.ex.min&&(!mn||s.ex.min<mn))mn=s.ex.min;if(s.ex.max&&s.ex.max>mx)mx=s.ex.max;
    });
    var ex=recs.filter(function(r){return r.type==='exp';}),ic=recs.filter(function(r){return r.type==='inc';});
    var sum=function(l){return l.reduce(function(a,r){return a+r.amount;},0);};
    var h='<b>'+recs.length+' حركة جاهزة</b>';
    if(recs.length)h+='<span class="muted">'+ex.length+' مصروف بإجمالي '+fmN(sum(ex))+' ج.م، و'+ic.length+' دخل بإجمالي '+fmN(sum(ic))+' ج.م. من '+mn+' إلى '+mx+'.</span>';
    var cats={};recs.forEach(function(r){cats[r.cat]=(cats[r.cat]||0)+r.amount;});
    var cl=Object.keys(cats).sort(function(a,b){return cats[b]-cats[a];}).slice(0,8).map(function(k){return k+': '+fmN(cats[k]);});
    if(cl.length>1||(cl.length===1&&recs.length>1))h+='<span class="muted">إجمالي كل فئة: '+esc(cl.join(' · '))+'. قارنهم بأرقام ملفك.</span>';
    if(guessed)h+='<span class="note">'+guessed+' حركة معندهاش تاريخ واضح في الملاحظات، فاتحسبت بتاريخ آخر حركة فوقها في نفس العمود (أو أول الشهر). راجع المعاينة.</span>';
    var sk=Object.keys(skipped).map(function(k){return k+': '+skipped[k];});
    if(sk.length)h+='<span class="note">اتجاهل: '+esc(sk.join('، '))+'</span>';
    if(drop.length){
      h+='<div class="note"><b>صفوف اتعاملت على إنها إجمالي</b><br>راجع المبالغ دي. لو فيها حركة حقيقية علّم عليها وهتتضاف:'+
        drop.map(function(x){return '<label class="chk"><input type="checkbox" data-rs="'+x.i+'|'+esc(x.d.key)+'"'+(x.d.back?' checked':'')+'><span>'+(S.length>1?esc(x.sheet)+' · ':'')+'صف '+x.d.row+': '+fmN(x.d.amount)+' ج.م</span></label>';}).join('')+'</div>';
    }
    if(noDate)h+='<span class="note">مفيش عمود تاريخ، فالحركات هتتسجل بتاريخ النهارده. اختار عمود التاريخ من «تعديل الأعمدة» لو موجود.</span>';
    if(recs.length){
      h+='<div class="tblwrap"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>الفئة</th><th>التفاصيل</th></tr></thead><tbody>'+
        recs.slice(0,6).map(function(r){return '<tr><td class="n">'+r.date+'</td><td>'+(r.type==='inc'?'دخل':'مصروف')+'</td><td class="n">'+fmN(r.amount)+'</td><td>'+esc(r.cat)+'</td><td class="nm">'+esc(r.name)+'</td></tr>';}).join('')+'</tbody></table></div>';
    }
    $('#imp-sum').innerHTML=h;
    var go=$('#imp-go');go.textContent=recs.length?'استيراد '+recs.length+' حركة':'استيراد';go.disabled=!recs.length;
    ov._recs=recs;
  }
  ov.addEventListener('change',function(e){
    var t=e.target;$('#imp-err').textContent='';
    if(t.id==='imp-def'){opts.def=t.value;recompute();}
    else if(t.id==='imp-ord'){opts.dateOrder=t.value;recompute();}
    else if(t.id==='imp-year'){var y=parseInt(dig(t.value),10);if(y>=2000&&y<=2100)opts.year=y;recompute();}
    else if(t.hasAttribute('data-rs')){var q=t.getAttribute('data-rs').split('|');S[+q[0]].restore[q[1]]=t.checked;recompute();}
    else if(t.hasAttribute('data-on')){S[+t.getAttribute('data-on')].on=t.checked;recompute();}
    else if(t.hasAttribute('data-m')){var p=t.getAttribute('data-m').split(':');S[+p[0]].plan.cols[+p[1]].role=t.value;recompute();}
    else if(t.hasAttribute('data-hr')){
      var i=+t.getAttribute('data-hr'),n=parseInt(dig(t.value),10);if(!(n>=0&&n<=200))n=0;
      S[i].plan=buildPlan(S[i].rows,S[i].name,n-1);paintSheets();
    }
  });
  ov.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-edit]');
    if(b){var i=+b.getAttribute('data-edit');openMap=openMap===i?-1:i;paintSheets();}
  });
  $('#imp-cancel').onclick=close;
  $('#imp-go').onclick=async function(){
    var recs=ov._recs||[];if(!recs.length||busy)return;
    busy=true;$('#imp-go').disabled=true;$('#imp-cancel').disabled=true;$('#imp-x').disabled=true;$('#imp-err').textContent='';
    var st=$('#imp-st');st.className='note';st.textContent='بيستورد…';
    try{
      var res=await api.commit(recs,function(d,t){st.textContent='بيستورد '+d+' من '+t+'…';});
      busy=false;
      body.innerHTML='<div class="card"><h2>تم الاستيراد</h2><p>اتضافت <b class="n">'+res.added+'</b> حركة'+(res.dups?'، وتجاهلت <b class="n">'+res.dups+'</b> حركة كانت موجودة قبل كده':'')+(res.newCats?'، وعملت <b class="n">'+res.newCats+'</b> فئة جديدة':'')+'.'+(res.merged?' فئات زيادة عن الحد اتجمّعت في «أخرى».':'')+'</p></div><div class="acts"><button class="btn primary" type="button" id="imp-ok">تمام</button></div>';
      st.textContent='';$('#imp-ok').onclick=function(){ov.remove();};
      if(api.after)api.after();
    }catch(e){
      busy=false;$('#imp-go').disabled=false;$('#imp-cancel').disabled=false;$('#imp-x').disabled=false;
      st.textContent='';
      $('#imp-err').textContent=(e&&e.message&&/[\u0600-\u06FF]/.test(e.message))?e.message:'حصلت مشكلة وقت الاستيراد. لو اتضاف جزء، جرّب تاني وهتجاهل الحركات الموجودة.';
    }
  };
  paintSheets();
}

var api={open:open,parseFile:parseFile,parseCsv:parseCsv,buildPlan:buildPlan,extract:extract,parseDate:parseDate,toNum:toNum,monthOf:monthOf};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MasrofyImport=api;
})(typeof window!=='undefined'?window:globalThis);
