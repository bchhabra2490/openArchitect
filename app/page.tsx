import { StudioApp } from "@/components/studio/studio-app";

export default function Home() {
  const chatEnabled = Boolean(process.env.OPENAI_API_KEY?.trim());
  return <StudioApp chatEnabled={chatEnabled} />;
}
