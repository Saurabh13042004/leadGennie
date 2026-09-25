"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CircleNotch, WarningCircle, X } from "@phosphor-icons/react/ssr";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import DemoInfoPane from "@/components/public/demo/DemoInfoPane";
import { StepIndicator, StepOne, StepTwo } from "@/components/public/demo/DemoFormSteps";
import { emptyDemoForm, validateDemoStep, type DemoErrors, type DemoField } from "@/components/public/demo/demo-form-core";

interface BookDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export default function BookDemoModal({ isOpen, onClose, initialEmail = "" }: BookDemoModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState(() => emptyDemoForm(initialEmail));
  const [fieldErrors, setFieldErrors] = useState<DemoErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adjust state during render (rather than in an effect) when the modal
  // just opened, so a prefilled email from the caller takes effect.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen && initialEmail) {
      setFormData((prev) => ({ ...prev, email: initialEmail }));
    }
  }

  // Escape closes, like every other dialog in the app.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => (prev[name as DemoField] ? { ...prev, [name]: undefined } : prev));
  };

  const handleChallengeToggle = (challenge: string) => {
    setFormData((prev) => ({
      ...prev,
      challenges: prev.challenges.includes(challenge) ? prev.challenges.filter((c) => c !== challenge) : [...prev.challenges, challenge],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateDemoStep(step, formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      document.getElementById(`demo-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/book-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setSubmitted(true);
      setIsLoading(false);

      setTimeout(() => {
        setSubmitted(false);
        setStep(1);
        setFormData(emptyDemoForm());
        onClose();
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  const isBestForStartups = formData.companySize === "1-5" || formData.companySize === "5-20";

  // false on the server / first render, true once hydrated — needed for the portal.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="book-demo" className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <div className="absolute inset-0 bg-neutral-900/25 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-demo-title"
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[880px] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:max-h-[calc(100dvh-2rem)]"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <X className="h-4 w-4" weight="bold" />
            </button>

            <div className="grid grid-cols-1 md:min-h-[560px] md:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]">
              <DemoInfoPane bestForStartups={isBestForStartups} />

              <div className="flex flex-col p-6 md:p-8">
                {submitted ? (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col items-center justify-center py-12 text-center" role="status">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200/70">
                      <Check className="h-6 w-6" weight="bold" />
                    </span>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-neutral-950">You&apos;re in.</h3>
                    <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-neutral-500">
                      We&apos;ll reach out shortly to schedule your personalized LeadGennie walkthrough.
                    </p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col">
                    <div className="pr-8">
                      <StepIndicator step={step} />
                    </div>

                    <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className="mt-6 flex-1">
                      {step === 1 ? (
                        <StepOne data={formData} errors={fieldErrors} onChange={handleChange} />
                      ) : (
                        <StepTwo data={formData} errors={fieldErrors} onChange={handleChange} onToggle={handleChallengeToggle} />
                      )}
                    </motion.div>

                    {error && (
                      <div role="alert" className="mt-5 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200/70">
                        <WarningCircle className="mt-px h-4 w-4 shrink-0" weight="fill" />
                        {error}
                      </div>
                    )}

                    <div className="mt-8 flex items-center gap-2">
                      {step === 2 && (
                        <Button variant="secondary" size="md" className="h-10 px-3.5" onClick={() => setStep(1)} disabled={isLoading}>
                          <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
                          Back
                        </Button>
                      )}
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        className="h-10 flex-1"
                        disabled={isLoading || (step === 1 && !formData.name) || (step === 2 && !formData.crmUsed)}
                      >
                        {isLoading ? (
                          <>
                            <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
                            Booking...
                          </>
                        ) : step === 1 ? (
                          <>
                            Continue
                            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
                          </>
                        ) : (
                          "Book My Demo"
                        )}
                      </Button>
                    </div>
                    <p className="mt-3 text-center text-xs text-neutral-500">No credit card required</p>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;

  return createPortal(modalContent, document.body);
}
