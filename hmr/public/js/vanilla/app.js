// @vnano-hmr-vanilla
// Классический скрипт: ни import, ни export. Только window.$v.

if (!window.$v) {
    document.getElementById('app').innerHTML =
        '<pre style="color:#b00;padding:20px">window.$v is undefined — ' +
        'vnano.js не загрузился (404 или пустой файл)</pre>';
    throw new Error('[vanilla] vnano.js не определил window.$v');
}

const { createApp } = window.$v;

class VanillaApp extends Component {
    render() {
        return h('div', null, 'Hello TRUE vanilla · ' + new Date().toLocaleTimeString());
    }
}

// Guard: при re-exec файл исполняется целиком — без guard был бы перемонтаж
if (!window.__vanillaBooted) {
    window.__vanillaBooted = true;
    createApp("#app").mount(VanillaApp);
}