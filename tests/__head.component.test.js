import { describe, it, expect, beforeEach } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.components.js';

describe('HeadManager Plugin', () => {
    let head;

    beforeEach(() => {
        // Очищаем head перед каждым тестом
        document.head.innerHTML = '';
        document.title = '';

        // Получаем свежий инстанс (синглтон)
        head = $v.head();
    });

    it('should update document.title', () => {
        head.title = 'My Test Page';
        expect(document.title).toBe('My Test Page');
    });

    it('should create meta description tag', () => {
        head.description = 'Test description';

        const meta = document.querySelector('meta[name="description"]');
        expect(meta).not.toBeNull();
        expect(meta.getAttribute('content')).toBe('Test description');
    });

    it('should update existing meta tag', () => {
        head.description = 'First';
        head.description = 'Second';

        const metas = document.querySelectorAll('meta[name="description"]');
        expect(metas.length).toBe(1);
        expect(metas[0].getAttribute('content')).toBe('Second');
    });

    it('should remove meta tag if set to empty', () => {
        head.keywords = 'test, vitest';
        expect(document.querySelector('meta[name="keywords"]')).not.toBeNull();

        head.keywords = '';
        expect(document.querySelector('meta[name="keywords"]')).toBeNull();
    });
});