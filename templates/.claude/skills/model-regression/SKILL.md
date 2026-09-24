---
name: model-regression
description: >
  Regression gate for machine-learning models and scoring logic. Use before and after any change
  that can move a model or score: training code, features, data preparation, hyperparameters,
  thresholds, prompts that produce scores, ranking or scoring rules, or the evaluation code itself.
  Use when the user says "retrain", "tune", "improve accuracy", "change the model", "new features",
  "adjust the threshold", "the score looks off", or asks whether a change made results better or worse.
---

# Model regression gate

A model change is only an improvement if it is measured against a fixed baseline, the same way, before and after. This skill makes that check routine.

## 1. Baseline first, before touching code

- Find the baseline file (default `metrics/baseline.json`). If none exists, create one from the current code before making any change, and commit it on its own.
- The baseline must record: each metric name and value, the evaluation data (path plus a content hash or version tag), the random seed(s), the exact command that produced it, the commit SHA, and the date.
- Declare the tolerance for each metric up front (for example "AUC may drop by at most 0.005"). Write it in the baseline file, not in your head.

## 2. Measure the change the same way

- Run the exact baseline command on the exact same evaluation data and seeds.
- Never change the model and the evaluation data or metric code in the same change. Split them, and re-baseline after an evaluation change.
- When results vary between runs, run at least 3 seeds and report the mean and the worst run, not the best one.
- Never tune on the test set. Tuning uses a validation split; the test set is read once per change.

## 3. Decide

- Any metric worse than baseline minus tolerance: the change fails. Revert it, or stop and report. Never loosen the tolerance or swap the metric to make it pass.
- All metrics within tolerance and the target metric better: the change passes. Update the baseline file in the same commit, with the new numbers and the reason.
- Improvement smaller than run-to-run noise: report it as "no measurable change", not as an improvement.

## 4. Keep a regression test

- Add or keep a fast test in the normal test suite that runs the model or scorer on a small frozen fixture and asserts each metric is at least baseline minus tolerance.
- The fixture lives in the repo and never changes silently; changing it is an evaluation change (see step 2).

## 5. Report

Report in this shape:

| Metric | Baseline | New | Delta | Tolerance | Result |
|---|---|---|---|---|---|

followed by: evaluation data version or hash, seeds, the command run, and the commit SHA. Every number must come from a run you actually did in this session. If a metric could not be computed, write "not computed" and say why.
