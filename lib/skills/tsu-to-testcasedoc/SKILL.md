# tsu-to-testcasedoc

> **Prerequisite:** Before running this workflow, the user must have already run the Python extraction scripts to produce the `*slim_entities*` file.
>
> Example:
> ```
> python run_pipeline.py UpdateHeader.tsu ./output/
> ```
> This produces `UpdateHeader_slim_entities.txt` in the output directory.

## DETECT INPUTS

### Slim Entities File (required)
1. Scan working directory for files matching `*slim_entities*` (any extension: `.txt`, `.md`, etc.).
   - One found → use it as `<SLIM_ENTITIES>`.
   - Multiple → list them, ask which to use.
   - None → **stop** and instruct the user to run the Python scripts first.

### API Reference File (optional)
2. Scan working directory for `*API_Reference*` (case-insensitive, any extension).
   - Found → use as `<API_REF>`.
   - Not found → continue without it; mark all payload sections `⚠️ API_REF_MISSING`.

### Derive output name
3. Strip `_slim_entities` from the filename to get `<BaseName>`.
   - Example: `UpdateHeader_slim_entities.txt` → `<BaseName>` = `UpdateHeader`

---

## STEP 1 — BUILD DATA MODEL

> **GROUNDING RULE: Every value you write must be read directly from `<SLIM_ENTITIES>`. Never invent values, IDs, endpoints, or field names. If a value is not in the file → write `⚠️ MISSING`.**

Read `<SLIM_ENTITIES>` section by section and build these tables:

| Table | Source section |
|---|---|
| `CP[name] → value` | `CONFIGURATION PARAMETERS` |
| `module_surrogate → {name, endpoint, method, SOAPAction, attributes[]}` | `MODULES WITH ATTRIBUTES` |
| `step_surrogate → {module_name, values[{attr, action, value}]}` | `TEST STEPS WITH VALUES` |
| `block_surrogate → {name, step_surrogates[]}` | `REUSEABLE BLOCKS` |
| `tc_surrogate → {name, folder_items[]}` | `TEST CASES` |
| Folder hierarchy (GIVEN/WHEN/THEN → block refs + inline `[PARAM]` values) | `TEST STEP FOLDERS` |
| `tc_name → [{block_name, surr, [(param_name, value)]}]` | `PARAMETER LAYERS` |
| Test scenario rows × parameter columns | `TD DATA` |

Resolve in order: CPs → Modules → Steps → Blocks → TestCases → ParameterLayers → TD.

**ParameterLayer rule:** Each block reference inside a TC folder can carry per-TC parameter values. Use these values when building TC-specific test data tables.

**Buffer rule:** Find every step value with action=BUFFER. Record: `{B[name]}` is set by step X from response field Y.
**Library rule:** Every reference to a Reuseable Block must be expanded inline — never left as a block name.
**CP rule:** Substitute every `{CP[x]}` with its resolved value from the CP table.

---

## STEP 2 — READ API REFERENCE

If `<API_REF>` exists: read the full file. Use its SOAP/REST payload templates, substituting actual test data values per TestCase.

---

## STEP 3 — APPLY PROMPT AND WRITE OUTPUT

Apply the prompt from `prompt_template.md` using all data from Steps 1–2.
Write the final document to: `<output_dir>/<BaseName>_TestCaseDesignDoc.md`

---

## MANDATORY OUTPUT STRUCTURE

```
# TestCase Design Document — <feature name>
## Summary Table
  TC ID | Name | Business Operation | Endpoint | Method | TestSheet | Status (Complete/Data Missing)
## Resolved CP Parameters  (table)
## Common API Definitions  (API-A, API-B … with full request+response payloads)
--- (one section per TC) ---
## TC_001 — <Name>
  Business Scenario | Objective | Preconditions
  API Steps table: Step# | API Call | SOAPAction | Key Input | Key Output
  DB Steps table: Step# | SQL query | Validation or Buffer
  Test Data table: Parameter | Value
  Expected Results (field-level assertions)
  Dependencies
  Failure Handling (omit if all N/A)
```
