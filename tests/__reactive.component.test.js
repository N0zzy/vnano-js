import { describe, it, expect, vi } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.components.js';
import { signal, effect, batch } from '../src/vnano.js';

describe('ReactiveStore Class', () => {
    it('should track changes in effect', () => {
        const store = new $v.ReactiveStore({ count: 0 });
        const state = store.proxy;

        let dummy;
        effect(() => { dummy = state.count; });

        expect(dummy).toBe(0);
        state.count = 10;
        expect(dummy).toBe(10);
    });

    it('should handle deep nested objects', () => {
        const state = new $v.ReactiveStore({ user: { name: 'John' } }).proxy;

        let dummyName;
        effect(() => { dummyName = state.user.name; });

        expect(dummyName).toBe('John');
        state.user.name = 'Jane';
        expect(dummyName).toBe('Jane');
    });

    it('should return true for __v_isReactive', () => {
        const state = new $v.ReactiveStore({}).proxy;
        expect(state.__v_isReactive).toBe(true);
    });
});

describe('GlobalStore Class', () => {
    it('should dispatch actions and update state', () => {
        const store = new $v.GlobalStore(
            { count: 0 },
            {
                increment(state) { state.count++; },
                add(state, payload) { state.count += payload; }
            }
        );

        let dummy;
        effect(() => { dummy = store.state.count; });

        expect(dummy).toBe(0);
        store.dispatch('increment');
        expect(dummy).toBe(1);

        store.dispatch('add', 5);
        expect(dummy).toBe(6);
    });

    it('should batch multiple state changes', () => {
        const spy = vi.fn();
        const store = new $v.GlobalStore(
            { a: 1, b: 2 },
            {
                updateAll(state) {
                    state.a = 10;
                    state.b = 20;
                }
            }
        );

        effect(() => {
            spy(store.state.a, store.state.b);
        });

        expect(spy).toHaveBeenCalledTimes(1);
        store.dispatch('updateAll');
        // Из-за батча эффект должен сработать 1 раз, а не 2
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy).toHaveBeenLastCalledWith(10, 20);
    });
});