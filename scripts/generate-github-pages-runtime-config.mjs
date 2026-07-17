import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function generateRuntimeConfig({
  outputPath = process.env.RUNTIME_CONFIG_OUTPUT || "_site/js/aetherus-runtime-config.js",
  supabaseUrl = process.env.AETHERUS_SUPABASE_URL,
  publishableKey = process.env.AETHERUS_SUPABASE_PUBLISHABLE_KEY
} = {}) {
  if (!supabaseUrl) throw new Error("Missing required GitHub Actions repository value: AETHERUS_SUPABASE_URL");
  if (!publishableKey) throw new Error("Missing required GitHub Actions repository value: AETHERUS_SUPABASE_PUBLISHABLE_KEY");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const body = `globalThis.AETHERUS_SUPABASE_PUBLIC_CONFIG = ${JSON.stringify({
    SUPABASE_URL: supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: publishableKey
  })};\n`;
  await fs.writeFile(outputPath, body);
  return { output_basename: path.basename(outputPath), field_count: 2 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await generateRuntimeConfig();
  process.stdout.write(`runtime_config_generated=${result.output_basename};fields=${result.field_count}\n`);
}
