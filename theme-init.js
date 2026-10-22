/* بيطبّق المظهر المختار قبل ما الصفحة تترسم، وبيمنع فتح التطبيق جوه صفحة موقع تاني (iframe). */
try{if(window.top!==window.self){document.documentElement.style.display='none';try{window.top.location.replace(window.self.location.href);}catch(e){}}}catch(e){document.documentElement.style.display='none';}
try{var v=window.localStorage.getItem('masrofy:theme');if(v==='light'||v==='dark')document.documentElement.setAttribute('data-theme',v);}catch(e){}
