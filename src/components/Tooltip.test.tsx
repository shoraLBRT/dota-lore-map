import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('связывает элемент с подсказкой через aria-describedby', () => {
    render(
      <Tooltip content="Подсказка">
        <button type="button">Цель</button>
      </Tooltip>,
    );
    const tip = screen.getByRole('tooltip');
    expect(screen.getByRole('button', { name: 'Цель' })).toHaveAttribute('aria-describedby', tip.id);
    expect(screen.getByRole('button', { name: 'Цель' })).toHaveAccessibleDescription('Подсказка');
  });
});
