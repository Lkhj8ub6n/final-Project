import { describe, it, expect } from "vitest";
import { hashPasswordAsync, comparePassword, isLegacyHash, generateToken, parseToken } from "../src/lib/auth";

describe("Authentication Utilities", () => {
  describe("Password Hashing (bcrypt)", () => {
    it("should hash a password using bcrypt format", async () => {
      const password = "mysecretpassword";
      const hash = await hashPasswordAsync(password);
      
      expect(hash).not.toBe(password);
      expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
    });

    it("should verify a correct password", async () => {
      const password = "mysecretpassword";
      const hash = await hashPasswordAsync(password);
      
      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject an incorrect password", async () => {
      const password = "mysecretpassword";
      const hash = await hashPasswordAsync(password);
      
      const isValid = await comparePassword("wrongpassword", hash);
      expect(isValid).toBe(false);
    });
  });

  describe("Legacy SHA-256 Support", () => {
    it("should identify a legacy hash", () => {
      // SHA-256 hex string example
      const legacy = "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";
      expect(isLegacyHash(legacy)).toBe(true);
    });

    it("should verify a valid legacy SHA-256 hash", async () => {
      const crypto = await import("crypto");
      const password = "legacy_password";
      const LEGACY_SALT = "libraryos_salt"; // from auth.ts
      
      const legacyHash = crypto.createHash("sha256").update(password + LEGACY_SALT).digest("hex");
      
      const isValid = await comparePassword(password, legacyHash);
      expect(isValid).toBe(true);
    });
    
    it("should reject an invalid legacy SHA-256 hash", async () => {
      const legacyHash = "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";
      const isValid = await comparePassword("wrong_password", legacyHash);
      expect(isValid).toBe(false);
    });
  });

  describe("JWT Tokens", () => {
    it("should generate and parse a valid token", () => {
      const userId = 1;
      const role = "super_admin";
      const tenantId = 5;
      
      const token = generateToken(userId, role, tenantId);
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT format header.payload.signature
      
      const parsed = parseToken(token);
      expect(parsed).not.toBeNull();
      expect(parsed?.userId).toBe(userId);
      expect(parsed?.role).toBe(role);
      expect(parsed?.tenantId).toBe(tenantId);
    });

    it("should return null for an invalid token", () => {
      const parsed = parseToken("invalid.token.here");
      expect(parsed).toBeNull();
    });
    
    it("should generate token with null tenant for super admin", () => {
      const token = generateToken(1, "super_admin");
      const parsed = parseToken(token);
      expect(parsed?.tenantId).toBeNull();
    });
  });
});
