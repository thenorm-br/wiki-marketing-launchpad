# 🚀 Guia de Deploy - WikiMarketing

Este guia explica como fazer deploy da aplicação em sua própria infraestrutura (AWS, Vercel, etc.).

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Conta no [Supabase](https://supabase.com) (gratuito)
- Supabase CLI instalado: `npm install -g supabase`
- Conta no [Meta Developers](https://developers.facebook.com) para WhatsApp API

---

## 🗂️ Estrutura do Projeto

```
├── src/                    # Frontend React
├── supabase/
│   ├── functions/          # Edge Functions (backend)
│   └── migrations/         # SQL migrations
├── .env.example            # Template de variáveis de ambiente
└── src/config/app.config.ts # Configurações do app
```

---

## 📦 Passo 1: Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Clique em **New Project**
3. Anote as credenciais:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Key**: Chave pública (Settings > API)
   - **Service Role Key**: Chave privada (para edge functions)

---

## 🗄️ Passo 2: Configurar Banco de Dados

Execute as migrations SQL no SQL Editor do Supabase:

### Tabelas necessárias:

```sql
-- 1. Profiles (dados de usuário)
CREATE TABLE public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User Roles (controle de acesso)
CREATE TABLE public.user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Subscriptions (planos/assinaturas)
CREATE TABLE public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. WhatsApp Config (configurações do usuário)
CREATE TABLE public.whatsapp_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  provider TEXT DEFAULT 'cloudapi',
  cloudapi_access_token TEXT,
  cloudapi_phone_number_id TEXT,
  cloudapi_business_account_id TEXT,
  evolution_instance_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. WhatsApp Templates
CREATE TABLE public.whatsapp_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  body_text TEXT NOT NULL,
  category TEXT DEFAULT 'MARKETING',
  language TEXT DEFAULT 'pt_BR',
  status TEXT DEFAULT 'draft',
  meta_template_id TEXT,
  header_type TEXT,
  header_content TEXT,
  footer_text TEXT,
  buttons JSONB,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. WhatsApp Campaigns
CREATE TABLE public.whatsapp_campaigns (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  template_id UUID REFERENCES public.whatsapp_templates,
  template_name TEXT,
  contacts_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. WhatsApp Message Queue
CREATE TABLE public.whatsapp_message_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  campaign_id TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  template_id UUID REFERENCES public.whatsapp_templates,
  template_name TEXT,
  template_body TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  meta_message_id TEXT,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. WhatsApp Conversations
CREATE TABLE public.whatsapp_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  message_id TEXT,
  direction TEXT DEFAULT 'inbound',
  message_type TEXT DEFAULT 'text',
  message_content TEXT,
  media_url TEXT,
  campaign_id TEXT,
  original_message_id TEXT,
  status TEXT DEFAULT 'received',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Habilitar RLS (Row Level Security):

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- Policies para cada tabela (exemplo para profiles)
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Repetir para outras tabelas...
```

---

## ⚡ Passo 3: Deploy das Edge Functions

```bash
# 1. Login no Supabase
supabase login

# 2. Linkar projeto
supabase link --project-ref SEU_PROJECT_ID

# 3. Deploy de todas as funções
supabase functions deploy get-whatsapp-config
supabase functions deploy save-whatsapp-config
supabase functions deploy send-whatsapp-messages
supabase functions deploy whatsapp-webhook
supabase functions deploy n8n-webhook
supabase functions deploy test-whatsapp-connection
supabase functions deploy submit-whatsapp-template
supabase functions deploy sync-whatsapp-templates
```

---

## 🔧 Passo 4: Configurar Variáveis de Ambiente

1. Copie `.env.example` para `.env`
2. Preencha as variáveis:

```bash
VITE_SUPABASE_URL="https://SEU_PROJETO.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua_anon_key_aqui"
VITE_SUPABASE_PROJECT_ID="SEU_PROJETO"
```

---

## 📱 Passo 5: Configurar WhatsApp

1. Acesse [Meta Developers](https://developers.facebook.com)
2. Crie um app do tipo "Business"
3. Adicione o produto "WhatsApp"
4. Configure o webhook:
   - **URL**: `https://SEU_PROJETO.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token**: Qualquer string (será validada)
   - **Campos**: `messages`, `messaging_postbacks`
5. Obtenha o Access Token permanente
6. Configure no app via Settings > WhatsApp

---

## 🎨 Passo 6: Personalizar Configurações

Edite `src/config/app.config.ts`:

```typescript
export const COMPANY_CONFIG = {
  name: 'SuaEmpresa',
  tagline: 'Seu Slogan',
  email: 'contato@suaempresa.com',
  // ...
};

export const CONTACTS_CONFIG = {
  webhookUrl: 'https://seu-n8n.com/webhook/xxx',
  // ...
};
```

---

## 🏗️ Passo 7: Build e Deploy

### Build do Frontend:

```bash
npm install
npm run build
```

Os arquivos estarão em `dist/`.

### Deploy na AWS:

**Opção 1: S3 + CloudFront**
```bash
# Upload para S3
aws s3 sync dist/ s3://seu-bucket --delete

# Invalidar cache CloudFront
aws cloudfront create-invalidation --distribution-id XXX --paths "/*"
```

**Opção 2: EC2 com Nginx**
```nginx
server {
    listen 80;
    server_name seudominio.com;
    root /var/www/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Opção 3: Vercel**
```bash
npm install -g vercel
vercel
```

---

## ✅ Checklist Final

- [ ] Projeto Supabase criado
- [ ] Tabelas e migrations executadas
- [ ] RLS policies configuradas
- [ ] Edge Functions deployed
- [ ] Variáveis de ambiente configuradas
- [ ] Webhook Meta configurado
- [ ] app.config.ts personalizado
- [ ] Frontend buildado e deployed
- [ ] SSL/HTTPS configurado
- [ ] Domínio apontando corretamente

---

## 🆘 Troubleshooting

### Erro "CORS" nas Edge Functions
Verifique se os headers CORS estão configurados corretamente nas functions.

### Webhook não recebe mensagens
1. Verifique se a URL está correta
2. Verifique se o verify token está correto
3. Veja logs no Supabase Dashboard > Edge Functions > Logs

### Usuário não consegue salvar dados
Verifique as RLS policies - o `auth.uid()` deve corresponder ao `user_id` da tabela.

---

## 📞 Suporte

- Documentação Supabase: https://supabase.com/docs
- Documentação WhatsApp: https://developers.facebook.com/docs/whatsapp
- Documentação Meta Webhooks: https://developers.facebook.com/docs/graph-api/webhooks
