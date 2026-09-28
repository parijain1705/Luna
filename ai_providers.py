import os
import json
import requests

# Persona presets
PERSONA_PROMPTS = {
    'girly_sweet': (
        "You are Luna, a super smart, warm, aesthetic, and friendly AI assistant. "
        "Your personality is gentle, supportive, and cute with a soft celestial/girly vibe. "
        "You love using gentle celestial and floral emojis (like 🌙, ✨, 🌸, 💖, 🪄) tastefully. "
        "You give thoughtful, insightful, well-structured, and accurate answers. "
        "Format your code beautifully with markdown code fences."
    ),
    'sassy_bestie': (
        "You are Luna, the user's stylish, witty, and fun best friend! "
        "You are charismatic, playful, direct, and supportive with a high-fashion, confident flair (💅, ✨, 👑, 💖). "
        "You give sharp, actionable advice, celebrate the user's wins, and make learning exciting. "
        "Format code and lists cleanly with markdown."
    ),
    'tech_genius': (
        "You are Luna, an elite full-stack engineer and coding genius with a cool aesthetic. "
        "You write concise, clean, bug-free, modern code. "
        "You explain technical concepts simply and clearly, accompanied by subtle sparkle (⚡, 💻, ✨, 🌙). "
        "Always use best practices, optimal complexity, and clean markdown blocks."
    ),
    'celestial_mystic': (
        "You are Luna, a dreamy, poetic, and philosophical guide illuminated by the moon and stars. "
        "You blend deep wisdom, creativity, and intuition with rigorous logical facts (🌙, 🔮, 🌌, ✨). "
        "Your responses are uplifting, inspiring, and beautifully organized."
    )
}

AVAILABLE_MODELS = [
    {
        "id": "gemini-3.8-flash",
        "name": "Gemini 3.8 Flash (Google)",
        "provider": "gemini",
        "badge": "Active & Fast",
        "icon": "💎",
        "description": "Google's latest flagship high-speed reasoning model."
    },
    {
        "id": "gemini-flash-latest",
        "name": "Gemini Flash Latest (Google)",
        "provider": "gemini",
        "badge": "Always Up-to-Date",
        "icon": "✨",
        "description": "Auto-updated to the newest available Gemini Flash release."
    },
    {
        "id": "openai/gpt-oss-120b",
        "name": "Groq Flagship 120B (Groq)",
        "provider": "groq",
        "badge": "Ultra Fast",
        "icon": "⚡",
        "description": "Blazing fast open weights model hosted on Groq LPU."
    },
    {
        "id": "openai/gpt-oss-20b",
        "name": "Groq Instant 20B (Groq)",
        "provider": "groq",
        "badge": "Instant",
        "icon": "🚀",
        "description": "Lightweight, instant inference for quick questions."
    },
    {
        "id": "nvidia/nemotron-3.5-lightning:free",
        "name": "Nemotron 3.5 Free (OpenRouter)",
        "provider": "openrouter",
        "badge": "Free Tier",
        "icon": "🌙",
        "description": "Active free tier community model on OpenRouter."
    },
    {
        "id": "liquid/lfm-2.5-2.6b:free",
        "name": "Liquid LFM 2.5 Free (OpenRouter)",
        "provider": "openrouter",
        "badge": "Free Tier",
        "icon": "🌸",
        "description": "Efficient and quick free model on OpenRouter."
    },
    {
        "id": "luna-companion",
        "name": "Luna Companion (Built-in Demo)",
        "provider": "builtin",
        "badge": "No Key Needed",
        "icon": "💖",
        "description": "Built-in Luna offline mode for instant chatting without keys."
    }
]

def get_system_prompt(persona_key='girly_sweet', user_name=None):
    base = PERSONA_PROMPTS.get(persona_key, PERSONA_PROMPTS['girly_sweet'])
    if user_name:
        base += f" The user's name or preferred nickname is '{user_name}'. Treat them with warmth and affection."
    return base

def call_groq(api_key, model_name, messages, system_prompt):
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    formatted_messages = [{"role": "system", "content": system_prompt}]
    for m in messages:
        formatted_messages.append({"role": m["role"], "content": m["content"]})
        
    models_to_try = [model_name, "openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    # Remove duplicates preserving order
    seen = set()
    models_queue = [x for x in models_to_try if not (x in seen or seen.add(x))]

    last_err = ""
    for candidate in models_queue:
        payload = {
            "model": candidate,
            "messages": formatted_messages,
            "temperature": 0.7,
            "max_tokens": 4096
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=45)
        except requests.exceptions.Timeout:
            last_err = "Groq Error: Request timed out. Please retry."
            continue
        except requests.exceptions.RequestException as e:
            last_err = f"Groq connection error: {str(e)[:80]}"
            continue
        if response.status_code == 200:
            data = response.json()
            return data['choices'][0]['message']['content']
        else:
            try:
                err = response.json().get('error', {}).get('message', response.text)
            except Exception:
                err = response.text
            last_err = f"Groq Error ({response.status_code}): {err}"
            # If 404 (model not found), try next fallback model
            if response.status_code in [404, 400]:
                continue
            else:
                break
                
    raise Exception(last_err)

def call_openrouter(api_key, model_name, messages, system_prompt):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "Luna AI"
    }
    
    formatted_messages = [{"role": "system", "content": system_prompt}]
    for m in messages:
        formatted_messages.append({"role": m["role"], "content": m["content"]})
        
    models_to_try = [
        model_name,
        "nvidia/nemotron-3.5-lightning:free",
        "liquid/lfm-2.5-2.6b:free",
        "inclusionai/ling-3.0-flash-sante:free"
    ]
    seen = set()
    models_queue = [x for x in models_to_try if not (x in seen or seen.add(x))]

    last_err = ""
    for candidate in models_queue:
        payload = {
            "model": candidate,
            "messages": formatted_messages,
            "temperature": 0.7
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=45)
        except requests.exceptions.Timeout:
            last_err = f"OpenRouter Error: Request timed out. Server is slow, please try again."
            continue
        except requests.exceptions.RequestException as e:
            last_err = f"OpenRouter connection error: {str(e)[:80]}"
            continue

        if response.status_code == 200:
            data = response.json()
            return data['choices'][0]['message']['content']
        else:
            try:
                err = response.json().get('error', {}).get('message', response.text)
            except Exception:
                err = response.text
            last_err = f"OpenRouter Error ({response.status_code}): {err}"
            # If 404 (free model retired or changed), try next candidate
            if response.status_code in [404, 400]:
                continue
            else:
                break

    raise Exception(last_err)

def call_gemini(api_key, model_name, messages, system_prompt):
    contents = []
    for m in messages:
        role = "user" if m["role"] == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": m["content"]}]
        })
        
    payload = {
        "systemInstruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 4096
        }
    }
    headers = {"Content-Type": "application/json"}

    # Ordered models to try: user requested, then robust modern fallbacks
    clean_model = model_name.replace("models/", "")
    models_to_try = [
        clean_model,
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash",
        "gemini-pro-latest"
    ]
    seen = set()
    models_queue = [x for x in models_to_try if not (x in seen or seen.add(x))]

    last_err = ""
    for candidate in models_queue:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{candidate}:generateContent?key={api_key}"
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=45)
        except requests.exceptions.Timeout:
            last_err = f"Gemini Error: Request to {candidate} timed out. Trying fallback..."
            continue
        except requests.exceptions.RequestException as e:
            last_err = f"Gemini connection error: {str(e)[:80]}"
            continue
        
        if response.status_code == 200:
            data = response.json()
            candidates = data.get('candidates', [])
            if candidates:
                parts = candidates[0].get('content', {}).get('parts', [])
                text = "".join(part.get('text', '') for part in parts)
                if text:
                    return text
        else:
            try:
                err_data = response.json()
                err_msg = err_data.get('error', {}).get('message', response.text)
            except Exception:
                err_msg = response.text
            last_err = f"Gemini API Error ({response.status_code}): {err_msg}"
            
            # If model retired or 404/503 spike, try next candidate model
            if response.status_code in [404, 503, 400]:
                continue
            else:
                break

    raise Exception(last_err)

def call_builtin_luna(messages, user_name=None):
    last_user_msg = ""
    for m in reversed(messages):
        if m["role"] == "user":
            last_user_msg = m["content"].strip().lower()
            break
            
    name_str = f", {user_name}" if user_name else ""
    
    if any(k in last_user_msg for k in ["hi", "hello", "hey", "hola"]):
        return (
            f"Hello gorgeous{name_str}! 🌙✨ I'm Luna, your self-hosted AI companion! "
            "I'm currently in **Luna Companion mode**. \n\n"
            "To unlock my full superpowers across **Google Gemini, Groq, or OpenRouter**, "
            "simply click the **⚙️ API Keys** button at the top to add your free key! "
            "How can I brighten your day right now? 🌸💖"
        )
    elif "who are you" in last_user_msg or "what can you do" in last_user_msg:
        return (
            f"I'm **Luna** 🌙✨! A customized, self-hosted AI chatbot built just for you.\n\n"
            "Here's what makes me special:\n"
            "- ⚡ **Multi-Model Support**: Switch seamlessly between Groq, Google Gemini, and OpenRouter.\n"
            "- 🌸 **Girly & Celestial Aesthetic**: Dreamy lavender glow, glassmorphism, markdown code highlighting, and clean history.\n"
            "- 💾 **Persistent Chat History**: All your chats and settings are securely stored in your personal SQLite database.\n"
            "- 🔑 **Bring Your Own Keys**: Keep 100% control of your privacy and API limits.\n\n"
            "Drop in your free Groq or Gemini API key in **Settings** to chat freely about coding, creative writing, science, and life! ✨"
        )
    else:
        return (
            f"Aww, I hear you{name_str}! 🌙✨\n\n"
            f"You asked: *\"{last_user_msg[:100]}\"*\n\n"
            "I'm currently running in **offline companion mode**. To get my in-depth, intelligent response with full logic and code generation, please plug in a free **Groq** or **Gemini** API key in the **⚙️ API Keys** dialog at the top! 🌸💖"
        )

def generate_chat_response(provider, model_name, messages, api_key=None, persona='girly_sweet', user_name=None):
    system_prompt = get_system_prompt(persona, user_name)
    
    if provider == 'builtin' or model_name == 'luna-companion':
        return call_builtin_luna(messages, user_name)
        
    if not api_key:
        return (
            f"✨ **Luna Note**: You have selected **{model_name}** ({provider.title()}), "
            f"but no API key was found for **{provider.title()}**.\n\n"
            f"👉 Please click the **⚙️ API Keys** button in the top bar to paste your {provider.title()} API key, "
            f"or switch to **Luna Companion** in the dropdown! 🌸💖"
        )
        
    if provider == 'groq':
        return call_groq(api_key, model_name, messages, system_prompt)
    elif provider == 'gemini':
        return call_gemini(api_key, model_name, messages, system_prompt)
    elif provider == 'openrouter':
        return call_openrouter(api_key, model_name, messages, system_prompt)
    else:
        raise Exception(f"Unsupported provider: {provider}")
