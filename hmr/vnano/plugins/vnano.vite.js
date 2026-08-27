import fs from 'fs';
import path from 'path';

export default function vnanoHMR(options = {}) {
    const opts = {
        addLibs: true,      // авто-инжект /vnano.js для classic-страниц
        softPatch: true,    // мягкий патч HTML без перезагрузки
        vanillaHMR: true,   // re-exec + applyHMR для классических скриптов
        moduleHMR: true,    // applyHMR-хвосты для модульных компонентов
        ...options,
    };

    return {
        name: 'vnano-hmr',
        enforce: 'pre',

        // ==================================================================
        // 1. Инжект в каждую страницу:
        //    а) авто-подключение /vnano.js (тумблер addLibs)
        //    б) клиентский слушатель с единой очередью применений
        //       (поведение каналов гейтится OPTS, пришитыми в код)
        // ==================================================================
        transformIndexHtml(html) {
            const OPTS = JSON.stringify({
                softPatch: !!opts.softPatch,
                vanillaHMR: !!opts.vanillaHMR,
            });

            let out = html;

            // --- АВТО-ИНЖЕКТ БИБЛИОТЕКИ -----------------------------------
            if (opts.addLibs) {
                const classicSrcRe = /<script\b(?![^>]*\btype\s*=\s*["']?module\b)[^>]*\bsrc\s*=/i;
                const hasVnanoTag = /<script[^>]*src\s*=\s*["'][^"']*vnano\.js/i.test(out);
                const m = classicSrcRe.exec(out);

                if (m && !hasVnanoTag) {
                    const tag =
                        '<script src="/vnano.js"></script>\n' +
                        '<script>if (!window.$v) console.error(' +
                        '"[vnano-hmr] /vnano.js не определил window.$v — ' +
                        'проверьте UMD-сборку в vnano/library/vnano.js (404 или пустой файл?)");' +
                        '</script>\n';
                    out = out.slice(0, m.index) + tag + out.slice(m.index);
                    console.log('[vnano-hmr][SERVER] auto-injected /vnano.js (classic scripts detected)');
                }
            }

            // --- КЛИЕНТСКИЙ СЛУШАТЕЛЬ --------------------------------------
            const hmrClientScript = `
<script type="module">
(async function () {
    var hot = null;
    try {
        var viteClient = await import(/* @vite-ignore */ '/@vite/client');
        var PAGE = location.pathname.replace(/\\/$/, '') || '/';
        hot = viteClient.createHotContext(PAGE);
        console.log('[vnano-hmr][CLIENT] hot context acquired for', PAGE);
    } catch (e) {
        console.warn('[vnano-hmr][CLIENT] @vite/client недоступен — soft-HMR отключён.', e);
        return;
    }

    // Тумблеры, пришитые сервером из sandbox.config.js
    var OPTS = ${OPTS};

    var timer = null;

    function owns(file) {
        if (!file) return true;
        var f = String(file).split('?')[0];
        var me = (PAGE === '/' ? '/index.html' : PAGE);
        return f === me;
    }

    function vanillaScriptByPath(p) {
        if (!p) return null;
        var tags = document.querySelectorAll('script[src]');
        for (var i = 0; i < tags.length; i++) {
            var t = tags[i];
            var ty = (t.type || '').toLowerCase();
            if (ty.indexOf('module') >= 0) continue;
            var abs;
            try { abs = new URL(t.getAttribute('src'), location.href).pathname; }
            catch (e) { continue; }
            if (p === abs || abs.indexOf(p) >= 0 || p.indexOf(abs) >= 0) return t;
        }
        return null;
    }

    // ---- Единая последовательная очередь применений ----
    // HTML-патчи и applyHMR исполняются по одному, в порядке прибытия.
    var queue = [], draining = false;

    function enqueue(task) {
        queue.push(task);
        drain();
    }

    function drain() {
        if (draining) return;
        draining = true;
        (async function () {
            while (queue.length) {
                try { await queue.shift()(); }
                catch (e) { console.error('[vnano-hmr][CLIENT] task failed:', e); }
            }
            draining = false;
        })();
    }

    // tail'ы компонентов кладут применение applyHMR в эту же очередь
    window.__vnanoEnqueue = enqueue;

    // ---- HTML: мягкий патч (пересборка body с живыми якорями) ----
    async function applyHtmlPatch() {
        try {
            var sep = PAGE.indexOf('?') < 0 ? '?' : '&';
            var res = await fetch(PAGE + sep + 'vnano-raw-html=1&t=' + Date.now(), { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);

            var freshDoc = new DOMParser().parseFromString(await res.text(), 'text/html');
            if (document.title !== freshDoc.title) document.title = freshDoc.title;
            syncHeadStyles(freshDoc);
            patchBody(freshDoc);

            window.dispatchEvent(new CustomEvent('vnano:page-patched'));
            console.log('[vnano-hmr][CLIENT] ✅ HTML updated successfully.');
        } catch (e) {
            console.error('[vnano-hmr][CLIENT] ❌ HTML update failed → full reload...', e);
            location.reload();
        }
    }

    // серия сохранений схлопывается в один патч; fetch всегда берёт свежий файл
    function schedulePatch() {
        clearTimeout(timer);
        timer = setTimeout(function () { enqueue(applyHtmlPatch); }, 120);
    }

    // ---- Vanilla: переисполнение классического <script> ----
    var lastExec = {};

    function reexecVanilla(file) {
        var tag = vanillaScriptByPath(file);
        if (!tag) {
            var all = Array.from(document.querySelectorAll('script[src]'))
                .map(function (s) { return s.getAttribute('src'); });
            console.warn('[vnano-hmr][CLIENT] ⚠️ classic <script> not found for', file, '— tags:', all);
            return false;
        }
        var now = Date.now();
        if (lastExec[file] && now - lastExec[file] < 300) return true;
        lastExec[file] = now;

        fetch(tag.src.split('?')[0] + '?t=' + Date.now(), { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function (code) {
                if (code.indexOf('__vnanoHmrStore') < 0)
                    console.warn('[vnano-hmr][CLIENT] ⚠️ tail applyHMR отсутствует — transform не применился?');
                try {
                    (new Function(code + '\\n//# sourceURL=' + file))();
                    console.log('[vnano-hmr][CLIENT] ✅ vanilla script re-executed:', file);
                } catch (e) {
                    console.error('[vnano-hmr][CLIENT] ❌ vanilla re-exec failed:', e);
                }
            })
            .catch(function (e) {
                console.error('[vnano-hmr][CLIENT] ❌ vanilla update failed → reload', e);
                location.reload();
            });
        return true;
    }

    // ---- Каналы ----
    hot.on('vnano:html-update', function (data) {
        if (!OPTS.softPatch) return;
        console.log('[vnano-hmr][CLIENT] 🚀 vnano:html-update', data || '');
        if (owns(data && data.file)) schedulePatch();
    });

    hot.on('vnano:js-update', function (data) {
        if (!OPTS.vanillaHMR) return;
        var f = data && data.file;
        if (!f) return;
        console.log('[vnano-hmr][CLIENT] 🚀 vnano:js-update', data);
        reexecVanilla(f);
    });

    // Страховка: гасим штатный full-reload для наших случаев.
    // Проверки через slice — экранирование сломать невозможно.
    hot.on('vite:beforeFullReload', function (payload) {
        var p = String((payload && payload.path) || '');
        var clean = p.split('?')[0];

        if ((!p || p === '/' || clean.slice(-5) === '.html') && owns(p)) {
            if (!OPTS.softPatch) return;   // фича выключена → честный reload
            console.log('[vnano-hmr][CLIENT] 🛑 Cancelled full-reload → soft patch:', p || '/');
            schedulePatch();
            throw '[vnano-hmr] html full-reload cancelled';
        }
        if (p && clean.slice(-3) === '.js') {
            if (!OPTS.vanillaHMR) return;  // фича выключена → честный reload
            if (reexecVanilla(clean)) {
                console.log('[vnano-hmr][CLIENT] 🛑 Cancelled full-reload → vanilla re-exec:', p);
                throw '[vnano-hmr] vanilla full-reload cancelled';
            }
            // тег не найден → не глушим: пусть Vite перезагрузит
        }
    });

    // ---- Пересборка body: статика из файла + живые якоря (#app, script) ----
    function patchBody(freshDoc) {
        var curApp   = document.getElementById('app');
        var freshApp = freshDoc.getElementById('app');

        if (!curApp || !freshApp) {
            console.warn('[vnano-hmr][CLIENT] ⚠️ #app missing, replacing body...');
            var liveScripts = Array.from(document.body.querySelectorAll('script'));
            document.body.innerHTML = freshDoc.body.innerHTML;
            document.body.querySelectorAll('script').forEach(function (s) { s.remove(); });
            liveScripts.forEach(function (s) { document.body.appendChild(s); });
            return;
        }

        // Якоря — узлы, которые нельзя пересоздавать:
        // #app (в нём живое приложение), <script> (переисполняться нельзя)
        function isAnchor(n) {
            if (n.nodeType !== 1) return false;
            if (n.id === 'app') return true;
            return n.tagName === 'SCRIPT';
        }

        var liveAnchors = [];
        Array.prototype.forEach.call(document.body.childNodes, function (n) {
            if (isAnchor(n)) liveAnchors.push(n);
        });
        var freshAnchorCount = 0;
        Array.prototype.forEach.call(freshDoc.body.childNodes, function (n) {
            if (isAnchor(n)) freshAnchorCount++;
        });

        var newList = [];
        var ai = 0;
        var anchorsOk = liveAnchors.length === freshAnchorCount;

        Array.prototype.forEach.call(freshDoc.body.childNodes, function (n) {
            if (isAnchor(n)) {
                newList.push(anchorsOk ? liveAnchors[ai++] : n.cloneNode(false));
            } else {
                newList.push(n.cloneNode(true));
            }
        });

        if (!anchorsOk) {
            console.warn('[vnano-hmr][CLIENT] ⚠️ набор script/#app изменился — статика пересобрана, живые узлы перенесены в конец');
            newList = newList.filter(function (n) { return !isAnchor(n); });
            liveAnchors.forEach(function (n) { newList.push(n); });
        }

        // Если итог совпадает с текущим DOM — не дёргаем страницу
        var cur = Array.prototype.slice.call(document.body.childNodes);
        var same = cur.length === newList.length && cur.every(function (n, i) {
            return n === newList[i] || n.isEqualNode(newList[i]);
        });
        if (same) return;

        document.body.replaceChildren.apply(document.body, newList);
    }

    function syncHeadStyles(freshDoc) {
        var fresh = Array.from(freshDoc.head.querySelectorAll('style'));
        var curr  = Array.from(document.head.querySelectorAll('style:not([data-vite-dev-id])'));
        fresh.forEach(function (node, i) {
            var live = curr[i];
            if (live && live.textContent === node.textContent) return;
            var el = node.cloneNode(true);
            el.setAttribute('data-vnano-managed', '');
            if (live) live.replaceWith(el);
            else document.head.appendChild(el);
        });
        for (var i = fresh.length; i < curr.length; i++)
            if (curr[i].hasAttribute('data-vnano-managed')) curr[i].remove();
    }
})();
</script>`;

            return out.replace('</head>', hmrClientScript + '</head>');
        },

        // ==================================================================
        // 2. Эндпоинт свежего HTML + вотчер (html и vanilla-js)
        // ==================================================================
        configureServer(server) {
            const rootDir = path.resolve(server.config.root);

            // ?vnano-raw-html=1 → файл с диска, минуя кэш Vite, для ЛЮБОЙ страницы
            server.middlewares.use(async (req, res, next) => {
                if (!req.url || !req.url.includes('vnano-raw-html')) return next();
                try {
                    const url = new URL(req.url, 'http://localhost');
                    let rel = decodeURIComponent(url.pathname);
                    if (rel.endsWith('/')) rel += 'index.html';
                    const file = path.resolve(rootDir, '.' + rel);

                    if (!file.startsWith(rootDir) || !file.endsWith('.html')) {
                        res.statusCode = 403;
                        res.end('forbidden');
                        return;
                    }
                    const raw = await fs.promises.readFile(file, 'utf-8');
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-store');
                    res.end(await server.transformIndexHtml(url.pathname, raw));
                } catch (err) {
                    res.statusCode = 500;
                    res.end(String(err));
                }
            });

            // вотчер: пофайловые дебаунсы, ветки гейтятся тумблерами
            const timers = {};
            const dirWatcher = fs.watch(rootDir, {recursive: true}, (_e, relName) => {
                if (!relName) return;
                const norm = relName.replace(/\\/g, '/').toLowerCase();
                const key = norm;

                if (norm.endsWith('.html')) {
                    if (!opts.softPatch) return;
                    clearTimeout(timers[key]);
                    timers[key] = setTimeout(() => {
                        const file = '/' + relName.replace(/\\/g, '/');
                        console.log('[vnano-hmr][SERVER] ⚠️', file, 'changed → soft patch');
                        server.ws.send({
                            type: 'custom', event: 'vnano:html-update',
                            data: {file, ts: Date.now()}
                        });
                    }, 50);

                } else if (norm.endsWith('.js')) {
                    if (!opts.vanillaHMR) return;
                    // модульные .js ведёт сам Vite; vanilla узнаём по маркеру
                    fs.promises.readFile(path.join(rootDir, relName), 'utf-8')
                        .then(src => {
                            if (!src.includes('@vnano-hmr-vanilla')) return;
                            clearTimeout(timers[key]);
                            timers[key] = setTimeout(() => {
                                const file = '/' + relName.replace(/\\/g, '/');
                                console.log('[vnano-hmr][SERVER] ⚠️', file, 'changed → re-exec');
                                server.ws.send({
                                    type: 'custom', event: 'vnano:js-update',
                                    data: {file, ts: Date.now()}
                                });
                            }, 50);
                        })
                        .catch(() => {
                        });
                }
            });

            if (server.httpServer) server.httpServer.once('close', () => dirWatcher.close());
        },

        // ==================================================================
        // 3. HMR компонентов. Маркер решает ветку; ветки гейтятся тумблерами.
        //    ВАЖНО: vanilla-ветка первой — '@vnano-hmr' подстрока '-vanilla'.
        // ==================================================================
        transform(code, id) {
            if (id.includes('node_modules')) return null;

            // ---------- ВАНИЛЬ (классический скрипт, без import.meta) ----------
            if (code.includes('@vnano-hmr-vanilla')) {
                if (!opts.vanillaHMR) return null;
                if (!code.includes('extends Component')) return null;
                const m = /class\s+([A-Za-z_$][\w$]*)\s+extends\s+Component/.exec(code);
                if (!m) return null;
                const tail = `
;(function () {
    var $v = (typeof globalThis !== 'undefined' && globalThis.$v) || window.$v;
    if (!$v || typeof $v.applyHMR !== 'function') return;
    var cls = ${m[1]};
    $v.__vnanoHmrStore = $v.__vnanoHmrStore || {};
    var prev = $v.__vnanoHmrStore['${m[1]}'];
    function run() {
        if (prev && prev !== cls) {
            console.log('[vnano-hmr][CLIENT] ⚡ applyHMR (vanilla) for ${m[1]}');
            $v.applyHMR(prev, cls);
        }
        $v.__vnanoHmrStore['${m[1]}'] = cls;
    }
    if (prev && typeof window !== 'undefined' && window.__vnanoEnqueue) {
        window.__vnanoEnqueue(run);
    } else {
        run();
    }
})();`;
                return {code: code + tail, map: null};
            }

            // ---------- МОДУЛИ (self-accept через import.meta.hot) ----------
            if (code.includes('@vnano-hmr')) {
                if (!opts.moduleHMR) return null;
                if (!code.includes('extends Component')) return null;
                const m = /class\s+([A-Za-z_$][\w$]*)\s+extends\s+Component/.exec(code);
                if (!m) return null;
                const tail = `
if (import.meta.hot) { import.meta.hot.accept(); }
(function () {
    var $v = (typeof globalThis !== 'undefined' && globalThis.$v) || window.$v;
    if (!$v || typeof $v.applyHMR !== 'function') return;
    var cls = ${m[1]};
    $v.__vnanoHmrStore = $v.__vnanoHmrStore || {};
    var prev = $v.__vnanoHmrStore['${m[1]}'];
    function run() {
        if (prev && prev !== cls) {
            console.log('[vnano-hmr][CLIENT] ⚡ applyHMR for ${m[1]}');
            $v.applyHMR(prev, cls);
        }
        $v.__vnanoHmrStore['${m[1]}'] = cls;
    }
    if (prev && typeof window !== 'undefined' && window.__vnanoEnqueue) {
        window.__vnanoEnqueue(run);
    } else {
        run();
    }
})();`;
                return {code: code + tail, map: null};
            }

            return null;
        }
    };
}