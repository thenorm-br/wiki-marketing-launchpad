import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Settings as SettingsIcon,
  MessageCircle,
  Plus,
  LogOut,
  ArrowLeft,
  Smartphone,
  Cloud,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type WhatsAppProvider = 'evolution' | 'cloudapi';
type TemplateStatus = 'pending' | 'approved' | 'rejected';
type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
type HeaderType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null;

interface WhatsAppConfig {
  id: string;
  user_id: string;
  provider: string;
  evolution_instance_name: string | null;
  cloudapi_phone_number_id: string | null;
  cloudapi_business_account_id: string | null;
  has_access_token?: boolean; // Never store actual token client-side
}

interface WhatsAppTemplate {
  id: string;
  user_id: string;
  name: string;
  category: string;
  language: string;
  header_type: string | null;
  header_content: string | null;
  body_text: string;
  footer_text: string | null;
  buttons: unknown;
  status: string;
  rejection_reason: string | null;
  meta_template_id: string | null;
  created_at: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading, signOut, profile, role, isSubscribed } = useAuth();

  // WhatsApp config state
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [provider, setProvider] = useState<WhatsAppProvider>('evolution');
  const [evolutionInstance, setEvolutionInstance] = useState('');
  const [cloudapiPhoneId, setCloudapiPhoneId] = useState('');
  const [cloudapiBusinessId, setCloudapiBusinessId] = useState('');
  const [cloudapiAccessToken, setCloudapiAccessToken] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [connectedPhoneInfo, setConnectedPhoneInfo] = useState<{ phoneNumber: string; verifiedName?: string } | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);

  // New template form state
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory>('MARKETING');
  const [templateLanguage, setTemplateLanguage] = useState('pt_BR');
  const [templateHeaderType, setTemplateHeaderType] = useState<HeaderType>(null);
  const [templateHeaderContent, setTemplateHeaderContent] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [templateFooter, setTemplateFooter] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Access control
  const isLoadingAccess = loading || (user && role === null);
  const isAdmin = role === 'admin';
  const hasAccess = isSubscribed || isAdmin;

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
    if (!loading && user && role !== null && !hasAccess) {
      navigate("/plans");
    }
  }, [user, loading, role, hasAccess, navigate]);

  // Validate Cloud API connection
  const validateConnection = async (silent: boolean = true) => {
    setConnectionStatus('loading');
    if (!silent) {
      setIsTestingConnection(true);
    }

    try {
      const { data, error } = await supabase.functions.invoke('test-whatsapp-connection');
      
      console.log('Connection validation response:', { data, error });
      
      if (error) {
        console.error('Error validating connection:', error);
        const errorMessage = data?.error || error.message || 'Erro ao validar conexão';
        setConnectionStatus('error');
        setConnectionMessage(errorMessage);
        setConnectedPhoneInfo(null);
        if (!silent) toast.error(errorMessage);
        return;
      }

      if (data?.success) {
        setConnectionStatus('success');
        setConnectionMessage(`Conectado! Número: ${data.phoneNumber}${data.verifiedName ? ` (${data.verifiedName})` : ''}`);
        setConnectedPhoneInfo({ phoneNumber: data.phoneNumber, verifiedName: data.verifiedName });
        if (!silent) toast.success('Conexão estabelecida com sucesso!');
      } else {
        setConnectionStatus('error');
        const errorMessage = data?.error || 'Erro desconhecido';
        setConnectionMessage(errorMessage);
        setConnectedPhoneInfo(null);
        if (!silent) toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error validating connection:', error);
      setConnectionStatus('error');
      setConnectionMessage('Erro ao validar conexão');
      setConnectedPhoneInfo(null);
      if (!silent) toast.error('Erro ao validar conexão');
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Load config via secure edge function (never fetches access token)
  useEffect(() => {
    const loadConfig = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('get-whatsapp-config');
        
        if (error) {
          console.error('Error loading config:', error);
          throw error;
        }

        if (data?.success && data?.config) {
          const configData = data.config;
          setConfig(configData);
          setProvider(configData.provider as WhatsAppProvider);
          setEvolutionInstance(configData.evolution_instance_name || '');
          setCloudapiPhoneId(configData.cloudapi_phone_number_id || '');
          setCloudapiBusinessId(configData.cloudapi_business_account_id || '');
          // Don't set access token - it's never returned from server
          setCloudapiAccessToken('');
          
          // Auto-validate Cloud API connection if token is configured
          if (configData.provider === 'cloudapi' && configData.has_access_token && configData.cloudapi_phone_number_id) {
            validateConnection(true);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar configuração:', error);
        toast.error('Erro ao carregar configuração');
      } finally {
        setIsLoadingConfig(false);
      }
    };

    loadConfig();
  }, [user]);

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTemplates(data || []);
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
        toast.error('Erro ao carregar templates');
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleSaveConfig = async () => {
    if (!user) return;

    setIsSavingConfig(true);
    try {
      const configData = {
        provider,
        evolution_instance_name: provider === 'evolution' ? evolutionInstance : null,
        cloudapi_phone_number_id: provider === 'cloudapi' ? cloudapiPhoneId : null,
        cloudapi_business_account_id: provider === 'cloudapi' ? cloudapiBusinessId : null,
        cloudapi_access_token: provider === 'cloudapi' ? cloudapiAccessToken : null,
      };

      const { data, error } = await supabase.functions.invoke('save-whatsapp-config', {
        body: configData
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao salvar configuração');
      }

      toast.success('Configuração salva com sucesso!');
      
      // Update config from response (without access token)
      if (data.config) {
        setConfig(data.config);
        // Clear the token input after saving (security: never display stored token)
        setCloudapiAccessToken('');
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config) {
      toast.error('Salve a configuração antes de testar a conexão');
      return;
    }
    await validateConnection(false);
  };

  const resetTemplateForm = () => {
    setTemplateName('');
    setTemplateCategory('MARKETING');
    setTemplateLanguage('pt_BR');
    setTemplateHeaderType(null);
    setTemplateHeaderContent('');
    setTemplateBody('');
    setTemplateFooter('');
    setEditingTemplate(null);
  };

  const handleOpenTemplateDialog = (template?: WhatsAppTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateName(template.name);
      setTemplateCategory(template.category as TemplateCategory);
      setTemplateLanguage(template.language);
      setTemplateHeaderType(template.header_type as HeaderType);
      setTemplateHeaderContent(template.header_content || '');
      setTemplateBody(template.body_text);
      setTemplateFooter(template.footer_text || '');
    } else {
      resetTemplateForm();
    }
    setIsTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!user || !templateName || !templateBody) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSavingTemplate(true);
    try {
      const templateData = {
        user_id: user.id,
        name: templateName,
        category: templateCategory,
        language: templateLanguage,
        header_type: templateHeaderType,
        header_content: templateHeaderType ? templateHeaderContent : null,
        body_text: templateBody,
        footer_text: templateFooter || null,
        status: 'pending' as TemplateStatus,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('whatsapp_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast.success('Template atualizado! Aguardando análise.');
      } else {
        const { error } = await supabase
          .from('whatsapp_templates')
          .insert(templateData);
        if (error) throw error;
        toast.success('Template criado! Aguardando análise.');
      }

      // Reload templates
      const { data } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setTemplates(data);

      setIsTemplateDialogOpen(false);
      resetTemplateForm();
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error('Erro ao salvar template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      setTemplates(templates.filter(t => t.id !== templateId));
      toast.success('Template excluído');
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      toast.error('Erro ao excluir template');
    }
  };

  const handleSyncTemplates = async () => {
    if (!user) return;
    
    setIsSyncingTemplates(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessão expirada');
        return;
      }

      const response = await supabase.functions.invoke('sync-whatsapp-templates', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      
      if (result.error) {
        toast.error(result.details || result.error);
        return;
      }

      // Reload templates from database
      const { data } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setTemplates(data);
      
      toast.success(`Sincronização concluída: ${result.synced} novos, ${result.updated} atualizados`);
    } catch (error) {
      console.error('Erro ao sincronizar templates:', error);
      toast.error('Erro ao sincronizar templates do Meta');
    } finally {
      setIsSyncingTemplates(false);
    }
  };

  const getStatusBadge = (status: TemplateStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="secondary" className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Rejeitado</Badge>;
    }
  };

  if (isLoadingAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!user || !hasAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/contacts')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              Configurações
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">
                {profile?.full_name || user?.email}
              </p>
              <p className="text-xs text-muted-foreground">
                {role === 'admin' ? 'Administrador' : 'Usuário'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-display font-bold text-foreground mb-6">
            Configurações
          </h1>

          <Tabs defaultValue="whatsapp" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Templates
              </TabsTrigger>
            </TabsList>

            {/* WhatsApp Config Tab */}
            <TabsContent value="whatsapp" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Provedor de WhatsApp</CardTitle>
                  <CardDescription>
                    Escolha como deseja enviar mensagens pelo WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingConfig ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      <RadioGroup value={provider} onValueChange={(v) => setProvider(v as WhatsAppProvider)}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Label
                            htmlFor="evolution"
                            className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              provider === 'evolution'
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <RadioGroupItem value="evolution" id="evolution" className="mt-1" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Smartphone className="w-5 h-5 text-green-400" />
                                <span className="font-semibold">Evolution API</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Conecte seu WhatsApp via QR Code. Mais flexível, sem necessidade de aprovação de templates.
                              </p>
                            </div>
                          </Label>

                          <Label
                            htmlFor="cloudapi"
                            className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              provider === 'cloudapi'
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <RadioGroupItem value="cloudapi" id="cloudapi" className="mt-1" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Cloud className="w-5 h-5 text-blue-400" />
                                <span className="font-semibold">Cloud API (Meta)</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                API oficial da Meta. Requer templates aprovados, maior confiabilidade.
                              </p>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>

                      {/* Evolution Config */}
                      {provider === 'evolution' && (
                        <div className="space-y-4 pt-4 border-t border-border">
                          <div className="space-y-2">
                            <Label htmlFor="evolution-instance">Nome da Instância</Label>
                            <Input
                              id="evolution-instance"
                              placeholder="Ex: minha-empresa"
                              value={evolutionInstance}
                              onChange={(e) => setEvolutionInstance(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Nome único para identificar sua conexão no Evolution
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Cloud API Config */}
                      {provider === 'cloudapi' && (
                        <div className="space-y-4 pt-4 border-t border-border">
                          <div className="space-y-2">
                            <Label htmlFor="phone-number-id">Phone Number ID</Label>
                            <Input
                              id="phone-number-id"
                              placeholder="Ex: 123456789012345"
                              value={cloudapiPhoneId}
                              onChange={(e) => setCloudapiPhoneId(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="business-id">Business Account ID</Label>
                            <Input
                              id="business-id"
                              placeholder="Ex: 123456789012345"
                              value={cloudapiBusinessId}
                              onChange={(e) => setCloudapiBusinessId(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="access-token">
                              Access Token
                              {config?.has_access_token && !cloudapiAccessToken && (
                                <Badge variant="outline" className="ml-2 text-green-500 border-green-500/30">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Configurado
                                </Badge>
                              )}
                            </Label>
                            <Input
                              id="access-token"
                              type="password"
                              placeholder={config?.has_access_token ? "••••••••••••••••••••" : "Seu token de acesso do Meta"}
                              value={cloudapiAccessToken}
                              onChange={(e) => setCloudapiAccessToken(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              {config?.has_access_token 
                                ? "Token já configurado. Deixe em branco para manter o atual ou insira um novo para atualizar."
                                : "Token permanente gerado no Meta Business Suite. Mantenha em segredo!"}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Encontre esses IDs no painel do Meta Business Suite
                          </p>
                          
                          {/* Connection Status */}
                          {connectionStatus !== 'idle' && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg ${
                              connectionStatus === 'success' 
                                ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                                : connectionStatus === 'loading'
                                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                : 'bg-red-500/10 text-red-500 border border-red-500/20'
                            }`}>
                              {connectionStatus === 'success' ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : connectionStatus === 'loading' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <AlertCircle className="w-4 h-4" />
                              )}
                              <span className="text-sm">
                                {connectionStatus === 'loading' 
                                  ? 'Verificando conexão...' 
                                  : connectionMessage}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button onClick={handleSaveConfig} disabled={isSavingConfig}>
                          {isSavingConfig ? 'Salvando...' : 'Salvar Configuração'}
                        </Button>
                        
                        {provider === 'cloudapi' && config && (
                          <Button 
                            variant="outline" 
                            onClick={handleTestConnection} 
                            disabled={isTestingConnection || !cloudapiPhoneId || !cloudapiAccessToken}
                          >
                            {isTestingConnection ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Testando...
                              </>
                            ) : (
                              'Testar Conexão'
                            )}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Templates de Mensagem</CardTitle>
                      <CardDescription>
                        {provider === 'cloudapi' 
                          ? 'Crie templates para usar com a Cloud API. Eles serão analisados antes de serem aprovados.'
                          : 'Crie templates de mensagens. Com Evolution API, não é necessário aprovação.'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {provider === 'cloudapi' && connectionStatus === 'success' && (
                        <Button 
                          variant="outline" 
                          onClick={handleSyncTemplates}
                          disabled={isSyncingTemplates}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncingTemplates ? 'animate-spin' : ''}`} />
                          {isSyncingTemplates ? 'Sincronizando...' : 'Sincronizar do Meta'}
                        </Button>
                      )}
                      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                        <DialogTrigger asChild>
                          <Button onClick={() => handleOpenTemplateDialog()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Template
                          </Button>
                        </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            {editingTemplate ? 'Editar Template' : 'Criar Novo Template'}
                          </DialogTitle>
                          <DialogDescription>
                            {provider === 'cloudapi' 
                              ? 'O template será enviado para análise após a criação.'
                              : 'Crie um template para suas mensagens.'}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="template-name">Nome do Template *</Label>
                            <Input
                              id="template-name"
                              placeholder="Ex: promocao_janeiro"
                              value={templateName}
                              onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                            />
                            <p className="text-xs text-muted-foreground">
                              Use apenas letras minúsculas, números e underline
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Categoria</Label>
                              <Select value={templateCategory} onValueChange={(v) => setTemplateCategory(v as TemplateCategory)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="MARKETING">Marketing</SelectItem>
                                  <SelectItem value="UTILITY">Utilitário</SelectItem>
                                  <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Idioma</Label>
                              <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pt_BR">Português (BR)</SelectItem>
                                  <SelectItem value="en_US">English (US)</SelectItem>
                                  <SelectItem value="es">Español</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Cabeçalho (opcional)</Label>
                            <Select 
                              value={templateHeaderType || 'none'} 
                              onValueChange={(v) => setTemplateHeaderType(v === 'none' ? null : v as HeaderType)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sem cabeçalho" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sem cabeçalho</SelectItem>
                                <SelectItem value="TEXT">Texto</SelectItem>
                                <SelectItem value="IMAGE">Imagem</SelectItem>
                                <SelectItem value="VIDEO">Vídeo</SelectItem>
                                <SelectItem value="DOCUMENT">Documento</SelectItem>
                              </SelectContent>
                            </Select>
                            {templateHeaderType === 'TEXT' && (
                              <Input
                                placeholder="Texto do cabeçalho"
                                value={templateHeaderContent}
                                onChange={(e) => setTemplateHeaderContent(e.target.value)}
                              />
                            )}
                            {templateHeaderType && templateHeaderType !== 'TEXT' && (
                              <Input
                                placeholder="URL do arquivo"
                                value={templateHeaderContent}
                                onChange={(e) => setTemplateHeaderContent(e.target.value)}
                              />
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="template-body">Corpo da Mensagem *</Label>
                            <Textarea
                              id="template-body"
                              placeholder="Olá {{1}}, temos uma novidade para você!"
                              value={templateBody}
                              onChange={(e) => setTemplateBody(e.target.value)}
                              rows={4}
                            />
                            <p className="text-xs text-muted-foreground">
                              Use {"{{1}}"}, {"{{2}}"}, etc. para variáveis dinâmicas
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="template-footer">Rodapé (opcional)</Label>
                            <Input
                              id="template-footer"
                              placeholder="Ex: Responda SAIR para não receber mais mensagens"
                              value={templateFooter}
                              onChange={(e) => setTemplateFooter(e.target.value)}
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button onClick={handleSaveTemplate} disabled={isSavingTemplate}>
                              {isSavingTemplate ? 'Salvando...' : editingTemplate ? 'Atualizar' : 'Criar Template'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingTemplates ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum template criado ainda</p>
                      <p className="text-sm">Clique em "Novo Template" para começar</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className="flex items-start justify-between p-4 rounded-xl border border-border bg-card/50"
                        >
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{template.name}</span>
                              {getStatusBadge(template.status as TemplateStatus)}
                              <Badge variant="outline" className="text-xs">
                                {template.category}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {template.body_text}
                            </p>
                            {template.status === 'rejected' && template.rejection_reason && (
                              <p className="text-sm text-red-400">
                                Motivo: {template.rejection_reason}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenTemplateDialog(template)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => handleDeleteTemplate(template.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
};

export default Settings;
