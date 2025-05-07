# Docs Guardian Project

Documentation Guardian is a Motia-powered workflow that streamlines the process of documenting code.
It analyzes codebases to identify 'documentation gaps' (functions, classes, or methods lacking proper documentation), uses AI to generate appropriate documentation, and provides a human-in-the-loop review process before integrating the documentation back into the original codebase.

## Prerequisites

- Node.js 18+
- OpenAI API key
- Git, pnpm

## Setup

Clone this repository:

```bash
git clone https://github.com/sguequierre/motia-examples.git
cd motia-examples/examples/sguequierre
```

Install dependencies:

```bash
pnpm install
```

Create a .env file containing your OpenAPI key and your GitHub personal access token.
You'll add your webhook secret in a moment.
Refer to .env.example for an example as such:

```bash
# GitHub configuration
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
GITHUB_TOKEN=your_personal_access_token_here

# OpenAI API configuration
OPENAI_API_KEY=your_openai_api_key_here
```

Save the file.
Run your Motia project:

```bash
pnpm run dev
```

Set up a GitHub webhook on the repository you wish to monitor for code changes.
Use [ngrok](https://ngrok.com/docs/getting-started/) to forward your `localhost:3000` to a public URL and set that + `/webhook/github` as the payload URL for your webhook.
Set the content type of your webhook as `application/json`.
Add a secret of your choice and then add that to your .env file.
For the events you would like to trigger the webhook, select "Just the `push` event."

Run your Motia project again with the updated .env.

Now, trigger the workflow by pushing some code changes to your repository.
