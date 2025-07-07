# Installation Guide

This guide helps you set up and run the Motia examples correctly, addressing common installation issues.

## Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)
- pnpm (recommended) or npm

## Common Issues and Solutions

### Issue: "ERR_PNPM_NO_PKG_MANIFEST No package.json found"

**Problem**: You're trying to run `pnpm install` in the wrong directory.

**Solution**: Make sure you're in the correct example directory:

```bash
# Wrong ❌
cd examples/gmail-flow  # This directory doesn't exist

# Correct ✅
cd examples/gmail-workflow  # This is the correct directory name
```

### Directory Name Reference

Some examples have similar names. Here's the correct mapping:

| ❌ Common Mistake | ✅ Correct Directory |
|-------------------|---------------------|
| `gmail-flow` | `gmail-workflow` |
| `github-workflow` | `github-integration-workflow` |
| `rag-agent` | `rag-docling-weaviate-agent` or `rag_example` |

### Issue: pnpm not found

**Problem**: pnpm is not installed on your system.

**Solution**: Install pnpm globally:

```bash
npm install -g pnpm
```

Verify installation:
```bash
pnpm --version
```

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/MotiaDev/motia-examples.git
cd motia-examples
```

### 2. Choose Your Example

List available examples:
```bash
ls examples/
```

Navigate to your chosen example:
```bash
cd examples/[example-name]
```

### 3. Install Dependencies

Using pnpm (recommended):
```bash
pnpm install
```

Using npm:
```bash
npm install
```

### 4. Environment Setup

Most examples require environment variables:

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your configuration
nano .env  # or use your preferred editor
```

### 5. Run the Example

```bash
# Using pnpm
pnpm dev

# Using npm
npm run dev
```

## Package Manager Comparison

| Feature | pnpm | npm |
|---------|------|-----|
| Speed | ⚡ Faster | Slower |
| Disk Space | 💾 Less space | More space |
| Lock File | `pnpm-lock.yaml` | `package-lock.json` |
| Installation | `pnpm install` | `npm install` |

## Troubleshooting

### Node.js Version Issues

If you encounter Node.js version errors:

```bash
# Check your Node.js version
node --version

# If using nvm, switch to Node.js 18+
nvm use 18
```

### Permission Issues

If you get permission errors during global package installation:

```bash
# Fix npm permissions (macOS/Linux)
sudo chown -R $(whoami) ~/.npm

# Or use a Node version manager like nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

### Cache Issues

If dependencies seem corrupted:

```bash
# Clear pnpm cache
pnpm store prune

# Clear npm cache
npm cache clean --force
```

### Docker Issues

If using Docker with pnpm, ensure the Dockerfile includes pnpm installation:

```dockerfile
FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# ... rest of Dockerfile
```

## Getting Help

If you continue to experience issues:

1. Check the specific example's README.md
2. Verify you're in the correct directory
3. Ensure all prerequisites are installed
4. Open an issue on GitHub with:
   - Your operating system
   - Node.js version (`node --version`)
   - pnpm version (`pnpm --version`)
   - The exact error message
   - Steps you've already tried

## Next Steps

Once installation is complete:

1. Read the example's specific README.md
2. Configure your environment variables
3. Follow the example's usage instructions
4. Explore the Motia documentation at [motia.dev](https://motia.dev)