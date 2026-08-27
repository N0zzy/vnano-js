// vnano.components.js
// Чистый JavaScript, без модулей.
// Подключается ПОСЛЕ основного файла vnano.js в HTML: <script src="vnano.components.js"></script>

(function (global) {
    // Получаем базовые классы из глобального объекта (который создал vnano.js)
    const {
        Component, h, createDOMNode,
        signal, batch, effect, createApp
    } = global.$v || {};

    class VirtualList extends Component {
        constructor(props) {
            super(props);
            this.domPool = [];
            this.scrollTrack = null;
            this.itemHeight = props.itemHeight || 40;
            this._mounted = false;
            this.scrollAnim = null;

            if (props.instanceRef) props.instanceRef(this);

            this.handleScroll = () => {
                requestAnimationFrame(() => this.renderItems());
            };

            // НОВОЕ: Обработчик колесика мыши с контролем скорости
            this.handleWheel = (e) => {
                e.preventDefault(); // Отключаем стандартный, слишком быстрый скролл браузера

                // Дистанция за один щелчок мыши (по умолчанию 3 строки)
                const step = this.props.scrollStep || (this.itemHeight * 3);
                const direction = e.deltaY > 0 ? 1 : -1;
                const targetTop = this.container.scrollTop + (direction * step);

                this.scrollTo(targetTop, this.props.smoothScroll !== false);
            };

            this.setRef = (dom) => {
                if (dom && !this.isInitialized) {
                    this.container = dom;
                    this.initVanilla();
                }
            };
        }

        getLength() {
            return this.props.length !== undefined ? this.props.length : (this.props.items ? this.props.items.length : 0);
        }

        initVanilla() {
            this.isInitialized = true;
            const {height = 500} = this.props;
            const length = this.getLength();
            const totalHeight = length * this.itemHeight;

            this.dynamicMode = totalHeight > 2000000;
            this.trackHeight = this.dynamicMode ? 2000000 : totalHeight;

            this.container.style.overflowY = 'auto';
            this.container.style.height = `${height}px`;
            this.container.style.position = 'relative';
            this.container.style.contain = 'strict';

            this.scrollTrack = document.createElement('div');
            this.scrollTrack.style.cssText = `position:absolute;top:0;left:0;right:0;height:${this.trackHeight}px;pointer-events:none;`;
            this.container.appendChild(this.scrollTrack);

            const poolSize = Math.ceil(height / this.itemHeight) + 10;
            this.domPool = [];
            for (let i = 0; i < poolSize; i++) {
                const el = document.createElement('div');
                el.style.cssText = `position:absolute;height:${this.itemHeight}px;left:0;right:0;top:-9999px;`;
                this.container.appendChild(el);
                this.domPool.push({el: el, index: -1});
            }

            // Слушатели
            this.container.addEventListener('scroll', this.handleScroll);
            // ВАЖНО: passive: false позволяет нам вызвать preventDefault
            this.container.addEventListener('wheel', this.handleWheel, {passive: false});

            this.renderItems();
        }

        // НОВОЕ: Программный переход к элементу по индексу
        scrollToIndex(index) {
            if (!this.isInitialized) return;
            const length = this.getLength();
            if (index >= length) return;

            let targetTop;
            if (this.dynamicMode) {
                const maxScrollTop = Math.max(1, this.trackHeight - this.container.clientHeight);
                const dataRange = Math.max(1, length - 1);
                const scrollRatio = index / dataRange;
                targetTop = scrollRatio * maxScrollTop;
            } else {
                targetTop = index * this.itemHeight;
            }

            this.scrollTo(targetTop, true);
        }

        // НОВОЕ: Плавная анимация скролла
        scrollTo(targetTop, smooth = true) {
            if (this.scrollAnim) cancelAnimationFrame(this.scrollAnim);

            const maxScroll = this.trackHeight - this.container.clientHeight;
            targetTop = Math.max(0, Math.min(targetTop, maxScroll));

            if (!smooth) {
                this.container.scrollTop = targetTop;
                this.renderItems();
                return;
            }

            const startTop = this.container.scrollTop;
            const distance = targetTop - startTop;
            const duration = 200; // ms
            let startTime = null;

            const animate = (time) => {
                if (!startTime) startTime = time;
                const progress = Math.min((time - startTime) / duration, 1);
                const eased = progress * (2 - progress); // Ease-out quadratic
                this.container.scrollTop = startTop + (distance * eased);
                if (progress < 1) {
                    this.scrollAnim = requestAnimationFrame(animate);
                }
            };
            this.scrollAnim = requestAnimationFrame(animate);
        }

        renderItems() {
            const length = this.getLength();
            const scrollTop = this.container.scrollTop;
            let startIndex;
            let pixelOffset = 0;

            if (this.dynamicMode) {
                const maxScrollTop = Math.max(1, this.trackHeight - this.container.clientHeight);
                const scrollRatio = Math.min(1, Math.max(0, scrollTop / maxScrollTop));
                const dataRange = Math.max(0, length - this.domPool.length);
                const exactStart = scrollRatio * dataRange;
                startIndex = Math.floor(exactStart);
                pixelOffset = (exactStart - startIndex) * this.itemHeight;
            } else {
                startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - 5);
            }

            for (let i = 0; i < this.domPool.length; i++) {
                const poolItem = this.domPool[i];
                const itemIndex = startIndex + i;

                if (itemIndex < length) {
                    if (poolItem.index !== itemIndex) {
                        if (this.dynamicMode) {
                            poolItem.el.style.top = `${scrollTop + i * this.itemHeight - pixelOffset}px`;
                        } else {
                            poolItem.el.style.top = `${itemIndex * this.itemHeight}px`;
                        }

                        if (this.props.length !== undefined) {
                            this.props.renderItem(itemIndex, poolItem.el);
                        } else if (this.props.items) {
                            this.props.renderItem(this.props.items[itemIndex], poolItem.el, itemIndex);
                        }
                        poolItem.index = itemIndex;
                    }
                } else {
                    if (poolItem.index !== -1) {
                        poolItem.el.style.top = '-9999px';
                        poolItem.index = -1;
                    }
                }
            }
        }

        updateVanilla() {
            if (this.isInitialized) {
                const length = this.getLength();
                const totalHeight = length * this.itemHeight;
                this.dynamicMode = totalHeight > 2000000;
                this.trackHeight = this.dynamicMode ? 2000000 : totalHeight;
                this.scrollTrack.style.height = `${this.trackHeight}px`;
                this.domPool.forEach(p => p.index = -1);
                this.renderItems();
            }
        }

        update() {
            super.update();
            this.updateVanilla();
        }

        renderAfter() {
            if (this._mounted) this.updateVanilla(); else this._mounted = true;
        }

        refresh() {
            if (this.isInitialized) {
                this.domPool.forEach(p => p.index = -1);
                this.renderItems();
            }
        }

        componentWillUnmount() {
            if (this.scrollAnim) cancelAnimationFrame(this.scrollAnim);
            if (this.container) {
                this.container.removeEventListener('scroll', this.handleScroll);
                this.container.removeEventListener('wheel', this.handleWheel);
                this.container.innerHTML = '';
            }
        }

        render() {
            return h('div', {ref: this.setRef, skipChildren: true});
        }
    }

    class VirtualBlock extends Component {
        constructor(props) {
            super(props);
            this.visibilityObserver = null;
            this.lifecycleObserver = null;
            this.contentWrapper = null;
            this.isMounting = false;
            this.contentMounted = false;

            this.setRef = (dom) => {
                if (dom && !this.isInitialized) {
                    this.container = dom;
                    this.initObservers();
                }
            };
        }

        initObservers() {
            this.isInitialized = true;

            // Создаем обертку для контента
            this.contentWrapper = document.createElement('div');
            this.contentWrapper.style.cssText = 'width: 100%; display: none;';
            this.container.appendChild(this.contentWrapper);

            // Размер буферной зоны (по умолчанию 1000px сверху и снизу)
            const buffer = this.props.bufferDistance || 1000;

            // Наблюдатель 1: Отвечает за видимость (display: block / none)
            this.visibilityObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.contentWrapper.style.display = 'block';
                    } else {
                        this.contentWrapper.style.display = 'none';
                    }
                });
            }, {threshold: 0.01});

            // Наблюдатель 2: Отвечает за жизненный цикл (Создание / Удаление)
            // Расширяем зону наблюдения на buffer пикселей вверх и вниз
            this.lifecycleObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Блок вошел в буферную зону -> начинаем асинхронно создавать
                        this.mountAsync();
                    } else {
                        // Блок покинул буферную зону -> уничтожаем DOM
                        this.destroy();
                    }
                });
            }, {rootMargin: `${buffer}px 0px ${buffer}px 0px`});

            this.visibilityObserver.observe(this.container);
            this.lifecycleObserver.observe(this.container);
        }

        // Асинхронное восстановление контента
        mountAsync() {
            if (this.isMounting || this.contentMounted) return;
            this.isMounting = true;

            // Используем rAF, чтобы не блокировать основной поток при скролле
            requestAnimationFrame(() => {
                if (!this.isMounting) return; // Если за это время вызвали destroy, отменяем

                this.contentWrapper.innerHTML = '';
                const contentVNode = this.props.renderContent();
                if (contentVNode) {
                    this.contentWrapper.appendChild(createDOMNode(contentVNode));
                }
                this.contentMounted = true;
                this.isMounting = false;
            });
        }

        // Уничтожение контента (очистка памяти)
        destroy() {
            this.isMounting = false; // Отменяем запланированное создание, если оно еще идет
            if (!this.contentMounted) return;

            this.contentWrapper.innerHTML = '';
            this.contentMounted = false;
        }

        componentWillUnmount() {
            if (this.visibilityObserver) this.visibilityObserver.disconnect();
            if (this.lifecycleObserver) this.lifecycleObserver.disconnect();
        }

        render() {
            // Внешний блок держит высоту, чтобы скроллбар не прыгал
            return h('div', {
                ref: this.setRef,
                style: `height: ${this.props.height || 500}px; overflow: hidden; position: relative;`
            });
        }
    }

    class LazyImage extends Component {
        constructor(props) {
            super(props);
            this.observer = null;
            this.loaded = false;

            this.setRef = (dom) => {
                if (dom && !this.isInitialized) {
                    this.container = dom;
                    this.initObserver();
                }
            };
        }

        initObserver() {
            this.isInitialized = true;
            // Загружаем чуть заранее (за 200px до появления на экране)
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.loaded) {
                        this.loadImage();
                    }
                });
            }, {rootMargin: '200px 0px 200px 0px'});

            this.observer.observe(this.container);
        }

        loadImage() {
            const img = this.container.querySelector('img');
            if (img) {
                img.onload = () => {
                    img.style.opacity = '1'; // Плавное появление
                };
                img.src = this.props.src;
                this.loaded = true;
                this.observer.disconnect(); // Больше не следим за этой картинкой
            }
        }

        componentWillUnmount() {
            if (this.observer) this.observer.disconnect();
        }

        render() {
            // ИСПРАВЛЕНО: Используем объекты стилей вместо строк
            const placeholderStyle = {
                width: this.props.width || '100%',
                height: this.props.height || '200px',
                background: '#eee',
                position: 'relative',
                overflow: 'hidden'
            };
            const imgStyle = {
                width: '100%',
                height: '100%',
                objectFit: this.props.fit || 'cover',
                opacity: '0',
                transition: 'opacity 0.3s ease'
            };
            return h('div', {ref: this.setRef, style: placeholderStyle},
                h('img', {src: '', style: imgStyle, alt: this.props.alt || ''})
            );
        }
    }

    class InfiniteScroll extends Component {
        constructor(props) {
            super(props);
            this.observer = null;
            this.loading = false;

            this.setRef = (dom) => {
                if (dom && !this.isInitialized) {
                    this.sentinel = dom;
                    this.initObserver();
                }
            };
        }

        initObserver() {
            this.isInitialized = true;
            // Срабатывает, когда до маяка остается 500px
            this.observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && !this.loading) {
                    this.loading = true;
                    if (this.props.loadMore) {
                        // Поддержка как Promise, так и обычных функций
                        Promise.resolve(this.props.loadMore()).finally(() => {
                            this.loading = false;
                        });
                    }
                }
            }, {rootMargin: '500px 0px 0px 0px'});

            this.observer.observe(this.sentinel);
        }

        componentWillUnmount() {
            if (this.observer) this.observer.disconnect();
        }

        render() {
            return h('div', {
                ref: this.setRef,
                style: {height: '1px', width: '100%'}
            });
        }
    }

    class TransitionGroup extends Component {
        constructor(props) {
            super(props);
            this._childStates = new Map();
        }

        componentWillUnmount() {
            this._childStates.forEach(data => {
                if (data.timer) clearTimeout(data.timer);
                if (data.raf) cancelAnimationFrame(data.raf);
            });
        }

        _getKey(vnode) {
            return vnode?.props?.key;
        }

        _processChildren(newChildren) {
            const keys = new Set();
            const resultNodes = [];

            // 1. Обработка видимых и новых детей (строго в порядке прихода)
            newChildren.forEach(vnode => {
                const key = this._getKey(vnode);
                if (key === undefined || key === null) {
                    resultNodes.push(vnode);
                    return;
                }

                keys.add(key);

                if (!this._childStates.has(key)) {
                    resultNodes.push(this._handleEnter(key, vnode));
                } else {
                    resultNodes.push(this._handleUpdate(key, vnode));
                }
            });

            // 2. Обработка удаляемых детей (уходят в конец массива)
            this._childStates.forEach((data, key) => {
                if (!keys.has(key)) {
                    resultNodes.push(this._handleLeave(key));
                }
            });

            return resultNodes;
        }

        _handleEnter(key, vnode) {
            const {name, duration} = this.props;
            const clone = this._cloneWithClass(vnode, `${name}-enter`, key);

            this._childStates.set(key, {vnode: clone, state: 'enter', timer: null, raf: null});
            const entry = this._childStates.get(key);

            entry.raf = requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const el = this._findDomByKey(key);
                    if (el) {
                        el.classList.add(`${name}-enter-active`);
                        el.classList.remove(`${name}-enter`);
                    }
                });
            });

            entry.timer = setTimeout(() => {
                const el = this._findDomByKey(key);
                if (el) el.classList.remove(`${name}-enter-active`);
                const e = this._childStates.get(key);
                if (e) e.state = 'visible';
            }, duration);

            return clone;
        }

        _handleUpdate(key, vnode) {
            const {name} = this.props;
            const entry = this._childStates.get(key);

            // Если элемент вернули до того, как он удалился
            if (entry.state === 'leave' || entry.state === 'leave-active') {
                if (entry.timer) clearTimeout(entry.timer);
                if (entry.raf) cancelAnimationFrame(entry.raf);

                const el = this._findDomByKey(key);
                if (el) {
                    el.classList.remove(`${name}-leave`);
                    el.classList.remove(`${name}-leave-active`);
                }
                entry.state = 'visible';
            }

            // ВАЖНО: Клонируем, чтобы гарантированно добавить data-key атрибут!
            const clone = this._cloneWithClass(vnode, '', key);
            entry.vnode = clone;
            return clone;
        }

        _handleLeave(key) {
            const {name, duration} = this.props;
            const entry = this._childStates.get(key);

            if (entry.state !== 'leave' && entry.state !== 'leave-active') {
                entry.state = 'leave';

                entry.raf = requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const el = this._findDomByKey(key);
                        if (el) {
                            el.classList.add(`${name}-leave-active`);
                        }
                    });
                });

                entry.timer = setTimeout(() => {
                    this._childStates.delete(key);
                    this.update();
                }, duration);
            }

            // Возвращаем старый VNode, чтобы VDOM его пропустил и не стер классы
            return entry.vnode;
        }

        _cloneWithClass(vnode, classes, key) {
            if (!vnode || !vnode.props) return vnode;
            const oldClass = vnode.props.className || vnode.props.class || '';
            const newClass = (oldClass + ' ' + classes).trim();
            const newProps = {...vnode.props, className: newClass};
            if (key !== undefined && key !== null) {
                newProps['data-key'] = key;
            }
            return {...vnode, props: newProps};
        }

        _findDomByKey(key) {
            if (!this.host) return null;
            return this.host.querySelector(`[data-key="${key}"]`);
        }

        render() {
            const {children, tag = 'div'} = this.props;
            const newChildren = Array.isArray(children) ? children : [children];
            const processedChildren = this._processChildren(newChildren);

            const baseClass = `${this.props.name || 'v'}-group`;
            const customClass = this.props.className || '';
            const finalClass = (baseClass + ' ' + customClass).trim();

            return h(tag, {className: finalClass}, ...processedChildren);
        }
    }

    class Motion extends Component {
        constructor(props) {
            super(props);
            this.shouldRender = !!props.show;
            this.leaving = false;
            this.childRef = null;
        }

        // ИСПРАВЛЕНО: Гарантируем вызов renderAfter при самообновлении
        update() {
            super.update();
            this.renderAfter();
        }


        renderAfter() {
            const currShow = !!this.props.show;
            const prevShow = this._prevShow;

            if (currShow && (prevShow === undefined || !prevShow)) {
                this.shouldRender = true;
                this.leaving = false;
                this.runEnter();
            } else if (!currShow && prevShow) {
                if (!this.leaving) {
                    this.runLeave();
                }
            }

            this._prevShow = currShow;
        }

        runEnter() {
            const el = this.childRef;
            if (!el) return;

            const name = this.props.name || 'v';
            const duration = this.props.duration || 300;

            el.classList.remove(`${name}-leave`, `${name}-leave-active`);
            el.classList.add(`${name}-enter`, `${name}-enter-active`);

            // Force reflow
            el.offsetHeight;

            requestAnimationFrame(() => {
                el.classList.remove(`${name}-enter`);
            });

            setTimeout(() => {
                el.classList.remove(`${name}-enter-active`);
            }, duration);
        }

        runLeave() {
            this.leaving = true;
            const el = this.childRef;
            if (!el) return;

            const name = this.props.name || 'v';
            const duration = this.props.duration || 300;

            el.classList.add(`${name}-leave`, `${name}-leave-active`);

            setTimeout(() => {
                this.shouldRender = false;
                this.leaving = false;
                this.update(); // Вызываем update фреймворка
            }, duration);
        }

        render() {
            if (!this.shouldRender) return null;

            const child = this.props.children;
            if (!child) return null;

            const originalRef = child.props?.ref;
            const combinedRef = (el) => {
                this.childRef = el;
                if (typeof originalRef === 'function') originalRef(el);
                else if (originalRef) originalRef.current = el;
            };

            return h(child.type, { ...child.props, ref: combinedRef }, ...child.children);
        }
    }

    // ============================================================================
    // REACTIVE AND GLOBAL STORE + UTILS
    // ============================================================================
    const reactiveMap = new WeakMap();

    class ReactiveStore {
        constructor(target) {
            this._signals = new Map();

            // Возвращаем Proxy, чтобы объект вел себя прозрачно
            this._proxy = new Proxy(target, {
                get: (obj, key) => this._get(obj, key),
                set: (obj, key, value) => this._set(obj, key, value),
                deleteProperty: (obj, key) => this._delete(obj, key)
            });
        }

        _get(obj, key) {
            if (key === '__v_isReactive') return true;

            // Инициализируем сигнал при первом чтении
            if (!this._signals.has(key)) {
                let val = obj[key];
                if (typeof val === 'object' && val !== null) {
                    val = reactive(val); // Глубокая реактивность
                }
                this._signals.set(key, signal(val));
            }

            return this._signals.get(key).value;
        }

        _set(obj, key, value) {
            // Если записываем объект, делаем его реактивным
            if (typeof value === 'object' && value !== null && !value.__v_isReactive) {
                value = reactive(value);
            }

            if (!this._signals.has(key)) {
                this._signals.set(key, signal(value));
            } else {
                this._signals.get(key).value = value;
            }

            obj[key] = value; // Синхронизируем исходный объект
            return true;
        }

        _delete(obj, key) {
            if (this._signals.has(key)) {
                this._signals.get(key).value = undefined;
                this._signals.delete(key);
            }
            delete obj[key];
            return true;
        }

        get proxy() {
            return this._proxy;
        }
    }

    class GlobalStore {
        constructor(initialState, actions = {}) {
            this._store = new ReactiveStore(initialState);
            this.state = this._store.proxy;
            this.actions = actions;
        }

        dispatch(actionName, payload) {
            const action = this.actions[actionName];
            if (typeof action === 'function') {
                // Выполняем внутри батча для оптимизации
                batch(() => action(this.state, payload));
            } else {
                console.warn(`[Store] Action "${actionName}" not found.`);
            }
        }
    }

    function reactive(target) {
        if (typeof target !== 'object' || target === null) return target;
        if (reactiveMap.has(target)) return reactiveMap.get(target);

        const store = new ReactiveStore(target);
        reactiveMap.set(target, store.proxy);
        return store.proxy;
    }

    function createStore(initialState, actions = {}) {
        return new GlobalStore(initialState, actions);
    }

    // ============================================================================
    // SIGNAL LOCAL STORAGE
    // ============================================================================
    class PersistentSignal {
        constructor(key, defaultValue) {
            this.key = key;
            this._signal = signal(this._read(defaultValue));

            // Автоматическое сохранение при изменении
            this._effect = effect(() => {
                const current = this._signal.value;
                this._write(current);
            });
        }

        _read(defaultValue) {
            try {
                const stored = localStorage.getItem(this.key);
                if (stored !== null) {
                    try { return JSON.parse(stored); }
                    catch { return stored; }
                }
            } catch (e) {
                console.warn(`[Storage] Error reading key "${this.key}"`, e);
            }
            return defaultValue;
        }

        _write(value) {
            try {
                if (value == null) {
                    localStorage.removeItem(this.key);
                } else {
                    localStorage.setItem(this.key, JSON.stringify(value));
                }
            } catch (e) {
                console.error(`[Storage] Error saving key "${this.key}"`, e);
            }
        }

        get value() { return this._signal.value; }
        set value(v) { this._signal.value = v; }

        clear() {
            localStorage.removeItem(this.key);
            this._signal.value = undefined;
        }
    }

    // Фабричные функции для удобства
    function createLocalSignal(key, defaultValue) {
        return new PersistentSignal(key, defaultValue);
    }

    function clearLocal(key) {
        localStorage.removeItem(key);
    }

    // ============================================================================
    // ISLAND
    // ============================================================================
    function Island(props) {
        const child = props.children;

        if (Array.isArray(child)) {
            // Если детей много, оборачиваем в div с маркером
            return h('div', { 'data-island': 'true' }, ...child);
        } else if (child && typeof child === 'object') {
            // Если один ребенок (VNode), инъектируем атрибут
            if (!child.props) child.props = {};
            child.props['data-island'] = 'true';
            return child;
        }

        return null;
    }

    // ============================================================================
    // HEAD
    // ============================================================================
    class HeadManager {
        constructor() {
            this._title = signal('');
            this._description = signal('');
            this._keywords = signal('');

            // Реактивная связь: Сигнал -> DOM
            this._setupEffects();
        }

        _setupEffects() {
            effect(() => {
                if (typeof document !== 'undefined') {
                    document.title = this._title.value;
                }
            });

            effect(() => {
                this._updateMeta('description', this._description.value);
            });

            effect(() => {
                this._updateMeta('keywords', this._keywords.value);
            });
        }

        _updateMeta(name, content) {
            if (typeof document === 'undefined') return;

            let meta = document.querySelector(`meta[name="${name}"]`);
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('name', name);
                document.head.appendChild(meta);
            }

            if (content == null || content === '') {
                meta.remove();
            } else {
                meta.setAttribute('content', content);
            }
        }

        // Геттеры и сеттеры для удобного доступа
        get title() { return this._title.value; }
        set title(val) { this._title.value = val; }

        get description() { return this._description.value; }
        set description(val) { this._description.value = val; }

        get keywords() { return this._keywords.value; }
        set keywords(val) { this._keywords.value = val; }
    }

    // Синглтон: создаем один экземпляр на все приложение
    let headInstance = null;
    function head() {
        if (!headInstance) {
            headInstance = new HeadManager();
        }
        return headInstance;
    }

    // ============================================================================
    // FORM
    // ============================================================================
    class FormManager {
        constructor(config = {}) {
            this.values = {};
            this.errors = {};
            this.schema = {};
            this.customMessages = {};

            for (let key in config) {
                const fieldConfig = config[key];
                if (typeof fieldConfig === 'object' && fieldConfig !== null) {
                    const { value, ...rules } = fieldConfig;
                    this.values[key] = signal(value);
                    this.errors[key] = signal(undefined);
                    if (Object.keys(rules).length > 0) {
                        this.schema[key] = rules;
                    }
                } else {
                    this.values[key] = signal(fieldConfig);
                    this.errors[key] = signal(undefined);
                }
            }
        }

        // НОВОЕ: Метод для кастомизации ошибок (поддерживает chaining)
        withErrors(customMessages) {
            this.customMessages = customMessages;
            return this;
        }

        field(name) {
            if (!this.values[name]) return {};
            return {
                value: this.values[name].value,
                oninput: (e) => {
                    let newVal = e.target.value;
                    newVal = this._sanitize(newVal);
                    this.values[name].value = newVal;
                    this._validateField(name);
                }
            };
        }

        _sanitize(val) {
            if (typeof val === 'string') {
                return val.replace(/<script.*?>.*?<\/script>/gi, '').trim();
            }
            return val;
        }

        _validateField(name) {
            const rules = this.schema[name];
            if (!rules) return;

            const val = this.values[name].value;
            let error = undefined;
            let ruleKey = null;

            // Определяем, какое правило нарушено
            if (rules.required && (val == null || val === '')) ruleKey = 'required';
            else if (rules.email && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) ruleKey = 'email';
            else if (rules.minLength && val.length < rules.minLength) ruleKey = 'minLength';
            else if (rules.maxLength && val.length > rules.maxLength) ruleKey = 'maxLength';
            else if (rules.numeric && val && isNaN(val)) ruleKey = 'numeric';

            // Формируем сообщение об ошибке
            if (ruleKey) {
                const custom = this.customMessages[name];

                // Если передали строку для всего поля: { email: "неверный email" }
                if (typeof custom === 'string') {
                    error = custom;
                }
                // Если передали объект по правилам: { email: { required: "введите email", email: "неверный формат" } }
                else if (custom && typeof custom === 'object' && custom[ruleKey]) {
                    error = custom[ruleKey];
                }
                // Дефолтные сообщения
                else {
                    switch (ruleKey) {
                        case 'required': error = 'This field is required'; break;
                        case 'email': error = 'Invalid email format'; break;
                        case 'minLength': error = `Minimum ${rules.minLength} characters`; break;
                        case 'maxLength': error = `Maximum ${rules.maxLength} characters`; break;
                        case 'numeric': error = 'Numbers only'; break;
                    }
                }
            }

            this.errors[name].value = error;
        }

        validateAll() {
            batch(() => {
                for (let name in this.schema) {
                    this._validateField(name);
                }
            });
        }

        isValid() {
            this.validateAll();
            for (let key in this.errors) {
                if (this.errors[key].value) return false;
            }
            return true;
        }

        getValues() {
            const result = {};
            for (let k in this.values) result[k] = this.values[k].value;
            return result;
        }
    }

    if (Component) {
        Component.prototype.$form = function(config) {
            return new FormManager(config);
        };
    }

    // ============================================================================
    // WEB COMPONENT
    // ============================================================================
    function define(tagName, ComponentClass, options = {}) {
        const { shadow = true } = options;

        class VnanoElement extends HTMLElement {
            constructor() {
                super();
                this._app = null;
                this._mountPoint = null;
            }

            connectedCallback() {
                const mountRoot = shadow
                    ? this.attachShadow({ mode: 'open' })
                    : this;

                this._mountPoint = document.createElement('div');
                mountRoot.appendChild(this._mountPoint);

                const props = this._getPropsFromAttrs();
                this._app = createApp(this._mountPoint);
                this._app.mount(ComponentClass, props);
            }

            disconnectedCallback() {
                if (this._app) {
                    this._app.unmount();
                    this._app = null;
                }
                // ИСПРАВЛЕНО: Удаляем сам mountPoint из Shadow DOM
                if (this._mountPoint && this._mountPoint.parentNode) {
                    this._mountPoint.parentNode.removeChild(this._mountPoint);
                }
                this._mountPoint = null;
            }

            _getPropsFromAttrs() {
                const props = {};
                if (this.attributes) {
                    for (const attr of this.attributes) {
                        props[attr.name] = attr.value;
                    }
                }
                return props;
            }
        }

        if (!customElements.get(tagName)) {
            customElements.define(tagName, VnanoElement);
        }
    }

    // ============================================================================
    // RESOURCE
    // ============================================================================
    function createResource(source, fetcher) {
        const data = signal(null);
        const loading = signal(false);
        const error = signal(null);

        // Реактивная связь: при изменении source запускается fetcher
        effect(() => {
            const sourceValue = source.value;

            // Сбрасываем состояние перед новым запросом
            batch(() => {
                loading.value = true;
                error.value = null;
            });

            // Запускаем асинхронную операцию
            fetcher(sourceValue)
                .then((result) => {
                    data.value = result;
                    loading.value = false;
                })
                .catch((e) => {
                    error.value = e;
                    loading.value = false;
                });
        });

        // Возвращаем объект API
        const resource = {
            get value() { return data.value; },
            set value(v) { data.value = v; }, // Позволяет мутировать вручную (optimistic UI)
            loading,
            error,
            data // прямой доступ к сигналу данных
        };

        return resource;
    }


    // ============================================================================
    // WEBSOCKET
    // ============================================================================
    const vnanoConnections = new Map();

    function getSocket(url) {
        if (vnanoConnections.has(url)) return vnanoConnections.get(url);

        const ws = new WebSocket(url);
        const connection = {
            socket: ws,
            listeners: new Set()
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Рассылаем сообщение всем слушателям этого соединения
                connection.listeners.forEach(listener => listener(data));
            } catch (e) {
                console.error('[vnano/ws] Parse error', e);
            }
        };

        vnanoConnections.set(url, connection);
        return connection;
    }

    function createLiveSignal(url, options) {
        const { channel, defaultValue = null } = options;
        const s = signal(defaultValue);
        const connection = getSocket(url);

        // Слушаем входящие сообщения
        const messageHandler = (data) => {
            if (data.channel === channel) {
                s.value = data.payload; // Обновляем сигнал с сервера
            }
        };
        connection.listeners.add(messageHandler);

        // Возвращаем объект с перехваченным сеттером
        const liveSignal = {
            get value() { return s.value; },
            set value(v) {
                s.value = v; // Обновляем локально
                // Отправляем на сервер (Signal -> Server)
                if (connection.socket.readyState === WebSocket.OPEN) {
                    connection.socket.send(JSON.stringify({
                        type: 'publish',
                        channel: channel,
                        payload: v
                    }));
                }
            },
            disconnect() {
                connection.listeners.delete(messageHandler);
            }
        };

        return liveSignal;
    }

    function resetSockets() {
        vnanoConnections.forEach(conn => {
            if (conn.socket && conn.socket.readyState === WebSocket.OPEN) {
                conn.socket.close();
            }
        });
        vnanoConnections.clear();
    }

    // ============================================================================
    // I18N
    // ============================================================================
    class I18nManager {
        constructor(config = {}) {
            this.locale = signal(config.defaultLocale || 'en');
            this.messages = config.messages || {};
            this.fallbackLocale = config.fallbackLocale || 'en';
        }

        // Метод перевода. Вызывается внутри render() для подписки на смену языка.
        t(key, params = {}) {
            // Читаем текущий язык, чтобы установить реактивную зависимость
            const currentLocale = this.locale.value;
            const dict = this.messages[currentLocale] || {};
            const fallbackDict = this.messages[this.fallbackLocale] || {};

            // Берем перевод или ключ, если перевода нет
            let str = dict[key] || fallbackDict[key] || key;

            // Интерполяция: заменяем {name} на значение params.name
            for (let p in params) {
                str = str.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
            }

            return str;
        }

        setLocale(locale) {
            this.locale.value = locale;
        }
    }

    function createI18n(config) {
        return new I18nManager(config);
    }

    // ============================================================================
    // STYLING ENGINE
    // ============================================================================
    class StylingEngine {
        constructor() {
            this.styleRegistry = new Set();
            this.styleEl = null;
        }

        _getStyleEl() {
            if (!this.styleEl) {
                this.styleEl = document.createElement('style');
                this.styleEl.setAttribute('data-vnano-css', '');
                document.head.appendChild(this.styleEl);
            }
            return this.styleEl;
        }

        _hash(str) {
            let hash = 5381;
            for (let i = 0; i < str.length; i++) {
                hash = (hash * 33) ^ str.charCodeAt(i);
            }
            return 'v' + (hash >>> 0).toString(36);
        }

        _parseCss(strings, interpolations) {
            return strings.reduce((acc, str, i) => {
                let val = interpolations[i];
                if (typeof val === 'function') val = val();
                return acc + str + (val !== undefined ? val : '');
            }, '');
        }

        // Scoped CSS (возвращает уникальный класс)
        css(strings, ...interpolations) {
            const rawCss = this._parseCss(strings, interpolations);
            const className = this._hash(rawCss);

            if (!this.styleRegistry.has(className)) {
                this.styleRegistry.add(className);
                const el = this._getStyleEl();
                const processedCss = rawCss.replace(/&/g, `.${className}`);
                el.textContent += `.${className} { ${processedCss} }\n`;
            }
            return className;
        }

        // Styled components (возвращает функциональный компонент)
        styled(tag) {
            return (strings, ...interpolations) => {
                const className = this.css(strings, ...interpolations);
                return (props) => {
                    const existingClass = props?.class || props?.className || '';
                    return h(tag, { ...props, class: `${existingClass} ${className}`.trim() }, props.children);
                };
            };
        }

        // Keyframes (для CSS анимаций)
        keyframes(strings, ...interpolations) {
            const rawCss = this._parseCss(strings, interpolations);
            const animName = this._hash(rawCss);

            if (!this.styleRegistry.has(animName)) {
                this.styleRegistry.add(animName);
                const el = this._getStyleEl();
                el.textContent += `@keyframes ${animName} { ${rawCss} }\n`;
            }
            return animName;
        }

        // ИСПРАВЛЕНО: Переименовано в styles (глобальные стили без хэширования)
        styles(strings, ...interpolations) {
            const rawCss = this._parseCss(strings, interpolations);
            const hash = this._hash(rawCss);
            if (!this.styleRegistry.has(hash)) {
                this.styleRegistry.add(hash);
                const el = this._getStyleEl();
                el.textContent += `${rawCss}\n`;
            }
        }

        // Очистка всех стилей (для тестов)
        clear() {
            if (this.styleEl) {
                this.styleEl.textContent = '';
            }
            this.styleRegistry.clear();
        }
    }

    const engine = new StylingEngine();


    if (global.$v) {
        global.$v.VirtualList = VirtualList;
        global.$v.VirtualBlock = VirtualBlock;
        global.$v.LazyImage = LazyImage;
        global.$v.InfiniteScroll = InfiniteScroll;
        global.$v.TransitionGroup = TransitionGroup;
        global.$v.ReactiveStore = ReactiveStore;
        global.$v.GlobalStore = GlobalStore;
        global.$v.reactive = reactive;
        global.$v.createStore = createStore;
        global.$v.createLocalSignal = createLocalSignal;
        global.$v.clearLocal = clearLocal;
        global.$v.Motion = Motion;
        global.$v.Island = Island;
        global.$v.head = head;
        global.$v.HeadManager = HeadManager;
        global.$v.FormManager = FormManager;
        global.$v.define = define;
        global.$v.createResource = createResource;
        global.$v.createLiveSignal = createLiveSignal;
        global.$v.resetSockets = resetSockets;
        global.$v.createI18n = createI18n;
        global.$v.I18nManager = I18nManager;
        global.$v.StylingEngine = StylingEngine;
        global.$v.css = engine.css.bind(engine);
        global.$v.styled = engine.styled.bind(engine);
        global.$v.keyframes = engine.keyframes.bind(engine);
        global.$v.styles = engine.styles.bind(engine); // ИСПРАВЛЕНО
        global.$v._cssEngine = engine;

    }
    global.VirtualList = VirtualList;
    global.VirtualBlock = VirtualBlock;
    global.LazyImage = LazyImage;
    global.InfiniteScroll = InfiniteScroll;
    global.TransitionGroup = TransitionGroup;
    global.ReactiveStore = ReactiveStore;
    global.GlobalStore = GlobalStore;
    global.reactive = reactive;
    global.createStore = createStore;
    global.createLocalSignal = createLocalSignal;
    global.clearLocal = clearLocal;
    global.Motion = Motion;
    global.Island = Island;
    global.head = head;
    global.HeadManager = HeadManager;
    global.FormManager = FormManager;
    global.define = FormManager;
    global.createResource = createResource;
    global.createLiveSignal = createLiveSignal;
    global.resetSockets = resetSockets;
    global.createI18n = createI18n;
    global.I18nManager = I18nManager;
    global.styled = engine.styled;
    global.keyframes = engine.keyframes;
    global.StylingEngine = StylingEngine;
    global.css = engine.css.bind(engine);
    global.styled = engine.styled.bind(engine);
    global.keyframes = engine.keyframes.bind(engine);
    global.styles = engine.styles.bind(engine);
    global._cssEngine = engine;


})(typeof window !== 'undefined' ? window : globalThis);