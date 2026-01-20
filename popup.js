// ============================================
// MEAL PLAN SCRAPER - POPUP SCRIPT
// ============================================

let scrapedData = null;

// DOM Elements
const scrapeBtn = document.getElementById('scrapeBtn');
const previewBtn = document.getElementById('previewBtn');
const exportBtn = document.getElementById('exportBtn');
const copyBtn = document.getElementById('copyBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const previewSection = document.getElementById('previewSection');
const previewContent = document.getElementById('previewContent');
const closePreview = document.getElementById('closePreview');
const statsSection = document.getElementById('statsSection');

// Settings
const clientNameInput = document.getElementById('clientName');
const waterGoalInput = document.getElementById('waterGoal');
const includeNotesCheckbox = document.getElementById('includeNotes');
const includeSwapsCheckbox = document.getElementById('includeSwaps');

// Load saved data on startup
chrome.storage.local.get(['lastScrapedData', 'settings'], (result) => {
  if (result.lastScrapedData) {
    scrapedData = result.lastScrapedData;
    updateUIWithData();
    setStatus('success', 'Loaded last session data');
  }
  if (result.settings) {
    waterGoalInput.value = result.settings.waterGoal || '1';
    includeNotesCheckbox.checked = result.settings.includeNotes !== false;
    includeSwapsCheckbox.checked = result.settings.includeSwaps !== false;
  }
});

// ============================================
// EVENT LISTENERS
// ============================================

scrapeBtn.addEventListener('click', handleScrape);
previewBtn.addEventListener('click', togglePreview);
copyBtn.addEventListener('click', handleCopy);
exportBtn.addEventListener('click', handleExport);
exportJsonBtn.addEventListener('click', handleExportJson);
closePreview.addEventListener('click', () => {
  previewSection.style.display = 'none';
});

// ============================================
// SCRAPING
// ============================================

async function handleScrape() {
  setStatus('loading', 'Scraping data...');
  scrapeBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Inject content script if needed
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).catch(() => {});

    // Send scrape message
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrape' });

    if (response && response.success) {
      scrapedData = response.data;
      
      // Save to storage
      chrome.storage.local.set({ 
        lastScrapedData: scrapedData,
        settings: {
          waterGoal: waterGoalInput.value,
          includeNotes: includeNotesCheckbox.checked,
          includeSwaps: includeSwapsCheckbox.checked
        }
      });

      updateUIWithData();
      setStatus('success', `Found ${scrapedData.meals.length} meals`);
      
    } else {
      throw new Error(response?.error || 'No response from page');
    }

  } catch (error) {
    console.error('Scrape error:', error);
    setStatus('error', 'Error: ' + error.message);
  } finally {
    scrapeBtn.disabled = false;
  }
}

// ============================================
// PREVIEW
// ============================================

function togglePreview() {
  if (!scrapedData) return;
  
  if (previewSection.style.display === 'none') {
    renderPreview();
    previewSection.style.display = 'block';
  } else {
    previewSection.style.display = 'none';
  }
}

function renderPreview() {
  if (!scrapedData) return;
  
  let html = '';
  
  // Client name
  html += `<div style="margin-bottom: 20px; color: var(--accent); font-weight: 700; font-size: 16px;">
    ${scrapedData.clientName || 'Meal Plan Analysis'}
  </div>`;
  
  // Day total
  if (scrapedData.dayTotal.calories > 0) {
    html += `<div class="preview-macros" style="margin-bottom: 24px; background: var(--accent-glow); border: 1px solid var(--accent); padding: 12px; border-radius: 8px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent); margin-bottom: 4px;">Daily Target</div>
      <div style="font-weight: 700; color: #fff; font-size: 14px;">
        ${scrapedData.dayTotal.calories} kcal • ${scrapedData.dayTotal.protein}P • ${scrapedData.dayTotal.carbs}C • ${scrapedData.dayTotal.fat}F
      </div>
    </div>`;
  }
  
  // Meals
  for (const meal of scrapedData.meals) {
    html += `<div class="preview-meal" style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px;">`;
    html += `<div class="preview-meal-title" style="font-size: 13px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.05em;">${meal.name}</div>`;
    
    for (const food of meal.foods) {
      html += `<div class="preview-food-item" style="display: flex; flex-direction: column; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 13px; color: #fff;">
          <span class="preview-food-name">${food.name}</span>
          <span class="preview-food-amount">${food.amount} ${food.unit}</span>
        </div>
        ${food.calories > 0 ? `
        <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px; font-weight: 500;">
          ${food.calories} kcal | ${food.protein}P | ${food.carbs}C | ${food.fat}F
        </div>` : ''}
      </div>`;
    }
    
    if (meal.macros.calories > 0) {
      html += `<div class="meal-total" style="padding-top: 4px; font-weight: 700; color: var(--success); font-size: 12px; display: flex; justify-content: space-between;">
        <span>MEAL TOTAL</span>
        <span>${meal.macros.calories} kcal | ${meal.macros.protein}P | ${meal.macros.carbs}C | ${meal.macros.fat}F</span>
      </div>`;
    }
    
    html += `</div>`;
  }
  
  previewContent.innerHTML = html;
}

function updateStats() {
  if (!scrapedData) return;
  
  const totalFoods = scrapedData.meals.reduce((sum, m) => sum + m.foods.length, 0);
  
  document.getElementById('statMeals').textContent = scrapedData.meals.length;
  document.getElementById('statFoods').textContent = totalFoods;
  document.getElementById('statCalories').textContent = scrapedData.dayTotal.calories || '—';
  
  const statGrid = document.querySelector('.stats-grid');
  if (statGrid && !document.getElementById('statProtein')) {
    const macrosHtml = `
      <div class="stat-item">
        <span class="stat-value" id="statProtein">${scrapedData.dayTotal.protein || 0}</span>
        <span class="stat-label">Prot (g)</span>
      </div>
      <div class="stat-item">
        <span class="stat-value" id="statCarbs">${scrapedData.dayTotal.carbs || 0}</span>
        <span class="stat-label">Carb (g)</span>
      </div>
      <div class="stat-item">
        <span class="stat-value" id="statFat">${scrapedData.dayTotal.fat || 0}</span>
        <span class="stat-label">Fat (g)</span>
      </div>
    `;
    statGrid.innerHTML += macrosHtml;
  } else if (document.getElementById('statProtein')) {
    document.getElementById('statProtein').textContent = scrapedData.dayTotal.protein || 0;
    document.getElementById('statCarbs').textContent = scrapedData.dayTotal.carbs || 0;
    document.getElementById('statFat').textContent = scrapedData.dayTotal.fat || 0;
  }
  
  statsSection.style.display = 'block';
}

// ============================================
// PDF EXPORT
// ============================================

async function handleExport() {
  if (!scrapedData) return;
  
  setStatus('loading', 'Generowanie PDF...');
  exportBtn.disabled = true;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const clientName = clientNameInput.value || scrapedData.clientName || 'Client';
    const waterGoal = waterGoalInput.value || '1';
    const includeNotes = includeNotesCheckbox.checked;
    const includeSwaps = includeSwapsCheckbox.checked;
    
    let y = 20;
    const marginLeft = 20;
    const pageWidth = doc.internal.pageSize.width;
    
    // Helper functions
    const addText = (text, x, yPos, options = {}) => {
      doc.setFontSize(options.size || 11);
      doc.setFont('helvetica', options.style || 'normal');
      doc.setTextColor(options.color || '#1a1a1a');
      doc.text(text, x, yPos);
      return yPos + (options.lineHeight || 6);
    };
    
    const checkPageBreak = (neededSpace) => {
      if (y + neededSpace > 280) {
        doc.addPage();
        y = 20;
      }
    };
    
    // ========== HEADER ==========
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('🍽 ' + clientName.toUpperCase() + ' — DAILY MEAL PLAN', marginLeft, 22);
    
    y = 50;
    
    // ========== INTRO TEXT (Comprehensive Guide) ==========
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    
    const introParagraphs = [
      "Sample meal plan: you don’t have to follow this but it’s a great place to start and follows your Macros. Use the food tracker in the app and plug in different foods. Anything with the red icon next to it in the app shows that the macros are verified.",
      "(Most of the green veggies are for fiber and micronutrients. They aren’t a “must” but it’s good to have but not necessary and will keep you fuller and more satisfied) but definitely get in the habit of tracking everything you put in your body. This is simply a guide. Once you get used to tracking it’s easy! Just like everything it takes practice to get good!",
      "Diet drinks are fine along with water flavoring as long as it’s 0/calorie (aim for a gallon a day) and Splenda and Truvia are completely fine! (Unless you have an allergy) Unless you are eating bags of this stuff at a time you will have no adverse effects!",
      "Also go with light dressings (skinny girl brand has great ones), and sugar free /ok low sugar condiments as much as you can. Walden Farms brand makes a zero calorie Ranch...it’s not the best...but probably not the worst!",
      "Also use popcorn seasonings to help change the flavor of things. I use cheddar and ranch a lot!. You can also add green veggies like Green beans and Salads to any meal. Anything under 15 calories we don’t really track unless we are in a hard prep.",
      "You may also invest in a travel on the go bag. I have an Isobag it’s a lifesaver and if you have food and you bring them with you...I promise you will stay on target so so so much easier. Being prepared is the key to this! Just know microwaves are everywhere. Gas stations, offices, school, everywhere. So if you have your food you are ready! This bags are so worth it!"
    ];

    for (const para of introParagraphs) {
      const splitPara = doc.splitTextToSize(para, pageWidth - 40);
      checkPageBreak(splitPara.length * 4 + 2);
      doc.text(splitPara, marginLeft, y);
      y += (splitPara.length * 4) + 3;
    }
    y += 2;

    // ========== TARGET MACROS ==========
    checkPageBreak(45);
    doc.setFillColor(245, 245, 250);
    doc.rect(marginLeft - 5, y - 5, pageWidth - 30, 42, 'F');
    
    y = addText(`Water Goal: ${waterGoal} gallon a day. (Get a jug. You can use water flavoring)`, marginLeft, y, { size: 10, style: 'bold' });
    y += 4;
    y = addText('Target Macros:', marginLeft, y, { size: 11, style: 'bold' });
    y = addText(`✅ Protein: ~${scrapedData.dayTotal.protein || 0} g`, marginLeft + 5, y, { size: 10, color: '#10B981' });
    y = addText(`✅ Carbs: ~${scrapedData.dayTotal.carbs || 0} g`, marginLeft + 5, y, { size: 10, color: '#3B82F6' });
    y = addText(`✅ Fat: ~${scrapedData.dayTotal.fat || 0} g`, marginLeft + 5, y, { size: 10, color: '#F59E0B' });
    y = addText(`💥 Total Calories: ~${scrapedData.dayTotal.calories || 0}`, marginLeft + 5, y, { size: 10, style: 'bold' });
    
    y += 12;
    
    // ========== MEALS ==========
    for (let i = 0; i < scrapedData.meals.length; i++) {
      const meal = scrapedData.meals[i];
      
      checkPageBreak(25 + meal.foods.length * 7);
      
      // Meal header - professional look
      doc.setFillColor(79, 70, 229);
      doc.rect(marginLeft - 5, y - 4, pageWidth - 30, 8, 'F');
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      
      const mealTitle = `${meal.name.toUpperCase()} ${meal.time ? `(${meal.time})` : ''}`;
      doc.text(mealTitle, marginLeft, y + 2);
      y += 11;
      
      // Foods
      doc.setTextColor(30, 30, 30);
      for (const food of meal.foods) {
        checkPageBreak(7);
        const foodLine = `• ${food.name} – ${food.amount} ${food.unit}`;
        y = addText(foodLine, marginLeft + 5, y, { size: 10 });
      }
      
      // Meal macros - Clean format: 33P / 42C / 7F
      if (meal.macros.calories > 0) {
        y += 2;
        const macroText = `Macros: ${Math.round(meal.macros.protein)}P / ${Math.round(meal.macros.carbs)}C / ${Math.round(meal.macros.fat)}F`;
        y = addText(macroText, marginLeft + 5, y, { size: 10, style: 'bold', color: '#4F46E5' });
      }
      
      y += 10;
    }
    
    // ========== DAILY TOTALS ==========
    checkPageBreak(35);
    
    doc.setFillColor(16, 185, 129);
    doc.rect(marginLeft - 5, y - 4, pageWidth - 30, 28, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('DAILY MACRO TOTALS', marginLeft, y + 3);
    y += 9;
    
    doc.setFontSize(11);
    doc.text(`• Protein: ~${scrapedData.dayTotal.protein || 0} g`, marginLeft + 5, y);
    y += 6;
    doc.text(`• Carbs: ~${scrapedData.dayTotal.carbs || 0} g`, marginLeft + 5, y);
    y += 6;
    doc.text(`• Fat: ~${scrapedData.dayTotal.fat || 0} g`, marginLeft + 5, y);
    y += 12;
    
    // ========== FOOD SWAPS (optional) ==========
    if (includeSwaps) {
      checkPageBreak(55);
      
      y = addText('⭐ OPTIONAL FOOD SWAPS (Same Macros)', marginLeft, y, { size: 11, style: 'bold', color: '#B45309' });
      y += 4;
      
      const swaps = [
        { label: 'Protein swaps:', items: 'Chicken breast ↔ ground turkey ↔ cod ↔ shrimp ↔ Whey Isolate' },
        { label: 'Carb swaps:', items: 'Sweet potato ↔ yellow potatoes ↔ quinoa ↔ cream of rice' },
        { label: 'Fat swaps:', items: 'Coconut oil ↔ olive oil ↔ avocado (weigh carefully)' }
      ];

      for (const swap of swaps) {
        y = addText(swap.label, marginLeft, y, { size: 10, style: 'bold' });
        const splitItems = doc.splitTextToSize(`• ${swap.items}`, pageWidth - 50);
        doc.text(splitItems, marginLeft + 5, y);
        y += (splitItems.length * 4) + 4;
      }
    }
    
    // Save PDF
    const fileName = `${clientName.replace(/\s+/g, '_')}_meal_plan.pdf`;
    doc.save(fileName);
    
    setStatus('success', 'PDF generated successfully!');
    
  } catch (error) {
    console.error('Export error:', error);
    setStatus('error', 'Export error: ' + error.message);
  } finally {
    exportBtn.disabled = false;
  }
}

async function handleExportJson() {
  if (!scrapedData) return;
  
  try {
    const dataStr = JSON.stringify(scrapedData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${(clientNameInput.value || scrapedData.clientName || 'meal_plan').replace(/\s+/g, '_')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    setStatus('success', 'JSON exported!');
  } catch (error) {
    setStatus('error', 'JSON error: ' + error.message);
  }
}

async function handleCopy() {
  if (!scrapedData) return;

  try {
    let text = `DIET PLAN: ${scrapedData.clientName || 'My Plan'}\n\n`;
    
    // Dodajemy sekcję Target Macros, którą FitOS czyta jako główną konfigurację
    text += `Target Macros:\n`;
    text += `Calories: ${scrapedData.dayTotal.calories} kcal\n`;
    text += `Protein: ${scrapedData.dayTotal.protein}g\n`;
    text += `Carbs: ${scrapedData.dayTotal.carbs}g\n`;
    text += `Fat: ${scrapedData.dayTotal.fat}g\n\n`;
    
    scrapedData.meals.forEach((meal, index) => {
      text += `--- ${meal.name.toUpperCase()} ---\n`;
      
      meal.foods.forEach(food => {
        text += `• ${food.name}: ${food.amount} ${food.unit}`;
        if (food.calories > 0) {
          text += ` (${food.calories}kcal | ${food.protein}P | ${food.carbs}C | ${food.fat}F)`;
        }
        text += `\n`;
      });
      
      if (meal.macros.calories > 0) {
        text += `MEAL TOTAL: ${meal.macros.calories}kcal | ${meal.macros.protein}P | ${meal.macros.carbs}C | ${meal.macros.fat}F\n`;
      }

      if (index < scrapedData.meals.length - 1) {
        text += "\n";
      }
    });

    await navigator.clipboard.writeText(text);
    
    const originalText = statusText.textContent;
    setStatus('success', 'Plan copied with Target Macros!');
    
    setTimeout(() => {
      setStatus('success', originalText);
    }, 2000);
    
  } catch (error) {
    console.error('Copy error:', error);
    setStatus('error', 'Copy error: ' + error.message);
  }
}

function updateUIWithData() {
  if (!scrapedData) return;
  
  previewBtn.disabled = false;
  copyBtn.disabled = false;
  exportBtn.disabled = false;
  exportJsonBtn.disabled = false;
  
  if (scrapedData.clientName && !clientNameInput.value) {
    clientNameInput.value = scrapedData.clientName;
  }
  
  updateStats();
}

// ============================================
// HELPERS
// ============================================

function setStatus(type, message) {
  statusIndicator.className = 'status-indicator ' + type;
  statusText.textContent = message;
}

// Initialize
console.log('[Meal Plan Scraper] Popup loaded');
