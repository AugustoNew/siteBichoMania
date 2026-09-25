# Bicho Mania

## 1. Sobre o sistema

O Bicho Mania e um sistema de agendamento para o estabelecimento. Ele permite que os clientes consultem os servicos, escolham uma data e um horario e enviem os dados do responsavel e do animal.

O estabelecimento tambem possui uma area administrativa para acompanhar a agenda e organizar os horarios e servicos disponiveis.

## 2. Requisitos

O computador precisa ter:

- **Node.js**, de preferencia a versao 18 ou superior.
- **NPM**, que normalmente ja vem instalado junto com o Node.js.

Use uma versao do Node.js compativel com as dependencias do projeto. Para conferir se estao instalados, abra o PowerShell e execute:

```powershell
node --version
npm --version
```

## 3. Instalacao

Siga estes passos na primeira vez que for usar o sistema:

1. Abra a pasta do projeto Bicho Mania no computador.
2. Dentro dessa pasta, clique com o botao direito do mouse e escolha **Abrir no Terminal** ou **Abrir o PowerShell nesta pasta**.
3. Execute o comando abaixo:

```powershell
npm install
```

Espere a instalacao terminar. Esse comando instala as dependencias necessarias para o sistema funcionar.

## 4. Como iniciar o sistema

Sempre que quiser iniciar o sistema:

1. Abra o PowerShell na pasta do projeto.
2. Execute:

```powershell
npm start
```

3. Abra o navegador e acesse:

```text
http://localhost:3000
```

O sistema estara disponivel enquanto o comando estiver em execucao no PowerShell.

## 5. Como parar o sistema

Para parar o sistema, volte ao PowerShell onde ele esta sendo executado e pressione:

```text
Ctrl + C
```

## 6. Area administrativa

1. Abra o site em `http://localhost:3000`.
2. Role ate o rodape da pagina.
3. Clique em **Area administrativa**.
4. Informe as credenciais iniciais:

- **Usuario:** `admin`
- **Senha:** `bichomania`

5. Clique em **Entrar**.

Essas credenciais existem no codigo atual e sao criadas automaticamente quando o banco e inicializado. O sistema atual nao possui uma tela para alterar a senha.

## 7. Agendamentos

### Para o cliente

O cliente pode:

- Ver os servicos disponiveis e seus precos.
- Escolher um servico.
- Escolher uma data e um horario livre.
- Informar os dados do responsavel e do animal.
- Consultar o resumo do agendamento.
- Escolher uma forma de pagamento de demonstracao.
- Receber a confirmacao do agendamento.
- Abrir uma mensagem de confirmacao no WhatsApp.

O pagamento atual e apenas uma estrutura de demonstracao. O sistema nao processa pagamentos reais.

### Para o estabelecimento

Depois de entrar na area administrativa, o funcionario pode:

- Visualizar os agendamentos em ordem de data e horario.
- Ver os dados do cliente, telefone, animal e servico.
- Cancelar um agendamento.
- Bloquear uma data e um horario.
- Alterar horario de abertura, horario de fechamento, intervalo e dias de atendimento.
- Alterar o nome e o telefone do estabelecimento nas configuracoes.
- Cadastrar novos servicos com nome, descricao, preco e duracao.

Os horarios ocupados ou bloqueados deixam de aparecer como disponiveis para novos agendamentos.

## 8. Banco de dados

Os dados sao armazenados no arquivo:

```text
bicho-mania.db
```

Esse arquivo fica na pasta principal do projeto. O sistema usa SQLite e cria automaticamente o arquivo e as tabelas necessarias quando e iniciado pela primeira vez.

O banco guarda, entre outros dados, servicos, clientes, animais, agendamentos, horarios bloqueados, configuracoes e usuario administrativo.

## 9. Google Maps

Na pagina principal existe a secao **Onde estamos**. Clique no botao **Ver localizacao no Google Maps** para abrir a localizacao do estabelecimento no Google Maps em uma nova aba do navegador.

## 10. Celular

O site foi adaptado para funcionar em:

- Computador.
- Tablet.
- Celular.

O menu, os botoes, as imagens, os formularios e a area administrativa se ajustam ao tamanho da tela.

## 11. Solucao de problemas

### O site nao abre

Confira se o PowerShell esta aberto na pasta correta do projeto e se o comando abaixo foi executado:

```powershell
npm start
```

Depois, acesse novamente `http://localhost:3000`.

### O comando `npm start` nao funciona

Verifique se o Node.js e o NPM estao instalados:

```powershell
node --version
npm --version
```

Se estiverem instalados, execute novamente:

```powershell
npm install
npm start
```

### A pagina nao carrega corretamente

Pare o sistema com `Ctrl + C`, feche ou atualize o navegador e inicie novamente:

```powershell
npm start
```

### O servidor foi fechado

O sistema para quando a janela do PowerShell e fechada ou quando `Ctrl + C` e pressionado. Abra o PowerShell na pasta do projeto e execute novamente:

```powershell
npm start
```

### Como reiniciar o sistema

1. No PowerShell que esta executando o sistema, pressione `Ctrl + C`.
2. Execute novamente:

```powershell
npm start
```

3. Acesse `http://localhost:3000` no navegador.

## 12. Importante

O PowerShell precisa permanecer aberto enquanto o sistema estiver sendo executado localmente. Se o PowerShell for fechado, o site deixara de responder em `http://localhost:3000`.

## 13. Estrutura do projeto

Principais arquivos e pastas:

```text
siteBichoMania/
|-- public/
|   |-- index.html
|   |-- booking.html
|   |-- payment.html
|   |-- confirmation.html
|   |-- app.js
|   |-- booking.js
|   |-- payment.js
|   |-- confirmation.js
|   |-- styles.css
|   |-- admin-modal.css
|   |-- logo.png
|-- bicho-mania.db
|-- package.json
|-- package-lock.json
|-- server.js
|-- README.md
```

- `server.js`: inicia o servidor, cria o banco e disponibiliza as rotas da aplicacao.
- `public/index.html`: pagina principal do site.
- `public/booking.html`: pagina de agendamento.
- `public/payment.html`: pagina de pagamento de demonstracao.
- `public/confirmation.html`: pagina de confirmacao.
- Arquivos `.js` da pasta `public`: controlam as funcoes das paginas no navegador.
- `public/styles.css`: estilos e adaptacao para computador, tablet e celular.
- `public/admin-modal.css`: estilos do acesso administrativo.
- `public/logo.png`: logo usada no site.
- `bicho-mania.db`: banco de dados SQLite criado pelo sistema.
- `package.json`: comandos e dependencias do projeto.
- `package-lock.json`: registro das versoes instaladas das dependencias.
- `node_modules/`: pasta criada pelo `npm install`, com as dependencias instaladas.
