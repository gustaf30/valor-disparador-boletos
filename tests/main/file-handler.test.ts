import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileHandler } from '../../src/main/file-handler';

let tmpDir: string;
let boletosDir: string;
let handler: FileHandler;

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'valor-test-'));
}

beforeEach(() => {
  tmpDir = makeTmpDir();
  boletosDir = path.join(tmpDir, 'boletos');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('FileHandler', () => {
  // 1
  it('constructor cria pasta boletos', () => {
    handler = new FileHandler(boletosDir);
    expect(fs.existsSync(boletosDir)).toBe(true);
  });

  // 2
  it('constructor idempotente', () => {
    fs.mkdirSync(boletosDir, { recursive: true });
    expect(() => new FileHandler(boletosDir)).not.toThrow();
  });

  // 3
  it('setBoletosFolder muda pasta e cria', () => {
    handler = new FileHandler(boletosDir);
    const newDir = path.join(tmpDir, 'new-boletos');
    handler.setBoletosFolder(newDir);
    expect(fs.existsSync(newDir)).toBe(true);
  });

  // 4
  it('scanBoletos retorna [] sem subdiretórios', async () => {
    handler = new FileHandler(boletosDir);
    const result = await handler.scanBoletos({});
    expect(result).toEqual([]);
  });

  // 7
  it('scanBoletos conta PDFs por grupo e ignora .txt', async () => {
    handler = new FileHandler(boletosDir);
    const groupDir = path.join(boletosDir, 'GrupoA');
    fs.mkdirSync(groupDir, { recursive: true });
    fs.writeFileSync(path.join(groupDir, 'boleto1.pdf'), 'fake');
    fs.writeFileSync(path.join(groupDir, 'boleto2.pdf'), 'fake');
    fs.writeFileSync(path.join(groupDir, 'readme.txt'), 'text');

    const result = await handler.scanBoletos({});
    expect(result).toHaveLength(1);
    expect(result[0].fileCount).toBe(2);
  });

  // 8
  it('scanBoletos mapeia whatsappId', async () => {
    handler = new FileHandler(boletosDir);
    fs.mkdirSync(path.join(boletosDir, 'GrupoA'), { recursive: true });
    fs.writeFileSync(path.join(boletosDir, 'GrupoA', 'b.pdf'), 'fake');

    const result = await handler.scanBoletos({ GrupoA: 'waid123' });
    expect(result[0].whatsappId).toBe('waid123');
  });

  // 9
  it('scanBoletos retorna null para grupo não mapeado', async () => {
    handler = new FileHandler(boletosDir);
    fs.mkdirSync(path.join(boletosDir, 'GrupoA'), { recursive: true });
    fs.writeFileSync(path.join(boletosDir, 'GrupoA', 'b.pdf'), 'fake');

    const result = await handler.scanBoletos({});
    expect(result[0].whatsappId).toBeNull();
  });

  // 10
  it('scanBoletos ignora arquivos soltos na raiz', async () => {
    handler = new FileHandler(boletosDir);
    fs.writeFileSync(path.join(boletosDir, 'solto.pdf'), 'fake');
    fs.mkdirSync(path.join(boletosDir, 'GrupoA'), { recursive: true });
    fs.writeFileSync(path.join(boletosDir, 'GrupoA', 'b.pdf'), 'fake');

    const result = await handler.scanBoletos({});
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('GrupoA');
  });

  // 11
  it('addFiles copia arquivo para pasta do grupo', async () => {
    handler = new FileHandler(boletosDir);
    const src = path.join(tmpDir, 'original.pdf');
    fs.writeFileSync(src, 'pdf-content');

    const { mappings, errors } = await handler.addFiles('GrupoA', [src]);
    expect(errors).toHaveLength(0);
    expect(mappings).toHaveLength(1);
    expect(fs.existsSync(mappings[0].copied)).toBe(true);
    expect(mappings[0].original).toBe(src);
  });

  // 12
  it('addFiles renomeia duplicatas (_1, _2)', async () => {
    handler = new FileHandler(boletosDir);
    fs.mkdirSync(path.join(boletosDir, 'GrupoA'), { recursive: true });

    // Place existing file
    fs.writeFileSync(path.join(boletosDir, 'GrupoA', 'dup.pdf'), 'v0');

    const src1 = path.join(tmpDir, 'dup.pdf');
    fs.writeFileSync(src1, 'v1');

    const { mappings: m1 } = await handler.addFiles('GrupoA', [src1]);
    expect(path.basename(m1[0].copied)).toBe('dup_1.pdf');

    // Copy again — should be _2
    const { mappings: m2 } = await handler.addFiles('GrupoA', [src1]);
    expect(path.basename(m2[0].copied)).toBe('dup_2.pdf');
  });

  // 13
  it('addFiles cria pasta do grupo se não existe', async () => {
    handler = new FileHandler(boletosDir);
    const src = path.join(tmpDir, 'file.pdf');
    fs.writeFileSync(src, 'content');

    await handler.addFiles('NovoGrupo', [src]);
    expect(fs.existsSync(path.join(boletosDir, 'NovoGrupo'))).toBe(true);
  });

  // 14
  it('addFiles retorna erro para arquivo inexistente', async () => {
    handler = new FileHandler(boletosDir);
    const { mappings, errors } = await handler.addFiles('GrupoA', [
      path.join(tmpDir, 'naoexiste.pdf'),
    ]);
    expect(errors).toHaveLength(1);
    expect(mappings).toHaveLength(0);
  });

  // 15
  it('addFiles sucesso parcial (mix de válido + inválido)', async () => {
    handler = new FileHandler(boletosDir);
    const valid = path.join(tmpDir, 'good.pdf');
    fs.writeFileSync(valid, 'ok');

    const { mappings, errors } = await handler.addFiles('GrupoA', [
      valid,
      path.join(tmpDir, 'ghost.pdf'),
    ]);
    expect(mappings).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });

  // 16
  it('deleteFile remove arquivo dentro de boletos', async () => {
    handler = new FileHandler(boletosDir);
    fs.mkdirSync(path.join(boletosDir, 'GrupoA'), { recursive: true });
    const target = path.join(boletosDir, 'GrupoA', 'file.pdf');
    fs.writeFileSync(target, 'content');

    const result = await handler.deleteFile(target);
    expect(result).toBe(true);
    expect(fs.existsSync(target)).toBe(false);
  });

  // 17
  it('deleteFile recusa path fora de boletos (path traversal)', async () => {
    handler = new FileHandler(boletosDir);
    const outside = path.join(tmpDir, 'outside.pdf');
    fs.writeFileSync(outside, 'secret');

    const result = await handler.deleteFile(outside);
    expect(result).toBe(false);
    expect(fs.existsSync(outside)).toBe(true);
  });

  // 18
  it('deleteFile retorna false para arquivo inexistente', async () => {
    handler = new FileHandler(boletosDir);
    const result = await handler.deleteFile(path.join(boletosDir, 'nope.pdf'));
    expect(result).toBe(false);
  });

  // 19
  it('deleteOriginalFile remove arquivo em qualquer path', async () => {
    handler = new FileHandler(boletosDir);
    const target = path.join(tmpDir, 'original.pdf');
    fs.writeFileSync(target, 'content');

    const result = await handler.deleteOriginalFile(target);
    expect(result).toBe(true);
    expect(fs.existsSync(target)).toBe(false);
  });

  // 20
  it('deleteOriginalFile retorna false para ENOENT', async () => {
    handler = new FileHandler(boletosDir);
    const result = await handler.deleteOriginalFile(path.join(tmpDir, 'ghost.pdf'));
    expect(result).toBe(false);
  });

  // 21
  it('getPdfFiles é case-insensitive (.PDF, .Pdf, .pdf)', async () => {
    handler = new FileHandler(boletosDir);
    const groupDir = path.join(boletosDir, 'GrupoA');
    fs.mkdirSync(groupDir, { recursive: true });
    fs.writeFileSync(path.join(groupDir, 'a.pdf'), 'x');
    fs.writeFileSync(path.join(groupDir, 'b.PDF'), 'x');
    fs.writeFileSync(path.join(groupDir, 'c.Pdf'), 'x');

    const result = await handler.scanBoletos({});
    expect(result[0].fileCount).toBe(3);
  });
});
