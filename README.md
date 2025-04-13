# Parsero

> Uma biblioteca **simples** e **fortemente tipada** para criar agentes de IA com [LangChain](https://js.langchain.com/docs/) e [LangGraph](https://langchain-ai.github.io/langgraphjs/).  
> Inspirada no [CrewAI](https://docs.crewai.com/introduction) e criada para ser mais **descritiva** e **direta**, com padrões bem-definidos para a criação de agentes reutilizáveis.

## Sumário

- [Parsero](#parsero)
    - [Sumário](#sumário)
    - [Objetivo](#objetivo)
    - [Características Principais](#características-principais)
    - [Compatibilidade](#compatibilidade)
    - [Casos de Uso](#casos-de-uso)
    - [Utilizando Múltiplos LLMs](#utilizando-múltiplos-llms)
        - [Como Funciona](#como-funciona)
        - [Integração com LangGraph](#integração-com-langgraph)
        - [Tipagem para Múltiplos LLMs](#tipagem-para-múltiplos-llms)
    - [Reutilizando Procedures com InferState](#reutilizando-procedures-com-inferstate)
        - [Como Funciona](#como-funciona-1)
        - [Por que Usar](#por-que-usar)
        - [Exemplo Completo](#exemplo-completo)
    - [Exemplos](#exemplos)
        - [Exemplo 1: CheckProcedure customizando a ordem de execução](#exemplo-1-checkprocedure-customizando-a-ordem-de-execução)
        - [Exemplo 2: Fluxo sequencial **sem** `CheckProcedure` e **sem** `nextProcedure`](#exemplo-2-fluxo-sequencial-sem-checkprocedure-e-sem-nextprocedure)
        - [Exemplo 3: Fluxo personalizado com `nextProcedure`](#exemplo-3-fluxo-personalizado-com-nextprocedure)
        - [Exemplo 4: Utilizando múltiplos modelos para tarefas especializadas](#exemplo-4-utilizando-múltiplos-modelos-para-tarefas-especializadas)
        - [Exemplo 5: Combinando diferentes famílias de modelos](#exemplo-5-combinando-diferentes-famílias-de-modelos)

---

## Objetivo

O **Parsero** foi desenvolvido para **simplificar** a criação de agentes de IA utilizando [LangChain](https://js.langchain.com/docs/) e [LangGraph](https://langchain-ai.github.io/langgraphjs/). Ele oferece uma interface mais **intuitiva**, **fortemente tipada** e com **padrões claros**, permitindo:

- Facilitar a orquestração de **procedimentos** (Procedures) em agentes de IA.
- Reduzir a complexidade de criação de fluxos e decisões (grafos).
- Reaproveitar a lógica de agentes em diferentes projetos, graças às definições claras de entrada/saída.

---

## Características Principais

- **Forte Tipagem**: Usa [Zod](https://zod.dev/) para schemas de entrada/saída, garantindo segurança de tipos.
- **Simplicidade**: Os superpoderes do LangGraph mas com interface mais direta, seguindo padrões definidos (Procedures do tipo `action` e `check`).
- **Extensibilidade**: Compatível nativamente com LangChain e LangGraph, para que você possa aproveitar o ecossistema existente.
- **Orquestração por Procedimentos**: Define _procedures_ que podem modificar o estado (`action`) ou indicar o próximo passo (`check`).
- **Múltiplos LLMs**: Suporte para utilizar diferentes modelos de linguagem em diferentes procedures, otimizando custo e desempenho.
- **Organização Modular**: Permite definir procedures fora dos agentes com a utilidade `InferState`, facilitando a organização e reuso do código.

---

## Compatibilidade

- **LangChain**: Pode ser usado junto com qualquer [ChatModel](https://js.langchain.com/docs/modules/models/chat) disponível (por exemplo, `ChatOpenAI`, `ChatGoogleGenerativeAI`, etc.).
- **LangGraph**: Totalmente integrável ao LangGraph, para que você possa desenhar fluxos de conversação e lógicas mais complexas de maneira visual e tipada. A classe `Agent` fornece acesso ao seu equivalente em grafo.

---

## Casos de Uso

1. **Criação de Agentes de IA Customizados**

    - Defina **procedures** específicas para o seu caso.
    - **Aplique** validação de entrada e saída para garantir conformidade dos dados.

2. **Fluxos de Decisão com IA**

    - Utilize **CheckProcedure** para direcionar o fluxo conforme o conteúdo do estado.

3. **Aplicações com Entrada e Saída Bem Definidas**

    - Perfeito para pipelines de dados, chatbots especializados, ou qualquer agente que precise controlar o estado de forma clara.

4. **Orquestração de Múltiplos LLMs**
    - Cada **procedure** pode acessar diferentes instâncias de LLM, permitindo combinar modelos especializados.
    - Use modelos mais econômicos para tarefas simples e modelos avançados apenas para tarefas complexas.
    - Combine diferentes famílias de modelos (OpenAI, Anthropic, Google, etc.) no mesmo agente.

---

## Utilizando Múltiplos LLMs

O Parsero permite que você use diferentes modelos de linguagem para diferentes partes do seu agente, otimizando tanto o desempenho quanto os custos.

### Como Funciona

Ao criar seu agente, você pode fornecer um mapa de modelos em vez de um único modelo:

```ts
import { Agent, State } from "@cosmixclub/parsero";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

const agent = new Agent({
	// Outros parâmetros...
	llm: {
		default: new ChatOpenAI({ model: "gpt-4o" }), // Modelo principal
		summarize: new ChatGoogleGenerativeAI({ model: "gemini-pro" }), // Para resumos
		classify: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }), // Para classificações
		creative: new ChatAnthropic({ model: "claude-3-opus-20240229" }), // Para geração criativa
	},
	// ...
});
```

Dentro de suas procedures, você pode acessar o modelo específico que deseja utilizar:

```ts
// Em uma ActionProcedure
async run(state, llms) {
  // Use o modelo específico para tarefas de classificação
  const result = await llms.classify.invoke("Classifique este texto...");

  // Use o modelo específico para resumos
  const summary = await llms.summarize.invoke("Resuma este conteúdo...");

  // Use o modelo padrão
  const response = await llms.default.invoke("Responda esta pergunta...");

  // Continue seu código...
  return state;
}
```

### Integração com LangGraph

Ao utilizar `agent.graph` para acessar o grafo LangGraph equivalente, a biblioteca automaticamente:

1. **Usará o modelo "default"** se estiver disponível no objeto de LLMs
2. **Usará o primeiro modelo** do objeto se não houver um modelo chamado "default"

Esta abordagem garante compatibilidade com o LangGraph que atualmente espera um único modelo, mas ainda permite que você utilize múltiplos modelos dentro do seu agente Parsero.

```ts
const agent = new Agent({
	llm: {
		default: new ChatOpenAI(), // Este será usado no LangGraph
		specialTask: new ChatAnthropic(),
	},
	// ...
});

// O grafo usará o modelo "default" internamente
const graph = agent.graph;

// Execute o grafo
await graph.invoke({ input: "exemplo" });
```

### Tipagem para Múltiplos LLMs

Se você estiver usando TypeScript, pode tirar vantagem do sistema de tipos para garantir que suas procedures acessem apenas LLMs que realmente existem:

```ts
// Defina o tipo do seu mapa de LLMs
type MyLLMs = {
	default: ChatOpenAI;
	summarize: ChatGoogleGenerativeAI;
	classify: ChatOpenAI;
};

// Use o tipo genérico na sua procedure
const classifyProcedure: ActionProcedure<any, MyLLMs> = {
	name: "classify",
	type: "action",
	async run(state, llms) {
		// TypeScript sabe que llms.classify existe e é do tipo ChatOpenAI
		const result = await llms.classify.invoke("...");
		// ...
	},
};
```

---

## Reutilizando Procedures com InferState

O Parsero fornece a utilidade `InferState<>` que permite definir procedures de forma independente e reutilizável, separadas da definição do agente. Isso traz várias vantagens para a organização do código:

### Como Funciona

`InferState<>` é um tipo utilitário que extrai os tipos de entrada e saída de um `State`, facilitando a definição de procedures fora do contexto do agente:

```ts
import { z } from "zod";

import { Agent, InferState, Procedure, State } from "@cosmixclub/parsero";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

// 1. Defina seu State
const state = new State({
	inputSchema: z.object({
		query: z.string(),
	}),
	outputSchema: z.object({
		result: z.string(),
	}),
});

// 2. Crie procedures reutilizáveis com tipagem correta
const analyzeQuery: Procedure<InferState<typeof state>, BaseChatModel> = {
	name: "analyzeQuery",
	nextProcedure: "generateResponse",
	type: "action",
	async run(state, llm) {
		// Seu código aqui...
		return state;
	},
};

const generateResponse: Procedure<InferState<typeof state>, BaseChatModel> = {
	name: "generateResponse",
	type: "action",
	nextProcedure: END,
	async run(state, llm) {
		// Seu código aqui...
		return state;
	},
};

// 3. Use as procedures no agente
const agent = new Agent({
	state,
	llm: new ChatOpenAI(),
	procedures: [
		analyzeQuery,
		generateResponse,
		// Outras procedures...
	],
});
```

### Por que Usar

- **Organização de Código**: Separe a lógica em arquivos distintos para melhor manutenção.
- **Reusabilidade**: Reutilize procedures em diferentes agentes.
- **Testabilidade**: Teste procedures individualmente, facilitando os testes unitários.
- **Colaboração**: Permite que diferentes membros da equipe trabalhem em diferentes procedures.

### Exemplo Completo

Veja como organizar seu código com procedures em arquivos separados:

```ts
// state.ts
import { z } from "zod";
import { State } from "@cosmixclub/parsero";

export const numberClassifierState = new State({
    inputSchema: z.object({
        number: z.number(),
    }),
    outputSchema: z.object({
        class: z.enum(["odd", "even"]),
        explanation: z.string(),
    }),
});

// procedures/classify.ts
import { Procedure } from "@cosmixclub/parsero";
import { InferState } from "@cosmixclub/parsero";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod";
import { numberClassifierState } from "../state";

export const whatNumberIs: Procedure<InferState<typeof numberClassifierState>, BaseChatModel> = {
    name: "whatNumberIs",
    nextProcedure: "router",
    async run(state, llm) {
        const chain = llm.withStructuredOutput(
            z.object({
                class: z.enum(["odd", "even"]).describe("Se o número é par ou ímpar"),
            }),
        );
        const output = await chain.invoke(`Determine se o número a seguir é par ou ímpar: ${state.input.number}`);
        state.output.class = output.class;
        return state;
    },
    type: "action",
};

// procedures/router.ts
import { Procedure } from "@cosmixclub/parsero";
import { InferState } from "@cosmixclub/parsero";
import { numberClassifierState } from "../state";

export const router: Procedure<InferState<typeof numberClassifierState>, any> = {
    name: "router",
    async run(state) {
        const numberClass = state.output.class;
        if (numberClass === "odd") return "isOdd";
        return "isEven";
    },
    type: "check",
};

// agent.ts
import { Agent, END } from "@cosmixclub/parsero";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { numberClassifierState } from "./state";
import { whatNumberIs } from "./procedures/classify";
import { router } from "./procedures/router";

const agent = new Agent({
    state: numberClassifierState,
    llm: new ChatOpenAI(),
    procedures: [
        whatNumberIs,
        router,
        {
            name: "isOdd",
            nextProcedure: END,
            async run(state, llm) {
                const chain = llm.pipe(new StringOutputParser());
                const output = await chain.invoke(
                    `Gere uma explicação do motivo de '${state.input.number}' ser ímpar.`,
                );
                state.output.explanation = output;
                return state;
            },
            type: "action",
        },
        {
            name: "isEven",
            nextProcedure: END,
            async run(state, llm) {
                const chain = llm.pipe(new StringOutputParser());
                const output = await chain.invoke(`Gere uma explicação do motivo de '${state.input.number}' ser par.`);
                state.output.explanation = output;
                return state;
            },
            type: "action",
        },
    ],
});
```

Usando essa abordagem, seu código fica mais organizado, modular e fácil de manter, especialmente em projetos maiores com múltiplos agentes e procedures complexas.

---

## Exemplos

### Exemplo 1: CheckProcedure customizando a ordem de execução

No exemplo abaixo, o agente:

1. **Descobre** se o número é par ou ímpar (action).
2. **Verifica** o resultado e **decide** qual próximo passo a seguir (check).
3. **Executa** a procedure correspondente a par ou ímpar (action).

```ts
import { z } from "zod";

import { Agent, END, State } from "@cosmixclub/parsero";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";

// exemplificando, pois depende do seu setup

const agent = new Agent({
	state: new State({
		inputSchema: z.object({
			number: z.number(),
		}),
		outputSchema: z.object({
			class: z.enum(["odd", "even"]),
			explanation: z.string(),
		}),
	}),
	llm: new ChatOpenAI({
		model: "gpt-4o-mini",
		temperature: 0.1,
		maxTokens: 500,
		streaming: true,
		cache: true,
		apiKey: process.env.OPENAI_API_KEY,
	}),
	options: {
		verbose: true,
	},
	procedures: [
		{
			// 1. Procedure que classifica o número como par ou ímpar.
			name: "whatNumberIs",
			type: "action",
			nextProcedure: "router",
			async run(state, llm) {
				const chain = llm.withStructuredOutput(
					z.object({
						class: z.enum(["odd", "even"]).describe("Se o número é par ou ímpar"),
					}),
				);
				const output = await chain.invoke(
					`Determine se o número a seguir é par ou ímpar: ${state.input.number}`,
				);
				state.output.class = output.class;
				return state;
			},
		},
		{
			// 2. Procedure do tipo 'check' que decide qual caminho seguir
			name: "router",
			type: "check",
			async run(state) {
				const numberClass = state.output.class;
				if (numberClass === "odd") return "isOdd";
				return "isEven";
			},
		},
		{
			// 3a. Se for ímpar, chama esta procedure.
			name: "isOdd",
			type: "action",
			nextProcedure: END,
			async run(state, llm) {
				const chain = llm.pipe(new StringOutputParser());
				const output = await chain.invoke(
					`Gere uma explicação do motivo de '${state.input.number}' ser ímpar.`,
				);
				state.output.explanation = output;
				return state;
			},
		},
		{
			// 3b. Se for par, chama esta procedure.
			name: "isEven",
			type: "action",
			nextProcedure: END,
			async run(state, llm) {
				const chain = llm.pipe(new StringOutputParser());
				const output = await chain.invoke(`Gere uma explicação do motivo de '${state.input.number}' ser par.`);
				state.output.explanation = output;
				return state;
			},
		},
	],
});

// Execução:
const output = await agent.run({ number: 11 });
console.log(output);
// => { class: "odd", explanation: "Explicação sobre por que 11 é ímpar..." }
```

> Observe que uma `CheckProcedure` **não altera** o estado. Ela apenas **retorna** o nome da próxima procedure a ser executada.

---

### Exemplo 2: Fluxo sequencial **sem** `CheckProcedure` e **sem** `nextProcedure`

O exemplo abaixo mostra um fluxo **estritamente sequencial**, onde cada procedure de tipo `action` é executada na **ordem** em que foi definida. Assim que uma procedure termina, o agente avança para a próxima.

```ts
import { z } from "zod";

import { Agent, State } from "@cosmixclub/parsero";
import { ChatOpenAI } from "@langchain/openai";

const agent = new Agent({
	state: new State({
		inputSchema: z.object({
			text: z.string(),
		}),
		outputSchema: z.object({
			uppercase: z.string(),
			reversed: z.string(),
		}),
	}),
	llm: new ChatOpenAI({ model: "gpt-4", apiKey: "..." }),
	procedures: [
		{
			// 1. Procedure que converte o texto para maiúsculas.
			name: "toUpperCase",
			type: "action",
			async run(state) {
				state.output.uppercase = state.input.text.toUpperCase();
				return state;
			},
		},
		{
			// 2. Procedure que reverte o texto já convertido.
			name: "reverseText",
			type: "action",
			async run(state) {
				state.output.reversed = state.output.uppercase.split("").reverse().join("");
				return state;
			},
		},
	],
});

// Ao chamar `agent.run`, ele executa `toUpperCase` e depois `reverseText`.
const output = await agent.run({ text: "parsero" });
console.log(output);
// => { uppercase: "PARSERO", reversed: "ORESRAP" }
```

> Como não há `CheckProcedure` ou `nextProcedure`, o fluxo é linear, executando cada procedure na ordem em que foi definida na lista.

---

### Exemplo 3: Fluxo personalizado com `nextProcedure`

Caso você queira **controlar a ordem** entre procedures de modo mais explícito (sem `check`), basta utilizar a propriedade `nextProcedure` em uma `ActionProcedure`.

```ts
import { z } from "zod";

import { Agent, END, State } from "@cosmixclub/parsero";
import { ChatOpenAI } from "@langchain/openai";

const agent = new Agent({
	state: new State({
		inputSchema: z.object({
			text: z.string(),
		}),
		outputSchema: z.object({
			processed: z.string(),
			summary: z.string(),
		}),
	}),
	llm: new ChatOpenAI({ model: "gpt-4", apiKey: "..." }),
	procedures: [
		{
			// 1. Lê e processa a entrada, definindo `processed`.
			name: "processInput",
			type: "action",
			nextProcedure: "generateSummary",
			async run(state, llm) {
				// Suponha que faça algum processamento local:
				state.output.processed = `Processed: ${state.input.text}`;
				return state;
			},
		},
		{
			// 2. Gera um resumo do texto processado, definindo `summary`.
			name: "generateSummary",
			type: "action",
			nextProcedure: END,
			async run(state, llm) {
				const response = await llm.invoke(`Resuma o seguinte texto: "${state.output.processed}"`);
				state.output.summary = response;
				return state;
			},
		},
	],
});

const output = await agent.run({ text: "Esta é uma frase de teste" });
console.log(output);
// => { processed: "Processed: Esta é uma frase de teste", summary: "..." }
```

> A execução passa **explicitamente** de `"processInput"` para `"generateSummary"`. Em seguida, `"generateSummary"` define `nextProcedure: END` para indicar o fim.

---

### Exemplo 4: Utilizando múltiplos modelos para tarefas especializadas

Este exemplo mostra como utilizar diferentes modelos para diferentes partes do fluxo, otimizando o custo e especialização:

```ts
import { z } from "zod";

import { Agent, END, State } from "@cosmixclub/parsero";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

const agent = new Agent({
	state: new State({
		inputSchema: z.object({
			text: z.string(),
		}),
		outputSchema: z.object({
			classification: z.string(),
			summary: z.string(),
			response: z.string(),
		}),
	}),
	// Configuração de múltiplos modelos para diferentes funções
	llm: {
		// Modelo padrão para casos gerais
		default: new ChatOpenAI({ model: "gpt-4o" }),

		// Modelo especializado e econômico para classificação
		classify: new ChatOpenAI({
			model: "gpt-4o-mini",
			temperature: 0, // Temperatura baixa para classificação precisa
		}),

		// Modelo especializado em resumos
		summarize: new ChatGoogleGenerativeAI({
			model: "gemini-pro",
			temperature: 0.2,
		}),
	},
	procedures: [
		{
			name: "classifyContent",
			type: "action",
			nextProcedure: "summarizeContent",
			async run(state, llms) {
				// Usa o modelo econômico e especializado para classificação
				const response = await llms.classify.invoke(
					`Classifique o seguinte texto em uma categoria: "${state.input.text}"`,
				);
				state.output.classification = response.toString().trim();
				return state;
			},
		},
		{
			name: "summarizeContent",
			type: "action",
			nextProcedure: "generateFullResponse",
			async run(state, llms) {
				// Usa o modelo especializado em resumos
				const response = await llms.summarize.invoke(
					`Resuma o seguinte texto de maneira concisa: "${state.input.text}"`,
				);
				state.output.summary = response.toString().trim();
				return state;
			},
		},
		{
			name: "generateFullResponse",
			type: "action",
			nextProcedure: END,
			async run(state, llms) {
				// Usa o modelo principal (mais poderoso) para a resposta final
				const response = await llms.default.invoke(`
					Crie uma resposta detalhada para o texto a seguir, considerando que:
					- Ele foi classificado como: ${state.output.classification}
					- Um resumo conciso seria: ${state.output.summary}
					
					Texto original: "${state.input.text}"
					
					Sua resposta deve ser completa e considerar tanto a classificação quanto o resumo.
				`);
				state.output.response = response.toString().trim();
				return state;
			},
		},
	],
});

const output = await agent.run({ text: "Um texto longo para análise..." });
console.log(output);
// => {
//      classification: "Artigo científico",
//      summary: "Este texto aborda...",
//      response: "Análise detalhada considerando a classificação e o resumo..."
//    }
```

> Neste exemplo, cada procedure usa um modelo diferente otimizado para sua tarefa específica: classificação, resumo e geração de resposta completa.

---

### Exemplo 5: Combinando diferentes famílias de modelos

Este exemplo demonstra como combinar diferentes famílias de modelos de linguagem para aproveitar as vantagens de cada uma:

```ts
import { z } from "zod";

import { Agent, END, State } from "@cosmixclub/parsero";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

const agent = new Agent({
	state: new State({
		inputSchema: z.object({
			query: z.string(),
			context: z.string().optional(),
		}),
		outputSchema: z.object({
			queryType: z.enum(["factual", "creative", "technical"]),
			response: z.string(),
			sources: z.array(z.string()).optional(),
		}),
	}),
	llm: {
		// GPT-4o como modelo padrão
		default: new ChatOpenAI({
			model: "gpt-4o",
			temperature: 0.7,
		}),

		// Claude para consultas factuais e precisas
		factual: new ChatAnthropic({
			model: "claude-3-opus-20240229",
			temperature: 0.1,
		}),

		// Gemini para geração de conteúdo criativo
		creative: new ChatGoogleGenerativeAI({
			model: "gemini-pro",
			temperature: 1.0,
		}),

		// Modelo econômico para roteamento
		router: new ChatOpenAI({
			model: "gpt-4o-mini",
			temperature: 0,
		}),
	},
	procedures: [
		// Primeiro determina o tipo de consulta
		{
			name: "analyzeQuery",
			type: "action",
			nextProcedure: "routeQuery",
			async run(state, llms) {
				// Usa o modelo mais econômico para classificação
				const result = await llms.router.withStructuredOutput(
					z.object({
						queryType: z
							.enum(["factual", "creative", "technical"])
							.describe("O tipo de consulta baseado na natureza da pergunta"),
						explanation: z.string().describe("Explicação rápida sobre porque essa categoria foi escolhida"),
					}),
				).invoke(`
          Classifique a seguinte consulta em uma das categorias:
          - factual: Busca por informações factuais, precisas e verificáveis
          - creative: Busca por conteúdo criativo, ideias, ou explorações conceituais
          - technical: Busca por explicações técnicas ou soluções para problemas

          Consulta: "${state.input.query}"
        `);

				state.output.queryType = result.queryType;
				return state;
			},
		},

		// Router decide qual modelo usar com base no tipo de consulta
		{
			name: "routeQuery",
			type: "check",
			async run(state, llms) {
				// Lógica de roteamento baseada no tipo de consulta
				switch (state.output.queryType) {
					case "factual":
						return "processFact";
					case "creative":
						return "generateCreative";
					case "technical":
					default:
						return "handleTechnical";
				}
			},
		},

		// Processa consultas factuais com Claude (alta precisão)
		{
			name: "processFact",
			type: "action",
			nextProcedure: END,
			async run(state, llms) {
				const response = await llms.factual.invoke(`
          Responda a seguinte consulta factual com alta precisão.
          Forneça fontes ou referências quando possível.
          
          Consulta: ${state.input.query}
          ${state.input.context ? `Contexto adicional: ${state.input.context}` : ""}
        `);

				state.output.response = response.toString();
				// Em um caso real, você poderia extrair fontes usando structured output
				state.output.sources = ["Conhecimento integrado do Claude"];
				return state;
			},
		},

		// Gera conteúdo criativo com Gemini
		{
			name: "generateCreative",
			type: "action",
			nextProcedure: END,
			async run(state, llms) {
				const response = await llms.creative.invoke(`
          Crie uma resposta criativa e inspiradora para:
          
          ${state.input.query}
          ${state.input.context ? `Considerando este contexto: ${state.input.context}` : ""}
          
          Seja original, imaginativo e expressivo em sua resposta.
        `);

				state.output.response = response.toString();
				return state;
			},
		},

		// Processa consultas técnicas com o modelo padrão (GPT-4o)
		{
			name: "handleTechnical",
			type: "action",
			nextProcedure: END,
			async run(state, llms) {
				const response = await llms.default.invoke(`
          Forneça uma resposta técnica detalhada e precisa para:
          
          ${state.input.query}
          ${state.input.context ? `Contexto adicional: ${state.input.context}` : ""}
          
          Inclua exemplos práticos quando relevante.
        `);

				state.output.response = response.toString();
				return state;
			},
		},
	],
});

// Teste com diferentes tipos de consultas
const factualResult = await agent.run({
	query: "Qual é a distância média da Terra ao Sol?",
});
// Usará o Claude para esta consulta factual

const creativeResult = await agent.run({
	query: "Escreva um poema sobre inteligência artificial e a natureza humana.",
});
// Usará o Gemini para esta consulta criativa

const technicalResult = await agent.run({
	query: "Como implementar uma árvore binária de busca em JavaScript?",
});
// Usará o GPT-4o para esta consulta técnica
```

> Este exemplo mostra um agente sofisticado que roteia consultas para diferentes modelos com base no tipo de pergunta, utilizando os pontos fortes de cada modelo.

---

**Happy Coding!**

> **Nota**: Exemplos e instruções podem variar de acordo com a versão utilizada do Parsero, LangChain e LangGraph. Consulte sempre a documentação oficial para detalhes de configuração e versões compatíveis.
