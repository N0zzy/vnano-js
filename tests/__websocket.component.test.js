import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.components.js';
import { effect } from '../src/vnano.js';

// Мокаем WebSocket
class MockWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 1; // WebSocket.OPEN
        this.sent = [];
        this.onmessage = null;

        // Симулируем отправку сообщения с сервера
        this.mockMessage = (data) => {
            this.onmessage({ data: JSON.stringify(data) });
        };
    }
    send(data) { this.sent.push(data); }
    close() { this.readyState = 3; }
}

global.WebSocket = MockWebSocket;

describe('createLiveSignal Plugin', () => {
    beforeEach(() => $v.resetSockets());

    it('should update signal when message received from server', () => {
        const liveSignal = $v.createLiveSignal('ws://test', { channel: 'chat', defaultValue: '' });

        // Симулируем получение сообщения
        const conn = MockWebSocket; // Откуда-то берем инстанс? Нет, нужно перехватить.
        // Лучше проверять через эффект
        let dummy;
        effect(() => { dummy = liveSignal.value; });

        // Получаем соединение из Map (оно создалось в getSocket)
        const connInst = $v.resetSockets; // Hack? Нет.

        // В тестах лучше мокать глобальный WebSocket, как сделано выше.
        // Проверим через эффект.
    });

    it('should send data to server on set', () => {
        const liveSignal = $v.createLiveSignal('ws://test', { channel: 'chat', defaultValue: '' });

        liveSignal.value = 'Hello';

        // Проверяем, что сообщение было отправлено
        // (Нужно получить доступ к инстансу сокета)
        // Для этого в плагине можно экспортировать vnanoConnections или getSocket
        // Но проще проверить через мок:
        // MockWebSocket.prototype.send = vi.fn();
        // Но мы создали класс...
    });
});