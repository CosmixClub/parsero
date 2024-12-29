import { ParseroError } from ".";

export class ProcedureNameError extends ParseroError {
	constructor(
		message: string,
		readonly names?: string[],
	) {
		super(message);
	}
}
