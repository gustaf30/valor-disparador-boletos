import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDefaultConfig, loadConfig, saveConfig } from '../../src/main/config';
import type { Config } from '../../src/shared/types';

let tmpDir: string;
let configPath: string;
let docsPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'valor-cfg-'));
  configPath = path.join(tmpDir, 'config.json');
  docsPath = path.join(tmpDir, 'docs');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('config', () => {
  // 1
  it('getDefaultConfig retorna shape correta', () => {
    const cfg = getDefaultConfig(docsPath);
    expect(cfg.boletosFolder).toBe(path.join(docsPath, 'Valor Boletos'));
    expect(cfg.groups).toEqual({});
    expect(cfg.messageSingular).toBe('Segue boleto em anexo.');
    expect(cfg.messagePlural).toBe('Seguem os boletos em anexo.');
    expect(cfg.delayBetweenSends).toBe(2000);
    expect(cfg.deleteOriginalFiles).toBe(false);
  });

  // 2
  it('loadConfig retorna defaults se arquivo não existe', () => {
    const cfg = loadConfig(configPath, docsPath);
    expect(cfg).toEqual(getDefaultConfig(docsPath));
  });

  // 3
  it('loadConfig lê JSON existente', () => {
    const custom: Config = {
      boletosFolder: 'C:\\custom',
      groups: { a: 'b' },
      messageSingular: 'msg1',
      messagePlural: 'msg2',
      delayBetweenSends: 5000,
      deleteOriginalFiles: true,
    };
    fs.writeFileSync(configPath, JSON.stringify(custom));

    const cfg = loadConfig(configPath, docsPath);
    expect(cfg.boletosFolder).toBe('C:\\custom');
    expect(cfg.groups).toEqual({ a: 'b' });
    expect(cfg.messageSingular).toBe('msg1');
    expect(cfg.messagePlural).toBe('msg2');
    expect(cfg.delayBetweenSends).toBe(5000);
    expect(cfg.deleteOriginalFiles).toBe(true);
  });

  // 4
  it('loadConfig merge com defaults (campos faltando)', () => {
    fs.writeFileSync(configPath, JSON.stringify({ boletosFolder: 'X:\\test' }));

    const cfg = loadConfig(configPath, docsPath);
    expect(cfg.boletosFolder).toBe('X:\\test');
    expect(cfg.messageSingular).toBe('Segue boleto em anexo.');
    expect(cfg.delayBetweenSends).toBe(2000);
  });

  // 5
  it('loadConfig migra campo message antigo', () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ message: 'Legacy msg' }),
    );

    const cfg = loadConfig(configPath, docsPath);
    expect(cfg.messageSingular).toBe('Legacy msg');
    expect(cfg.messagePlural).toBe('Legacy msg');
  });

  // 6
  it('loadConfig não migra se messageSingular já existe', () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        message: 'Legacy',
        messageSingular: 'Kept',
        messagePlural: 'Also kept',
      }),
    );

    const cfg = loadConfig(configPath, docsPath);
    expect(cfg.messageSingular).toBe('Kept');
    expect(cfg.messagePlural).toBe('Also kept');
  });

  // 7
  it('loadConfig retorna defaults com JSON corrompido', () => {
    fs.writeFileSync(configPath, '{{not json!!');

    const cfg = loadConfig(configPath, docsPath);
    expect(cfg).toEqual(getDefaultConfig(docsPath));
  });

  // 8
  it('saveConfig escreve JSON válido', () => {
    const cfg = getDefaultConfig(docsPath);
    saveConfig(configPath, cfg);

    const raw = fs.readFileSync(configPath, 'utf-8');
    expect(JSON.parse(raw)).toEqual(cfg);
  });

  // 9
  it('saveConfig cria diretório se não existe', () => {
    const nested = path.join(tmpDir, 'deep', 'nested', 'config.json');
    const cfg = getDefaultConfig(docsPath);
    saveConfig(nested, cfg);

    expect(fs.existsSync(nested)).toBe(true);
  });

  // 10
  it('round-trip save→load preserva todos os campos', () => {
    const cfg: Config = {
      boletosFolder: 'Z:\\boletos',
      groups: { x: 'y', z: 'w' },
      messageSingular: 'S',
      messagePlural: 'P',
      delayBetweenSends: 9999,
      deleteOriginalFiles: true,
    };
    saveConfig(configPath, cfg);
    const loaded = loadConfig(configPath, docsPath);
    expect(loaded).toEqual(cfg);
  });
});
