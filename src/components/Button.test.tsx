import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('по умолчанию primary и type="button", вариант ghost меняет класс, клик вызывает обработчик', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Начать</Button>);
    const btn = screen.getByRole('button', { name: 'Начать' });
    expect(btn).toHaveAttribute('type', 'button');
    const primaryClass = btn.className;
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(<Button variant="ghost">Начать</Button>);
    expect(screen.getByRole('button', { name: 'Начать' }).className).not.toBe(primaryClass);
  });
});
