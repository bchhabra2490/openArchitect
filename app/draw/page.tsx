import type { Metadata } from "next";
import { StudioApp } from "@/components/studio/studio-app";

export const metadata: Metadata = {
  title: "Playground — OpenArchitect",
  description:
    "Design a home on a live canvas with an agent. Drag walls, export plans, and open a 3D dollhouse.",
};

export default function DrawPage() {
  const chatEnabled = Boolean(process.env.OPENAI_API_KEY?.trim());
  return <StudioApp chatEnabled={chatEnabled} />;
}
