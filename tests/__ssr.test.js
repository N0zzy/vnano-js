import { describe, it, expect } from 'vitest';
import {
    h, renderToString, hydrateNode, Fragment, Match, If, Show, Dynamic, Case, Link,
    RouterView, lazy, createContext, Portal
} from '../src/vnano.js';

import { __test_internals__ } from '../src/vnano.js';
const {
    styleObjToStr, renderElementToString, hydrateTextNode, hydrateElement,
    createRouter, forwardRef, renderComponentToString, hydrateComponent,
    PortalSymbol
} = __test_internals__;


describe('SSR: renderToString()', () => {
    it('should render text', () => {
        expect(renderToString('hello')).toBe('hello');
    });

    it('should render elements with attributes', () => {
        expect(renderToString(h('div', { id: '1' }, 'text'))).toBe('<div id="1">text</div>');
    });

    it('should render void elements', () => {
        expect(renderToString(h('input', { type: 'text' }))).toBe('<input type="text">');
    });

    it('should render boolean attributes', () => {
        expect(renderToString(h('button', { disabled: true }, 'Click'))).toBe('<button disabled>Click</button>');
        expect(renderToString(h('button', { disabled: false }, 'Click'))).toBe('<button>Click</button>');
    });

    it('should render style objects', () => {
        expect(renderToString(h('div', { style: { color: 'red', fontSize: '12px' } }))).toBe('<div style="color:red;font-size:12px;"></div>');
    });

    it('should render className as class', () => {
        expect(renderToString(h('div', { className: 'my-class' }))).toBe('<div class="my-class"></div>');
    });

    it('should escape HTML in text', () => {
        expect(renderToString(h('div', null, '<script>'))).toBe('<div>&lt;script&gt;</div>');
    });

    it('should render fragments', () => {
        expect(renderToString(h(Fragment, null, 'a', 'b'))).toBe('ab');
    });
});

describe('SSR: Hydration hydrateNode()', () => {
    it('should hydrate text nodes', () => {
        const parent = document.createElement('div');
        parent.innerHTML = 'old text';
        hydrateNode(parent, 'new text', parent.firstChild);
        expect(parent.textContent).toBe('new text');
    });

    it('should hydrate element nodes', () => {
        const parent = document.createElement('div');
        parent.innerHTML = '<span class="old">text</span>';
        hydrateNode(parent, h('span', { class: 'new' }, 'updated'), parent.firstChild);

        const span = parent.firstChild;
        expect(span.tagName).toBe('SPAN');
        expect(span.className).toBe('new');
        expect(span.textContent).toBe('updated');
    });

    it('should skip whitespace during hydration', () => {
        const parent = document.createElement('div');
        parent.innerHTML = '   <div></div>';
        hydrateNode(parent, h('div', null, 'Test'), parent.firstChild);

        expect(parent.children[0].textContent).toBe('Test');
    });

    it('should strip events for static islands (data-island logic)', () => {
        const parent = document.createElement('div');
        parent.innerHTML = '<button></button>';
        const onclick = () => {};

        // НЕ передаем shouldBeInteractive
        hydrateNode(parent, h('button', { onclick }, 'Click'), parent.firstChild);

        // Так как это статичная часть, onclick не должен быть повешен на DOM
        expect(parent.firstChild.onclick).toBeNull();
    });
});

describe('SSR: Internals', () => {
    it('styleObjToStr converts camelCase to kebab-case', () => {
        expect(styleObjToStr({ fontSize: '12px', color: 'red' })).toBe('font-size:12px;color:red;');
    });

    it('renderElementToString renders void elements correctly', () => {
        const vnode = h('input', { type: 'text' });
        expect(renderElementToString(vnode)).toBe('<input type="text">');
    });

    it('renderToString handles all functional components', () => {
        expect(renderToString(h(If, { condition: true, children: 'Yes' }))).toBe('Yes');
        expect(renderToString(h(Show, { when: false, children: 'No' }))).toBe('<div style="display: none;">No</div>');
        expect(renderToString(h(Dynamic, { component: () => h('div', null, 'Dyn') }))).toBe('<div>Dyn</div>');
    });
});

describe('SSR: Hydration Internals', () => {
    it('hydrateTextNode updates existing node', () => {
        const parent = document.createElement('div');
        parent.innerHTML = 'old';
        hydrateTextNode(parent, 'new', parent.firstChild);
        expect(parent.textContent).toBe('new');
    });

    it('hydrateElement strips events for non-islands', () => {
        const parent = document.createElement('div');
        parent.innerHTML = '<button>Click</button>';
        const handler = vi.fn();
        hydrateElement(parent, h('button', { onclick: handler }, 'Click'), parent.firstChild, false);

        parent.firstChild.dispatchEvent(new Event('click'));
        expect(handler).not.toHaveBeenCalled(); // Не должен сработать, так как static HTML
    });
});

// Тесты чистых функций (API)
describe('SSR: Pure Functional Components', () => {
    it('Fragment returns array', () => {
        expect(Fragment({ children: ['a'] })).toEqual(['a']);
    });
    it('Match/Case returns correct branch', () => {
        const tree = h(Match, { value: 'b' }, [h(Case, { when: 'a', children: 'A' }), h(Case, { when: 'b', children: 'B' })]);
        // Match ожидает VNode детей
        expect(Match(tree.props)).toBe('B');
    });
    it('Link returns anchor with href', () => {
        const res = Link({ to: '/path', children: 'Go' });
        expect(res.type).toBe('a');
        expect(res.props.href).toBe('/path');
    });
});

describe('SSR: Router API', () => {
    it('createRouter & RouterView', () => {
        // Выносим компонент в переменную, чтобы проверить по ссылке
        const Home = () => h('div', null, 'Home');
        const routes = { '/': Home };
        const router = createRouter(routes);
        router.currentPath.value = '/';

        const view = RouterView({ router });

        // Проверяем, что RouterView вернул именно компонент Home
        expect(view.type).toBe(Home);
    });
});

describe('SSR: Lazy & Refs', () => {
    it('lazy throws promise on first load', async () => {
        const loader = () => Promise.resolve({ default: () => h('div') });
        const LazyComp = lazy(loader);
        expect(() => LazyComp({})).toThrow(); // Должен выбросить Promise
    });

    it('forwardRef creates symbol', () => {
        const ref = forwardRef(() => h('div'));
        expect(typeof ref.$$typeof).toBe('symbol');
    });

    it('createContext sets default', () => {
        const ctx = createContext('def');
        expect(ctx.defaultValue).toBe('def');
    });
});


describe('SSR: renderComponentToString', () => {
    it('renders functional component to string', () => {
        const Comp = () => h('div', null, 'SSR');
        const vnode = { type: Comp, props: {} };
        expect(renderComponentToString(vnode)).toBe('<div>SSR</div>');
    });
});

describe('SSR: hydrateComponent', () => {
    it('links component instance to existing dom', () => {
        const Comp = (props) => h('div', null, 'Hydrated');
        const parent = document.createElement('div');
        parent.innerHTML = '<div>Hydrated</div>';

        const vnode = { type: Comp, props: {} };
        hydrateComponent(parent, vnode, parent.firstChild, false);

        expect(parent.firstChild._component).toBeDefined();
        expect(parent.firstChild._parentComponent).toBeDefined();
    });
});

describe('SSR: Portal Component', () => {
    it('returns PortalSymbol vnode structure', () => {
        const target = document.createElement('div');
        const res = Portal({ target, children: 'content' });

        expect(res.type).toBe(PortalSymbol);
        expect(res.props.container).toBe(target); // <--- ИСПРАВЛЕНО: проверяем container
        expect(res.children[0]).toBe('content');
    });
});