# Bar Print Agent (LAN Printer)

Script `scripts/bar-print-agent.cjs` is a small background service that:

- Listens to Firestore collection `bar_print_jobs` with status `pending`
- Prints each ticket directly to a LAN printer via TCP (`IP:9100`)
- Marks the job as `printed` after successful printing

This allows the pha che counter to have only a LAN printer (no browser tab on that counter).

## Requirements

- A machine that can run Node.js continuously (cashier PC, mini PC, server)
- LAN printer reachable by IP
- Firebase service account JSON file (default path: `firebase-service-account.json`)

## Environment variables

- You can copy from `scripts/bar-print-agent.env.example`.
- `PRINT_AGENT_PRINTER_HOST` (required): printer IP, e.g. `192.168.1.120`
- `PRINT_AGENT_PRINTER_PORT` (optional, default `9100`)
- `PRINT_AGENT_STORE_ID` (optional, default `cafe`)
- `PRINT_AGENT_TERMINAL_NAME` (optional, default machine hostname)
- `PRINT_AGENT_STORE_LABEL` (optional, default `ONG QUAN`)
- `PRINT_AGENT_TIME_ZONE` (optional, default `Asia/Ho_Chi_Minh`)
- `PRINT_AGENT_SOCKET_TIMEOUT_MS` (optional, default `12000`)
- `PRINT_AGENT_RETRY_INTERVAL_MS` (optional, default `15000`)
- `PRINT_AGENT_DRY_RUN=1` (optional, no real print, and does not mark printed)
- `PRINT_AGENT_TEST_ON_START=1` (optional, print a test ticket on startup)
- `FIREBASE_SERVICE_ACCOUNT_PATH` (optional, default `firebase-service-account.json`)

## Commands

- Run continuously:

```bash
npm run print:bar-agent
```

- Test print once and exit:

```bash
npm run print:bar-agent:test
```

## PowerShell example

```powershell
$env:PRINT_AGENT_PRINTER_HOST="192.168.1.120"
$env:PRINT_AGENT_STORE_ID="cafe"
$env:PRINT_AGENT_TERMINAL_NAME="May_Pha_Che_1"
npm run print:bar-agent
```

## Notes

- The POS still creates print jobs at payment time (`bar_print_jobs`).
- This agent can run on cashier machine and print to pha che LAN printer directly.
- Keep this process running with PM2/Task Scheduler/NSSM for production use.
