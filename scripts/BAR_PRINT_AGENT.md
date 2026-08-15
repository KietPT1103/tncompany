# Bar Print Agent (LAN Printer)

Script `scripts/bar-print-agent.cjs` is a small background service that:

- Polls pending print jobs from the MySQL-backed POS API
- Prints each ticket directly to a LAN printer via TCP (`IP:9100`)
- Renders tickets as monochrome bitmaps on Windows so Vietnamese diacritics print correctly
- Marks the MySQL job as `printed` through the API after successful printing

This allows the pha che counter to have only a LAN printer (no browser tab on that counter).

The POS browser only creates `bar_print_jobs`. It does not call the browser print dialog
for preparation tickets, so printing stays silent as long as this agent is running.

## Requirements

- A machine that can run Node.js continuously (cashier PC, mini PC, server)
- LAN printer reachable by IP
- A POS account with `bills.access` permission

## Environment variables

- You can copy from `scripts/bar-print-agent.env.example`.
- `PRINT_AGENT_PRINTER_HOST` (required): printer IP, e.g. `192.168.1.120`
- `PRINT_AGENT_PRINTER_PORT` (optional, default `9100`)
- `PRINT_AGENT_STORE_ID` (optional, default `cafe`)
- `PRINT_AGENT_TERMINAL_NAME` (optional, default machine hostname)
- `PRINT_AGENT_TIME_ZONE` (optional, default `Asia/Ho_Chi_Minh`)
- `PRINT_AGENT_SOCKET_TIMEOUT_MS` (optional, default `12000`)
- `PRINT_AGENT_RETRY_INTERVAL_MS` (optional, default `15000`)
- `PRINT_AGENT_DRY_RUN=1` (optional, no real print, and does not mark printed)
- `PRINT_AGENT_TEST_ON_START=1` (optional, print a test ticket on startup)
- `PRINT_AGENT_API_BASE_URL` (optional, default `http://127.0.0.1:8000/api`)
- `PRINT_AGENT_API_LOGIN` and `PRINT_AGENT_API_PASSWORD` (required unless using a token)
- `PRINT_AGENT_API_TOKEN` (optional alternative to login/password)

## Commands

- Run continuously:

```bash
npm run print:bar-agent
```

- Test print once and exit:

```bash
npm run print:bar-agent:test
```

- Validate API login and bar-job permission without printing:

```bash
node scripts/bar-print-agent.cjs --check
```

## Windows package (no Node.js/npm required on the bar machine)

Build the portable Windows x64 installer package on a development machine:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-bar-print-agent-windows.ps1
```

This creates `artifacts/tn-company-bar-print-agent-windows-x64.zip`, including
its own Node.js runtime. Extract it on the bar Windows machine and double-click
`CAI-DAT.cmd`. The installer prompts for printer/API settings and registers a
hidden startup task named `TNCompany-BarPrintAgent` that runs as `SYSTEM`,
restarts after failures, and does not require a user to sign in.

The installed configuration and logs are under
`C:\ProgramData\TNCompany\BarPrintAgent`. Double-click `GO-CAI-DAT.cmd` from
the extracted package to remove the scheduled task and installed files.

## PowerShell example

```powershell
$env:PRINT_AGENT_PRINTER_HOST="192.168.1.120"
$env:PRINT_AGENT_STORE_ID="cafe"
$env:PRINT_AGENT_TERMINAL_NAME="May_Pha_Che_1"
$env:PRINT_AGENT_API_LOGIN="thungan1"
$env:PRINT_AGENT_API_PASSWORD="your-password"
npm run print:bar-agent
```

## Notes

- The POS still creates print jobs at payment time (`bar_print_jobs`).
- Do not enable a browser auto-print workflow for preparation tickets. Browser `print()`
  is interactive by design and opens a print dialog; this agent is the silent-print path.
- This agent can run on cashier machine and print to pha che LAN printer directly.
- Keep this process running with PM2/Task Scheduler/NSSM for production use.
