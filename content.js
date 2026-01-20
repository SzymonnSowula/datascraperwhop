// ============================================
// MEAL PLAN SCRAPER - CONTENT SCRIPT
// ============================================

/**
 * Główna funkcja scrapująca dane z platformy
 * Obsługuje różne struktury stron z planami jadłospisu
 */
function scrapeMealPlanData() {
  console.log('[Meal Plan Scraper] Starting data extraction...');
  
  const data = {
    clientName: '',
    targetMacros: {
      protein: 0,
      carbs: 0,
      fat: 0,
      calories: 0
    },
    dayTotal: {
      protein: 0,
      carbs: 0,
      fat: 0,
      calories: 0
    },
    meals: [],
    mealNotes: [],
    extractedAt: new Date().toISOString()
  };

  // === 1. EKSTRAKCJA NAZWY KLIENTA ===
  data.clientName = extractClientName();
  console.log('[Meal Plan Scraper] Client name:', data.clientName);

  // === 2. EKSTRAKCJA DAY TOTAL (podsumowanie dzienne) ===
  data.dayTotal = extractDayTotal();
  data.targetMacros = { ...data.dayTotal }; // Użyj day total jako target macros
  console.log('[Meal Plan Scraper] Day total:', data.dayTotal);

  // === 3. EKSTRAKCJA POSIŁKÓW ===
  data.meals = extractMeals();
  console.log('[Meal Plan Scraper] Meals extracted:', data.meals.length);

  // === 4. EKSTRAKCJA NOTATEK ===
  data.mealNotes = extractMealNotes();
  console.log('[Meal Plan Scraper] Notes extracted:', data.mealNotes.length);

  return data;
}

/**
 * Ekstrakcja nazwy klienta z nagłówka strony
 */
function extractClientName() {
  // 1. Szukaj specyficznego dla Kahunas nagłówka "Imię Baseline"
  const baselineHeader = document.querySelector('.card-label.font-weight-bolder.text-dark');
  if (baselineHeader) {
    const text = baselineHeader.textContent.trim().replace(/\s+baseline$/i, '');
    if (text) return text;
  }

  // 2. Szukaj w innych miejscach
  const selectors = [
    'h1', 'h2',
    '[class*="client"]', '[class*="name"]', '[class*="title"]',
    '[class*="header"] h1', '[class*="header"] h2',
    '[class*="breadcrumb"]', '[class*="page-title"]'
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.textContent.trim();
      if (text && 
          text.length > 2 && 
          text.length < 100 &&
          !text.toLowerCase().includes('menu') &&
          !text.toLowerCase().includes('dashboard')) {
        
        if (text.toLowerCase().includes('baseline')) {
          return text.replace(/\s+baseline/i, '').trim();
        }
        
        if (/^[A-Z][a-z]+\s+[A-Z]?[a-z]*/.test(text)) {
          return text;
        }
      }
    }
  }

  const h1 = document.querySelector('h1');
  if (h1) return h1.textContent.trim();
  
  return 'Client Meal Plan';
}

/**
 * Ekstrakcja Day Total (podsumowanie dzienne)
 */
function extractDayTotal() {
  const result = { protein: 0, carbs: 0, fat: 0, calories: 0 };
  
  // Szukaj GŁÓWNEGO kontenera podsumowania dla Dnia 1
  // Kahunas używa .total-days-foods dla sekcji podsumowania
  const dayHeader = Array.from(document.querySelectorAll('.card-label'))
    .find(el => el.textContent.includes('DAY TOTAL') || el.textContent.includes('Day 1 Totals'));
  
  const container = dayHeader ? dayHeader.closest('.card, .section, div') : document.querySelector('.total-days-foods');
  
  if (container) {
    const kcalEl = container.querySelector('.total-calories');
    const proteinEl = container.querySelector('.total-protein');
    const carbsEl = container.querySelector('.total-carbs');
    const fatEl = container.querySelector('.total-fat');

    if (kcalEl) result.calories = Math.round(parseFloat(kcalEl.textContent.replace(',', '.')));
    if (proteinEl) result.protein = parseFloat(proteinEl.textContent.replace(',', '.'));
    if (carbsEl) result.carbs = parseFloat(carbsEl.textContent.replace(',', '.'));
    if (fatEl) result.fat = parseFloat(fatEl.textContent.replace(',', '.'));
  }

  // Jeśli nadal zero, spróbuj poszukać konkretnie w badge'ach podsumowania
  if (result.calories === 0) {
    const summaryBadges = document.querySelectorAll('.total-days-foods .badge');
    summaryBadges.forEach(badge => {
      const macros = extractMacrosFromText(badge.textContent);
      if (macros.calories > 0) result.calories = macros.calories;
      if (macros.protein > 0) result.protein = macros.protein;
      if (macros.carbs > 0) result.carbs = macros.carbs;
      if (macros.fat > 0) result.fat = macros.fat;
    });
  }

  return result;
}

/**
 * Ekstrakcja posiłków i ich składników
 */
function extractMeals() {
  const meals = [];
  
  // Strategia 1: Szukaj sekcji posiłków po nagłówkach
  const mealHeaders = findMealHeaders();
  console.log('[Meal Plan Scraper] Found meal headers:', mealHeaders.length);
  
  for (const header of mealHeaders) {
    const meal = extractMealFromHeader(header);
    if (meal && meal.foods.length > 0) {
      meals.push(meal);
    }
  }
  
  // Strategia 2: Jeśli nie znaleziono - szukaj tabel z jedzeniem
  if (meals.length === 0) {
    const tableMeals = extractMealsFromTables();
    if (tableMeals.length > 0) {
      return tableMeals;
    }
  }
  
  // Strategia 3: Szukaj list składników
  if (meals.length === 0) {
    const listMeals = extractMealsFromLists();
    if (listMeals.length > 0) {
      return listMeals;
    }
  }
  
  return meals;
}

/**
 * Znajdź nagłówki posiłków na stronie
 */
function findMealHeaders() {
  const headers = [];
  const allElements = document.querySelectorAll('*');
  
  const mealPatterns = [
    /meal\s*\d/i,
    /breakfast/i,
    /lunch/i,
    /dinner/i,
    /snack/i,
    /pre[- ]?workout/i,
    /post[- ]?workout/i,
    /posiłek/i,
    /śniadanie/i,
    /obiad/i,
    /kolacja/i,
    /przekąska/i
  ];
  
  for (const el of allElements) {
    // Sprawdź tylko elementy z krótkim tekstem (nagłówki)
    if (el.children.length > 5) continue;
    
    const text = el.textContent.trim();
    if (text.length > 100) continue;
    
    for (const pattern of mealPatterns) {
      if (pattern.test(text)) {
        // Upewnij się, że to nie jest dziecko innego znalezionego nagłówka
        let isDuplicate = false;
        for (const existing of headers) {
          if (existing.contains(el) || el.contains(existing)) {
            isDuplicate = true;
            break;
          }
        }
        if (!isDuplicate) {
          headers.push(el);
        }
        break;
      }
    }
  }
  
  return headers;
}

/**
 * Ekstrakcja posiłku z nagłówka - z dodanym grupowaniem składników
 */
function extractMealFromHeader(headerEl) {
  const meal = {
    name: headerEl.textContent.trim(),
    time: '',
    foods: [],
    macros: { protein: 0, carbs: 0, fat: 0, calories: 0 },
    notes: ''
  };
  
  // Wyodrębnij czas z nazwy
  const timeMatch = meal.name.match(/\(([^)]+)\)/);
  if (timeMatch) {
    meal.time = timeMatch[1];
  }
  
  // Próba znalezienia kontenera powiązanego z tabem (częste w Kahunas)
  let targetContainer = null;
  const link = headerEl.closest('a');
  if (link && link.getAttribute('href') && link.getAttribute('href').startsWith('#')) {
    const paneId = link.getAttribute('href').substring(1);
    targetContainer = document.getElementById(paneId);
  }

  let container = targetContainer || headerEl.parentElement;
  let searchDepth = 0;
  
  const rawFoods = [];
  
  while (container && searchDepth < 5) {
    // Bardziej precyzyjny dobór wierszy
    let rowElements = Array.from(container.querySelectorAll('tr'));
    
    // Jeśli brak tabeli (tr), szukaj klas row/item
    if (rowElements.length === 0) {
      rowElements = Array.from(container.querySelectorAll('[class*="item"], [class*="food"], .row'));
    }

    // KLUCZOWE: Filtruj tak, aby nie przetwarzać rodzica i dziecka jednocześnie (unikanie duplikacji)
    const uniqueRows = rowElements.filter(row => {
      // Zachowaj tylko te elementy, które nie zawierają w sobie innych elementów z tej samej listy
      return !rowElements.some(other => other !== row && row.contains(other));
    });
    
    for (const row of uniqueRows) {
      const rowText = row.textContent.toLowerCase();
      if (rowText.includes('meal total')) {
        const subKcal = row.querySelector('.sub-total-calories');
        const subProtein = row.querySelector('.sub-total-protein');
        const subCarbs = row.querySelector('.sub-total-carbs');
        const subFat = row.querySelector('.sub-total-fat');

        if (subKcal) {
          meal.macros.calories = Math.round(parseFloat(subKcal.textContent));
          meal.macros.protein = parseFloat(subProtein?.textContent || 0);
          meal.macros.carbs = parseFloat(subCarbs?.textContent || 0);
          meal.macros.fat = parseFloat(subFat?.textContent || 0);
        } else {
          const macros = extractMacrosFromText(row.textContent);
          if (macros.calories > 0) meal.macros = macros;
        }
        continue;
      }

      const food = extractFoodFromRow(row);
      if (food) {
        rawFoods.push(food);
      }
    }
    
    if (rawFoods.length > 0) break;
    // Jeśli nie znaleziono nic w tab-pane, spróbuj wyżej (ale tylko raz)
    if (targetContainer) break; 
    
    container = container.parentElement;
    searchDepth++;
  }
  
  // Grupowanie składników (np. 2 wiersze z tym samym kurczakiem)
  const groupedFoods = new Map();
  rawFoods.forEach(food => {
    const key = food.name.toLowerCase().trim();
    if (groupedFoods.has(key)) {
      const existing = groupedFoods.get(key);
      existing.amount += food.amount;
      existing.calories += food.calories;
      existing.protein += food.protein;
      existing.carbs += food.carbs;
      existing.fat += food.fat;
    } else {
      groupedFoods.set(key, { ...food });
    }
  });
  
  meal.foods = Array.from(groupedFoods.values());
  
  if (meal.macros.calories === 0 && meal.foods.length > 0) {
    meal.macros = calculateMealMacros(meal.foods);
  }
  
  return meal;
}

/**
 * Ekstrakcja składnika z wiersza
 */
function extractFoodFromRow(row) {
  const text = row.textContent.trim();
  if (!text || text.length < 2) return null;

  // Filtrowanie - jeśli wiersz to tylko makroskładniki, pomiń
  if (/^(\d+\.?\d*)\s*(kcal|g|p|c|f|protein|carbs|fat)?$/i.test(text)) return null;
  if (text.toLowerCase() === 'kcal' || text.toLowerCase() === 'protein' || text.toLowerCase() === 'carbs' || text.toLowerCase() === 'fat') return null;

  const skipPatterns = ['meal total', 'day total', 'meal notes', 'header', 'total', 'add food', 'custom', 'shopping list', 'food swaps guide'];
  for (const pattern of skipPatterns) {
    if (text.toLowerCase().includes(pattern)) return null;
  }

  const food = { name: '', amount: 0, unit: 'g', calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  // 1. Sprawdź inputy (pola edytowalne) - KLUCZOWE DLA KAHUNAS
  const inputs = row.querySelectorAll('input');
  if (inputs.length > 0) {
    // Nazwa
    const nameInput = row.querySelector('input[data-name*="][name]"]');
    if (nameInput) {
      food.name = nameInput.value.trim();
    } else {
      const nameEl = row.querySelector('[class*="name"], b, strong') || row.querySelector('td:first-child div[style*="500"]');
      food.name = nameEl ? nameEl.textContent.trim() : '';
    }

    // Gramatura/Ilość
    const weightInput = row.querySelector('.hidden-weight-value');
    if (weightInput) {
      food.amount = parseFloat(weightInput.value || weightInput.placeholder || 0);
    } else {
      // Szukaj jakiegokolwiek inputu który nie jest makrem
      for (const input of inputs) {
        const val = input.value || input.placeholder;
        if (val && /^\d+\.?\d*$/.test(val) && !input.className.includes('calories') && !input.className.includes('protein') && !input.className.includes('carbohydrate') && !input.className.includes('fat')) {
          food.amount = parseFloat(val);
          break;
        }
      }
    }

    // Makra - SZUKAJ PRECYZYJNIE w kontenerach, aby uniknąć pól systemowych (np. słynne "21C")
    const kcalEl = row.querySelector('.calories-row, .calories-item');
    const proteinEl = row.querySelector('.protein-row, .protein-item');
    const carbsEl = row.querySelector('.carbohydrate-row, .carbs-row, .carbohydrate-item');
    const fatEl = row.querySelector('.fat-row, .fat-item');

    const getMacroVal = (el, fallbackClass) => {
      if (!el) return null;
      const input = el.querySelector('input') || row.querySelector(`input.${fallbackClass}`);
      const val = input ? (input.value || input.placeholder) : el.textContent;
      return val ? parseFloat(val.replace(',', '.')) : 0;
    };

    food.calories = Math.round(getMacroVal(kcalEl, 'hidden-calories-value') || 0);
    food.protein = getMacroVal(proteinEl, 'hidden-protein-value') || 0;
    food.carbs = getMacroVal(carbsEl, 'hidden-carbohydrate-value') || 0;
    food.fat = getMacroVal(fatEl, 'hidden-fat-value') || 0;

    // Jednostka
    const unitContainer = row.querySelector('.badge-light');
    if (unitContainer) {
      food.unit = unitContainer.textContent.replace(/^\s*\d+\s*/, '').trim();
    } else {
      const unitEl = row.querySelector('[class*="unit"], [class*="measure"]');
      if (unitEl) food.unit = unitEl.textContent.trim();
    }
  } 
  
  // 2. Fallback - jeśli brak inputów lub makra nadal 0, parsuj tekst
  if (food.calories === 0) {
    const macros = extractMacrosFromText(text);
    food.calories = macros.calories;
    food.protein = macros.protein;
    food.carbs = macros.carbs;
    food.fat = macros.fat;
  }

  if (!food.name) {
    const firstCell = row.querySelector('td');
    if (firstCell) food.name = firstCell.textContent.split('\n')[0].trim();
  }

  if (food.amount === 0) {
    const match = text.match(/(\d+\.?\d*)\s*(g|kg|ml|slice|piece|large egg|medium egg|large|medium)/i);
    if (match) {
      food.amount = parseFloat(match[1]);
      food.unit = match[2];
    }
  }

  // Czyszczenie nazwy
  food.name = food.name
    .replace(/\s*[–-]?\s*\d+[.,]?\d*\s*(g|kg|ml|slice|piece|large egg|medium egg|large|medium).*$/i, '')
    .replace(/\d+$/, '')
    .trim();

  // Walidacja
  if (!food.name || food.name.length < 2 || /^\d+$/.test(food.name)) return null;
  if (food.amount === 0 && food.calories === 0) return null;

  return food;
}

/**
 * Ekstrakcja makro z tekstu - ulepszona o formaty P: Xg / C: Xg / F: Xg
 */
function extractMacrosFromText(text) {
  const result = { protein: 0, carbs: 0, fat: 0, calories: 0 };
  if (!text) return result;
  
  // Normalizacja: przecinki na kropki, usuń nadmiar spacji
  const clean = text.replace(/(\d+),(\d+)/g, '$1.$2').replace(/\s+/g, ' ').trim();

  // 1. Kalorie (kcal)
  const kcalMatch = clean.match(/(\d+\.?\d*)\s*k?cal/i);
  if (kcalMatch) result.calories = Math.round(parseFloat(kcalMatch[1]));

  // 2. Białko (P)
  const pMatch = clean.match(/(\d+\.?\d*)\s*g?\s*[pP](?:rotein)?\b/i) || 
                clean.match(/\b[pP](?:rotein)?[:\s]+(\d+\.?\d*)/i);
  if (pMatch) result.protein = parseFloat(pMatch[1] || pMatch[2] || 0);

  // 3. Węglowodany (C) - BARDZO RYSTRYKCYJNY REGEX
  // Szukamy liczby + C, ale tylko jeśli C nie jest częścią kcal, piece, slice, cal
  // Próbujemy różnych formatów: "15g C", "C: 15", "15 Carbs"
  const cPatterns = [
    /(\d+\.?\d*)\s*g?\s*carbs?\b/i,
    /\bcarbs?[:\s]+(\d+\.?\d*)/i,
    /(\d+\.?\d*)\s*g?\s*(?<!k)(?<![a-zA-Z])[cC]\b(?!al)(?!ie)(?!la)/, // Zabezpieczenie przed kcal, piece, cal
    /(?<=[|(\[ ])(\d+\.?\d*)[cC]\b(?!al)/ // Format (15C) lub | 15C
  ];

  for (const pattern of cPatterns) {
    const match = clean.match(pattern);
    if (match) {
      result.carbs = parseFloat(match[1] || match[2] || 0);
      break; 
    }
  }

  // 4. Tłuszcze (F)
  const fMatch = clean.match(/(\d+\.?\d*)\s*g?\s*[fF](?:at)?\b/i) || 
                clean.match(/\b[fF](?:at)?[:\s]+(\d+\.?\d*)/i);
  if (fMatch) result.fat = parseFloat(fMatch[1] || fMatch[2] || 0);

  return result;
}

/**
 * Oblicz makro posiłku z sumy składników
 */
function calculateMealMacros(foods) {
  return foods.reduce((acc, food) => ({
    protein: acc.protein + (food.protein || 0),
    carbs: acc.carbs + (food.carbs || 0),
    fat: acc.fat + (food.fat || 0),
    calories: acc.calories + (food.calories || 0)
  }), { protein: 0, carbs: 0, fat: 0, calories: 0 });
}

/**
 * Ekstrakcja posiłków z tabel
 */
function extractMealsFromTables() {
  const meals = [];
  const tables = document.querySelectorAll('table');
  
  for (const table of tables) {
    const rows = table.querySelectorAll('tr');
    let currentMeal = null;
    
    for (const row of rows) {
      const text = row.textContent.trim();
      
      // Sprawdź czy to nagłówek posiłku
      if (/meal|breakfast|lunch|dinner|snack/i.test(text) && 
          row.querySelectorAll('td').length <= 2) {
        if (currentMeal && currentMeal.foods.length > 0) {
          meals.push(currentMeal);
        }
        currentMeal = {
          name: text,
          time: '',
          foods: [],
          macros: { protein: 0, carbs: 0, fat: 0, calories: 0 },
          notes: ''
        };
        continue;
      }
      
      // MEAL TOTAL - zamknij posiłek
      if (text.toLowerCase().includes('meal total')) {
        if (currentMeal) {
          currentMeal.macros = extractMacrosFromText(text);
          meals.push(currentMeal);
          currentMeal = null;
        }
        continue;
      }
      
      // Ekstrakcja składnika
      if (currentMeal) {
        const food = extractFoodFromRow(row);
        if (food) {
          currentMeal.foods.push(food);
        }
      }
    }
    
    // Dodaj ostatni posiłek jeśli został
    if (currentMeal && currentMeal.foods.length > 0) {
      meals.push(currentMeal);
    }
  }
  
  return meals;
}

/**
 * Ekstrakcja posiłków z list (ul/ol)
 */
function extractMealsFromLists() {
  const meals = [];
  // Implementacja dla stron używających list
  // ... (podobna logika jak wyżej)
  return meals;
}

/**
 * Ekstrakcja notatek do posiłków
 */
function extractMealNotes() {
  const notes = [];
  
  // Szukaj wszystkich elementów pre i div, które mogą zawierać notatki
  const noteContainers = document.querySelectorAll('pre.my-chat-pre, div.form-group pre, .meal-notes-content');
  
  noteContainers.forEach(container => {
    const text = container.textContent.trim();
    if (text && text.length > 3) {
      notes.push(text);
    }
  });

  // Jeśli nie znaleziono, szukaj po tekście "Meal Notes"
  if (notes.length === 0) {
    const labels = Array.from(document.querySelectorAll('label, h4, h5, b, span'))
      .filter(el => el.textContent.toLowerCase().includes('meal notes'));
    
    labels.forEach(label => {
      const parent = label.closest('div, section');
      if (parent) {
        // Szukaj tekstu wewnątrz rodzica, wykluczając samą etykietę
        const nextEl = label.nextElementSibling;
        if (nextEl && nextEl.textContent.trim()) {
          notes.push(nextEl.textContent.trim());
        } else {
          const text = parent.textContent.replace(label.textContent, '').trim();
          if (text && text.length > 5 && text.length < 1000) {
            notes.push(text);
          }
        }
      }
    });
  }
  
  return [...new Set(notes)]; // Usuń duplikaty
}

// ============================================
// MESSAGE LISTENER - komunikacja z popup
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Meal Plan Scraper] Received message:', request.action);
  
  if (request.action === 'scrape') {
    try {
      const data = scrapeMealPlanData();
      console.log('[Meal Plan Scraper] Scraped data:', data);
      sendResponse({ success: true, data: data });
    } catch (error) {
      console.error('[Meal Plan Scraper] Error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'Content script active' });
  }
  
  return true; // Keep channel open for async response
});

console.log('[Meal Plan Scraper] Content script loaded successfully');
