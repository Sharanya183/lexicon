
export default defineContentScript({
  matches: ["<all_urls>"],

  main() {
    console.log("LEXICON CONTENT SCRIPT IS RUNNING!");

    // Create the floating popup.
    const host = document.createElement("div");
    host.id = "lexicon-floating-host";

    const shadow = host.attachShadow({ mode: "open" });

    shadow.innerHTML = `
      <style>
        .popup {
          position: fixed;
          width: 280px;
          max-height: 400px;
          overflow-y: auto;
          padding: 14px;
          border-radius: 12px;
          background: #fffefa;
          color: #302e29;
          border: 1px solid #eae7df;
          box-shadow: 0 8px 30px rgba(0,0,0,.15);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 13px;
          z-index: 2147483647;
        }

        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .brand {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        button {
          cursor: pointer;
          font-family: inherit;
        }

        button:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .close {
          border: none;
          background: transparent;
          color: #918d83;
          font-size: 18px;
        }

        .word {
          font-size: 18px;
          font-weight: 600;
          overflow-wrap: anywhere;
          margin-bottom: 12px;
        }

        .define, .save {
          width: 100%;
          padding: 9px;
          border: none;
          border-radius: 7px;
          background: #927c5e;
          color: white;
          font-size: 12px;
          margin-top: 10px;
        }

        .save {
          background: #637d63;
        }

        .details {
          line-height: 1.5;
        }

        .details p {
          margin: 8px 0;
        }

        @media (prefers-color-scheme: dark) {
          .popup {
            background: #292825;
            color: #eeeae2;
            border-color: #403d37;
          }

          .define {
            background: #a58b68;
          }

          .save {
            background: #587458;
          }
        }
      </style>

      <div class="popup" hidden>
        <div class="top">
          <span class="brand">LEXICON</span>
          <button class="close" aria-label="Close">×</button>
        </div>

        <div class="word"></div>
        <div class="details"></div>

        <button class="define">Define with Lexicon</button>
        <button class="save" hidden>Save to Library</button>
      </div>
    `;

    document.documentElement.appendChild(host);

    // Get references to popup elements.
    const popup = shadow.querySelector(".popup") as HTMLDivElement;
    const wordDisplay = shadow.querySelector(".word") as HTMLDivElement;
    const details = shadow.querySelector(".details") as HTMLDivElement;
    const defineButton = shadow.querySelector(".define") as HTMLButtonElement;
    const saveButton = shadow.querySelector(".save") as HTMLButtonElement;
    const closeButton = shadow.querySelector(".close") as HTMLButtonElement;

    // Store the currently selected word and its definition.
    let selectedWord = "";
    let selectedContext = "";
    let generatedDefinition: any = null;

    // Hide the floating popup.
    function hidePopup() {
      popup.hidden = true;
    }

    closeButton.addEventListener("click", hidePopup);

    // Safely display text returned by the AI.
    function escapeHTML(value: unknown): string {
      return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] || character);
    }

    // Ask the backend to generate a definition.
    async function defineWord() {
      defineButton.disabled = true;
      defineButton.textContent = "Generating definition...";
      details.textContent = "Please wait while Lexicon thinks...";

      saveButton.hidden = true;
      generatedDefinition = null;

      try {
        const response = await browser.runtime.sendMessage({
          type: "LEXICON_DEFINE_SELECTION",
          word: selectedWord,
          context: selectedContext,
        });

        if (!response?.success) {
          throw new Error(
            response?.error || "Definition generation failed."
          );
        }

        generatedDefinition = response.definition;

        details.innerHTML = `
          <p><strong>${escapeHTML(generatedDefinition.partOfSpeech)}</strong></p>
          <p><strong>Pronunciation:</strong> ${escapeHTML(generatedDefinition.pronunciation)}</p>
          <p><strong>Meaning:</strong> ${escapeHTML(generatedDefinition.meaning)}</p>
          <p><strong>Explanation:</strong> ${escapeHTML(generatedDefinition.explanation)}</p>
          <p><strong>Example:</strong> ${escapeHTML(generatedDefinition.example)}</p>
          <p><strong>Synonyms:</strong> ${escapeHTML((generatedDefinition.synonyms || []).join(", "))}</p>
          <p><strong>Antonyms:</strong> ${escapeHTML((generatedDefinition.antonyms || []).join(", "))}</p>
        `;

        defineButton.hidden = true;
        saveButton.hidden = false;
        saveButton.disabled = false;
        saveButton.textContent = "Save to Library";

      } catch (error) {
        console.error("Lexicon definition error:", error);

        details.textContent = error instanceof Error
          ? error.message
          : "Something went wrong.";

        defineButton.textContent = "Try Again";

      } finally {
        defineButton.disabled = false;
      }
    }

    defineButton.addEventListener("click", defineWord);

    // Save the generated definition to the Lexicon library.
    // This happens ONLY when the user clicks Save to Library.
    saveButton.addEventListener("click", async () => {
      if (!generatedDefinition || !selectedWord) {
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = "Saving...";

      try {
        const response = await browser.runtime.sendMessage({
          type: "LEXICON_SAVE_WORD",
          word: selectedWord,
          details: generatedDefinition,
        });

        if (!response?.success) {
          throw new Error(
            response?.error || "Could not save word."
          );
        }

        if (response.alreadySaved) {
          saveButton.textContent = "Already in your library ✓";
        } else {
          saveButton.textContent = "Saved to Library ✓";
        }

      } catch (error) {
        console.error("Lexicon save error:", error);

        details.textContent = error instanceof Error
          ? error.message
          : "Could not save this word.";

        saveButton.disabled = false;
        saveButton.textContent = "Try Saving Again";
      }
    });

    // Detect when the user selects a word on a webpage.
    function handleSelection() {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      console.log("LEXICON DETECTED SELECTION:", selectedText);

      if (!selectedText || selectedText.length > 100) {
        hidePopup();
        return;
      }

      const range = selection?.getRangeAt(0);

      if (!range) return;

      const rect = range.getBoundingClientRect();

      if (!rect.width && !rect.height) return;

      selectedWord = selectedText;

      selectedContext =
        selection?.anchorNode?.parentElement?.textContent?.slice(0, 500) || "";

      generatedDefinition = null;

      wordDisplay.textContent = selectedWord;
      details.textContent = "";

      defineButton.hidden = false;
      defineButton.disabled = false;
      defineButton.textContent = "Define with Lexicon";

      saveButton.hidden = true;
      saveButton.disabled = false;
      saveButton.textContent = "Save to Library";

      popup.hidden = false;

      const popupWidth = 308;
      const popupHeight = 180;

      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - popupWidth - 8)
      );

      const top = Math.min(
        rect.bottom + 8,
        window.innerHeight - popupHeight - 8
      );

      popup.style.left = `${left}px`;
      popup.style.top = `${Math.max(8, top)}px`;
    }

    // Wait briefly because browsers update selected text asynchronously.
    let selectionTimer: ReturnType<typeof setTimeout>;

    function scheduleSelectionCheck() {
      clearTimeout(selectionTimer);

      selectionTimer = setTimeout(() => {
        const selectedText = window.getSelection()?.toString().trim();

        if (selectedText) {
          handleSelection();
        }
      }, 100);
    }

    document.addEventListener("mouseup", scheduleSelectionCheck);
    document.addEventListener("keyup", scheduleSelectionCheck);
    document.addEventListener("selectionchange", scheduleSelectionCheck);

    // Prevent popup interactions from clearing the selected text.
    shadow.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    // Close popup when clicking elsewhere.
    document.addEventListener("mousedown", (event) => {
      if (!host.contains(event.target as Node)) {
        hidePopup();
      }
    });

    // Close popup when Escape is pressed.
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hidePopup();
      }
    });

    // Hide popup when scrolling.
    window.addEventListener("scroll", hidePopup, true);
  },
});
