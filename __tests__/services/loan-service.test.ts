import { vi, describe, it, expect, beforeEach } from "vitest";
import { createLoan, returnLoan, renewLoan, isOverdue } from "@/services/loan-service";
import { prisma } from "@/lib/prisma";
import { BookStatus, LoanStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    book: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    loan: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    settings: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

describe("Loan Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isOverdue", () => {
    it("should return true if due date is in the past and book is not returned", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(isOverdue(pastDate, null)).toBe(true);
    });

    it("should return false if due date is in the past but book is returned", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const returnedDate = new Date();
      expect(isOverdue(pastDate, returnedDate)).toBe(false);
    });

    it("should return false if due date is in the future", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(isOverdue(futureDate, null)).toBe(false);
    });
  });

  describe("createLoan", () => {
    it("should create a loan when book is available and user exists", async () => {
      const mockBook = { id: "book1", status: BookStatus.AVAILABLE, title: "Test Book" };
      const mockUser = { id: "user1", firstName: "Test", lastName: "User" };
      const mockSettings = { defaultLoanDays: 21, maxRenewals: 2 };

      vi.spyOn(prisma.book, "findUnique").mockResolvedValue(mockBook as any);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);
      vi.spyOn(prisma.loan, "findFirst").mockResolvedValue(null);
      vi.spyOn(prisma.settings, "findUnique").mockResolvedValue(mockSettings as any);
      
      const mockCreatedLoan = { id: "loan1", bookId: "book1", userId: "user1" };
      vi.spyOn(prisma.loan, "create").mockResolvedValue(mockCreatedLoan as any);
      vi.spyOn(prisma.book, "update").mockResolvedValue({} as any);

      const result = await createLoan("book1", "user1");

      expect(result).toEqual(mockCreatedLoan);
      expect(prisma.loan.create).toHaveBeenCalled();
      expect(prisma.book.update).toHaveBeenCalledWith({
        where: { id: "book1" },
        data: { status: BookStatus.LOANED },
      });
    });

    it("should throw an error if book is not available", async () => {
      const mockBook = { id: "book1", status: BookStatus.LOANED, title: "Test Book" };
      vi.spyOn(prisma.book, "findUnique").mockResolvedValue(mockBook as any);

      await expect(createLoan("book1", "user1")).rejects.toThrow("Buch ist nicht verfügbar");
    });
  });

  describe("returnLoan", () => {
    it("should return loan and make book available", async () => {
      const mockLoan = { id: "loan1", bookId: "book1", status: LoanStatus.ACTIVE };
      vi.spyOn(prisma.loan, "findUnique").mockResolvedValue(mockLoan as any);
      
      const mockReturnedLoan = { id: "loan1", status: LoanStatus.RETURNED };
      vi.spyOn(prisma.loan, "update").mockResolvedValue(mockReturnedLoan as any);
      vi.spyOn(prisma.book, "update").mockResolvedValue({} as any);

      const result = await returnLoan("loan1");

      expect(result).toEqual(mockReturnedLoan);
      expect(prisma.book.update).toHaveBeenCalledWith({
        where: { id: "book1" },
        data: { status: BookStatus.AVAILABLE },
      });
    });
  });

  describe("renewLoan", () => {
    it("should extend loan if renewal count is below limit", async () => {
      const mockLoan = {
        id: "loan1",
        bookId: "book1",
        status: LoanStatus.ACTIVE,
        renewalCount: 0,
        dueDate: new Date(),
      };
      const mockSettings = { defaultLoanDays: 21, maxRenewals: 2 };

      vi.spyOn(prisma.loan, "findUnique").mockResolvedValue(mockLoan as any);
      vi.spyOn(prisma.settings, "findUnique").mockResolvedValue(mockSettings as any);
      
      const mockRenewedLoan = { id: "loan1", renewalCount: 1 };
      vi.spyOn(prisma.loan, "update").mockResolvedValue(mockRenewedLoan as any);

      const result = await renewLoan("loan1");

      expect(result.renewalCount).toBe(1);
      expect(prisma.loan.update).toHaveBeenCalled();
    });

    it("should throw error if renewal count limit is reached", async () => {
      const mockLoan = {
        id: "loan1",
        bookId: "book1",
        status: LoanStatus.ACTIVE,
        renewalCount: 2,
        dueDate: new Date(),
      };
      const mockSettings = { defaultLoanDays: 21, maxRenewals: 2 };

      vi.spyOn(prisma.loan, "findUnique").mockResolvedValue(mockLoan as any);
      vi.spyOn(prisma.settings, "findUnique").mockResolvedValue(mockSettings as any);

      await expect(renewLoan("loan1")).rejects.toThrow("Maximale Anzahl an Verlängerungen");
    });
  });
});
