// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Settings } from '../../src/renderer/components/Settings';
import type { Config } from '../../src/shared/types';

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    boletosFolder: 'C:\\boletos',
    groups: {},
    messageSingular: 'Segue boleto.',
    messagePlural: 'Seguem boletos.',
    delayBetweenSends: 2000,
    deleteOriginalFiles: false,
    ...overrides,
  };
}

describe('Settings', () => {
  const defaults = {
    config: makeConfig(),
    onSave: vi.fn(),
    onClose: vi.fn(),
  };

  // 1
  it('renderiza com valores do config preenchidos', () => {
    render(<Settings {...defaults} />);
    const singular = screen.getByLabelText(/1 boleto/i) as HTMLInputElement;
    const plural = screen.getByLabelText(/2\+ boletos/i) as HTMLInputElement;
    expect(singular.value).toBe('Segue boleto.');
    expect(plural.value).toBe('Seguem boletos.');
  });

  // 2
  it('salvar desabilitado com messageSingular vazia', () => {
    render(
      <Settings {...defaults} config={makeConfig({ messageSingular: '' })} />,
    );
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  // 3
  it('salvar desabilitado com messagePlural vazia', () => {
    render(
      <Settings {...defaults} config={makeConfig({ messagePlural: '' })} />,
    );
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  // 4
  it('salvar habilitado quando ambas preenchidas', () => {
    render(<Settings {...defaults} />);
    expect(screen.getByRole('button', { name: 'Salvar' })).not.toBeDisabled();
  });

  // 5
  it('onSave recebe valores trimados', () => {
    const onSave = vi.fn();
    render(
      <Settings
        {...defaults}
        onSave={onSave}
        config={makeConfig({
          messageSingular: '  espaço  ',
          messagePlural: '  espaço  ',
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        messageSingular: 'espaço',
        messagePlural: 'espaço',
      }),
    );
  });

  // 6
  it('checkbox deleteOriginalFiles reflete no onSave', () => {
    const onSave = vi.fn();
    render(<Settings {...defaults} onSave={onSave} />);
    const checkbox = screen.getByLabelText(/excluir arquivos originais/i);
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ deleteOriginalFiles: true }),
    );
  });

  // 7
  it('cancelar chama onClose', () => {
    const onClose = vi.fn();
    render(<Settings {...defaults} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 8
  it('Escape chama onClose', () => {
    const onClose = vi.fn();
    render(<Settings {...defaults} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
