# Luna AI 🌙✨
> **A Self-Hosted, Aesthetic AI Companion with Multi-Model Power**

Luna is your personal, private AI chatbot built with a soft celestial and girly aesthetic (lavender, blush pink, star sparkles, and glassmorphism) inspired by ChatGPT's intuitive design.

---

## 🌸 Key Features

- **ChatGPT-Inspired UI with Girly Aesthetic**: Dreamy midnight lavender backdrop, rose-gold accents, sparkling glowing buttons, glassmorphic cards, and smooth micro-animations.
- **Multi-Model AI Selector**:
  - ⚡ **Groq**: Llama 3.3 70B (State-of-the-Art & Ultra-Fast), Llama 3.1 8B Instant, Mixtral 8x7B.
  - 💎 **Google Gemini**: Gemini 1.5 Flash, Gemini 1.5 Pro, Gemini 2.0 Flash.
  - 🌙 **OpenRouter Free Tier**: Community free models (Llama 3.3 70B Free, Gemini 2.0 Flash Exp Free).
  - 💖 **Luna Companion (Built-in Demo)**: Built-in conversational fallback that works immediately even before entering keys!
- **Persistent Chat History (SQLite)**:
  - Create new chats (`Ctrl+K`), rename chats, switch between past conversations, and delete chats.
  - Chats are categorized chronologically (*Today*, *Yesterday*, *Previous 7 Days*, *Older*).
  - Search filter in sidebar to instantly find past conversations.
- **Secure Authentication**:
  - Full registration & login flow with hashed passwords (`werkzeug.security`).
  - Session-based authentication with personal nicknaming.
- **API Key Management in Settings**:
  - Safely store your personal API keys directly in your local SQLite database.
  - Masked key indicators (e.g. `...a1b2`) with live connection status dots (🟢/🟡).
- **Customizable Luna Personas**:
  - 🌸 **Sweet & Aesthetic**: Gentle, warm, loving, uses celestial and floral emojis.
  - 💅 **Sassy Bestie**: Stylish, witty, high-energy, fun and straight-talking.
  - 💻 **Tech Hacker Girl**: Ultra-clean code, optimal algorithms, crisp explanations.
  - 🌙 **Celestial Mystic**: Poetic, philosophical, intuitive, and wise.
- **Rich Markdown & Code Display**:
  - Code syntax highlighting with Atom One Dark theme.
  - "Copy Code" button with instant feedback.
  - Web Speech API integration to read Luna's replies aloud with a gentle voice.

---

## 🚀 Quick Start Guide

### 1. Requirements
Ensure Python 3.10+ is installed on your computer.

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run Luna
```bash
python app.py
```
Open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 🔑 How to Get Free API Keys (in 30 seconds)

Luna lets you bring your own free API keys so you have 100% control and never hit shared limits:

1. **Groq (Recommended - Llama 3.3 70B)**:
   - Go to [console.groq.com/keys](https://console.groq.com/keys)
   - Sign in with Google/GitHub and click **Create API Key** (starts with `gsk_`).
   - Groq provides free, blazing-fast inference (hundreds of words per second!).

2. **Google Gemini (Gemini 1.5 Flash / Pro)**:
   - Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   - Click **Create API Key** (starts with `AIzaSy`).
   - Free tier includes generous requests per minute.

3. **OpenRouter (Free Pool Models)**:
   - Go to [openrouter.ai/keys](https://openrouter.ai/keys)
   - Generate a free key (starts with `sk-or-`).

In Luna, click the **⚙️ API Keys** button in the top bar, paste your key, and click **Save API Keys**!

---

## 🗄️ Architecture & Tech Stack

- **Backend**: Python, Flask, SQLite3, Jinja2
- **Frontend**: HTML5, Vanilla CSS3 (Custom Design System with Glassmorphism), Vanilla JavaScript (ES6+)
- **Libraries**:
  - `Marked.js` (Markdown parsing)
  - `Highlight.js` (Code syntax highlighting)
  - `FontAwesome 6` (Icons)
  - `Google Fonts` (Outfit, Plus Jakarta Sans, Fira Code)
- **Database**: SQLite (`luna.db`)
  - `users`: User profiles, credentials, preferred nicknames, persona tone.
  - `user_keys`: Per-user encrypted/isolated API keys for Groq, Gemini, OpenRouter.
  - `conversations`: Chat sessions with model routing metadata.
  - `messages`: Message histories with timestamps and roles.

---

## ✨ Developed with Love for Luna 🌙
Enjoy your magical AI journey!
