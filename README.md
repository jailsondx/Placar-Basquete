# 🏀 Placar de Basquete Eletrônico

Placar eletrônico de basquete completo desenvolvido em Node.js, Express e Electron, com suporte a atalhos de teclado, cronômetros de posse de bola (24s e 14s), sirene e persistência automática de partidas em arquivos JSON.

---

## 🚀 Como Executar

### 1. Modo Desktop (Electron)
Para testar e rodar o aplicativo desktop durante o desenvolvimento:
```bash
npm run electron
```

### 2. Modo Web / Navegador
Para rodar apenas o servidor Express localmente acessando via navegador (`http://localhost:3000`):
```bash
npm start
```

---

## 📦 Como Compilar Executáveis (.exe)

Para gerar executáveis standalone para Windows, utilize os comandos abaixo:

- **Gerar Instalador e Versão Portátil (ambos):**
  ```bash
  npm run dist
  ```
- **Apenas Versão Portátil (executável standalone sem instalação):**
  ```bash
  npm run dist:portable
  ```
- **Apenas Instalador (NSIS com atalhos na Área de Trabalho):**
  ```bash
  npm run dist:nsis
  ```

Os arquivos compilados são gerados na pasta `dist/`:
- `Placar de Basquete-Portable-1.0.0.exe`
- `Placar de Basquete Setup 1.0.0.exe`

---

## ⌨️ Recursos e Atalhos
- **F11**: Alternar tela cheia (ideal para transmissão em telões, TVs ou projetores).
- **Ctrl + R**: Recarregar placar.
- **Ctrl + Shift + I**: Inspecionar console e ferramentas de desenvolvedor.
- **Persistência de Dados**: Partidas e jogos em andamento são salvos automaticamente no diretório de dados persistente do aplicativo.
