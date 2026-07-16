import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["src/core/**/*.ts"],
    ignores: ["src/core/conversation/transitions.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "AssignmentExpression[left.object.name='state']",
          message: "Conversation state mutations belong in conversation/transitions.ts."
        },
        {
          selector: "AssignmentExpression[left.object.object.name='state']",
          message: "Nested conversation state mutations belong in conversation/transitions.ts."
        },
        {
          selector: "UpdateExpression[argument.object.name='state']",
          message: "Conversation state mutations belong in conversation/transitions.ts."
        },
        {
          selector: "UnaryExpression[operator='delete'][argument.object.name='state']",
          message: "Conversation state mutations belong in conversation/transitions.ts."
        },
        {
          selector:
            "CallExpression[callee.object.object.name='state'][callee.property.name=/^(push|pop|splice|shift|unshift|sort|reverse|copyWithin|fill)$/]",
          message: "Conversation state collection mutations belong in conversation/transitions.ts."
        }
      ]
    }
  },
  globalIgnores([
    ".next/**",
    ".next-e2e/**",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
    "tests/model/results/**",
    "tests/model/artifacts/**",
    "next-env.d.ts"
  ])
]);
