# AI Gateway - Stack 6 of 10 - Data Intelligence

Intelligence Data Recovery, JSON Structuring, Sanitization and Data-Chopping.

Reuses Stack 3 (execution), Stack 4 (context/session) and Stack 5
(orchestration) as-is. Owns a dedicated Postgres + Redis, matching the same
per-stack convention already used by Day 3/4/5 in this repo — it does not
touch their databases.

## Manage

```bash
bash day6-manage.sh init    # scaffold (already done if you're reading this from a real checkout)
bash day6-manage.sh up      # build + start postgres, redis, api, worker, prometheus, grafana
bash day6-manage.sh logs    # follow logs
bash day6-manage.sh test    # run test/day6-testing.sh against the running API
bash day6-manage.sh down    # stop and remove containers
```

Before `up`, copy `.env.example` to `.env` and point `STACK3_URL` / `STACK5_URL`
at your real Stack 3 / Stack 5 endpoints (defaults match what your Day 4/5
test logs discovered: `http://192.168.0.140:4405` and `:4407`).

If your existing stacks share a Docker network, set `SHARED_NETWORK_NAME` in
`.env` to that network's name so Stack 6 can reach them by container name
instead of host IP. If they don't share a network, host-IP access (the
defaults) works fine too.

## Ports

| Service     | Host port |
|-------------|-----------|
| API         | 4408      |
| Prometheus  | 9408      |
| Grafana     | 3408      |

## Recovery ladder

`POST /v1/structure` runs the full 12-step ladder (inspect → sanitize →
skeleton mapping → chunk if oversized → validate → escalate to existing AI
only if deterministic recovery fails → re-validate AI output → record →
return). See `src/lib/recoveryLadder.js`.

Schemas live in Postgres (`json_schemas`), so new intelligence is added via
`INSERT`, not code changes — see `POST /v1/schemas`.
# PROMPT-06-DATA-INTELLIGENCE
