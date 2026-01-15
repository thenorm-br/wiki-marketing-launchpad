/**
 * ====================================
 * CONFIGURAÇÕES DO APLICATIVO
 * ====================================
 * 
 * Este arquivo centraliza todas as configurações customizáveis do app.
 * Edite os valores abaixo conforme necessário.
 * 
 * NOTA: As variáveis do Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
 * são gerenciadas automaticamente pelo Lovable Cloud e estão no arquivo .env
 */

// ====================================
// INFORMAÇÕES DA EMPRESA
// ====================================
export const COMPANY_CONFIG = {
  name: 'WikiMarketing',
  tagline: 'Geração de Leads Inteligente',
  description: 'Plataforma completa para geração e gestão de leads com automação inteligente.',
  email: 'contato@wikimarketing.com.br',
  phone: '+55 11 99999-9999',
  website: 'https://wikimarketing.com.br',
};

// ====================================
// CONFIGURAÇÕES DE AUTENTICAÇÃO
// ====================================
export const AUTH_CONFIG = {
  // URL de redirecionamento após login/signup
  redirectAfterLogin: '/contacts',
  redirectAfterLogout: '/',
  
  // Requisitos de senha
  minPasswordLength: 6,
  
  // Mensagens customizáveis
  messages: {
    loginSuccess: 'Login realizado com sucesso!',
    signupSuccess: 'Conta criada com sucesso!',
    logoutSuccess: 'Você foi desconectado.',
    invalidCredentials: 'Credenciais inválidas. Tente novamente.',
  },
};

// ====================================
// CONFIGURAÇÕES DE CONTATOS
// ====================================
export const CONTACTS_CONFIG = {
  // Limite de contatos por upload
  maxContactsPerUpload: 1000,
  
  // Formatos de arquivo aceitos
  acceptedFileFormats: '.csv, .xlsx, .xls',
  
  // Duração máxima de áudio para chamadas (em segundos)
  maxAudioDuration: 60,
  
  // Webhook para processamento de ações
  // IMPORTANTE: Altere esta URL para o seu webhook
  webhookUrl: 'https://n8n.wikimarketing.com.br/webhook/a9ae1f37-2ff9-4a9f-b6d5-f4d0f94d7716',
};

// ====================================
// CONFIGURAÇÕES DE AÇÕES DISPONÍVEIS
// ====================================
export const ACTIONS_CONFIG = {
  whatsapp: {
    enabled: true,
    label: 'WhatsApp',
    color: 'bg-green-500 hover:bg-green-600',
  },
  email: {
    enabled: true,
    label: 'E-mail',
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  call: {
    enabled: true,
    label: 'Ligação',
    color: 'bg-purple-500 hover:bg-purple-600',
  },
  sms: {
    enabled: true,
    label: 'SMS',
    color: 'bg-orange-500 hover:bg-orange-600',
  },
};

// ====================================
// CONFIGURAÇÕES DE PLANOS/ASSINATURA
// ====================================
export const PLANS_CONFIG = {
  // Planos disponíveis
  plans: [
    {
      id: 'basic',
      name: 'Básico',
      price: 'R$ 97/mês',
      features: ['100 contatos/mês', 'WhatsApp', 'E-mail'],
    },
    {
      id: 'pro',
      name: 'Profissional',
      price: 'R$ 197/mês',
      features: ['500 contatos/mês', 'Todas as ações', 'Suporte prioritário'],
    },
    {
      id: 'enterprise',
      name: 'Empresarial',
      price: 'R$ 497/mês',
      features: ['Contatos ilimitados', 'API dedicada', 'Suporte 24/7'],
    },
  ],
  
  // Status que liberam acesso
  activeStatuses: ['active', 'trial'],
};

// ====================================
// CONFIGURAÇÕES DE UI/TEMA
// ====================================
export const UI_CONFIG = {
  // Animações
  enableAnimations: true,
  
  // Logo (caminho relativo a /public ou URL externa)
  logoUrl: '/logo.png',
  
  // Favicon
  faviconUrl: '/favicon.ico',
};

// ====================================
// LINKS DE NAVEGAÇÃO
// ====================================
export const NAV_LINKS = {
  header: [
    { label: 'Início', href: '/' },
    { label: 'Planos', href: '/plans' },
    { label: 'Contatos', href: '/contacts', requiresAuth: true },
  ],
  footer: [
    { label: 'Termos de Uso', href: '/terms' },
    { label: 'Privacidade', href: '/privacy' },
    { label: 'Suporte', href: 'mailto:suporte@wikimarketing.com.br' },
  ],
};

// ====================================
// CONFIGURAÇÕES DE STORAGE (Supabase)
// ====================================
export const STORAGE_CONFIG = {
  // Bucket para áudios de chamadas
  audioBucket: 'call-audios',
  
  // Bucket para arquivos gerais
  filesBucket: 'uploads',
  
  // Tamanho máximo de arquivo (em bytes) - 10MB
  maxFileSize: 10 * 1024 * 1024,
};
