module.exports = {
	root: true,
	env: {
		browser: true,
		es2022: true,
		node: true,
	},
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"plugin:perfectionist/recommended-natural-legacy",
		"plugin:prettier/recommended",
	],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "module",
		project: "tsconfig.json",
		tsconfigRootDir: __dirname,
	},
	plugins: ["@typescript-eslint", "perfectionist", "prettier"],
	rules: {
		"no-console": "off",
		"perfectionist/sort-classes": "off",
		"perfectionist/sort-imports": "off",
		"perfectionist/sort-named-imports": "off",
		"@typescript-eslint/explicit-module-boundary-types": "off",
		"@typescript-eslint/no-explicit-any": "warn",
		"@typescript-eslint/no-unused-vars": [
			"warn",
			{
				argsIgnorePattern: "^_",
				varsIgnorePattern: "^_",
			},
		],
	},
	ignorePatterns: ["dist", "node_modules", ".eslintrc.cjs"],
	overrides: [
		{
			files: ["tests/**/*.ts"],
			env: {
				node: true,
				jest: true,
			},
			parserOptions: {
				project: "tsconfig.test.json",
				tsconfigRootDir: __dirname,
			},
			rules: {
				"@typescript-eslint/no-explicit-any": "off",
			},
		},
	],
};
