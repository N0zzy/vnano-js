// tests/setup.js
import { vi } from 'vitest';

// Мокаем matchMedia (часто нужен для UI компонентов)
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Мокаем scrollTo (happy-dom не реализует этот метод)
window.scrollTo = vi.fn();

// Мокаем requestAnimationFrame (если фреймворк использует асинхронный планировщик)
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

console.log('✅ Vitest environment setup completed');