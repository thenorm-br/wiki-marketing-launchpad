import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseContactsFile } from "@/lib/contactsImport";
import { useAuth } from "@/contexts/AuthContext";

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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
    // Redirect to plans if not subscribed
    if (!loading && user && !isSubscribed) {
      navigate("/plans");
    }
  }, [user, loading, isSubscribed, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isSubscribed) {
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
  };

  const deleteContact = (id: string) => {
    setContacts(contacts.filter((c) => c.id !== id));
  };

  const selectedContactsCount = contacts.filter((c) => c.selected).length;

  const handleExecuteActions = async () => {
    const selectedContacts = contacts.filter((c) => c.selected);
    console.log("Executando ações:", selectedActions, "para contatos:", selectedContacts);

    // Se a ação "call" (Ligar) estiver selecionada, envia para o webhook n8n
    if (selectedActions.includes("call")) {
      try {
        const payload = {
          action: "call",
          contacts: selectedContacts.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
          })),
          timestamp: new Date().toISOString(),
        };

        const response = await fetch(
          "https://n8neditor.faesde.com.br/webhook/send-rabbit",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          console.error("Erro ao enviar para webhook:", response.statusText);
        } else {
          console.log("Contatos enviados para webhook com sucesso!");
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
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">
                {profile?.name || user?.email}
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
                      onClick={handleExecuteActions}
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
      </main>
    </div>
  );
};

export default Contacts;
