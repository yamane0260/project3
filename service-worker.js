const CACHE_NAME = 'goki-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/main.css',
    '/js/app.js',
    '/manifest.webmanifest'
];

// インストール
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// アクティベート
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// フェッチ - Cache First戦略
self.addEventListener('fetch', (event) => {
    // GET リクエストのみキャッシュ
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // キャッシュがあればそれを返す
                if (cachedResponse) {
                    return cachedResponse;
                }

                // なければネットワークから取得
                return fetch(event.request)
                    .then(response => {
                        // レスポンスが無効な場合はそのまま返す
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // レスポンスをクローンしてキャッシュに保存
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // ネットワークエラーの場合、基本的なオフラインページを返す
                        if (event.request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// バックグラウンド同期（オプション）
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        // 必要に応じてバックグラウンド同期処理を実装
        console.log('Background sync triggered');
    }
});