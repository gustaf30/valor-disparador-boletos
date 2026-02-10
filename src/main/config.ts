import fs from 'fs';
import path from 'path';
import { Config } from '../shared/types';

export function getDefaultConfig(documentsPath: string): Config {
  return {
    boletosFolder: path.join(documentsPath, 'Valor Boletos'),
    groups: {},
    messageSingular: 'Segue boleto em anexo.',
    messagePlural: 'Seguem os boletos em anexo.',
    delayBetweenSends: 2000,
    deleteOriginalFiles: false,
    defaultSourceFolder: '',
  };
}

export function loadConfig(configPath: string, documentsPath: string): Config {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const loaded = JSON.parse(data);

      // Migração: message -> messageSingular/messagePlural
      if (loaded.message && !loaded.messageSingular) {
        loaded.messageSingular = loaded.message;
        loaded.messagePlural = loaded.message;
        delete loaded.message;
      }

      return { ...getDefaultConfig(documentsPath), ...loaded };
    }
  } catch (error) {
    console.error('Erro ao carregar config:', error);
  }
  return getDefaultConfig(documentsPath);
}

export function saveConfig(configPath: string, config: Config): void {
  try {
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Erro ao salvar config:', error);
  }
}
