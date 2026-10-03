import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/motion";
import {
  DotVignette,
  DotNetwork,
  DotRoutes,
  DotShield,
  DotGear,
  DotArrow,
  DotSend
} from "@/components/visual";

export const LandingPage: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const docsUrl = import.meta.env.VITE_DOCS_URL;
  const githubUrl = import.meta.env.VITE_GITHUB_URL;
  const feedbackEmail = import.meta.env.VITE_FEEDBACK_EMAIL;

  return (
    <div className="w-full flex flex-col bg-black text-foreground overflow-hidden">
      <section className="relative min-h-[70vh] flex items-center pt-28 pb-24 md:pt-36 md:pb-32">
        <div className="hidden md:block absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <DotVignette className="w-full h-full" />
        </div>

        <div className="relative z-10 max-w-[1280px] w-full mx-auto px-6 md:px-12 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-6 text-left">
              <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground select-none">
                PRIVATE PAYMENTS FOR BITCOIN
              </span>

              <motion.h1
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="font-display font-bold text-5xl md:text-7xl lg:text-[96px] tracking-[-0.04em] leading-[0.95] text-foreground"
              >
                Send money privately.
              </motion.h1>

              <motion.div
                initial="initial"
                animate="animate"
                variants={{
                  initial: {},
                  animate: {
                    transition: {
                      staggerChildren: shouldReduceMotion ? 0 : 0.04,
                      delayChildren: shouldReduceMotion ? 0 : 0.1
                    }
                  }
                }}
                className="flex flex-col gap-6"
              >
                <motion.p
                  variants={{
                    initial: { opacity: 0, y: shouldReduceMotion ? 0 : 4 },
                    animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } }
                  }}
                  className="text-lg leading-relaxed text-muted-foreground max-w-xl"
                >
                  Check the privacy of your Bitcoin, Lightning, and ecash payments with verifiable proof before you send.
                </motion.p>

                <motion.div
                  variants={{
                    initial: { opacity: 0, y: shouldReduceMotion ? 0 : 4 },
                    animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } }
                  }}
                  className="flex flex-wrap items-center gap-4 pt-2"
                >
                  <Link
                    to="/app"
                    className="inline-flex items-center justify-center gap-2 rounded-none bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-transform active:scale-[0.97]"
                  >
                    <span>Launch app</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  {docsUrl ? (
                    <a
                      href={docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-none px-6 py-3.5 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
                    >
                      Read the docs
                    </a>
                  ) : null}
                </motion.div>

                <motion.p
                  variants={{
                    initial: { opacity: 0 },
                    animate: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }
                  }}
                  className="text-sm text-muted-foreground/80"
                >
                  Open source. Non-custodial. Free to use.
                </motion.p>
              </motion.div>
            </div>

            <div className="flex items-center justify-center lg:justify-end">
              <div className="hidden sm:block">
                <DotNetwork size={480} />
              </div>
              <div className="sm:hidden">
                <DotNetwork size={280} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full border-y border-white/[0.08] py-6">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 lg:px-16 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.08]">
          <div className="flex items-center justify-center gap-3 py-3 md:py-0">
            <DotShield size={20} className="text-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">Non-custodial</span>
          </div>
          <div className="flex items-center justify-center gap-3 py-3 md:py-0">
            <DotGear size={20} className="text-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">Open source</span>
          </div>
        </div>
      </section>

      <section id="problem" className="py-24 md:py-32 max-w-[1280px] w-full mx-auto px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-8 flex flex-col gap-6 text-left">
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground select-none">
              THE PROBLEM
            </span>
            <h2 className="font-display font-bold text-3xl md:text-5xl lg:text-[56px] tracking-[-0.03em] leading-tight text-foreground">
              Every payment can leak your identity.
            </h2>
            <div className="flex flex-col gap-4 text-lg leading-relaxed text-muted-foreground">
              <p>
                Public blockchains record every coin movement forever. When you send Bitcoin, change outputs and address reuse can connect your real-world identity to past and future transactions across multiple networks.
              </p>
              <p>
                Lightning and ecash offer greater privacy, but crossing between protocols often leaves unintentional trails. Most wallets never warn you before a payment creates an indelible link to your activity.
              </p>
            </div>
          </div>
          <div className="hidden lg:flex lg:col-span-4 justify-center items-center">
            <DotRoutes size={280} />
          </div>
        </div>
      </section>

      <section id="features" className="py-24 md:py-32 max-w-[1280px] w-full mx-auto px-6 md:px-12 lg:px-16">
        <div className="flex flex-col gap-4 text-left mb-12">
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground select-none">
            WHAT KEPLER DOES
          </span>
          <h2 className="font-display font-bold text-3xl md:text-5xl lg:text-[56px] tracking-[-0.03em] leading-tight text-foreground">
            A privacy check before every payment.
          </h2>
        </div>

        <motion.div
          initial="initial"
          animate="animate"
          variants={{
            initial: {},
            animate: {
              transition: {
                staggerChildren: shouldReduceMotion ? 0 : 0.06
              }
            }
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          <motion.div
            variants={{
              initial: { opacity: 0, y: shouldReduceMotion ? 0 : 4 },
              animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } }
            }}
            className="bg-card border border-white/[0.08] rounded-[12px] p-5 md:p-8 flex flex-col justify-between min-h-[260px]"
          >
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <h3 className="font-display font-semibold text-[20px] md:text-[22px] tracking-[-0.01em] text-foreground">
                  Privacy check
                </h3>
                <DotShield size={48} className="text-foreground shrink-0" />
              </div>
              <p className="text-lg leading-relaxed text-muted-foreground">
                See how a payment could link your Bitcoin, Lightning, and Nostr identities before you send it.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-white/[0.04]">
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-accent transition-colors"
              >
                <span>Learn more</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </motion.div>

          <motion.div
            variants={{
              initial: { opacity: 0, y: shouldReduceMotion ? 0 : 4 },
              animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } }
            }}
            className="bg-card border border-white/[0.08] rounded-[12px] p-5 md:p-8 flex flex-col justify-between min-h-[260px]"
          >
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <h3 className="font-display font-semibold text-[20px] md:text-[22px] tracking-[-0.01em] text-foreground">
                  Verifiable evidence
                </h3>
                <DotArrow size={48} className="text-foreground shrink-0" />
              </div>
              <p className="text-lg leading-relaxed text-muted-foreground">
                Every decision comes with proof you can check yourself, not just a number to trust.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-white/[0.04]">
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-accent transition-colors"
              >
                <span>Learn more</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </motion.div>

          <motion.div
            variants={{
              initial: { opacity: 0, y: shouldReduceMotion ? 0 : 4 },
              animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } }
            }}
            className="bg-card border border-white/[0.08] rounded-[12px] p-5 md:p-8 flex flex-col justify-between min-h-[260px]"
          >
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <h3 className="font-display font-semibold text-[20px] md:text-[22px] tracking-[-0.01em] text-foreground">
                  Works with your wallets
                </h3>
                <DotSend size={48} className="text-foreground shrink-0" />
              </div>
              <p className="text-lg leading-relaxed text-muted-foreground">
                Connect your existing Bitcoin, Lightning, and ecash wallets. Kepler does not hold your keys.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-white/[0.04]">
              <Link
                to="/app"
                className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-accent transition-colors"
              >
                <span>Connect wallet</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section id="how-it-works" className="py-24 md:py-32 max-w-[1280px] w-full mx-auto px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col gap-8 text-left">
            <div>
              <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground select-none">
                HOW IT WORKS
              </span>
              <h2 className="font-display font-bold text-3xl md:text-5xl lg:text-[56px] tracking-[-0.03em] leading-tight text-foreground mt-4">
                Three steps. Under a minute.
              </h2>
            </div>

            <div className="flex flex-col gap-8">
              <div className="flex items-start gap-6">
                <span className="font-display font-bold text-4xl md:text-5xl text-accent/40 select-none w-14 shrink-0">
                  01
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-display font-semibold text-[20px] md:text-[22px] tracking-[-0.01em] text-foreground">
                    Connect your wallet
                  </h3>
                  <p className="text-lg leading-relaxed text-muted-foreground">
                    Use your existing Bitcoin or Lightning wallet. Kepler never holds your keys.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <span className="font-display font-bold text-4xl md:text-5xl text-accent/40 select-none w-14 shrink-0">
                  02
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-display font-semibold text-[20px] md:text-[22px] tracking-[-0.01em] text-foreground">
                    Paste an invoice or address
                  </h3>
                  <p className="text-lg leading-relaxed text-muted-foreground">
                    Send to any Lightning invoice, Bitcoin address, or ecash request.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <span className="font-display font-bold text-4xl md:text-5xl text-accent/40 select-none w-14 shrink-0">
                  03
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-display font-semibold text-[20px] md:text-[22px] tracking-[-0.01em] text-foreground">
                    Send with confidence
                  </h3>
                  <p className="text-lg leading-relaxed text-muted-foreground">
                    Kepler checks for privacy risks, shows you the decision, and lets you verify it.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <DotRoutes size={400} />
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32 max-w-[1280px] w-full mx-auto px-6 md:px-12 lg:px-16">
        <div className="bg-card border border-white/[0.08] rounded-[12px] p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex flex-col gap-2 text-left">
            <h2 className="font-display font-bold text-3xl md:text-5xl lg:text-[56px] tracking-[-0.03em] leading-tight text-foreground">
              Ready to try it?
            </h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Start sending with built-in privacy checks today.
            </p>
          </div>
          <Link
            to="/app"
            className="inline-flex items-center justify-center gap-2 rounded-none bg-primary px-8 py-4 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-transform active:scale-[0.97] shrink-0"
          >
            <span>Launch app</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="w-full border-t border-white/[0.08] py-12">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 lg:px-16 flex flex-col gap-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="font-display font-black text-[18px] tracking-[0.08em] uppercase text-foreground">
                KEPLER
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              {githubUrl ? (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              ) : null}
              {docsUrl ? (
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Docs
                </a>
              ) : null}
              {feedbackEmail ? (
                <a
                  href={`mailto:${feedbackEmail}`}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Submit feedback
                </a>
              ) : null}
            </div>
          </div>
          <div className="text-sm text-muted-foreground/60 text-left">
            Open source under the MIT license.
          </div>
        </div>
      </footer>
    </div>
  );
};
