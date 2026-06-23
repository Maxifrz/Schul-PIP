import { PrismaClient, UserRole, BookStatus, LoanStatus } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data (in correct order due to foreign keys)
  await prisma.loan.deleteMany();
  await prisma.book.deleteMany();
  await prisma.user.deleteMany();
  await prisma.settings.deleteMany();

  // Create default settings
  const settings = await prisma.settings.create({
    data: {
      id: "singleton",
      defaultLoanDays: 21,
      maxRenewals: 2,
    },
  });
  console.log("✅ Settings created");

  // Create users
  const passwordHash = hashSync("password123", 10);

  const admin = await prisma.user.create({
    data: {
      firstName: "Anna",
      lastName: "Schmidt",
      email: "admin@schulbib.de",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const librarian = await prisma.user.create({
    data: {
      firstName: "Markus",
      lastName: "Weber",
      email: "bibliothek@schulbib.de",
      passwordHash,
      role: UserRole.LIBRARIAN,
    },
  });

  const student1 = await prisma.user.create({
    data: {
      firstName: "Lena",
      lastName: "Müller",
      email: "lena.mueller@schueler.schulbib.de",
      passwordHash,
      role: UserRole.STUDENT,
      schoolClass: "10a",
    },
  });

  const student2 = await prisma.user.create({
    data: {
      firstName: "Tim",
      lastName: "Becker",
      email: "tim.becker@schueler.schulbib.de",
      passwordHash,
      role: UserRole.STUDENT,
      schoolClass: "9b",
    },
  });

  const student3 = await prisma.user.create({
    data: {
      firstName: "Sophie",
      lastName: "Klein",
      email: "sophie.klein@schueler.schulbib.de",
      passwordHash,
      role: UserRole.STUDENT,
      schoolClass: "11c",
    },
  });

  console.log("✅ Users created (5)");

  // Create books
  const books = await Promise.all([
    prisma.book.create({
      data: {
        isbn: "9783551551672",
        title: "Harry Potter und der Stein der Weisen",
        author: "J.K. Rowling",
        publisher: "Carlsen Verlag",
        inventoryCode: "BIB-001",
        status: BookStatus.AVAILABLE,
        location: "Regal A1",
        description:
          "Der erste Band der weltberühmten Harry-Potter-Serie. Harry erfährt an seinem elften Geburtstag, dass er ein Zauberer ist.",
      },
    }),
    prisma.book.create({
      data: {
        isbn: "9783551551689",
        title: "Harry Potter und die Kammer des Schreckens",
        author: "J.K. Rowling",
        publisher: "Carlsen Verlag",
        inventoryCode: "BIB-002",
        status: BookStatus.AVAILABLE,
        location: "Regal A1",
        description: "Der zweite Band der Harry-Potter-Serie.",
      },
    }),
    prisma.book.create({
      data: {
        isbn: "9783596905621",
        title: "Die unendliche Geschichte",
        author: "Michael Ende",
        publisher: "Thienemann Verlag",
        inventoryCode: "BIB-003",
        status: BookStatus.AVAILABLE,
        location: "Regal A2",
        description:
          "Bastian Balthasar Bux entdeckt ein geheimnisvolles Buch und wird in die Welt Phantásien hineingezogen.",
      },
    }),
    prisma.book.create({
      data: {
        isbn: "9783423620420",
        title: "Tintenherz",
        author: "Cornelia Funke",
        publisher: "Dressler Verlag",
        inventoryCode: "BIB-004",
        status: BookStatus.AVAILABLE,
        location: "Regal B1",
        description:
          "Meggies Vater kann Figuren aus Büchern herauslesen – mit ungeahnten Konsequenzen.",
      },
    }),
    prisma.book.create({
      data: {
        isbn: "9783407741202",
        title: "Tschick",
        author: "Wolfgang Herrndorf",
        publisher: "Rowohlt",
        inventoryCode: "BIB-005",
        status: BookStatus.AVAILABLE,
        location: "Regal B2",
        description:
          "Zwei Jungs, ein geklauter Lada und eine unvergessliche Reise durch Ostdeutschland.",
      },
    }),
    prisma.book.create({
      data: {
        isbn: "9783785581353",
        title: "Gregs Tagebuch – Von Idioten umzingelt!",
        author: "Jeff Kinney",
        publisher: "Baumhaus Verlag",
        inventoryCode: "BIB-006",
        status: BookStatus.AVAILABLE,
        location: "Regal C1",
        description: "Greg Heffley erzählt von seinem chaotischen Alltag als Mittelstufenschüler.",
      },
    }),
    prisma.book.create({
      data: {
        isbn: "9783401067773",
        title: "Eragon – Das Vermächtnis der Drachenreiter",
        author: "Christopher Paolini",
        publisher: "Arena Verlag",
        inventoryCode: "BIB-007",
        status: BookStatus.AVAILABLE,
        location: "Regal C2",
        description:
          "Ein Bauernjunge findet ein Drachenei und wird in ein episches Abenteuer verwickelt.",
      },
    }),
    prisma.book.create({
      data: {
        title: "Mathematik 10 – Gymnasiale Oberstufe",
        author: "Diverse Autoren",
        publisher: "Cornelsen",
        inventoryCode: "BIB-008",
        status: BookStatus.AVAILABLE,
        location: "Regal D1 (Lehrbücher)",
        description: "Schulbuch für Mathematik, Klasse 10.",
      },
    }),
    prisma.book.create({
      data: {
        isbn: "9783473544011",
        title: "Das Schicksal ist ein mieser Verräter",
        author: "John Green",
        publisher: "Hanser",
        inventoryCode: "BIB-009",
        status: BookStatus.AVAILABLE,
        location: "Regal A3",
        description:
          "Die Geschichte von Hazel und Gus – zwei Teenager, die sich in einer Krebsselbsthilfegruppe kennenlernen.",
      },
    }),
    prisma.book.create({
      data: {
        isbn: "9783570403235",
        title: "Die Tribute von Panem – Tödliche Spiele",
        author: "Suzanne Collins",
        publisher: "Oetinger",
        inventoryCode: "BIB-010",
        status: BookStatus.AVAILABLE,
        location: "Regal A3",
        description:
          "In einer dystopischen Zukunft muss Katniss Everdeen in einer tödlichen Arena ums Überleben kämpfen.",
      },
    }),
  ]);

  console.log("✅ Books created (10)");

  // Create loans (some active, some overdue)
  const now = new Date();

  // Active loan (due in 14 days)
  await prisma.loan.create({
    data: {
      bookId: books[0]!.id,
      userId: student1.id,
      loanedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // in 14 days
      status: LoanStatus.ACTIVE,
    },
  });
  await prisma.book.update({
    where: { id: books[0]!.id },
    data: { status: BookStatus.LOANED },
  });

  // Active loan (due in 5 days)
  await prisma.loan.create({
    data: {
      bookId: books[3]!.id,
      userId: student2.id,
      loanedAt: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000), // 16 days ago
      dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // in 5 days
      status: LoanStatus.ACTIVE,
    },
  });
  await prisma.book.update({
    where: { id: books[3]!.id },
    data: { status: BookStatus.LOANED },
  });

  // Overdue loan (due 3 days ago)
  await prisma.loan.create({
    data: {
      bookId: books[4]!.id,
      userId: student1.id,
      loanedAt: new Date(now.getTime() - 24 * 24 * 60 * 60 * 1000), // 24 days ago
      dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      status: LoanStatus.OVERDUE,
      renewalCount: 0,
    },
  });
  await prisma.book.update({
    where: { id: books[4]!.id },
    data: { status: BookStatus.LOANED },
  });

  // Overdue loan (due 10 days ago)
  await prisma.loan.create({
    data: {
      bookId: books[6]!.id,
      userId: student3.id,
      loanedAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
      dueDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      status: LoanStatus.OVERDUE,
      renewalCount: 1,
    },
  });
  await prisma.book.update({
    where: { id: books[6]!.id },
    data: { status: BookStatus.LOANED },
  });

  // Returned loan (completed)
  await prisma.loan.create({
    data: {
      bookId: books[1]!.id,
      userId: student2.id,
      loanedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      dueDate: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000), // 9 days ago
      returnedAt: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000), // returned 11 days ago
      status: LoanStatus.RETURNED,
    },
  });

  // Book marked as lost
  await prisma.book.update({
    where: { id: books[7]!.id },
    data: { status: BookStatus.LOST },
  });

  console.log("✅ Loans created (5: 2 active, 2 overdue, 1 returned)");
  console.log("✅ Seed complete!");
  console.log("");
  console.log("📋 Test-Zugangsdaten:");
  console.log("   Admin:      admin@schulbib.de / password123");
  console.log("   Bibliothek: bibliothek@schulbib.de / password123");
  console.log("   Schüler:    lena.mueller@schueler.schulbib.de / password123");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
