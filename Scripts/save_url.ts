#!/usr/bin/env bun
/**
 * URL Save Workflow with Deduplication
 * 
 * Saves URLs to multiple destinations with duplicate checking:
 * 1. Zo Bookmarks folder (markdown file) - checks by URL in content
 * 2. Fabric.so (bookmark) - searches for existing
 * 3. Mem.ai (note in Bookmarks collection) - searches for existing
 * 4. Raindrop.io (bookmark) - searches for existing
 * 
 * Usage: bun /home/workspace/Automations/Scripts/save_url.ts <url> [--title "Title"] [--tags "tag1,tag2"]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { compressText } from "/home/workspace/Skills/tokencut/scripts/compress.ts";

const url = process.argv[2];
const titleArg = process.argv.find((arg, i) => process.argv[i - 1] === "--title");
const tagsArg = process.argv.find((arg, i) => process.argv[i - 1] === "--tags");

if (!url || url.startsWith("--")) {
  console.error("Usage: bun save_url.ts <url> [--title \"Title\"] [--tags \"tag1,tag2\"]");
  process.exit(1);
}

// ============================================
// DEDUPLICATION CHECKS
// ============================================

async function checkZoBookmarksExists(url: string): Promise<boolean> {
  try {
    const bookmarksDir = "/home/workspace/Bookmarks";
    if (!existsSync(bookmarksDir)) return false;
    
    // Read all markdown files and check for URL
    const files = readdirSync(bookmarksDir).filter(f => f.endsWith(".md"));
    
    for (const file of files.slice(0, 100)) { // Check last 100 files
      try {
        const content = readFileSync(join(bookmarksDir, file), "utf-8");
        if (content.includes(url)) {
          console.log(`  ⚠ Skipping Zo Bookmarks: Already exists (${file})`);
          return true;
        }
      } catch {}
    }
    return false;
  } catch {
    return false;
  }
}

async function checkFabricExists(url: string): Promise<boolean> {
  try {
    // Use the Fabric skill to search
    const proc = Bun.spawn({
      cmd: ["bun", "/home/workspace/Skills/fabric/scripts/fabric.ts", "search", url, "--limit", "5"],
      stdout: "pipe",
      stderr: "pipe",
    });
    
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    
    if (output.includes(url) || output.includes("found")) {
      console.log(`  ⚠ Skipping Fabric.so: Already exists`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function checkMemExists(url: string): Promise<boolean> {
  try {
    const apiKey = process.env.MEM_API_KEY;
    if (!apiKey) return false;
    
    const response = await fetch(`https://api.mem.ai/v0/mems?search=${encodeURIComponent(url)}`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.mems && data.mems.length > 0) {
        // Check if any mem contains this URL
        const exists = data.mems.some((mem: any) => 
          mem.content && mem.content.includes(url)
        );
        if (exists) {
          console.log(`  ⚠ Skipping Mem.ai: Already exists`);
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function checkRaindropExists(url: string): Promise<boolean> {
  try {
    const tokenFile = `${process.env.HOME}/.config/raindrop/token.json`;
    if (!existsSync(tokenFile)) return false;
    
    const token = JSON.parse(readFileSync(tokenFile, "utf-8"));
    
    // Search for existing bookmarks
    const searchUrl = `https://api.raindrop.io/rest/v1/raindrops/0?search=${encodeURIComponent(url)}`;
    const response = await fetch(searchUrl, {
      headers: { "Authorization": `Bearer ${token.access_token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.items && data.items.some((item: any) => item.link === url)) {
        console.log(`  ⚠ Skipping Raindrop.io: Already exists`);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ============================================
// SAVE FUNCTIONS
// ============================================

async function fetchPageContent(url: string): Promise<{ title: string; content: string }> {
  try {
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000
    });
    const html = await res.text();
    
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleArg || (titleMatch ? titleMatch[1].trim() : url);
    
    // Extract readable content
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000);
    
    return { title, content: textContent };
  } catch (e) {
    console.error(`  ✗ Could not fetch: ${e}`);
    return { title: titleArg || url, content: "" };
  }
}

async function saveToZoBookmarks(url: string, title: string, content: string): Promise<boolean> {
  try {
    const bookmarksDir = "/home/workspace/Bookmarks";
    if (!existsSync(bookmarksDir)) {
      mkdirSync(bookmarksDir, { recursive: true });
    }
    
    const date = new Date().toISOString().split("T")[0];
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 50);
    const filename = `${date}-${sanitizedTitle}.md`;
    const filepath = join(bookmarksDir, filename);
    
    const markdown = `# ${title}

**URL:** ${url}
**Date Saved:** ${date}

## Summary

${content.slice(0, 2000)}${content.length > 2000 ? "..." : ""}
`;
    
    writeFileSync(filepath, markdown);
    console.log(`  ✓ Saved to Zo Bookmarks: ${filename}`);
    return true;
  } catch (e) {
    console.log(`  ✗ Zo Bookmarks failed: ${e}`);
    return false;
  }
}

async function saveToFabric(url: string, title: string, tags: string[]): Promise<boolean> {
  try {
    const proc = Bun.spawn({
      cmd: [
        "bun", 
        "/home/workspace/Skills/fabric/scripts/fabric.ts",
        "create-bookmark",
        url,
        "--title", title,
        "--tags", tags.join(",")
      ],
      stdout: "pipe",
      stderr: "pipe",
    });
    
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    
    if (proc.exitCode === 0) {
      console.log(`  ✓ Saved to Fabric.so`);
      return true;
    } else {
      console.log(`  ✗ Fabric.so failed: ${output.slice(0, 100)}`);
      return false;
    }
  } catch (e) {
    console.log(`  ✗ Fabric.so failed: ${e}`);
    return false;
  }
}

async function saveToMem(url: string, title: string, content: string, tags: string[]): Promise<boolean> {
  try {
    // Use the mengram memory system
    const proc = Bun.spawn({
      cmd: [
        "python3",
        "/home/workspace/.zo/mengram_memory.py",
        "remember",
        `BOOKMARK: ${url} - ${title}. Tags: ${tags.join(", ")}`
      ],
      stdout: "pipe",
      stderr: "pipe",
    });
    
    await proc.exited;
    
    if (proc.exitCode === 0) {
      console.log(`  ✓ Saved to Mem (Mengram)`);
      return true;
    }
    return false;
  } catch (e) {
    console.log(`  ✗ Mem save failed: ${e}`);
    return false;
  }
}

async function saveToRaindrop(url: string, title: string, tags: string[]): Promise<boolean> {
  try {
    const tokenFile = `${process.env.HOME}/.config/raindrop/token.json`;
    if (!existsSync(tokenFile)) {
      console.log(`  ⚠ Raindrop: Not authenticated`);
      return false;
    }
    
    const token = JSON.parse(readFileSync(tokenFile, "utf-8"));
    
    const response = await fetch("https://api.raindrop.io/rest/v1/raindrop", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        link: url,
        title,
        tags,
        pleaseParse: {}
      }),
    });
    
    if (response.ok) {
      console.log(`  ✓ Saved to Raindrop.io`);
      return true;
    } else {
      console.log(`  ✗ Raindrop.io failed: ${response.status}`);
      return false;
    }
  } catch (e) {
    console.log(`  ✗ Raindrop.io failed: ${e}`);
    return false;
  }
}

function generateSmartTags(url: string, title: string, content: string): string[] {
  const tags = new Set<string>();
  const urlLower = url.toLowerCase();
  
  // Domain-based tags
  if (urlLower.includes("github.com")) tags.add("github").add("code");
  if (urlLower.includes("stackoverflow.com")) tags.add("stackoverflow").add("qa").add("code");
  if (urlLower.includes("reddit.com")) tags.add("reddit").add("community");
  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) tags.add("video").add("youtube");
  if (urlLower.includes("medium.com")) tags.add("medium").add("article");
  if (urlLower.includes("docs.") || urlLower.includes("documentation")) tags.add("documentation").add("reference");
  if (urlLower.includes("news") || urlLower.includes("blog")) tags.add("news").add("blog");
  
  // Content-based tags from title
  const titleLower = title.toLowerCase();
  if (/\btutorial\b/.test(titleLower)) tags.add("tutorial").add("learning");
  if (/\bguide\b/.test(titleLower)) tags.add("guide").add("reference");
  if (/\breview\b/.test(titleLower)) tags.add("review").add("analysis");
  if (/\btool\b|\bapp\b|\bsoftware\b/.test(titleLower)) tags.add("tools").add("software");
  if (/\bai\b|\bml\b|\bchatgpt\b|\bllm\b/.test(titleLower)) tags.add("ai").add("machine-learning");
  
  // Default tags
  if (tags.size === 0) {
    tags.add("bookmark").add("saved");
  }
  
  return Array.from(tags);
}

async function main() {
  console.log(`\n🔖 Processing: ${url}\n`);
  
  // Fetch page content
  const { title, content } = await fetchPageContent(url);
  const smartTags = generateSmartTags(url, title, content);
  const tags = [...new Set([...(tagsArg ? tagsArg.split(",").map(t => t.trim()) : []), ...smartTags])];
  
  console.log(`Title: ${title}`);
  console.log(`Tags: ${tags.join(", ")}\n`);
  
  // Compress content
  let compressedContent = content;
  if (content.length > 400) {
    try {
      compressedContent = await compressText(content, "standard");
      const savings = ((1 - compressedContent.length / content.length) * 100).toFixed(1);
      console.log(`TokenCut: ${content.length} → ${compressedContent.length} chars (${savings}% savings)\n`);
    } catch {
      compressedContent = content;
    }
  }
  
  // Check and save to each destination
  const results: Record<string, { checked: boolean; skipped: boolean; saved: boolean }> = {};
  
  // Zo Bookmarks
  const zoExists = await checkZoBookmarksExists(url);
  results["Zo Bookmarks"] = { checked: true, skipped: zoExists, saved: !zoExists && await saveToZoBookmarks(url, title, compressedContent) };
  
  // Fabric
  const fabricExists = await checkFabricExists(url);
  results["Fabric.so"] = { checked: true, skipped: fabricExists, saved: !fabricExists && await saveToFabric(url, title, tags) };
  
  // Mem
  const memExists = await checkMemExists(url);
  results["Mem.ai"] = { checked: true, skipped: memExists, saved: !memExists && await saveToMem(url, title, compressedContent, tags) };
  
  // Raindrop
  const raindropExists = await checkRaindropExists(url);
  results["Raindrop.io"] = { checked: true, skipped: raindropExists, saved: !raindropExists && await saveToRaindrop(url, title, tags) };
  
  // Summary
  console.log(`\n📊 Summary:`);
  for (const [name, result] of Object.entries(results)) {
    if (result.skipped) {
      console.log(`  ⚠ ${name}: Already exists (skipped)`);
    } else if (result.saved) {
      console.log(`  ✓ ${name}: Saved`);
    } else {
      console.log(`  ✗ ${name}: Failed or not configured`);
    }
  }
  
  const skipped = Object.values(results).filter(r => r.skipped).length;
  const saved = Object.values(results).filter(r => r.saved).length;
  
  if (skipped > 0 && saved === 0) {
    console.log(`\n⚠ Already saved to ${skipped} destination${skipped !== 1 ? 's' : ''}. No new saves needed.`);
  } else if (saved > 0) {
    console.log(`\n✅ Saved to ${saved} new destination${saved !== 1 ? 's' : ''}!`);
  }
  console.log();
}

main().catch(console.error);
