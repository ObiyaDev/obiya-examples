# Recruiter Agent

An AI-powered recruiter agent built with Motia that analyzes resumes and matches them against open positions.

## Features

- PDF resume parsing and analysis
- AI-powered skill and experience extraction
- Automatic matching against open positions
- Detailed candidate summaries and recommendations
- Position match percentages and analysis

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:
   Create a `.env` file with:

```
OPENAI_API_KEY=your_api_key_here
```

3. Start the development server:

```bash
npm run dev
```

## Usage

1. Send a POST request to `/api/analyze-resume` with:

```json
{
  "resume": "<PDF file as Buffer>",
  "candidateName": "John Doe",
  "candidateEmail": "john@example.com"
}
```

2. The agent will:

   - Parse and analyze the resume
   - Match against open positions
   - Generate a comprehensive summary

3. The final summary includes:
   - Candidate overview
   - Key strengths
   - Areas of concern
   - Position matches with percentages
   - Recommendations

## Open Positions

Sample open positions are stored in `data/open-positions.json`. Modify this file to add or update positions.

## Flow Steps

1. `trigger-resume-analysis`: API endpoint for resume upload
2. `analyze-resume`: AI analysis of resume content
3. `match-positions`: Position matching and scoring
4. `generate-summary`: Final summary generation

## Development

- Build: `npm run build`
- Test: `npm test`
- Debug: Add console logs using `ctx.logger.info()`

## Project Structure

- `steps/` - Contains all workflow steps
  - `api-trigger.step.ts` - Entry point for the workflow
  - `pdf-processing.step.ts` - Processes PDF resumes
  - `resume-analysis.step.ts` - Analyzes resumes using OpenAI
  - `position-matching.step.ts` - Matches resumes with positions
- `types/` - TypeScript type definitions
- `data/` - Sample data and configurations
- `.motia/` - Workflow configuration

## License

ISC
