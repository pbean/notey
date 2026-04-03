---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - product-brief-notey.md
  - product-brief-notey-distillate.md
workflowType: 'research'
lastStep: 1
research_type: 'market'
research_topic: 'Notey - Developer-focused instant capture notepad'
research_goals: 'Understand competitive landscape, market sizing, customer segments, and strategic positioning for a lightweight Tauri-based developer notepad with global hotkey capture, terminal CLI integration, and workspace-aware notes'
user_name: 'Pinkyd'
date: '2026-04-02'
web_research_enabled: true
source_verification: true
---

# Market Research: Notey - Developer-focused instant capture notepad

## Research Initialization

### Research Understanding Confirmed

**Topic**: Notey - Developer-focused instant capture notepad
**Goals**: Understand competitive landscape, market sizing, customer segments, and strategic positioning for a lightweight Tauri-based developer notepad with global hotkey capture, terminal CLI integration, and workspace-aware notes
**Research Type**: Market Research
**Date**: 2026-04-02

### Research Scope

**Market Analysis Focus Areas:**

- Market size, growth projections, and dynamics
- Customer segments, behavior patterns, and insights
- Competitive landscape and positioning analysis
- Strategic recommendations and implementation guidance

**Research Methodology:**

- Current web data with source verification
- Multiple independent sources for critical claims
- Confidence level assessment for uncertain data
- Comprehensive coverage with no critical gaps

### Next Steps

**Research Workflow:**

1. Initialization and scope setting (current step)
2. Customer Insights and Behavior Analysis
3. Competitive Landscape Analysis
4. Strategic Synthesis and Recommendations

**Research Status**: Scope confirmed by user on 2026-04-02, proceeding with detailed market analysis

---

## Customer Behavior and Segments

### Customer Behavior Patterns

Developers maintain three distinct note-taking patterns during coding work, each with different tool expectations:

1. **Running coding journals** -- step-by-step documentation of work in progress: code snippets, shell commands, links, mistakes, and explorations. These are "dynamic coding journals" capturing what was tried, the output, and insights gathered.
2. **Topical reference notes** -- self-contained notes on individual topics (e.g., "how to structure REST API endpoints") or recipe-style snippets (e.g., "how to cherry-pick commits in git").
3. **Scratchpad / throwaway content** -- quick experiments, Slack messages drafted before sending, JSON API responses, meeting notes, daily to-do lists. Most developers maintain some form of "quick way of doing experiments" with titles like "dummy", "scratchpad", or "junk."

The critical insight: developers clearly distinguish "knowledge management" (Obsidian/Notion) from "ephemeral scratch capture" -- these are different use cases, not one product. Community discussions (Heynote HN thread: 978 points, 294 comments) show deep frustration with tools that conflate the two.

_Behavior Drivers: The #1 driver is **flow state preservation**. Research consistently shows 15-25 minutes to regain deep focus after an interruption (Gloria Mark, UC Irvine). Developers want sub-200ms capture -- anything slower breaks the flow state they're trying to protect. A Microsoft Research study found developers lose 10-15 minutes of productive time per interruption on average._

_Interaction Preferences: Keyboard-first, zero-mouse, instant-dismiss. The "WhatsApp group with just me" pattern -- real and widespread -- reveals that developers will use absurdly inappropriate tools for capture if the activation energy is low enough. The threshold for adoption is: can I capture a thought in under 2 seconds without leaving my current context?_

_Decision Habits: Developers discover tools via peer recommendation (Stack Overflow 2025: 84% use SO as primary resource), GitHub Trending, Hacker News, and Reddit. They evaluate by trying, not reading marketing pages. "Try before you buy" is non-negotiable. Free tiers and open-source licensing dramatically lower adoption barriers._

**Sources:**
- [Note Taking Practices for Software Developers (May 2025)](https://medium.com/@alekseyrubtsov/note-taking-practices-for-software-developers-51c31870dc25)
- [JetBrains State of Developer Ecosystem 2025](https://devecosystem-2025.jetbrains.com/productivity)
- [2025 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2025/)
- [Show HN: Heynote - A Dedicated Scratchpad for Developers](https://news.ycombinator.com/item?id=38733968)

### Demographic Segmentation

**Global Developer Population (2025-2026 estimates):**

| Source | Estimate | Date |
|---|---|---|
| Evans Data Corporation | ~28.7-30M professional developers | 2024-2025 |
| SlashData (State of the Developer Nation) | ~40M active developers (incl. hobbyists) | Q3 2024 |
| GitHub | 100M+ registered accounts (broader community) | 2024 |
| Stack Overflow Developer Survey 2025 | 49,000+ respondents, 177 countries | Dec 2025 |

**Developer tools market:** USD $6.41B (2025) growing to $7.44B (2026), projected $15.72B by 2031 at 16.12% CAGR (Mordor Intelligence). Alternate estimate: $7.47B (2025) to $8.78B (2026), projected $37.38B by 2035 at 17.47% CAGR (Global Growth Insights, wider scope).

_Role Breakdown (Stack Overflow 2024-2025):_
| Role | Approximate Share |
|---|---|
| Full-Stack Developer | ~33-35% |
| Backend Developer | ~20-23% |
| Frontend Developer | ~15-17% |
| DevOps / SRE / Infrastructure | ~8-10% |
| Mobile Developer | ~8-10% |
| Data / ML / AI | ~7-9% |

_OS Usage Among Developers (Stack Overflow 2025):_
| OS | Share |
|---|---|
| Ubuntu | 27.8% personal / 27.7% professional |
| Debian | 11.4% personal / 10.4% professional |
| Other Linux distros | 17.6% personal / 16.7% professional |
| **Combined Linux (all distros)** | **~55-57% use some Linux distribution** |
| macOS | ~31-33% |
| Windows | ~45-48% |

78.5% of developers worldwide use Linux as a primary *or secondary* OS (including WSL, servers, containers). Linux developer usage is 12-16x higher than general population desktop share (4.7%).

_Geographic Distribution:_ US (~16-18%), India (~14-16%, fastest growing -- projected to surpass US by 2025-2026), China (~10-12%), Europe total (~25-28%), with Africa and Southeast Asia as fastest-growing regions by percentage.

**Sources:**
- [Mordor Intelligence -- Software Development Tools Market](https://www.mordorintelligence.com/industry-reports/software-development-tools-market)
- [Stack Overflow 2025 Developer Survey -- Technology](https://survey.stackoverflow.co/2025/technology)
- [CommandLinux -- Developer OS Preference Statistics](https://commandlinux.com/statistics/developer-os-preference-stack-overflow-survey/)
- [It's FOSS -- Linux Market Share Statistics March 2026](https://itsfoss.com/linux-market-share/)

### Psychographic Profiles

**The "Flow State Guardian" (Primary Segment)**

This developer's core value is **uninterrupted deep work**. They view every tool through the lens of: "Does this help me stay in flow or does it break it?" They are privacy-conscious, skeptical of cloud services, and strongly prefer tools that respect their attention and data. They maintain dotfiles repos, customize their terminal, and evaluate tools by source code quality.

_Values and Beliefs:_ Local-first data ownership is a non-negotiable. The local-first movement has reached mainstream status -- FOSDEM 2026 hosted its first-ever Local-First devroom (22 talks, 25 speakers), and a manifesto signed by 500 software architects signals a decisive shift away from cloud-only paradigms. Record-breaking data breaches in 2025 intensified developer distrust of centralized data stores. These developers believe their tools should be invisible when not needed and instant when summoned.

_Lifestyle Preferences:_ Keyboard-driven, terminal-first. ~25-30% of developers use Vim/Neovim or terminal-based editors as their primary editor (JetBrains 2024). This segment overlaps heavily with Linux users and senior/staff+ engineers. They are disproportionately influential as blog authors, OSS maintainers, and conference speakers.

_Attitudes and Opinions:_ Deep frustration with Electron bloat is intensifying. Discord reaching 4GB RAM, macOS system-lag bugs filed against Electron apps, and RAM price increases all fuel resentment toward heavyweight frameworks. Developers in this segment actively seek Tauri/native alternatives. Tauri adoption is up 35% YoY with 17,700+ Discord members. Benchmark data shows Tauri apps use 50% less memory, 10x smaller app size, and 40% faster startup than Electron equivalents.

_Personality Traits:_ Opinionated, vocal, and community-oriented. They share tools via dotfiles, blog posts, and HN/Reddit comments. A single well-placed recommendation can drive thousands of downloads. They reject "marketing" but respond strongly to authentic, developer-to-developer communication (Show HN posts, README quality, demo GIFs).

**Sources:**
- [FOSDEM 2026: Local-First Devroom](https://fosdem.org/2026/schedule/track/local-first/)
- [Local-First Software Development Patterns for 2026 - TechChampion](https://tech-champion.com/software-engineering/the-local-first-manifesto-why-the-cloud-is-losing-its-luster-in-2026/)
- [RAM Prices Soar but Electron Apps Use More RAM - WindowsLatest (Dec 2025)](https://www.windowslatest.com/2025/12/07/ram-prices-soar-but-popular-windows-11-apps-are-using-more-ram-due-to-electron-web-components/)
- [Tauri vs Electron: Rust's Approach - DasRoot (March 2026)](https://dasroot.net/posts/2026/03/tauri-vs-electron-rust-cross-platform-apps/)

### Customer Segment Profiles

**Segment 1: The Terminal Power User (High Priority)**

Demographics: Senior/Staff+ engineers, 8-15+ years experience, backend/DevOps/SRE roles. Disproportionately Linux users (Arch, NixOS, Fedora). Age 28-45. Located primarily in US, Europe (Germany, Nordics, Eastern Europe), and increasingly India.

Behavior: Lives in terminal. Uses fzf, ripgrep, jq, tmux daily. Discovers tools via dotfiles repos, HN, and `brew install` / `pacman -S`. Will reject any tool that can't be piped to. The CLI-first workflow (`docker logs | notey add --stdin`) is the #1 differentiator for this segment. Successful CLI tools follow a proven adoption trajectory: GitHub launch -> HN/Reddit post -> package manager inclusion -> blog posts/tutorials -> default in dotfiles/starter configs -> critical mass (typically 2-4 years). Reference: fzf (~65K stars), ripgrep (~48K stars), jq (~30K stars).

Psychographic: Values transparency (open source), efficiency (low resource usage), and composability (Unix philosophy). Hostile to bloatware, subscription models, and telemetry. Will champion tools they love -- this segment is the viral engine for developer tools.

**Segment 2: The Full-Stack Multitasker (Primary Volume)**

Demographics: Mid-level full-stack developers, 3-7 years experience. Uses VS Code (73-74% market share). Windows or macOS. Age 24-35. Globally distributed with concentration in US, India, Western Europe, Brazil.

Behavior: Juggles average of 14 tools. 52% flag context switching as a major productivity drain. 75% lose 6-15 hours/week to tool sprawl. Currently captures notes in untitled VS Code tabs, Notion, Apple Notes, or "a WhatsApp group with just me." The global hotkey -> floating window -> dismiss workflow directly addresses their pain. They want zero-config, zero-learning-curve capture.

Psychographic: Pragmatic, less ideological than Segment 1. Cares about "does it work?" more than "is it open source?" but appreciates free/open-source pricing. Willing to adopt new tools if the friction reduction is immediately obvious. Responds to demo GIFs and 30-second pitch videos.

**Segment 3: The Linux Desktop Enthusiast (Strategic Wedge)**

Demographics: Linux-first developers, often backend or embedded engineers. Uses GNOME, KDE Plasma, Sway, or Hyprland. Vocal community presence on Reddit (r/linux, r/unixporn), Lemmy, and the Fediverse. Disproportionately in Europe, India, and open-source-heavy tech scenes.

Behavior: Underserved by existing scratchpad tools -- Apple Notes doesn't exist on Linux, Electron alternatives are "exactly the kind of bloat this audience rejects." LinNote (KDE/Qt6 scratchpad) shows demand exists. This segment evaluates tools by: package availability (AUR, DEB, Flatpak), resource footprint, integration with tiling window managers, and Wayland compatibility. They will file bugs, contribute patches, and evangelize hard.

Psychographic: Passionate about software freedom, privacy, and technical excellence. Suspicious of commercial motives but deeply loyal to tools that treat Linux as a first-class citizen. The Tauri-on-Linux story (native GTK3+WebKit2GTK, small footprint, no Electron) is inherently compelling to this segment.

**Sources:**
- [Tool Sprawl Costs Devs 15 Hours Weekly - ByteIota](https://byteiota.com/tool-sprawl-costs-devs-15-hours-weekly-the-1m-crisis/)
- [Stack Overflow 2025 Developer Survey](https://survey.stackoverflow.co/2025/)
- [LinNote - LinuxLinks](https://www.linuxlinks.com/linnote-scratchpad/)

### Behavior Drivers and Influences

_Emotional Drivers:_ **Flow state anxiety** -- the fear of losing a thought or context during deep work. Developers report that the cost isn't just lost notes, it's lost flow. The 15-25 minute recovery time creates genuine frustration when capture tools add friction. "I just need to write this down before I forget" is the emotional trigger that drives adoption.

_Rational Drivers:_ **Measurable time savings.** Tool fatigue research shows $1M annually per development team lost to tool sprawl productivity costs. Developers want fewer tools, not more -- but they'll add one if it demonstrably replaces a worse workflow. The calculus: "Is hotkey -> type -> Esc faster than Cmd+Tab -> open app -> find note -> type -> Cmd+Tab back?" If yes by >2 seconds, adoption follows.

_Social Influences:_ Peer recommendation is the #1 discovery channel. A front-page Hacker News post can drive 10K-50K visits in 24 hours. GitHub Trending can add 500-2,000 stars in a day. Twitter/X is declining as a developer hub post-2023 with migration to Bluesky and Mastodon. YouTube influence is growing (Fireship, ThePrimeagen, TJ DeVries for terminal/keyboard-first content). CLI tool virality follows a specific pattern: `notey` commands appearing in blog posts, tutorials, shell aliases, and Stack Overflow answers -- the same growth path as jq, fzf, and ripgrep.

_Economic Influences:_ Individual developers strongly prefer free tools; willingness-to-pay ceiling is roughly $5-15/month for personal productivity tools. Enterprise context raises WTP to $20-50/user/month. However, GitHub Copilot's trajectory ($1B+ ARR, 4.7M paid subscribers, 75% YoY growth, 42% market share) proves developers *will* pay for productivity -- especially tools with clear, measurable time savings. The open-source/MIT-licensed approach eliminates the primary adoption barrier. Monetization (if desired later) follows the Obsidian model: free core, paid premium features ($2M revenue, 18 employees, bootstrapped, zero external funding).

**Sources:**
- [GetPanto -- GitHub Copilot Statistics 2026](https://www.getpanto.ai/blog/github-copilot-statistics)
- [CB Insights -- AI Coding Market Share Dec 2025](https://www.cbinsights.com/research/report/coding-ai-market-share-december-2025/)
- [GetLatka -- Obsidian.md Revenue](https://getlatka.com/companies/obsidian.md)
- [SaaStr -- Notion at $11 Billion](https://www.saastr.com/notion-and-growing-into-your-10b-valuation-a-masterclass-in-patience/)

### Customer Interaction Patterns

_Research and Discovery:_ Developers find tools through: (1) Hacker News / Reddit front page posts, (2) GitHub Trending, (3) peer recommendations in Slack/Discord communities, (4) dotfiles repos and blog posts (passive discovery), (5) YouTube tool reviews. Stack Overflow (84%), GitHub (67%), and YouTube (61%) are the leading knowledge resources (SO 2025). 68% of new developers rely heavily on technical documentation -- README quality is a make-or-break first impression.

_Evaluation Process:_ "Try before you buy" is non-negotiable. Developers evaluate by: (1) README quality and first-impression demo GIF, (2) `brew install notey` or equivalent one-liner, (3) 30-second test of the core workflow, (4) checking resource usage (`htop`), (5) reading source code quality (for OSS), (6) checking issue tracker activity (alive? responsive maintainers?). The entire evaluation takes 5-15 minutes. If the hotkey-to-capture loop doesn't feel instant in the first try, they're gone.

_Adoption Decision:_ For open-source tools, the adoption decision is: "Does it solve my problem better than my current hack?" The current hacks (untitled editor tabs, WhatsApp self-messages, random text files) have zero switching cost -- but also zero search, zero organization, and zero persistence guarantees. Notey's value proposition is the upgrade from "it works but it's embarrassing" to "it works and it's good."

_Loyalty and Retention:_ Developer tool loyalty is driven by: (1) reliability -- data loss is an instant uninstall, (2) low maintenance -- auto-updates, no config rot, (3) continued development -- stale repos get abandoned, (4) community responsiveness -- PRs reviewed, issues acknowledged. The auto-save + SQLite + local storage combination directly addresses the #1 loyalty killer (data loss anxiety). Tools that become part of muscle memory (global hotkey -> type -> Esc) are extremely sticky.

**Sources:**
- [2025 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2025/)
- [AI Tool Fatigue 2026 - BuildMVPFast](https://www.buildmvpfast.com/blog/ai-fatigue-tool-overwhelm-developer-counter-trend-2026)
- [Tool Consolidation in 2026 - Asrify](https://asrify.com/blog/tool-consolidation-trend-2026)

---

## Customer Pain Points and Needs

### Customer Challenges and Frustrations

Developer frustration with note capture falls into five distinct categories, each validated by community data:

**1. Context Switching Destroys Flow State**

The #1 frustration. Developers experience 12-15 major context switches daily, with 23 minutes 15 seconds recovery time per switch (UC Irvine research). That equals 4.5+ hours of lost deep focus per day. Average developer toggles between apps 1,200 times/day across 10+ applications. The economic cost: an estimated $450 billion annually to the U.S. economy.

Developer quote: *"Half my stress isn't the work itself -- it's trying to remember where I left off."* (Taking Notes With The Terminal, Jan 2026)

**2. Organizational Overhead Kills Adoption**

Developer **blobfish01** on Hacker News: *"When I have to start 'coding' my notes, it becomes a time burden and I end up skipping it."* Multiple developers report abandoning note systems that require organizational decisions at capture time. The "capture vs. curation" distinction is critical -- developers want to dump thoughts first and organize later (or never).

**3. Search and Retrieval Failure**

Developer **rahmansahinler1** (HN, March 2025): *"as my notes grow, finding the right one becomes a challenge"* -- specifically requesting semantic search because *"I sometimes forget how I took that note and couldn't find where did I put it."* Developer **drweevil** noted full-text search becomes problematic *"with years of notes on a modest machine."*

**4. Tool Fragmentation**

No single tool handles the capture workflow well. Developers cycle through Trello, Notion, Google Tasks, email-based read-later, and Outlook To Do -- none feeling natural. Tools like Obsidian are rejected because they require *"another app, dashboards, backlinks, or graphs of my notes."* The result: 94% of developers are dissatisfied with current toolsets (CloudBees 2025).

**5. Vendor Lock-in and Data Control**

Developer **rjes** (HN): OneNote *"is a lock-in solution and the search isn't very good."* Developer **seanwilson** expressed concern about trusting third parties, preferring locally-controlled files. The local-first manifesto signed by 500 architects validates this as a mainstream concern, not a fringe preference.

_Frequency Analysis: These frustrations occur daily -- they're not edge cases. The "WhatsApp group with just me" pattern exists because every alternative adds enough friction to be worse than an absurd workaround._

**Sources:**
- [Taking Notes With The Terminal (Jan 2026)](https://charnley.github.io/blog/2026/01/03/note-taking-for-programmers-zk-vscode-vim.html)
- [Ask HN: What note taking app do you guys use? (March 2025)](https://news.ycombinator.com/item?id=43299636)
- [Speakwise: Context Switching Statistics 2026](https://speakwiseapp.com/blog/context-switching-statistics)
- [2025 DevOps Migration Index - CloudBees](https://www.cloudbees.com/blog/2025-devops-migration-index-rip-and-replace-failing-enterprises)

### Unmet Customer Needs

**Critical Unmet Need #1: Workspace/Project-Aware Notes**

No existing tool automatically associates notes with the current development project. Every solution requires manual organization. There is no tool that: detects which project directory you're working in, automatically scopes notes to that project, surfaces relevant notes when you switch projects, or captures clipboard/scratch content per-project context. This is a completely open gap across the entire market.

**Critical Unmet Need #2: Unified CLI + GUI Capture**

Terminal tools (Thoth, Snip) lack GUI. GUI tools (Heynote, Stashpad) lack CLI. No tool lets you `docker logs | notey add --stdin` AND hotkey into a floating window in the same workflow. This dual-interface pattern is what terminal-heavy developers actually need.

**Critical Unmet Need #3: Working Global Hotkey on Wayland/Linux**

Global hotkeys are fundamentally broken on Wayland. Electron's `globalShortcut` API doesn't work (issues #45607, #15863). Tauri's `global-hotkey` crate lacks Wayland support (issue #28). Even Warp terminal and Albert launcher are affected. The `org.freedesktop.portal.GlobalShortcuts` portal exists but lacks implementations on GNOME and wlroots. Solving this -- even partially -- would be a major differentiator.

**Critical Unmet Need #4: Lightweight Quick Capture (Not "Yet Another App")**

Obsidian users have created a dedicated forum thread: *"Obsidian Lite - Or, How Do You Do Quick Notes?"* -- *"It takes a few seconds to load and something like notepad is just so much quicker."* Community workarounds include using separate lighter apps (Drafts, Quick Draft, PowerShell scripts) for capture and syncing to Obsidian later. The demand for a capture-specific tool separate from knowledge management is explicitly articulated.

**Critical Unmet Need #5: Developer-Aware Clipboard Capture**

Clipboard managers (CopyQ, Ditto, Paste) capture everything but have no awareness of what project you're in, no code-aware formatting (clips lose syntax context), and no automatic tagging by source application. CopyQ's Wayland support is severely limited -- monitoring works but pasting requires workarounds. The `ext_data_control_v1` Wayland protocol exists for clipboard managers but most tools don't implement it.

_Priority Analysis: Workspace awareness (#1) and CLI+GUI unification (#2) are the highest-opportunity gaps because they are completely unaddressed. Global hotkey on Wayland (#3) has massive impact but is a hard engineering problem. Quick capture (#4) and clipboard awareness (#5) are partially addressed by existing tools but not well._

**Sources:**
- [Obsidian Forum: Obsidian Lite - How Do You Do Quick Notes?](https://forum.obsidian.md/t/obsidian-lite-or-how-do-you-do-quick-notes/106358)
- [Tauri global-hotkey: Wayland Support Issue #28](https://github.com/tauri-apps/global-hotkey/issues/28)
- [Electron: Global Shortcuts Broken on Wayland #45607](https://github.com/electron/electron/issues/45607)
- [BigGo News: Clyp Wayland Support Critical Limitations](https://biggo.com/news/202508230115_Clyp_Wayland_Support_Issues)
- [Obsidian Forum: App Dedicated to Quick Notes](https://forum.obsidian.md/t/app-dedicated-to-quick-notes/102094)

### Barriers to Adoption

_Price Barriers:_ For open-source tools, price is not a barrier -- it's an advantage. Stashpad's $8-10/month is considered expensive for a scratchpad by community feedback. Obsidian's core is free with Sync at $4/mo. The expected price for a developer capture tool is $0 (open-source) with optional paid premium features. GitHub Copilot ($10/mo) proves developers will pay for productivity, but the bar is high: the time savings must be immediately obvious.

_Technical Barriers:_
- **Installation complexity** -- developers expect `brew install notey`, `pacman -S notey`, or a single download. Multi-step installation is a hard stop. Heynote's #20 issue (Flatpak release, 13+ upvotes) and #14 (Arch package) show package availability directly impacts adoption.
- **Wayland compatibility** -- a tool that doesn't work on Wayland excludes a growing segment of Linux users. JetBrains made Wayland default in 2026.1 but still has window centering, splash screen, and popup positioning issues after years of dedicated platform team effort.
- **WebView fragmentation** -- Tauri uses system WebView, meaning different rendering across OS versions. CSS/JS must be conservative.

_Trust Barriers:_
- **Data safety** -- auto-save must be bulletproof. The VS Code Scratchpads extension had a migration-breaking bug in v2.0.0 where existing scratchpads disappeared. One incident like this ends adoption permanently.
- **Privacy concerns** -- anti-bloat developer sentiment (HN): *"a notepad should never touch the network."* Any telemetry, analytics, or network requests will trigger backlash. Windows Notepad adding AI features created a "privacy tension" thread.
- **AI trust deficit** -- only 3.1% of developers "highly trust" AI tools, and 46% don't trust AI output at all. Adding AI features to v1 would hurt more than help.

_Convenience Barriers:_
- **macOS accessibility permissions** -- global shortcuts require explicit user grant in System Settings > Privacy & Security. Developers who install and press the hotkey with no response will assume the tool is broken. First-run permission guidance is critical.
- **Learning curve** -- must be zero. Developer **evnc** (HN): *"if I'm trying to do that, then by the time I find where my idea goes, I've lost the idea."* Any feature that requires reading documentation to use will be ignored.

**Sources:**
- [Heynote Issues: Flatpak #20, Arch #14](https://github.com/heyman/heynote/issues)
- [Windows Notepad AI Privacy Tension](https://windowsforum.com/threads/windows-notepad-in-2026-markdown-tabs-autosave-and-the-ai-privacy-tension.406352/)
- [Stack Overflow Blog: Developers remain willing but reluctant to use AI (Dec 2025)](https://stackoverflow.blog/2025/12/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here/)
- [VS Marketplace: Scratchpads migration bug](https://marketplace.visualstudio.com/items?itemName=buenon.scratchpads)

### Service and Support Pain Points

_Competitor-Specific Service Issues:_

**Obsidian:** Startup performance is the top complaint. Users report 8.6 seconds total startup time (3,266 files, 21 tabs, 49 plugins). The CEO (kepano) acknowledged in 2025: *"Performance is design, and every millisecond counts."* Mobile startup improved to under 500ms, but desktop with plugins remains sluggish. The community consensus: use a separate lighter tool for capture and sync to Obsidian later.

**Notion:** *"A lack of offline mode has been a deal-breaker"* -- particularly when traveling. API rate limits (3 requests/second per integration) bottleneck heavy automation. Export breaks complex relationships and proprietary block types. Users spend excessive time *"building my workspace"* instead of working. Notion prioritizes breadth (email, calendar, forms) over fixing core issues.

**Heynote:** 77 open issues. Top requests: Vim keybindings (#24), Flatpak release (#20), global hotkey for new blocks (#456), close-on-Escape with tray mode (#223), plugin system (#75). The Tauri fork "hinote" (github.com/mtfcd/hinote) exists precisely because users want a non-Electron version. Heynote's 427MB bundle size was specifically criticized in HN comments.

**Stashpad:** $8-10/month pricing considered expensive. No custom keyboard shortcuts (ironic for a keyboard-first tool). No integrations with GitHub/Jira/Slack. No import from Notion/Obsidian/Markdown files. No AI capabilities. Despite 4.92/5 Product Hunt rating, adoption is limited by pricing.

**Sources:**
- [Obsidian Forum: Performance, Slow Startup](https://forum.obsidian.md/t/performance-slow-startup-workspace-question/111801)
- [XDA: Notion Falling Behind Alternatives](https://www.xda-developers.com/notion-starting-to-fall-behind-alternatives-cant-see-myself-sticking-around/)
- [Heynote Issues (sorted by reactions)](https://github.com/heyman/heynote/issues?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc)
- [Product Hunt: Stashpad Reviews](https://www.producthunt.com/products/stashpad-2/reviews)

### Customer Satisfaction Gaps

_Expectation Gaps:_ Developers expect a capture tool to "just work" -- hotkey, type, dismiss. The reality: Obsidian takes 8.6s to start, Notion requires internet, VS Code extensions only work when the editor is focused, and Heynote lacks a floating window mode with global hotkey. The gap between "what should exist" and "what does exist" is the entire opportunity.

_Quality Gaps:_ Heynote is the closest competitor but expanding toward images, Mermaid diagrams, and drawing annotations (v2.8) -- drifting from core scratchpad simplicity toward feature sprawl. Its tagline shifted from "developers" to "power users," signaling a broadening focus that may alienate the original audience.

_Value Perception Gaps:_ Stashpad charges $8-10/month for a scratchpad. Multiple HN commenters consider this overpriced. Obsidian charges $4/month for Sync (the feature most relevant to capture). The dominant expectation: a capture tool should be free and open-source, with optional paid services layered on top.

_Trust and Credibility Gaps:_ Notion's export breaks proprietary block types -- data portability promises ring hollow. Electron apps that claim to be "lightweight" while consuming 200MB+ RAM lose credibility. Any tool that makes network requests without clear justification triggers distrust. The AI trust deficit (3.1% "highly trust") means AI-powered features would undermine credibility for this audience.

**Sources:**
- [Heynote v2.8 Release Notes](https://github.com/heyman/heynote/releases/)
- [SourceForge: Stashpad Reviews 2026](https://sourceforge.net/software/product/Stashpad/)
- [eesel AI: Brutally Honest Notion Review 2025](https://www.eesel.ai/blog/notion-review)

### Emotional Impact Assessment

_Frustration Levels:_ **High and daily.** This is not an occasional annoyance -- developers hit capture friction multiple times per hour during coding sessions. The "WhatsApp group with just me" workaround exists because the frustration is severe enough to drive absurd behavior. Developer quote: *"Half my stress isn't the work itself -- it's trying to remember where I left off."*

_Loyalty Risks:_ Low -- because no tool currently commands loyalty in this space. Developers using Obsidian for capture actively wish they didn't have to. Heynote users are requesting features (global hotkey, plugins, Flatpak) that would require architectural changes. The space is ripe for disruption because incumbents don't own the capture workflow -- they just happen to be used for it.

_Reputation Impact:_ Tools that waste RAM (Electron), require internet (Notion), or lose data (VS Code Scratchpads migration bug) are publicly criticized on HN and Reddit. Conversely, a tool that nails the capture workflow becomes a beloved "hidden gem" shared in dotfiles, blog posts, and HN comments. The reputation upside is asymmetric -- a good capture tool generates disproportionate goodwill because developers feel it "gets" them.

_Customer Retention Risks:_ For Notey specifically, the primary retention risk is data loss. Auto-save must be bulletproof (SQLite WAL mode addresses this). Secondary risk: the hotkey stops working after an OS update (Wayland changes, macOS permission resets). Tertiary risk: development stalls -- stale repos get abandoned quickly in the open-source world.

### Pain Point Prioritization

**High Priority (Must Address for Notey v1):**

| Pain Point | Impact | Notey's Answer |
|---|---|---|
| Context switching breaks flow | Affects every developer, every day | Global hotkey -> instant floating window -> Esc to dismiss |
| No workspace-aware notes exist | Completely unaddressed gap in market | Auto-detect git repo / working directory, scope notes to project |
| Organizational overhead kills adoption | #1 reason developers abandon note systems | Auto-save, no folders required, search-first retrieval |
| Electron resource bloat | 200-300MB idle, 427MB bundle, 1-2s startup | Tauri: 30-40MB idle, <10MB bundle, <500ms startup |
| CLI capture gap | Terminal tools lack GUI, GUI tools lack CLI | Unified `notey` CLI binary + floating GUI window |

**Medium Priority (Differentiators that strengthen position):**

| Pain Point | Impact | Notey's Answer |
|---|---|---|
| Clipboard capture lacks project context | Universal copy-paste workflow not leveraged | Clipboard capture with workspace scoping and optional annotation |
| Wayland global hotkey broken | Growing Linux segment affected | xdg-desktop-portal GlobalShortcuts integration (KDE, Sway, Hyprland) |
| Data portability and lock-in fears | Trust barrier for adoption | Export to Markdown/JSON, SQLite local storage, MIT open source |
| macOS accessibility permission confusion | First-run friction on macOS | Detect permission state, guide user through grant flow before first hotkey use |

**Low Priority (Future considerations, not v1 blockers):**

| Pain Point | Impact | Notey's Answer |
|---|---|---|
| GNOME Wayland has no GlobalShortcuts portal | GNOME-specific gap, XWayland fallback works | Document limitation, support XWayland fallback, monitor GNOME progress |
| Vim keybindings | Repeatedly requested in Heynote (#24, top issue) | Not in v1 scope -- evaluate during PRD |
| Plugin/extension ecosystem | Both Heynote (#75) and Stashpad lack this | Plugin-ready architecture ships in v1, no runtime loading until later |
| Mobile quick capture | Heynote's #1 recent request (#467) | Explicitly out of scope for v1 |

**Sources:**
- [9 Common Pain Points That Kill Developer Productivity - Jellyfish](https://jellyfish.co/library/developer-productivity/pain-points/)
- [Wayland Development: Why Developers Still Struggle in 2026 - ByteIota](https://byteiota.com/wayland-development-why-developers-still-struggle-in-2026/)
- [Show HN: Heynote](https://news.ycombinator.com/item?id=38733968)
- [Heynote Issues sorted by reactions](https://github.com/heyman/heynote/issues?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc)

---

## Customer Decision Processes and Journey

### Customer Decision-Making Processes

Developer tool adoption follows a distinct pattern that differs fundamentally from consumer or enterprise software. The decision is individual (not committee-driven), trial-based (not sales-led), and reversible (low switching costs in both directions).

_Decision Stages:_
1. **Trigger** -- A frustration reaches a tipping point ("I just lost another thought because I couldn't capture it fast enough") or a peer shares a tool ("check this out in my dotfiles")
2. **Discovery** -- Encounter the tool via HN, Reddit, GitHub Trending, a blog post, or a dotfiles repo
3. **30-Second Evaluation** -- README scan, demo GIF, "does this look like it solves my problem?"
4. **Installation Test** -- One-command install or abandon. 34.7% of developers abandon tools if setup is difficult -- more than unmaintained projects (26.2%), bad docs (17.3%), or missing features (12.4%) ([Catchy Agency -- What 202 Open Source Developers Taught Us](https://www.catchyagency.com/post/what-202-open-source-developers-taught-us-about-tool-adoption))
5. **First-Use Trial** -- Does the core workflow work in under 60 seconds? For Notey: hotkey -> window appears -> type -> Esc -> back to work
6. **Retention Decision** -- Made within the first week. Either the tool becomes muscle memory or it's forgotten

_Decision Timelines:_ The entire awareness-to-adoption cycle happens in minutes to hours for CLI/desktop tools, not weeks or months. The first 5 minutes are make-or-break. If the tool doesn't deliver its core promise on the first try, there is no second try.

_Complexity Levels:_ Low. This is not an enterprise procurement decision. One developer decides for themselves. The "buying committee" is one person with a terminal open.

_Evaluation Methods:_ Hands-on trial. Developers do not read feature comparison pages or marketing copy. They install, try, and judge. README quality is the only marketing that matters -- it's the storefront, the pitch, and the documentation in one.

**Sources:**
- [Catchy Agency -- What 202 Open Source Developers Taught Us About Tool Adoption](https://www.catchyagency.com/post/what-202-open-source-developers-taught-us-about-tool-adoption)
- [Evil Martians -- 6 Things Developer Tools Must Have in 2026](https://evilmartians.com/chronicles/six-things-developer-tools-must-have-to-earn-trust-and-adoption)
- [Okoone -- Why Developers Keep Ditching Official Tools](https://www.okoone.com/spark/product-design-research/why-developers-keep-ditching-official-tools/)

### Decision Factors and Criteria

_Primary Decision Factors (ranked by impact):_

1. **Does it work instantly?** -- Devtool speed directly affects work speed. Latency is more important than initial speed because devtool user sessions are long. For a capture tool, the benchmark is: hotkey to visible window < 150ms. Anything slower and the tool feels broken.

2. **Is setup trivial?** -- The benchmark is one-command install or under five minutes of manual setup. `brew install notey`, `pacman -S notey`, or download-and-run. No account creation, no configuration wizard, no onboarding tour.

3. **Does it respect my workflow?** -- Developers value tools that integrate smoothly without requiring them to switch between tools or change established habits. A capture tool must be additive (one new hotkey) not disruptive (learn a new system).

4. **Is it maintained?** -- Active development and frequent releases signal reliability. Developers check the GitHub commit history, issue response time, and release cadence. A stale repo is a dead tool.

5. **Is it trustworthy?** -- "A reputation for quality" and a "robust and complete API" rank far higher than "AI integration" when developers endorse technology (JetBrains 2025). The top three deal-breakers for rejecting technology: security/privacy concerns, prohibitive pricing, and availability of better alternatives.

_Secondary Decision Factors:_
- Open source (MIT/Apache) -- eliminates trust and lock-in concerns
- Low resource usage -- developers check `htop` after installing
- Cross-platform -- works on their OS without caveats
- Community size -- signals longevity and support availability

_Evolution Patterns:_ AI integration has dropped as a decision factor. Positive sentiment for AI tools decreased from 70%+ (2023-2024) to 60% (2025). Only 3.1% "highly trust" AI tools. For a capture tool, AI is a liability, not an asset -- it signals unnecessary complexity.

**Sources:**
- [JetBrains -- State of Developer Ecosystem 2025](https://blog.jetbrains.com/research/2025/10/state-of-developer-ecosystem-2025/)
- [Evil Martians -- 6 Things Developer Tools Must Have in 2026](https://evilmartians.com/chronicles/six-things-developer-tools-must-have-to-earn-trust-and-adoption)
- [Stack Overflow Blog -- Developers Remain Willing but Reluctant to Use AI (Dec 2025)](https://stackoverflow.blog/2025/12/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here/)

### Customer Journey Mapping

_Awareness Stage:_ Developers become aware of tools through:
- **Hacker News Show HN** -- A front-page post drives 10K-50K visits in 24 hours. Heynote's Show HN (978 points, 294 comments) is the benchmark for this category. The HN crowd overindexes on open-source, privacy-first products. ([Markepear -- How to Launch a Dev Tool on HN](https://www.markepear.dev/blog/dev-tool-hacker-news-launch))
- **GitHub Trending** -- Being trending for a day can add 500-2,000 stars. Projects that gain stars solve real problems experienced by large developer communities. ([ToolJet -- GitHub Stars Guide 2026](https://blog.tooljet.com/github-stars-guide/))
- **Peer sharing** -- Dotfiles repos, blog posts, and Slack/Discord mentions. Developers spend ~70% of their workday in the terminal; tools appearing in shared dotfiles get adopted through osmosis.
- **Reddit** (r/programming, r/commandline, r/linux) -- Broader reach, more mainstream developer audience
- **YouTube** -- Growing influence. Channels like Fireship, ThePrimeagen, and TJ DeVries drive significant awareness for terminal/keyboard-first tools
- **Developer newsletters** -- Console.dev, TLDR, Changelog provide curated discovery for tools that pass editorial review

_Consideration Stage:_ The entire consideration stage happens on the README page and in the first 30 seconds of the demo GIF. Developers evaluate: (1) Does the demo show MY workflow being solved? (2) Is the install one command? (3) Is it open source? (4) Is it actively maintained? (5) How many stars/forks? -- not as a quality signal, but as a "will this still exist in 6 months?" signal.

_Decision Stage:_ Install and try. The decision is made by feel: "Does this feel fast? Does the hotkey work? Can I dismiss it instantly? Did my note survive?" The trial IS the decision. There is no separate "decision" step after evaluation.

_Post-Adoption Stage:_ If the tool sticks, developers: (1) add it to their dotfiles, (2) configure it, (3) mention it in conversations, (4) star the repo, (5) file issues when something breaks. This creates a virtuous cycle: each adopter becomes a passive distribution channel through their dotfiles and blog posts.

**Sources:**
- [Markepear -- How to Launch a Dev Tool on Hacker News](https://www.markepear.dev/blog/dev-tool-hacker-news-launch)
- [ToolJet -- GitHub Stars Guide: Evaluating Open Source in 2026](https://blog.tooljet.com/github-stars-guide/)
- [NexaSphere -- 12 Modern CLI Tools Every Developer Should Use in 2026](https://nexasphere.io/blog/modern-cli-tools-developers-2026)

### Touchpoint Analysis

_Digital Touchpoints (ranked by conversion impact):_

| Touchpoint | Impact | Role in Journey |
|---|---|---|
| GitHub README + demo GIF | Critical | First impression, make-or-break in 30 seconds |
| Package manager (`brew`, `pacman`, `apt`) | Critical | Installation must be one command |
| Hacker News Show HN post | High | Drives initial awareness spike (10K-50K visits) |
| GitHub Trending page | High | Sustained discovery over 24-48 hours |
| Reddit posts | Medium | Broader reach, more discussion-oriented |
| YouTube tool reviews | Medium | Growing, especially for visual demos |
| Developer newsletters | Medium | Curated, high-trust recommendations |
| Twitter/X / Bluesky | Declining | Fragmented; less reliable than 2022-2023 |
| Dotfiles repos | Low (per instance) but cumulative | Passive, long-tail distribution |

_Information Sources:_ Stack Overflow (84% of developers), GitHub (67%), YouTube (61%) are the top three knowledge resources (SO 2025). For tool-specific decisions, the README and issue tracker are the primary information sources -- not external reviews or marketing sites.

_Influence Channels:_ The HN crowd genuinely likes open-source, privacy-first products. Authentic technical communication (Show HN posts written like fellow builders, not marketers) converts far better than polished landing pages. Answer objections by first finding something to agree with; when criticized, act like the critics are doing you a favor.

**Sources:**
- [2025 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2025/)
- [Markepear -- How to Launch a Dev Tool on HN](https://www.markepear.dev/blog/dev-tool-hacker-news-launch)
- [Onlook -- How to Absolutely Crush Your HN Launch](https://onlook.substack.com/p/launching-on-hacker-news)

### Information Gathering Patterns

_Research Methods:_ Developers don't "research" capture tools the way consumers research purchases. Instead, they encounter a tool, try it in under 5 minutes, and decide. The "research" happens post-adoption: they read the docs to configure it, check the issue tracker for known bugs, and read the source code to understand the architecture.

_Information Sources Trusted:_ Peer developers > GitHub repo quality > HN comments > Technical blog posts > YouTube reviews > Marketing pages (not trusted at all). Developer trust drives adoption more than mandates. A "reputation for quality" ranks far higher than any marketing signal.

_Research Duration:_ 5-15 minutes from discovery to adoption decision. The tool must deliver its core promise within this window. Extended evaluation periods indicate the tool is too complex for its purpose.

_Evaluation Criteria:_ (1) "Does it solve my immediate problem?" (2) "Is the install trivial?" (3) "Does it feel fast?" (4) "Will my data be safe?" (5) "Is it actively maintained?"

### Decision Influencers

_Peer Influence:_ The dominant factor. Developer tool adoption is fundamentally peer-driven. The Obsidian growth story validates this: 1.5M+ active users in 2026, 22% YoY growth, $2M revenue with 18 employees -- achieved through product-led growth where the product's expanding capabilities attract users whose needs aren't met elsewhere, and community forums/Discord (60,000+ active members) foster organic advocacy. No marketing team, no sales force. ([Fueler -- Obsidian Statistics 2026](https://fueler.io/blog/obsidian-usage-revenue-valuation-growth-statistics))

_Expert Influence:_ OpenAI co-founder Andrej Karpathy publishing a "love letter" to Obsidian drove significant awareness. For CLI tools, endorsements from well-known developers (ThePrimeagen for terminal tools, TJ Holowaychuk for developer productivity) carry outsized weight.

_Social Proof Influence:_ GitHub stars are passive interest, not actual usage. Five metrics consistently correlate with real adoption: package downloads, issue quality (production edge cases), contributor retention, community discussion depth, and usage telemetry. Stars may draw attention, but usability, extensibility, and deployability win loyalty. Many successful projects discover their actual user base far exceeds their stars -- enterprises deploy quietly without starring. ([StateShift -- GitHub Stars Don't Mean What You Think](https://blog.stateshift.com/beyond-github-stars/))

_Media Influence:_ Minimal for this category. Developer capture tools are not covered by tech press. The relevant "media" is HN, Reddit, and developer newsletters (Console.dev, TLDR).

**Sources:**
- [Fueler -- Obsidian Usage, Revenue, Valuation & Growth Statistics 2026](https://fueler.io/blog/obsidian-usage-revenue-valuation-growth-statistics)
- [StateShift -- GitHub Stars Don't Mean What You Think](https://blog.stateshift.com/beyond-github-stars/)
- [MacStories -- Obsidian's Popularity Explained](https://www.macstories.net/news/obsidians-popularity-explained/)

### Purchase Decision Factors

_Immediate Adoption Drivers (for a free/open-source tool):_
- "I just lost a thought because my capture workflow is too slow" -- the pain trigger
- Encountering a compelling Show HN demo or dotfiles reference
- A peer saying "I switched to X and it's better" -- social proof from a trusted source
- Package manager availability -- if `brew install notey` works, adoption happens on impulse

_Delayed Adoption Drivers:_
- "I'll try it this weekend" -- deferred because current workflow is "good enough" (the WhatsApp hack)
- Platform concerns -- "Does it work on Wayland?" / "Does it work on my Linux distro?"
- Skepticism about longevity -- "Is this going to be abandoned in 6 months?"
- Waiting for package manager availability -- "I'll install it when it's in the AUR"

_Brand Loyalty Factors:_ For a new tool, "brand" doesn't exist. What substitutes for brand loyalty: (1) muscle memory -- once the hotkey is in your fingers, switching costs increase, (2) data accumulation -- notes pile up, creating lock-in (mitigated by Markdown/JSON export), (3) community belonging -- contributing to a tool you use creates emotional investment.

_Price Sensitivity:_ For v1 open-source: irrelevant (it's free). For future monetization: Obsidian's model ($4/month Sync, $8/month Publish, $50/user/year commercial) proves developers will pay for convenience features layered on a free core. Stashpad's $8-10/month is considered expensive for a scratchpad -- suggests the WTP ceiling for premium scratchpad features is $4-6/month.

### Customer Decision Optimizations

_Friction Reduction (specific to Notey):_
- **One-command install**: `brew install notey`, `pacman -S notey`, `apt install notey`, or download AppImage/DMG/MSI
- **Zero-config first run**: Hotkey works immediately after install. No account, no configuration, no onboarding wizard.
- **macOS permission guidance**: Detect accessibility permission state and guide user through grant before they press the hotkey and get silence
- **Demo GIF in README**: Show the complete capture loop (hotkey -> window -> type -> Esc) in a 5-second GIF. This is the single most important piece of "marketing."

_Trust Building:_
- MIT license -- eliminates lock-in concerns
- Local-first with Markdown/JSON export -- data portability guarantee
- No network requests -- "a notepad should never touch the network"
- Active GitHub presence -- responsive to issues, transparent roadmap, regular releases
- Talk to HN as fellow builders, not marketers. Use modest language, go deep into technical details.

_Conversion Optimization (stars -> users -> daily drivers):_
- Package manager availability is the #1 conversion lever. Stars without packages = passive interest.
- First-run experience must deliver the "aha moment" in under 10 seconds
- Auto-start + system tray ensures the tool is available after reboot (many tools lose users here)

_Loyalty Building:_
- Bulletproof auto-save (SQLite WAL) -- data loss is an instant uninstall
- Stable hotkey behavior across OS updates -- the tool must survive system changes
- Regular releases with visible changelog -- signals active maintenance
- Community responsiveness -- PRs reviewed, issues acknowledged within 48 hours
- Dotfiles-friendly config file (TOML/JSON) -- enables passive distribution through developer config repos

**Sources:**
- [Catchy Agency -- What 202 Open Source Developers Taught Us](https://www.catchyagency.com/post/what-202-open-source-developers-taught-us-about-tool-adoption)
- [Evil Martians -- 6 Things Developer Tools Must Have in 2026](https://evilmartians.com/chronicles/six-things-developer-tools-must-have-to-earn-trust-and-adoption)
- [Robin Landy -- Obsidian as an Example of Thoughtful Pricing Strategy](https://www.robinlandy.com/blog/obsidian-as-an-example-of-thoughtful-pricing-strategy-and-the-power-of-product-tradeoffs)
- [GitHub Blog -- What to Expect for Open Source in 2026](https://github.blog/open-source/maintainers/what-to-expect-for-open-source-in-2026/)

---

## Competitive Landscape

### Key Market Players

The developer scratchpad/capture tool space sits at the intersection of two larger markets: **note-taking software** ($1.18B in 2025, projected $7.27B by 2034 at 22.33% CAGR) and **developer tools** ($6.41B in 2025, projected $15.72B by 2031 at 16.12% CAGR). Within this intersection, there is no dominant player -- the niche is fragmented across purpose-built scratchpads, heavyweight knowledge management tools used for capture, and ad-hoc workarounds.

**Tier 1: Direct Competitors (purpose-built developer scratchpads)**

| Tool | Stars/Users | Framework | Price | Key Features | Key Gaps |
|---|---|---|---|---|---|
| **Heynote** | 5.2K GitHub stars | Electron | Free/OSS | Block-based editing, 40+ languages, inline images, Mermaid diagrams, multi-buffer (v2.0) | No floating window, no global hotkey capture, no CLI, no workspace awareness, Electron bloat (427MB), no Flatpak/AUR |
| **Stashpad** | ~1K users est. | Unknown | $10/month | Keyboard-first, Markdown, Vim mode, syntax highlighting, DM-style interface | Paid ($10/mo), no CLI, no workspace awareness, no clipboard capture, no custom keybindings despite "keyboard-first" branding |
| **Edna** | ~500 stars | Web/PWA + binary | Free/OSS | Heynote-inspired, 40+ languages, web-based with disk storage option, AI chat, scratch note (Alt+1) | Web-first (not native desktop), no global hotkey, no CLI integration, no workspace awareness |
| **Hinote** | ~50 stars | Tauri (Heynote fork) | Free/OSS | Heynote feature set ported to Tauri -- significantly smaller release image | Early/incomplete, lags behind Heynote releases, limited community |
| **Thoth** | ~200 stars est. | Terminal (Rust) | Free/OSS | Terminal scratchpad inspired by Heynote, integrates with Neovim/Helix/Vim, persistent markdown | Terminal-only, no GUI, no floating window, no search |

**Tier 2: Adjacent Competitors (heavyweight tools used for capture)**

| Tool | Users | Price | Strength | Weakness for Capture |
|---|---|---|---|---|
| **Obsidian** | 1.5M+ active | Free core, $4-8/mo Sync/Publish | 1000+ plugins, networked thinking, 60K+ community | 8.6s startup with plugins, too heavy for quick capture, users explicitly request "Obsidian Lite" |
| **Notion** | 100M+ users, $600M ARR | Free/$10-20/mo | All-in-one workspace, databases, AI | Requires internet, sluggish on mobile, 3-5s page load on large DBs, lock-in via proprietary blocks |
| **Apple Notes** | Pre-installed on Apple devices | Free | Zero friction on Apple ecosystem, added code blocks (2025) | No syntax highlighting in code blocks, macOS/iOS only, not developer-aware |
| **Google Jotter** | New (May 2025) | Free with Workspace | Integrated with Google Drive/Docs | Cloud-dependent, no developer features, new and unproven |

**Tier 3: OS/Editor-Bound Solutions**

| Tool | Strength | Weakness |
|---|---|---|
| **VS Code Scratchpads extension** | Already in developer's editor | Only works when VS Code is focused, image pasting is "junky", v2.0 migration bug lost user data |
| **Windows Notepad** (2026) | Tabs, autosave, Markdown, AI features | Windows-only, not developer-aware, AI privacy concerns |
| **LinNote** | Native KDE/Qt6, Linux-native | KDE-only, limited feature set |
| **Tot 2.0** (Iconfactory) | Elegant, 7-dot design, Apple Watch sync, Shortcuts support | macOS/iOS only, limited to 7 slots, no search, no code features, $20 one-time |

**Sources:**
- [Heynote GitHub](https://github.com/heyman/heynote)
- [Hinote GitHub](https://github.com/mtfcd/hinote)
- [Edna - Note Taking App for Developers](https://edna.arslexis.io/)
- [SourceForge -- Stashpad Reviews 2026](https://sourceforge.net/software/product/Stashpad/)
- [Fueler -- Obsidian Statistics 2026](https://fueler.io/blog/obsidian-usage-revenue-valuation-growth-statistics)
- [SaaStr -- Notion at $11 Billion](https://www.saastr.com/notion-and-growing-into-your-10b-valuation-a-masterclass-in-patience/)
- [Tot 2.0 -- The Iconfactory](https://blog.iconfactory.com/2025/08/tot-version-2-says-hello/)
- [Sugggest -- 2026 Note-Taking App Landscape](https://sugggest.com/blog/best-note-taking-apps-2026)

### Market Share Analysis

There is no formal "market share" in the developer scratchpad niche because no product has achieved category dominance. The market is characterized by:

**Fragmented workarounds dominate:** Most developers use ad-hoc solutions -- untitled editor tabs, WhatsApp self-messages, random text files, clipboard history. These "non-products" collectively hold the largest "market share" because every alternative adds friction the workarounds don't have.

**Heynote is the category leader by mindshare** (5.2K stars, 978-point HN launch) but has no revenue, no installer packaging beyond direct downloads, and is broadening its focus toward "power users" with images/diagrams -- potentially diluting its developer positioning.

**Stashpad is the only funded competitor** with paid pricing ($10/month) but limited adoption. Product Hunt reviews (4.92/5, 12 reviews) are positive but the user base appears small.

**Obsidian dominates the adjacent knowledge management space** (1.5M+ users, $2M revenue, 22% YoY growth) and is the tool developers most often *wish* they could use for quick capture -- but can't, because startup time kills the workflow.

**The note-taking market overall is consolidating** around Notion (100M+ users, $600M ARR, projected IPO 2026), Obsidian (PKM niche), and Apple Notes (ecosystem play). None of these serve the "instant developer capture" use case well.

**Sources:**
- [Global Growth Insights -- Note Taking App Market](https://www.globalgrowthinsights.com/market-reports/note-taking-app-market-100690)
- [Business Research Insights -- Note Taking App Market Size 2034](https://www.businessresearchinsights.com/market-reports/note-taking-app-market-106125)
- [Mordor Intelligence -- Software Development Tools Market](https://www.mordorintelligence.com/industry-reports/software-development-tools-market)

### Competitive Positioning

**Positioning Map: Speed vs. Feature Depth**

```
                    Feature-Rich
                         |
           Obsidian ●    |    ● Notion
                         |
                         |
    Stashpad ●           |         ● VS Code + Extensions
                         |
          Edna ●    Heynote ●
                         |
  ─────────────────── NOTEY ●──────────────────
  Instant                |               Slow Startup
                         |
      Thoth ●            |
                         |
     Tot ●               |         ● Apple Notes
                         |
              WhatsApp ● |  ● Untitled Editor Tabs
                         |
                    Minimal
```

**Notey's target position:** The only tool that combines instant capture speed (left quadrant) with meaningful developer features (upper quadrant). Heynote occupies the closest position but sits further right (Electron startup) and lacks floating window / global hotkey / CLI / workspace awareness.

**Competitive positioning strategy: "The capture buffer for developers who think faster than they can organize."**

This positions Notey as:
- **Not a knowledge management tool** (avoids Obsidian/Notion comparison)
- **Not "just another scratchpad"** (differentiated by CLI + workspace awareness + Tauri performance)
- **A complement to existing tools** (capture in Notey, organize in Obsidian/Notion later)
- **A developer tool, not a general productivity tool** (avoids Tot/Apple Notes comparison)

### Strengths and Weaknesses (SWOT for Notey)

**Strengths:**
- **Unique feature combination** -- no competitor offers global hotkey + floating window + CLI + workspace awareness + clipboard capture in one tool
- **Tauri/Rust foundation** -- 50% less memory (30-40MB vs 200-300MB), 10x smaller bundle (<10MB vs 100+MB), 40% faster startup vs Electron. Aligns with intensifying Electron backlash
- **Local-first positioning** -- aligns with mainstream local-first movement (FOSDEM 2026 devroom, 500-architect manifesto)
- **Open source (MIT)** -- eliminates trust and lock-in barriers. Matches HN crowd preferences
- **Linux as first-class citizen** -- targets an underserved, vocal, and influential segment
- **CLI virality potential** -- `notey` commands in blog posts, tutorials, dotfiles = same growth path as fzf/ripgrep/jq
- **Clean-sheet architecture** -- no legacy Scratch Pad code, designed with plugin extensibility from day one

**Weaknesses:**
- **No brand recognition** -- new entrant against established tools. Zero stars, zero users at launch
- **Wayland global hotkey gap** -- Tauri's `global-hotkey` crate lacks Wayland support (issue #28). Custom portal integration required. GNOME has no GlobalShortcuts portal implementation
- **Single maintainer risk** -- open-source project sustainability depends on community growth
- **"Notey" name collision** -- existing apps/packages use this name, creating discoverability and trademark concerns
- **WebView fragmentation** -- Tauri uses system WebView, meaning CSS/JS must be conservative across OS versions
- **No mobile story** -- explicitly out of scope for v1, but Heynote (#467) and Stashpad users are requesting mobile

**Opportunities:**
- **Heynote broadening creates a gap** -- Heynote's shift from "developers" to "power users" with images/diagrams/drawings opens space for a focused developer-first tool
- **Obsidian "Lite" demand is explicit** -- forum threads and community workarounds prove demand for a lightweight capture tool that complements Obsidian
- **Tauri showcase value** -- being featured in the Tauri ecosystem (awesome-tauri, madewithtauri.com) drives sustained traffic from developers evaluating the framework
- **Hinote validates the approach** -- a Tauri fork of Heynote already exists, proving developer demand for non-Electron scratchpads
- **Package manager distribution** -- AUR, Homebrew, DEB packages convert passive interest into actual users. Heynote's top issues include Flatpak (#20) and Arch (#14) requests
- **Dotfiles-friendly config** -- TOML/JSON config file enables passive distribution through developer config repos

**Threats:**
- **Heynote could add the missing features** -- floating window, global hotkey, CLI integration. If Heynote adds these, the differentiation narrows to Tauri vs Electron
- **VS Code could improve built-in capture** -- a first-party global capture extension from Microsoft would leverage VS Code's 73-74% market share
- **Apple/Microsoft continuing to improve OS notes** -- Windows Notepad added tabs, Markdown, AI. Apple Notes added code blocks. If they add global hotkey capture, the "good enough" problem intensifies
- **Tauri ecosystem immaturity** -- smaller plugin ecosystem than Electron, WebView fragmentation, steeper Rust learning curve for contributors
- **Google Jotter** -- new entrant (May 2025) with Google's distribution muscle. Not developer-focused yet, but could pivot
- **AI capture tools** -- voice-to-notes, ambient capture, AI-powered organization could leapfrog keyboard-based capture entirely

**Sources:**
- [Tauri vs Electron -- DasRoot (March 2026)](https://dasroot.net/posts/2026/03/tauri-vs-electron-rust-cross-platform-apps/)
- [Tauri global-hotkey Wayland Issue #28](https://github.com/tauri-apps/global-hotkey/issues/28)
- [Made with Tauri](https://madewithtauri.com/)
- [awesome-tauri GitHub](https://github.com/tauri-apps/awesome-tauri)
- [Heynote Issues](https://github.com/heyman/heynote/issues)

### Market Differentiation

**Notey's differentiation rests on five pillars that no competitor combines:**

**1. The Capture Loop (Hotkey -> Float -> Type -> Dismiss)**
No competitor nails this end-to-end. Heynote opens as a full window. Stashpad opens as a full window. Obsidian takes 8.6 seconds. Tot is limited to 7 slots. The floating window that appears instantly via global hotkey and disappears with Esc -- without disturbing the underlying window -- is the core differentiator.

**2. Terminal CLI as First-Class Citizen**
`notey add "fix the auth bug tomorrow"` and `docker logs | notey add --stdin --tag k8s-debug` make Notey a Unix citizen, not just a GUI app. Zero competitors offer this. Thoth is terminal-only (no GUI counterpart). Heynote, Stashpad, Edna, Tot -- none have CLI integration. This is the single most differentiating feature for terminal-heavy developers.

**3. Workspace-Aware Notes**
Auto-detects the active git repo or working directory and scopes notes to that project. Zero competitors do this. Every existing tool requires manual organization. This is a completely unaddressed gap.

**4. Tauri Native Performance**
30-40MB idle memory vs Heynote's 200-300MB Electron footprint. <10MB bundle vs Heynote's 427MB. <500ms startup. Addresses the #1 community complaint about Heynote (Electron bloat). The Hinote fork proves this demand.

**5. Clipboard Capture with Project Context**
Clipboard managers (CopyQ, Ditto) capture everything but have no project awareness. Notey watches the clipboard and auto-captures snippets into the current project's note space with optional annotation. No competitor combines clipboard capture with workspace scoping.

### Competitive Threats

**Threat 1: Heynote Feature Expansion (Medium-High)**
Heynote is actively maintained (7+ releases in Jan-Feb 2026). If Heynote adds floating window mode, global hotkey, and CLI integration, the differentiation narrows to Tauri vs Electron. Mitigation: Notey must ship and establish community before Heynote fills these gaps. Heynote's broadening toward "power users" suggests the maintainer's priorities are moving away from the developer-focused capture use case.

**Threat 2: Obsidian Quick Capture Improvement (Medium)**
Obsidian's CEO acknowledged "performance is design, and every millisecond counts." Mobile startup is now under 500ms. If Obsidian ships a dedicated lightweight capture companion app (which community explicitly requests), it could capture the "capture -> organize in Obsidian" workflow. Mitigation: Notey's CLI integration and workspace awareness are differentiated even against an Obsidian capture widget.

**Threat 3: VS Code Native Capture (Low-Medium)**
VS Code (73-74% market share) could add a built-in global capture feature. However, VS Code's architecture is Electron-based and tied to editor focus -- a system-level floating window would be architecturally challenging. More likely: a third-party VS Code extension. Mitigation: Notey works independently of any editor.

**Threat 4: AI Ambient Capture (Low, Long-term)**
Voice-to-notes, ambient listening, and AI-powered auto-organization could eventually make keyboard-based capture feel manual. However: only 3.1% of developers "highly trust" AI tools, privacy concerns are acute for developer workflows, and ambient capture requires always-on listening that most developers will reject. This is a 3-5 year threat, not a v1 concern.

**Sources:**
- [Heynote Releases](https://github.com/heyman/heynote/releases/)
- [Obsidian Forum -- Obsidian Lite Thread](https://forum.obsidian.md/t/obsidian-lite-or-how-do-you-do-quick-notes/106358)
- [Stack Overflow Blog -- AI Trust (Dec 2025)](https://stackoverflow.blog/2025/12/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here/)

### Opportunities

**Opportunity 1: "The fzf of Note Capture" Positioning**
fzf (65K stars), ripgrep (48K stars), and jq (30K stars) all followed the same growth trajectory: GitHub launch -> HN/Reddit virality -> package manager inclusion -> blog posts/tutorials -> dotfiles default -> critical mass. Notey's CLI (`notey add`, `notey search`) enables this exact path. The CLI is the viral vector; the GUI is the daily driver. Time to mainstream for successful CLI tools: 2-4 years.

**Opportunity 2: Tauri Ecosystem Showcase**
Being featured on awesome-tauri (GitHub) and madewithtauri.com drives sustained traffic from developers evaluating Tauri. Notey could be positioned as "a showcase Tauri app" -- demonstrating native performance, small bundle size, and cross-platform support. This is free, high-quality traffic from an engaged developer audience.

**Opportunity 3: Obsidian Complement Story**
Position Notey as the capture layer for Obsidian users: "Capture in Notey, organize in Obsidian." This taps Obsidian's 1.5M+ user base and 60K+ community without competing head-to-head. The Markdown export feature makes this workflow seamless. Community explicitly wants this (forum threads requesting "Obsidian Lite" and dedicated quick capture apps).

**Opportunity 4: Linux-First Wedge**
LinNote (KDE/Qt6) proves Linux developers want native scratchpads. Most tools are Mac-first. Notey's Linux-first approach targets an underserved, passionate, and vocal segment (55-57% of developers use some Linux distro). Linux users are disproportionately influential as OSS maintainers, blog authors, and conference speakers. Success on Linux creates credibility that extends to macOS and Windows.

**Opportunity 5: Package Manager as Distribution Channel**
Heynote's top issues include Flatpak (#20, 13+ upvotes) and Arch package (#14) requests. Being available in AUR, Homebrew, DEB, Flatpak from day one converts passive interest into actual users. 34.7% of developers abandon tools if setup is difficult -- package manager availability eliminates this barrier entirely.

**Opportunity 6: "WhatsApp Group With Just Me" Marketing Narrative**
The product brief identified this real pattern. It's inherently shareable and meme-worthy for HN/Reddit launches. The narrative: "Stop messaging yourself. There's a better way." This taps into genuine developer embarrassment about their capture workarounds and creates an emotional hook that pure feature lists can't match.

**Sources:**
- [awesome-tauri GitHub](https://github.com/tauri-apps/awesome-tauri)
- [Made with Tauri](https://madewithtauri.com/)
- [Obsidian Forum -- Quick Capture Threads](https://forum.obsidian.md/t/obsidian-lite-or-how-do-you-do-quick-notes/106358)
- [Catchy Agency -- Developer Tool Adoption](https://www.catchyagency.com/post/what-202-open-source-developers-taught-us-about-tool-adoption)
- [Show HN: Heynote](https://news.ycombinator.com/item?id=38733968)

---

## Strategic Recommendations

### Market Opportunity Assessment

The developer scratchpad/capture tool niche represents a clear, validated, and underserved opportunity:

**Market Validation:**
- Heynote's 978-point HN launch and 5.2K stars prove demand for purpose-built developer scratchpads
- Obsidian forum threads explicitly requesting "Obsidian Lite" quick capture tools prove the gap between knowledge management and instant capture
- The "WhatsApp group with just me" pattern indicates developers are using absurd workarounds because nothing better exists
- Hinote (Tauri fork of Heynote) validates developer demand for non-Electron alternatives specifically

**Addressable Market:**
- ~28-30M professional developers globally (Evans Data, Statista)
- 55-57% use some Linux distribution (Stack Overflow 2025) -- Notey's primary wedge
- Tool fatigue is acute: 14 tools average, 75% lose 6-15 hours/week to sprawl
- The intersection of "developers who capture notes" and "developers frustrated with current options" is essentially the entire developer population

**Market Timing: Optimal**
- Tauri 2.0 shipped stable (Oct 2024), proving framework maturity
- Electron backlash intensifying (Discord 4GB, macOS lag bugs, RAM price increases)
- Local-first movement reached mainstream (FOSDEM 2026 devroom, 500-architect manifesto)
- AI fatigue creates appetite for simple, focused tools that "just work" (only 3.1% highly trust AI tools)
- No competitor has filled the specific gap (global hotkey + CLI + workspace awareness + native performance)

**Sources:**
- [Show HN: Heynote](https://news.ycombinator.com/item?id=38733968)
- [Obsidian Forum -- Obsidian Lite](https://forum.obsidian.md/t/obsidian-lite-or-how-do-you-do-quick-notes/106358)
- [Hinote GitHub](https://github.com/mtfcd/hinote)
- [Stack Overflow 2025 Developer Survey](https://survey.stackoverflow.co/2025/)

### Strategic Recommendations

**Recommendation 1: Ship v1 Fast and Focused**

Resist feature creep. The core capture loop (hotkey -> float -> type -> Esc) is the product. Everything else is secondary. Heynote's trajectory shows what happens when a scratchpad expands toward images, diagrams, and drawing tools -- it drifts from the original value proposition. Notey's strength is doing one thing exceptionally well.

_Priority order for v1:_ Global hotkey + floating window > auto-save > search > CLI > workspace awareness > multi-tab > clipboard capture. Ship the first three as quickly as possible; they're the minimum for the "aha moment."

**Recommendation 2: Linux-First, Not Linux-Only**

Build and test on Linux first. This is a strategic choice, not a technical one:
- Linux developers are underserved (most tools are macOS-first)
- Linux developers are disproportionately influential (OSS maintainers, blog authors, HN/Reddit posters)
- Success on Linux creates credibility that extends to macOS and Windows
- AUR, DEB, and Flatpak availability from day one converts interest into adoption (34.7% abandon if setup is difficult)

Cross-platform support remains critical -- ship macOS (DMG, Homebrew) and Windows (MSI) alongside Linux. But Linux gets the first testing, the first packages, and the first community attention.

**Recommendation 3: The CLI is the Viral Vector**

The `notey` CLI binary is the single most strategic feature. It enables:
- Viral distribution via blog posts, tutorials, shell aliases, Stack Overflow answers (same path as fzf/ripgrep/jq)
- Passive discovery through dotfiles repos
- Composability with existing Unix tooling (`docker logs | notey add --stdin`)
- Differentiation from every competitor (none offer CLI integration)

The CLI should ship in v1 with at minimum: `notey add "text"`, `notey add --stdin`, `notey search "query"`, and `notey list`. These four commands enable the viral loop.

**Recommendation 4: Position as Obsidian Complement, Not Competitor**

"Capture in Notey, organize in Obsidian." This positioning:
- Taps Obsidian's 1.5M+ user base without competing head-to-head
- Addresses a pain point Obsidian users explicitly articulate
- Creates a natural workflow: hotkey capture -> Markdown export -> Obsidian vault
- Avoids the "why not just use Obsidian?" objection entirely

**Recommendation 5: Solve Wayland Before Launch (Where Possible)**

Global hotkeys on Wayland are broken for every competitor (Electron, Tauri, Warp, Albert). Implementing `org.freedesktop.portal.GlobalShortcuts` for KDE, Sway, and Hyprland -- even with a documented GNOME limitation -- would be a significant differentiator. This is hard engineering, but it's the kind of platform investment that builds credibility with the Linux community.

**Sources:**
- [Evil Martians -- 6 Things Developer Tools Must Have in 2026](https://evilmartians.com/chronicles/six-things-developer-tools-must-have-to-earn-trust-and-adoption)
- [Catchy Agency -- Developer Tool Adoption](https://www.catchyagency.com/post/what-202-open-source-developers-taught-us-about-tool-adoption)
- [PMM Hive -- Go-to-Market Strategy for Open Source Products](https://www.productmarketinghive.com/go-to-market-strategy-for-open-source-products/)

### Go-to-Market Strategy

**Phase 1: Seed (Months 1-2 post-v1)**

| Action | Channel | Expected Impact |
|---|---|---|
| Show HN post | Hacker News | 10K-50K visits, 500-2K stars, initial community |
| Reddit posts | r/programming, r/commandline, r/linux, r/rust | Broader reach, Linux community awareness |
| Package manager releases | AUR, Homebrew, DEB, Flatpak, AppImage | Converts interest to installs |
| awesome-tauri / madewithtauri listing | Tauri ecosystem | Sustained traffic from Tauri evaluators |
| Demo GIF in README | GitHub | 30-second conversion tool |

_Launch narrative:_ "Stop messaging yourself. The developer capture tool that lives one hotkey away." Lead with the "WhatsApp group with just me" pain point -- it's relatable, shareable, and meme-worthy.

_HN launch best practices:_ Talk as fellow builders, not marketers. Link to GitHub repo. Avoid superlatives. Go deep into technical details (Tauri, Rust, SQLite FTS5). Answer every comment. Tuesday-Thursday timing. ([Markepear -- How to Launch a Dev Tool on HN](https://www.markepear.dev/blog/dev-tool-hacker-news-launch))

**Phase 2: Grow (Months 3-6)**

| Action | Channel | Expected Impact |
|---|---|---|
| CLI appearing in blog posts / tutorials | Developer blogs | Passive discovery, long-tail growth |
| Dotfiles-friendly config (TOML) | GitHub dotfiles repos | Passive distribution |
| YouTube tool reviews | Fireship, ThePrimeagen, etc. | Visual demos drive awareness |
| Developer newsletter features | Console.dev, TLDR, Changelog | Curated, high-trust recommendations |
| Obsidian community cross-posting | Obsidian forums, Discord | Tap 1.5M+ user base |

**Phase 3: Establish (Months 6-12)**

| Action | Channel | Expected Impact |
|---|---|---|
| Conference lightning talks | FOSDEM, RustConf, Linux conferences | Community credibility |
| Plugin-ready architecture documentation | GitHub docs | Attract contributor interest |
| Tauri showcase positioning | Tauri blog, conferences | Framework ecosystem visibility |
| Contributor community building | GitHub, Discord | Sustainability and feature velocity |

### Risk Assessment and Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| **Heynote adds floating window + CLI** | Medium | High | Ship first. Establish community before Heynote fills gaps. Heynote's broadening toward "power users" suggests different trajectory. |
| **Wayland global hotkey remains unsolvable** | Low-Medium | High | Implement xdg-desktop-portal for KDE/Sway/Hyprland. Accept XWayland fallback for GNOME. Document clearly. |
| **Single maintainer burnout** | Medium | High | Prioritize contributor-friendly codebase (clear architecture, good docs, labeled "good first issue" tickets). Build community early. |
| **"Notey" name collision / trademark** | High | Medium | Resolve before public launch. Choose a unique, searchable name. Consider: the name should work as a CLI command -- short, memorable, no conflicts with existing Unix commands. |
| **Tauri WebView fragmentation bugs** | Medium | Medium | Conservative CSS/JS. CI testing on minimum supported OS versions. Follow Tauri's recommended practices. |
| **macOS accessibility permission friction** | Certain | Low-Medium | First-run detection and guided permission flow. Test extensively on macOS. Clear documentation. |
| **Data loss bug destroys trust** | Low | Critical | SQLite WAL mode, comprehensive test coverage for auto-save, backup strategies. Data loss is an instant-uninstall event -- this must be bulletproof. |
| **AI capture tools leapfrog keyboard-based capture** | Low (3-5yr) | Medium | Not a v1 concern. Developer AI trust is at 3.1%. Monitor but don't react prematurely. |

### Implementation Roadmap and Success Metrics

**Success Metrics (v1, first 6 months):**

| Metric | Target | Rationale |
|---|---|---|
| GitHub stars | 1,000+ | Validates awareness (Heynote: 5.2K over ~2 years) |
| Package manager installs | 500+ across all platforms | Measures actual adoption, not passive interest |
| Daily active usage | 100+ (inferred from issue quality) | Production edge cases signal real daily drivers |
| Issue tracker activity | 50+ issues filed | Community engagement and real-world feedback |
| CLI mentions in wild | 10+ (blog posts, SO answers, dotfiles) | Validates viral distribution hypothesis |
| Zero data loss incidents | 0 | Non-negotiable for trust |
| Hotkey-to-window < 150ms | Pass on all platforms | Core promise must be met |

**Stretch goals (12 months):**

| Metric | Target |
|---|---|
| GitHub stars | 3,000+ |
| Contributors | 10+ unique contributors |
| Obsidian community awareness | Mentioned in Obsidian forums/Discord as recommended capture tool |
| Package manager availability | AUR, Homebrew, DEB, Flatpak, Chocolatey, Scoop |

### Future Market Outlook

_Near-term (1-2 years):_
- Developer tool market continues 16% CAGR growth ($7.44B -> ~$10B)
- Tauri adoption continues 35% YoY growth, narrowing Electron's lead
- Local-first becomes default expectation for developer tools
- AI tool fatigue creates counter-trend favoring simple, focused tools
- Wayland adoption increases, making portal-based shortcuts more critical

_Medium-term (3-5 years):_
- Note-taking market reaches $3-5B (22% CAGR from $1.18B base)
- AI ambient capture may emerge as alternative to keyboard-based capture
- Plugin ecosystem becomes viable if Notey reaches critical mass
- Cloud sync pressure increases as users want cross-device access
- Potential for freemium monetization if community supports it (Obsidian model: $2M revenue, 18 people, bootstrapped)

_Long-term (5+ years):_
- Developer capture may converge with AI-assisted coding tools
- Desktop apps remain critical for developer workflows despite mobile/cloud growth
- Open-source sustainability models mature (EU open source strategy, corporate sponsorship frameworks)
- The "capture layer" may become a platform (plugins for tmux, neovim, IDE integration)

**Sources:**
- [Mordor Intelligence -- Software Development Tools Market](https://www.mordorintelligence.com/industry-reports/software-development-tools-market)
- [Business Research Insights -- Note Taking App Market Size 2034](https://www.businessresearchinsights.com/market-reports/note-taking-app-market-106125)
- [Deloitte -- 2026 Software Industry Outlook](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-telecom-outlooks/software-industry-outlook.html)
- [Landbase -- 12 Fastest Growing Open Source Dev Tools](https://www.landbase.com/blog/fastest-growing-open-source-dev-tools)

---

## Research Methodology and Source Verification

### Primary Sources Used

All market data verified through live web searches conducted April 2, 2026:

**Industry Surveys:**
- [Stack Overflow Developer Survey 2025](https://survey.stackoverflow.co/2025/) (49,000+ respondents, 177 countries)
- [JetBrains State of Developer Ecosystem 2025](https://devecosystem-2025.jetbrains.com/) (24,534 developers, 194 countries)
- [CloudBees 2025 DevOps Migration Index](https://www.cloudbees.com/blog/2025-devops-migration-index-rip-and-replace-failing-enterprises)

**Market Reports:**
- [Mordor Intelligence -- Software Development Tools Market](https://www.mordorintelligence.com/industry-reports/software-development-tools-market)
- [Global Growth Insights -- Note Taking App Market](https://www.globalgrowthinsights.com/market-reports/note-taking-app-market-100690)
- [Business Research Insights -- Note Taking App Market Size 2034](https://www.businessresearchinsights.com/market-reports/note-taking-app-market-106125)
- [Virtue Market Research -- AI Developer Tools Market](https://virtuemarketresearch.com/report/ai-developer-tools-market)

**Community Sources:**
- [Hacker News Show HN threads and discussions](https://news.ycombinator.com/item?id=38733968) (2023-2026)
- [Obsidian Community Forums](https://forum.obsidian.md/t/obsidian-lite-or-how-do-you-do-quick-notes/106358) (2025-2026)
- [Heynote GitHub Issues](https://github.com/heyman/heynote/issues)
- [Tauri global-hotkey Wayland Issue](https://github.com/tauri-apps/global-hotkey/issues/28)
- [Product Hunt -- Stashpad Reviews](https://www.producthunt.com/products/stashpad-2/reviews)

**Company Data:**
- [Notion: $600M ARR, $11B valuation](https://www.saastr.com/notion-and-growing-into-your-10b-valuation-a-masterclass-in-patience/)
- [Obsidian: $2M revenue, 18 employees, 1.5M+ users](https://fueler.io/blog/obsidian-usage-revenue-valuation-growth-statistics)
- [GitHub Copilot: $1B+ ARR, 4.7M paid subscribers](https://www.getpanto.ai/blog/github-copilot-statistics)

### Research Quality Assessment

_Confidence Level: High_ for market sizing, competitive landscape, and customer behavior data -- multiple independent sources corroborate key claims.

_Confidence Level: Medium_ for forward-looking projections (CAGR, market size 2030+) -- inherent uncertainty in forecasts, though multiple sources agree on growth direction.

_Confidence Level: Medium_ for Wayland ecosystem status -- rapidly evolving, data may be stale within months.

_Research Limitations:_
- No direct user surveys conducted (relied on published surveys and community discussions)
- Developer scratchpad niche has no formal market research reports -- sizing is inferred from adjacent markets
- GitHub stars and forum activity are proxies for demand, not precise measurements
- Competitor revenue data is limited (most are open-source/free)

---

## Market Research Conclusion

### Summary of Key Findings

1. **The market is validated but unfilled.** Heynote's 978-point HN launch, Obsidian users requesting "Obsidian Lite," and the "WhatsApp group with just me" pattern all prove demand for instant developer capture. No tool combines global hotkey + CLI + workspace awareness + native performance.

2. **The timing is optimal.** Tauri 2.0 is stable. Electron backlash is intensifying. Local-first is mainstream. AI fatigue creates appetite for focused tools. The developer tools market is growing at 16% CAGR.

3. **The competitive moat is the combination.** Individual features exist in various tools. No competitor combines all five pillars: floating hotkey capture, terminal CLI, workspace-aware notes, Tauri native performance, and clipboard capture with project context.

4. **Linux-first is a strategic wedge.** 55-57% of developers use some Linux distro. Most tools are macOS-first. Linux developers are underserved, vocal, and disproportionately influential. Success here creates credibility that extends to all platforms.

5. **The CLI is the viral engine.** `notey` commands in blog posts, tutorials, and dotfiles repos follow the proven growth path of fzf, ripgrep, and jq. This is organic distribution through developer workflows.

6. **Obsidian complement positioning avoids competition.** "Capture in Notey, organize in Obsidian" taps 1.5M+ users without fighting Obsidian's strengths.

### Next Steps

1. **Resolve the product name** before any public-facing work. "Notey" has collision risk.
2. **Proceed to PRD creation** using this research as the market foundation.
3. **Prototype the capture loop** (hotkey -> float -> type -> Esc) -- the core value proposition.
4. **Investigate Wayland portal integration** early in architecture.
5. **Set up package manager build pipelines** as part of CI/CD from the start.

---

**Market Research Completion Date:** 2026-04-02
**Research Period:** Comprehensive market analysis with live web data (April 2026)
**Source Verification:** All market facts cited with current sources
**Market Confidence Level:** High -- based on multiple authoritative sources across industry surveys, market reports, community data, and competitor analysis

_This comprehensive market research document serves as the authoritative market reference for Notey's developer-focused instant capture notepad and provides strategic insights for informed product development and go-to-market decisions._
