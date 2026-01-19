import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Send, Tag } from "lucide-react";

interface CampaignNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  contactsCount: number;
}

export const CampaignNameModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  contactsCount 
}: CampaignNameModalProps) => {
  const [campaignName, setCampaignName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (campaignName.trim()) {
      onConfirm(campaignName.trim());
      setCampaignName("");
    }
  };

  const handleClose = () => {
    setCampaignName("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Tag className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Nome da Campanha</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="campaign-name">
                  Dê um nome para identificar este envio
                </Label>
                <Input
                  id="campaign-name"
                  placeholder="Ex: Black Friday 2024, Lançamento Produto..."
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="mt-2"
                  autoFocus
                />
              </div>

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>{contactsCount}</strong> contatos serão incluídos nesta campanha
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="hero"
                  disabled={!campaignName.trim()}
                  className="flex-1"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Campanha
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
