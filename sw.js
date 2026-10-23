/* دفتر مصروفي: service worker
   بيحفظ ملفات التطبيق على الجهاز علشان يفتح من غير إنترنت.
   الشبكة أولًا (علشان التحديثات توصل)، ولو النت وقع أو بطيء بنرجع للنسخة المحفوظة.
   مبنلمسش أي طلب لـ Supabase: البيانات بتتخزن من جوه التطبيق نفسه. */
var CACHE = 'masrofy-shell-v3';
var FILES = [
  './', 'index.html', 'app.css', 'fonts.css', 'app.js', 'import.js', 'xlsx.js', 'theme-init.js', 'config.js',
  'vendor/supabase.js', 'manifest.webmanifest',
  'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'privacy.html', 'terms.html',
  'fonts/ibm-plex-mono-latin-500-normal.woff2',
  'fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2',
  'fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2',
  'fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2',
  'fonts/ibm-plex-sans-arabic-latin-400-normal.woff2',
  'fonts/ibm-plex-sans-arabic-latin-500-normal.woff2',
  'fonts/ibm-plex-sans-arabic-latin-600-normal.woff2',
  'fonts/readex-pro-arabic-500-normal.woff2',
  'fonts/readex-pro-arabic-600-normal.woff2',
  'fonts/readex-pro-latin-500-normal.woff2',
  'fonts/readex-pro-latin-600-normal.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // ملف ناقص مايوقفش التثبيت كله
      return Promise.all(FILES.map(function (f) {
        return c.add(new Request(f, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (m) {
    if (m) return m;
    if (req.mode === 'navigate') return caches.match(new URL('index.html', self.registration.scope).href);
    return undefined;
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase وغيره: مفيش تدخل
  e.respondWith(new Promise(function (resolve) {
    var done = false;
    var timer = setTimeout(function () {
      fromCache(req).then(function (m) { if (m && !done) { done = true; resolve(m); } });
    }, 3500);
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      if (!done) { done = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      fromCache(req).then(function (m) {
        if (!done) { done = true; resolve(m || Response.error()); }
      });
    });
  }));
});
