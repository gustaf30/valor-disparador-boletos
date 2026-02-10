import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { GroupStatus, FileMapping } from '../shared/types';

export class FileHandler {
  private boletosFolder: string;
  private watchers: fs.FSWatcher[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (() => void) | null = null;

  constructor(boletosFolder: string) {
    this.boletosFolder = boletosFolder;
    this.ensureFolderExists();
  }

  setBoletosFolder(folder: string): void {
    this.boletosFolder = folder;
    this.ensureFolderExists();
  }

  private ensureFolderExists(): void {
    if (!fs.existsSync(this.boletosFolder)) {
      fs.mkdirSync(this.boletosFolder, { recursive: true });
    }
  }

  async scanBoletos(groupMappings: Record<string, string>): Promise<GroupStatus[]> {
    const groups: GroupStatus[] = [];

    try {
      const entries = await fsp.readdir(this.boletosFolder, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const groupName = entry.name;
          const groupPath = path.join(this.boletosFolder, groupName);
          const files = await this.getPdfFiles(groupPath);

          groups.push({
            name: groupName,
            whatsappId: groupMappings[groupName] || null,
            fileCount: files.length,
            files: files,
          });
        }
      }
    } catch (error) {
      console.error('Error scanning boletos folder:', error);
    }

    return groups;
  }

  private async getPdfFiles(folderPath: string): Promise<string[]> {
    try {
      const files = await fsp.readdir(folderPath);
      return files
        .filter((file) => file.toLowerCase().endsWith('.pdf'))
        .map((file) => path.join(folderPath, file));
    } catch (error) {
      console.error(`Error reading folder ${folderPath}:`, error);
      return [];
    }
  }

  async addFiles(groupName: string, filePaths: string[]): Promise<{ mappings: FileMapping[]; errors: string[] }> {
    const groupFolder = path.join(this.boletosFolder, groupName);

    try {
      await fsp.mkdir(groupFolder, { recursive: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { mappings: [], errors: [`Não foi possível criar a pasta "${groupName}": ${msg}`] };
    }

    const mappings: FileMapping[] = [];
    const errors: string[] = [];

    for (const sourcePath of filePaths) {
      try {
        const fileName = path.basename(sourcePath);
        const destPath = path.join(groupFolder, fileName);

        let finalPath = destPath;
        let counter = 1;
        while (await this.fileExists(finalPath)) {
          const ext = path.extname(fileName);
          const baseName = path.basename(fileName, ext);
          finalPath = path.join(groupFolder, `${baseName}_${counter}${ext}`);
          counter++;
        }

        await fsp.copyFile(sourcePath, finalPath);
        mappings.push({ copied: finalPath, original: sourcePath });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Error copying file ${sourcePath}:`, error);
        errors.push(`${path.basename(sourcePath)}: ${msg}`);
      }
    }

    return { mappings, errors };
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteOriginalFile(filePath: string): Promise<boolean> {
    // Validação: deve ser caminho absoluto para evitar travessia relativa
    if (!path.isAbsolute(filePath)) {
      console.error(`Refusing to delete non-absolute path: ${filePath}`);
      return false;
    }

    try {
      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) {
        console.error(`Refusing to delete non-file: ${filePath}`);
        return false;
      }
      console.log(`Deleting original file: ${filePath}`);
      await fsp.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      console.error(`Error deleting original file ${filePath}:`, error);
      return false;
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    // Validar que o arquivo está dentro da pasta de boletos (segurança)
    const resolved = path.resolve(filePath);
    const folderPrefix = path.resolve(this.boletosFolder) + path.sep;
    if (!resolved.startsWith(folderPrefix)) {
      console.error(`Refusing to delete file outside boletos folder: ${filePath}`);
      return false;
    }

    try {
      await fsp.unlink(resolved);
      return true;
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      return false;
    }
  }

  startWatching(callback: () => void): void {
    this.stopWatching();
    this.onChange = callback;

    try {
      const rootWatcher = fs.watch(this.boletosFolder, { persistent: false }, () => {
        this.debouncedNotify();
        this.debouncedRefreshSubWatchers();
      });
      this.watchers.push(rootWatcher);
    } catch (err) {
      console.error('Failed to watch boletos folder:', err);
    }

    this.refreshSubWatchers();
  }

  private async refreshSubWatchers(): Promise<void> {
    while (this.watchers.length > 1) {
      const w = this.watchers.pop();
      w?.close();
    }

    try {
      const entries = await fsp.readdir(this.boletosFolder, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const subPath = path.join(this.boletosFolder, entry.name);
            const watcher = fs.watch(subPath, { persistent: false }, () => {
              this.debouncedNotify();
            });
            this.watchers.push(watcher);
          } catch (err) {
            console.error(`Failed to watch subdirectory ${entry.name}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to watch subdirectories:', err);
    }
  }

  private debouncedRefreshSubWatchers(): void {
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
    }
    this.refreshDebounceTimer = setTimeout(() => {
      this.refreshDebounceTimer = null;
      this.refreshSubWatchers();
    }, 2000);
  }

  private debouncedNotify(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.onChange?.();
    }, 1000);
  }

  stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
      this.refreshDebounceTimer = null;
    }
    this.onChange = null;
  }

}
