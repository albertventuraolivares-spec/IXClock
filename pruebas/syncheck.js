const fs=require('fs'),vm=require('vm');
const h=fs.readFileSync('/home/user/IXClock/index.html','utf8');
const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m,i=0,ok=0,bad=0;
while((m=re.exec(h))){
  i++; const code=m[1]; if(!code.trim()){ok++;continue;}
  const line=h.slice(0,m.index).split('\n').length;
  try{ new vm.Script(code,{filename:'b'+i}); ok++; }
  catch(e){ bad++; console.log('SyntaxError bloque '+i+' (linea ~'+line+'): '+e.message); }
}
console.log('script blocks OK: '+ok+' / '+(ok+bad));
