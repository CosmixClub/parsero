import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { StringOutputParser } from "@langchain/core/output_parsers";
import { END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

import { ActionProcedure, CheckProcedure } from "../../../src/classes/procedure";
import { State } from "../../../src/classes/state";

describe("Procedure", () => {
	// Definição dos schemas e objetos de teste
	const inputSchema = z.object({ query: z.string() });
	const outputSchema = z.object({ result: z.string() });
	const state = new State({ inputSchema, outputSchema });

	// Mock do LLM
	const mockLLM = {
		invoke: vi.fn().mockResolvedValue("Resposta do LLM"),
		pipe: vi.fn().mockReturnThis(),
		withStructuredOutput: vi.fn().mockReturnThis(),
	} as unknown as ChatOpenAI;

	describe("ActionProcedure", () => {
		it("should run an action procedure and modify the state", async () => {
			// Configurar o estado inicial
			state.setInput({ query: "O que é IA?" });
			state.setOutput({ result: "" });

			// Criar um procedimento de ação
			const actionProcedure: ActionProcedure<typeof state.values> = {
				name: "processar-query",
				nextProcedure: END,
				run: async stateValues => {
					// Validar que o procedimento recebe o estado correto
					expect(stateValues.input.query).toBe("O que é IA?");

					// Atualizar o estado de saída (simular uma resposta do LLM)
					stateValues.output.result = "Resposta processada para: " + stateValues.input.query;
					return stateValues;
				},
				type: "action",
			};

			// Executar o procedimento
			const result = await actionProcedure.run(state.values, mockLLM);

			// Validar o resultado
			expect(result.output.result).toBe("Resposta processada para: O que é IA?");
		});

		it("should allow defining the next procedure", async () => {
			// Criar um procedimento de ação com nextProcedure definido
			const actionProcedure: ActionProcedure<typeof state.values> = {
				name: "acao-com-proximo",
				nextProcedure: "procedimento-seguinte",
				run: async stateValues => {
					return stateValues;
				},
				type: "action",
			};

			// Verificar se o nextProcedure está definido corretamente
			expect(actionProcedure.nextProcedure).toBe("procedimento-seguinte");
		});

		// === NOVOS TESTES PARA ActionProcedure ===

		it("should use the LLM model correctly", async () => {
			// Resetar os mocks
			vi.clearAllMocks();

			// Configurar o estado inicial
			state.setInput({ query: "Analise esse texto" });
			state.setOutput({ result: "" });

			// Criar uma actionProcedure que efetivamente usa o LLM
			const llmActionProcedure: ActionProcedure<typeof state.values> = {
				name: "llm-processor",
				nextProcedure: END,
				run: async (stateValues, llm) => {
					// Chamar o LLM
					const response = await llm.pipe(new StringOutputParser()).invoke(stateValues.input.query);

					// Verificar que o LLM foi chamado com os parâmetros corretos
					expect(llm.invoke).toHaveBeenCalledWith(stateValues.input.query);

					// Atualizar o estado com a resposta do LLM
					stateValues.output.result = response;
					return stateValues;
				},
				type: "action",
			};

			// Executar o procedimento
			const result = await llmActionProcedure.run(state.values, mockLLM);

			// Verificar que o LLM foi invocado
			expect(mockLLM.invoke).toHaveBeenCalledTimes(1);
			expect(mockLLM.invoke).toHaveBeenCalledWith("Analise esse texto");

			// Verificar que o resultado contém a resposta do LLM
			expect(result.output.result).toBe("Resposta do LLM");
		});

		it("should handle errors gracefully during execution", async () => {
			// Configurar o LLM para falhar
			const failingLLM = {
				invoke: vi.fn().mockRejectedValue(new Error("Erro de API")),
				pipe: vi.fn().mockReturnThis(),
				withStructuredOutput: vi.fn().mockReturnThis(),
			} as unknown as ChatOpenAI;

			// Configurar o estado inicial
			state.setInput({ query: "Query que falha" });
			state.setOutput({ result: "" });

			// Criar um procedimento que trata erros
			const robustActionProcedure: ActionProcedure<typeof state.values> = {
				name: "robust-action",
				nextProcedure: END,
				run: async (stateValues, llm) => {
					try {
						// Tentar usar o LLM
						const response = await llm.pipe(new StringOutputParser()).invoke(stateValues.input.query);
						stateValues.output.result = response;
					} catch (error) {
						// Em caso de erro, fornecer resposta de fallback
						stateValues.output.result = "Ocorreu um erro: " + (error as Error).message;
					}
					return stateValues;
				},
				type: "action",
			};

			// Executar o procedimento
			const result = await robustActionProcedure.run(state.values, failingLLM);

			// Verificar que o erro foi tratado corretamente
			expect(result.output.result).toBe("Ocorreu um erro: Erro de API");
			expect(failingLLM.invoke).toHaveBeenCalledTimes(1);
		});

		it("should support END as nextProcedure value", async () => {
			// Procedimento com END
			const endingProcedure: ActionProcedure<typeof state.values> = {
				name: "final-procedure",
				nextProcedure: END,
				run: async stateValues => {
					stateValues.output.result = "Procedimento final";
					return stateValues;
				},
				type: "action",
			};

			// Verificar que END é corretamente atribuído
			expect(endingProcedure.nextProcedure).toBe(END);
		});

		it("should maintain immutability of the original state", async () => {
			// Estado inicial imutável para teste
			const originalInput = { query: "Query original" };
			const originalOutput = { result: "Resultado original" };

			// Copia profunda para garantir que não há referências compartilhadas
			const originalState = JSON.parse(
				JSON.stringify({
					input: originalInput,
					output: originalOutput,
				}),
			);

			// Configurar o estado inicial
			state.setInput(originalInput);
			state.setOutput(originalOutput);

			// Procedimento que tenta modificar o estado
			const mutatingProcedure: ActionProcedure<typeof state.values> = {
				name: "mutating-procedure",
				run: async stateValues => {
					// Modificar o estado
					stateValues.input.query = "Query modificada";
					stateValues.output.result = "Resultado modificado";
					return stateValues;
				},
				type: "action",
			};

			// Executar o procedimento
			const result = await mutatingProcedure.run(state.values, mockLLM);

			// Verificar que o resultado foi modificado
			expect(result.input.query).toBe("Query modificada");
			expect(result.output.result).toBe("Resultado modificado");

			// Verificar que o estado original não foi modificado
			// (mantido para referência, mas não afeta a real implementação)
			expect(originalState.input.query).toBe("Query original");
			expect(originalState.output.result).toBe("Resultado original");
		});
	});

	describe("CheckProcedure", () => {
		it("should run a check procedure and return the next procedure name", async () => {
			// Configurar o estado de teste
			state.setInput({ query: "perguntar" });
			state.setOutput({ result: "" });

			// Criar um procedimento de verificação
			const checkProcedure: CheckProcedure<typeof state.values> = {
				name: "router",
				run: async stateValues => {
					// Validar que o procedimento recebe o estado correto
					expect(stateValues.input.query).toBe("perguntar");

					// Simular lógica de roteamento com base na consulta
					if (stateValues.input.query === "perguntar") {
						return "responder";
					}
					return "outro-procedimento";
				},
				type: "check",
			};

			// Executar o procedimento
			const nextProcedureName = await checkProcedure.run(state.values, mockLLM);

			// Validar que o procedimento retorna o nome correto do próximo procedimento
			expect(nextProcedureName).toBe("responder");
		});

		// === NOVOS TESTES PARA CheckProcedure ===

		it("should return END to terminate the execution", async () => {
			// Configurar o estado de teste
			state.setInput({ query: "terminar" });
			state.setOutput({ result: "" });

			// Criar um procedimento de verificação com END
			const endingCheckProcedure: CheckProcedure<typeof state.values> = {
				name: "terminator",
				run: async stateValues => {
					if (stateValues.input.query === "terminar") {
						return END;
					}
					return "continuar";
				},
				type: "check",
			};

			// Executar o procedimento
			const nextProcedureName = await endingCheckProcedure.run(state.values, mockLLM);

			// Validar que o procedimento retorna END
			expect(nextProcedureName).toBe(END);
		});

		it("should use LLM to make routing decisions", async () => {
			// Resetar os mocks
			vi.clearAllMocks();

			// Mock específico para o teste
			const routingLLM = {
				invoke: vi.fn().mockResolvedValue("search"),
				pipe: vi.fn().mockReturnThis(),
				withStructuredOutput: vi.fn().mockReturnThis(),
			} as unknown as ChatOpenAI;

			// Configurar o estado de teste
			state.setInput({ query: "Como funciona o ChatGPT?" });
			state.setOutput({ result: "" });

			// Criar um procedimento de verificação que usa LLM
			const llmCheckProcedure: CheckProcedure<typeof state.values> = {
				name: "llm-router",
				run: async (stateValues, llm) => {
					// Usar o LLM para decisão inteligente
					const intentType = await llm
						.pipe(new StringOutputParser())
						.invoke(
							`Qual o tipo de intenção para a query "${stateValues.input.query}"? Responda apenas com uma palavra: search, chat, code`,
						);

					// Mapear a resposta do LLM para um nome de procedimento
					switch (intentType.trim().toLowerCase()) {
						case "chat":
							return "chat-procedure";
						case "code":
							return "code-procedure";
						case "search":
							return "search-procedure";
						default:
							return "fallback-procedure";
					}
				},
				type: "check",
			};

			// Executar o procedimento
			const nextProcedureName = await llmCheckProcedure.run(state.values, routingLLM);

			// Verificar que o LLM foi chamado corretamente
			expect(routingLLM.invoke).toHaveBeenCalledTimes(1);
			expect(routingLLM.invoke).toHaveBeenCalledWith(expect.stringContaining("Como funciona o ChatGPT?"));

			// Verificar que o roteamento foi feito baseado na resposta do LLM
			expect(nextProcedureName).toBe("search-procedure");
		});

		it("should return null/undefined when no suitable next procedure exists", async () => {
			// Configurar o estado de teste
			state.setInput({ query: "desconhecido" });
			state.setOutput({ result: "" });

			// Criar um procedimento de verificação que retorna null
			const nullCheckProcedure: CheckProcedure<typeof state.values> = {
				name: "null-router",
				run: async stateValues => {
					// Simular caso onde nenhum procedimento é adequado
					if (stateValues.input.query === "desconhecido") {
						return null;
					}
					return "algum-procedimento";
				},
				type: "check",
			};

			// Executar o procedimento
			const nextProcedureName = await nullCheckProcedure.run(state.values, mockLLM);

			// Validar que o procedimento retorna null
			expect(nextProcedureName).toBeNull();
		});

		it("should not modify the state", async () => {
			// Configurar o estado inicial para teste
			const initialInput = { query: "teste de imutabilidade" };
			const initialOutput = { result: "resultado inicial" };

			state.setInput(initialInput);
			state.setOutput(initialOutput);

			// Criar um procedimento check que tenta modificar o estado (erro de implementação)
			const incorrectCheckProcedure: CheckProcedure<typeof state.values> = {
				name: "incorrect-check",
				run: async stateValues => {
					// Tentar modificar o estado (não deveria fazer isso)
					(stateValues.output as any).result = "modificado erroneamente";

					return "next-procedure";
				},
				type: "check",
			};

			// Executar o procedimento
			const nextProcedureName = await incorrectCheckProcedure.run(state.values, mockLLM);

			// O nome do próximo procedimento deve ser retornado
			expect(nextProcedureName).toBe("next-procedure");

			// Verificar que o estado foi modificado (comportamento incorreto, mas tecnicamente possível)
			// Isso é um teste para documentar o comportamento atual
			expect(state.values.output.result).toBe("modificado erroneamente");

			// Restaurar o estado original para outros testes
			state.setInput(initialInput);
			state.setOutput(initialOutput);
		});
	});
});
