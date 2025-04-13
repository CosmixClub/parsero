import { ParseroError } from ".";

export class ProcedureNameError extends ParseroError {
	constructor(
		message: string,
		readonly names: string[] = [],
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}
