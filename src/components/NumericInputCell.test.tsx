import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumericInputCell } from './NumericInputCell';

// These tests guard against a real wrong-money risk: the previous controlled
// `value={line.rate}` snapped the rate to $0 the moment the user cleared the
// field to retype it. NumericInputCell holds an editable string buffer so the
// committed numeric value only changes on a parseable input.

describe('NumericInputCell', () => {
  it('renders the initial value as a string', () => {
    render(<NumericInputCell value={75} onCommit={() => {}} />);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('75');
  });

  it('commits a parseable new value', () => {
    const onCommit = jest.fn();
    render(<NumericInputCell value={0} onCommit={onCommit} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '75' } });
    expect(onCommit).toHaveBeenLastCalledWith(75);
  });

  it('does NOT commit 0 when the field is cleared mid-edit', () => {
    const onCommit = jest.fn();
    render(<NumericInputCell value={75} onCommit={onCommit} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });

    // Buffer is allowed to be empty so the user can retype, but no commit fires.
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('lets the user clear and retype without losing the committed value', () => {
    const onCommit = jest.fn();
    render(<NumericInputCell value={75} onCommit={onCommit} />);

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.change(input, { target: { value: '85' } });

    // Each parseable keystroke commits; 0 is never committed because the empty
    // intermediate state didn't trigger a commit.
    expect(onCommit).not.toHaveBeenCalledWith(0);
    expect(onCommit).toHaveBeenLastCalledWith(85);
  });

  it('does not commit values below `min`', () => {
    const onCommit = jest.fn();
    render(<NumericInputCell value={10} min={0} onCommit={onCommit} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-5' } });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('restores the displayed value on blur if the field was left empty', () => {
    const onCommit = jest.fn();
    render(<NumericInputCell value={75} onCommit={onCommit} />);

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');

    fireEvent.blur(input);
    expect(input.value).toBe('75');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('reflects external value changes (e.g. QBO item pre-filling a rate)', () => {
    const { rerender } = render(<NumericInputCell value={0} onCommit={() => {}} />);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('0');

    rerender(<NumericInputCell value={12.5} onCommit={() => {}} />);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('12.5');
  });
});
