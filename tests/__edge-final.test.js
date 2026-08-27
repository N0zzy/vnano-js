import { describe, it, expect, vi } from 'vitest';
import { h, Component, createDOMNode, KeepAlive, Suspense, get, post } from '../src/vnano.js';

// ============================================================================
// 1. AJAX API TESTS
// ============================================================================
describe('AJAX API (fetch wrapper)', () => {
    it('should resolve and call success/done for $v.get', async () => {
        const mockResponse = { json: () => Promise.resolve({ data: 'success' }), ok: true, headers: { get: () => 'application/json' } };
        global.fetch = vi.fn(() => Promise.resolve(mockResponse));

        const successSpy = vi.fn();
        const doneSpy = vi.fn();

        await get('/api/test', { id: 1 }, successSpy)
            .done(doneSpy)
            .catch(() => {});

        expect(fetch).toHaveBeenCalledWith('/api/test?id=1', { method: 'GET', headers: {}, body: undefined });
        expect(successSpy).toHaveBeenCalledWith({ data: 'success' }, 'success', null);
        expect(doneSpy).toHaveBeenCalledWith({ data: 'success' });
    });

    it('should reject and call error/fail for $v.post', async () => {
        const mockResponse = { json: () => Promise.resolve({ error: 'Internal Server Error' }), ok: false, status: 500, headers: { get: () => 'application/json' } };
        global.fetch = vi.fn(() => Promise.resolve(mockResponse));

        const errorSpy = vi.fn();
        const failSpy = vi.fn();

        await post('/api/fail', { data: 'test' }, () => {})
            .fail(failSpy)
            .catch(() => {});

        expect(fetch).toHaveBeenCalledWith('/api/fail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: 'data=test'
        });
        expect(failSpy).toHaveBeenCalled();
    });
});

// ============================================================================
// 2. KEEPALIVE LRU EVICTION
// ============================================================================
describe('KeepAlive LRU Cache Eviction', () => {
    it('should remove oldest component when max limit is exceeded', () => {
        class Comp extends Component {
            render() { return h('div', null, `Comp ${this.props.name}`); }
        }

        const vnode1 = h(KeepAlive, { max: 2, name: '1' }, h(Comp, { name: '1', key: '1' }));
        const dom = createDOMNode(vnode1);
        const inst = dom._parentComponent;

        inst.props = { max: 2, name: '2', children: h(Comp, { name: '2', key: '2' }) };
        inst.update();
        inst.props = { max: 2, name: '3', children: h(Comp, { name: '3', key: '3' }) };
        inst.update();

        expect(inst._cached_1).toBeUndefined();
        expect(inst._cached_2).toBeDefined();
        expect(inst._cached_3).toBeDefined();

        inst.props = { max: 2, name: '2', children: h(Comp, { name: '2', key: '2' }) };
        inst.update();

        inst.props = { max: 2, name: '4', children: h(Comp, { name: '4', key: '4' }) };
        inst.update();

        expect(inst._cached_2).toBeDefined();
        expect(inst._cached_4).toBeDefined();
        expect(inst._cached_3).toBeUndefined();
    });
});

// ============================================================================
// 3. SUSPENSE TIMEOUT
// ============================================================================
describe('Suspense Timeout Logic', () => {
    it('should show timeoutFallback if promise takes too long', async () => {
        let resolvePromise;
        let hasThrown = false;

        const fakeLazy = () => {
            if (!hasThrown) {
                hasThrown = true;
                throw new Promise((res) => { resolvePromise = res; });
            }
            return h('div', null, 'Loaded');
        };

        const vnode = h(Suspense, {
            fallback: h('div', null, 'Loading'),
            timeoutFallback: h('div', null, 'Timed Out!'),
            timeout: 100
        }, h(fakeLazy));

        const dom = createDOMNode(vnode);
        // ИСПРАВЛЕНО: Берем инстанс, чтобы отслеживать актуальный DOM
        const inst = dom._component || dom._parentComponent;

        expect(inst.host.textContent).toBe('Loading');

        await new Promise(r => setTimeout(r, 120));
        expect(inst.host.textContent).toBe('Timed Out!');

        resolvePromise();
        await new Promise(r => setTimeout(r, 10));

        expect(inst.host.textContent).toBe('Loaded');
    });
});