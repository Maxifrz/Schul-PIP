import { vi, describe, it, expect, beforeEach } from "vitest";
import { createBook, updateBook, deleteBook } from "@/services/book-service";
import { prisma } from "@/lib/prisma";
import { BookStatus } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    book: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    loan: {
      count: vi.fn(),
    },
  },
}));

describe("Book Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBook", () => {
    it("should create a book with default available status", async () => {
      const mockInput = {
        title: "Harry Potter",
        author: "J.K. Rowling",
        inventoryCode: "BIB-001",
      };

      const mockCreatedBook = {
        id: "book1",
        ...mockInput,
        status: BookStatus.AVAILABLE,
      };

      vi.spyOn(prisma.book, "create").mockResolvedValue(mockCreatedBook as any);

      const result = await createBook(mockInput as any);

      expect(result).toEqual(mockCreatedBook);
      expect(prisma.book.create).toHaveBeenCalledWith({
        data: {
          isbn: null,
          title: mockInput.title,
          author: mockInput.author,
          publisher: null,
          coverUrl: null,
          description: null,
          inventoryCode: mockInput.inventoryCode,
          location: null,
          status: BookStatus.AVAILABLE,
        },
      });
    });
  });

  describe("deleteBook", () => {
    it("should delete a book if it has no active loans", async () => {
      vi.spyOn(prisma.loan, "count").mockResolvedValue(0);
      vi.spyOn(prisma.book, "delete").mockResolvedValue({ id: "book1" } as any);

      const result = await deleteBook("book1");

      expect(result).toEqual({ id: "book1" });
      expect(prisma.book.delete).toHaveBeenCalledWith({
        where: { id: "book1" },
      });
    });

    it("should throw an error if the book has active loans", async () => {
      vi.spyOn(prisma.loan, "count").mockResolvedValue(1);

      await expect(deleteBook("book1")).rejects.toThrow("Buch hat noch aktive Ausleihen");
      expect(prisma.book.delete).not.toHaveBeenCalled();
    });
  });
});
