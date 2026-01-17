import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ExternalLink
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

interface ConversationGroup {
  contact_phone: string;
  contact_name: string | null;
  messages: Conversation[];
  lastMessage: Conversation;
  unreadCount: number;
}

const Results = () => {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (user) {
      fetchConversations();
      setupRealtime();
      
      // Set webhook URL
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'fwtgjrdwdhhrbxmlqbnn';
      setWebhookUrl(`https://${projectId}.supabase.co/functions/v1/whatsapp-webhook`);
    }
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      toast({
        title: "Erro ao carregar conversas",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Group conversations by contact
  const groupedConversations = conversations.reduce((acc, conv) => {
    const phone = conv.contact_phone;
    if (!acc[phone]) {
      acc[phone] = {
        contact_phone: phone,
        contact_name: conv.contact_name,
        messages: [],
        lastMessage: conv,
        unreadCount: 0
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

    await supabase
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

  // Stats
  const totalResponses = conversations.filter(c => c.direction === 'inbound').length;
  const uniqueContacts = new Set(conversations.map(c => c.contact_phone)).size;
  const unreadCount = conversations.filter(c => c.direction === 'inbound' && !c.read_at).length;

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Resultados das Campanhas</h1>
          <p className="text-muted-foreground">
            Visualize as respostas recebidas via WhatsApp
          </p>
        </div>

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
            <TabsTrigger value="conversations">Conversas</TabsTrigger>
            <TabsTrigger value="webhook">Configurar Webhook</TabsTrigger>
          </TabsList>

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
                          Nenhuma resposta recebida ainda
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
                        <p className="font-medium">
                          {groupedConversations[selectedContact]?.contact_name || selectedContact}
                        </p>
                        <p className="text-sm text-muted-foreground">{selectedContact}</p>
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

                <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    <strong>Importante:</strong> Após configurar o webhook, as respostas das suas campanhas 
                    aparecerão automaticamente nesta página em tempo real.
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