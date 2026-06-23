import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy utility to get GoogleGenAI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Generate Quiz with real Generative AI from Gemini
  app.post("/api/generate-quiz", async (req, res) => {
    try {
      const { book } = req.body;
      if (!book || !book.title || !book.author) {
        res.status(400).json({ error: "Book title and author are required in request body." });
        return;
      }

      // Check if GEMINI_API_KEY is configured
      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          error: "Dein GEMINI_API_KEY ist noch nicht hinterlegt. Bitte trage ihn in AI Studio unter 'Settings > Secrets' ein, damit Bertis künstliche Intelligenz einsatzbereit ist!",
          isKeyMissing: true,
        });
        return;
      }

      const ai = getGeminiClient();

      // Retrieve accurate book details from the Google Books API if possible
      let googleBooksMetadata = "";
      try {
        const query = `intitle:${book.title} inauthor:${book.author}`;
        const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=de&maxResults=3`;
        const apiResponse = await fetch(searchUrl);
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          if (apiData.items && apiData.items.length > 0) {
            const firstBook = apiData.items[0].volumeInfo;
            googleBooksMetadata = `
Zuverlässige Echtzeit-Informationen aus der Google Books API zu diesem Buch:
- Offizieller Buchtitel: "${firstBook.title || ''}"
- Untertitel: "${firstBook.subtitle || ''}"
- Gefundene Autoren: ${firstBook.authors ? firstBook.authors.join(", ") : ''}
- Offizielle Buchbeschreibung / Inhalt: "${firstBook.description || ''}"
- Kategorien / Fachgebiete: ${firstBook.categories ? firstBook.categories.join(", ") : ''}
- Seitenanzahl (Google Books): ${firstBook.pageCount || ''}
- Veröffentlichungsdatum: ${firstBook.publishedDate || ''}
`;
          }
        }
      } catch (booksApiError) {
        console.warn("Could not fetch details from Google Books API:", booksApiError);
        // Fallback gracefully without breaking the quiz generation
      }

      // System instruction modeled around Berti mascot and pedagogic tone for child readers
      const systemInstruction = `Du bist Berti, das clevere und übermütige Maskottchen (ein kleiner Bücherwurm im orangefarbenen Pullover und Superhelden-Kapuze) der "Schulbücherei - AGG".
Deine Aufgabe ist es, für ein ausgewähltes Buch ein humorvolles, spannendes und lehrreiches Lese-Quiz mit genau 12 Fragen in einfachem, kindgerechtem Deutsch zu erstellen (geeignet für Kinder im Alter von 6-12 Jahren).

Nutze deine künstliche Bibliotheks-Intelligenz, dein reiches Literaturwissen und ggf. die bereitgestellten Echtzeit-Informationen von Google Books, um hochpräzise, buchtitel-spezifische Fragen zu erstellen. 
Wir bitten dich, falls das Buch eine frei erfundene Geschichte oder weniger bekannt ist, die bereitgestellte Zusammenfassung, die Google Books Details und die Kategorie zu verwenden, um clevere Fragen über die Rollen, Tugenden, Abenteuer, Moral, Teamarbeit, Spurensuche oder Natur/Wissen im Buch zu entwerfen.

Strikte Anforderungen:
1. Generiere EXAKT 12 Fragen im JSON-Format.
2. Jede Frage muss genau 4 Antwortoptionen im Array "options" haben.
3. Es darf exakt nur EINE Antwort richtig sein.
4. Der Index "correctAnswer" bezeichnet die richtige Antwort (0-basiert, also 0 für das erste Option-Element, 1 für das zweite, ..., 3 für das vierte).
5. Formuliere die falschen Antworten plausibel, knifflig und eng an das jeweilige Buch angelehnt! Sie sollen sich auf Personen, Handlungen, Orte oder Geschehnisse aus der Welt des Buches beziehen (oder typisch für diese Geschichte/Kategorie sein). Vermeide völlig inhaltsfremden Quatsch wie "Staubsauger-Ritter" oder extrem offensichtliche Nonsens-Antworten. Die Quiz-Fragen sollen so herausfordernd sein, dass nur Kinder, die das Buch wirklich aufmerksam gelesen haben, die richtige Antwort sicher wissen. Die falschen Antwortmöglichkeiten müssen von Struktur und Ton her ähnlich überzeugend klingen wie die korrekte Antwort.
6. Schreibe bei "explanation" eine motivierende, fröhliche Erklärung im typischen Berti-Stil (z.B. "Klasse gelöst! Berti ist mächtig stolz...", "Genau so ist es!"). Die Erklärung muss kindgerecht erläutern, WARUM diese Antwort richtig ist.
7. Jedes Element soll bei "bookReference" den genauen Titel des Buchs erhalten.
`;

      const prompt = `Erstelle ein Quiz für folgendes Buch aus unserer Bücherei:
Titel: "${book.title}"
Autor: "${book.author}"
Kategorie: "${book.category}"
Zielgruppe: "Kinder im Alter von ${book.ageGroup} Jahren"
Inhaltsangabe / Summary: "${book.summary || 'Keine Zusammenfassung hinterlegt.'}"
Veröffentlichungsjahr: ${book.publishedYear || 'unbekannt'}
Seitenanzahl: ${book.pages || 'unbekannt'}
${googleBooksMetadata}

Lies dieses Buch gedanklich sorgsam anhand aller obigen Informationen quer und generiere 12 bunte, hochgradig akkurate Fragen für Kinder!`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "An array of exactly 12 book quiz questions for children.",
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "Unique question id (e.g. q1, q2...)" },
                question: { type: Type.STRING, description: "The interesting and kid-friendly quiz question" },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Exactly 4 options, only one correct."
                },
                correctAnswer: { type: Type.INTEGER, description: "0-based index of the correct answer option (0 to 3)" },
                explanation: { type: Type.STRING, description: "A playful explanation by Berti detailing why this is correct." },
                bookReference: { type: Type.STRING, description: "The exact title of the book" }
              },
              required: ["id", "question", "options", "correctAnswer", "explanation", "bookReference"]
            }
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Keine Rückmeldung von der Generativen KI empfangen.");
      }

      const questions = JSON.parse(responseText.trim());
      res.json({ questions });
    } catch (e: any) {
      console.error("Error generating quiz via Gemini API:", e);
      res.status(500).json({ error: e.message || "Fehler bei der Kommunikation mit Bertis künstlicher Intelligenz." });
    }
  });

  // Serve static assets or use Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is up and running on http://localhost:${PORT}`);
  });
}

startServer();
