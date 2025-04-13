import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

import { Agent } from "../../../src/classes/agent";
import { ActionProcedure, CheckProcedure } from "../../../src/classes/procedure";
import { State } from "../../../src/classes/state";
import { ProcedureChainError } from "../../../src/errors/procedure-chain";
import { ProcedureNameError } from "../../../src/errors/procedure-name";
import { StateValidationError } from "../../../src/errors/state-validation";

describe("Agent", () => {
	// Schemas para testes
	const inputSchema = z.object({
		number: z.number(),
	});
	const outputSchema = z.object({
		description: z.string(),
		isEven: z.boolean(),
	});

	// Mock do LLM para testes
	const mockLLM = {
		invoke: vi.fn().mockResolvedValue("Resposta mock do LLM"),
		pipe: vi.fn().mockReturnThis(),
		withStructuredOutput: vi.fn().mockReturnThis(),
	} as unknown as ChatOpenAI;

	// Procedimentos para testes
	let checkNumberProcedure: ActionProcedure<any>;
	let routerProcedure: CheckProcedure<any>;
	let evenProcedure: ActionProcedure<any>;
	let oddProcedure: ActionProcedure<any>;

	// Reset dos mocks e procedimentos antes de cada teste
	beforeEach(() => {
		vi.clearAllMocks();

		checkNumberProcedure = {
			name: "checkNumber",
			nextProcedure: "router",
			run: vi.fn().mockImplementation(async state => {
				// Verifica se é par
				const isEven = state.input.number % 2 === 0;
				state.output.isEven = isEven;
				return state;
			}),
			type: "action",
		};

		routerProcedure = {
			name: "router",
			run: vi.fn().mockImplementation(async state => {
				return state.output.isEven ? "processEven" : "processOdd";
			}),
			type: "check",
		};

		evenProcedure = {
			name: "processEven",
			nextProcedure: END,
			run: vi.fn().mockImplementation(async state => {
				state.output.description = `O número ${state.input.number} é par.`;
				return state;
			}),
			type: "action",
		};

		oddProcedure = {
			name: "processOdd",
			nextProcedure: END,
			run: vi.fn().mockImplementation(async state => {
				state.output.description = `O número ${state.input.number} é ímpar.`;
				return state;
			}),
			type: "action",
		};
	});

	it("should run a valid agent with check and action procedures", async () => {
		// Configurar o estado
		const state = new State({ inputSchema, outputSchema });

		// Configurar o agente
		const agent = new Agent({
			llm: mockLLM,
			procedures: [checkNumberProcedure, routerProcedure, evenProcedure, oddProcedure],
			state,
		});

		// Executar o agente para um número par
		const resultEven = await agent.run({ number: 42 });
		expect(resultEven.isEven).toBe(true);
		expect(resultEven.description).toBe("O número 42 é par.");
		expect(checkNumberProcedure.run).toHaveBeenCalled();
		expect(routerProcedure.run).toHaveBeenCalled();
		expect(evenProcedure.run).toHaveBeenCalled();
		expect(oddProcedure.run).not.toHaveBeenCalled();

		// Resetar mocks
		vi.clearAllMocks();

		// Executar o agente para um número ímpar
		const resultOdd = await agent.run({ number: 43 });
		expect(resultOdd.isEven).toBe(false);
		expect(resultOdd.description).toBe("O número 43 é ímpar.");
		expect(checkNumberProcedure.run).toHaveBeenCalled();
		expect(routerProcedure.run).toHaveBeenCalled();
		expect(evenProcedure.run).not.toHaveBeenCalled();
		expect(oddProcedure.run).toHaveBeenCalled();
	});

	it("should run a simple sequence of action procedures without check", async () => {
		// Redefinir procedimentos sem routing
		const proc1: ActionProcedure<any> = {
			name: "proc1",
			run: vi.fn().mockImplementation(async state => {
				state.output.isEven = state.input.number % 2 === 0;
				return state;
			}),
			type: "action",
		};

		const proc2: ActionProcedure<any> = {
			name: "proc2",
			run: vi.fn().mockImplementation(async state => {
				state.output.description = `O número ${state.input.number} ${state.output.isEven ? "é par" : "é ímpar"}.`;
				return state;
			}),
			type: "action",
		};

		// Configurar o agente
		const state = new State({ inputSchema, outputSchema });
		const agent = new Agent({
			llm: mockLLM,
			procedures: [proc1, proc2],
			state,
		});

		// Executar o agente
		const result = await agent.run({ number: 42 });
		expect(result.isEven).toBe(true);
		expect(result.description).toBe("O número 42 é par.");
		expect(proc1.run).toHaveBeenCalled();
		expect(proc2.run).toHaveBeenCalled();
	});

	it("should throw error when procedures have duplicate names", async () => {
		// Configurar procedimentos com nomes duplicados
		const duplicateName1: ActionProcedure<any> = {
			name: "sameName",
			run: async state => state,
			type: "action",
		};

		const duplicateName2: CheckProcedure<any> = {
			name: "sameName",
			run: async () => "next",
			type: "check",
		};

		// Configurar o agente com nomes duplicados
		const state = new State({ inputSchema, outputSchema });
		const agent = new Agent({
			llm: mockLLM,
			procedures: [duplicateName1, duplicateName2],
			state,
		});

		// Verificar que uma exceção é lançada ao executar
		await expect(agent.run({ number: 1 })).rejects.toThrow(ProcedureNameError);
	});

	it("should throw error when action procedure doesn't declare next procedure with check present", async () => {
		// Procedimento de ação sem nextProcedure definido
		const actionWithoutNext: ActionProcedure<any> = {
			name: "actionWithoutNext",
			run: async state => state,
			type: "action",
		};

		// Configurar o agente com um check e uma action sem nextProcedure
		const state = new State({ inputSchema, outputSchema });
		const agent = new Agent({
			llm: mockLLM,
			procedures: [actionWithoutNext, routerProcedure],
			state,
		});

		// Verificar que uma exceção é lançada ao executar
		await expect(agent.run({ number: 1 })).rejects.toThrow(ProcedureChainError);
	});

	it("should throw StateValidationError when input doesn't match schema", async () => {
		const state = new State({ inputSchema, outputSchema });
		const agent = new Agent({
			llm: mockLLM,
			procedures: [checkNumberProcedure, routerProcedure, evenProcedure, oddProcedure],
			state,
		});

		// Input inválido: string em vez de número
		const invalidInput = { number: "not-a-number" as any };

		// Verificar que uma exceção é lançada
		await expect(agent.run(invalidInput)).rejects.toThrow(StateValidationError);
	});

	it("should provide access to the underlying graph", () => {
		const state = new State({ inputSchema, outputSchema });
		const agent = new Agent({
			llm: mockLLM,
			procedures: [checkNumberProcedure, routerProcedure, evenProcedure, oddProcedure],
			state,
		});

		// Verificar que o grafo foi criado
		expect(agent.graph).toBeDefined();
	});

	// === NOVOS TESTES PARA A ENGINE DE ORQUESTRAÇÃO ===

	it("should throw StateValidationError when output doesn't match schema", async () => {
		const state = new State({ inputSchema, outputSchema });

		// Criar um procedimento que gera um output inválido
		const invalidOutputProc: ActionProcedure<any> = {
			name: "invalidOutput",
			run: async state => {
				// Intencionalmente atribuir um valor de tipo errado
				(state.output as any).isEven = "not-a-boolean";
				state.output.description = 123 as any;
				return state;
			},
			type: "action",
		};

		const agent = new Agent({
			llm: mockLLM,
			procedures: [invalidOutputProc],
			state,
		});

		// Executar o agente e esperar erro
		await expect(agent.run({ number: 1 })).rejects.toThrow(StateValidationError);
		await expect(agent.run({ number: 1 })).rejects.toThrow("O output gerado não segue o schema.");
	});

	it("should respect maxIterations and throw error when limit is reached", async () => {
		// Criar procedimentos que geram um loop infinito
		const loopProc1: ActionProcedure<any> = {
			name: "loop1",
			nextProcedure: "loop2",
			run: vi.fn().mockImplementation(async state => state),
			type: "action",
		};

		const loopProc2: ActionProcedure<any> = {
			name: "loop2",
			nextProcedure: "loop1",
			run: vi.fn().mockImplementation(async state => state),
			type: "action",
		};

		const state = new State({ inputSchema, outputSchema });
		state.setOutput({ description: "Teste", isEven: true });

		const agent = new Agent({
			llm: mockLLM,
			options: {
				maxIterations: 5,
			},
			procedures: [loopProc1, loopProc2],
			state,
		});

		// Executar o agente e esperar erro de limite de iterações
		const runPromise = agent.run({ number: 1 });

		// Verificar que a exceção correta é lançada
		await expect(runPromise).rejects.toThrow(ProcedureChainError);
		await expect(runPromise).rejects.toThrow("O agente atingiu o limite máximo de 5 iterações");

		// Verificar que as procedures foram chamadas o número correto de vezes
		expect(loopProc1.run).toHaveBeenCalledTimes(3); // chamadas ímpares: 1, 3, 5
		expect(loopProc2.run).toHaveBeenCalledTimes(2); // chamadas pares: 2, 4
	});

	it("should log execution steps when verbose option is enabled", async () => {
		// Mock console.log
		const originalConsoleLog = console.log;
		const mockConsoleLog = vi.fn();
		console.log = mockConsoleLog;

		try {
			const state = new State({ inputSchema, outputSchema });
			const agent = new Agent({
				llm: mockLLM,
				options: {
					verbose: true,
				},
				procedures: [checkNumberProcedure, routerProcedure, evenProcedure],
				state,
			});

			await agent.run({ number: 42 });

			// Verificar se console.log foi chamado para cada etapa
			expect(mockConsoleLog).toHaveBeenCalledTimes(3);
			expect(mockConsoleLog).toHaveBeenNthCalledWith(
				1,
				expect.stringContaining("[Agente] Iteração 1: checkNumber"),
			);
			expect(mockConsoleLog).toHaveBeenNthCalledWith(2, expect.stringContaining("[Agente] Iteração 2: router"));
			expect(mockConsoleLog).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining("[Agente] Iteração 3: processEven"),
			);
		} finally {
			// Restaurar console.log original
			console.log = originalConsoleLog;
		}
	});

	it("should stop execution when CheckProcedure returns END", async () => {
		// Criar uma action procedure que aponta para nossa procedure de check
		const initialActionProc: ActionProcedure<any> = {
			name: "initialAction",
			nextProcedure: "endingRouter", // Aponta diretamente para o router que retorna END
			run: vi.fn().mockImplementation(async state => {
				state.output.isEven = true;
				return state;
			}),
			type: "action",
		};

		// Router que sempre retorna END
		const endingRouterProcedure: CheckProcedure<any> = {
			name: "endingRouter",
			run: vi.fn().mockResolvedValue(END),
			type: "check",
		};

		const state = new State({ inputSchema, outputSchema });
		state.setOutput({ description: "Definido previamente", isEven: true });

		const agent = new Agent({
			llm: mockLLM,
			procedures: [initialActionProc, endingRouterProcedure, evenProcedure, oddProcedure],
			state,
		});

		// Executar o agente
		const result = await agent.run({ number: 42 });

		// Verificar que o fluxo parou após o router retornar END
		expect(initialActionProc.run).toHaveBeenCalled();
		expect(endingRouterProcedure.run).toHaveBeenCalled();
		expect(evenProcedure.run).not.toHaveBeenCalled();
		expect(oddProcedure.run).not.toHaveBeenCalled();
		// O valor de saída deve permanecer o que foi definido previamente
		expect(result.description).toBe("Definido previamente");
	});

	it("should stop execution if CheckProcedure returns null or undefined", async () => {
		// Criar uma action procedure que aponta para nossa procedure de check
		const initialActionProc: ActionProcedure<any> = {
			name: "initialAction",
			nextProcedure: "nullRouter", // Aponta diretamente para o router que retorna null
			run: vi.fn().mockImplementation(async state => {
				state.output.isEven = true;
				return state;
			}),
			type: "action",
		};

		// Criar uma procedure que retorna null
		const nullRouterProcedure: CheckProcedure<any> = {
			name: "nullRouter",
			run: vi.fn().mockResolvedValue(null),
			type: "check",
		};

		const state = new State({ inputSchema, outputSchema });
		state.setOutput({ description: "Valor inicial", isEven: true });

		const agent = new Agent({
			llm: mockLLM,
			procedures: [initialActionProc, nullRouterProcedure, evenProcedure, oddProcedure],
			state,
		});

		// Executar o agente
		const result = await agent.run({ number: 42 });

		// Verificar que o fluxo parou após o router retornar null
		expect(initialActionProc.run).toHaveBeenCalled();
		expect(nullRouterProcedure.run).toHaveBeenCalled();
		expect(evenProcedure.run).not.toHaveBeenCalled();
		expect(oddProcedure.run).not.toHaveBeenCalled();
		expect(result.description).toBe("Valor inicial");
	});

	it("should set currentProcedure to null if CheckProcedure returns non-existent procedure name", async () => {
		// Criar uma action procedure que aponta para nossa procedure de check
		const initialActionProc: ActionProcedure<any> = {
			name: "initialAction",
			nextProcedure: "invalidRouter", // Aponta diretamente para o router com nome inexistente
			run: vi.fn().mockImplementation(async state => {
				state.output.isEven = true;
				return state;
			}),
			type: "action",
		};

		// Criar uma procedure que retorna um nome inexistente
		const invalidRouterProcedure: CheckProcedure<any> = {
			name: "invalidRouter",
			run: vi.fn().mockResolvedValue("non-existent-procedure"),
			type: "check",
		};

		const state = new State({ inputSchema, outputSchema });
		state.setOutput({ description: "Valor inicial", isEven: true });

		const agent = new Agent({
			llm: mockLLM,
			procedures: [initialActionProc, invalidRouterProcedure, evenProcedure, oddProcedure],
			state,
		});

		// Executar o agente
		const result = await agent.run({ number: 42 });

		// Verificar que o fluxo continuou após o router retornar um nome inexistente
		// Mas como currentProcedure fica null, o loop deve parar
		expect(initialActionProc.run).toHaveBeenCalled();
		expect(invalidRouterProcedure.run).toHaveBeenCalled();
		expect(evenProcedure.run).not.toHaveBeenCalled();
		expect(oddProcedure.run).not.toHaveBeenCalled();
		expect(result.description).toBe("Valor inicial");
	});

	it("should handle action procedures with explicit nextProcedure", async () => {
		// Criar procedimentos com nextProcedure explícito (não sequencial)
		const firstProc: ActionProcedure<any> = {
			name: "first",
			nextProcedure: "third", // Pula o segundo intencionalmente
			run: vi.fn().mockImplementation(async state => {
				state.output.isEven = true;
				return state;
			}),
			type: "action",
		};

		const secondProc: ActionProcedure<any> = {
			name: "second",
			run: vi.fn().mockImplementation(async state => {
				state.output.description = "Este procedimento não deve ser executado";
				return state;
			}),
			type: "action",
		};

		const thirdProc: ActionProcedure<any> = {
			name: "third",
			nextProcedure: END,
			run: vi.fn().mockImplementation(async state => {
				state.output.description = "Executou o terceiro procedimento";
				return state;
			}),
			type: "action",
		};

		const state = new State({ inputSchema, outputSchema });
		const agent = new Agent({
			llm: mockLLM,
			procedures: [firstProc, secondProc, thirdProc],
			state,
		});

		// Executar o agente
		const result = await agent.run({ number: 42 });

		// Verificar que o segundo procedimento foi pulado
		expect(firstProc.run).toHaveBeenCalled();
		expect(secondProc.run).not.toHaveBeenCalled();
		expect(thirdProc.run).toHaveBeenCalled();
		expect(result.description).toBe("Executou o terceiro procedimento");
	});

	it("should move to the next procedure in sequence when an action procedure doesn't specify nextProcedure", async () => {
		// Criar procedimentos sequenciais sem nextProcedure
		const seq1: ActionProcedure<any> = {
			name: "seq1",
			run: vi.fn().mockImplementation(async state => {
				state.output.isEven = true;
				return state;
			}),
			type: "action",
		};

		const seq2: ActionProcedure<any> = {
			name: "seq2",
			run: vi.fn().mockImplementation(async state => {
				state.output.description = "Executou em sequência";
				return state;
			}),
			type: "action",
		};

		const state = new State({ inputSchema, outputSchema });
		const agent = new Agent({
			llm: mockLLM,
			procedures: [seq1, seq2],
			state,
		});

		// Executar o agente
		const result = await agent.run({ number: 42 });

		// Verificar que ambos os procedimentos foram executados em sequência
		expect(seq1.run).toHaveBeenCalled();
		expect(seq2.run).toHaveBeenCalled();
		expect(result.description).toBe("Executou em sequência");
	});

	// === TESTES PARA A FEATURE DE MÚLTIPLOS LLMS ===

	it("should support multiple LLMs mapped by name", async () => {
		// Mock de múltiplos LLMs
		const mockLLMs = {
			default: {
				invoke: vi.fn().mockResolvedValue("Resposta do LLM default"),
				pipe: vi.fn().mockReturnThis(),
				withStructuredOutput: vi.fn().mockReturnThis(),
			} as unknown as ChatOpenAI,
			summarizer: {
				invoke: vi.fn().mockResolvedValue("Resposta do LLM summarizer"),
				pipe: vi.fn().mockReturnThis(),
				withStructuredOutput: vi.fn().mockReturnThis(),
			} as unknown as ChatOpenAI,
		};

		// Criar procedures que usam LLMs específicos
		const defaultLLMProc: ActionProcedure<any, typeof mockLLMs> = {
			name: "defaultLLMProc",
			nextProcedure: "summarizerProc",
			run: vi.fn().mockImplementation(async (state, llms) => {
				// Usa o LLM default
				await llms.default.invoke("Usando o LLM default");
				state.output.isEven = state.input.number % 2 === 0;
				return state;
			}),
			type: "action",
		};

		const summarizerLLMProc: ActionProcedure<any, typeof mockLLMs> = {
			name: "summarizerProc",
			run: vi.fn().mockImplementation(async (state, llms) => {
				// Usa o LLM summarizer
				await llms.summarizer.invoke("Usando o LLM summarizer");
				state.output.description = `O número ${state.input.number} ${state.output.isEven ? "é par" : "é ímpar"}.`;
				return state;
			}),
			type: "action",
		};

		const state = new State({ inputSchema, outputSchema });
		const agent = new Agent({
			llm: mockLLMs,
			procedures: [defaultLLMProc, summarizerLLMProc],
			state,
		});

		// Executar o agente
		const result = await agent.run({ number: 42 });

		// Verificar que a execução foi bem-sucedida
		expect(result.isEven).toBe(true);
		expect(result.description).toBe("O número 42 é par.");

		// Verificar que cada LLM foi chamado corretamente
		expect(mockLLMs.default.invoke).toHaveBeenCalledWith("Usando o LLM default");
		expect(mockLLMs.summarizer.invoke).toHaveBeenCalledWith("Usando o LLM summarizer");
		expect(defaultLLMProc.run).toHaveBeenCalledWith(expect.anything(), mockLLMs);
		expect(summarizerLLMProc.run).toHaveBeenCalledWith(expect.anything(), mockLLMs);
	});

	it("should support CheckProcedure with multiple LLMs", async () => {
		// Mock de múltiplos LLMs
		const mockLLMs = {
			default: {
				invoke: vi.fn().mockResolvedValue("Resposta do LLM default"),
				pipe: vi.fn().mockReturnThis(),
				withStructuredOutput: vi.fn().mockReturnThis(),
			} as unknown as ChatOpenAI,
			router: {
				invoke: vi.fn().mockResolvedValue("Resposta do LLM router"),
				pipe: vi.fn().mockReturnThis(),
				withStructuredOutput: vi.fn().mockReturnThis(),
			} as unknown as ChatOpenAI,
		};

		// Criar actions e check procedures que usam LLMs específicos
		const setupProc: ActionProcedure<any, typeof mockLLMs> = {
			name: "setup",
			nextProcedure: "smartRouter",
			run: vi.fn().mockImplementation(async (state, llms) => {
				await llms.default.invoke("Configurando o estado");
				state.output.isEven = state.input.number % 2 === 0;
				return state;
			}),
			type: "action",
		};

		const routerProc: CheckProcedure<any, typeof mockLLMs> = {
			name: "smartRouter",
			run: vi.fn().mockImplementation(async (state, llms) => {
				// Usa o LLM específico de routing
				await llms.router.invoke("Decidindo próximo procedimento");
				return state.output.isEven ? "evenHandler" : "oddHandler";
			}),
			type: "check",
		};

		const evenHandler: ActionProcedure<any, typeof mockLLMs> = {
			name: "evenHandler",
			nextProcedure: END,
			run: vi.fn().mockImplementation(async (state, llms) => {
				await llms.default.invoke("Processando número par");
				state.output.description = `O número ${state.input.number} é par (determinado por LLMs).`;
				return state;
			}),
			type: "action",
		};

		const oddHandler: ActionProcedure<any, typeof mockLLMs> = {
			name: "oddHandler",
			nextProcedure: END,
			run: vi.fn().mockImplementation(async (state, llms) => {
				await llms.default.invoke("Processando número ímpar");
				state.output.description = `O número ${state.input.number} é ímpar (determinado por LLMs).`;
				return state;
			}),
			type: "action",
		};

		const state = new State({ inputSchema, outputSchema });
		const agent = new Agent({
			llm: mockLLMs,
			procedures: [setupProc, routerProc, evenHandler, oddHandler],
			state,
		});

		// Teste com número par
		const resultEven = await agent.run({ number: 42 });
		expect(resultEven.isEven).toBe(true);
		expect(resultEven.description).toBe("O número 42 é par (determinado por LLMs).");

		// Verificar que os LLMs corretos foram chamados
		expect(mockLLMs.default.invoke).toHaveBeenCalledWith("Configurando o estado");
		expect(mockLLMs.router.invoke).toHaveBeenCalledWith("Decidindo próximo procedimento");
		expect(mockLLMs.default.invoke).toHaveBeenCalledWith("Processando número par");

		// Reset mocks
		vi.clearAllMocks();

		// Teste com número ímpar
		const resultOdd = await agent.run({ number: 43 });
		expect(resultOdd.isEven).toBe(false);
		expect(resultOdd.description).toBe("O número 43 é ímpar (determinado por LLMs).");

		// Verificar que os LLMs corretos foram chamados
		expect(mockLLMs.default.invoke).toHaveBeenCalledWith("Configurando o estado");
		expect(mockLLMs.router.invoke).toHaveBeenCalledWith("Decidindo próximo procedimento");
		expect(mockLLMs.default.invoke).toHaveBeenCalledWith("Processando número ímpar");
	});

	it("should support mixing single LLM and multiple LLMs in different parts of the codebase", async () => {
		// Podemos verificar se nossos tipos são compatíveis testando com um único LLM
		// mas tipando as procedures para suportar múltiplos LLMs

		// Criar uma procedure tipada para aceitar o mesmo tipo do mockLLM
		const flexibleProc: ActionProcedure<any, typeof mockLLM> = {
			name: "flexibleProc",
			run: vi.fn().mockImplementation(async (state, llm) => {
				// Se for um único LLM, deve ser passado diretamente
				await llm.invoke("Teste de compatibilidade");
				state.output.isEven = state.input.number % 2 === 0;
				state.output.description = "Procedure flexível executada";
				return state;
			}),
			type: "action",
		};

		const state = new State({ inputSchema, outputSchema });
		const agent = new Agent({
			// Passar um único LLM mesmo quando a procedure espera múltiplos
			llm: mockLLM,
			procedures: [flexibleProc],
			state,
		});

		// Executar o agente
		const result = await agent.run({ number: 42 });

		// Verificar que o agente funcionou corretamente
		expect(result.isEven).toBe(true);
		expect(result.description).toBe("Procedure flexível executada");
		expect(mockLLM.invoke).toHaveBeenCalledWith("Teste de compatibilidade");
	});

	it("should provide graph access with multiple LLMs", async () => {
		// Mock de múltiplos LLMs
		const mockLLMs = {
			auxiliary: { ...mockLLM } as unknown as ChatOpenAI,
			default: mockLLM,
		};

		const state = new State({ inputSchema, outputSchema });
		const agent = new Agent({
			llm: mockLLMs,
			procedures: [
				{
					name: "proc1",
					run: async state => state,
					type: "action",
				},
			],
			state,
		});

		// Verificar que o grafo é criado mesmo com múltiplos LLMs
		expect(agent.graph).toBeDefined();
	});
});
