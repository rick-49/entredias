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

A hospedagem distribui HTML, CSS, JavaScript, ícones, manifesto e service worker. O diário pessoal fica no IndexedDB de cada pessoa. Para o diário e o PDF local, não é necessário MySQL. A análise geral recebe apenas as contribuições autorizadas; resenhas não são enviadas.

O SQLite antigo não é apagado nem publicado. Os endpoints antigos de gravação retornam uma mensagem de versão descontinuada, evitando que abas antigas continuem salvando no servidor.

## Ativar o MySQL somente para análise geral

Crie o banco e o usuário no painel da Hostinger. Como a senha anterior apareceu em uma imagem, use uma senha nova. Configure diretamente no painel, sem colocar credenciais no código ou no GitHub:

| Variável | Valor |
| --- | --- |
| `COMMUNITY_ENABLED` | `true` |
| `DB_HOST` | `127.0.0.1` para app e MySQL nesta hospedagem |
| `DB_PORT` | `3306`, salvo indicação diferente do provedor |
| `DB_NAME` | Nome completo do banco, incluindo o prefixo da conta |
| `DB_USER` | Usuário completo do banco, incluindo o prefixo |
| `DB_PASSWORD` | A senha nova desse usuário |
| `DB_SSL` | `true` somente se o serviço MySQL exigir/oferecer TLS com certificado verificável |

Nesta instalação, use `127.0.0.1` e `DB_SSL=false` para a conexão local. O endereço `srv1136.hstgr.io` é destinado ao acesso externo. Não libere acesso indiscriminado no MySQL remoto: se o provedor exigir autorização de origem, autorize somente o servidor da aplicação.

Reimplante após aplicar as variáveis. O aplicativo cria as tabelas `entredias_contributors` e `entredias_observations` no primeiro acesso. O usuário MySQL precisa ter permissões para criar essas tabelas, ler, inserir, atualizar e excluir registros do banco selecionado.

Confira `/api/community/status` (`configured: true` verifica a presença das variáveis) e `/api/community/summary` (consulta efetivamente o banco). Um painel vazio é esperado até haver pelo menos cinco instalações contribuintes no mesmo medicamento, dose e dia relativo. A configuração de conexão não significa que já há amostra suficiente.

Se o MySQL estiver ausente ou inacessível, `/comunidade` informa a indisponibilidade e o diário local continua funcionando. As contribuições autorizadas ficam pendentes até uma tentativa posterior. Os dados compartilhados não incluem resenhas, nomes de usuários, horários exatos ou estimativas de lacunas; contêm medicamento, dose, dia relativo, uso concomitante e níveis de humor.

## Ativar lembretes push

Os lembretes **não usam o MySQL de análise**. A assinatura do navegador, horário e fuso ficam em `notifications.sqlite`, na pasta privada de dados. As chaves VAPID são geradas uma vez e salvas como `push-vapid-private.json` nessa mesma pasta.

Na estrutura `hbuilds` da Hostinger, a pasta é reconhecida como `/home/USUARIO/domains/DOMINIO/entredias-data`. Ela deve ser gravável e persistente. Se necessário, defina `DATA_DIR` com esse caminho absoluto privado, fora de `hbuilds` e `public_html`. Nunca publique a pasta de dados ou as chaves.

Em produção, os lembretes ficam disponíveis automaticamente quando essa pasta pode ser utilizada. Use `PUSH_ENABLED=false` se desejar desligar o serviço. Opcionalmente configure `PUSH_SUBJECT` com uma URL HTTPS ou contato `mailto:` do administrador. Confira `/api/push/config`: deve devolver `enabled: true` e apenas a chave pública.

O usuário ainda precisa abrir **Medicamentos e configurações**, escolher o horário e tocar em **Ativar / atualizar lembrete**, aceitando a permissão do aparelho. No iPhone, isso só funciona no app adicionado à tela inicial, em iOS 16.4 ou mais recente. O servidor deve permanecer em execução; cada processo verifica os horários a cada minuto, usando o fuso gravado na assinatura. Uma marcação atômica no SQLite evita envio repetido por processos simultâneos no mesmo dia.

Para atualizar, preserve os arquivos privados e as chaves. Não gere chaves novas em cada deploy. Para desativar uma assinatura, use o botão no próprio app com internet. O conteúdo da notificação é genérico e não contém medicação, humor ou resenha.

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
