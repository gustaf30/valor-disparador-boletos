import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { GroupStatus, FileMapping } from '../shared/types';

export class FileHandler {
  private boletosFolder: string;

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
      const entries = fs.readdirSync(this.boletosFolder, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const groupName = entry.name;
          const groupPath = path.join(this.boletosFolder, groupName);
          const files = this.getPdfFiles(groupPath);

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

  private getPdfFiles(folderPath: string): string[] {
    try {
      const files = fs.readdirSync(folderPath);
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

    if (!fs.existsSync(groupFolder)) {
      fs.mkdirSync(groupFolder, { recursive: true });
    }

    const mappings: FileMapping[] = [];
    const errors: string[] = [];

    for (const sourcePath of filePaths) {
      try {
        const fileName = path.basename(sourcePath);
        const destPath = path.join(groupFolder, fileName);

        // Handle duplicate names
        let finalPath = destPath;
        let counter = 1;
        while (fs.existsSync(finalPath)) {
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

  async deleteOriginalFile(filePath: string): Promise<boolean> {
    try {
      await fsp.access(filePath);
      await fsp.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      console.error(`Error deleting original file ${filePath}:`, error);
      return false;
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    // Validate that the file is inside the boletos folder
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

  createGroupFolder(groupName: string): string {
    const groupFolder = path.join(this.boletosFolder, groupName);
    if (!fs.existsSync(groupFolder)) {
      fs.mkdirSync(groupFolder, { recursive: true });
    }
    return groupFolder;
  }

  getBoletosFolder(): string {
    return this.boletosFolder;
  }
}
