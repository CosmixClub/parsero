import type { z } from "zod";

export type StateValuesFormat = {
	input: any;
	// setInput: (input: any) => void;
	output: any;
	// setOutput: (output: any) => void;
};

export class State<Input extends z.AnyZodObject, Output extends z.AnyZodObject> {
	private _runtime: {
		input: z.infer<Input>;
		output: z.infer<Output>;
	};

	constructor(
		private readonly props: {
			inputSchema: Input;
			outputSchema: Output;
		},
	) {
		this._runtime = {
			input: (props.inputSchema.keyof().options as string[])
				.map(key => ({ [key]: null }))
				.reduce((acc, obj) => ({ ...acc, ...obj }), {}),
			output: (props.outputSchema.keyof().options as string[])
				.map(key => ({ [key]: null }))
				.reduce((acc, obj) => ({ ...acc, ...obj }), {}),
		};
	}

	get values() {
		return {
			input: this._runtime.input,
			// setInput: (input: z.infer<Input>) => (this._runtime.input = input),
			output: this._runtime.output,
			// setOutput: (output: z.infer<Output>) => (this._runtime.output = output),
		};
	}

	parseInput(input: any) {
		return this.props.inputSchema.safeParse(input);
	}

	parseOutput(output: any) {
		return this.props.outputSchema.safeParse(output);
	}

	setInput(input: z.infer<Input>) {
		this._runtime.input = input;
	}

	setOutput(output: z.infer<Output>) {
		this._runtime.output = output;
	}

	static valuesToLanggraph(values: StateValuesFormat) {
		const { input, output } = values;
		const object: Record<string, any> = {};
		for (const [key, value] of Object.entries(input)) object[`input_${key}`] = value;
		for (const [key, value] of Object.entries(output)) object[`output_${key}`] = value;
		return object;
	}

	static langgraphToValues(object: Record<string, any>) {
		const input: Record<string, any> = {};
		const output: Record<string, any> = {};
		for (const [key, value] of Object.entries(object)) {
			if (key.startsWith("input_")) input[key.replace("input_", "")] = value;
			if (key.startsWith("output_")) output[key.replace("output_", "")] = value;
		}
		return { input, output };
	}
}
