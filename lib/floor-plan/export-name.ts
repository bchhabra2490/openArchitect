export function sanitizeExportFilename(
  name: string | undefined,
  format: "png" | "pdf" | "glb" | "json",
) {
  const trimmed = (name ?? "floor-plan").trim() || "floor-plan";
  const withoutExt = trimmed.replace(/\.(png|pdf|glb|json)$/i, "");
  const slug = withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `${slug || "floor-plan"}.${format}`;
}
