import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AppError, asyncHandler, errorHandler } from "../src/middlewares/error-handler";
import type { Request, Response, NextFunction } from "express";

describe("Error Handler Middleware", () => {
  describe("AppError", () => {
    it("should set properties correctly", () => {
      const error = new AppError(404, "Not Found");
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("Not Found");
      expect(error.name).toBe("AppError");
    });
  });

  describe("asyncHandler", () => {
    it("should call the route handler", async () => {
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;
      
      let called = false;
      const handler = async () => { called = true; };
      
      const wrapped = asyncHandler(handler);
      await wrapped(req, res, next);
      
      expect(called).toBe(true);
      expect(next).not.toHaveBeenCalled();
    });

    it("should catch errors and pass them to next()", async () => {
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn() as NextFunction;
      
      const error = new Error("Test error");
      const handler = async () => { throw error; };
      
      const wrapped = asyncHandler(handler);
      await wrapped(req, res, next);
      
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("errorHandler", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let originalEnv: string;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      mockNext = vi.fn();
      originalEnv = process.env["NODE_ENV"] || "development";
      // mock console.error to keep test output clean
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      process.env["NODE_ENV"] = originalEnv;
      vi.restoreAllMocks();
    });

    it("should handle AppError correctly", () => {
      const error = new AppError(403, "Forbidden Action");
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Forbidden Action" });
    });

    it("should handle generic Errors and include stack in development", () => {
      process.env["NODE_ENV"] = "development";
      const error = new Error("Database connection failed");
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: "Database connection failed",
        stack: error.stack
      });
    });

    it("should handle generic Errors and hide stack in production", () => {
      process.env["NODE_ENV"] = "production";
      const error = new Error("Database connection failed");
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ 
        error: "Internal server error"
      });
      // Should not contain stack
      const callArgs = (mockRes.json as any).mock.calls[0][0];
      expect(callArgs.stack).toBeUndefined();
    });
  });
});
