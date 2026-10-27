import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PrintRender } from "@/components/PrintRender";
import { getDb } from "@/lib/server/db";
import { getReceipt } from "@/lib/server/receipts";
import { verifyRenderSignature } from "@/lib/server/render-token";
import { photoDataUrl } from "@/lib/server/storage";

export const metadata: Metadata = {
  title: "Render",
  robots: { index: false, follow: false },
};

/**
 * Internal page the worker screenshots to make the print file: the sheet at
 * 1000 CSS px wide, no watermark, no frame. Requires a per-receipt signature.
 */
export default function RenderPage({ params, searchParams }: PageProps<"/render/[id]">) {
  return (
    <Suspense fallback={null}>
      <RenderLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RenderLoader({ params, searchParams }: Pick<PageProps<"/render/[id]">, "params" | "searchParams">) {
  await connection(); // reads the database per request
  const { id } = await params;
  const { sig } = await searchParams;
  if (typeof sig !== "string" || !verifyRenderSignature(id, sig)) notFound();

  const receipt = getReceipt(getDb(), id);
  if (!receipt) notFound();

  const photo =
    receipt.design.hero.kind === "photo" && receipt.photoKey
      ? { dataUrl: await photoDataUrl(receipt.photoKey), width: 576, height: 384 }
      : null;
  const state = { ...receipt.design, hero: { ...receipt.design.hero, photo } };
  return <PrintRender state={state} />;
}
