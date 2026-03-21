# AI_POLICY.md

## Scope
The AI functionality in this project is a browser-side heuristic text-processing module.

## What it does
- Extracts candidate structured variables from pasted clinical text.
- Labels findings as `extracted` or `inferred`.
- Leaves unresolved values as missing.
- Supports clinician confirmation through manual edits.

## What it does not do
- It does not hallucinate undocumented values by design.
- It does not connect to external LLM APIs in this version.
- It does not diagnose, prescribe, or make independent clinical decisions.
- It does not implement live EHR integration.

## Human-in-the-loop requirement
All AI-assisted outputs require clinician validation before being used in documentation, reporting, or workflow actions.
