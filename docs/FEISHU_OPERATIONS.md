# Feishu Operations

## Short-term operating path

This project should use Feishu as the operating backend for now.

- Feishu Bitable is the source of truth for `Source`, `ModelRouteConfig`, `WorkflowConfig`, and draft review records.
- The public site stays focused on publishing and reading.
- The built-in `/admin` route remains disabled unless we explicitly decide to revive a web admin later.

## What Feishu owns

- Source intake:
  Add and edit source rows in the Feishu source table, then run `sync-feishu-sources`.
- Model routing:
  Maintain route keys, provider, model, and API key env names in the Feishu model-route table, then run `sync-feishu-control-plane`.
- Workflow prompts:
  Maintain prompts, thresholds, and route-key bindings in the Feishu workflow table, then run `sync-feishu-control-plane`.
- Draft decisions:
  Review pending drafts in the Feishu draft table or review chat, then run `sync-feishu-draft-decisions`.
  After you configure `FEISHU_DRAFT_TABLE_ID`, the same task will also backfill any existing local candidates that were created before draft syncing was enabled.

## Table shapes

- `source`
  Fields: `name`, `url`, `type`, `description`, `enabled`, `tags`, `trustScore`, `priority`, `fetchIntervalMinutes`
- `model_route`
  Fields: `routeKey`, `enabled`, `provider`, `baseUrl`, `model`, `apiKeyEnvName`, `temperature`, `maxTokens`, `timeoutMs`, `notes`
- `workflow`
  Fields: `name`, `version`, `enabled`, `classificationPrompt`, `structuringPrompt`, `detailMarkdownPrompt`, `digestThreePrompt`, `digestEightPrompt`, `classificationRouteKey`, `structuringRouteKey`, `detailMarkdownRouteKey`, `digestThreeRouteKey`, `digestEightRouteKey`, `riskKeywords`, `autoPublishMinTrust`, `autoPublishMinQuality`, `notes`
- `draft`
  Fields: `candidateId`, `status`, `title`, `slug`, `sourceName`, `sourceUrl`, `tags`, `riskLevel`, `qualityScore`, `workflowVersion`, `summary`, `worthReading`, `structuredJson`, `markdownDraft`, `coverImageUrl`, `editorNotes`, `previewUrl`, `publicUrl`, `publishedAt`

## Adding a new source

1. Add a row in the `source` table.
2. Fill `name`, `url`, `type`, `enabled`, `tags`, `trustScore`, `priority`, and `fetchIntervalMinutes`.
3. Keep `type=RSS` whenever an official RSS feed exists. Only use `WEB` for landing pages or news archives.
4. Run `npm run worker:sync-feishu-sources`.
5. Run `npm run worker:run-ingest-cycle`.
6. Inspect the newest `candidateItem` rows. If the titles are noisy, lower the source priority or replace the URL with a cleaner archive/feed.

## Worker flow

Recommended order for a normal operating cycle:

1. `npm run worker:sync-feishu-sources`
2. `npm run worker:sync-feishu-control-plane`
3. `npm run worker:run-ingest-cycle`
4. `npm run worker:sync-feishu-draft-decisions`
5. `npm run worker:generate-digest`
6. `npm run worker:dispatch-email`

## Suggested cadence

- `sync-feishu-sources`: every 30-60 minutes
- `sync-feishu-control-plane`: every 30-60 minutes, and always after prompt/model changes
- `run-ingest-cycle`: every 15-30 minutes
- `sync-feishu-draft-decisions`: every 5-10 minutes
- `generate-digest`: once or twice per day, depending on your publishing rhythm
- `dispatch-email`: every 5-10 minutes

## Runtime checks

Use the built-in doctor before debugging individual services:

```bash
npm run doctor:runtime
```

The doctor checks:

- required env presence
- Prisma database reachability
- model API key presence
- Feishu auth
- Feishu Bitable access

## Notes

- If `DATABASE_URL` points to `127.0.0.1` or `localhost`, the local Postgres instance must be running before any worker task can succeed.
- Real email sending is not implemented yet; `dispatch-email` currently advances queue state in the database.
- If we later reopen a web admin, it should be treated as a convenience layer, not the source of truth.
