# Valor Boletos - Envio Automatico via WhatsApp

Aplicativo desktop para Windows que automatiza o envio de boletos em PDF para grupos do WhatsApp.

## Stack Tecnologico

- **Electron 28** - Framework desktop multiplataforma
- **React 18** - Interface do usuario
- **TypeScript** - Tipagem estatica
- **Vite** - Bundler e dev server
- **whatsapp-web.js** - Integracao com WhatsApp Web
- **Lucide React** - Icones da interface

## Instalacao

```bash
npm install
npm run build
npm run start
```

## Como Usar

### 1. Conectar ao WhatsApp
- Ao abrir o app, sera exibido um QR Code
- Abra o WhatsApp no celular > Menu (tres pontos) > **Aparelhos conectados** > **Conectar um aparelho**
- Escaneie o QR Code com o celular
- A sessao ficara salva para proximas vezes

### 2. Criar Pastas para os Grupos
A pasta de boletos fica em:
```
C:\Users\[SEU_USUARIO]\Documents\Valor Boletos\
```

Crie uma subpasta para cada grupo do WhatsApp:
```
Valor Boletos/
├── VALOR/           <- nome da pasta = identificador do grupo
│   └── boleto.pdf
├── CLIENTE_A/
│   └── fatura.pdf
└── CLIENTE_B/
    └── cobranca.pdf
```

### 3. Vincular Pastas aos Grupos
- No app, clique em **"Vincular"** ao lado de cada pasta
- Selecione o grupo do WhatsApp correspondente
- Esta configuracao e salva automaticamente

### 4. Adicionar Boletos
**Opcao 1**: Coloque os PDFs diretamente nas pastas via Explorer
**Opcao 2**: Clique em **"+ Adicionar"** no app e selecione os arquivos
**Opcao 3**: Arraste e solte PDFs na area do grupo

### 5. Enviar
- Clique em **"ENVIAR TODOS"**
- Confirme o envio no dialogo
- Os boletos serao enviados com a mensagem configurada
- Apos envio bem-sucedido, os arquivos podem ser excluidos automaticamente (configuravel)

## Comandos

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Modo desenvolvimento com hot reload |
| `npm run start` | Executar versao compilada |
| `npm run build` | Compilar TypeScript (main + renderer) |
| `npm run build:win64` | Gerar instalador Windows 64-bit |
| `npm run build:win32` | Gerar instalador Windows 32-bit |
| `npm run build:all` | Gerar instaladores para ambas arquiteturas |

## Configuracoes

O arquivo de configuracao e salvo automaticamente em:
```
%APPDATA%\valor-boletos\config.json
```

Configuracoes disponiveis:
```json
{
  "boletosFolder": "C:\\Users\\...\\Documents\\Valor Boletos",
  "messageSingular": "Segue boleto em anexo.",
  "messagePlural": "Seguem os boletos em anexo.",
  "deleteOriginalFiles": false,
  "groupMappings": {}
}
```

| Campo | Descricao |
|-------|-----------|
| `boletosFolder` | Pasta raiz onde ficam os boletos |
| `messageSingular` | Mensagem enviada com 1 boleto |
| `messagePlural` | Mensagem enviada com 2+ boletos |
| `deleteOriginalFiles` | Excluir arquivos apos envio bem-sucedido |
| `groupMappings` | Mapeamento pasta -> grupo do WhatsApp |

## Solucao de Problemas

**Tela branca**: Feche o app e execute `npm run build` novamente

**QR Code nao aparece**: Aguarde alguns segundos, o WhatsApp pode demorar para conectar

**Grupo nao encontrado**: Certifique-se de que voce e membro do grupo no WhatsApp

**Boletos nao enviados**: Verifique se os arquivos sao PDFs validos e se o grupo esta vinculado corretamente

## Estrutura do Projeto

```
valor/
├── src/
│   ├── main/                  # Processo principal (Electron + Node.js)
│   │   ├── index.ts           # Entry point do Electron
│   │   ├── whatsapp.ts        # Cliente WhatsApp Web
│   │   ├── file-handler.ts    # Gerenciamento de arquivos
│   │   └── preload.ts         # Bridge IPC seguro
│   ├── renderer/              # Interface (React)
│   │   ├── App.tsx            # Componente principal
│   │   ├── index.tsx          # Entry point do React
│   │   ├── styles.css         # Estilos globais
│   │   ├── components/        # Componentes React
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── GroupList.tsx
│   │   │   ├── GroupMapper.tsx
│   │   │   ├── QRCode.tsx
│   │   │   ├── SendButton.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Status.tsx
│   │   └── public/            # Assets estaticos
│   │       └── logo.jpg
│   └── shared/                # Tipos compartilhados
│       └── types.ts           # Interfaces TypeScript e canais IPC
├── assets/                    # Icone do instalador
├── electron-builder.json      # Config do instalador Windows
├── vite.config.ts             # Config do bundler (renderer)
├── tsconfig.json              # Config TypeScript (renderer)
├── tsconfig.main.json         # Config TypeScript (main)
└── package.json
```

## Arquitetura

O app segue o modelo multi-processo do Electron:

- **Main Process**: Node.js executando WhatsApp client e operacoes de arquivo
- **Renderer Process**: React renderizando a interface, isolado via sandbox
- **Preload Script**: Bridge seguro expondo API via `contextBridge`

Comunicacao via IPC definida em `src/shared/types.ts`.

## Requisitos

- Windows 7 ou superior (32-bit ou 64-bit)
- Node.js 18+ (apenas para desenvolvimento)
- WhatsApp instalado no celular
