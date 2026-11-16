# Entre dias

Diário de humor em **PWA**, com landing page pública de instalação, avaliações por horário, nível neutro e dashboard. Cada pessoa usa o próprio banco **IndexedDB**, no seu dispositivo. O servidor distribui o aplicativo e não recebe as novas avaliações ou resenhas.

## Usar no celular

1. Acesse o endereço HTTPS da instalação.
2. Toque em **Instalar o app**. No Android/Chrome, confirme o convite ou use o menu **Instalar app / Adicionar à tela inicial**.
3. No iPhone, abra no Safari e use **Compartilhar → Adicionar à Tela de Início**, com **Abrir como App** quando disponível.
4. Abra o app pelo ícone da tela inicial. Depois da primeira preparação, ele funciona offline.

A notificação automática não é garantida: o navegador decide se e quando mostra o convite. A landing page mantém um botão e instruções para as alternativas. O formulário do diário é liberado no modo instalado. Em localhost há uma exceção para desenvolvimento.

## O que está incluído

- Calendário semanal e várias avaliações no mesmo dia, mesmo quando os horários coincidem.
- Doze humores, cada um com Neutro (não estou sentindo), I (leve), II (moderada) e III (intensa).
- Horário ajustável e resenha independente por avaliação.
- Dashboard por período, com frequência, distribuição de intensidade, evolução por horário e histórico.
- Exportação CSV, backup JSON e restauração local sem sobrescrever os registros existentes.
- Botão Compartilhar no diário, dashboard e backups, com WhatsApp, Telegram, Facebook, e-mail, cópia de link e compartilhamento nativo quando disponível. Compartilha somente o link público de instalação.
- Manifesto instalável, ícones Android/iOS, service worker e shell completo para uso offline.

## Dados e privacidade

Os registros ficam no IndexedDB `entre-dias-local`, armazenamento `assessments`. Não há conta, senha compartilhada, analytics ou sincronização automática. A instalação não usa fontes externas. O navegador ainda se conecta ao site para baixar os arquivos do aplicativo e verificar atualizações, sem enviar os registros.

Cada origem (domínio/protocolo/porta), perfil de navegador e, em algumas plataformas, instalação pode ter um banco separado. O app não criptografa o IndexedDB. Em dispositivos compartilhados, use o bloqueio de tela.

Limpar os dados do site, remover o app, trocar de celular ou a remoção de armazenamento pelo navegador pode apagar os registros. Em **Dados e backup**, baixe regularmente um backup JSON e guarde-o em um local privado. A solicitação de armazenamento persistente pode ser negada pelo navegador. O CSV é para análise; não serve para restaurar o diário.

A restauração valida todo o arquivo antes de gravar e usa uma transação. IDs já existentes são mantidos, sem substituir suas versões atuais. Para levar os dados a outro celular, instale o app e restaure o JSON nele.

## Desenvolvimento

Requer Node.js 22.13+; use Node.js 24 na Hostinger.

```sh
npm ci
npm run build
npm start
```

Abra http://localhost:3000 para a landing page e http://localhost:3000/app para testar o diário. O `iniciar.bat` também inicia o servidor e abre o navegador. O modo de desenvolvimento local permite testar sem instalar.

```sh
npm test
```

A dependência `fake-indexeddb` é apenas de testes. O aplicativo publicado usa as APIs nativas do navegador.

## Publicar e atualizar

Veja [HOSTINGER.md](HOSTINGER.md). Esta versão pública não exige `APP_PASSWORD` ou `DATA_DIR` para iniciar. Ela não grava novos registros no SQLite do servidor.

Ao alterar os arquivos do app, altere o identificador `CACHE` em `public/sw.js`. O novo shell assume quando as janelas da versão anterior forem fechadas. Não é necessário apagar o IndexedDB nem remover o aplicativo para atualizar.

## Preservar os registros da versão SQLite

Os arquivos anteriores da pasta `data/` são preservados e continuam fora do GitHub. Para convertê-los em um backup restaurável na PWA:

```sh
npm run backup:anterior
```

O comando cria `data/backup-para-pwa.json`. Transfira esse arquivo privadamente para o celular, instale o app e restaure-o em **Dados e backup**. Horários desconhecidos de registros antigos continuam identificados como não informados.

Para exportação de uma instalação antiga na Hostinger, veja o procedimento opcional e autenticado no guia. Essa rota é desabilitada por padrão e nunca é chamada nem armazenada em cache pela PWA.

O diário é uma ferramenta de registro e autoconhecimento; não realiza diagnósticos.
