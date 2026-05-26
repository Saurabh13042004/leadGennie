"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface BookDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BookDemoModal({ isOpen, onClose }: BookDemoModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    companySize: "",
    outboundVolume: "",
    challenges: [] as string[],
    crmUsed: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const challenges = [
    "Deliverability",
    "Personalization",
    "Reply rates",
    "Lead management",
    "Campaign automation"
  ];

  const crmOptions = [
    "HubSpot",
    "Salesforce",
    "Pipedrive",
    "Close",
    "None",
    "Other"
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleChallengeToggle = (challenge: string) => {
    setFormData(prev => ({
      ...prev,
      challenges: prev.challenges.includes(challenge)
        ? prev.challenges.filter(c => c !== challenge)
        : [...prev.challenges, challenge]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1200));
    setIsLoading(false);
    setSubmitted(true);

    setTimeout(() => {
      setSubmitted(false);
      setStep(1);
      setFormData({
        name: "",
        email: "",
        company: "",
        companySize: "",
        outboundVolume: "",
        challenges: [],
        crmUsed: ""
      });
      onClose();
    }, 2500);
  };

  const companySize = formData.companySize;
  const isBestForStartups = companySize === "1-5" || companySize === "5-20";

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-4xl bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 min-h-[500px] md:min-h-[600px]">
                {/* LEFT SIDE - Benefits & Branding */}
                <div className="relative hidden md:flex flex-col justify-between bg-gradient-to-br from-white/5 via-transparent to-transparent p-8 border-r border-white/10">
                  <div>
                    <button
                      onClick={onClose}
                      className="absolute top-6 right-6 p-1 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-neutral-400 hover:text-white" />
                    </button>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="mb-2"
                    >
                      <span className="inline-block text-xs font-semibold text-white/60 bg-white/10 px-3 py-1 rounded-full">
                        Early Access • Limited Onboarding
                      </span>
                    </motion.div>

                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="text-2xl font-bold text-white mt-4 leading-tight"
                    >
                      See LeadGennie in action.
                    </motion.h2>

                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-neutral-400 text-sm mt-3 leading-relaxed"
                    >
                      Learn how modern GTM teams automate outbound, improve deliverability, and book more meetings.
                    </motion.p>

                    {/* Benefits */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="space-y-3 mt-8"
                    >
                      {[
                        "Personalized onboarding",
                        "Deliverability guidance",
                        "Campaign setup walkthrough",
                        "Early access features",
                        "AI outbound tips"
                      ].map((benefit, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
                          <span className="text-sm text-neutral-300">{benefit}</span>
                        </div>
                      ))}
                    </motion.div>
                  </div>

                  {/* Footer */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="text-xs text-neutral-500"
                  >
                    Built for modern GTM teams {isBestForStartups && "• Best for startups"}
                  </motion.p>
                </div>

                {/* RIGHT SIDE - Form */}
                <div className="flex flex-col p-8 md:p-8">
                  {submitted ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center h-full text-center py-12"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.2, damping: 15 }}
                        className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 border border-green-500/30"
                      >
                        <Check className="w-8 h-8 text-green-400" />
                      </motion.div>
                      <motion.h3
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-2xl font-bold text-white mb-2"
                      >
                        You're in.
                      </motion.h3>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.35 }}
                        className="text-neutral-400 text-sm max-w-xs"
                      >
                        We'll reach out shortly to schedule your personalized LeadGennie walkthrough.
                      </motion.p>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col h-full">
                      {/* Step indicator */}
                      <div className="mb-6">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-neutral-400">
                            Step {step} of 2
                          </span>
                          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: step === 1 ? "50%" : "100%" }}
                              transition={{ duration: 0.3 }}
                              className="h-full bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Step 1 */}
                      {step === 1 && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-4 flex-1"
                        >
                          <div>
                            <label className="block text-sm font-medium text-white mb-2">Full Name</label>
                            <input
                              type="text"
                              name="name"
                              value={formData.name}
                              onChange={handleChange}
                              placeholder="Jane Chen"
                              required
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-white mb-2">Work Email</label>
                            <input
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleChange}
                              placeholder="jane@company.com"
                              required
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-white mb-2">Company Name</label>
                            <input
                              type="text"
                              name="company"
                              value={formData.company}
                              onChange={handleChange}
                              placeholder="Acme Corp"
                              required
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-white mb-2">Company Size</label>
                            <select
                              name="companySize"
                              value={formData.companySize}
                              onChange={handleChange}
                              required
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all [&>option]:bg-[#0A0A0A]"
                            >
                              <option value="" disabled>Select size</option>
                              <option value="1-5">1-5 people</option>
                              <option value="5-20">5-20 people</option>
                              <option value="20-50">20-50 people</option>
                              <option value="50-200">50-200 people</option>
                              <option value="200+">200+ people</option>
                            </select>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 2 */}
                      {step === 2 && (
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-4 flex-1"
                        >
                          <div>
                            <label className="block text-sm font-medium text-white mb-2">Current Outbound Volume</label>
                            <select
                              name="outboundVolume"
                              value={formData.outboundVolume}
                              onChange={handleChange}
                              required
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all [&>option]:bg-[#0A0A0A]"
                            >
                              <option value="" disabled>Select volume</option>
                              <option value="<100">&lt;100/month</option>
                              <option value="100-1k">100-1k/month</option>
                              <option value="1k-10k">1k-10k/month</option>
                              <option value="10k+">10k+/month</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-white mb-3">Your biggest challenge</label>
                            <div className="space-y-2">
                              {challenges.map(challenge => (
                                <button
                                  key={challenge}
                                  type="button"
                                  onClick={() => handleChallengeToggle(challenge)}
                                  className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm ${
                                    formData.challenges.includes(challenge)
                                      ? "bg-white/10 border-white/30 text-white"
                                      : "bg-white/5 border-white/10 text-neutral-300 hover:border-white/20"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded border ${formData.challenges.includes(challenge) ? "bg-white border-white" : "border-white/30"}`}>
                                      {formData.challenges.includes(challenge) && (
                                        <Check className="w-3 h-3 text-black" />
                                      )}
                                    </div>
                                    {challenge}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-white mb-2">CRM Used</label>
                            <select
                              name="crmUsed"
                              value={formData.crmUsed}
                              onChange={handleChange}
                              required
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all [&>option]:bg-[#0A0A0A]"
                            >
                              <option value="" disabled>Select CRM</option>
                              {crmOptions.map(crm => (
                                <option key={crm} value={crm}>{crm}</option>
                              ))}
                            </select>
                          </div>
                        </motion.div>
                      )}

                      {/* Button */}
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        type="submit"
                        disabled={isLoading || (step === 1 && !formData.name) || (step === 2 && !formData.crmUsed)}
                        className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-8"
                      >
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="w-4 h-4 border-2 border-black border-t-transparent rounded-full"
                            />
                            Booking...
                          </span>
                        ) : step === 1 ? (
                          "Continue"
                        ) : (
                          "Book My Demo"
                        )}
                      </motion.button>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 }}
                        className="text-xs text-neutral-500 text-center mt-3"
                      >
                        No credit card required
                      </motion.p>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;

  return createPortal(modalContent, document.body);
}
