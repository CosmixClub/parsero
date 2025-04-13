import { defineConfig } from "tsup";

export default defineConfig({
	clean: true,
	dts: true,
	entryPoints: ["src/index.ts"],
	format: ["cjs", "esm"],
	outDir: "dist",
	minify: true,
	splitting: true,
	sourcemap: false,
	treeshake: {
		preset: "smallest",
		propertyReadSideEffects: false,
	},
	target: "es2020",
	external: ["@langchain/core", "@langchain/langgraph", "zod"],
	esbuildOptions(options) {
		options.legalComments = "none";
		options.mangleProps = /^_/;
		options.drop = ["debugger"];
		options.treeShaking = true;
	},
});
