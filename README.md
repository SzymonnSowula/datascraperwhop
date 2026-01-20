# Kahunas to FitOS Meal Plan Scraper 🍽️

A powerful Chrome Extension designed to bridge the gap between **Kahunas.io** and **FitOS/Fit-OS**. Automate your workflow by scraping meal plans with 100% macro accuracy and exporting them to professional PDFs or copying directly to your clipboard.

## 🚀 Key Features

- **Bulletproof Scraping**: Specialized logic for Kahunas.io that bypasses common data extraction errors (like the "21C" carb bug).
- **Macro-Precision**: Extracts accurate Calories, Protein, Carbs, and Fat for both individual food items and meal totals.
- **FitOS Compatible**: Exports and copies data in a format specifically optimized for FitOS auto-import (English labels, Target Macro headers).
- **Professional PDF Export**: Generates a clean, branded PDF include intro guides, water goals, and optional food swaps.
- **Instant Clipboard Copy**: One-click copy with structured formatting ready for your favorite apps.
- **Dark UI**: Sleek, modern interface with real-time scraping status.

## 📥 Installation

1. Download or clone this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked** and select the folder containing this project.

## 🛠️ Usage

1. Navigate to a meal plan page on **Kahunas.io**.
2. Click the extension icon in your toolbar.
3. Click **Scrape Plan** to extract data from the page.
4. Verify the data in the **Preview Section**.
5. Choose your action:
   - **Copy Plan**: Copies the structured text to your clipboard.
   - **Download PDF**: Generates a professional meal plan document.
   - **Export JSON**: Save the raw data for advanced use cases.

## 🔧 Technical Details

- **Strict Regex Logic**: Uses negative lookaheads to distinguish between macros and unit labels.
- **DOM Container Targeting**: Prioritizes visual containers over hidden inputs to ensure data integrity.
- **JSON State Management**: Remembers your scraped data so you can export multiple formats without re-scraping.

## 📜 License

Created for personal and professional use. Support for Kahunas.io structural updates is ongoing.
