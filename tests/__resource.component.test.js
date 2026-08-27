import { describe, it, expect, vi } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.components.js';
import { signal, effect } from '../src/vnano.js';

describe('createResource Plugin', () => {
    it('should fetch data initially', async () => {
        const userId = signal(1);
        const fetcher = vi.fn((id) => Promise.resolve(`User-${id}`));

        const user = $v.createResource(userId, fetcher);

        expect(user.loading.value).toBe(true);

        // Ждем промис
        await new Promise(r => setTimeout(r, 10));

        expect(user.loading.value).toBe(false);
        expect(user.value).toBe('User-1');
    });

    it('should refetch when source changes', async () => {
        const userId = signal(1);
        const fetcher = vi.fn((id) => Promise.resolve(`User-${id}`));

        const user = $v.createResource(userId, fetcher);

        await new Promise(r => setTimeout(r, 10));
        expect(user.value).toBe('User-1');

        // Меняем ID
        userId.value = 2;

        expect(user.loading.value).toBe(true);
        await new Promise(r => setTimeout(r, 10));

        expect(user.loading.value).toBe(false);
        expect(user.value).toBe('User-2');
    });

    it('should handle errors', async () => {
        const userId = signal(1);
        const fetcher = vi.fn(() => Promise.reject(new Error('Network error')));

        const user = $v.createResource(userId, fetcher);

        await new Promise(r => setTimeout(r, 10));

        expect(user.loading.value).toBe(false);
        expect(user.error.value).toBeInstanceOf(Error);
        expect(user.error.value.message).toBe('Network error');
    });

    it('should allow optimistic updates', async () => {
        const userId = signal(1);
        const fetcher = vi.fn(() => Promise.resolve('Real Data'));

        const user = $v.createResource(userId, fetcher);

        // Ручная мутация (optimistic)
        user.value = 'Optimistic Data';
        expect(user.value).toBe('Optimistic Data');

        await new Promise(r => setTimeout(r, 10));
        // После разрешения промиса, данные заменятся на реальные
        expect(user.value).toBe('Real Data');
    });
});