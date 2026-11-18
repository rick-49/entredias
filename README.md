# Entre dias

Diário de humor em **PWA**, com landing page pública de instalação, avaliações por horário, nível neutro, medicamentos e dashboard. Cada pessoa usa o próprio banco **IndexedDB**, no dispositivo. As resenhas permanecem locais. Uma contribuição opcional e pseudonimizada pode enviar medicamentos e níveis de humor ao painel geral, somente após autorização.

## Usar no celular

1. Acesse o endereço HTTPS da instalação.
2. Toque em **Instalar o app**. No Android/Chrome, confirme o convite ou use o menu **Instalar app / Adicionar à tela inicial**.
3. No iPhone, abra no Safari e use **Compartilhar → Adicionar à Tela de Início**, com **Abrir como App** quando disponível.
4. Abra o app pelo ícone da tela inicial. Depois da primeira preparação, ele funciona offline.

A notificação automática não é garantida: o navegador decide se e quando mostra o convite. A landing page mantém um botão e instruções para as alternativas. O formulário do diário é liberado no modo instalado. Em localhost há uma exceção para desenvolvimento.

## O que está incluído

- Calendário semanal e várias avaliações no mesmo dia, mesmo quando os horários coincidem.
- Quatorze humores, incluindo Raiva e Medo, cada um com Neutro (não estou sentindo), I (leve), II (moderada) e III (intensa).
- Horário ajustável e resenha independente por avaliação.
- Dashboard por período, com frequência, distribuição de intensidade, evolução por horário e histórico.
- Exportação CSV, backup JSON e restauração local sem sobrescrever os registros existentes.
- Botão Compartilhar no diário, dashboard e backups, com WhatsApp, Telegram, Facebook, e-mail, cópia de link e compartilhamento nativo quando disponível. Compartilha somente o link público de instalação.
- Manifesto instalável, ícones Android/iOS, service worker e shell completo para uso offline.
- Medicamentos com lista de princípios ativos, dosagem, horários previstos e vigência por data e hora. Trocas geram novos esquemas; as avaliações preservam suas cópias históricas.
- Registro separado das tomadas efetivamente informadas, com data e hora. As novas avaliações guardam as tomadas informadas nas 24h anteriores. Horário previsto não é marcado como dose tomada.
- Referência configurável para lacunas, duração padrão de 20 minutos ajustável por avaliação, confirmação diária da intensidade e representação visual separada das observações reais.
- PDF gerado localmente, com ou sem resenha, quatro gráficos, histórico de esquemas, tomadas e avaliações. Os gráficos são descritivos e não demonstram causalidade.
- Lembrete push no horário e fuso escolhidos, mediante permissão, com assinatura de notificação mantida separadamente do banco MySQL de análise.
- Dashboard público `/comunidade`, com grupos de no mínimo 5 instalações contribuintes e janelas dos primeiros 14, 30 ou 90 dias de cada esquema.

## Dados e privacidade

Os registros ficam no IndexedDB `entre-dias-local`, versão 3, nos armazenamentos `assessments`, `medications`, `intakes` e `settings`. Atualizações preservam os dados anteriores. Não há conta nem senha compartilhada. A instalação não usa fontes externas. O navegador se conecta ao site para baixar arquivos e verificar atualizações.

A contribuição começa **desligada**. Ao autorizar em **Configurações**, o usuário vê o escopo e confirma o envio. **Salvar avaliação** passa a sincronizar os registros elegíveis, sem resenha, identidade, datas de calendário, horários exatos ou lacunas estimadas. Sem internet ou com falha do banco, o registro local é preservado e a contribuição fica pendente; ela é tentada ao abrir o app com conexão, no próximo salvamento ou ao recuperar a conexão com o app aberto. Não se promete sincronização em segundo plano com o app fechado.

Cada reenvio substitui a contribuição anterior daquela instalação (até 500 observações elegíveis). Há botão para desligar e retirar os dados enviados; a retirada exige internet. A chave privada de retirada fica no dispositivo e no backup JSON, nunca no relatório PDF. Restaurar o backup não restaura o consentimento de envio. As contribuições são pseudonimizadas, não uma garantia de anonimato, e não identificam pessoas verificadas.

O MySQL guarda somente as contribuições da análise geral. Lembretes usam outro armazenamento privado, `notifications.sqlite`, contendo assinatura push, horário, fuso e último dia de disparo, sem medicamentos ou humores. As chaves VAPID são geradas no servidor e ficam em `push-vapid-private.json`, fora do GitHub. O usuário precisa ativar notificações em seu próprio aparelho.

Cada origem (domínio/protocolo/porta), perfil de navegador e, em algumas plataformas, instalação pode ter um banco separado. O app não criptografa o IndexedDB. Em dispositivos compartilhados, use o bloqueio de tela.

Limpar os dados do site, remover o app, trocar de celular ou a remoção de armazenamento pelo navegador pode apagar os registros. Em **Dados e backup**, baixe regularmente um backup JSON e guarde-o em um local privado. A solicitação de armazenamento persistente pode ser negada pelo navegador. O CSV é para análise; não serve para restaurar o diário.

A restauração valida todo o arquivo antes de gravar e usa uma transação. IDs já existentes são mantidos, sem substituir suas versões atuais. Para levar os dados a outro celular, instale o app e restaure o JSON nele.

## Medicamentos e comparação por horário

Em `/medicamentos`, cadastre o princípio ativo, dose, unidade, horários previstos, data e hora de início. Para alterar uma dose ou horário, encerre o esquema antigo com data e hora (inclusive) e cadastre o novo a partir do próximo horário. O histórico do que foi salvo não é reescrito. Os nomes sugeridos são de princípios ativos, sem marca de laboratório, e não constituem indicação de tratamento.

Use **Registrar quando tomei** para registrar uma tomada real informada. Uma nova avaliação associa o esquema vigente naquele horário e as tomadas já informadas nas 24h anteriores. Registros feitos depois não são inseridos retroativamente em avaliações antigas. Ajustes de horário em uma avaliação nova recalculam esse contexto; avaliações antigas preservam o contexto salvo.

O humor de referência é uma **estimativa configurada**. Exemplo: ansiedade II às 14:30, duração 20 min, ocupa 14:30–14:50; humor deprimido III às 16:30 ocupa 16:30–16:50; as demais lacunas podem usar a referência Alegria I. Dias encerrados cobrem 24h; no dia atual, só se estima até o momento presente. Estimativas não contam como avaliações, não são enviadas à análise geral e são identificadas no dashboard e no PDF.

## PDF e lembretes

Em `/relatorio`, selecione datas e escolha se inclui resenhas (desligado por padrão). O PDF é produzido no aparelho, inclusive offline, com frequência por intensidade, avaliações e tomadas por hora, linha do tempo com referências e horários de medicação, e percentuais por esquema. Cada gráfico explica suas contagens e limites; o detalhamento contém todos os registros do período.

O lembrete abre uma pergunta sobre a intensidade da referência daquele dia. A resposta ajusta somente os intervalos estimados, não os humores observados. No iPhone, Web Push requer iOS 16.4+, app na tela inicial e autorização por toque do usuário. O servidor verifica o agendamento a cada minuto, no fuso do aparelho, com tolerância de 30 min após o horário. A entrega depende de servidor em execução, rede e sistema operacional; não é um alarme médico.

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

Veja [HOSTINGER.md](HOSTINGER.md). Esta versão pública não exige `APP_PASSWORD` ou `DATA_DIR` para iniciar. Ela não grava novas avaliações no SQLite do servidor; o SQLite privado de lembretes guarda somente as assinaturas e seus agendamentos.

Ao alterar os arquivos do app, altere o identificador `CACHE` em `public/sw.js`. A nova versão assume após baixar todos os arquivos. O app verifica atualizações ao voltar à tela, reconectar e a cada cinco minutos em primeiro plano. A tela recarrega automaticamente se não houve interação; caso contrário, apresenta um botão para atualizar após salvar. Versões antigas sem esse aviso precisam ser fechadas e reabertas após o download. Não é necessário apagar o IndexedDB nem remover o aplicativo para atualizar.

## Preservar os registros da versão SQLite

Os arquivos anteriores da pasta `data/` são preservados e continuam fora do GitHub. Para convertê-los em um backup restaurável na PWA:

```sh
npm run backup:anterior
```

O comando cria `data/backup-para-pwa.json`. Transfira esse arquivo privadamente para o celular, instale o app e restaure-o em **Dados e backup**. Horários desconhecidos de registros antigos continuam identificados como não informados.

Para exportação de uma instalação antiga na Hostinger, veja o procedimento opcional e autenticado no guia. Essa rota é desabilitada por padrão e nunca é chamada nem armazenada em cache pela PWA.

O diário é uma ferramenta de registro e autoconhecimento; não realiza diagnósticos.

## Navegação e análise geral

Cinco guias: Meu diário, Dashboard, Medicamentos, Configurações e Ajustes e backup. Medicamentos reúne esquemas e tomadas; Configurações reúne referência, lembretes e consentimento. O botão Enviar relatório para meu médico abre a preparação local do PDF; não envia automaticamente dados a terceiros.

O painel /comunidade tem filtros por medicamento e dose, janela de 14/30/90 dias, sentimento e amostra mínima de 5/10/20 instalações por grupo. Exibe indicadores ponderados por observações, distribuição por dia, comparação de medicamentos e mapa semanal. Clicar num dia detalha os grupos; clicar num sentimento muda os gráficos. Os totais são vínculos entre avaliação e medicamento, não pessoas únicas. Dias sem dados divulgáveis não são tratados como neutros. Nenhuma amostra fictícia é publicada.

## Idiomas da interface

Português (Brasil), English e Español estão disponíveis em Configurações → Idioma do aplicativo, e no seletor da página inicial e análise geral. A escolha é salva localmente por navegador/instalação e funciona offline. A tradução preserva valores dos formulários e textos pessoais. PDF, CSV e mensagens push continuam no formato original em português nesta versão. Alguns detalhamentos dinâmicos preservam a redação original.

