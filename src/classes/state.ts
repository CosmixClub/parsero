import type { z } from "zod";

/**
 * Representa o formato mínimo esperado para os valores de estado
 * utilizados por um agente. Estes valores são normalmente divididos
 * em `input` e `output`.
 */
export type StateValuesFormat = {
	/**
	 * Propriedades que compõem o estado de **entrada**.
	 */
	input: any;

	/**
	 * Propriedades que compõem o estado de **saída**.
	 */
	output: any;
};

/**
 * A classe `State` controla o estado interno de um agente, contendo
 * tanto as propriedades de **entrada** quanto de **saída** de forma
 * tipada, utilizando `Zod` para validação.
 *
 * @template Input - Schema Zod para o estado de entrada
 * @template Output - Schema Zod para o estado de saída
 */
export class State<Input extends z.AnyZodObject, Output extends z.AnyZodObject> {
	/**
	 * Mantém em memória o estado atual do agente, separado em `input` e `output`,
	 * ambos tipados e validados via Zod.
	 *
	 * @private
	 */
	private _runtime: {
		input: z.infer<Input>;
		output: z.infer<Output>;
	};

	constructor(
		private readonly props: {
			/**
			 * Schema Zod para validar a forma do estado de entrada.
			 */
			inputSchema: Input;

			/**
			 * Schema Zod para validar a forma do estado de saída.
			 */
			outputSchema: Output;
		},
	) {
		// Inicializa o estado local preenchendo as chaves do schema com `null`
		this._runtime = {
			input: (props.inputSchema.keyof().options as string[])
				.map(key => ({ [key]: null }))
				.reduce((acc, obj) => ({ ...acc, ...obj }), {}),
			output: (props.outputSchema.keyof().options as string[])
				.map(key => ({ [key]: null }))
				.reduce((acc, obj) => ({ ...acc, ...obj }), {}),
		};
	}

	/**
	 * Retorna o estado atual do agente, composto pelas chaves
	 * `input` e `output`.
	 */
	get values() {
		return {
			input: this._runtime.input,
			output: this._runtime.output,
		};
	}

	/**
	 * Tenta validar um objeto qualquer contra o schema de entrada definido.
	 *
	 * @param input - Dados a serem validados.
	 * @returns O resultado da validação (sucesso ou erro).
	 */
	parseInput(input: any) {
		return this.props.inputSchema.safeParse(input);
	}

	/**
	 * Tenta validar um objeto qualquer contra o schema de saída definido.
	 *
	 * @param output - Dados a serem validados.
	 * @returns O resultado da validação (sucesso ou erro).
	 */
	parseOutput(output: any) {
		return this.props.outputSchema.safeParse(output);
	}

	/**
	 * Atualiza o estado de entrada do agente. Ideal para ser usado após
	 * a validação com `parseInput`.
	 *
	 * @param input - Objeto de estado de entrada que segue o schema definido.
	 */
	setInput(input: z.infer<Input>) {
		this._runtime.input = input;
	}

	/**
	 * Atualiza o estado de saída do agente. Ideal para ser usado após
	 * a validação com `parseOutput`.
	 *
	 * @param output - Objeto de estado de saída que segue o schema definido.
	 */
	setOutput(output: z.infer<Output>) {
		this._runtime.output = output;
	}

	/**
	 * Converte um objeto de estado no formato `{ input, output }`
	 * para um formato de objeto plano, onde cada chave é prefixada
	 * com `"input_"` ou `"output_"`.
	 *
	 * Este método pode ser útil para integrar com outras bibliotecas
	 * que necessitem de chaves únicas (por exemplo, `LangGraph`).
	 *
	 * @param values - Objeto com as chaves `input` e `output`.
	 * @returns Objeto plano contendo as chaves prefixadas, ex: `{ input_<key>: value, output_<key>: value }`.
	 */
	static valuesToLanggraph(values: StateValuesFormat) {
		const { input, output } = values;
		const object: Record<string, any> = {};
		for (const [key, value] of Object.entries(input)) object[`input_${key}`] = value;
		for (const [key, value] of Object.entries(output)) object[`output_${key}`] = value;
		return object;
	}

	/**
	 * Faz o caminho inverso de `valuesToLanggraph`, ou seja, converte um
	 * objeto plano (com chaves `input_...` e `output_...`) para um
	 * objeto `{ input, output }`.
	 *
	 * @param object - Objeto contendo chaves prefixadas em `input_` e `output_`.
	 * @returns Objeto `{ input, output }` reconstruído a partir das chaves lidas.
	 */
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
