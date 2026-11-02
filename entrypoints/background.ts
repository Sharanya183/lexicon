
import Dexie, { type Table } from "dexie";

// The structure of a word stored in Lexicon.
interface WordDetails {
  partOfSpeech: string;
  pronunciation: string;
  meaning: string;
  explanation: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
}

interface Collection {
  id?: number;
  name: string;
  description?: string;
  createdAt: Date;
}

interface CollectionWord {
  id?: number;
  collectionId: number;
  wordId: number;
}

interface Word {
  id?: number;
  word: string;
  normalized: string;
  createdAt: Date;
  isFavorite?: boolean;
  details?: WordDetails;
}

// Connect to the same database used by the extension popup.
class LexiconDB extends Dexie {
  words!: Table<Word, number>;
  collections!: Table<Collection, number>;
  collectionWords!: Table<CollectionWord, number>;

  constructor() {
    super("LexiconDatabase");

    this.version(1).stores({
      words: "++id, &normalized, createdAt",
    });

    this.version(2).stores({
      words: "++id, &normalized, createdAt",
    });

    this.version(3).stores({
      words: "++id, &normalized, createdAt",

      collections: "++id, name, createdAt",

      collectionWords:
        "++id, collectionId, wordId, &[collectionId+wordId]",
    });
  }
}

const db = new LexiconDB();

export default defineBackground(() => {
  console.log("Lexicon background service is running!");

  browser.runtime.onMessage.addListener(async (message) => {

    // FEATURE 1: Generate a definition.
    if (message?.type === "LEXICON_DEFINE_SELECTION") {
      try {
        const response = await fetch(
          "http://127.0.0.1:8787/define",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              word: message.word,
              context: message.context || "",
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success || !data.definition) {
          return {
            success: false,
            error: data.error || "Definition generation failed.",
          };
        }

        return {
          success: true,
          definition: data.definition,
        };

      } catch (error) {
        console.error("Definition error:", error);

        return {
          success: false,
          error: "Could not connect to the local AI backend.",
        };
      }
    }

    // FEATURE 2: Save a word ONLY when the Save button is clicked.
    if (message?.type === "LEXICON_SAVE_WORD") {
      try {
        const word = String(message.word || "").trim();
        const details = message.details as WordDetails | undefined;

        if (!word || !details) {
          return {
            success: false,
            error: "Word or definition is missing.",
          };
        }

        const normalized = word.toLowerCase();

        // Check whether this word already exists.
        const existing = await db.words
          .where("normalized")
          .equals(normalized)
          .first();

        if (existing?.id !== undefined) {
          return {
            success: true,
            alreadySaved: true,
            id: existing.id,
          };
        }

        // Add the word to the existing Lexicon database.
        const id = await db.words.add({
          word,
          normalized,
          createdAt: new Date(),
          isFavorite: false,
          details,
        });

        // Remember which word should appear on the dashboard.
        await browser.storage.local.set({
          "lexicon-current-word-id": id,
        });

        console.log("Lexicon saved word:", word);

        return {
          success: true,
          alreadySaved: false,
          id,
        };

      } catch (error) {
        console.error("Save error:", error);

        return {
          success: false,
          error: "Could not save the word to your library.",
        };
      }
    }

  });
});
