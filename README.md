# Entre dias

Diário de humor em Node.js, em português, com calendário semanal, várias avaliações por dia e layout adaptado ao celular.

Para publicar o site com acesso por senha e banco persistente, siga [o guia da Hostinger](HOSTINGER.md). Use Node.js 24.x, o preset **Other / Outro**, `npm run build` e `npm start`. A senha e os dados pessoais ficam fora do repositório.

## Iniciar

Requer Node.js 22.13 ou superior (recomendado: Node.js 24). Não é necessário instalar dependências. No Windows, também pode abrir o arquivo `iniciar.bat` com um clique duplo.

```sh
node server.js
```

Abra http://localhost:3000 no navegador. Para desenvolvimento, use `node --watch server.js`.

## Usar

- Navegue entre semanas pelas setas e clique em um dia.
- Toque em **Iniciar avaliação**. O horário atual será preenchido; você pode ajustá-lo para registrar outro momento do dia.
- Todos os humores começam em **Neutro**: significa **não estou sentindo esse humor**. Selecione I (leve), II (moderada) ou III (intensa) apenas nos humores presentes.
- Toque em Neutro ou novamente na intensidade selecionada para voltar aquele humor a neutro.
- Escreva a **resenha deste momento**, opcional, e toque em **Salvar avaliação**.
- Inicie quantas avaliações precisar. Cada uma tem um identificador próprio, horário, humores e resenha independentes. Mesmo duas avaliações no mesmo horário são preservadas.
- Uma avaliação com todos os humores neutros e sem resenha também pode ser salva. Limpar os campos não apaga uma avaliação.
- Use **Editar** no cartão do horário para corrigir aquela avaliação. Inicie outra para registrar um novo momento.
- No celular, a navegação fica na parte inferior, os humores aparecem um por linha e o histórico do dashboard vira cartões.
- A lateral mostra dias registrados, total de avaliações e os três sentimentos mais frequentes na semana exibida. Neutros não entram na frequência.
- **Exportar CSV** baixa todos os registros salvos diretamente do banco de dados. Salve suas alterações antes de exportar.

O CSV usa UTF-8 com BOM, separador ponto e vírgula e uma linha por humor de cada avaliação, incluindo os neutros. Inclui identificador da avaliação, data, horário, dia da semana, humor, nível, intensidade, resenha e última atualização (UTC). O horário da avaliação é o horário local informado, sem conversão. Pode ser aberto no Excel; se necessário, selecione o delimitador **ponto e vírgula** ao importar. Resenhas que começam com caracteres de fórmula recebem um apóstrofo na exportação para serem tratadas como texto.

Os 12 humores são alegria, calma, gratidão, disposição, ansiedade, tristeza, humor deprimido, agitação, irritação, cansaço, estresse e solidão. Todos possuem quatro opções: Neutro, I, II e III. Novos humores podem ser adicionados em `shared.js` e assumem neutro nos registros em que estiverem ausentes.

## Dashboard

Abra **Dashboard** pelo menu ou acesse http://localhost:3000/dashboard. Filtre os últimos 7, 30 ou 90 dias, todo o histórico ou um intervalo personalizado. A análise inclui dias únicos registrados, quantidade de avaliações, frequência por humor em avaliações, distribuição de níveis I a III, evolução por horário e hábito de registro por dia da semana. O histórico é paginado e permite abrir a avaliação exata no diário.

Avaliações neutras contam como avaliações realizadas e dias registrados, mas não entram na frequência de sentimentos nem no percentual de intensidade III. O gráfico mostra um ponto/barra para cada avaliação, inclusive neutros, sem misturar os horários em uma média diária. Até as últimas 120 avaliações são exibidas no gráfico; os demais painéis consideram todo o intervalo. Dias sem avaliação não são considerados neutros. Use **Atualizar dados** após salvar registros em outra aba. O CSV continua exportando todo o histórico.

## Armazenamento

Os registros são gravados no banco SQLite `data/diary.sqlite` no computador que executa o servidor e persistem após reiniciá-lo. Avaliações e humores ficam nas tabelas relacionadas `assessments` e `assessment_moods`, com gravação em transações. Para fazer um backup completo, pare o servidor e copie a pasta `data`.

Na atualização para avaliações por horário, os dias antigos são convertidos uma única vez, preservando sentimentos, resenhas e última atualização. Como o aplicativo anterior não guardava horário, esses registros mostram **Horário não informado**; é possível informar um horário ao editá-los. Os humores não selecionados assumem neutro. Antes da conversão de dados antigos, é criada a cópia `data/diary-before-assessments.sqlite`. As tabelas antigas são preservadas e deixam de receber gravações. Abas da versão anterior precisam ser recarregadas.

Se existir um arquivo anterior `data/entries.json`, ele será importado automaticamente na primeira inicialização. Essa importação ocorre uma única vez, preserva o JSON original como backup e não reaparece após editar ou apagar registros. Se algum registro antigo for inválido, a importação é interrompida sem importar parcialmente os dados.

O aplicativo é pessoal: todos os navegadores que acessam esta instalação compartilham o mesmo diário. No uso local, o servidor aceita conexões apenas deste computador, em `127.0.0.1`. Em produção, o acesso por senha é obrigatório e as páginas, APIs e exportações exigem uma sessão autenticada. Não há contas individuais nem sincronização entre instalações. O SQLite não é criptografado pelo aplicativo.

É possível definir as variáveis `PORT` (porta) e `DATA_DIR` (diretório de dados). A interface funciona sem fontes externas; quando há internet, tenta carregar as fontes DM Sans e Manrope do Google Fonts.

O diário serve para autoconhecimento e não realiza diagnósticos.

## Verificação

```sh
node --test
```

Os testes verificam os quatro níveis, datas e horários válidos, várias avaliações no mesmo horário, salvamento de avaliações neutras, edição sem duplicação, persistência após reiniciar, migração de SQLite/JSON, backup, CSV e análises por avaliação com dias únicos.
