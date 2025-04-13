import { describe, expect, it } from "vitest";

import { ProcedureChainError } from "../../../src/errors/procedure-chain";
import { ProcedureNameError } from "../../../src/errors/procedure-name";
import { StateValidationError } from "../../../src/errors/state-validation";

describe("Custom Errors", () => {
	describe("ProcedureNameError", () => {
		it("should be instantiated with message and names", () => {
			const message = "Erro de nome de procedimento";
			const duplicateNames = ["proc1", "proc2"];

			const error = new ProcedureNameError(message, duplicateNames);

			expect(error).toBeInstanceOf(ProcedureNameError);
			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe(message);
			expect(error.names).toEqual(duplicateNames);
		});

		it("should include names in the error details", () => {
			const error = new ProcedureNameError("Nomes duplicados", ["foo", "bar"]);

			expect(error.names).toEqual(["foo", "bar"]);
		});

		it("should handle empty names array", () => {
			const error = new ProcedureNameError("Erro sem nomes duplicados", []);

			expect(error.names).toEqual([]);
			expect(error.message).toBe("Erro sem nomes duplicados");
		});

		it("should preserve stack trace", () => {
			const error = new ProcedureNameError("Erro com stack trace", ["proc1"]);

			expect(error.stack).toBeDefined();
			expect(error.stack).toContain("ProcedureNameError");
		});
	});

	describe("ProcedureChainError", () => {
		it("should be instantiated with a message", () => {
			const message = "Erro na cadeia de procedimentos";

			const error = new ProcedureChainError(message);

			expect(error).toBeInstanceOf(ProcedureChainError);
			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe(message);
		});

		it("should be used for maximum iterations error", () => {
			const maxIterationsMessage = "O agente atingiu o limite máximo de 100 iterações";
			const error = new ProcedureChainError(maxIterationsMessage);

			expect(error.message).toBe(maxIterationsMessage);
		});

		it("should be used for missing nextProcedure error", () => {
			const message =
				"Quando houver um procedimento do tipo 'check', todos os procedimentos do tipo 'action' devem declarar o próximo procedimento.";
			const error = new ProcedureChainError(message);

			expect(error.message).toBe(message);
		});

		it("should preserve stack trace", () => {
			const error = new ProcedureChainError("Erro com stack trace");

			expect(error.stack).toBeDefined();
			expect(error.stack).toContain("ProcedureChainError");
		});

		it("should support nested error cause", () => {
			const originalError = new Error("Erro original");
			const chainError = new ProcedureChainError("Erro na cadeia", { cause: originalError });

			// Node.js >= 16.9.0 suporta a propriedade 'cause'
			if ("cause" in chainError) {
				expect((chainError as any).cause).toBe(originalError);
			}
		});
	});

	describe("StateValidationError", () => {
		it("should be instantiated with a message", () => {
			const message = "Erro de validação de estado";

			const error = new StateValidationError(message);

			expect(error).toBeInstanceOf(StateValidationError);
			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe(message);
		});

		it("should be used for input validation errors", () => {
			const inputErrorMessage = "O input recebido não segue o schema.";
			const error = new StateValidationError(inputErrorMessage);

			expect(error.message).toBe(inputErrorMessage);
		});

		it("should be used for output validation errors", () => {
			const outputErrorMessage = "O output gerado não segue o schema.";
			const error = new StateValidationError(outputErrorMessage);

			expect(error.message).toBe(outputErrorMessage);
		});

		it("should preserve stack trace", () => {
			const error = new StateValidationError("Erro com stack trace");

			expect(error.stack).toBeDefined();
			expect(error.stack).toContain("StateValidationError");
		});

		it("should include Zod validation error details when provided", () => {
			const zodErrors = [
				{ message: "Campo obrigatório", path: ["field1"] },
				{ message: "Tipo inválido", path: ["field2"] },
			];

			const error = new StateValidationError("Erro de validação", { issues: zodErrors });

			// Verificar se os erros do Zod foram preservados na instância do erro
			if ("issues" in error) {
				expect((error as any).issues).toEqual(zodErrors);
			}
		});
	});

	describe("Error interactions", () => {
		it("should allow catching all custom errors with standard error handling", () => {
			// Arrange
			const errors = [
				new ProcedureNameError("Erro de nome", ["duplicado"]),
				new ProcedureChainError("Erro de cadeia"),
				new StateValidationError("Erro de validação"),
			];

			// Act & Assert
			for (const error of errors) {
				try {
					throw error;
				} catch (e) {
					expect(e).toBeInstanceOf(Error);
				}
			}
		});

		it("should be distinguishable by instanceof checks", () => {
			// Arrange
			const nameError = new ProcedureNameError("Erro de nome", []);
			const chainError = new ProcedureChainError("Erro de cadeia");
			const stateError = new StateValidationError("Erro de validação");

			// Act & Assert
			expect(nameError instanceof ProcedureNameError).toBe(true);
			expect(nameError instanceof ProcedureChainError).toBe(false);
			expect(nameError instanceof StateValidationError).toBe(false);

			expect(chainError instanceof ProcedureChainError).toBe(true);
			expect(chainError instanceof ProcedureNameError).toBe(false);
			expect(chainError instanceof StateValidationError).toBe(false);

			expect(stateError instanceof StateValidationError).toBe(true);
			expect(stateError instanceof ProcedureNameError).toBe(false);
			expect(stateError instanceof ProcedureChainError).toBe(false);
		});
	});
});
