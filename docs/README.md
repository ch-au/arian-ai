# Documentation Guide

This directory hosts technical documentation for ARIAN AI Platform. Each document focuses on a specific area for quick reference.

## Core Technical References

### Architecture & Development
- **`ARCHITECTURE.md`** - Platform overview, service boundaries, and data flow
- **`DEVELOPMENT.md`** - Day-to-day workflow, environment setup, and conventions
- **`DATA_MODEL_SPECIFICATION.md`** - Database schema, default data, and extension patterns
- **`SIMULATION_QUEUE.md`** - Execution model for the combinatorial negotiation queue
- **`TESTING_GUIDE.md`** - Testing strategy, recommended commands, and validation checklist

### Feature-Specific Guides
- **`AI_EVALUATION_BACKFILL.md`** - AI evaluation system, automatic & manual evaluation, backfill functionality
- **`AZURE_DEPLOYMENT.md`** - *(Moved to root)* See `../AZURE_DEPLOYMENT.md`

## Root-Level Documentation

Essential documentation in parent directory:

### Getting Started
- **`README.md`** - Quick start guide, feature overview, architecture summary
- **`AGENTS.md`** - Complete development guide, commands, technical reference
- **`HANDOVER_SUMMARY.md`** - Developer onboarding and handover guide

### Reference
- **`CHANGELOG.md`** - Version history, recent changes, migration notes
- **`AZURE_DEPLOYMENT.md`** - Step-by-step Azure deployment guide

## Historical Documentation

Older planning docs and design explorations are archived in `docs/archive/`. They remain available for historical reference but are no longer required reading for active development.

**Archive Contents:**
- Sprint planning documents
- Phase completion reports
- Historical design decisions
- Deprecated implementation summaries

## Documentation Principles

When creating or updating documentation:

1. **Single Source of Truth** - Each topic has one authoritative document
2. **Clear Cross-Links** - Link to related docs instead of duplicating content
3. **Concise & Actionable** - Focus on what developers need to know
4. **Keep Index Updated** - Update this README when adding/removing docs
5. **Archive When Obsolete** - Move outdated docs to `archive/`, don't delete

## Quick Reference

### I want to...
- **Get started quickly** → `../README.md`
- **Understand the architecture** → `ARCHITECTURE.md`
- **Run development commands** → `../AGENTS.md`
- **Set up my environment** → `DEVELOPMENT.md`
- **Understand the database** → `DATA_MODEL_SPECIFICATION.md`
- **Run tests** → `TESTING_GUIDE.md`
- **Deploy to Azure** → `../AZURE_DEPLOYMENT.md`
- **Understand AI evaluation** → `AI_EVALUATION_BACKFILL.md`
- **Debug simulation queue** → `SIMULATION_QUEUE.md`
- **See recent changes** → `../CHANGELOG.md`

---

**Last Updated:** Januar 2025  
**Maintainer:** Christian Au
