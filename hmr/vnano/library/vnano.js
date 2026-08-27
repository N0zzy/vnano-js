'use strict';

/**
 * @framework vnano.js
 * @version 0.4.0-refactored
 * @description Clean, fast, and modular UI framework.
 */

// ============================================================================
// 1. REACTIVITY PRIMITIVES
// ============================================================================

let activeEffect = null;
let batchDepth = 0;
const pendingEffects = new Set();

const htm = (function () {
    var n = function (t, e, s, u) {
        var r;
        e[0] = 0;
        for (var h = 1; h < e.length; h++) {
            var p = e[h++], a = e[h] ? (e[0] |= p ? 1 : 2, s[e[h++]]) : e[++h];
            3 === p ? u[0] = a : 4 === p ? u[1] = Object.assign(u[1] || {}, a) : 5 === p ? (u[1] = u[1] || {})[e[++h]] = a : 6 === p ? u[1][e[++h]] += a + "" : p ? (r = t.apply(a, n(t, a, s, ["", null])), u.push(r), a[0] ? e[0] |= 2 : (e[h - 2] = 0, e[h] = r)) : u.push(a);
        }
        return u;
    };
    var t = new Map;
    var e = function (e) {
        var s = t.get(this);
        return s || (s = new Map, t.set(this, s)), (s = n(this, s.get(e) || (s.set(e, s = function (n) {
            for (var t, e, s = 1, u = "", r = "", h = [0], p = function (n) {
                1 === s && (n || (u = u.replace(/^\s*\n\s*|\s*\n\s*$/g, ""))) ? h.push(0, n, u) : 3 === s && (n || u) ? (h.push(3, n, u), s = 2) : 2 === s && ("..." === u || "@" === u) && n ? h.push(4, n, 0) : 2 === s && u && !n ? h.push(5, 0, !0, u) : s >= 5 && ((u || !n && 5 === s) && (h.push(s, 0, u, e), s = 6), n && (h.push(s, n, 0, e), s = 6)), u = "";
            }, a = 0; a < n.length; a++) {
                a && (1 === s && p(), p(a));
                for (var o = 0; o < n[a].length; o++) t = n[a][o], 1 === s ? "<" === t ? (p(), h = [h], s = 3) : u += t : 4 === s ? "--" === u && ">" === t ? (s = 1, u = "") : u = t + u[0] : r ? t === r ? r = "" : u += t : '"' === t || "'" === t ? r = t : ">" === t ? (p(), s = 1) : s && ("=" === t ? (s = 5, e = u, u = "") : "/" === t && (s < 5 || ">" === n[a][o + 1]) ? (p(), 3 === s && (h = h[0]), s = h, (h = h[0]).push(2, 0, s), s = 0) : " " === t || "\t" === t || "\n" === t || "\r" === t ? (p(), s = 2) : u += t), 3 === s && "!--" === u && (s = 4, h = h[0]);
            }
            return p(), h;
        }(e)), s), arguments, [])).length > 1 ? s : s[0];
    };
    return e;
})();
const html = htm.bind((tag, props, ...children) => {
    return h(tag, props, ...children);
});
function signal(initialValue) {
    let _value = initialValue;
    const subscribers = new Set();

    const read = () => {
        if (activeEffect) subscribers.add(activeEffect);
        return _value;
    };

    const write = (newValue) => {
        if (newValue !== _value) {
            _value = newValue;
            trigger(subscribers);
        }
    };

    return {
        get value() { return read(); },
        set value(v) { write(v); }
    };
}

function computed(getter) {
    let _value;
    let _dirty = true;
    const _subscribers = new Set();

    const runner = () => {
        _dirty = true;
        trigger(_subscribers);
    };

    const read = () => {
        if (activeEffect) _subscribers.add(activeEffect);
        if (_dirty) {
            const prev = activeEffect;
            activeEffect = runner;
            _value = getter();
            activeEffect = prev;
            _dirty = false;
        }
        return _value;
    };

    return { get value() { return read(); } };
}

function effect(fn, options = {}) {
    const wrappedFn = () => {
        if (wrappedFn._cleanup) wrappedFn._cleanup();
        const prev = activeEffect;
        activeEffect = wrappedFn;
        try {
            const res = fn();
            if (typeof res === 'function') wrappedFn._cleanup = res;
        } finally {
            activeEffect = prev;
        }
    };

    if (options.defer) {
        pendingEffects.add(wrappedFn);
    } else {
        wrappedFn();
    }
    return wrappedFn;
}

function trigger(subs) {
    subs.forEach(e => pendingEffects.add(e));
    if (batchDepth === 0) flushEffects();
}

function flushEffects() {
    batchDepth++;
    let iteration = 0;
    try {
        while (pendingEffects.size > 0) {
            if (++iteration > 100) throw new Error("Infinite loop detected in effects.");
            const currentBatch = [...pendingEffects];
            pendingEffects.clear();
            currentBatch.forEach(effect => effect());
        }
    } catch (e) {
        // ИСПРАВЛЕНИЕ: Очищаем очередь при ошибке, чтобы грязное состояние
        // не утекло в следующие тесты или вызовы.
        pendingEffects.clear();
        throw e;
    } finally {
        batchDepth--;
    }
}

function batch(fn) {
    batchDepth++;
    try { fn(); }
    finally {
        batchDepth--;
        if (batchDepth === 0) flushEffects();
    }
}

// ============================================================================
// 2. VDOM & HELPERS
// ============================================================================

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const VOID_ELEMENTS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const ForwardRefSymbol = Symbol('ForwardRef');
const PortalSymbol = Symbol('Portal');

function h(type, props, ...children) {
    const flatChildren = children.flat(Infinity).filter(c =>
        c !== null && c !== undefined && c !== false && c !== true && c !== ''
    );

    if (type === Fragment) return flatChildren;

    const newProps = props ? { ...props } : {};
    if (flatChildren.length > 0) {
        newProps.children = flatChildren.length === 1 ? flatChildren[0] : flatChildren;
    }
    return { type, props: newProps, children: flatChildren };
}

function isClassComponent(type) {
    return type && type.prototype && typeof type.prototype.render === 'function';
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================================================
// 3. DOM CREATION & PATCHING (Refactored & Simplified)
// ============================================================================

function createDOMNode(vnode, ns = null) {
    if (vnode == null || vnode === false) return document.createTextNode('');
    if (typeof vnode === 'string' || typeof vnode === 'number') return document.createTextNode(String(vnode));
    if (Array.isArray(vnode)) return createFragmentNode(vnode, ns);

    if (vnode.type === PortalSymbol) return createPortalNode(vnode);
    if (vnode.type?.$$typeof === ForwardRefSymbol) return createForwardRefNode(vnode, ns);
    if (typeof vnode.type === 'function') return createComponentNode(vnode, ns);
    if (typeof vnode.type === 'string') return createElementNode(vnode, ns);

    return document.createTextNode('');
}

function createFragmentNode(vnode, ns) {
    const frag = document.createDocumentFragment();
    vnode.forEach(c => frag.appendChild(createDOMNode(c, ns)));
    return frag;
}

function createPortalNode(vnode) {
    const target = vnode.props.container || vnode.props.target;
    const ph = document.createTextNode('');
    const children = (vnode.children || []).map(c => createDOMNode(c, null));
    children.forEach(c => target.appendChild(c));
    ph._portalChildren = children;
    ph._portalContainer = target;
    return ph;
}

function createForwardRefNode(vnode, ns) {
    const { ref, ...props } = vnode.props;
    const child = vnode.type.render(props, ref);
    const dom = createDOMNode(child, ns);
    const inst = { props, _vnode: child, render: vnode.type.render, host: dom };
    dom._component = inst;
    dom._parentComponent = inst;
    return dom;
}

function createComponentNode(vnode, ns) {
    let inst, child, dom;
    const prevEffect = activeEffect;

    try {
        if (vnode.type._context) {
            contextStack.push({ context: vnode.type._context, value: vnode.props.value });
        }

        if (isClassComponent(vnode.type)) {
            inst = new vnode.type(vnode.props);
            if (vnode.type.contextType) inst.context = findContext(vnode.type.contextType);
            activeEffect = prevEffect === null ? inst._updateEffect : prevEffect;
            child = inst.render();
            inst._renderedVNode = child;
        } else {
            activeEffect = null;
            child = vnode.type(vnode.props);
            activeEffect = prevEffect;
            inst = { props: vnode.props, _renderedVNode: child, render: vnode.type };
        }

        dom = createDOMNode(child, ns);
        if (dom.nodeType === 11) {
            const w = document.createElement('div');
            w.style.display = 'contents';
            w.appendChild(dom);
            dom = w;
        }
    } catch (e) {
        activeEffect = prevEffect;
        if (inst?.componentDidCatch) {
            inst.componentDidCatch(e);
            // Рендерим fallback и продолжаем нормальный поток
            child = inst.render();
            dom = createDOMNode(child, ns);
            if (dom.nodeType === 11) {
                const w = document.createElement('div');
                w.style.display = 'contents';
                w.appendChild(dom);
                dom = w;
            }
        } else {
            throw e;
        }
    } finally {
        if (vnode.type._context) contextStack.pop();
        activeEffect = prevEffect;
    }

    // Настройка ссылок теперь происходит гарантированно, даже после отлова ошибки
    if (dom) {
        dom._parentComponent = inst;
        if (!child || typeof child.type !== 'function') dom._component = inst;
        inst.host = dom;
        inst._vnode = child;
        if (inst.renderAfter) inst.renderAfter();
    }

    return dom;
}

function createElementNode(vnode, currentNs) {
    const ns = (vnode.type === 'svg' || vnode.props?.xmlns) ? SVG_NAMESPACE :
        (vnode.type === 'foreignObject' ? null : currentNs);

    const el = ns ? document.createElementNS(ns, vnode.type) : document.createElement(vnode.type);

    const props = { ...vnode.props };
    const shadowMode = props.shadow;
    if (shadowMode) delete props.shadow;

    applyProps(el, {}, props);

    // ИСПОЛЬЗУЕМ СОХРАНЕННОЕ ЗНАЧЕНИЕ
    if (shadowMode && el.attachShadow) {
        const root = el.attachShadow({ mode: shadowMode });
        (vnode.children || []).forEach(c => root.appendChild(createDOMNode(c, null)));
    } else {
        (vnode.children || []).forEach(c => el.appendChild(createDOMNode(c, ns)));
    }
    return el;
}

// --- PATCH LOGIC ---

function patch(oldV, newV, dom) {
    if (oldV === newV) return dom;
    if (!dom) return createDOMNode(newV);
    if (newV == null || newV === false) return patchRemoval(oldV, dom);
    if (oldV == null || oldV === false) return patchRemount(oldV, newV, dom);

    if (typeof newV === 'string' || typeof newV === 'number') return patchText(newV, dom);
    if (Array.isArray(newV) || Array.isArray(oldV)) return patchFragment(oldV, newV, dom);
    if (oldV.type === PortalSymbol && newV.type === PortalSymbol) return patchPortal(oldV, newV, dom);
    if (newV.type?.$$typeof === ForwardRefSymbol) return patchForwardRef(oldV, newV, dom);
    if (typeof newV.type === 'function') return patchComponent(oldV, newV, dom);
    if (typeof newV.type === 'string') return oldV.type !== newV.type ? patchReplace(oldV, newV, dom) : patchElement(oldV, newV, dom);

    return patchReplace(oldV, newV, dom);
}

function patchRemoval(oldV, dom) {
    const ph = document.createTextNode('');
    const inst = dom._component;
    if (dom._portalContainer) {
        dom._portalChildren.forEach(c => dom._portalContainer.contains(c) && dom._portalContainer.removeChild(c));
    }
    if (inst?.dispose) {
        inst.dispose();
        detachRefsDeep(inst._renderedVNode, dom);
    } else {
        detachRefsDeep(oldV, dom);
    }
    dom.parentNode?.replaceChild(ph, dom);
    if (inst && !inst.dispose) { ph._component = inst; inst.host = ph; }
    if (dom._parentComponent) ph._parentComponent = dom._parentComponent;
    return ph;
}

function patchText(newV, dom) {
    if (dom.nodeType === 3) { dom.nodeValue = String(newV); return dom; }
    const t = document.createTextNode(String(newV));
    dom.parentNode?.replaceChild(t, dom);
    return t;
}

function patchFragment(oldV, newV, dom) {
    const oldArr = Array.isArray(oldV) ? oldV : [oldV];
    const newArr = Array.isArray(newV) ? newV : [newV];
    const min = Math.min(oldArr.length, newArr.length);

    for (let i = 0; i < min; i++) patch(oldArr[i], newArr[i], dom.childNodes[i]);
    for (let i = oldArr.length; i < newArr.length; i++) dom.appendChild(createDOMNode(newArr[i]));
    let count = oldArr.length - newArr.length;
    while (count-- > 0) dom.removeChild(dom.lastChild);
    return dom;
}

function patchPortal(oldV, newV, dom) {
    const cont = dom._portalContainer;
    dom._portalChildren.forEach(c => cont.contains(c) && cont.removeChild(c));
    const newChildren = newV.children.map(c => createDOMNode(c));
    newChildren.forEach(c => cont.appendChild(c));
    dom._portalChildren = newChildren;
    return dom;
}

function patchForwardRef(oldV, newV, dom) {
    const k1 = oldV.key ?? oldV.props?.key;
    const k2 = newV.key ?? newV.props?.key;
    if (k1 !== k2) return patchReplace(oldV, newV, dom);

    const { ref, ...props } = newV.props;
    dom._component.props = props;
    const newInner = newV.type.render(props, ref);
    patch(dom._component._vnode, newInner, dom);
    dom._component._vnode = newInner;
    return dom;
}

function patchComponent(oldV, newV, dom) {
    let inst = dom._component || dom._parentComponent;
    const match = inst && (inst instanceof Component ? inst.constructor === oldV?.type : inst.render === oldV?.type);
    const k1 = oldV?.key ?? oldV?.props?.key;
    const k2 = newV.key ?? newV.props?.key;

    if (match && oldV?.type === newV.type) {
        if (k1 !== k2) { inst?.dispose?.(); return patchReplace(oldV, newV, dom); }
        return updateComponent(inst, oldV, newV, dom);
    }
    return patchReplace(oldV, newV, dom);
}

function patchRemount(oldV, newV, dom) {
    const newNode = createDOMNode(newV);
    if (dom.nodeType === 3 || (dom.nodeType === 1 && dom.parentNode)) {
        dom.parentNode?.replaceChild(newNode, dom);
        if (dom._parentComponent) newNode._parentComponent = dom._parentComponent;
        if (!typeof oldV?.type === 'function' && dom._component) {
            newNode._component = dom._component;
            if (newNode._component.host === dom) newNode._component.host = newNode;
        }
    } else {
        dom.appendChild(newNode);
    }
    return newNode;
}

function patchReplace(oldV, newV, dom) {
    if (typeof oldV?.type === 'function' && dom._component?.dispose) {
        if (dom._component.constructor === oldV.type || dom._component.render === oldV.type) {
            dom._component.dispose();
        }
    }
    const n = createDOMNode(newV);
    dom.parentNode?.replaceChild(n, dom);
    if (dom._parentComponent) n._parentComponent = dom._parentComponent;
    if (dom._component && typeof oldV?.type !== 'function') {
        n._component = dom._component;
        if (n._component.host === dom) n._component.host = n;
    }
    return n;
}

function patchElement(oldV, newV, dom) {
    applyProps(dom, oldV.props, newV.props);
    if (newV.props.skipChildren) return dom;
    const oldCh = oldV.children || [];
    const newCh = newV.children || [];
    const hasKeys = newCh.some(c => c?.key !== undefined || c?.props?.key !== undefined);
    hasKeys ? diffKeyed(oldCh, newCh, dom) : diffNonKeyed(oldCh, newCh, dom);
    return dom;
}

// ============================================================================
// 4. LIST DIFFING (Optimized)
// ============================================================================
function diffKeyed(oldCh, newCh, parent) {
    const oldKeyMap = mapOldKeys(oldCh, parent);
    const newKeys = new Set(newCh.map(v => v.key ?? v.props?.key));

    removeUnusedKeys(oldKeyMap, newKeys, parent);
    reconcileNodes(newCh, oldKeyMap, parent);
}

// 1. Собираем старые ключи и удаляем узлы без ключей
function mapOldKeys(oldCh, parent) {
    const oldKeyMap = new Map();
    const oldDoms = Array.from(parent.childNodes);

    for (let i = 0; i < oldCh.length; i++) {
        const vnode = oldCh[i];
        const key = vnode.key ?? vnode.props?.key;

        if (key !== undefined) {
            oldKeyMap.set(key, { vnode, dom: oldDoms[i] });
        } else {
            const dom = oldDoms[i];
            if (dom) {
                dom._component?.dispose?.();
                detachRefsDeep(vnode, dom);
                parent.removeChild(dom);
            }
        }
    }
    return oldKeyMap;
}

// 2. Удаляем ключевые узлы, которых нет в новом массиве
function removeUnusedKeys(oldKeyMap, newKeys, parent) {
    oldKeyMap.forEach((val, key) => {
        if (!newKeys.has(key)) {
            const { vnode, dom } = val;
            dom._component?.dispose?.();
            detachRefsDeep(vnode, dom);
            if (dom.parentNode === parent) parent.removeChild(dom);
            oldKeyMap.delete(key);
        }
    });
}

// 3. Вставляем и перемещаем узлы в правильном порядке (слева-направо)
function reconcileNodes(newCh, oldKeyMap, parent) {
    for (let i = 0; i < newCh.length; i++) {
        const newVNode = newCh[i];
        const key = newVNode.key ?? newVNode.props?.key;
        let domNode;

        if (key !== undefined && oldKeyMap.has(key)) {
            const oldVal = oldKeyMap.get(key);
            patch(oldVal.vnode, newVNode, oldVal.dom);
            domNode = oldVal.dom;
            oldKeyMap.delete(key);
        } else {
            domNode = createDOMNode(newVNode);
        }

        const expectedNode = parent.childNodes[i];
        if (domNode !== expectedNode) {
            parent.insertBefore(domNode, expectedNode || null);
        }
    }
}

function diffNonKeyed(oldCh, newCh, parent) {
    const max = Math.max(oldCh.length, newCh.length);
    const real = Array.from(parent.childNodes);

    for (let i = 0; i < max; i++) {
        if (oldCh[i] == null && newCh[i] == null) {
            // Оба null, ничего не делаем
        } else if (oldCh[i] == null) {
            // Был null, теперь есть VNode. Заменяем заглушку, если она есть, иначе append
            const newDom = createDOMNode(newCh[i]);
            if (real[i] && real[i].parentNode === parent) {
                parent.replaceChild(newDom, real[i]);
            } else {
                parent.appendChild(newDom);
            }
        } else if (newCh[i] == null) {
            // Был VNode, стал null. Ставим заглушку.
            const ph = document.createTextNode('');
            const r = real[i];
            if (r) {
                if (r._component?.dispose) r._component.dispose();
                else if (r._component) { ph._component = r._component; r._component.host = ph; }
                if (r._parentComponent) ph._parentComponent = r._parentComponent;
                detachRefsDeep(oldCh[i], r);
                parent.replaceChild(ph, r);
            }
        } else {
            // Оба есть, патчим
            patch(oldCh[i], newCh[i], real[i]);
        }
    }

    while (parent.childNodes.length > newCh.length) parent.removeChild(parent.lastChild);
}

// ============================================================================
// 5. DOM PROPS & EVENTS
// ============================================================================

const eventDelegation = {
    handlers: new WeakMap(),
    attachedEvents: new Set(),
    _boundDispatch: null,

    dispatch(e) {
        let node = e.target;
        while (node) {
            if (e.cancelBubble) break;
            const nodeHandlers = this.handlers.get(node);
            if (nodeHandlers && nodeHandlers[e.type]) {
                if (nodeHandlers[e.type].call(node, e) === false) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            node = node.parentNode;
        }
    },

    setListener(element, eventType, handler) {
        let elementHandlers = this.handlers.get(element);
        if (!elementHandlers) { elementHandlers = {}; this.handlers.set(element, elementHandlers); }
        elementHandlers[eventType] = handler;

        if (!this.attachedEvents.has(eventType)) {
            if (!this._boundDispatch) this._boundDispatch = this.dispatch.bind(this);
            document.addEventListener(eventType, this._boundDispatch, false);
            this.attachedEvents.add(eventType);
        }
    },

    removeListener(element, eventType) {
        const elementHandlers = this.handlers.get(element);
        if (elementHandlers) {
            delete elementHandlers[eventType];
            if (Object.keys(elementHandlers).length === 0) this.handlers.delete(element);
        }
    }
};

// ============================================================================
// DOM PROPS & EVENTS (Modular)
// ============================================================================

// Главный оркестратор
function applyProps(el, oldProps, newProps) {
    oldProps = oldProps || {};
    newProps = newProps || {};

    applyRefLogic(oldProps.ref, newProps.ref, el);
    updateClass(el, oldProps, newProps);
    updateStyle(el, oldProps, newProps);
    updateAttributes(el, oldProps, newProps);
}

function applyRefLogic(oldRef, newRef, el) {
    if (oldRef !== newRef) {
        if (oldRef) {
            if (typeof oldRef === 'function') oldRef(null);
            else if (oldRef) oldRef.current = null;
        }
        if (newRef) {
            if (typeof newRef === 'function') newRef(el);
            else if (newRef) newRef.current = el;
        }
    }
}

function updateClass(el, oldProps, newProps) {
    const oldV = oldProps.className ?? oldProps.class;
    const newV = newProps.className ?? newProps.class;

    if (newV !== undefined) {
        const str = String(newV);
        if (el.namespaceURI === SVG_NAMESPACE) {
            el.setAttribute('class', str);
        } else {
            el.className = str;
        }
    } else if (oldV !== undefined) {
        if (el.namespaceURI === SVG_NAMESPACE) {
            el.removeAttribute('class');
        } else {
            el.className = '';
        }
    }
}

function updateStyle(el, oldProps, newProps) {
    const oldV = oldProps.style;
    const newV = newProps.style;

    if (newV) {
        if (typeof newV === 'object') {
            if (typeof oldV === 'object') {
                for (let k in oldV) {
                    if (!(k in newV)) el.style[k] = '';
                }
            }
            for (let k in newV) {
                el.style[k] = newV[k];
            }
        } else {
            el.setAttribute('style', String(newV));
        }
    } else if (oldV) {
        if (typeof oldV === 'object') {
            for (let k in oldV) el.style[k] = '';
        } else {
            el.removeAttribute('style');
        }
    }
}

function updateAttributes(el, oldProps, newProps) {
    const keys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
    const skipKeys = ['ref', 'key', 'children', 'class', 'className', 'style', 'shadow', 'skipChildren'];

    keys.forEach(k => {
        if (skipKeys.includes(k)) return;

        const oldV = oldProps[k];
        const newV = newProps[k];
        if (oldV === newV) return;

        updateAttr(el, k, oldV, newV);
    });
}

function updateAttr(el, key, oldV, newV) {
    if (key.startsWith('$on') || key.startsWith('@on')) {
        const ev = key.substring(3).toLowerCase();
        if (typeof oldV === 'function') eventDelegation.removeListener(el, ev);
        if (typeof newV === 'function') eventDelegation.setListener(el, ev, newV);
    } else if (key.startsWith('on')) {
        const ev = key.substring(2).toLowerCase();
        if (typeof oldV === 'function') el.removeEventListener(ev, oldV);
        if (typeof newV === 'function') el.addEventListener(ev, newV);
    } else if (['value', 'checked', 'disabled', 'selected', 'innerHTML', 'textContent'].includes(key)) {
        if (key === 'value' && newV == null) el.value = '';
        else if (key === 'checked') el.checked = !!newV;
        else el[key] = newV;
    } else {
        if (newV == null || newV === false) {
            el.removeAttribute(key);
        } else {
            el.setAttribute(key, newV === true ? '' : String(newV));
        }
    }
}

function clearRef(ref) {
    if (typeof ref === 'function') ref(null);
    else if (ref) ref.current = null;
}


function detachRefsDeep(vnode, dom) {
    if (!vnode || !dom) return;
    if (vnode.props?.ref) clearRef(vnode.props.ref); // <--- ИСПОЛЬЗУЕМ ЕЁ ЗДЕСЬ

    if (vnode.type === PortalSymbol) {
        (vnode.children || []).forEach((c, i) => detachRefsDeep(c, dom._portalChildren?.[i]));
        return;
    }
    if (typeof vnode.type === 'function' && dom._parentComponent) {
        detachRefsDeep(dom._parentComponent._renderedVNode || dom._parentComponent._vnode, dom);
        return;
    }
    if (vnode.children?.length) {
        const real = Array.from(dom.childNodes);
        vnode.children.forEach((c, i) => detachRefsDeep(c, real[i]));
    }
}

// ============================================================================
// 6. CONTEXT & COMPONENT CLASS
// ============================================================================

const contextStack = [];

function findContext(ctxType) {
    for (let i = contextStack.length - 1; i >= 0; i--) {
        if (contextStack[i].context === ctxType) return contextStack[i].value;
    }
    return ctxType.defaultValue;
}

function updateComponent(inst, oldV, newV, dom) {
    if (newV.type._context) contextStack.push({ context: newV.type._context, value: newV.props.value });

    const { key, ref, ...props } = newV.props;
    inst.props = props;
    if (isClassComponent(newV.type) && newV.type.contextType) inst.context = findContext(newV.type.contextType);

    const prev = activeEffect;
    activeEffect = null; // Prevent parent re-tracking during child render
    const newInner = isClassComponent(newV.type) ? inst.render() : newV.type(props);
    activeEffect = prev;

    const oldInner = inst._vnode || inst._renderedVNode;
    const res = patch(oldInner, newInner, dom);

    inst._vnode = newInner;
    inst._renderedVNode = newInner;
    if (res !== dom) { inst.host = res; if (!res._component) res._component = inst; }
    if (inst.renderAfter) inst.renderAfter();
    if (newV.type._context) contextStack.pop();
    return res;
}

// ============================================================================
// 7. SSR & HYDRATION (Optimized)
// ============================================================================

function renderToString(vnode) {
    if (vnode == null || typeof vnode === 'boolean') return '';
    if (typeof vnode === 'string' || typeof vnode === 'number') return escapeHtml(vnode);
    if (Array.isArray(vnode)) return vnode.map(renderToString).join('');
    if (vnode.type === PortalSymbol) return renderToString(vnode.children);
    if (vnode.type?.$$typeof === ForwardRefSymbol || typeof vnode.type === 'function') return renderComponentToString(vnode);
    if (typeof vnode.type === 'string') return renderElementToString(vnode);
    return '';
}

function renderComponentToString(vnode) {
    const props = vnode.props || {};
    const fullProps = (vnode.children !== undefined && props.children === undefined) ? { ...props, children: vnode.children } : props;
    let rendered, isProv = false;

    try {
        if (vnode.type._context) { isProv = true; contextStack.push({ context: vnode.type._context, value: fullProps.value }); }
        if (vnode.type.$$typeof === ForwardRefSymbol) {
            const { ref, ...rest } = fullProps;
            rendered = vnode.type.render(rest, ref);
        } else if (isClassComponent(vnode.type)) {
            const instance = new vnode.type(fullProps);
            if (vnode.type.contextType) instance.context = findContext(vnode.type.contextType);
            rendered = instance.render();
        } else {
            rendered = vnode.type(fullProps);
        }
    } catch (e) {
        if (e && typeof e.then === 'function') rendered = null; // Suspense SSR fallback
        else throw e;
    } finally {
        if (isProv) contextStack.pop();
    }
    return renderToString(rendered);
}

function renderElementToString(vnode) {
    const tag = vnode.type;
    let attrs = '';
    // ИСПРАВЛЕНО: Убраны id, class, className, style - они должны рендериться!
    const skipKeys = ['ref', 'key', 'children', 'shadow', 'skipChildren'];

    for (let k in vnode.props) {
        if (skipKeys.includes(k)) continue;
        let v = vnode.props[k];
        if (k === 'style' && typeof v === 'object') v = styleObjToStr(v);
        if (k === 'className') k = 'class';
        if (typeof v === 'boolean') { if (v) attrs += ` ${k}`; }
        else if (v != null) attrs += ` ${k}="${escapeHtml(v)}"`;
    }

    if (VOID_ELEMENTS.has(tag)) return `<${tag}${attrs}>`;
    const inner = (vnode.children || []).map(renderToString).join('');
    return `<${tag}${attrs}>${inner}</${tag}>`;
}

function styleObjToStr(obj) {
    let s = '';
    for (let k in obj) s += `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${obj[k]};`;
    return s;
}

function hydrateNode(parent, vnode, existing, isInsideIsland = false) {
    if (vnode == null || vnode === false) {
        if (existing && existing.parentNode === parent) parent.removeChild(existing);
        return null;
    }
    if (typeof vnode === 'string' || typeof vnode === 'number') return hydrateTextNode(parent, vnode, existing);
    if (Array.isArray(vnode)) {
        let c = existing;
        vnode.forEach(cv => { c = hydrateNode(parent, cv, c, isInsideIsland); });
        return c;
    }
    if (typeof vnode.type === 'function') return hydrateComponent(parent, vnode, existing, isInsideIsland);
    if (typeof vnode.type === 'string') return hydrateElement(parent, vnode, existing, isInsideIsland);
    return existing?.nextSibling;
}
function hydrateTextNode(parent, vnode, existing) {
    const txt = String(vnode);

    if (existing?.nodeType === 3 && existing.parentNode === parent) {
        if (existing.nodeValue !== txt) existing.nodeValue = txt;
        return existing.nextSibling;
    }

    const n = document.createTextNode(txt);
    if (parent.nodeType === 1) {
        if (existing && existing.parentNode === parent) {
            parent.replaceChild(n, existing);
        } else {
            parent.appendChild(n);
        }
    }
    return n.nextSibling;
}
function hydrateComponent(parent, vnode, existing, isInsideIsland) {
    let inst, child;
    if (isClassComponent(vnode.type)) {
        inst = new vnode.type(vnode.props);
        child = inst.render();
    } else {
        child = vnode.type(vnode.props);
        inst = { props: vnode.props, render: vnode.type };
    }
    const next = hydrateNode(parent, child, existing, isInsideIsland);
    const dom = next ? next.previousSibling : parent.lastChild;
    if (dom?.nodeType === 1) {
        dom._component = inst; dom._parentComponent = inst; inst.host = dom;
        if (inst instanceof Component) inst._vnode = child;
    }
    return next;
}
function hydrateElement(parent, vnode, existing, isInsideIsland = false) {
    // БЕЗОПАСНОЕ удаление пробелов
    while (existing?.nodeType === 3 && !existing.nodeValue.trim() && existing.parentNode === parent) {
        const n = existing.nextSibling;
        parent.removeChild(existing);
        existing = n;
    }

    let dom;
    if (existing?.nodeType === 1 && existing.nodeName.toLowerCase() === vnode.type) {
        dom = existing;
    } else {
        dom = createDOMNode(vnode);
        if (parent.nodeType === 1) {
            if (existing && existing.parentNode === parent) {
                parent.replaceChild(dom, existing);
            } else {
                parent.appendChild(dom);
            }
        }
        return dom.nextSibling;
    }

    const isIslandRoot = dom.hasAttribute('data-island');
    const shouldBeInteractive = isInsideIsland || isIslandRoot;
    const rawProps = vnode.props || {};
    let propsToApply = rawProps;

    if (!shouldBeInteractive) {
        propsToApply = {};
        for (let k in rawProps) if (!k.startsWith('on')) propsToApply[k] = rawProps[k];
    }
    applyProps(dom, {}, propsToApply);

    let ch = dom.firstChild;
    (vnode.children || []).forEach(c => {
        ch = hydrateNode(dom, c, ch, shouldBeInteractive);
    });

    // БЕЗОПАСНОЕ удаление лишних детей
    while (ch && ch.parentNode === dom) {
        const n = ch.nextSibling;
        dom.removeChild(ch);
        ch = n;
    }

    return dom.nextSibling;
}

// ============================================================================
// 8. CORE API COMPONENTS
// ============================================================================

class Component {
    constructor(props) {
        this.props = props;
        this.host = null;
        this._vnode = null;
        this._dirty = false;
        this._effects = [];
        this._isDisposed = false;

        /* HMR */
        if (!this.constructor._activeInstances)
            this.constructor._activeInstances = new Set();
        this.constructor._activeInstances.add(this);

        const self = this;
        this._updateEffect = effect(() => self.update(), { defer: true });
    }

    render() { return h('div', {}, 'Base'); }

    $effect(fn) {
        const self = this;
        const eff = effect(() => fn.call(self));
        this._effects.push(eff);
    }

    $prop(name, value) {
        if (value === undefined) return this[name].value;
        this[name] = signal(value);
    }

    dispose() {
        if (this.constructor._activeInstances) {
            this.constructor._activeInstances.delete(this);
        }
        if (this.componentWillUnmount) this.componentWillUnmount();
        this._effects.forEach(e => e._cleanup && e._cleanup());
        this._effects = [];
        this._isDisposed = true;
    }

    update() {
        if (this._isDisposed || !this.host) return;

        const prevVnode = this._vnode;
        const prev = activeEffect;
        activeEffect = this._updateEffect;

        try {
            const n = this.render();
            this.host = patch(prevVnode, n, this.host);
            if (this._vnode === prevVnode) this._vnode = n;
        } catch (err) {
            if (this.componentDidCatch && !this._isHandlingError) {
                this._isHandlingError = true;
                try {
                    this.componentDidCatch(err);
                    const n = this.render();
                    this.host = patch(prevVnode, n, this.host);
                    this._vnode = n;
                } finally { this._isHandlingError = false; }
            } else { throw err; }
        } finally {
            activeEffect = prev;
        }
    }
}

function Fragment(p) { return p.children ? (Array.isArray(p.children) ? p.children : [p.children]) : []; }
function Portal(p) { return { type: PortalSymbol, props: { container: p.target || p.container }, children: Array.isArray(p.children) ? p.children : [p.children] }; }
function Dynamic(p) { const { component, ...rest } = p; return component ? h(component, rest) : null; }
function Show(p) { return h('div', { style: p.when ? 'display: contents;' : 'display: none;' }, p.children); }
function If(p) { return (p.condition || p.cond) ? p.children : (p.else || null); }
function Match(p) {
    let ch = Array.isArray(p.children) ? p.children : [p.children];
    for (let c of ch) if (c.type === Case && c.props.when === p.value) return c.props.children;
    for (let c of ch) if (c.type === Case && c.props.when === '*') return c.props.children;
    return null;
}
function Case(p) { return p.children; }
function Link(p) {
    const click = (e) => {
        e.preventDefault(); history.pushState({}, '', p.to);
        try { window.dispatchEvent(new PopStateEvent('popstate', { state: history.state })); }
        catch { const ev = document.createEvent('Event'); ev.initEvent('popstate', true, true); window.dispatchEvent(ev); }
    };
    return h('a', { href: p.to, onclick: click }, p.children);
}
function RouterView(p) {
    const path = p.router.currentPath.value;
    const C = p.router.routes[path];
    return C ? h(C, {}) : h('div', {}, 'Not Found');
}

class Delegator extends Component {
    constructor(props) {
        super(props);
        // Биндим обработчик один раз для производительности
        this.handleEvent = this.handleEvent.bind(this);
    }

    handleEvent(e) {
        const { selector } = this.props;
        const eventName = e.type;

        // Формируем имя пропса: onclick -> click
        const handlerKey = `on${eventName}`;
        const handler = this.props[handlerKey];

        if (typeof handler !== 'function') return;

        // Логика делегирования:
        // 1. Если селектор задан, ищем ближайшего родителя, подходящего под селектор
        if (selector) {
            // e.target - это самый глубокий элемент, на который кликнули
            // .closest(selector) поднимется вверх до первого совпадения
            const target = e.target.closest(selector);

            // Если нашли совпадение И оно внутри нашего компонента
            if (target && this.host.contains(target)) {
                // Вызываем хендлер. В контексте (this) будет целевой элемент
                handler.call(target, e, target);
            }
        }
        // 2. Если селектор не задан, просто ловим всплытие (простой случай)
        else {
            handler(e);
        }
    }

    render() {
        // Собираем события, которые нужно слушать
        const listeners = {};

        // Проходим по пропсам, ищем onclick, onmouseover и т.д.
        for (let key in this.props) {
            if (key.startsWith('on')) {
                const ev = key.substring(2).toLowerCase();
                // Вешаем наш унифицированный обработчик
                listeners[`on${ev}`] = this.handleEvent;
            }
        }

        // Рендерим невидимый контейнер.
        // style: 'display: contents;' критически важен — он не ломает верстку,
        // но создает узел в DOM, на который можно повесить события.
        return h('div', {
            style: 'display: contents;',
            ...listeners
        }, this.props.children);
    }
}

class Suspense extends Component {
    constructor(props) {
        super(props);
        this.state = { pending: false, error: null, timedOut: false };
        this.timeoutId = null;
        this.loadId = 0;
    }

    componentDidCatch(error) {
        if (error && typeof error.then === 'function') {
            this.state = { pending: true, error: null, timedOut: false };
            if (this.props.timeout) {
                this.timeoutId = setTimeout(() => { this.state.timedOut = true; this.update(); }, this.props.timeout);
            }
            const currentLoadId = ++this.loadId;
            error.then(
                () => { if (currentLoadId === this.loadId) this.handleLoadComplete(); },
                (err) => { if (currentLoadId === this.loadId) this.handleError(err); }
            );
        } else {
            this.state.error = error;
        }
    }

    handleLoadComplete() {
        clearTimeout(this.timeoutId);
        this.state.pending = false;
        this._vnode = null; // Force update
        this.update();
    }

    handleError(err) {
        clearTimeout(this.timeoutId);
        this.state.pending = false;
        this.state.error = err;
        this.update();
    }

    componentWillUnmount() {
        clearTimeout(this.timeoutId);
        if (this.currentLazyComponent?.cancel) this.currentLazyComponent.cancel(this.props.children?.props);
    }

    retry() {
        this.state = { pending: false, error: null, timedOut: false };
        this.loadId++;
        clearTimeout(this.timeoutId);
        this.update();
    }

    render() {
        if (this.state.error) {
            return this.props.onError ? this.props.onError(this.state.error, () => this.retry()) : h('div', {}, 'Error: ' + (this.state.error.message || 'Unknown'));
        }
        if (this.state.pending) {
            if (this.state.timedOut && this.props.timeoutFallback) return this.props.timeoutFallback;
            return this.props.fallback;
        }
        return this.props.children;
    }
}

class KeepAlive extends Component {
    constructor(e) { super(e); this.max = e.max || 10; this.cacheKeys = []; }
    render() {
        const child = this.props.children;
        const key = this.props.cacheKey || this.props.name || child?.type?.name;
        if (!child) {
            if (this._lastActiveKey && this[`_cached_${this._lastActiveKey}`]) {
                return h("div", { style: "display: none;" }, this[`_cached_${this._lastActiveKey}`]);
            }
            return null;
        }
        if (!key) return child;

        this._lastActiveKey = key;
        const cacheProp = `_cached_${key}`;

        if (this[cacheProp]) {
            this.cacheKeys = this.cacheKeys.filter(k => k !== key);
            this.cacheKeys.push(key);
            return h("div", { style: "display: contents;" }, this[cacheProp]);
        } else {
            this[cacheProp] = child;
            this.cacheKeys.push(key);
            while (this.cacheKeys.length > this.max) {
                delete this[`_cached_${this.cacheKeys.shift()}`];
            }
            return h("div", { style: "display: contents;" }, child);
        }
    }
    dispose() { this.cacheKeys.forEach(k => delete this[`_cached_${k}`]); super.dispose(); }
}

class LazyWrapper extends Component {
    constructor(props) {
        super(props);
        this.lazyComponent = props.lazyComponent;
        this.props = props;
    }

    componentWillUnmount() {
        if (this.lazyComponent.cancel) {
            this.lazyComponent.cancel(this.props);
        }
    }

    render() {
        return this.lazyComponent(this.props);
    }
}

function lazy(ld) {
    const cache = new Map();
    const activeRequests = new Map();

    const loaderFn = function(props) {
        const key = props?.key !== undefined ? props.key : 'default';
        if (cache.has(key)) return h(cache.get(key), props);

        if (!activeRequests.has(key)) {
            const abortController = new AbortController();
            const promise = ld({ ...props, signal: abortController.signal })
                .then(m => { cache.set(key, m.default); activeRequests.delete(key); return m; })
                .catch(err => { activeRequests.delete(key); throw err; });
            activeRequests.set(key, { promise, abortController });
        }
        throw activeRequests.get(key).promise;
    };

    loaderFn._isLazy = true;
    loaderFn.preload = (props = {}) => {
        const key = props?.key !== undefined ? props.key : 'default';
        if (cache.has(key) || activeRequests.has(key)) return activeRequests.get(key)?.promise || Promise.resolve();
        const abortController = new AbortController();
        const promise = ld({ ...props, signal: abortController.signal }).then(m => { cache.set(key, m.default); activeRequests.delete(key); });
        activeRequests.set(key, { promise, abortController });
        return promise;
    };
    loaderFn.cancel = (props = {}) => {
        const key = props?.key !== undefined ? props.key : 'default';
        const req = activeRequests.get(key);
        if (req) { req.abortController.abort(); activeRequests.delete(key); }
    };
    return loaderFn;
}

// ============================================================================
// 9. APPLICATION CORE
// ============================================================================

class App {
    constructor(sel) {
        this.root = typeof sel === 'string' ? (document.querySelector(sel) || (() => {
            const el = document.createElement('div');
            if (sel.startsWith('#')) el.id = sel.substring(1);
            document.body.appendChild(el);
            return el;
        })()) : sel;
        this._unmounted = false;
    }

    mount(Cls, props = {}) {
        const vnode = { type: Cls, props };
        this._dom = createDOMNode(vnode);
        this.root.appendChild(this._dom);
        this._inst = this._dom._parentComponent;
        return this._inst;
    }

    hydrate(Cls) {
        this._inst = new Cls();
        const v = this._inst.render();
        hydrateNode(this.root, v, this.root.firstChild);
        this._inst._vnode = v;
        this._inst.host = this.root;
        return this._inst;
    }

    unmount() {
        if (this._unmounted) return;
        this._cleanupDom(this.root);
        this.root.innerHTML = '';
        this._unmounted = true;
    }

    _cleanupDom(n) {
        if (!n) return;
        if (n._portalContainer) n._portalChildren.forEach(c => { if (c.parentNode === n._portalContainer) n._portalContainer.removeChild(c); this._cleanupDom(c); });
        const inst = n._component || n._parentComponent;
        if (inst) { inst.dispose?.(); delete n._component; delete n._parentComponent; }
        if (n.childNodes) Array.from(n.childNodes).forEach(c => this._cleanupDom(c));
    }
}

// ============================================================================
// 10. EXPORTS
// ============================================================================

function createContext(v) {
    const c = {
        defaultValue: v,
        Provider: class extends Component { render() { return this.props.children; } }
    };
    c.Provider._context = c;
    return c;
}

function forwardRef(r) { return { $$typeof: ForwardRefSymbol, render: r }; }

function createRouter(r) {
    const p = signal(location.pathname);
    window.addEventListener('popstate', () => p.value = location.pathname);
    return {
        routes: r,
        currentPath: p,
        push(u) { history.pushState({}, '', u); p.value = u; }
    };
}

// ============================================================================
// AJAX API (jQuery-style wrapper over fetch)
// ============================================================================
const _ajaxConfig = { baseUrl: '', headers: {} };

function ajaxSetup(options = {}) {
    Object.assign(_ajaxConfig, options);
}

function ajax(url, options = {}) {
    // Поддержка вызова $v.ajax({ url: '...', method: 'POST' })
    if (typeof url === 'object') {
        options = url;
        url = options.url;
    } else {
        options = { ...options, url };
    }

    const config = { ..._ajaxConfig, ...options };
    const method = (config.method || config.type || 'GET').toUpperCase();
    let finalUrl = _ajaxConfig.baseUrl + config.url;
    const headers = { ..._ajaxConfig.headers, ...config.headers };
    let body = undefined;

    // Обработка данных (как в jQuery)
    if (config.data) {
        if (method === 'GET') {
            const params = new URLSearchParams(config.data).toString();
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + params;
        } else {
            // По умолчанию jQuery отправляет форму
            const contentType = headers['Content-Type'] || headers['content-type'];
            if (contentType && contentType.includes('application/json')) {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify(config.data);
            } else {
                headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
                body = new URLSearchParams(config.data).toString();
            }
        }
    }

    // Возвращаем Promise с методами done/fail/always (как jqXHR)
    const promise = new Promise((resolve, reject) => {
        fetch(finalUrl, { method, headers, body })
            .then(async res => {
                const contentType = res.headers.get('content-type') || '';
                let result;

                // Автоопределение типа ответа
                if (config.dataType === 'json' || contentType.includes('application/json')) {
                    result = await res.json();
                } else if (config.dataType === 'text' || contentType.includes('text/')) {
                    result = await res.text();
                } else {
                    result = await res.text();
                }

                if (!res.ok) {
                    const err = new Error(`HTTP Error ${res.status}`);
                    err.status = res.status;
                    err.response = result;
                    throw err;
                }
                return result;
            })
            .then(data => {
                if (config.success) config.success(data, 'success', null);
                resolve(data);
            })
            .catch(err => {
                if (config.error) config.error(err, 'error', null);
                reject(err);
            })
            .finally(() => {
                if (config.complete) config.complete(null, 'success');
            });
    });

    // Добавляем jQuery-стиль методов
    promise.done = (fn) => { promise.then(fn); return promise; };
    promise.fail = (fn) => { promise.catch(fn); return promise; };
    promise.always = (fn) => { promise.finally(fn); return promise; };

    return promise;
}

// Короткие методы (полностью как в jQuery)
function get(url, data, success, dataType) {
    if (typeof data === 'function') { dataType = success; success = data; data = null; }
    return ajax({ url, method: 'GET', data, success, dataType });
}

function post(url, data, success, dataType) {
    if (typeof data === 'function') { dataType = success; success = data; data = null; }
    return ajax({ url, method: 'POST', data, success, dataType });
}

function getJSON(url, data, success) {
    if (typeof data === 'function') { success = data; data = null; }
    return ajax({ url, method: 'GET', data, success, dataType: 'json' });
}
// ============================================================================
// AJAX API (jQuery-style wrapper over fetch)
// ============================================================================


// ============================================================================
// HMR API
// ============================================================================
function applyHMR(oldClass, newClass) {
    if (!oldClass._activeInstances || oldClass._activeInstances.size === 0) {
        return newClass;
    }

    const instances = oldClass._activeInstances;

    // Переназначаем статику и прототип для всех живых инстансов
    instances.forEach(inst => {
        // Подменяем методы (прототип) на лету
        Object.setPrototypeOf(inst, newClass.prototype);

        // Принудительно перерисовываем компонент с новым кодом
        // Состояние (signals) при этом сохраняется!
        if (inst.host) {
            inst.update();
        }
    });

    // Передаем ownership инстансов новому классу
    newClass._activeInstances = instances;
    oldClass._activeInstances = new Set();

    console.log(`[vnano HMR] 🔥 Updated ${instances.size} instance(s) of ${newClass.name}`);
    return newClass;
}
// ============================================================================
// HMR API
// ============================================================================

const $v = {
    createApp: (sel) => new App(sel),
    signal, computed, effect, batch, h, escapeHtml,
    patch, createContext, createPortal: (c, t) => Portal({ children: c, target: t }),
    forwardRef, createDOMNode, renderToString, hydrateNode, lazy, createRouter,
    If, Match, Case, Portal, Dynamic, Show, Fragment, Link, RouterView, html,
    Component, App, Suspense, KeepAlive, Delegator, LazyWrapper,
    ajaxSetup, ajax, get, post, getJSON,
    applyHMR
};

const __test_internals__ = {
    trigger, flushEffects, clearRef,
    PortalSymbol, escapeHtml, isClassComponent,
    createFragmentNode, createPortalNode, createForwardRefNode, createComponentNode, createElementNode,
    patchRemoval, patchText, patchFragment, patchPortal, patchForwardRef, patchComponent, patchRemount, patchReplace, patchElement, updateComponent,
    diffKeyed, diffNonKeyed,
    mapOldKeys, removeUnusedKeys, reconcileNodes,
    applyRefLogic, updateClass, updateStyle, updateAttributes, updateAttr,
    createRouter, forwardRef,
    eventDelegation, applyProps, detachRefsDeep, findContext,
    renderComponentToString, renderElementToString, styleObjToStr,
    hydrateTextNode, hydrateComponent, hydrateElement
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = $v;
    module.exports.__test_internals__ = __test_internals__;
}
// ============================================================================
// N. TESTING INTERNALS (Экспорт для Vitest)
// ============================================================================

if (typeof window !== 'undefined') {
    window.$v = $v;
    window.$v.__test_internals__ = __test_internals__;
}
if (typeof global !== 'undefined') global.$v = $v;
if (typeof module !== 'undefined' && module.exports) module.exports = $v;
if (typeof document !== 'undefined') document.dispatchEvent(new Event('$vIsReady'));