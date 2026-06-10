# skills

English | [中文](README.zh.md)

Reusable agent skills for site launch work, code review and push workflows, and billing analysis.

This repository is a public skill pack. Each skill folder lives at the repository root and contains its own `SKILL.md` and optional bundled resources.

## Skills

| Skill | Use it for |
| --- | --- |
| `jz-create-site` | Publish a local web project through GitHub and Vercel. |
| `jz-launch-domain` | Connect a deployed site to a custom domain with DNS, HTTPS, and redirects. |
| `jz-setup-site-analytics` | Set up analytics and search indexing after the final domain works. |
| `jz-add-search-index` | Add IndexNow key verification, URL collection, and submission scripts to an existing site. |
| `jz-add-gh-collaborator` | Prepare fork-only GitHub permissions for a cloud-agent developer account. |
| `jz-commit-code` | Review workspace changes and create scoped commits after confirmation. |
| `jz-push-code` | Verify, push, and run post-push indexing sync. |
| `jz-audit-vercel-cost` | Explain Vercel usage, billed cost, Pro fees, and receipt/card charge differences. |
| `jz-audit-cf-cost` | Read Cloudflare bills and GraphQL usage, check running resource costs in the current billing cycle, and identify billing anomalies. |
| `jz-build-personal-context` | Interview the user to create persistent profile and writing-style files for Codex, ChatGPT, Claude, and Claude Code. |
| `jz-fetch-x` | Fetch the latest X posts for a given username or userId and save them as JSON or Markdown. |
| `jz-pack-source` | Package the current source tree (no build artifacts, no secrets) into a zip for sharing with collaborators or a review agent. |

Recommended sequence for a new site:

```text
jz-create-site -> jz-launch-domain -> jz-setup-site-analytics
```

`jz-add-search-index` is separate because it is also useful for existing sites that only need IndexNow support.

## Code Upload Workflow

For normal development work, use:

```text
jz-commit-code -> jz-push-code
```

`jz-commit-code` reviews the working tree, reports risks, waits for confirmation, and commits only the intended files. `jz-push-code` runs verification, keeps the git tree clean, pushes the branch, and then uses `jz-add-search-index` to ensure IndexNow URL collection and submission are available for changed public pages.

`jz-push-code` should not resubmit an unchanged sitemap to Google Search Console after every page edit. It should check or submit a sitemap only when the sitemap route, robots reference, canonical host, public route structure, or Search Console state changed. For ordinary edits to existing pages, IndexNow URL submission is the post-push sync path.

## Install

Clone the repository:

```bash
git clone https://github.com/<owner>/<repo>.git
```

Then copy or symlink the skills you want into the skills directory supported by your agent or runner.

Skill directories at the repository root are developer-facing skills (deployment, code review, billing, packaging, etc.). Skills under `content/` are content & marketing skills (social media, blogging, WeChat). Both are valid skills and follow the same `SKILL.md` convention; the subdirectory is for organization only.

Codex example:

```bash
mkdir -p ~/.codex/skills
cp -R jz-create-site ~/.codex/skills/
cp -R jz-launch-domain ~/.codex/skills/
cp -R jz-setup-site-analytics ~/.codex/skills/
cp -R jz-add-search-index ~/.codex/skills/
cp -R jz-add-gh-collaborator ~/.codex/skills/
cp -R jz-commit-code ~/.codex/skills/
cp -R jz-push-code ~/.codex/skills/
cp -R jz-audit-vercel-cost ~/.codex/skills/
cp -R jz-audit-cf-cost ~/.codex/skills/
cp -R jz-build-personal-context ~/.codex/skills/
cp -R jz-pack-source ~/.codex/skills/
cp -R content/jz-fetch-x ~/.codex/skills/
```

If your runner can read this repository directly, no copy step is needed.

Each skill may include an `agents/openai.yaml` file. These files provide display metadata and default prompts for OpenAI/Codex-style runners. The skills still work from `SKILL.md` without that metadata, but the metadata is useful when publishing or listing the pack.

## Usage

Invoke a skill by name in your agent:

```text
Use $jz-create-site to publish this local website.
```

```text
Use $jz-launch-domain to connect example.com to this deployed site.
```

```text
Use $jz-setup-site-analytics to set up analytics and search indexing for example.com.
```

```text
Use $jz-add-search-index to add IndexNow support to this web app.
```

```text
Use $jz-add-gh-collaborator to prepare fork-only GitHub access for this repo.
```

```text
Use $jz-commit-code to review and commit these changes.
```

```text
Use $jz-push-code to verify, push, and sync changed public URLs.
```

```text
Use $jz-audit-vercel-cost to reconcile this Vercel receipt with usage data.
```

```text
Use $jz-audit-cf-cost to check running resource costs in the current Cloudflare billing cycle.
```

```text
Use $jz-build-personal-context to interview me, create about.md, voice.md, anti-style.md in ~/Projects/aboutme, and enable all targets with -g.
```

```text
Use $jz-fetch-x to fetch the latest 100 X posts for @mercor_ai and save them as Markdown and JSON.
```

```text
Use $jz-pack-source to package the source tree into a zip for review.
```

## Configuration

The skills use authenticated CLIs, API tokens, browser sessions, or environment variables depending on the task.

Copy `.env.example` to `.env` if your runner loads env files before invoking skills:

```bash
cp .env.example .env
```

Prepare only the credentials needed for the skills you run.

### Credentials by skill

| Skill | Required for the core path | Optional branches |
| --- | --- | --- |
| `jz-create-site` | GitHub CLI auth (`gh auth login`), Vercel CLI auth (`vercel login`), `GITHUB_OWNER`, `VERCEL_SCOPE` | Production app env vars copied to Vercel |
| `jz-launch-domain` | Hosting provider auth, DNS provider auth when DNS must be changed, registrar auth when nameservers must be changed | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SPACESHIP_API_KEY`, `SPACESHIP_API_SECRET`, Cloudflare Email Routing permissions if inbound forwarding is requested, authenticated browser session for providers without API coverage |
| `jz-setup-site-analytics` | Final public domain | Analytics credentials, Google OAuth/ADC for Search Console and Site Verification, Cloudflare DNS token for verification TXT records, `BING_WEBMASTER_API_KEY`, `SITE_INTEGRATIONS_CONFIG` with per-domain Clarity config, or `CLARITY_ID` and `CLARITY_TOKEN` |
| `jz-add-search-index` | Writable repo with a known final host | `INDEXNOW_KEY` only if overriding the generated key; otherwise the skill creates a fresh key |
| `jz-add-gh-collaborator` | GitHub CLI auth for `OWNER_ACCOUNT`; agent account details from local config or user input | `ADD_CLOUD_AGENT_COLLABORATOR_CONFIG`, `AGENT_GITHUB`, `AGENT_EMAIL` |
| `jz-commit-code` | Git repository with local changes | None |
| `jz-push-code` | Clean committed branch and remote push access | IndexNow/Search Console credentials only for public site URL sync |
| `jz-audit-vercel-cost` | Vercel CLI auth and access to the relevant team/project usage | Receipt date, billing cycle day, platform fee override |
| `jz-audit-cf-cost` | Cloudflare API Token (Account: Analytics: Read), `CLOUDFLARE_ACCOUNT_ID` | Optional hourly cost monitor (jinzheceo) |
| `jz-fetch-x` | RapidAPI key for the Twittr X API | Optional local `.env` fallback inside the skill directory |
| `jz-pack-source` | A git repository to package | None |

Common variables:

- `GITHUB_OWNER`: default GitHub owner for new repositories.
- `VERCEL_SCOPE`: default Vercel team or personal scope.
- `CLOUDFLARE_API_TOKEN`: DNS edits, verification records, optional proxy/TLS/email routing changes.
- `CLOUDFLARE_ACCOUNT_ID`: account-scoped Cloudflare operations.
- `SPACESHIP_API_KEY` and `SPACESHIP_API_SECRET`: Spaceship registrar nameserver updates.
- `UMAMI_BASE_URL`, `UMAMI_SCRIPT_URL`, `UMAMI_ADMIN_USERNAME`, `UMAMI_ADMIN_PASSWORD`: preferred self-hosted Umami setup. Log in through `$UMAMI_BASE_URL/auth/login` and use the returned Bearer token for API calls.
- `UMAMI_API_KEY`: fallback only, for Umami Cloud or compatible providers that explicitly support API-key auth.
- Google OAuth/ADC: Search Console and Site Verification access for the Google account that owns the site. Common local options are `gcloud auth application-default login`, `GOOGLE_APPLICATION_CREDENTIALS`, or another authenticated Google API session.
- `BING_WEBMASTER_API_KEY`: Bing Webmaster Tools site verification and sitemap submission.
- `SITE_INTEGRATIONS_CONFIG`: optional domain-to-repo and integration metadata map. Clarity first reads per-domain `clarity.project_id` and `clarity.token` entries from this map. If the map is missing or lacks Clarity for the target domain, `jz-setup-site-analytics` checks `CLARITY_ID` and `CLARITY_TOKEN` in the current environment. If neither source has both values, Clarity is skipped and reported.
- `CLARITY_ID` and `CLARITY_TOKEN`: optional Clarity project id and project-level Data Export API token for the current run.
- `ADD_CLOUD_AGENT_COLLABORATOR_CONFIG`: optional local env file for cloud-agent GitHub permission setup.

Example `SITE_INTEGRATIONS_CONFIG` file:

```json
{
  "domains": {
    "example.com": {
      "repo_dir": "/absolute/path/to/repo",
      "clarity": {
        "project_id": "existing-clarity-project-id",
        "project_name": "Optional project name",
        "token": "project-level-data-export-token"
      }
    }
  }
}
```

Point the variable at the JSON file:

```bash
export SITE_INTEGRATIONS_CONFIG=/absolute/path/to/config/site-integrations.json
```

Keep files that contain Clarity tokens out of public commits.

Environment fallback:

```bash
export CLARITY_ID=existing-clarity-project-id
export CLARITY_TOKEN=project-level-data-export-token
```

Never commit `.env`, local Vercel bindings, browser state, or generated auth caches. The repository `.gitignore` excludes `.env` and `.env.*`, while allowing `.env.example`.

Missing optional credentials or config files should not stop unrelated steps. For example, missing Clarity, Umami, or `SITE_INTEGRATIONS_CONFIG` should only mark the affected integration as skipped in the final report after supported fallbacks are checked.

## Index onboarding data sources

`jz-setup-site-analytics` combines several sources because they answer different questions about the same site.

| Source | Main use | Overlap | Unique value |
| --- | --- | --- | --- |
| Umami-compatible analytics | Measures on-site visits, referrers, pages, countries, devices, and events. | Overlaps with Clarity on visits and pages. | Own first-party traffic view, simple event tracking, self-hostable option. |
| Google Search Console | Measures Google Search impressions, clicks, queries, pages, indexing, and sitemap status. | Overlaps with Bing Webmaster Tools on search indexing and sitemap submission. | Google-specific query and indexing data. |
| IndexNow | Pushes changed URLs to participating search engines. | Complements sitemap submission in Google/Bing. | Fast URL discovery signal after content changes. |
| Bing Webmaster Tools | Measures Bing search presence, verifies the site, and submits sitemaps/URLs. | Overlaps with Google Search Console on search performance and index health. | Bing-specific index state and API-based URL/feed submission. |
| Microsoft Clarity | Shows session behavior, heatmaps, recordings, rage clicks, and UX friction. | Overlaps with analytics on page visits. | Behavior-level evidence that aggregate analytics cannot show. |

Gaps worth adding later:

- Server logs or CDN logs for bot traffic, status codes, cache hits, and crawler access.
- Web analytics alternatives such as Plausible, PostHog, Fathom, or Cloudflare Web Analytics.
- Error monitoring such as Sentry for runtime failures.
- Performance data from PageSpeed Insights, CrUX, or WebPageTest.
- Ads and campaign data from Google Ads, Microsoft Ads, Meta, or UTM warehouses.
- SEO rank and keyword tools such as Ahrefs, Semrush, or DataForSEO.
- Uptime checks and synthetic monitoring.

## Design

The workflow is split into several skills instead of one large skill because each stage has different inputs, permissions, and completion criteria:

- Deployment can finish before a custom domain exists.
- DNS propagation may need waiting and rechecks.
- Search and analytics setup runs after the final domain is reachable.
- IndexNow can be added independently to an existing website.

This keeps each skill easier to audit and safer to run.

## License

MIT
