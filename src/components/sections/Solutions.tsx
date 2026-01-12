import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  Workflow, 
  Users, 
  Puzzle,
  ChevronRight,
  Phone,
  Mail,
  Smartphone
} from "lucide-react";
import { Button } from "@/components/ui/button";

const solutions = [
  {
    id: "disparo",
    icon: MessageSquare,
    title: "Disparo em Massa",
    subtitle: "Você não vai mais ser ignorado!",
    description: "Faça sua mensagem chegar para quem precisa, de forma rápida, barata e sem esforço. Utilize ligações gravadas, SMS shortcode e SMS flash.",
    features: [
      { icon: Phone, label: "+80% das ligações atendidas" },
      { icon: Mail, label: "SMS com link clicável" },
      { icon: Smartphone, label: "SMS Flash disruptivo" },
    ],
    color: "primary",
  },
  {
    id: "flow",
    icon: Workflow,
    title: "Wiki Flow",
    subtitle: "Automação inteligente",
    description: "Crie fluxos de comunicação automatizados que acompanham a jornada do cliente, garantindo que cada lead receba a mensagem certa no momento certo.",
    features: [
      { icon: Workflow, label: "Fluxos automáticos" },
      { icon: Users, label: "Segmentação avançada" },
      { icon: MessageSquare, label: "Mensagens personalizadas" },
    ],
    color: "accent",
  },
  {
    id: "gestao",
    icon: Users,
    title: "Gestão de Leads",
    subtitle: "Organize e converta",
    description: "Cadastre leads, crie campanhas, higienize contatos automaticamente e defina o momento ideal para cada disparo.",
    features: [
      { icon: Users, label: "Higienização automática" },
      { icon: MessageSquare, label: "Campanhas personalizadas" },
      { icon: Phone, label: "Disparos automáticos" },
    ],
    color: "primary",
  },
  {
    id: "integracoes",
    icon: Puzzle,
    title: "Integrações",
    subtitle: "Conecte suas ferramentas",
    description: "Integre-se às principais plataformas do mercado como ActiveCampaign, ManyChat, Hotmart e muito mais.",
    features: [
      { icon: Puzzle, label: "ActiveCampaign" },
      { icon: Puzzle, label: "ManyChat" },
      { icon: Puzzle, label: "Hotmart" },
    ],
    color: "accent",
  },
];

export const Solutions = () => {
  const [activeTab, setActiveTab] = useState("disparo");
  const activeSolution = solutions.find((s) => s.id === activeTab);

  return (
    <section id="solucoes" className="py-24 bg-background relative">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">
            Nossas Soluções
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mt-4 mb-6">
            Faça Wiki Marketing e <span className="text-gradient-primary">venda mais</span>
          </h2>
        </motion.div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {solutions.map((solution) => (
            <button
              key={solution.id}
              onClick={() => setActiveTab(solution.id)}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300
                ${activeTab === solution.id 
                  ? "bg-primary text-primary-foreground shadow-primary" 
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }
              `}
            >
              <solution.icon className="w-5 h-5" />
              {solution.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeSolution && (
            <motion.div
              key={activeSolution.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid lg:grid-cols-2 gap-12 items-center"
            >
              {/* Text Content */}
              <div className="order-2 lg:order-1">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 ${
                  activeSolution.color === "primary" 
                    ? "bg-primary-light text-primary" 
                    : "bg-accent-light text-accent"
                }`}>
                  <activeSolution.icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{activeSolution.title}</span>
                </div>

                <h3 className="font-display text-2xl md:text-4xl font-bold text-foreground mb-4">
                  {activeSolution.subtitle}
                </h3>

                <p className="text-lg text-muted-foreground mb-8">
                  {activeSolution.description}
                </p>

                <div className="space-y-4 mb-8">
                  {activeSolution.features.map((feature, index) => (
                    <motion.div
                      key={feature.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-4"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        activeSolution.color === "primary" 
                          ? "bg-primary-light" 
                          : "bg-accent-light"
                      }`}>
                        <feature.icon className={`w-5 h-5 ${
                          activeSolution.color === "primary" 
                            ? "text-primary" 
                            : "text-accent"
                        }`} />
                      </div>
                      <span className="font-medium text-foreground">{feature.label}</span>
                    </motion.div>
                  ))}
                </div>

                <Button variant={activeSolution.color === "primary" ? "hero" : "accent"} size="lg" className="group">
                  Saiba mais
                  <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>

              {/* Visual */}
              <div className="order-1 lg:order-2">
                <div className={`relative rounded-3xl p-8 ${
                  activeSolution.color === "primary" 
                    ? "bg-primary-light" 
                    : "bg-accent-light"
                }`}>
                  <div className="aspect-video rounded-2xl bg-card shadow-lg border border-border flex items-center justify-center">
                    <activeSolution.icon className={`w-24 h-24 ${
                      activeSolution.color === "primary" 
                        ? "text-primary" 
                        : "text-accent"
                    }`} />
                  </div>
                  
                  {/* Floating Elements */}
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute -top-4 -right-4 w-16 h-16 rounded-2xl bg-card shadow-lg border border-border flex items-center justify-center"
                  >
                    <Phone className="w-8 h-8 text-primary" />
                  </motion.div>
                  
                  <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                    className="absolute -bottom-4 -left-4 w-16 h-16 rounded-2xl bg-card shadow-lg border border-border flex items-center justify-center"
                  >
                    <Mail className="w-8 h-8 text-accent" />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
