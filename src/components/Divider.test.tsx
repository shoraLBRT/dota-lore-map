import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Divider } from './Divider';

describe('Divider', () => {
  it('рисуется как разделитель hr', () => {
    render(<Divider className="extra" />);
    expect(screen.getByRole('separator')).toHaveClass('extra');
  });
});
