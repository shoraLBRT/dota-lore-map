import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiamondButton } from './DiamondButton';

describe('DiamondButton', () => {
  it('доступное имя — label, видимая подпись не дублирует его, клик работает', () => {
    const onClick = vi.fn();
    render(
      <DiamondButton icon="back" label="‹ Мир" onClick={onClick}>
        Мир
      </DiamondButton>,
    );
    const btn = screen.getByRole('button', { name: '‹ Мир' });
    expect(btn).toHaveTextContent('Мир');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
