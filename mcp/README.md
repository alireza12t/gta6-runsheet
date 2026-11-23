# Runsheet MCP server: GTA VI guide for AI assistants

Ask Claude, Cursor or any MCP client about GTA 6 and get answers with map links:

- "Where are the safes in Vice City?"
- "Plan me 40 minutes as Lucia at night in chapter 1, I want Jack of Hearts."
- "Who gives the Skunk Ape side missions?"
- "How do I unlock the GTA 6 money cheat?"

It uses the same data as the [Runsheet web app](https://alireza12t.github.io/gta6-runsheet/): 1,300+ map locations, missions, Strangers & Freaks, cheats, trophies and money tips. It reads the live site, so answers stay current.

## Tools

| Tool | What it does |
|---|---|
| `gta6_plan_session` | Chapter, Jason or Lucia, day or night, minutes. Returns what's about to close, what's live now, a nearest-first collectible route with map links, and a money stop. |
| `gta6_search_places` | Find stunt jumps, Jack of Hearts, curiosities, safes, towable ATMs, shops and more, by text, category or area. |
| `gta6_list_categories` | Every category with its count and a tip. |
| `gta6_guide` | Story missions by chapter, side missions and who gives them, cheats, trophies. |
| `gta6_money` | Cash rules and ways to make money. No payout numbers, since none are confirmed. |

## Install

Needs Node 18 or newer. No API key, no account.

**Claude Code**

```bash
claude mcp add gta6 -- npx -y gta6-runsheet-mcp
```

**Claude Desktop, Cursor, Windsurf and others:** add this to the MCP config file.

```json
{
  "mcpServers": {
    "gta6": { "command": "npx", "args": ["-y", "gta6-runsheet-mcp"] }
  }
}
```

**From a clone:** `node mcp/server.js`. No install step, no dependencies.

## Data

- Locations via [gta6tracker.org](https://gta6tracker.org/), which builds on the [GTA Wiki](https://gta.fandom.com/). Unverified.
- Guide tips summarised from public guides, with a source count on each.
- 43 of 91 story missions are listed so far.

Unofficial fan project. Not affiliated with Rockstar Games or Take-Two Interactive.

Made by [Alireza Toghiani](https://alireza12t.github.io/): [GitHub](https://github.com/alireza12t) · [X](https://x.com/DevMvRick) · [YouTube](https://www.youtube.com/@DevMvRick)

The server code is MIT licensed. The data belongs to the sources above.
