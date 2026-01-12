import { motion } from "framer-motion";
import { Rocket, Shield, Link2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Rocket,
    title: "Entregabilidade",
    description: "Faça sua mensagem chegar em quem precisa, impactando em média 85% da sua lista em poucos minutos.",
    color: "primary",
  },
  {
    icon: Shield,
    title: "Segurança",
    description: "Tenha total segurança em 5 níveis diferentes, dentro de uma plataforma com tecnologia própria e homologada.",
    color: "accent",
  },
  {
    icon: Link2,
    title: "Integração",
    description: "Conecta com as principais plataformas do mercado, automatiza sua comunicação e gera mais métricas.",
    color: "primary",
  },
];

export const Features = () => {
  return (
    <section className="py-24 bg-secondary/30 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 to-accent/5" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">
            Diferenciais
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mt-4 mb-6">
            Por que escolher a <span className="text-gradient-primary">Wiki Marketing</span>?
          </h2>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group"
            >
              <div className="bg-card rounded-3xl p-8 border border-border shadow-sm hover:shadow-lg transition-all duration-300 h-full">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
                  feature.color === "primary" 
                    ? "bg-primary-light" 
                    : "bg-accent-light"
                }`}>
                  <feature.icon className={`w-8 h-8 ${
                    feature.color === "primary" 
                      ? "text-primary" 
                      : "text-accent"
                  }`} />
                </div>

                <h3 className="font-display text-xl font-bold text-foreground mb-4">
                  {feature.title}
                </h3>

                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Button variant="hero" size="lg" className="group">
            Faça Wiki Marketing
            <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
};
