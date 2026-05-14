export interface Workflow {
  id: string;
  label: string;
  icon: string;
  description: string;
  prompt?: string;
  skillName?: string;
}

export const WORKFLOWS: Workflow[] = [
  {
    id: "testcase-design-from-swagger",
    label: "Test Design Doc from Swagger",
    icon: "📄",
    description: "Generate Test Case Design document from Swagger/OpenAPI spec",
    skillName: "api-to-testcase-generator",
  },
  {
    id: "playwright-api-testing",
    label: "Generate Playwright Script - API Testing",
    icon: "🎭",
    description: "Generate Playwright TypeScript API test script from test design doc",
    skillName: "playwright",
  },
  {
    id: "testcase-design-from-tosca",
    label: "Test Design Doc from Tosca Scripts",
    icon: "🧪",
    description: "Extract test cases from Tosca scripts and generate Test Design Document",
    skillName: "tsu-to-testcasedoc",
  },
  {
    id: "optimize-framework",
    label: "Optimize Framework",
    icon: "⚡",
    description: "Review and optimize existing Playwright TypeScript framework code",
    prompt: `You are a Senior SDET specializing in Playwright TypeScript framework optimization for Vidispine Broadcast Management.

Review the provided Playwright code and optimize for:
1. **Performance** – parallel execution, test isolation, fixture reuse
2. **Maintainability** – DRY principles, helper functions, constants
3. **Reliability** – proper waits, retry logic, error handling
4. **Reporting** – meaningful test names, custom error messages
5. **CI/CD readiness** – environment config, test tagging, sharding

For each issue found:
- Show the problematic code
- Explain WHY it's a problem
- Provide the optimized version

Also suggest framework-level improvements (folder structure, config, base fixtures).`
  },
];

export const SYSTEM_PROMPT = `You are an expert AI assistant embedded in the Vidispine QA team's internal tool. 

Your primary users are SDETs (Senior Software Development Engineers in Test) working on:
- Vidispine Broadcast Management platform
- Playwright TypeScript framework for API and UI automation
- Migrating test cases from Tosca (no-code) to code-based automation
- Test case design documentation
- Corporate communication

Always be:
- Direct and precise — no filler, no fluff
- Technical where needed — these are experienced engineers
- Specific to the Vidispine broadcast domain context
- Structured in output — use headers, tables, code blocks appropriately

When analyzing files, extract maximum useful information. When generating code, make it production-ready.`;
