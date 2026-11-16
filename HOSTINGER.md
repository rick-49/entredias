# Publicar a landing page e a PWA

## Configuração

Conecte o repositório `rick-49/entredias`, branch `main`, à aplicação Node.js na Hostinger.

| Campo | Valor |
| --- | --- |
| Node.js | **24.x** |
| Framework | **Other / Outro** |
| Diretório raiz | `./` |
| Instalação | `npm ci` |
| Compilação | `npm run build` |
| Inicialização | `npm start` |
| Arquivo inicial, se solicitado | `server.js` |

Variáveis necessárias:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
```

Se a Hostinger fornecer a porta automaticamente, mantenha a definida pela plataforma. **Não é necessário APP_PASSWORD nem DATA_DIR para usar a PWA pública.** Variáveis antigas de senha não bloqueiam a página inicial nesta versão.

O servidor serve a landing page em `/`, o diário em `/app`, o dashboard em `/dashboard` e os backups em `/dados`. Não configure o projeto como site estático com saída em `public`: os módulos compartilhados são servidos pelo Node.js.

## Implantar esta atualização

Depois de receber a atualização da branch `main`, use **Redeploy / Reimplantar**, caso a implantação automática não esteja habilitada. Mantenha HTTPS ativo no domínio. Abra o site: a landing page deve aparecer sem pedir senha.

No celular:

1. Abra o domínio HTTPS no Chrome (Android) ou Safari (iPhone).
2. Use o botão **Instalar o app** ou siga as instruções da página.
3. Abra pelo ícone da tela inicial uma vez com conexão e aguarde a preparação offline.
4. Teste uma avaliação, feche e reabra o app e confira o registro. Ative o modo avião e confira o diário e o dashboard.

O navegador controla o convite automático de instalação. No iPhone, siga **Compartilhar → Adicionar à Tela de Início**, ativando **Abrir como App** se a opção aparecer. A instalação real em cada modelo precisa ser confirmada no próprio aparelho.

Se houver outra versão aberta, feche todas as janelas do app e abra novamente para ativar o shell atualizado. Não limpe os dados do site como procedimento de atualização, pois isso pode apagar os registros locais.

## O que fica no servidor

A hospedagem distribui HTML, CSS, JavaScript, ícones, manifesto e service worker. Avaliações e resenhas novas ficam no IndexedDB de cada pessoa; não são enviadas à Hostinger nem ao GitHub. Não é preciso configurar um banco compartilhado para a PWA.

O SQLite antigo não é apagado nem publicado. Os endpoints antigos de gravação retornam uma mensagem de versão descontinuada, evitando que abas antigas continuem salvando no servidor.

## Migração opcional do diário antigo

Use preferencialmente o comando `npm run backup:anterior` na instalação local. Ele gera o arquivo privado `data/backup-para-pwa.json`, que pode ser restaurado no app instalado.

Se houver registros na instalação antiga hospedada:

1. Configure temporariamente `ENABLE_LEGACY_EXPORT=true`, uma senha **nova** de pelo menos 12 caracteres em `APP_PASSWORD` e o `DATA_DIR` privado que contém o SQLite anterior.
2. Na estrutura `hbuilds`, o caminho antigo pode ser reconhecido automaticamente: `/home/USUARIO/domains/DOMINIO/entredias-data`. Não mova bancos para `public_html` ou para o GitHub.
3. Reimplante, abra `/login`, entre com a senha de migração e depois abra `/api/legacy/backup` no mesmo navegador para baixar o JSON.
4. Transfira o arquivo privadamente e restaure-o em **Dados e backup** no app instalado.
5. Remova `ENABLE_LEGACY_EXPORT` do painel e reimplante para encerrar esse acesso. Preserve o banco antigo como backup até conferir os dados importados.

Essa exportação é somente leitura e exige sessão autenticada. Sem a ativação explícita, a rota fica desabilitada, mesmo que uma senha antiga ainda esteja configurada. O service worker nunca armazena essa resposta.

## Referências

- [Hostinger: publicar aplicações Node.js](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [web.dev: instalação de PWA](https://web.dev/learn/pwa/installation)
- [MDN: instalação e limitações dos convites](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt)
- [MDN: armazenamento persistente](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
