import type { Metadata } from "next";
import { PrintProof } from "@/components/PrintProof";

export const metadata: Metadata = {
  title: "Proof — Race Receipt",
  robots: { index: false },
};

export default function PrintPage() {
  return <PrintProof />;
}
