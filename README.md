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
    - [Exemplos](#exemplos)
        - [Exemplo 1: CheckProcedure customizando a ordem de execução](#exemplo-1-checkprocedure-customizando-a-ordem-de-execução)
        - [Exemplo 2: Fluxo sequencial **sem** `CheckProcedure` e **sem** `nextProcedure`](#exemplo-2-fluxo-sequencial-sem-checkprocedure-e-sem-nextprocedure)
        - [Exemplo 3: Fluxo personalizado com `nextProcedure`](#exemplo-3-fluxo-personalizado-com-nextprocedure)

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
    - Cada **action** pode chamar diferentes instâncias de `BaseChatModel`, tornando o fluxo totalmente flexível.

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

**Happy Coding!**

> **Nota**: Exemplos e instruções podem variar de acordo com a versão utilizada do Parsero, LangChain e LangGraph. Consulte sempre a documentação oficial para detalhes de configuração e versões compatíveis.
