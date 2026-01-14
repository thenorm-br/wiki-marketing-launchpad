import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Crown, Zap, Shield, AlertCircle, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const plans = [
  {
    id: "basic",
    name: "Básico",
    price: "R$ 49",
    period: "/mês",
    description: "Perfeito para começar",
    icon: <Zap className="w-6 h-6" />,
    features: [
      "Até 500 contatos",
      "Envio de WhatsApp",
      "Envio de E-mail",
      "Suporte por e-mail",
    ],
    popular: false,
  },
  {
    id: "pro",
    name: "Profissional",
    price: "R$ 99",
    period: "/mês",
    description: "Para equipes em crescimento",
    icon: <Crown className="w-6 h-6" />,
    features: [
      "Até 5.000 contatos",
      "Todas as ações disponíveis",
      "Integração com n8n",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Empresarial",
    price: "R$ 249",
    period: "/mês",
    description: "Para grandes operações",
    icon: <Shield className="w-6 h-6" />,
    features: [
      "Contatos ilimitados",
      "API completa",
      "Múltiplos usuários",
      "Webhooks personalizados",
      "Gerente de conta dedicado",
      "SLA garantido",
    ],
    popular: false,
  },
];

const Plans = () => {
  const { user, loading, isSubscribed, isEmailConfirmed, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const isAdmin = role === 'admin';

  useEffect(() => {
    // Admins e assinantes logados vão direto para contacts
    if (!loading && user && (isSubscribed || isAdmin)) {
      navigate("/contacts");
    }
  }, [user, loading, isSubscribed, isAdmin, navigate]);

  const handleSelectPlan = (planId: string) => {
    console.log("Plano selecionado:", planId);
    alert(`Integração com pagamento em breve! Plano: ${planId}`);
  };

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

  return (
    <div className="min-h-screen bg-background">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
      </div>

      <div className="relative container mx-auto px-4 py-12">
        {/* Logout Button - só mostra se logado */}
        {user && (
          <div className="absolute top-4 right-4">
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <a href="/" className="inline-block mb-8">
            <span className="text-3xl font-display font-bold">
              <span className="text-primary">Wiki</span>
              <span className="text-foreground"> Marketing</span>
            </span>
          </a>

          <h1 className="text-4xl font-display font-bold text-foreground mb-4">
            {user ? `Olá, ${profile?.name || "usuário"}! 👋` : "Nossos Planos"}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Escolha o plano ideal para você e comece a gerenciar seus contatos de forma profissional
          </p>
        </motion.div>

        {/* Email Confirmation Warning - só mostra se logado e email não confirmado */}
        {user && !isEmailConfirmed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto mb-8"
          >
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-500 font-medium">Confirme seu e-mail</p>
                <p className="text-yellow-500/80 text-sm">
                  Para ter acesso completo após a assinatura, confirme seu e-mail clicando no link que enviamos.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative bg-card/50 backdrop-blur-xl border rounded-2xl p-8
                ${plan.popular 
                  ? "border-primary shadow-lg shadow-primary/20 scale-105" 
                  : "border-border/50"
                }
              `}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-sm font-medium px-4 py-1 rounded-full">
                    Mais Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <div className={`
                  w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4
                  ${plan.popular ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary"}
                `}>
                  {plan.icon}
                </div>
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              <div className="text-center mb-6">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-foreground">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelectPlan(plan.id)}
                variant={plan.popular ? "hero" : "outline"}
                className="w-full"
                size="lg"
              >
                Assinar {plan.name}
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-12"
        >
          <p className="text-muted-foreground text-sm">
            Todos os planos incluem 7 dias de garantia. Cancele a qualquer momento.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Plans;