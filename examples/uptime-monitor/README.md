# Motia Uptime Monitor Example

This example demonstrates how to build a simple uptime monitor using the Motia backend framework.  

It periodically checks a list of websites and sends alerts to a Discord channel via webhook when any site is down.

---

## Features

- Checks multiple websites every minute (configurable)
- Sends a Discord alert with a list of down websites and error messages
- Runs as a scheduled cron job inside Motia (no external cron setup needed)
- Simple, clean JavaScript code

---

## Setup Instructions

### 1. Create a Motia Project

```bash
npx motia@latest create uptime-monitor
cd uptime-monitor
```

### 2. Add the Monitoring Step

- Inside the `steps/` folder, create a file named `monitor.step.js`.
- Copy the example code from this repo into `monitor.step.js`.

### 3. Configure Websites and Discord Webhook

- Edit the `WEBSITES` array to include the URLs you want to monitor.
- Replace the `DISCORD_WEBHOOK` constant with your Discord webhook URL.

### 4. Get Your Discord Webhook URL

- Create a Discord server or use an existing one.
- Go to **Server Settings > Integrations > Webhooks**.
- Create a new webhook and copy its URL.
- Use this URL in the `DISCORD_WEBHOOK` constant.

### 5. Run Locally to Test

```bash
npm run dev
```

- You’ll see console logs for each site checked.
- If any site is down, you’ll get an alert in your configured Discord channel.

---

## How It Works

- The cron job runs every minute (configurable via the `cron` field).
- It calls `checkAll()`, which checks each website concurrently.
- If any site is down or unreachable, it sends a Discord alert with details.
- Uses Motia’s event-driven framework for scheduling and running backend logic.

---

## Code Overview

- `WEBSITES`: List of URLs to monitor.
- `checkSite(url)`: Checks one website, returns status or error.
- `sendAlert(downSites)`: Sends Discord webhook alert with down sites.
- `checkAll()`: Main function to check all sites and send alerts.
- `exports.config`: Motia cron configuration.
- `exports.handler`: Motia function executed on schedule.

---

## License

MIT License

---

Feel free to customize and extend this example for your own projects!

---

*Built with ❤️ using [Motia](https://motia.dev)*

```

---
