// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../../src/renderer/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaults = {
    title: 'Confirmar envio',
    message: 'Deseja enviar 5 boletos?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  // 1
  it('renderiza título e mensagem', () => {
    render(<ConfirmDialog {...defaults} />);
    expect(screen.getByText('Confirmar envio')).toBeInTheDocument();
    expect(screen.getByText('Deseja enviar 5 boletos?')).toBeInTheDocument();
  });

  // 2
  it('sempre mostra texto sobre cópias removidas', () => {
    render(<ConfirmDialog {...defaults} />);
    expect(
      screen.getByText(/cópias na pasta de boletos serão removidas/),
    ).toBeInTheDocument();
  });

  // 3
  it('mostra aviso de originais quando deleteOriginalFiles=true', () => {
    render(<ConfirmDialog {...defaults} deleteOriginalFiles={true} />);
    expect(
      screen.getByText(/originais também/),
    ).toBeInTheDocument();
  });

  // 4
  it('não mostra aviso de originais quando false', () => {
    render(<ConfirmDialog {...defaults} deleteOriginalFiles={false} />);
    expect(
      screen.queryByText(/originais também/),
    ).not.toBeInTheDocument();
  });

  // 5
  it('não mostra aviso quando prop omitida', () => {
    render(<ConfirmDialog {...defaults} />);
    expect(
      screen.queryByText(/originais também/),
    ).not.toBeInTheDocument();
  });

  // 6
  it('onConfirm chamado ao clicar confirmar', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaults} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Envio/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // 7
  it('onCancel chamado ao clicar cancelar', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaults} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // 8
  it('Escape chama onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaults} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
