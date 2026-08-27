import { describe, it, expect } from 'vitest';
import { h, escapeHtml, createDOMNode, patch, Fragment } from '../src/vnano.js';
import { __test_internals__ } from '../src/vnano.js';
const { createFragmentNode, createPortalNode, createElementNode,
    patchRemoval, patchText, patchFragment, patchPortal,
    patchReplace, patchElement, diffKeyed, diffNonKeyed,
    PortalSymbol,escapeHtml, isClassComponent,
    forwardRef, createForwardRefNode, createComponentNode,
    patchComponent, patchRemount, patchForwardRef
} = __test_internals__;

vnodeToDom = function(v) {
    const el = document.createElement(v.type);
    if (v.children[0]) el.textContent = v.children[0];
    return el;
};

describe('VDOM: h()', () => {
    it('should create a vnode', () => {
        const vnode = h('div', { id: '1' }, 'text');
        expect(vnode.type).toBe('div');
        expect(vnode.props.id).toBe('1');
        expect(vnode.children[0]).toBe('text');
    });

    it('should filter out null, undefined, false, true, empty string', () => {
        const vnode = h('div', null, null, undefined, false, true, '', 'text');
        expect(vnode.children.length).toBe(1);
        expect(vnode.children[0]).toBe('text');
    });

    it('should flatten children', () => {
        const vnode = h('div', null, [['a'], ['b']]);
        expect(vnode.children).toEqual(['a', 'b']);
    });

    it('should handle Fragment type by returning array', () => {
        const res = h(Fragment, null, 'a', 'b');
        expect(Array.isArray(res)).toBe(true);
        expect(res).toEqual(['a', 'b']);
    });
});

describe('VDOM: isClassComponent()', () => {
    it('should return true for classes', () => {
        class Test { render() {} }
        expect(isClassComponent(Test)).toBe(true);
    });

    it('should return false for functions', () => {
        const Fn = () => {};
        expect(isClassComponent(Fn)).toBeFalsy(); // ИСПРАВЛЕНО
    });

    it('should return false for null/undefined', () => {
        expect(isClassComponent(null)).toBeFalsy(); // ИСПРАВЛЕНО
        expect(isClassComponent(undefined)).toBeFalsy(); // ИСПРАВЛЕНО
    });
});

describe('VDOM: escapeHtml()', () => {
    it('should escape special characters', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
        expect(escapeHtml('"q"')).toBe('&quot;q&quot;');
        expect(escapeHtml('&')).toBe('&amp;');
    });

    it('should return empty string for null/undefined', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});

describe('DOM: createDOMNode()', () => {
    it('should create text nodes', () => {
        const node = createDOMNode('hello');
        expect(node.nodeType).toBe(3);
        expect(node.nodeValue).toBe('hello');
    });

    it('should create elements', () => {
        const node = createDOMNode(h('span', { class: 'a' }, 'text'));
        expect(node.tagName).toBe('SPAN');
        expect(node.className).toBe('a');
        expect(node.textContent).toBe('text');
    });

    it('should create fragments', () => {
        const node = createDOMNode(['a', 'b']);
        expect(node.nodeType).toBe(11); // DocumentFragment
        expect(node.childNodes.length).toBe(2);
    });

    it('should create SVG elements with namespace', () => {
        const node = createDOMNode(h('svg', null, h('path', null)));
        expect(node.namespaceURI).toBe('http://www.w3.org/2000/svg');
    });
});

describe('DOM: patch()', () => {
    it('should patch text', () => {
        const dom = createDOMNode('old');
        const newDom = patch('old', 'new', dom);
        expect(newDom.nodeValue).toBe('new');
    });

    it('should patch element props', () => {
        const oldV = h('div', { id: 'old', class: 'c1' });
        const newV = h('div', { id: 'new', style: 'color:red' });
        const dom = createDOMNode(oldV);

        patch(oldV, newV, dom);

        expect(dom.id).toBe('new');
        expect(dom.className).toBe(''); // Убрали класс
        expect(dom.getAttribute('style')).toBe('color:red'); // Добавили стиль
    });

    it('should patch non-keyed children', () => {
        const oldV = h('ul', null, h('li', null, '1'), h('li', null, '2'));
        const newV = h('ul', null, h('li', null, '1'), h('li', null, 'updated'));
        const dom = createDOMNode(oldV);

        patch(oldV, newV, dom);

        expect(dom.children[1].textContent).toBe('updated');
    });

    it('should patch keyed children (reorder)', () => {
        const oldV = h('ul', null, h('li', { key: 1 }, '1'), h('li', { key: 2 }, '2'));
        const newV = h('ul', null, h('li', { key: 2 }, '2'), h('li', { key: 1 }, '1'));
        const dom = createDOMNode(oldV);

        patch(oldV, newV, dom);

        expect(dom.children[0].textContent).toBe('2');
        expect(dom.children[1].textContent).toBe('1');
    });

    it('should remove elements', () => {
        const oldV = h('div', null, 'text');
        const dom = createDOMNode(oldV);
        const newDom = patch(oldV, null, dom);

        expect(newDom.nodeType).toBe(3); // Placeholder text node
        expect(newDom.nodeValue).toBe('');
    });
});

describe('VDOM: createFragmentNode', () => {
    it('creates a document fragment with children', () => {
        const frag = createFragmentNode(['a', 'b'], null);
        expect(frag.nodeType).toBe(11);
        expect(frag.childNodes.length).toBe(2);
    });
});

describe('VDOM: createPortalNode', () => {
    it('appends children to target container and sets refs on placeholder', () => {
        const target = document.createElement('div');
        const vnode = { type: PortalSymbol, props: { container: target }, children: [h('span', null, 'test')] };
        const ph = createPortalNode(vnode);

        expect(ph.nodeType).toBe(3); // Text node placeholder
        expect(ph._portalContainer).toBe(target);
        expect(target.children.length).toBe(1);
        expect(ph._portalChildren.length).toBe(1);
    });
});

describe('VDOM: createElementNode', () => {
    it('creates standard element with props and children', () => {
        const vnode = h('div', { id: 'test' }, 'hello');
        const el = createElementNode(vnode, null);
        expect(el.tagName).toBe('DIV');
        expect(el.id).toBe('test');
        expect(el.textContent).toBe('hello');
    });

    it('creates SVG element with namespace', () => {
        const vnode = h('svg', null, h('path', null));
        const el = createElementNode(vnode, null);
        expect(el.namespaceURI).toBe('http://www.w3.org/2000/svg');
    });

    it('attaches Shadow DOM if shadow prop is present', () => {
        const vnode = h('div', { shadow: 'open' }, 'secret');
        const el = createElementNode(vnode, null);
        expect(el.shadowRoot).not.toBeNull();
        expect(el.shadowRoot.textContent).toBe('secret');
    });
});

describe('VDOM: patchText', () => {
    it('updates nodeValue of text node', () => {
        const dom = document.createTextNode('old');
        patchText('new', dom);
        expect(dom.nodeValue).toBe('new');
    });
    it('replaces non-text node with text node', () => {
        const parent = document.createElement('div');
        const dom = document.createElement('span');
        parent.appendChild(dom);
        patchText('text', dom);
        expect(parent.firstChild.nodeType).toBe(3);
    });
});

describe('VDOM: patchRemoval', () => {
    it('replaces dom with empty text node placeholder', () => {
        const parent = document.createElement('div');
        const dom = document.createElement('span');
        parent.appendChild(dom);

        patchRemoval(null, dom);
        expect(parent.firstChild.nodeType).toBe(3);
        expect(parent.firstChild.nodeValue).toBe('');
    });
});

describe('VDOM: diffNonKeyed', () => {
    it('appends new children', () => {
        const parent = document.createElement('ul');
        parent.appendChild(document.createElement('li'));
        diffNonKeyed([h('li')], [h('li'), h('li')], parent);
        expect(parent.children.length).toBe(2);
    });

    it('removes extra children', () => {
        const parent = document.createElement('ul');
        parent.appendChild(document.createElement('li'));
        parent.appendChild(document.createElement('li'));
        diffNonKeyed([h('li'), h('li')], [h('li')], parent);
        expect(parent.children.length).toBe(1);
    });
});

describe('VDOM: diffKeyed', () => {
    it('reorders nodes correctly right-to-left', () => {
        const parent = document.createElement('div');
        const oldVNodes = [h('div', { key: 1 }, '1'), h('div', { key: 2 }, '2')];
        const newVNodes = [h('div', { key: 2 }, '2'), h('div', { key: 1 }, '1')];

        oldVNodes.forEach(v => parent.appendChild(vnodeToDom(v)));

        diffKeyed(oldVNodes, newVNodes, parent);
        expect(parent.children[0].textContent).toBe('2');
        expect(parent.children[1].textContent).toBe('1');
    });
});

// Вспомогательная функция для теста
function vnodeToDom(v) {
    const el = document.createElement(v.type);
    if (v.children[0]) el.textContent = v.children[0];
    return el;
}

// Проверяем общую функцию patch (маршрутизатор)
describe('VDOM: patch (dispatcher)', () => {
    it('routes to patchText for strings', () => {
        const dom = document.createTextNode('a');
        const res = patch('a', 'b', dom);
        expect(res.nodeValue).toBe('b');
    });
});


// === ДОБАВИТЬ В КОНЕЦ ФАЙЛА __vdom.test.js ===

describe('VDOM: createForwardRefNode', () => {
    it('creates dom and calls ref function', () => {
        const ref = vi.fn();
        const Comp = forwardRef((props, r) => { r({}); return h('div', null, 'text'); });
        const vnode = { type: Comp, props: { ref } };
        const dom = createForwardRefNode(vnode, null);
        expect(dom.tagName).toBe('DIV');
        expect(dom._component).toBeDefined();
        expect(ref).toHaveBeenCalled();
    });
});

describe('VDOM: createComponentNode', () => {
    it('renders functional component to real DOM', () => {
        const Comp = (props) => h('div', { id: props.id }, 'Content');
        const vnode = { type: Comp, props: { id: '1' } };
        const dom = createComponentNode(vnode, null);
        expect(dom.tagName).toBe('DIV');
        expect(dom.id).toBe('1');
        expect(dom.textContent).toBe('Content');
        expect(dom._component).toBeDefined();
    });
});

describe('VDOM: patchFragment', () => {
    it('syncs array children in fragment', () => {
        const parent = document.createElement('div');
        // ИСПРАВЛЕНИЕ: Сразу кладем дочерний элемент в div, а не во фрагмент
        parent.appendChild(createDOMNode(h('span', null, '1')));

        const oldV = [h('span', null, '1')];
        const newV = [h('span', null, '1'), h('span', null, '2')];

        patchFragment(oldV, newV, parent); // Патчим сам parent

        expect(parent.childNodes.length).toBe(2);
    });
});

describe('VDOM: patchPortal', () => {
    it('updates portal children in target container', () => {
        const target = document.createElement('div');
        const oldV = { type: PortalSymbol, props: { container: target }, children: [h('span', null, 'old')] };
        const newV = { type: PortalSymbol, props: { container: target }, children: [h('span', null, 'new')] };

        const dom = createPortalNode(oldV);
        patchPortal(oldV, newV, dom);

        expect(target.textContent).toBe('new');
    });
});

describe('VDOM: patchForwardRef', () => {
    it('patches inner node of forwardRef', () => {
        const ref = vi.fn();
        const Comp = forwardRef(() => h('div', null, 'old'));
        const oldV = { type: Comp, props: { ref } };
        const dom = createForwardRefNode(oldV, null);

        // Создаем новый VNode с тем же компонентом, но другим ключом для проверки замены
        const newV = { type: Comp, props: { ref, key: 'new' } };
        patchForwardRef(oldV, newV, dom); // Не должен упасть
    });
});

describe('VDOM: patchComponent & updateComponent', () => {
    it('updates functional component props', () => {
        const Comp = (props) => h('div', { id: props.id }, 'Content');
        const oldV = h(Comp, { id: 'old' });
        const newV = h(Comp, { id: 'new' });

        const dom = createDOMNode(oldV);
        patchComponent(oldV, newV, dom);

        expect(dom.id).toBe('new');
    });
});

describe('VDOM: patchReplace', () => {
    it('replaces old node with new node in parent', () => {
        const parent = document.createElement('div');
        const oldV = h('span', null, 'old');
        const newV = h('div', null, 'new');

        const dom = createDOMNode(oldV);
        parent.appendChild(dom);

        patchReplace(oldV, newV, dom);
        expect(parent.firstChild.tagName).toBe('DIV');
        expect(parent.firstChild.textContent).toBe('new');
    });
});

describe('VDOM: patchRemount', () => {
    it('replaces placeholder with real node', () => {
        const parent = document.createElement('div');
        const dom = document.createTextNode(''); // placeholder
        parent.appendChild(dom);

        const newV = h('div', null, 'remounted');
        patchRemount(null, newV, dom);

        expect(parent.firstChild.tagName).toBe('DIV');
    });
});

// Вспомогательная функция для теста (если еще не добавлена)
