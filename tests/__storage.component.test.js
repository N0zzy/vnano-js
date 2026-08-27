import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.components.js';

describe('PersistentSignal (Storage)', () => {
    beforeEach(() => {
        // Очищаем localStorage перед каждым тестом
        localStorage.clear();
    });

    it('should initialize with default value if storage is empty', () => {
        const theme = $v.createLocalSignal('theme', 'light');
        expect(theme.value).toBe('light');
    });

    it('should save to localStorage when value changes', () => {
        const theme = $v.createLocalSignal('theme', 'light');
        theme.value = 'dark';

        expect(localStorage.getItem('theme')).toBe(JSON.stringify('dark'));
    });

    it('should load from localStorage on initialization', () => {
        localStorage.setItem('user', JSON.stringify({ name: 'Ivan' }));
        const user = $v.createLocalSignal('user', {});

        expect(user.value.name).toBe('Ivan');
    });

    it('should remove from localStorage if set to null', () => {
        const token = $v.createLocalSignal('token', 'abc-123');
        expect(localStorage.getItem('token')).not.toBeNull();

        token.value = null;
        expect(localStorage.getItem('token')).toBeNull();
    });

    it('should clear key and reset signal via clear()', () => {
        const cart = $v.createLocalSignal('cart', ['item1']);
        cart.clear();

        expect(localStorage.getItem('cart')).toBeNull();
        expect(cart.value).toBeUndefined();
    });
});