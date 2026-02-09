// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SendButton } from '../../src/renderer/components/SendButton';
import type { SendProgress } from '../../src/shared/types';

function makeProgress(overrides: Partial<SendProgress> = {}): SendProgress {
  return {
    total: 10,
    sent: 0,
    currentFile: '',
    currentGroup: '',
    status: 'sending',
    errors: [],
    ...overrides,
  };
}

describe('SendButton', () => {
  const defaults = {
    totalFiles: 5,
    disabled: false,
    isSending: false,
    progress: null,
    onClick: vi.fn(),
  };

  // 1
  it('mostra contagem de boletos', () => {
    render(<SendButton {...defaults} totalFiles={3} />);
    const summary = document.querySelector('.send-summary')!;
    expect(summary.textContent).toContain('3');
    expect(summary.textContent).toContain('boletos para enviar');
  });

  // 2
  it('singular quando totalFiles === 1', () => {
    render(<SendButton {...defaults} totalFiles={1} />);
    const summary = document.querySelector('.send-summary')!;
    expect(summary.textContent).toContain('1');
    expect(summary.textContent).toMatch(/\bboleto\b/);
    expect(summary.textContent).not.toContain('boletos');
  });

  // 3
  it('mostra "ENVIAR TODOS" quando não está enviando', () => {
    render(<SendButton {...defaults} />);
    expect(screen.getByRole('button', { name: /ENVIAR TODOS/ })).toBeInTheDocument();
  });

  // 4
  it('mostra "Enviando..." durante envio', () => {
    render(
      <SendButton
        {...defaults}
        isSending={true}
        progress={makeProgress()}
      />,
    );
    expect(screen.getByRole('button', { name: /Enviando\.\.\./ })).toBeInTheDocument();
  });

  // 5
  it('mostra "Enviado!" quando completo', () => {
    render(
      <SendButton
        {...defaults}
        isSending={true}
        progress={makeProgress({ status: 'complete', sent: 10 })}
      />,
    );
    expect(screen.getByRole('button', { name: /Enviado!/ })).toBeInTheDocument();
  });

  // 6
  it('botão desabilitado quando disabled=true', () => {
    render(<SendButton {...defaults} disabled={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  // 7
  it('NaN guard: total=0 → percentage=0', () => {
    render(
      <SendButton
        {...defaults}
        isSending={true}
        progress={makeProgress({ total: 0, sent: 0 })}
      />,
    );
    const fill = document.querySelector('.progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  // 8
  it('porcentagem correta (3/10 → 30%)', () => {
    render(
      <SendButton
        {...defaults}
        isSending={true}
        progress={makeProgress({ total: 10, sent: 3 })}
      />,
    );
    const fill = document.querySelector('.progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('30%');
  });

  // 9
  it('mostra lista de erros após envio', () => {
    render(
      <SendButton
        {...defaults}
        isSending={false}
        progress={makeProgress({
          status: 'complete',
          errors: [{ file: 'boleto.pdf', group: 'Grupo1', error: 'timeout' }],
        })}
      />,
    );
    const errorList = document.querySelector('.error-list')!;
    expect(errorList.textContent).toContain('boleto.pdf');
    expect(errorList.textContent).toContain('timeout');
  });
});
