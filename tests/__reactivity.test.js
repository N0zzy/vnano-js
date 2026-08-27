import { describe, it, expect, vi } from 'vitest';
import { signal, computed, effect, batch } from '../src/vnano.js';
import { __test_internals__ } from '../src/vnano.js';
const { trigger, flushEffects } = __test_internals__;

describe('Reactivity: signal', () => {
    it('should initialize and read value', () => {
        const s = signal(10);
        expect(s.value).toBe(10);
    });

    it('should update value', () => {
        const s = signal(1);
        s.value = 2;
        expect(s.value).toBe(2);
    });

    it('should trigger effect on change', () => {
        const s = signal(0);
        const spy = vi.fn();
        effect(() => spy(s.value));

        expect(spy).toHaveBeenCalledWith(0);
        s.value = 5;
        expect(spy).toHaveBeenCalledWith(5);
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should not trigger effect if value is the same', () => {
        const s = signal(1);
        const spy = vi.fn();
        effect(() => spy(s.value));

        s.value = 1; // То же значение
        expect(spy).toHaveBeenCalledTimes(1);
    });
});

describe('Reactivity: computed', () => {
    it('should compute value lazily', () => {
        const a = signal(2);
        const spy = vi.fn(() => a.value * 2);
        const sum = computed(spy);

        expect(spy).not.toHaveBeenCalled(); // Ленивые вычисления
        expect(sum.value).toBe(4);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should recompute only when dependencies change', () => {
        const a = signal(1);
        const sum = computed(() => a.value * 2);

        expect(sum.value).toBe(2);
        a.value = 5;
        expect(sum.value).toBe(10);
    });
});

describe('Reactivity: effect', () => {
    it('should run cleanup function on re-run or disposal', () => {
        const s = signal(0);
        const cleanupSpy = vi.fn();
        // ИСПРАВЛЕНИЕ: Добавлено чтение s.value, чтобы эффект подписался на сигнал
        const runSpy = vi.fn(() => {
            s.value;
            return cleanupSpy;
        });

        effect(runSpy);
        expect(cleanupSpy).not.toHaveBeenCalled();

        s.value = 1; // Вызовет повторный запуск
        expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('should defer execution with options.defer', () => {
        const spy = vi.fn();
        effect(spy, { defer: true });
        expect(spy).not.toHaveBeenCalled();

        batch(() => {}); // Запускаем flushEffects
        expect(spy).toHaveBeenCalledTimes(1);
    });
});

describe('Reactivity: batch', () => {
    it('should defer effects until batch completes', () => {
        const s = signal(0);
        const spy = vi.fn();
        effect(() => spy(s.value));
        spy.mockClear();

        batch(() => {
            s.value = 1;
            s.value = 2;
            s.value = 3;
            expect(spy).not.toHaveBeenCalled(); // Внутри batch эффекты не срабатывают
        });

        expect(spy).toHaveBeenCalledTimes(1); // Сработал 1 раз с последним значением
        expect(spy).toHaveBeenCalledWith(3);
    });
});

describe('trigger & flushEffects', () => {
    it('trigger adds effects to pending set', () => {
        const fn = vi.fn();
        const subs = new Set([fn]);
        trigger(subs);
        // flushEffects вызывается внутри trigger, если batchDepth === 0
        expect(fn).toHaveBeenCalled();
    });

    it('flushEffects throws on infinite loops (>100 iterations)', () => {
        // Создаем эффект, который бесконечно обновляет сам себя
        const s = signal(0);
        const badEffect = () => { s.value++; };
        // Ожидаем, что эффект выбросит ошибку при переполнении
        expect(() => effect(badEffect)).toThrow('Infinite loop');
    });
});

describe('Reactivity', () => {
    it('signal gets/sets and triggers', () => {
        const s = signal(1);
        const spy = vi.fn();
        effect(() => spy(s.value));
        expect(spy).toHaveBeenCalledWith(1);
        s.value = 5;
        expect(spy).toHaveBeenCalledWith(5);
    });

    it('computed caches and re-evaluates lazily', () => {
        const a = signal(1);
        const spy = vi.fn(() => a.value * 2);
        const c = computed(spy);
        expect(spy).not.toHaveBeenCalled();
        expect(c.value).toBe(2);
        a.value = 3;
        expect(c.value).toBe(6);
    });

    it('batch defers effects', () => {
        const s = signal(0);
        const spy = vi.fn();
        effect(() => spy(s.value));
        spy.mockClear();

        batch(() => {
            s.value = 1;
            s.value = 2;
            expect(spy).not.toHaveBeenCalled();
        });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(2);
    });
});