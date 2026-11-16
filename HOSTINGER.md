# Publicar o Entre dias na Hostinger

O aplicativo está preparado para a opção **Implante seu app web em Node.js**. O GitHub contém apenas código; não inclui avaliações, banco de dados, backups ou senha.

## Configuração no painel

1. Na tela de implantação, clique em **Conecte-se com GitHub** e selecione `rick-49/entredias`, branch `main`. Também pode usar a URL pública `https://github.com/rick-49/entredias.git` ou enviar o ZIP do projeto.
2. Confira as configurações:

| Campo | Valor |
| --- | --- |
| Versão do Node.js | **24.x** |
| Framework / tipo | **Other / Outro** (servidor Node.js) |
| Diretório do projeto | Raiz do repositório, `.` |
| Instalação, se solicitada | `npm ci` |
| Build, se solicitado | `npm run build` |
| Comando de início | `npm start` |
| Arquivo inicial, se solicitado | `server.js` |
| Saída estática | Não se aplica; esta aplicação executa um servidor |

Não selecione um preset de site estático: o dashboard depende da API e do banco.

3. Em **Environment variables / Variáveis de ambiente**, configure:

| Variável | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `APP_PASSWORD` | Crie sua própria senha com pelo menos 12 caracteres |
| `PORT` | Use a porta definida pela plataforma; o padrão do aplicativo é `3000` |

As variáveis são lidas pelo processo Node.js. `.env.example` é apenas um modelo, não é carregado automaticamente. Não use o texto de exemplo como senha e não coloque a senha no GitHub.

4. Clique em **Deploy / Implantar**. Quando o domínio HTTPS estiver disponível, abra o endereço e entre com a senha configurada. O endpoint `/health` permite verificar o funcionamento do servidor sem expor registros.

## Banco persistente

Cada implantação da Hostinger usa uma pasta de build diferente. Por isso o SQLite não deve ficar dentro dos arquivos da implantação.

Na estrutura documentada pela Hostinger (`/home/USUARIO/domains/DOMINIO/hbuilds/.../nodejs`), o aplicativo calcula automaticamente uma pasta vizinha:

```text
/home/USUARIO/domains/DOMINIO/entredias-data/diary.sqlite
```

Esta é uma escolha do aplicativo para manter os dados fora de `hbuilds` e `public_html`, não uma garantia de volume ou backup da hospedagem. Confirme que essa pasta é gravável e é preservada pelo seu plano. Se a estrutura do seu ambiente for diferente, configure `DATA_DIR` com um caminho absoluto persistente fora do código. Sem uma pasta segura identificável, o aplicativo em produção para e informa como configurar `DATA_DIR`, em vez de criar um banco descartável no build.

Se houver erro de permissão, confirme com o suporte da Hostinger um diretório persistente e privado permitido no seu plano e use esse caminho em `DATA_DIR`. Uma instalação deve usar uma única instância Node.js para este SQLite. Se o plano não oferecer esse armazenamento, será necessário configurar um banco externo antes de registrar dados reais.

Após a primeira implantação, crie uma avaliação de teste, use **Redeploy** e confirme que ela permanece. Faça essa verificação antes de registrar informações pessoais. Mantenha backups periódicos fora da hospedagem. O CSV serve para análise; não é um mecanismo de restauração do banco.

## Registros atuais do computador

Uma instalação nova começa vazia. O arquivo local `D:\ferramentas\avaliador de humor\data\diary.sqlite` permanece no seu computador e não é enviado ao GitHub.

Para migrar os registros depois, pare as duas instâncias e transfira esse banco diretamente para o `DATA_DIR` privado da hospedagem, por um canal autenticado de transferência de arquivos. Não o coloque no repositório nem em `public_html`. Faça backup do destino antes de substituir qualquer banco existente. Esta transferência de dados pessoais deve ser feita separadamente da publicação do código.

## Acesso

Em produção, `APP_PASSWORD` é obrigatória. Os dados, o dashboard e o CSV exigem uma sessão autenticada. A sessão dura até 8 horas, usa cookie HttpOnly/SameSite e Secure em produção, e expira ao reiniciar o servidor. Use **Sair** para encerrar o acesso. Várias pessoas com a mesma senha acessam o mesmo diário: este aplicativo é pessoal, não um serviço com contas individuais.

O uso local pelo `iniciar.bat` continua funcionando sem senha e escuta somente neste computador, a menos que você configure as variáveis de hospedagem.

## Atualizações e diagnóstico

- Atualizações enviadas à branch `main` podem iniciar uma nova implantação quando a integração automática estiver habilitada.
- Para aplicar mudanças de configuração, use as opções de atualização/reimplantação do painel.
- Erro de senha ausente: configure `APP_PASSWORD` nas variáveis de ambiente.
- Erro de diretório: configure `DATA_DIR` com o caminho persistente correto.
- Erro de `node:sqlite`: selecione Node.js **24.x**.
- Erro de porta: confira `PORT` e o comando `npm start` nos logs da implantação.

## Documentação oficial consultada

- [Implantar aplicações Node.js e estrutura das pastas](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Configurar variáveis durante a implantação](https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/)
- [Reimplantar uma aplicação](https://www.hostinger.com/support/how-to-redeploy-a-node-js-application/)
