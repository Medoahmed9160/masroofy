/* تصدير Excel حقيقي (xlsx): بيفتح في Excel وGoogle Sheets من غير مشاكل فاصل أو ترميز. */
(function(root){
'use strict';
var T=null;
function crc32(u8){
  if(!T){T=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;T[n]=c>>>0;}}
  var crc=0xFFFFFFFF;for(var i=0;i<u8.length;i++)crc=T[(crc^u8[i])&255]^(crc>>>8);
  return (crc^0xFFFFFFFF)>>>0;
}
function enc(s){return new TextEncoder().encode(s);}
function esc(s){return String(s==null?'':s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function zip(files){
  var parts=[],central=[],off=0;
  files.forEach(function(f){
    var nb=enc(f.name),crc=crc32(f.data),sz=f.data.length;
    var lh=new Uint8Array(30+nb.length),dv=new DataView(lh.buffer);
    dv.setUint32(0,0x04034b50,true);dv.setUint16(4,20,true);dv.setUint16(6,0x0800,true);dv.setUint16(12,0x21,true);
    dv.setUint32(14,crc,true);dv.setUint32(18,sz,true);dv.setUint32(22,sz,true);dv.setUint16(26,nb.length,true);lh.set(nb,30);
    var ch=new Uint8Array(46+nb.length),cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(14,0x21,true);
    cv.setUint32(16,crc,true);cv.setUint32(20,sz,true);cv.setUint32(24,sz,true);cv.setUint16(28,nb.length,true);cv.setUint32(42,off,true);ch.set(nb,46);
    parts.push(lh,f.data);central.push(ch);off+=lh.length+sz;
  });
  var cd=0;central.forEach(function(c){cd+=c.length;});
  var end=new Uint8Array(22),ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,cd,true);ev.setUint32(16,off,true);
  var all=parts.concat(central,[end]),len=0;all.forEach(function(p){len+=p.length;});
  var out=new Uint8Array(len),o=0;all.forEach(function(p){out.set(p,o);o+=p.length;});
  return out;
}
function serial(iso){var y=+iso.slice(0,4),m=+iso.slice(5,7),d=+iso.slice(8,10);return Math.round((Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/864e5);}
var COLS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/* opts: {sheet, header:[...], kinds:['d','s','s','s','n'], widths:[...], rows:[[...]]} */
function build(opts){
  var n=opts.header.length,rows=opts.rows,last=rows.length+1;
  var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:'+COLS[n-1]+last+'"/>'+
    '<sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>'+
    opts.widths.map(function(w,i){return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>';}).join('')+'</cols><sheetData><row r="1">'+
    opts.header.map(function(h,i){return '<c r="'+COLS[i]+'1" s="1" t="inlineStr"><is><t>'+esc(h)+'</t></is></c>';}).join('')+'</row>';
  rows.forEach(function(r,ri){
    var rn=ri+2;x+='<row r="'+rn+'">';
    r.forEach(function(v,i){
      var ref=COLS[i]+rn,k=opts.kinds[i];
      if(v===null||v===undefined||v==='')return;
      if(k==='d')x+='<c r="'+ref+'" s="2"><v>'+serial(String(v))+'</v></c>';
      else if(k==='n')x+='<c r="'+ref+'" s="3"><v>'+Number(v)+'</v></c>';
      else x+='<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+esc(v)+'</t></is></c>';
    });
    x+='</row>';
  });
  x+='</sheetData><autoFilter ref="A1:'+COLS[n-1]+last+'"/></worksheet>';
  var NS='xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var files=[
    {name:'[Content_Types].xml',data:enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>')},
    {name:'_rels/.rels',data:enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+R+'/officeDocument" Target="xl/workbook.xml"/></Relationships>')},
    {name:'xl/workbook.xml',data:enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook '+NS+' xmlns:r="'+R+'"><sheets><sheet name="'+esc(opts.sheet)+'" sheetId="1" r:id="rId1"/></sheets></workbook>')},
    {name:'xl/_rels/workbook.xml.rels',data:enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+R+'/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="'+R+'/styles" Target="styles.xml"/></Relationships>')},
    {name:'xl/styles.xml',data:enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet '+NS+'><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')},
    {name:'xl/worksheets/sheet1.xml',data:enc(x)}
  ];
  return zip(files);
}
var api={build:build};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MasrofyXlsx=api;
})(typeof window!=='undefined'?window:globalThis);
