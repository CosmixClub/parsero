import { describe, expect, it } from "vitest";
import { z } from "zod";

import { State } from "../../../src/classes/state";

describe("State", () => {
	const inputSchema = z.object({
		number: z.number(),
		text: z.string().optional(),
	});

	const outputSchema = z.object({
		result: z.string(),
		success: z.boolean(),
	});

	it("should initialize with null values", () => {
		const state = new State({ inputSchema, outputSchema });
		expect(state.values.input).toEqual({ number: null, text: null });
		expect(state.values.output).toEqual({ result: null, success: null });
	});

	it("should parse input correctly", () => {
		const state = new State({ inputSchema, outputSchema });

		// Valid input
		const validInput = { number: 42, text: "hello" };
		const validResult = state.parseInput(validInput);
		expect(validResult.success).toBe(true);
		if (validResult.success) {
			expect(validResult.data).toEqual(validInput);
		}

		// Invalid input
		const invalidInput = { number: "not-a-number", text: 123 };
		const invalidResult = state.parseInput(invalidInput);
		expect(invalidResult.success).toBe(false);
	});

	it("should parse output correctly", () => {
		const state = new State({ inputSchema, outputSchema });

		// Valid output
		const validOutput = { result: "done", success: true };
		const validResult = state.parseOutput(validOutput);
		expect(validResult.success).toBe(true);
		if (validResult.success) {
			expect(validResult.data).toEqual(validOutput);
		}

		// Invalid output
		const invalidOutput = { result: 123, success: "not-a-boolean" };
		const invalidResult = state.parseOutput(invalidOutput);
		expect(invalidResult.success).toBe(false);
	});

	it("should set and get input values", () => {
		const state = new State({ inputSchema, outputSchema });
		const input = { number: 42, text: "hello" };
		state.setInput(input);
		expect(state.values.input).toEqual(input);
	});

	it("should set and get output values", () => {
		const state = new State({ inputSchema, outputSchema });
		const output = { result: "done", success: true };
		state.setOutput(output);
		expect(state.values.output).toEqual(output);
	});

	it("should convert values to LangGraph format", () => {
		const values = {
			input: { number: 42, text: "hello" },
			output: { result: "done", success: true },
		};

		const langgraphValues = State.valuesToLanggraph(values);
		expect(langgraphValues).toEqual({
			input_number: 42,
			input_text: "hello",
			output_result: "done",
			output_success: true,
		});
	});

	it("should convert LangGraph format back to values", () => {
		const langgraphValues = {
			input_number: 42,
			input_text: "hello",
			output_result: "done",
			output_success: true,
		};

		const values = State.langgraphToValues(langgraphValues);
		expect(values).toEqual({
			input: { number: 42, text: "hello" },
			output: { result: "done", success: true },
		});
	});

	// === NOVOS TESTES PARA CASOS COMPLEXOS E DE BORDA ===

	it("should handle complex nested schemas", () => {
		// Definir um schema complexo com arrays e objetos aninhados
		const complexInputSchema = z.object({
			settings: z
				.object({
					notifications: z.boolean(),
					theme: z.enum(["light", "dark"]),
				})
				.optional(),
			user: z.object({
				age: z.number(),
				name: z.string(),
				roles: z.array(z.string()),
			}),
		});

		const complexOutputSchema = z.object({
			details: z.array(
				z.object({
					id: z.string(),
					value: z.number(),
				}),
			),
			processed: z.boolean(),
		});

		// Criar state com schema complexo
		const state = new State({
			inputSchema: complexInputSchema,
			outputSchema: complexOutputSchema,
		});

		// Valores válidos
		const validInput = {
			settings: {
				notifications: true,
				theme: "dark",
			},
			user: {
				age: 30,
				name: "João",
				roles: ["admin", "user"],
			},
		};

		const validOutput = {
			details: [
				{ id: "a1", value: 10 },
				{ id: "b2", value: 20 },
			],
			processed: true,
		};

		// Testa parse e set
		const inputResult = state.parseInput(validInput);
		expect(inputResult.success).toBe(true);
		// @ts-expect-error -- O método setInput não deve aceitar valores inválidos
		state.setInput(validInput);
		expect(state.values.input).toEqual(validInput);

		const outputResult = state.parseOutput(validOutput);
		expect(outputResult.success).toBe(true);
		state.setOutput(validOutput);
		expect(state.values.output).toEqual(validOutput);

		// Testa conversão para LangGraph e de volta
		const langgraphValues = State.valuesToLanggraph({ input: validInput, output: validOutput });
		expect(langgraphValues).toMatchObject({
			input_settings_notifications: true,
			input_settings_theme: "dark",
			input_user_age: 30,
			input_user_name: "João",
			input_user_roles: ["admin", "user"],
			output_details: [
				{ id: "a1", value: 10 },
				{ id: "b2", value: 20 },
			],
			output_processed: true,
		});

		const convertedBack = State.langgraphToValues(langgraphValues);
		expect(convertedBack).toEqual({ input: validInput, output: validOutput });
	});

	it("should handle null and undefined values in LangGraph conversion", () => {
		const inputWithNulls = {
			nullableField: null,
			requiredField: "value",
			// optionalField omitted intentionally
		};

		const outputWithNulls = {
			message: null,
			status: "success",
		};

		// Converte para formato LangGraph
		const langgraphFormat = State.valuesToLanggraph({
			input: inputWithNulls,
			output: outputWithNulls,
		});

		// Testa presença de valores null e ausência de undefined
		expect(langgraphFormat.input_requiredField).toBe("value");
		expect(langgraphFormat.input_nullableField).toBeNull();
		expect(langgraphFormat.input_optionalField).toBeUndefined();
		expect(langgraphFormat.output_status).toBe("success");
		expect(langgraphFormat.output_message).toBeNull();

		// Converte de volta e verifica se manteve a estrutura
		const convertedBack = State.langgraphToValues(langgraphFormat);
		expect(convertedBack.input.requiredField).toBe("value");
		expect(convertedBack.input.nullableField).toBeNull();
		expect(convertedBack.input.optionalField).toBeUndefined();
		expect(convertedBack.output.status).toBe("success");
		expect(convertedBack.output.message).toBeNull();
	});

	it("should handle partial input when strict mode is disabled", () => {
		const strictSchema = z
			.object({
				age: z.number(),
				id: z.string(),
				name: z.string(),
			})
			.strict();

		const nonStrictSchema = z
			.object({
				age: z.number(),
				id: z.string(),
				name: z.string(),
			})
			.passthrough();

		// State com schema estrito
		const strictState = new State({
			inputSchema: strictSchema,
			outputSchema: outputSchema,
		});

		// State com schema não estrito
		const nonStrictState = new State({
			inputSchema: nonStrictSchema,
			outputSchema: outputSchema,
		});

		// Input com campo extra
		const inputWithExtra = {
			age: 30,
			extra: "should cause error in strict mode",
			id: "123",
			name: "John",
		};

		// Testa com schema estrito (deve rejeitar)
		const strictResult = strictState.parseInput(inputWithExtra);
		expect(strictResult.success).toBe(false);

		// Testa com schema não estrito (deve aceitar)
		const nonStrictResult = nonStrictState.parseInput(inputWithExtra);
		expect(nonStrictResult.success).toBe(true);
		if (nonStrictResult.success) {
			expect(nonStrictResult.data.extra).toBe("should cause error in strict mode");
		}
	});

	it("should handle input with default values", () => {
		// Schema com valores padrão
		const schemaWithDefaults = z.object({
			active: z.boolean().default(true),
			age: z.number().default(18),
			name: z.string(),
		});

		const state = new State({
			inputSchema: schemaWithDefaults,
			outputSchema: outputSchema,
		});

		// Input parcial
		const partialInput = {
			name: "Alice",
			// age e active omitidos
		};

		// Parse deve aplicar valores padrão
		const result = state.parseInput(partialInput);
		expect(result.success).toBe(true);

		if (result.success) {
			expect(result.data.name).toBe("Alice");
			expect(result.data.age).toBe(18);
			expect(result.data.active).toBe(true);
		}

		// Set deve preservar os valores padrão
		// @ts-expect-error -- O método setInput não deve aceitar valores inválidos
		state.setInput(result.success ? result.data : {});
		expect(state.values.input.age).toBe(18);
		expect(state.values.input.active).toBe(true);
	});
});
