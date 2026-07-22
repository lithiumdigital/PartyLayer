// @vitest-environment jsdom
/**
 * SynchronizerSwitcher tests (@testing-library/react): a presentational switcher. It
 * renders consumer-provided options and reports the selection through `onSwitch`; it
 * does not perform the switch. Ported from the Vue reference (Vue's `switch` event maps
 * to the `onSwitch` callback prop). Covers: renders the options, reflects the current
 * networkId, calls `onSwitch` with the selected id on change, and renders nothing when
 * there are no options. Rendered within a ThemeProvider so the theme tokens resolve.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SynchronizerSwitcher, type SynchronizerOption } from './synchronizer-switcher';
import { ThemeProvider } from './theme';

const options: SynchronizerOption[] = [
  { networkId: 'canton:da-devnet', label: 'DevNet' },
  { networkId: 'canton:da-testnet', label: 'TestNet' },
  { networkId: 'canton:da-mainnet' }, // label falls back to networkId
];

function renderSwitcher(ui: React.ReactElement) {
  return render(<ThemeProvider theme="light">{ui}</ThemeProvider>);
}

describe('SynchronizerSwitcher', () => {
  it('renders the provided options (label falls back to networkId)', () => {
    const { container } = renderSwitcher(<SynchronizerSwitcher networkId="canton:da-devnet" options={options} />);
    const opts = container.querySelectorAll('option');
    expect(opts).toHaveLength(3);
    expect(opts[0].textContent).toBe('DevNet');
    expect(opts[2].textContent).toBe('canton:da-mainnet'); // fallback
    expect(container.querySelector('select[aria-label="Synchronizer"]')).not.toBeNull();
  });

  it('reflects the current networkId as the selected option', () => {
    const { container } = renderSwitcher(<SynchronizerSwitcher networkId="canton:da-testnet" options={options} />);
    expect((container.querySelector('select') as HTMLSelectElement).value).toBe('canton:da-testnet');
  });

  it('calls onSwitch with the selected networkId on change (does not switch itself)', () => {
    const onSwitch = vi.fn();
    const { container } = renderSwitcher(
      <SynchronizerSwitcher networkId="canton:da-devnet" options={options} onSwitch={onSwitch} />,
    );
    fireEvent.change(container.querySelector('select') as HTMLSelectElement, {
      target: { value: 'canton:da-testnet' },
    });
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onSwitch).toHaveBeenCalledWith('canton:da-testnet');
  });

  it('renders nothing when there are no options', () => {
    expect(renderSwitcher(<SynchronizerSwitcher options={[]} />).container.querySelector('select')).toBeNull();
    expect(renderSwitcher(<SynchronizerSwitcher />).container.textContent).toBe('');
  });
});
