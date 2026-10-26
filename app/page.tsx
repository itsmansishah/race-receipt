import { Customizer } from "@/components/Customizer";
import { ReceiptProvider } from "@/components/ReceiptProvider";

export default function Home() {
  return (
    <ReceiptProvider>
      <Customizer />
    </ReceiptProvider>
  );
}
