import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PanelFrame } from './PanelFrame';

describe('PanelFrame', () => {
  it('рисует подписанную боковую область с содержимым', () => {
    render(
      <PanelFrame label="Icewrack">
        <h2>Icewrack</h2>
      </PanelFrame>,
    );
    const aside = screen.getByRole('complementary', { name: 'Icewrack' });
    expect(aside).toContainElement(screen.getByRole('heading', { name: 'Icewrack' }));
  });
});
