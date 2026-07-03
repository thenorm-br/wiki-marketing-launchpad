# WikiMarketing

WikiMarketing e uma plataforma web para gestao de campanhas de relacionamento com leads. O app permite importar contatos, selecionar acoes de comunicacao, configurar provedores de WhatsApp e acompanhar conversas/resultados de campanhas.

O projeto combina um frontend React com Supabase para autenticacao, banco de dados, storage e Edge Functions.

## Principais recursos

- Landing page institucional da WikiMarketing.
- Login, cadastro e controle de acesso por perfil/assinatura.
- Upload de contatos via CSV, XLSX ou XLS.
- Envio e orquestracao de campanhas com WhatsApp, email, ligacao e SMS.
- Configuracao de provedores WhatsApp Evolution API ou Cloud API da Meta.
- Criacao, envio e sincronizacao de templates do WhatsApp.
- Tela de resultados com campanhas, fila de mensagens e conversas.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/Radix UI
- Supabase Auth, Database, Storage e Edge Functions
- XLSX para importacao de planilhas

## Estrutura

```text
src/
  components/        Componentes visuais e layout
  contexts/          Estado global de autenticacao
  integrations/      Cliente Supabase tipado
  lib/               Helpers de importacao, schema wiki e utilitarios
  pages/             Rotas principais da aplicacao
  config/            Configuracoes do produto

supabase/
  functions/         Edge Functions usadas pelo app
  migrations/        Historico SQL do banco
  config.toml        Configuracao local das functions
```

## Configuracao

Em desenvolvimento local, crie um arquivo `.env` com as variaveis publicas do Supabase:

```env
VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-chave-anon"
VITE_SUPABASE_PROJECT_ID="seu-project-ref"
```

As variaveis acima sao publicas e usadas pelo frontend. Chaves administrativas, como `SUPABASE_SERVICE_ROLE_KEY`, nao devem ficar no frontend.

## Deploy no Coolify

Este projeto foi preparado para rodar no Coolify usando o `Dockerfile` da raiz.

Configuracao esperada no Coolify:

- Build Pack: `Dockerfile`
- Dockerfile: `Dockerfile`
- Porta exposta: `3000`
- Variaveis de build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`

Como o frontend usa Vite, as variaveis `VITE_*` precisam existir antes do build da imagem. Se mudar uma delas no Coolify, faca um novo deploy/rebuild.

### Publicar GitHub + Coolify

Use o script abaixo para commitar, enviar para o GitHub e disparar deploy no Coolify:

```powershell
$env:COOLIFY_TOKEN="seu-token-do-coolify"
npm run publish -- -Message "Descricao da alteracao"
```

Padroes do script:

- Coolify API: `https://sistemas.faesde.com.br/api/v1`
- App UUID: `rf5qjrkb1mfg4jp59twsqbyk`
- Repositorio: usa o checkout Git atual; nesta pasta local, se o Git da raiz nao estiver valido, sincroniza para `_versions/*/03-publish-clean`.

Nao commite tokens. Passe `COOLIFY_TOKEN` por variavel de ambiente ou pelo parametro `-CoolifyToken`.

## Desenvolvimento

```bash
npm install
npm run dev
```

O servidor local sobe em `http://localhost:8080`.

## Build

```bash
npm run build
```

O build final fica em `dist/`.

## Supabase

As migrations em `supabase/migrations` descrevem as tabelas e politicas de acesso do banco. As Edge Functions em `supabase/functions` concentram operacoes que precisam rodar no backend, como salvar configuracoes sensiveis, testar conexao com WhatsApp e enviar mensagens.

A migration `supabase/migrations/20260703222000_confirm_test_account_email.sql` confirma o e-mail do usuario de teste `teste@gmail.com`. Coolify nao executa migrations do Supabase; aplique pelo SQL Editor do Supabase ou pelo Supabase CLI.

Para publicar functions com o Supabase CLI:

```bash
supabase login
supabase link --project-ref seu-project-ref
supabase functions deploy
```

## Deploy

O projeto ja inclui `Dockerfile` e `nginx.conf` para servir o build estatico em Nginx. O dominio publicado atualmente pode apontar para qualquer infraestrutura que sirva a pasta `dist/` gerada pelo Vite.
