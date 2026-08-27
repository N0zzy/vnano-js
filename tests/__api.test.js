import { describe, it, expect, vi } from 'vitest';
import {
    h, Fragment, Dynamic, Show, If, Match, Case, createRouter, RouterView, Link,
    lazy, forwardRef, createContext
} from '../src/vnano.js';

describe('Functional Components', () => {
    it('Fragment returns array of children', () => {
        expect(Fragment({ children: 'a' })).toEqual(['a']);
        expect(Fragment({ children: ['a', 'b'] })).toEqual(['a', 'b']);
        expect(Fragment({})).toEqual([]);
    });

    it('Dynamic returns vnode of passed component', () => {
        const Comp = () => h('div');
        const res = Dynamic({ component: Comp, id: 1 });
        expect(res.type).toBe(Comp);
        expect(res.props.id).toBe(1);
    });

    it('Show toggles display style', () => {
        const res1 = Show({ when: true, children: 'text' });
        expect(res1.props.style).toBe('display: contents;');

        const res2 = Show({ when: false, children: 'text' });
        expect(res2.props.style).toBe('display: none;');
    });

    it('If returns children or else', () => {
        expect(If({ condition: true, children: 'yes' })).toBe('yes');
        expect(If({ condition: false, children: 'yes', else: 'no' })).toBe('no');
    });

    it('Match/Case returns matching case', () => {
        const tree = Match({
            value: 'b',
            children: [
                h(Case, { when: 'a' }, 'A'),
                h(Case, { when: 'b' }, 'B')
            ]
        });
        expect(tree).toBe('B');
    });

    it('Match returns default case (*)', () => {
        const tree = Match({
            value: 'c',
            children: [
                h(Case, { when: 'a' }, 'A'),
                h(Case, { when: '*' }, 'Default')
            ]
        });
        expect(tree).toBe('Default');
    });
});

describe('Context & Refs API', () => {
    it('createContext should create context with Provider', () => {
        const ctx = createContext('default');
        expect(ctx.defaultValue).toBe('default');
        expect(ctx.Provider._context).toBe(ctx);
    });

    it('forwardRef should create ref object', () => {
        const ref = forwardRef(() => h('div'));
        expect(typeof ref.render).toBe('function');
        expect(typeof ref.$$typeof).toBe('symbol');
    });
});

describe('Router API', () => {
    it('createRouter initializes with current path', () => {
        const router = createRouter({ '/': () => h('div', null, 'Home') });
        expect(router.currentPath.value).toBe(window.location.pathname);
        expect(router.routes['/']).toBeDefined();
    });

    it('RouterView renders correct route', () => {
        const Home = () => h('div', null, 'Home');
        const router = createRouter({ '/home': Home });
        router.currentPath.value = '/home';

        const res = RouterView({ router });
        expect(res.type).toBe(Home);
    });

    it('RouterView renders Not Found', () => {
        const router = createRouter({});
        router.currentPath.value = '/unknown';

        const res = RouterView({ router });
        expect(res.type).toBe('div');
        expect(res.children[0]).toBe('Not Found');
    });

    it('Link returns anchor with href and onclick', () => {
        const res = Link({ to: '/about', children: 'About' });
        expect(res.type).toBe('a');
        expect(res.props.href).toBe('/about');
        expect(typeof res.props.onclick).toBe('function');
    });
});

describe('Lazy API', () => {
    it('lazy returns loader function with flags', () => {
        const loader = vi.fn(() => Promise.resolve({ default: () => h('div') }));
        const LazyComp = lazy(loader);

        expect(LazyComp._isLazy).toBe(true);
        expect(typeof LazyComp.preload).toBe('function');
        expect(typeof LazyComp.cancel).toBe('function');
    });

    it('lazy throws promise on first call', () => {
        const loader = () => Promise.resolve({ default: () => h('div') });
        const LazyComp = lazy(loader);

        expect(() => LazyComp({})).toThrow(); // Должен выбросить Promise
    });
});