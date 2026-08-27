import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Базовое окружение дляSituation 1 (быстрые тесты)
        environment: 'happy-dom',

        globals: true,
        setupFiles: ['./tests/setup.js'],

        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'tests/', '**/*.config.js']
        }
        // Блок browser временно убран, чтобы не вызывать ошибку запуска
    }
});