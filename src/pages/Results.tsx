import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { supabaseWiki } from "@/lib/supabaseWiki";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageSquare, 
  Phone, 
  Search, 
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  ExternalLink,
  Tag,
  Users,
  Send
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversation {
  id: string;
  contact_phone: string;
  contact_name: string | null;
  message_id: string | null;
  direction: string;
  message_type: string;
  message_content: string | null;
  campaign_id: string | null;
  status: string;
  created_at: string;
  read_at: string | null;
}

interface Campaign {
  id: string;
  name: string;
  template_name: string | null;
  contacts_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

interface ConversationGroup {
  contact_phone: string;
  contact_name: string | null;
  messages: Conversation[];
  lastMessage: Conversation;
  unreadCount: number;
  templateName?: string;
  templateBody?: string;
}

interface MessageQueueItem {
  contact_phone: string;
  campaign_id: string;
  template_name: string | null;
  template_body: string | null;
}

const Results = () => {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [messageQueue, setMessageQueue] = useState<MessageQueueItem[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (user) {
      fetchData();
      setupRealtime();
      
      // Set webhook URL
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'fwtgjrdwdhhrbxmlqbnn';
      setWebhookUrl(`https://${projectId}.supabase.co/functions/v1/whatsapp-webhook`);
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabaseWiki
        .from('whatsapp_campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (campaignsError) throw campaignsError;
      setCampaigns(campaignsData || []);
      
      // Fetch conversations
      const { data, error } = await supabaseWiki
        .from('whatsapp_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);

      // Fetch message queue for template info
      const { data: queueData, error: queueError } = await supabaseWiki
        .from('whatsapp_message_queue')
        .select('contact_phone, campaign_id, template_name, template_body')
        .eq('user_id', user.id);

      if (queueError) throw queueError;
      setMessageQueue(queueData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    const channel = supabaseWiki
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'wiki',
          table: 'whatsapp_conversations',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          console.log('New conversation:', payload);
          setConversations(prev => [payload.new as Conversation, ...prev]);
          toast({
            title: "Nova mensagem recebida!",
            description: `De: ${(payload.new as Conversation).contact_name || (payload.new as Conversation).contact_phone}`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'wiki',
          table: 'whatsapp_campaigns',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          setCampaigns(prev => [payload.new as Campaign, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabaseWiki.removeChannel(channel);
    };
  };

  // Filter conversations by selected campaign
  const filteredConversations = selectedCampaign === "all" 
    ? conversations 
    : conversations.filter(c => c.campaign_id === selectedCampaign);

  // Helper to normalize phone for matching - extract the core number (last 8 digits)
  // This handles format variations like 83991151056 vs 558391151056
  const normalizePhone = (phone: string) => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    // Get the last 8 digits (core number without DDD/country code variations)
    // This is the most reliable way to match phones with inconsistent formatting
    if (digits.length >= 8) {
      return digits.slice(-8);
    }
    return digits;
  };

  // Group conversations by contact
  const groupedConversations = filteredConversations.reduce((acc, conv) => {
    const phone = conv.contact_phone;
    if (!acc[phone]) {
      // Find template info from message queue
      const normalizedConvPhone = normalizePhone(phone);
      const queueItem = messageQueue.find(q => {
        const normalizedQueuePhone = normalizePhone(q.contact_phone);
        // Match by phone AND campaign if filtering, otherwise just phone
        const phoneMatch = normalizedConvPhone === normalizedQueuePhone;
        if (selectedCampaign !== "all") {
          return phoneMatch && q.campaign_id === selectedCampaign;
        }
        return phoneMatch && q.campaign_id === conv.campaign_id;
      });

      acc[phone] = {
        contact_phone: phone,
        contact_name: conv.contact_name,
        messages: [],
        lastMessage: conv,
        unreadCount: 0,
        templateName: queueItem?.template_name || undefined,
        templateBody: queueItem?.template_body || undefined
      };
    }
    acc[phone].messages.push(conv);
    if (!conv.read_at && conv.direction === 'inbound') {
      acc[phone].unreadCount++;
    }
    // Update contact name if we have a newer one
    if (conv.contact_name) {
      acc[phone].contact_name = conv.contact_name;
    }
    return acc;
  }, {} as Record<string, ConversationGroup>);

  const contactList = Object.values(groupedConversations)
    .filter(group => 
      group.contact_phone.includes(searchTerm) ||
      group.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => 
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );

  const selectedMessages = selectedContact 
    ? groupedConversations[selectedContact]?.messages.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ) || []
    : [];

  const markAsRead = async (contactPhone: string) => {
    if (!user) return;

    await supabaseWiki
      .from('whatsapp_conversations')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('contact_phone', contactPhone)
      .is('read_at', null);
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "URL copiada!",
      description: "Cole no painel do Meta Developer"
    });
  };

  // Stats based on filtered conversations
  const totalResponses = filteredConversations.filter(c => c.direction === 'inbound').length;
  const uniqueContacts = new Set(filteredConversations.map(c => c.contact_phone)).size;
  const unreadCount = filteredConversations.filter(c => c.direction === 'inbound' && !c.read_at).length;

  // Get current campaign name
  const currentCampaignName = selectedCampaign === "all" 
    ? "Todas as campanhas" 
    : campaigns.find(c => c.id === selectedCampaign)?.name || "Campanha";

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-20">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-6 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Faça login para continuar</h2>
              <p className="text-muted-foreground mb-4">
                Você precisa estar logado para ver as respostas das campanhas.
              </p>
              <Button onClick={() => window.location.href = '/login'}>
                Fazer Login
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Resultados das Campanhas</h1>
            <p className="text-muted-foreground">
              Visualize as respostas recebidas via WhatsApp
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            
            {/* Campaign Filter */}
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Selecionar campanha" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Todas as campanhas</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Campaign Info Card */}
        {selectedCampaign !== "all" && (
          <Card className="mb-6 bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{currentCampaignName}</span>
                </div>
                {(() => {
                  const campaign = campaigns.find(c => c.id === selectedCampaign);
                  if (!campaign) return null;
                  return (
                    <>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{campaign.contacts_count} contatos</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Send className="h-4 w-4" />
                        <span>{campaign.sent_count} enviadas</span>
                      </div>
                      {campaign.failed_count > 0 && (
                        <div className="flex items-center gap-2 text-sm text-destructive">
                          <XCircle className="h-4 w-4" />
                          <span>{campaign.failed_count} falhas</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalResponses}</p>
                <p className="text-sm text-muted-foreground">Respostas recebidas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Phone className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueContacts}</p>
                <p className="text-sm text-muted-foreground">Contatos únicos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <Clock className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreadCount}</p>
                <p className="text-sm text-muted-foreground">Não lidas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="conversations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
            <TabsTrigger value="conversations">Conversas</TabsTrigger>
            <TabsTrigger value="webhook">Configurar Webhook</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Campanhas</CardTitle>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <div className="text-center py-12">
                    <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">Nenhuma campanha enviada ainda</p>
                    <p className="text-sm text-muted-foreground">Vá para Contatos e envie sua primeira campanha</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {campaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedCampaign === campaign.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedCampaign(campaign.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{campaign.name}</h3>
                            {campaign.template_name && (
                              <p className="text-sm text-muted-foreground">
                                Template: {campaign.template_name}
                              </p>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {campaign.contacts_count}
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600/30">
                            <CheckCircle className="h-3 w-3" />
                            {campaign.sent_count}
                          </Badge>
                          {campaign.failed_count > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1 text-destructive border-destructive/30">
                              <XCircle className="h-3 w-3" />
                              {campaign.failed_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversations">
            <Card className="overflow-hidden">
              <div className="grid md:grid-cols-3 h-[600px]">
                {/* Contact list */}
                <div className="border-r">
                  <div className="p-4 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar contato..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <ScrollArea className="h-[536px]">
                    {loading ? (
                      <div className="p-4 text-center">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </div>
                    ) : contactList.length === 0 ? (
                      <div className="p-8 text-center">
                        <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {selectedCampaign === "all" 
                            ? "Nenhuma resposta recebida ainda" 
                            : "Nenhuma resposta nesta campanha"}
                        </p>
                      </div>
                    ) : (
                      contactList.map((group) => (
                        <div
                          key={group.contact_phone}
                          className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedContact === group.contact_phone ? 'bg-muted' : ''
                          }`}
                          onClick={() => {
                            setSelectedContact(group.contact_phone);
                            markAsRead(group.contact_phone);
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {group.contact_name || group.contact_phone}
                              </p>
                              {group.contact_name && (
                                <p className="text-xs text-muted-foreground">
                                  {group.contact_phone}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground truncate mt-1">
                                {group.lastMessage.direction === 'inbound' ? (
                                  <ArrowDownLeft className="inline h-3 w-3 mr-1" />
                                ) : (
                                  <ArrowUpRight className="inline h-3 w-3 mr-1" />
                                )}
                                {group.lastMessage.message_content || '[Mídia]'}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(group.lastMessage.created_at), 'HH:mm', { locale: ptBR })}
                              </span>
                              {group.unreadCount > 0 && (
                                <Badge variant="default" className="h-5 min-w-[20px] flex items-center justify-center">
                                  {group.unreadCount}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </div>

                {/* Messages */}
                <div className="md:col-span-2 flex flex-col">
                  {selectedContact ? (
                    <>
                      <div className="p-4 border-b bg-muted/30">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">
                              {groupedConversations[selectedContact]?.contact_name || selectedContact}
                            </p>
                            <p className="text-sm text-muted-foreground">{selectedContact}</p>
                          </div>
                          {groupedConversations[selectedContact]?.templateName && (
                            <div className="text-right">
                              <Badge variant="outline" className="mb-1">
                                <Tag className="h-3 w-3 mr-1" />
                                {groupedConversations[selectedContact].templateName}
                              </Badge>
                            </div>
                          )}
                        </div>
                        {groupedConversations[selectedContact]?.templateBody && (
                          <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                            <p className="text-xs text-muted-foreground mb-1 font-medium">Template enviado:</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {groupedConversations[selectedContact].templateBody}
                            </p>
                          </div>
                        )}
                      </div>
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-3">
                          {selectedMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] p-3 rounded-lg ${
                                  msg.direction === 'outbound'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">
                                  {msg.message_content || '[Mídia]'}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs opacity-70">
                                    {format(new Date(msg.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                                  </span>
                                  {msg.direction === 'outbound' && (
                                    msg.status === 'sent' || msg.status === 'delivered' ? (
                                      <CheckCircle className="h-3 w-3 opacity-70" />
                                    ) : msg.status === 'failed' ? (
                                      <XCircle className="h-3 w-3 opacity-70" />
                                    ) : null
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Selecione uma conversa para ver as mensagens</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="webhook">
            <Card>
              <CardHeader>
                <CardTitle>Configurar Webhook no Meta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">URL do Webhook</h3>
                  <div className="flex gap-2">
                    <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                    <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Como configurar:</h3>
                  <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                    <li>
                      Acesse o <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        Meta Developer Portal <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                    <li>Vá para seu aplicativo {">"} WhatsApp {">"} Configuração</li>
                    <li>Em "Webhook", clique em "Editar"</li>
                    <li>Cole a URL do webhook acima</li>
                    <li>No campo "Token de verificação", coloque qualquer valor (ex: "meu_token_secreto")</li>
                    <li>Clique em "Verificar e salvar"</li>
                    <li>
                      Inscreva-se nos campos:
                      <ul className="list-disc list-inside ml-4 mt-2">
                        <li><code className="bg-muted px-1 rounded">messages</code> - Para receber mensagens</li>
                        <li><code className="bg-muted px-1 rounded">message_status</code> - Para status de entrega</li>
                      </ul>
                    </li>
                  </ol>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg">
                  <h4 className="font-medium text-amber-600 mb-2">⚠️ Importante</h4>
                  <p className="text-sm text-muted-foreground">
                    Para receber mensagens de resposta, você precisa configurar o webhook no painel do Meta.
                    As mensagens recebidas aparecerão automaticamente nesta página.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Results;
