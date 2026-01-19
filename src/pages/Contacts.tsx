import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  MessageCircle,
  Mail,
  Phone,
  Send,
  CheckCircle2,
  X,
  Download,
  Users,
  LogOut,
  Mic,
  Music,
  Settings,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { parseContactsFile } from "@/lib/contactsImport";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { supabaseWiki } from "@/lib/supabaseWiki";
import { CampaignNameModal } from "@/components/CampaignNameModal";
import { toast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  selected: boolean;
}

interface Action {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const availableActions: Action[] = [
  {
    id: "whatsapp",
    label: "Enviar WhatsApp",
    icon: <MessageCircle className="w-4 h-4" />,
    color: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  {
    id: "email",
    label: "Enviar E-mail",
    icon: <Mail className="w-4 h-4" />,
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  {
    id: "call",
    label: "Ligar",
    icon: <Phone className="w-4 h-4" />,
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
  {
    id: "sms",
    label: "Enviar SMS",
    icon: <Send className="w-4 h-4" />,
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
];

const Contacts = () => {
  const navigate = useNavigate();
  const { user, loading, signOut, profile, role, isSubscribed } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Audio upload states
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [uploadedAudioPath, setUploadedAudioPath] = useState<string | null>(null);

  // WhatsApp template selection
  interface WhatsAppTemplate {
    id: string;
    name: string;
    body_text: string;
    status: string;
  }
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [whatsappProvider, setWhatsappProvider] = useState<string | null>(null);
  
  // Variable mapping for templates
  type VariableSource = 'name' | 'phone' | 'email' | 'custom';
  interface VariableMapping {
    variable: string;
    source: VariableSource;
    customValue?: string;
  }
  const [variableMappings, setVariableMappings] = useState<VariableMapping[]>([]);

  // Campaign name modal
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const extractTemplateVariables = (body: string): string[] => {
    const matches = body.match(/\{\{\d+\}\}/g) || [];
    return [...new Set(matches)].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''));
      const numB = parseInt(b.replace(/\D/g, ''));
      return numA - numB;
    });
  };

  // Update variable mappings when template changes
  useEffect(() => {
    if (selectedTemplateId) {
      const template = whatsappTemplates.find(t => t.id === selectedTemplateId);
      if (template) {
        const variables = extractTemplateVariables(template.body_text);
        const newMappings: VariableMapping[] = variables.map((v, index) => ({
          variable: v,
          source: index === 0 ? 'name' : 'custom', // Default first variable to name
          customValue: '',
        }));
        setVariableMappings(newMappings);
      }
    } else {
      setVariableMappings([]);
    }
  }, [selectedTemplateId, whatsappTemplates]);

  // Aguarda carregar profile/role antes de decidir acesso
  const isLoadingAccess = loading || (user && role === null);
  const isAdmin = role === 'admin';
  const hasAccess = isSubscribed || isAdmin;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
    // Redirect to plans APENAS após verificar role (não redireciona enquanto role é null)
    if (!loading && user && role !== null && !hasAccess) {
      navigate("/plans");
    }
  }, [user, loading, role, hasAccess, navigate]);

  // Load WhatsApp config and templates
  useEffect(() => {
    const loadWhatsAppData = async () => {
      if (!user) return;

      try {
        // Load provider config
        const { data: configData } = await supabaseWiki
          .from('whatsapp_config')
          .select('provider')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (configData) {
          setWhatsappProvider(configData.provider);
        }

        // Load approved templates
        const { data: templatesData } = await supabaseWiki
          .from('whatsapp_templates')
          .select('id, name, body_text, status')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .order('name');
        
        if (templatesData) {
          setWhatsappTemplates(templatesData);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do WhatsApp:', error);
      }
    };

    loadWhatsAppData();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Mostra loading enquanto carrega auth OU enquanto carrega role
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
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setUploadedFileName(file.name);
    setFileError(null);
    setIsParsingFile(true);

    try {
      const imported = await parseContactsFile(file);

      const parsedContacts: Contact[] = imported.map((row, index) => ({
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}`,
        name: row.name,
        phone: row.phone,
        email: row.email,
        selected: false,
      }));

      setContacts(parsedContacts);
    } catch (err) {
      console.error("Erro ao importar contatos:", err);
      setContacts([]);
      setFileError(
        err instanceof Error ? err.message : "Não foi possível ler o arquivo."
      );
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const toggleContact = (id: string) => {
    setContacts(
      contacts.map((c) =>
        c.id === id ? { ...c, selected: !c.selected } : c
      )
    );
  };

  const toggleAllContacts = () => {
    const allSelected = contacts.every((c) => c.selected);
    setContacts(contacts.map((c) => ({ ...c, selected: !allSelected })));
  };

  const toggleAction = (actionId: string) => {
    setSelectedActions((prev) =>
      prev.includes(actionId)
        ? prev.filter((a) => a !== actionId)
        : [...prev, actionId]
    );
    // Se deselecionar "call", limpar o áudio
    if (actionId === 'call' && selectedActions.includes('call')) {
      setAudioFile(null);
      setAudioFileName(null);
      setAudioError(null);
      setUploadedAudioPath(null);
    }
  };

  const deleteContact = (id: string) => {
    setContacts(contacts.filter((c) => c.id !== id));
  };

  const selectedContactsCount = contacts.filter((c) => c.selected).length;

  // Validar duração do áudio (max 1 minuto)
  const validateAudioDuration = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        window.URL.revokeObjectURL(audio.src);
        if (audio.duration > 60) {
          setAudioError('O áudio deve ter no máximo 1 minuto de duração.');
          resolve(false);
        } else {
          resolve(true);
        }
      };
      audio.onerror = () => {
        setAudioError('Erro ao processar o arquivo de áudio.');
        resolve(false);
      };
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAudioError(null);
    setAudioFileName(file.name);
    
    // Validar duração
    const isValid = await validateAudioDuration(file);
    if (!isValid) {
      setAudioFileName(null);
      return;
    }

    setAudioFile(file);
    setIsUploadingAudio(true);

    try {
      // Upload para storage: pasta = user_id
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('call-audios')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.error('Erro ao fazer upload:', error);
        setAudioError('Erro ao fazer upload do áudio. Tente novamente.');
        setAudioFile(null);
        setAudioFileName(null);
      } else {
        console.log('Áudio enviado com sucesso:', data.path);
        setUploadedAudioPath(data.path);
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      setAudioError('Erro ao fazer upload do áudio. Tente novamente.');
      setAudioFile(null);
      setAudioFileName(null);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const removeAudio = () => {
    setAudioFile(null);
    setAudioFileName(null);
    setAudioError(null);
    setUploadedAudioPath(null);
  };

  // Open campaign modal instead of executing directly
  const handleExecuteClick = () => {
    const selectedContacts = contacts.filter((c) => c.selected);
    
    if (selectedActions.includes('call') && !uploadedAudioPath) {
      setAudioError('Por favor, envie um áudio para a ligação antes de executar.');
      return;
    }
    
    if (selectedActions.length > 0 && selectedContacts.length > 0) {
      setShowCampaignModal(true);
    }
  };

  const handleExecuteActions = async (campaignName: string) => {
    setShowCampaignModal(false);
    const selectedContacts = contacts.filter((c) => c.selected);
    console.log("Executando ações:", selectedActions, "para contatos:", selectedContacts);

    // Envia para o webhook n8n com todas as ações selecionadas
    if (selectedActions.length > 0 && selectedContacts.length > 0) {
      try {
        // Gerar URL assinada do áudio (válida por 1 hora)
        let callAudioUrl: string | null = null;
        if (uploadedAudioPath && selectedActions.includes('call')) {
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('call-audios')
            .createSignedUrl(uploadedAudioPath, 3600); // 3600 segundos = 1 hora
          
          if (signedUrlError) {
            console.error('Erro ao gerar URL assinada:', signedUrlError);
            setAudioError('Erro ao processar áudio. Tente novamente.');
            return;
          }
          callAudioUrl = signedUrlData.signedUrl;
        }

        // Gerar ID de campanha único para WhatsApp
        const campaignId = selectedActions.includes('whatsapp') 
          ? `campaign_${user?.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
          : null;

        // Encontrar template selecionado
        const selectedTemplate = selectedTemplateId 
          ? whatsappTemplates.find(t => t.id === selectedTemplateId)
          : null;

        // Create campaign record in database
        if (campaignId && user) {
          const { error: campaignError } = await supabaseWiki
            .from('whatsapp_campaigns')
            .insert({
              id: campaignId,
              user_id: user.id,
              name: campaignName,
              template_id: selectedTemplateId || null,
              template_name: selectedTemplate?.name || null,
              contacts_count: selectedContacts.length,
            });
          
          if (campaignError) {
            console.error('Erro ao criar campanha:', campaignError);
            toast({
              title: "Erro ao criar campanha",
              description: campaignError.message,
              variant: "destructive"
            });
            return;
          }
        }

        const payload = {
          user_id: user?.id, // ID da conta do usuário logado
          user_email: user?.email, // Email do usuário logado
          actions: selectedActions, // Array com todas as ações: ["whatsapp", "email", "call", "sms"]
          id_campanha: campaignId, // ID único da campanha (gerado para WhatsApp)
          campaign_name: campaignName, // Nome da campanha
          whatsapp_provider: whatsappProvider, // 'evolution' ou 'cloudapi'
          whatsapp_template_id: selectedTemplateId, // ID do template (se Cloud API)
          whatsapp_template_name: selectedTemplate?.name || null, // Nome do template
          whatsapp_template_body: selectedTemplate?.body_text || null, // Corpo do template
          call_audio_url: callAudioUrl, // URL assinada do áudio (válida por 1 hora)
          call_audio_path: uploadedAudioPath, // Caminho original no storage (backup)
          contacts: selectedContacts.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
          })),
          timestamp: new Date().toISOString(),
        };

        // Se WhatsApp está selecionado e é Cloud API, envia diretamente pela Edge Function
        if (selectedActions.includes('whatsapp') && whatsappProvider === 'cloudapi') {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              console.error('Sessão expirada');
              return;
            }

            const whatsappContacts = selectedContacts.map(c => ({
              name: c.name,
              phone: c.phone,
              email: c.email,
            }));

            // Build variable mappings for the API
            const variableMappingsPayload = variableMappings.map(m => ({
              variable: m.variable,
              source: m.source,
              customValue: m.customValue || '',
            }));

            const response = await supabase.functions.invoke('send-whatsapp-messages', {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              body: {
                campaign_id: campaignId,
                contacts: whatsappContacts,
                template_name: selectedTemplate?.name || null,
                template_body: selectedTemplate?.body_text || 'Olá!',
                variable_mappings: variableMappingsPayload,
              },
            });

            if (response.error) {
              console.error('Erro ao enviar WhatsApp:', response.error);
              toast({
                title: "Erro no envio",
                description: response.error.message,
                variant: "destructive"
              });
            } else {
              console.log('Campanha WhatsApp enviada!', response.data);
              console.log(`Enviadas: ${response.data.sent}, Falhas: ${response.data.failed}`);
              
              // Update campaign stats
              if (campaignId && user) {
                await supabase
                  .from('whatsapp_campaigns')
                  .update({
                    sent_count: response.data.sent || 0,
                    failed_count: response.data.failed || 0,
                  })
                  .eq('id', campaignId);
              }
              
              toast({
                title: "Campanha enviada!",
                description: `${response.data.sent} mensagens enviadas com sucesso.`,
              });
            }
          } catch (error) {
            console.error('Erro ao enviar WhatsApp via Edge Function:', error);
          }
        } else if (selectedActions.includes('whatsapp')) {
          // Fallback para n8n se não for Cloud API
          const whatsappWebhook = "https://n8neditor.faesde.com.br/webhook/15f0c5d3-49d2-4bbb-b318-704d016cbbd5";
          const whatsappResponse = await fetch(whatsappWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!whatsappResponse.ok) {
            console.error("Erro ao enviar para webhook WhatsApp:", whatsappResponse.statusText);
          } else {
            console.log("Campanha WhatsApp enviada com sucesso! ID:", campaignId);
          }
        }

        // Se há outras ações além de WhatsApp, envia para o webhook padrão
        const otherActions = selectedActions.filter(a => a !== 'whatsapp');
        if (otherActions.length > 0) {
          const defaultWebhook = "https://n8neditor.faesde.com.br/webhook/send-rabbit";
          const otherPayload = { ...payload, actions: otherActions };
          const response = await fetch(defaultWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(otherPayload),
          });

          if (!response.ok) {
            console.error("Erro ao enviar para webhook:", response.statusText);
          } else {
            console.log("Outras ações enviadas com sucesso!");
          }
        }
      } catch (error) {
        console.error("Erro ao enviar para webhook:", error);
      }
    }

    setIsProcessing(true);
  };


  // Processing Modal
  if (isProcessing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-12 text-center max-w-lg mx-4"
        >
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Send className="w-10 h-10 text-primary" />
            </motion.div>
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-4">
            SUA SOLICITAÇÃO ESTÁ SENDO PROCESSADA
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            ENVIAREMOS O RELATÓRIO POR EMAIL
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setIsProcessing(false);
              setContacts([]);
              setSelectedActions([]);
              setUploadedFileName(null);
              setFileError(null);
              setIsParsingFile(false);
              // Limpar estado do áudio
              setAudioFile(null);
              setAudioFileName(null);
              setAudioError(null);
              setUploadedAudioPath(null);
            }}
          >
            Fazer Nova Solicitação
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2">
              <span className="text-xl font-display font-bold">
                <span className="text-primary">Wiki</span>
                <span className="text-foreground"> Marketing</span>
              </span>
            </a>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">Gerenciador de Contatos</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Atalho visível para Resultados (evita depender do dropdown) */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/results")}
              aria-label="Ver resultados"
              className="sm:hidden"
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/results")}
              className="hidden sm:inline-flex"
            >
              <MessageSquare className="w-4 h-4" />
              Resultados
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {profile?.full_name || user?.email}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="text-xs text-muted-foreground">
                  {role === 'admin' ? 'Administrador' : 'Usuário'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/results')} className="cursor-pointer">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Resultados
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Upload Section */}
          <div className="mb-8">
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">
              Upload de Contatos
            </h1>
            <p className="text-muted-foreground mb-6">
              Faça upload da sua lista de contatos em formato CSV ou Excel
            </p>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300
                ${isDragging 
                  ? "border-primary bg-primary/10" 
                  : "border-border/50 hover:border-primary/50 hover:bg-card/50"
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
              
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-foreground font-medium mb-1">
                    Arraste e solte seu arquivo aqui
                  </p>
                  <p className="text-muted-foreground text-sm">
                    ou clique para selecionar (CSV, Excel)
                  </p>
                </div>
                {uploadedFileName && (
                  <div className="flex items-center gap-2 bg-primary/20 text-primary px-4 py-2 rounded-full">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="text-sm font-medium">{uploadedFileName}</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}

                {isParsingFile && (
                  <p className="text-sm text-muted-foreground">
                    Importando contatos do arquivo...
                  </p>
                )}

                {fileError && (
                  <p className="text-sm text-destructive">{fileError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <AnimatePresence>
            {contacts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8"
              >
                <h2 className="text-xl font-display font-bold text-foreground mb-4">
                  Selecione as Ações
                </h2>
                <div className="flex flex-wrap gap-3">
                  {availableActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => toggleAction(action.id)}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200
                        ${selectedActions.includes(action.id)
                          ? action.color
                          : "border-border/50 text-muted-foreground hover:border-primary/50"
                        }
                      `}
                    >
                      {action.icon}
                      <span className="text-sm font-medium">{action.label}</span>
                      {selectedActions.includes(action.id) && (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Template Selection for WhatsApp (Cloud API) */}
                <AnimatePresence>
                  {selectedActions.includes('whatsapp') && whatsappProvider === 'cloudapi' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4"
                    >
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <MessageCircle className="w-5 h-5 text-green-400" />
                          <h3 className="text-sm font-semibold text-green-300">
                            Template de Mensagem
                          </h3>
                        </div>

                        {whatsappTemplates.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            <p>Nenhum template aprovado disponível.</p>
                            <Button 
                              variant="link" 
                              className="text-green-400 p-0 h-auto"
                              onClick={() => navigate('/settings')}
                            >
                              Criar templates nas Configurações
                            </Button>
                          </div>
                        ) : (
                          <Select 
                            value={selectedTemplateId || ''} 
                            onValueChange={setSelectedTemplateId}
                          >
                            <SelectTrigger className="bg-green-500/10 border-green-500/30 text-green-300">
                              <SelectValue placeholder="Selecione um template" />
                            </SelectTrigger>
                            <SelectContent>
                              {whatsappTemplates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {selectedTemplateId && (
                          <div className="mt-3 space-y-3">
                            <div className="p-3 bg-card/50 rounded-lg border border-border/50">
                              <p className="text-xs text-muted-foreground mb-1">Prévia:</p>
                              <p className="text-sm text-foreground">
                                {whatsappTemplates.find(t => t.id === selectedTemplateId)?.body_text}
                              </p>
                            </div>

                            {/* Variable Mapping */}
                            {variableMappings.length > 0 && (
                              <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                                <p className="text-xs text-yellow-400 font-medium mb-3">
                                  ⚠️ Este template possui variáveis. Mapeie cada uma:
                                </p>
                                <div className="space-y-2">
                                  {variableMappings.map((mapping, index) => (
                                    <div key={mapping.variable} className="flex items-center gap-2">
                                      <span className="text-sm font-mono bg-yellow-500/20 px-2 py-1 rounded text-yellow-300 min-w-[50px] text-center">
                                        {mapping.variable}
                                      </span>
                                      <span className="text-muted-foreground text-sm">=</span>
                                      <Select
                                        value={mapping.source}
                                        onValueChange={(value: VariableSource) => {
                                          const newMappings = [...variableMappings];
                                          newMappings[index] = { ...mapping, source: value };
                                          setVariableMappings(newMappings);
                                        }}
                                      >
                                        <SelectTrigger className="w-[140px] bg-card/50 border-yellow-500/30">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="name">Nome</SelectItem>
                                          <SelectItem value="phone">Telefone</SelectItem>
                                          <SelectItem value="email">E-mail</SelectItem>
                                          <SelectItem value="custom">Texto fixo</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {mapping.source === 'custom' && (
                                        <Input
                                          placeholder="Valor fixo"
                                          className="flex-1 bg-card/50 border-yellow-500/30"
                                          value={mapping.customValue || ''}
                                          onChange={(e) => {
                                            const newMappings = [...variableMappings];
                                            newMappings[index] = { ...mapping, customValue: e.target.value };
                                            setVariableMappings(newMappings);
                                          }}
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {selectedActions.includes('call') && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4"
                    >
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Mic className="w-5 h-5 text-purple-400" />
                          <h3 className="text-sm font-semibold text-purple-300">
                            Áudio para Ligação
                          </h3>
                          <span className="text-xs text-muted-foreground">(máx. 1 minuto)</span>
                        </div>

                        <input
                          ref={audioInputRef}
                          type="file"
                          accept="audio/*"
                          onChange={handleAudioUpload}
                          className="hidden"
                        />

                        {!audioFileName ? (
                          <button
                            onClick={() => audioInputRef.current?.click()}
                            disabled={isUploadingAudio}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-lg transition-all duration-200 text-purple-300"
                          >
                            <Music className="w-4 h-4" />
                            <span className="text-sm">Enviar Áudio</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-purple-500/20 text-purple-300 px-4 py-2 rounded-lg">
                              <Music className="w-4 h-4" />
                              <span className="text-sm font-medium truncate max-w-[200px]">
                                {audioFileName}
                              </span>
                              {isUploadingAudio ? (
                                <div className="w-4 h-4 border-2 border-purple-300/30 border-t-purple-300 rounded-full animate-spin" />
                              ) : uploadedAudioPath ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                              ) : null}
                            </div>
                            <button
                              onClick={removeAudio}
                              className="p-2 hover:bg-destructive/20 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        )}

                        {audioError && (
                          <p className="text-sm text-destructive mt-2">{audioError}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Contacts Table */}
          <AnimatePresence>
            {contacts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden"
              >
                {/* Table Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-5 h-5" />
                      <span>{contacts.length} contatos</span>
                    </div>
                    {selectedContactsCount > 0 && (
                      <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm">
                        {selectedContactsCount} selecionados
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setContacts([]);
                        setUploadedFileName(null);
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Limpar
                    </Button>
                    <Button
                      variant="hero"
                      size="sm"
                      disabled={selectedContactsCount === 0 || selectedActions.length === 0}
                      onClick={handleExecuteClick}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Executar Ações
                    </Button>
                  </div>
                </div>

                {/* Table */}
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={contacts.every((c) => c.selected)}
                          onCheckedChange={toggleAllContacts}
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact, index) => (
                      <motion.tr
                        key={contact.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`
                          border-b border-border/30 transition-colors
                          ${contact.selected ? "bg-primary/5" : "hover:bg-card/80"}
                        `}
                      >
                        <TableCell>
                          <Checkbox
                            checked={contact.selected}
                            onCheckedChange={() => toggleContact(contact.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {contact.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact.phone}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact.email}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => deleteContact(contact.id)}
                            className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty State */}
          {contacts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum contato carregado ainda.</p>
              <p className="text-sm">Faça upload de um arquivo para começar.</p>
            </div>
          )}
        </motion.div>

        {/* Campaign Name Modal */}
        <CampaignNameModal
          isOpen={showCampaignModal}
          onClose={() => setShowCampaignModal(false)}
          onConfirm={handleExecuteActions}
          contactsCount={contacts.filter(c => c.selected).length}
        />
      </main>
    </div>
  );
};

export default Contacts;
