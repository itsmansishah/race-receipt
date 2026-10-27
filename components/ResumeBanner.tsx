"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ShoppingBag, X } from "lucide-react";
import { clearPendingCheckout, loadPendingCheckout } from "@/lib/persistence";

type Resume =
  | { status: "none" }
  | { status: "pending"; receiptId: string }
  | { status: "opening" }
  | { status: "paid"; orderName: string | null }
  | { status: "error"; message: string };

/**
 * Shown to a buyer who started checkout and came back without paying (or
 * after paying). Their design is still in this browser either way.
 */
export function ResumeBanner() {
  const [resume, setResume] = useState<Resume>({ status: "none" });

  useEffect(() => {
    const check = () => {
      const pending = loadPendingCheckout();
      if (!pending) return;
      fetch("/api/checkout/resume/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId: pending.receiptId }),
      })
        .then((res) => res.json())
        .then((body: { found: boolean; paid?: boolean; orderName?: string | null }) => {
          if (!body.found) {
            clearPendingCheckout();
          } else if (body.paid) {
            clearPendingCheckout();
            setResume({ status: "paid", orderName: body.orderName ?? null });
          } else {
            setResume({ status: "pending", receiptId: pending.receiptId });
          }
        })
        .catch(() => undefined);
    };
    check();
    // Coming "back" from Shopify can restore this page from the back/forward cache.
    const onShow = (e: PageTransitionEvent) => e.persisted && check();
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  if (resume.status === "none") return null;

  const finish = async (receiptId: string) => {
    setResume({ status: "opening" });
    try {
      const res = await fetch("/api/checkout/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId }),
      });
      const body = await res.json();
      if (body.ok && body.status === "pending") window.location.assign(body.checkoutUrl);
      else if (body.ok && body.status === "paid") {
        clearPendingCheckout();
        setResume({ status: "paid", orderName: body.orderName });
      } else setResume({ status: "error", message: body.message });
    } catch {
      setResume({ status: "error", message: "We couldn't reach our server. Try again in a moment." });
    }
  };

  const dismiss = () => setResume({ status: "none" });

  return (
    <div role="status" className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-6">
        {resume.status === "paid" ? (
          <>
            <CheckCircle2 size={18} aria-hidden className="shrink-0" />
            <p className="flex-1">
              <strong>Thank you! Your order{resume.orderName ? ` ${resume.orderName}` : ""} is in.</strong> We&apos;ll
              print it and email you when it ships. Your design is still here if you want to make another.
            </p>
          </>
        ) : (
          <>
            <ShoppingBag size={18} aria-hidden className="shrink-0" />
            <p className="flex-1">
              {resume.status === "error" ? (
                resume.message
              ) : (
                <>
                  <strong>Your design is saved.</strong> Pick up checkout where you left off, or keep editing; your
                  changes go with you when you check out again.
                </>
              )}
            </p>
            {(resume.status === "pending" || resume.status === "opening") && (
              <button
                type="button"
                disabled={resume.status === "opening"}
                onClick={() => resume.status === "pending" && void finish(resume.receiptId)}
                className="min-h-10 rounded-full bg-ink px-4 font-medium text-paper disabled:opacity-60"
              >
                {resume.status === "opening" ? "Opening…" : "Finish checkout"}
              </button>
            )}
          </>
        )}
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/10">
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
