import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const FLOOR_PLAN_IMAGE = "/floor-plan (1).png";
const WEBMCP_IMAGE = "/webmcp.png";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-1.005-.525-1.005-1.125-.015-1.125.915-.015 1.575.84 1.795 1.23 1.05 1.755 2.73 1.26 3.39.96.105-.75.405-1.26.735-1.545-2.55-.285-5.235-1.275-5.235-5.675 0-1.26.45-2.295 1.2-3.105-.12-.285-.525-1.425.12-2.97 0 0 .99-.315 3.24 1.185.945-.255 1.95-.39 2.955-.39 1.005 0 2.01.135 2.955.39 2.25-1.515 3.24-1.185 3.24-1.185.645 1.545.24 2.685.12 2.97.75.81 1.2 1.845 1.2 3.105 0 4.41-2.685 5.385-5.25 5.67.42.36.81 1.08.81 2.175 0 1.575-.015 2.835-.015 3.225 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  );
}

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-sm font-medium tracking-tight">OpenArchitect</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Agents draw on the canvas. You stay in the loop.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon-sm">
              <a
                href="https://github.com/bchhabra2490/openArchitect"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View source on GitHub"
                title="GitHub"
              >
                <GitHubIcon className="size-4" />
              </a>
            </Button>
            <Button asChild>
              <Link href="/draw">Playground</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 lg:gap-14 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-center lg:gap-14">
            <div className="space-y-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                WebMCP studio for home design
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                Describe a home. An agent draws the floor plan with you.
              </h1>
            </div>

            <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
              <div className="overflow-hidden rounded-2xl border bg-muted/30 shadow-lg">
                <Image
                  src={FLOOR_PLAN_IMAGE}
                  alt="Sample 3BHK floor plan with bedrooms, baths, kitchen, and setbacks"
                  width={528}
                  height={1625}
                  priority
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex max-w-3xl flex-col gap-6">
            <p className="text-base text-muted-foreground text-pretty sm:text-lg">
              OpenArchitect is a live canvas where you and ChatGPT design together — drag walls,
              tune room colors, export PNG/PDF, and open a 3D dollhouse. Browser agents call the
              same tools as the UI via WebMCP.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/draw">
                  Open playground
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a
                  href="https://openai.com/webmcp-challenge/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WebMCP Challenge
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/20">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-20">
            <div className="order-2 space-y-3 lg:order-1">
              <h2 className="text-2xl font-semibold tracking-tight">Same canvas, two ways in</h2>
              <p className="text-muted-foreground text-pretty">
                Use the built-in chat on the left, or open the playground in ChatGPT&apos;s browser
                and drive the plan through site tools — <code className="text-sm">apply_layout</code>
                , <code className="text-sm">update_room</code>, <code className="text-sm">generate_3d</code>
                , and more. Every edit lands on the canvas in real time.
              </p>
              <Button asChild className="mt-2">
                <Link href="/draw">Try it in the playground</Link>
              </Button>
            </div>
            <div className="order-1 overflow-hidden rounded-2xl border bg-background shadow-lg lg:order-2">
              <Image
                src={WEBMCP_IMAGE}
                alt="OpenArchitect playground with chat panel and floor plan canvas, WebMCP enabled"
                width={3456}
                height={2166}
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="space-y-1">
              <h2 className="text-lg font-medium">Ready to draw?</h2>
              <p className="text-sm text-muted-foreground">
                No sign-up. Open the playground and start with a brief or a prompt.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/draw">
                Playground
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <p>OpenArchitect — built for the OpenAI WebMCP Challenge</p>
          <p>MIT License</p>
        </div>
      </footer>
    </div>
  );
}
