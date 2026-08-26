# OpenArchitect

A WebMCP studio where a person and an agent design a home together on the same live canvas.

Describe a house. The agent asks a few clarifying questions, then draws a schematic floor plan. You drag walls and furniture, export PNG/PDF, and open a 3D dollhouse. ChatGPT (or Chrome with WebMCP) can call the same canvas commands as site tools — it does not have to click through the UI.

Built for the [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/).

## For judges

1. Open the live URL in **ChatGPT’s in-app browser** (WebMCP is on by default) or in **Chrome 149+** with `chrome://flags/#enable-webmcp-testing` enabled.
2. Confirm the header badge reads **WebMCP on**.
3. In ChatGPT, look for **Site tools** in the address bar. You should see tools such as `get_brief`, `get_standards_check`, `apply_layout`, and `generate_3d`.
4. Ask: *“3BHK, about 1200 sqft, open kitchen. Draw a layout, then open 3D.”*
5. Watch rooms appear on the canvas. Orbit the 3D view.

The in-app chat on the left is a fallback (needs `OPENAI_API_KEY` on the host). Judges do not need that key if they use ChatGPT site tools.

## WebMCP implementation

On load, the page registers every canvas command with the browser:

```js
document.modelContext.registerTool({
  name: "apply_layout",
  description: "Replace rooms, openings, furniture, and the frontage street in one shot.",
  inputSchema: { /* JSON Schema from Zod */ },
  execute: async (input) => {
    return executeStudioTool("apply_layout", input);
  },
});
```

Registration lives in [`hooks/use-webmcp-tools.ts`](hooks/use-webmcp-tools.ts). Handlers run in the tab against Zustand + `localStorage`, so the person sees every agent edit immediately.

The same command layer (`lib/floor-plan/commands.ts`) powers:

- ChatGPT / Chrome **site tools** (WebMCP)
- The optional in-app architect chat (`/api/chat`)

People keep a normal interface: pan/zoom canvas, inspector, layer toggles, export, 3D. Agents get structured tools instead of screenshot-clicking.

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set `OPENAI_API_KEY` only if you want the left-hand chat. WebMCP tools work without it.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev
npm run build
npm run lint
```

## License

[MIT](LICENSE)
