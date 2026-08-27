import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = {
  title: "OpenArchitect — AI floor plans on a live canvas",
  description:
    "Describe a home. An agent asks follow-ups, then draws a schematic floor plan on a live canvas. Browser agents use the same tools via WebMCP.",
};

export default function Home() {
  return <LandingPage />;
}
