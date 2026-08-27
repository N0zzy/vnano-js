import { describe, it, expect } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.components.js';

describe('FormManager Built-in Features', () => {
    it('should initialize from unified config', () => {
        const form = new $v.FormManager({
            email: { value: '', required: true, email: true },
            pass: { value: '123', minLength: 6 }
        });

        expect(form.values.email.value).toBe('');
        expect(form.values.pass.value).toBe('123');
        expect(form.schema.email.required).toBe(true);
    });

    it('should sanitize XSS input', () => {
        const form = new $v.FormManager({ name: { value: '' } });
        const props = form.field('name');

        props.oninput({ target: { value: '<script>alert(1)</script>  Hello  ' } });
        expect(form.values.name.value).toBe('Hello');
    });

    it('should validate using built-in rules (English defaults)', () => {
        const form = new $v.FormManager({
            email: { value: '', required: true, email: true },
            pass: { value: '', required: true, minLength: 6 }
        });

        // Триггерим пустой ввод (required)
        form.field('email').oninput({ target: { value: '' } });
        expect(form.errors.email.value).toBe('This field is required');

        // Триггерим невалидный email
        form.field('email').oninput({ target: { value: 'test' } });
        expect(form.errors.email.value).toBe('Invalid email format');

        // Триггерим короткий пароль
        form.field('pass').oninput({ target: { value: '123' } });
        expect(form.errors.pass.value).toBe('Minimum 6 characters');
    });

    it('should check isValid() for entire form', () => {
        const form = new $v.FormManager({
            email: { value: '', required: true, email: true },
            pass: { value: '', required: true, minLength: 6 }
        });

        expect(form.isValid()).toBe(false);

        form.values.email.value = 'test@test.com';
        form.values.pass.value = '123456';

        expect(form.isValid()).toBe(true);
    });

    it('should support chaining and string error override', () => {
        const form = new $v.FormManager({
            email: { value: '', required: true, email: true }
        }).withErrors({
            email: "Это не электронная почта"
        });

        expect(form instanceof $v.FormManager).toBe(true);
        form.field('email').oninput({ target: { value: '' } });
        expect(form.errors.email.value).toBe('Это не электронная почта');

        form.field('email').oninput({ target: { value: 'test' } });
        expect(form.errors.email.value).toBe('Это не электронная почта');
    });

    it('should support object error override for specific rules', () => {
        const form = new $v.FormManager({
            email: { value: '', required: true, email: true }
        }).withErrors({
            email: {
                required: "Введите email!",
                email: "Неверный формат почты"
            }
        });

        form.field('email').oninput({ target: { value: '' } });
        expect(form.errors.email.value).toBe('Введите email!');

        form.field('email').oninput({ target: { value: 'test' } });
        expect(form.errors.email.value).toBe('Неверный формат почты');
    });

    it('should fall back to default English messages if custom not provided', () => {
        const form = new $v.FormManager({
            email: { value: '', required: true, email: true },
            pass: { value: '', required: true, minLength: 6 }
        }).withErrors({
            email: { required: "Введите email!" }
        });

        // Для email должна сработать дефолтная ошибка email-формата
        form.field('email').oninput({ target: { value: 'test' } });
        expect(form.errors.email.value).toBe('Invalid email format');

        // Для pass должна сработать дефолтная ошибка minLength
        form.field('pass').oninput({ target: { value: '123' } });
        expect(form.errors.pass.value).toBe('Minimum 6 characters');
    });
});