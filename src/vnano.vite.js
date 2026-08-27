import fs from 'fs';
import path from 'path';

export default function vnanoHMR() {

    return {
        name: 'vnano-hmr',
        enforce: 'pre',

        // FIX: handleHotUpdate удалён. При watch.ignored он не срабатывает,
        // а return [] не отменяет full-reload. Канал обновлений — fs.watch ниже.

        // ------------------------------------------------------------------
        // Внедрение клиентского слушателя в index.html
        // ------------------------------------------------------------------
        transformIndexHtml(html) {
            const hmrClientScript = `
<script type="module">
(async function () {
    // FIX: не полагаемся на автоинъекцию import.meta.hot — для плагинных
    // инлайновых скриптов она не срабатывает. Импортируем клиент сами.
    var hot = null;
    try {
        var viteClient = await import(/* @vite-ignore */ '/@vite/client');
        hot = viteClient.createHotContext('/index.html'); // владелец = сама страница
        console.log('[vnano-hmr][CLIENT] hot context acquired via /@vite/client.');
    } catch (e) {
        // Например, продакшн-сборка: /@vite/client там не раздаётся
        console.warn('[vnano-hmr][CLIENT] @vite/client недоступен — soft-HMR отключён.', e);
        return;
    }

    var timer  = null;
    var seq    = 0;
    var inFlig = false;

    async function patchPage() {
        var my = ++seq;
        if (inFlig) return;
        inFlig = true;
        try {
            var res = await fetch('/?vnano-raw-html=1&t=' + Date.now(), { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            if (my !== seq) return;

            var freshDoc = new DOMParser().parseFromString(await res.text(), 'text/html');

            if (document.title !== freshDoc.title) document.title = freshDoc.title;
            syncHeadStyles(freshDoc);
            patchBody(freshDoc);

            window.dispatchEvent(new CustomEvent('vnano:page-patched'));
            console.log('[vnano-hmr][CLIENT] ✅ HTML updated successfully.');
        } catch (e) {
            console.error('[vnano-hmr][CLIENT] ❌ HTML update failed → full reload...', e);
            location.reload();
        } finally {
            inFlig = false;
        }
    }

    function patchBody(freshDoc) {
    var curApp   = document.getElementById('app');
    var freshApp = freshDoc.getElementById('app');

    if (!curApp || !freshApp) {
        // Радикальный фолбэк остаётся: #app исчез из разметки
        console.warn('[vnano-hmr][CLIENT] ⚠️ #app missing, replacing body...');
        var liveScripts = Array.from(document.body.querySelectorAll('script'));
        document.body.innerHTML = freshDoc.body.innerHTML;
        document.body.querySelectorAll('script').forEach(function (s) { s.remove(); });
        liveScripts.forEach(function (s) { document.body.appendChild(s); });
        return;
    }

    // --- БЫЛО: замена детей #app. УБРАНО. ---

    // 1. Синхронизируем только атрибуты контейнера (class/style/data-*)
    for (var i = 0; i < freshApp.attributes.length; i++) {
        var attr = freshApp.attributes[i];
        if (attr.name === 'id') continue;
        if (curApp.getAttribute(attr.name) !== attr.value)
            curApp.setAttribute(attr.name, attr.value);
    }
    Array.from(curApp.attributes).forEach(function (a) {
        if (a.name !== 'id' && !freshApp.hasAttribute(a.name))
            curApp.removeAttribute(a.name);
    });

    // 2. Предупреждаем, если в файле появилась статика ВНУТРИ #app,
    //    но рантайм-контент не рушим
    if (freshApp.children.length > 0) {
        console.warn(
            '[vnano-hmr][CLIENT] ⚠️ В index.html есть статичная разметка внутри #app.\\n' +
            '    Рантайм-контент сохранён. Правки внутри #app требуют\\n' +
            '    перемонтирования (см. слушатель vnano:page-patched).'
        );
    }

    // 3. Позиционный дифф статических соседей #app — как раньше
    function kids(el) {
        return Array.prototype.filter.call(el.childNodes, function (n) {
            if (n.nodeType !== 1) return true;
            return n.tagName !== 'SCRIPT' && n.id !== 'app';
        });
    }

    var cur   = kids(document.body);
    var fresh = kids(freshDoc.body);
    var n     = Math.min(cur.length, fresh.length);

    for (var i = 0; i < n; i++)
        if (!cur[i].isEqualNode(fresh[i])) cur[i].replaceWith(fresh[i].cloneNode(true));
    for (var j = n; j < fresh.length; j++) document.body.appendChild(fresh[j].cloneNode(true));
    for (var k = n; k < cur.length; k++) cur[k].remove();
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

    function schedulePatch() {
        clearTimeout(timer);
        timer = setTimeout(patchPage, 60);
    }

    hot.on('vnano:html-update', function (data) {
        console.log('[vnano-hmr][CLIENT] 🚀 Received "vnano:html-update"', data || '');
        schedulePatch();
    });

    hot.on('vite:beforeFullReload', function (payload) {
        var p = (payload && payload.path) || '';
        if (!p || p === '/' || /\\.html(\\?|$)/.test(p)) {
            console.log('[vnano-hmr][CLIENT] 🛑 Cancelled Vite full-reload → soft patch');
            schedulePatch();
            throw '[vnano-hmr] full-reload cancelled';
        }
    });
})();
</script>`;

            return html.replace('</head>', hmrClientScript + '</head>');
        },

        // ------------------------------------------------------------------
        // Эндпоинт свежего HTML + собственный вотчер (вместо handleHotUpdate)
        // ------------------------------------------------------------------
        configureServer(server) {
            // Middleware: ?vnano-raw-html=1 → файл с диска, минуя кэш Vite
            server.middlewares.use(async (req, res, next) => {
                if (!req.url || !req.url.includes('vnano-raw-html')) return next();
                try {
                    const file = path.resolve(server.config.root, 'index.html');
                    const raw  = await fs.promises.readFile(file, 'utf-8');
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-store');
                    res.end(await server.transformIndexHtml('/', raw));
                } catch (err) {
                    res.statusCode = 500;
                    res.end(String(err));
                }
            });

            // FIX: смотрим КАТАЛОГ, а не файл — атомарные сохранения
            // (vim/VSCode делают rename поверх) не убивают вотчер
            const indexFile = path.resolve(server.config.root, 'index.html');
            const indexDir  = path.dirname(indexFile);
            let debounce;

            const pushUpdate = () => {
                console.log('[vnano-hmr][SERVER] ⚠️ index.html changed → soft patch');
                server.ws.send({
                    type: 'custom',
                    event: 'vnano:html-update',
                    data: { ts: Date.now() } // полезная нагрузка для логов
                });
            };

            const dirWatcher = fs.watch(indexDir, (_event, filename) => {
                if (filename && path.basename(filename) !== 'index.html') return;
                clearTimeout(debounce);
                debounce = setTimeout(pushUpdate, 50);
            });

            // Прибраться при остановке сервера
            if (server.httpServer) {
                server.httpServer.once('close', () => dirWatcher.close());
            }
        },

        // ------------------------------------------------------------------
        // HMR компонентов (без изменений)
        // ------------------------------------------------------------------
        transform(code, id) {
            if (id.includes('node_modules') || id.includes('vnano.js') || id.includes('vnano.esm.js')) return null;
            if (id.includes('main.js')) return null;
            if (!code.includes('extends Component')) return null;

            const regex = /export\s+default\s+class\s+(\w+)\s+extends\s+Component/g;
            const match = regex.exec(code);
            if (!match) return null;

            const className = match[1];

            const hmrCode = `
import { applyHMR } from 'vnano.js';
let __vnano_old_class = ${className};
if (import.meta.hot) {
    console.log('[vnano-hmr][CLIENT] JS HMR bound for component: ${className}');
    import.meta.hot.accept((newMod) => {
        console.log('[vnano-hmr][CLIENT] ⚡ JS module updated for ${className}');
        if (newMod && newMod.default) {
            applyHMR(__vnano_old_class, newMod.default);
            __vnano_old_class = newMod.default;
            console.log('[vnano-hmr][CLIENT] ✅ applyHMR executed for ${className}');
        }
    });
}
`;
            return { code: code + hmrCode, map: null };
        }
    };
}