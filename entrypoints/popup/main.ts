
import './style.css';
import Dexie, { type Table } from 'dexie';

// =====================================
// 1. DATA TYPES
// =====================================

interface Word {
  id?: number;
  word: string;
  normalized: string;
  createdAt: Date;
  isFavorite?: boolean;
  details?: WordDetails;
}

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

// =====================================
// 2. LOCAL DATABASE
// =====================================

class LexiconDB extends Dexie {
  words!: Table<Word, number>;
  collections!: Table<Collection, number>;
  collectionWords!: Table<CollectionWord, number>;

  constructor() {
    super('LexiconDatabase');

    this.version(1).stores({
      words: '++id, &normalized, createdAt'
    });

    this.version(2).stores({
      words: '++id, &normalized, createdAt'
    });

    this.version(3).stores({
      words: '++id, &normalized, createdAt',
      collections: '++id, name, createdAt',
      collectionWords:
        '++id, collectionId, wordId, &[collectionId+wordId]'
    });
  }
}

const db = new LexiconDB();

// =====================================
// 3. APP ELEMENT
// =====================================

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Lexicon app element was not found.');
}

// =====================================
// 4. AI DEFINITION GENERATION
// =====================================

async function generateWordDetails(
  word: string,
  context = ''
): Promise<WordDetails> {
  const response = await fetch('http://127.0.0.1:8787/define', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ word, context })
  });

  const data = await response.json();

  if (!response.ok || !data.success || !data.definition) {
    throw new Error(
      data.error ?? 'Could not generate the definition.'
    );
  }

  return data.definition as WordDetails;
}

// =====================================
// 5. POPUP HTML
// =====================================

app.innerHTML = `
  <main class="app">

    <header class="header">
      <p class="eyebrow">YOUR PERSONAL VOCABULARY</p>
      <h1>Lexicon<span>.</span></h1>
      <p class="subtitle">Words worth remembering.</p>
    </header>

    <form id="add-form" class="add-form">
      <label for="word-input">Add a new word</label>

      <div class="input-row">
        <input
          id="word-input"
          type="text"
          placeholder="e.g. Ephemeral"
          autocomplete="off"
        />

        <button type="submit">Save</button>
      </div>

      <p id="message" class="message"></p>
    </form>

    <section class="search-section">
      <input
        id="search"
        type="search"
        placeholder="Search your vocabulary..."
        aria-label="Search your vocabulary"
      />
    </section>

    <section class="current-word-section">
      <p class="current-word-eyebrow">CURRENTLY EXPLORING</p>

      <div id="current-word-display">
        <p class="current-word-empty">
          Add or explore a word to see its definition here.
        </p>
      </div>
    </section>

    <section class="library">

      <div class="library-heading">
        <h2 id="library-title">Your library</h2>
        <span id="word-count">0 words</span>
      </div>

      <div class="filter-buttons">

        <button
          type="button"
          class="filter-button active"
          data-filter="all"
        >
          All words
        </button>

        <button
          type="button"
          class="filter-button"
          data-filter="favorites"
        >
          ★ Favorites
        </button>

        <select
          id="collection-filter"
          class="collection-filter"
          aria-label="Choose from collection"
        >
          <option value="">Choose from collection</option>
        </select>

      </div>

      <div class="collection-management">
        <button
          id="create-collection-button"
          type="button"
        >
          + New collection
        </button>

        <button
          id="manage-collections-button"
          type="button"
        >
          Manage collections
        </button>
      </div>

      <div id="word-list"></div>

    </section>

    <footer>LEXICON · YOUR WORDS, YOUR KNOWLEDGE</footer>

  </main>

  <!-- MANAGE COLLECTIONS MODAL -->

  <div id="collections-modal" class="collections-modal" hidden>

    <div
      id="collections-modal-backdrop"
      class="collections-modal-backdrop"
    ></div>

    <section
      class="collections-modal-content"
      role="dialog"
      aria-modal="true"
      aria-labelledby="collections-modal-title"
    >

      <div class="collections-modal-header">

        <div>
          <p class="current-word-eyebrow">YOUR LIBRARY</p>
          <h2 id="collections-modal-title">Manage collections</h2>

          <p class="collections-modal-subtitle">
            Select, rename, or delete your collections.
          </p>
        </div>

        <button
          id="close-collections-modal"
          class="collections-modal-close"
          type="button"
          aria-label="Close"
        >
          ×
        </button>

      </div>

      <div
        id="collections-modal-list"
        class="collections-modal-list"
      ></div>

      <div class="collections-modal-footer">

        <button
          id="modal-new-collection"
          type="button"
        >
          + New collection
        </button>

        <button
          id="done-collections-modal"
          type="button"
        >
          Done
        </button>

      </div>

    </section>

  </div>
`;

// =====================================
// 6. HTML ELEMENT REFERENCES
// =====================================

const form =
  document.querySelector<HTMLFormElement>('#add-form')!;

const wordInput =
  document.querySelector<HTMLInputElement>('#word-input')!;

const searchInput =
  document.querySelector<HTMLInputElement>('#search')!;

const wordList =
  document.querySelector<HTMLDivElement>('#word-list')!;

const wordCount =
  document.querySelector<HTMLSpanElement>('#word-count')!;

const currentWordDisplay =
  document.querySelector<HTMLDivElement>('#current-word-display')!;

const message =
  document.querySelector<HTMLParagraphElement>('#message')!;

const collectionFilter =
  document.querySelector<HTMLSelectElement>(
    '#collection-filter'
  )!;

const createCollectionButton =
  document.querySelector<HTMLButtonElement>(
    '#create-collection-button'
  )!;

const manageCollectionsButton =
  document.querySelector<HTMLButtonElement>(
    '#manage-collections-button'
  )!;

const libraryTitle =
  document.querySelector<HTMLHeadingElement>('#library-title')!;

const filterButtons =
  document.querySelectorAll<HTMLButtonElement>(
    '.filter-button[data-filter]'
  );

// Modal elements

const collectionsModal =
  document.querySelector<HTMLDivElement>(
    '#collections-modal'
  )!;

const collectionsModalList =
  document.querySelector<HTMLDivElement>(
    '#collections-modal-list'
  )!;

const collectionsModalBackdrop =
  document.querySelector<HTMLDivElement>(
    '#collections-modal-backdrop'
  )!;

const closeCollectionsModalButton =
  document.querySelector<HTMLButtonElement>(
    '#close-collections-modal'
  )!;

const doneCollectionsModalButton =
  document.querySelector<HTMLButtonElement>(
    '#done-collections-modal'
  )!;

const modalNewCollectionButton =
  document.querySelector<HTMLButtonElement>(
    '#modal-new-collection'
  )!;

// =====================================
// 7. APP STATE
// =====================================

const expandedWords = new Set<number>();

let activeFilter: 'all' | 'favorites' = 'all';

let activeCollectionId: number | null = null;

const CURRENT_WORD_KEY = 'lexicon-current-word-id';

// =====================================
// 8. ELEMENT CREATION HELPER
// =====================================

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  element.className = className;
  element.textContent = content;

  return element;
}

// =====================================
// 9. GET WORD DETAILS
// =====================================

function getWordDetails(word: Word): WordDetails {
  return word.details ?? {
    partOfSpeech: 'Not generated yet',
    pronunciation: 'Not available',
    meaning: 'No definition has been generated yet.',
    explanation: 'Your AI-generated explanation will appear here.',
    example: 'An example sentence will appear here.',
    synonyms: [],
    antonyms: []
  };
}

// =====================================
// 10. COLLECTION DATABASE HELPERS
// =====================================

async function findCollectionByName(
  name: string
): Promise<Collection | undefined> {
  const normalizedName = name.trim().toLowerCase();

  return db.collections
    .filter(
      (collection) =>
        collection.name.trim().toLowerCase() === normalizedName
    )
    .first();
}

async function createCollection(name: string): Promise<number> {
  const cleanedName = name.trim();

  if (!cleanedName) {
    throw new Error('Collection name cannot be empty.');
  }

  const existing = await findCollectionByName(cleanedName);

  if (existing) {
    throw new Error('A collection with this name already exists.');
  }

  return db.collections.add({
    name: cleanedName,
    createdAt: new Date()
  });
}

async function addWordToCollection(
  collectionId: number,
  wordId: number
): Promise<void> {
  const existingLink = await db.collectionWords
    .where('[collectionId+wordId]')
    .equals([collectionId, wordId])
    .first();

  if (existingLink) return;

  await db.collectionWords.add({
    collectionId,
    wordId
  });
}

async function removeWordFromCollection(
  collectionId: number,
  wordId: number
): Promise<void> {
  await db.collectionWords
    .where('[collectionId+wordId]')
    .equals([collectionId, wordId])
    .delete();
}

// =====================================
// 11. CURRENTLY EXPLORING DASHBOARD
// =====================================

async function renderCurrentWord() {
  const savedId = localStorage.getItem(CURRENT_WORD_KEY);

  if (!savedId) {
    currentWordDisplay.innerHTML = `
      <p class="current-word-empty">
        Add or explore a word to see its definition here.
      </p>
    `;
    return;
  }

  const word = await db.words.get(Number(savedId));

  if (!word) {
    localStorage.removeItem(CURRENT_WORD_KEY);

    currentWordDisplay.innerHTML = `
      <p class="current-word-empty">
        Add or explore a word to see its definition here.
      </p>
    `;
    return;
  }

  const details = getWordDetails(word);

  currentWordDisplay.innerHTML = '';

  const name = createElement(
    'h2',
    'current-word-name',
    word.word
  );

  const meta = createElement(
    'p',
    'current-word-meta',
    `${details.partOfSpeech} · ${details.pronunciation}`
  );

  const meaning = createElement(
    'p',
    'current-word-meaning',
    details.meaning
  );

  const explanation = createElement(
    'p',
    'current-word-explanation',
    details.explanation
  );

  const exampleLabel = createElement(
    'p',
    'current-word-example-label',
    'EXAMPLE'
  );

  const example = createElement(
    'p',
    'current-word-example-text',
    `"${details.example}"`
  );

  const exampleSection = createElement(
    'div',
    'current-word-example',
    ''
  );

  exampleSection.append(exampleLabel, example);

  currentWordDisplay.append(
    name,
    meta,
    meaning,
    explanation,
    exampleSection
  );

  if (details.synonyms.length > 0) {
    currentWordDisplay.appendChild(
      createElement(
        'p',
        'current-word-related',
        `SYNONYMS · ${details.synonyms.join(', ')}`
      )
    );
  }

  if (details.antonyms.length > 0) {
    currentWordDisplay.appendChild(
      createElement(
        'p',
        'current-word-related',
        `ANTONYMS · ${details.antonyms.join(', ')}`
      )
    );
  }
}

// =====================================
// 12. EXPANDED WORD DETAILS
// =====================================

function createDetailsPanel(word: Word): HTMLElement {
  const details = getWordDetails(word);

  const panel = createElement('div', 'details-panel', '');

  panel.append(
    createElement(
      'p',
      'detail-label',
      `${details.partOfSpeech} · ${details.pronunciation}`
    ),

    createElement(
      'p',
      'detail-meaning',
      details.meaning
    ),

    createElement(
      'p',
      'detail-explanation',
      details.explanation
    ),

    createElement(
      'p',
      'detail-section-label',
      'EXAMPLE'
    ),

    createElement(
      'p',
      'detail-example',
      `"${details.example}"`
    )
  );

  if (details.synonyms.length > 0) {
    panel.appendChild(
      createElement(
        'p',
        'detail-synonyms',
        `SYNONYMS · ${details.synonyms.join(', ')}`
      )
    );
  }

  if (details.antonyms.length > 0) {
    panel.appendChild(
      createElement(
        'p',
        'detail-synonyms',
        `ANTONYMS · ${details.antonyms.join(', ')}`
      )
    );
  }

  return panel;
}

// =====================================
// 13. COLLECTION FILTER DROPDOWN
// =====================================

async function renderCollectionFilter() {
  const collections = await db.collections
    .orderBy('name')
    .toArray();

  const selectedValue =
    activeCollectionId === null
      ? ''
      : String(activeCollectionId);

  collectionFilter.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Choose from collection';

  collectionFilter.appendChild(defaultOption);

  for (const collection of collections) {
    if (collection.id === undefined) continue;

    const count = await db.collectionWords
      .where('collectionId')
      .equals(collection.id)
      .count();

    const option = document.createElement('option');

    option.value = String(collection.id);
    option.textContent = `${collection.name} (${count})`;

    collectionFilter.appendChild(option);
  }

  collectionFilter.value = selectedValue;

  if (
    selectedValue !== '' &&
    collectionFilter.value !== selectedValue
  ) {
    activeCollectionId = null;
    collectionFilter.value = '';
  }
}

// =====================================
// 14. COLLECTION MANAGEMENT MODAL
// =====================================

async function openCollectionsModal() {
  await renderCollectionsModal();

  collectionsModal.hidden = false;
}

function closeCollectionsModal() {
  collectionsModal.hidden = true;
}

async function renderCollectionsModal() {
  const collections = await db.collections
    .orderBy('name')
    .toArray();

  collectionsModalList.innerHTML = '';

  if (collections.length === 0) {
    const empty = createElement(
      'div',
      'collections-modal-empty',
      ''
    );

    empty.append(
      createElement(
        'h3',
        '',
        'No collections yet'
      ),
      createElement(
        'p',
        '',
        'Create your first collection to start organizing your words.'
      )
    );

    collectionsModalList.appendChild(empty);
    return;
  }

  for (const collection of collections) {
    if (collection.id === undefined) continue;

    const collectionId = collection.id;

    const count = await db.collectionWords
      .where('collectionId')
      .equals(collectionId)
      .count();

    const isActive = activeCollectionId === collectionId;

    const card = createElement(
      'div',
      `managed-collection-card${isActive ? ' selected' : ''}`,
      ''
    );

    card.dataset.collectionId = String(collectionId);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    card.setAttribute(
      'aria-label',
      `Select collection ${collection.name}`
    );

    const info = createElement(
      'div',
      'managed-collection-info',
      ''
    );

    const nameRow = createElement(
      'div',
      'managed-collection-name-row',
      ''
    );

    const name = createElement(
      'h3',
      'managed-collection-name',
      collection.name
    );

    nameRow.appendChild(name);

    if (isActive) {
      nameRow.appendChild(
        createElement(
          'span',
          'managed-collection-active',
          'Selected'
        )
      );
    }

    const wordCountLabel = createElement(
      'p',
      'managed-collection-count',
      `${count} ${count === 1 ? 'word' : 'words'}`
    );

    info.append(nameRow, wordCountLabel);

    const actions = createElement(
      'div',
      'managed-collection-actions',
      ''
    );

    const renameButton = createElement(
      'button',
      'managed-collection-rename',
      'Rename'
    );

    renameButton.type = 'button';
    renameButton.dataset.action = 'rename';
    renameButton.dataset.id = String(collectionId);

    const deleteButton = createElement(
      'button',
      'managed-collection-delete',
      'Delete'
    );

    deleteButton.type = 'button';
    deleteButton.dataset.action = 'delete';
    deleteButton.dataset.id = String(collectionId);

    actions.append(renameButton, deleteButton);
    card.append(info, actions);

    collectionsModalList.appendChild(card);
  }
}

// Handle collection selection, renaming and deletion.
collectionsModalList.addEventListener(
  'click',
  async (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) return;

    const actionButton = target.closest<HTMLButtonElement>(
      'button[data-action]'
    );

    // RENAME OR DELETE
    if (actionButton) {
      const collectionId = Number(actionButton.dataset.id);
      const action = actionButton.dataset.action;

      if (
        !Number.isInteger(collectionId) ||
        collectionId <= 0
      ) {
        return;
      }

      const collection = await db.collections.get(collectionId);

      if (!collection) return;

      // RENAME
      if (action === 'rename') {
        const newName = prompt(
          'Enter the new collection name:',
          collection.name
        );

        if (newName === null) return;

        const cleanedName = newName.trim();

        if (!cleanedName) {
          alert('Collection name cannot be empty.');
          return;
        }

        const existing = await findCollectionByName(cleanedName);

        if (existing && existing.id !== collectionId) {
          alert('A collection with this name already exists.');
          return;
        }

        await db.collections.update(collectionId, {
          name: cleanedName
        });

        await renderCollectionsModal();
        await renderCollectionFilter();
        await renderWords();

        return;
      }

      // DELETE
      if (action === 'delete') {
        const confirmed = confirm(
          `Delete "${collection.name}"?\n\n` +
          'The collection and its memberships will be removed. Your saved words will remain in Lexicon.'
        );

        if (!confirmed) return;

        await db.transaction(
          'rw',
          db.collections,
          db.collectionWords,
          async () => {
            await db.collectionWords
              .where('collectionId')
              .equals(collectionId)
              .delete();

            await db.collections.delete(collectionId);
          }
        );

        if (activeCollectionId === collectionId) {
          activeCollectionId = null;
          collectionFilter.value = '';
        }

        await renderCollectionsModal();
        await renderCollectionFilter();
        await renderWords();

        return;
      }

      return;
    }

    // SELECT COLLECTION BY CLICKING ITS CARD
    const card = target.closest<HTMLDivElement>(
      '.managed-collection-card'
    );

    if (!card) return;

    const collectionId = Number(card.dataset.collectionId);

    if (
      !Number.isInteger(collectionId) ||
      collectionId <= 0
    ) {
      return;
    }

    activeCollectionId = collectionId;
    activeFilter = 'all';

    collectionFilter.value = String(collectionId);

    filterButtons.forEach((button) => {
      button.classList.toggle(
        'active',
        button.dataset.filter === 'all'
      );
    });

    await renderWords();
    await renderCollectionsModal();
  }
);

// Keyboard support for selecting collection cards.
collectionsModalList.addEventListener(
  'keydown',
  async (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const target = event.target;

    if (!(target instanceof HTMLElement)) return;

    if (target.closest('button')) return;

    const card = target.closest<HTMLDivElement>(
      '.managed-collection-card'
    );

    if (!card) return;

    event.preventDefault();

    const collectionId = Number(card.dataset.collectionId);

    if (
      !Number.isInteger(collectionId) ||
      collectionId <= 0
    ) {
      return;
    }

    activeCollectionId = collectionId;
    activeFilter = 'all';

    collectionFilter.value = String(collectionId);

    filterButtons.forEach((button) => {
      button.classList.toggle(
        'active',
        button.dataset.filter === 'all'
      );
    });

    await renderWords();
    await renderCollectionsModal();
  }
);

// Create a collection from inside the modal.
async function createCollectionFromModal() {
  const name = prompt('Enter a name for your new collection:');

  if (name === null) return;

  if (!name.trim()) {
    alert('Collection name cannot be empty.');
    return;
  }

  try {
    await createCollection(name);

    await renderCollectionFilter();
    await renderCollectionsModal();

    message.textContent =
      `Collection "${name.trim()}" created.`;
  } catch (error) {
    alert(
      error instanceof Error
        ? error.message
        : 'Could not create collection.'
    );
  }
}

// Modal controls.
manageCollectionsButton.addEventListener(
  'click',
  async () => {
    try {
      await openCollectionsModal();
    } catch (error) {
      console.error('Could not open collections modal:', error);
      alert('Could not load your collections.');
    }
  }
);

closeCollectionsModalButton.addEventListener(
  'click',
  closeCollectionsModal
);

doneCollectionsModalButton.addEventListener(
  'click',
  closeCollectionsModal
);

collectionsModalBackdrop.addEventListener(
  'click',
  closeCollectionsModal
);

modalNewCollectionButton.addEventListener(
  'click',
  createCollectionFromModal
);

// Close modal using Escape.
document.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    !collectionsModal.hidden
  ) {
    closeCollectionsModal();
  }
});

// =====================================
// 15. RENDER WORD LIBRARY
// =====================================

async function renderWords() {
  const allWords = await db.words
    .orderBy('createdAt')
    .reverse()
    .toArray();

  const query = searchInput.value.trim().toLowerCase();

  let collectionWordIds: Set<number> | null = null;

  if (activeCollectionId !== null) {
    const links = await db.collectionWords
      .where('collectionId')
      .equals(activeCollectionId)
      .toArray();

    collectionWordIds = new Set(
      links.map((link) => link.wordId)
    );
  }

  const filteredWords = allWords.filter((item) => {
    const matchesSearch = item.word
      .toLowerCase()
      .includes(query);

    const matchesFilter =
      activeFilter === 'all' ||
      item.isFavorite === true;

    const matchesCollection =
      collectionWordIds === null ||
      (item.id !== undefined &&
        collectionWordIds.has(item.id));

    return (
      matchesSearch &&
      matchesFilter &&
      matchesCollection
    );
  });

  // Library heading.
  if (activeCollectionId !== null) {
    const collection = await db.collections.get(
      activeCollectionId
    );

    libraryTitle.textContent = collection
      ? collection.name
      : 'Your library';
  } else if (activeFilter === 'favorites') {
    libraryTitle.textContent = 'Your favorites';
  } else {
    libraryTitle.textContent = 'Your library';
  }

  // Word count.
  wordCount.textContent = `${filteredWords.length} ${
    filteredWords.length === 1 ? 'word' : 'words'
  }`;

  wordList.innerHTML = '';

  // Empty state.
  if (filteredWords.length === 0) {
    const empty = createElement('div', 'empty-state', '');

    let heading = 'Your collection starts here.';
    let description =
      'Save interesting words while browsing the web. They will find a home here.';

    if (query) {
      heading = 'No matching words.';
      description = 'Try another search.';
    } else if (activeCollectionId !== null) {
      heading = 'This collection is empty.';
      description =
        'Add words using the collection dropdown on a word card.';
    } else if (activeFilter === 'favorites') {
      heading = 'No favorite words yet.';
      description =
        'Star words in your library to find them here.';
    }

    empty.append(
      createElement('div', 'empty-icon', 'Aa'),
      createElement('h3', '', heading),
      createElement('p', '', description)
    );

    wordList.appendChild(empty);
    return;
  }

  // Word cards.
  for (const item of filteredWords) {
    if (item.id === undefined) continue;

    const card = createElement('article', 'word-card', '');

    const topRow = createElement('div', 'word-card-top', '');

    const name = createElement('h3', 'word-name', item.word);

    // Favorite button.
    const favoriteButton = createElement(
      'button',
      'favorite-button',
      item.isFavorite ? '★' : '☆'
    );

    favoriteButton.type = 'button';
    favoriteButton.title = item.isFavorite
      ? 'Remove from favorites'
      : 'Add to favorites';

    favoriteButton.dataset.action = 'favorite';
    favoriteButton.dataset.id = String(item.id);

    topRow.append(name, favoriteButton);

    // Date saved.
    const date = createElement(
      'p',
      'word-date',
      new Date(item.createdAt).toLocaleDateString(
        undefined,
        {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }
      )
    );

    // Explore button.
    const detailsButton = createElement(
      'button',
      'details-button',
      expandedWords.has(item.id)
        ? 'Hide details ↑'
        : 'Explore word ↓'
    );

    detailsButton.type = 'button';
    detailsButton.dataset.action = 'details';
    detailsButton.dataset.id = String(item.id);

    // Collection dropdown.
    const collectionPicker = createElement(
      'details',
      'collection-picker',
      ''
    );

    const collectionSummary = createElement(
      'summary',
      'collection-picker-summary',
      '+ Add to collection'
    );

    collectionPicker.appendChild(collectionSummary);

    const availableCollections = await db.collections
      .orderBy('name')
      .toArray();

    const existingLinks = await db.collectionWords
      .where('wordId')
      .equals(item.id)
      .toArray();

    const existingCollectionIds = new Set(
      existingLinks.map((link) => link.collectionId)
    );

    if (availableCollections.length === 0) {
      collectionPicker.appendChild(
        createElement(
          'p',
          'collection-picker-empty',
          'Create a collection first using + New collection.'
        )
      );
    }

    for (const collection of availableCollections) {
      if (collection.id === undefined) continue;

      const label = createElement(
        'label',
        'collection-picker-option',
        ''
      );

      const checkbox = document.createElement('input');

      checkbox.type = 'checkbox';
      checkbox.checked = existingCollectionIds.has(
        collection.id
      );

      const collectionName = createElement(
        'span',
        '',
        collection.name
      );

      label.append(checkbox, collectionName);
      collectionPicker.appendChild(label);

      checkbox.addEventListener('change', async () => {
        checkbox.disabled = true;

        try {
          if (checkbox.checked) {
            await addWordToCollection(
              collection.id!,
              item.id!
            );
          } else {
            await removeWordFromCollection(
              collection.id!,
              item.id!
            );
          }

          await renderCollectionFilter();

          if (
            activeCollectionId === collection.id &&
            !checkbox.checked
          ) {
            await renderWords();
          }
        } catch (error) {
          console.error(
            'Could not update collection membership:',
            error
          );

          checkbox.checked = !checkbox.checked;

          alert(
            'Could not update this collection. Please try again.'
          );
        } finally {
          checkbox.disabled = false;
        }
      });
    }

    // Remove from currently selected collection.
    let removeFromCollectionButton: HTMLButtonElement | null =
      null;

    if (activeCollectionId !== null) {
      removeFromCollectionButton = createElement(
        'button',
        'collection-remove-button',
        'Remove from this collection'
      );

      removeFromCollectionButton.type = 'button';
      removeFromCollectionButton.dataset.action =
        'remove-from-collection';

      removeFromCollectionButton.dataset.id = String(item.id);
    }

    // Delete button.
    const deleteButton = createElement(
      'button',
      'delete-button',
      'Delete'
    );

    deleteButton.type = 'button';
    deleteButton.dataset.action = 'delete';
    deleteButton.dataset.id = String(item.id);

    card.append(
      topRow,
      date,
      detailsButton,
      collectionPicker
    );

    if (removeFromCollectionButton) {
      card.appendChild(removeFromCollectionButton);
    }

    card.appendChild(deleteButton);

    if (expandedWords.has(item.id)) {
      card.appendChild(createDetailsPanel(item));
    }

    wordList.appendChild(card);
  }
}

// =====================================
// 16. CREATE COLLECTION
// =====================================

createCollectionButton.addEventListener(
  'click',
  async () => {
    const name = prompt(
      'Enter a name for your new collection:'
    );

    if (name === null) return;

    if (!name.trim()) {
      alert('Collection name cannot be empty.');
      return;
    }

    try {
      await createCollection(name);

      await renderCollectionFilter();

      message.textContent =
        `Collection "${name.trim()}" created.`;
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Could not create collection.'
      );
    }
  }
);

// =====================================
// 17. COLLECTION FILTER
// =====================================

collectionFilter.addEventListener(
  'change',
  async () => {
    const selectedId = Number(collectionFilter.value);

    activeCollectionId =
      collectionFilter.value !== '' &&
      Number.isInteger(selectedId) &&
      selectedId > 0
        ? selectedId
        : null;

    activeFilter = 'all';

    filterButtons.forEach((button) => {
      button.classList.toggle(
        'active',
        button.dataset.filter === 'all'
      );
    });

    await renderWords();
  }
);

// =====================================
// 18. ADD AND SAVE A NEW WORD
// =====================================

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const word = wordInput.value.trim();

  if (!word) {
    message.textContent = 'Please enter a word first.';
    return;
  }

  const normalized = word.toLowerCase();

  const existing = await db.words
    .where('normalized')
    .equals(normalized)
    .first();

  if (existing) {
    message.textContent =
      'This word is already in your library.';

    if (existing.id !== undefined) {
      localStorage.setItem(
        CURRENT_WORD_KEY,
        String(existing.id)
      );
    }

    await renderCurrentWord();
    return;
  }

  const submitButton = form.querySelector<HTMLButtonElement>(
    'button[type="submit"]'
  );

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Defining...';
  }

  message.textContent =
    `Generating a definition for "${word}"...`;

  try {
    const details = await generateWordDetails(word);

    const newWordId = await db.words.add({
      word,
      normalized,
      createdAt: new Date(),
      isFavorite: false,
      details
    });

    localStorage.setItem(
      CURRENT_WORD_KEY,
      String(newWordId)
    );

    wordInput.value = '';

    message.textContent =
      `"${word}" has been defined and saved!`;

    await renderCurrentWord();
    await renderWords();
    await renderCollectionFilter();

  } catch (error) {
    console.error(
      'Definition generation failed:',
      error
    );

    message.textContent =
      error instanceof Error
        ? error.message
        : 'Could not generate the definition. Please try again.';

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Save';
    }
  }
});

// =====================================
// 19. SEARCH WORDS
// =====================================

searchInput.addEventListener('input', () => {
  void renderWords();
});

// =====================================
// 20. FILTER WORDS
// =====================================

filterButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    activeFilter =
      button.dataset.filter as 'all' | 'favorites';

    activeCollectionId = null;
    collectionFilter.value = '';

    filterButtons.forEach((item) => {
      item.classList.toggle(
        'active',
        item === button
      );
    });

    await renderWords();
  });
});

// =====================================
// 21. WORD LIBRARY ACTIONS
// =====================================

wordList.addEventListener('click', async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) return;

  const button = target.closest<HTMLButtonElement>(
    'button[data-action]'
  );

  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;

  if (!Number.isInteger(id) || id <= 0) return;

  // FAVORITE
  if (action === 'favorite') {
    const item = await db.words.get(id);

    if (!item) return;

    await db.words.update(id, {
      isFavorite: !item.isFavorite
    });
  }

  // EXPLORE
  if (action === 'details') {
    if (expandedWords.has(id)) {
      expandedWords.delete(id);
    } else {
      expandedWords.add(id);
    }

    localStorage.setItem(
      CURRENT_WORD_KEY,
      String(id)
    );

    await renderCurrentWord();
  }

  // DELETE WORD
  if (action === 'delete') {
    const item = await db.words.get(id);

    if (!item) return;

    const confirmed = confirm(
      `Are you sure you want to delete "${item.word}"?`
    );

    if (!confirmed) return;

    await db.transaction(
      'rw',
      db.words,
      db.collectionWords,
      async () => {
        await db.collectionWords
          .where('wordId')
          .equals(id)
          .delete();

        await db.words.delete(id);
      }
    );

    expandedWords.delete(id);

    if (
      localStorage.getItem(CURRENT_WORD_KEY) === String(id)
    ) {
      localStorage.removeItem(CURRENT_WORD_KEY);
      await renderCurrentWord();
    }

    await renderCollectionFilter();
  }

  // REMOVE WORD FROM CURRENT COLLECTION
  if (action === 'remove-from-collection') {
    if (activeCollectionId === null) return;

    await removeWordFromCollection(
      activeCollectionId,
      id
    );

    await renderCollectionFilter();
  }

  await renderWords();
});

// =====================================
// 22. INITIAL DISPLAY
// =====================================

async function initializeLexicon() {
  try {
    await Promise.all([
      renderWords(),
      renderCurrentWord(),
      renderCollectionFilter()
    ]);
  } catch (error) {
    console.error(
      'Lexicon initialization failed:',
      error
    );

    message.textContent =
      'Could not load your vocabulary library.';
  }
}

void initializeLexicon();
