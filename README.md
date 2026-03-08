# hacker-news-mcp

A TypeScript MCP server for Hacker News with a practical founder-research layer on top.

It still gives you the raw Hacker News primitives you expect, but it also helps with the things indie developers actually care about:

- finding `Show HN` launches in a niche
- mining `Ask HN` threads for pain points
- summarizing long discussions quickly
- extracting product, launch, and monetization signals
- comparing multiple launches for patterns

This project uses the official Hacker News API plus Algolia's Hacker News Search API. There are no external AI APIs, no database, and no browser automation.

## What This MCP Can Do

### Base Hacker News tools

- `search`
- `getStory`
- `getStoryWithComments`
- `getStories`
- `getComment`
- `getComments`
- `getCommentTree`
- `getUser`
- `getUserSubmissions`

### Founder-research tools

- `findShowHN`
- `findAskHN`
- `summarizeThread`
- `extractStartupInsights`
- `compareLaunches`

## Tool Overview

### `findShowHN`

Search `Show HN` posts by keyword with optional filters.

Inputs:

- `query: string`
- `page?: number`
- `hitsPerPage?: number`
- `minPoints?: number`
- `minComments?: number`
- `dateFrom?: string`
- `dateTo?: string`

Returns normalized results with:

- `id`
- `title`
- `url`
- `author`
- `points`
- `numComments`
- `createdAt`
- `hnUrl`
- `textPreview`

### `findAskHN`

Search `Ask HN` posts for pain points and demand signals.

Inputs are the same as `findShowHN`.

### `summarizeThread`

Summarize a story and comment thread using deterministic heuristics.

Inputs:

- `storyId: number`
- `maxDepth?: number`
- `maxComments?: number`

Returns:

- story metadata
- key discussion themes
- notable pros
- notable cons
- repeated questions
- feature requests
- sentiment snapshot
- top comments used

### `extractStartupInsights`

Extract founder-relevant signals from either one thread or a query.

Inputs:

- `storyId?: number`
- `query?: string`
- `sourceType?: "show" | "ask" | "story" | "comment"`
- `maxItems?: number`

Returns:

- `targetUsers`
- `painPoints`
- `alternativesMentioned`
- `objections`
- `monetizationSignals`
- `launchFeedback`
- `opportunities`
- `risks`
- `recommendedFollowups`
- `lowConfidenceAreas`

### `compareLaunches`

Compare multiple `Show HN` launches.

Inputs:

- `storyIds: number[]`

Returns:

- launch-by-launch comparison
- title style patterns
- topic categories
- common praise
- common criticism
- likely traction drivers
- skipped IDs when some stories cannot be loaded

## Example Prompts

- "Find Show HN launches about CRM tools for founders with at least 30 comments."
- "Search Ask HN for pain points around bookkeeping automation."
- "Summarize HN thread `43130155` with `maxDepth` 2 and `maxComments` 40."
- "Extract startup insights from story `43130155`."
- "Analyze Ask HN results for `manual invoicing` and return pain points plus monetization signals."
- "Compare Show HN launches `43130155`, `42302015`, and `41806551`."

## Local Development

### Requirements

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Run locally

```bash
node dist/index.js
```

## Connect to MCP Clients

Build the server first:

```bash
npm install
npm run build
```

Then point your MCP client at the compiled entrypoint:

```text
/absolute/path/to/hacker-news-mcp/dist/index.js
```

Replace `/absolute/path/to/...` with the real path on your machine.

### Codex

If your Codex setup supports local `stdio` MCP servers, add an entry that runs:

```json
{
  "mcpServers": {
    "hacker-news-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/hacker-news-mcp/dist/index.js"]
    }
  }
}
```

This is the same pattern used by other local MCP clients: Codex launches the server process for you, so you do not need to manually keep `node dist/index.js` running in another terminal.

### Antigravity

If you use Antigravity as an MCP client, configure `hacker-news-mcp` as a local `stdio` server with the same command:

```json
{
  "mcpServers": {
    "hacker-news-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/hacker-news-mcp/dist/index.js"]
    }
  }
}
```

If Antigravity expects an explicit transport type, use:

```json
{
  "mcpServers": {
    "hacker-news-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/hacker-news-mcp/dist/index.js"]
    }
  }
}
```

### Claude Desktop

Add this to your MCP config:

```json
{
  "mcpServers": {
    "hacker-news-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/hacker-news-mcp/dist/index.js"]
    }
  }
}
```

### Cursor or other clients that expect `type: "stdio"`

```json
{
  "mcpServers": {
    "hacker-news-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/hacker-news-mcp/dist/index.js"]
    }
  }
}
```

### Install via `npx`

If you publish the package later, the config can become:

```json
{
  "mcpServers": {
    "hacker-news-mcp": {
      "command": "npx",
      "args": ["-y", "@devabdultech/hacker-news-mcp"]
    }
  }
}
```

### Generic `stdio` MCP clients

This server is intentionally simple:

- transport: `stdio`
- runtime: `node`
- entrypoint: `dist/index.js`

If a client supports local MCP servers, you usually only need:

- `command: "node"`
- `args: ["/absolute/path/to/hacker-news-mcp/dist/index.js"]`

After changing the config:

1. Save the client configuration
2. Restart or reload the client
3. Ask the client to list tools or call `findShowHN`

You only need to rebuild the server when the code changes. You do not need to manually run the server in the background for normal client usage.

## Publish This Repo to GitHub for Free

If you have never published a project before, this is the straightforward path.

### 1. Make sure the repo is clean

Run:

```bash
npm run build
npm test
```

### 2. Create a new empty GitHub repository

On GitHub:

1. Click `New repository`
2. Name it `hacker-news-mcp`
3. Leave it empty
4. Do not add a README, `.gitignore`, or license there

### 3. Initialize git locally

If this repo is not initialized yet:

```bash
git init -b main
git add .
git commit -m "Initial commit"
```

### 4. Connect the GitHub remote

Replace `YOUR_USERNAME` below:

```bash
git remote add origin https://github.com/YOUR_USERNAME/hacker-news-mcp.git
git push -u origin main
```

If GitHub asks for authentication, use GitHub Desktop, the GitHub CLI, or a personal access token in your normal setup.

## Optional: Publish to npm Later

GitHub is free and easy.

npm publishing is separate.

Before publishing to npm, make sure:

- the package name is available
- your `npm` account can publish the chosen scope
- the README examples match the final package name

Current package name:

```text
@devabdultech/hacker-news-mcp
```

If that scope is not the one you want long-term, change it before publishing to npm.

## Risks and Gotchas

### 1. Git history reset

If you delete `.git` and reinitialize, you lose:

- previous commits
- original remote links
- old branch history

That is fine if you want a fresh public repo, but it is not reversible unless you backed up the old `.git` directory first.

### 2. Secrets

Before publishing, check that you are not committing:

- `.env` files
- API keys
- tokens
- private config files
- local logs

This repo currently ignores common env files and `.omx/`, which is good.

### 3. Client config paths

If your MCP clients still point at the old folder path, they will fail.

Use:

```text
/absolute/path/to/hacker-news-mcp/dist/index.js
```

### 4. npm package name mismatch

GitHub repo names and npm package names do not have to match, but confusion there is a classic self-own.

If you publish to npm later, keep the README install command aligned with the real package name.

## Project Structure

```text
src/
  api/              Hacker News and Algolia API clients
  analysis/         Normalization, heuristics, and founder-research logic
  models/           Lightweight domain models
  schemas/          Zod request schemas
  services/         Thin orchestration layer for higher-level tools
  index.ts          MCP server registration and tool handlers

tests/              Basic analysis tests
dist/               Compiled output
```

## License

MIT. See [`LICENSE`](./LICENSE).
