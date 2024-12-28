import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { StateValuesFormat } from "./state";

export interface ActionProcedure<StateValues extends StateValuesFormat> {
	name: string;
	type: "action";

	run(state: StateValues, llm: BaseChatModel): Promise<StateValues>;
}

export interface CheckProcedure<StateValues extends StateValuesFormat> {
	name: string;
	type: "check";

	run(state: StateValues, llm: BaseChatModel): Promise<string>;
}

export type Procedure<StateValues extends StateValuesFormat> =
	| ActionProcedure<StateValues>
	| CheckProcedure<StateValues>;
