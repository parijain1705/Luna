import sys
import requests
import json

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def test_endpoints():
    BASE_URL = "http://127.0.0.1:5000"
    session = requests.Session()

    import time
    test_user = f"user_{int(time.time())}"
    print(f"1. Testing Registration with {test_user}...")
    reg_data = {
        'username': test_user,
        'preferred_name': 'Pari 🌸',
        'email': f'{test_user}@test.com',
        'password': 'password123'
    }
    r = session.post(f"{BASE_URL}/register", data=reg_data, allow_redirects=True)
    print("Registration status:", r.status_code)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"

    print("2. Testing Authenticated Index Page...")
    r = session.get(f"{BASE_URL}/")
    assert "Luna" in r.text
    print("Index page rendered successfully!")

    print("3. Testing List Conversations (empty initially)...")
    r = session.get(f"{BASE_URL}/api/conversations")
    assert r.status_code == 200
    convs = r.json().get('conversations', [])
    print(f"Conversations found: {len(convs)}")

    print("4. Testing Chat Endpoint with Built-in / Fallback Luna...")
    chat_payload = {
        'message': 'Hello Luna, who are you and what models do you support?',
        'model_name': 'luna-companion',
        'provider': 'builtin'
    }
    r = session.post(f"{BASE_URL}/api/chat", json=chat_payload)
    assert r.status_code == 200
    data = r.json()
    conv_id = data['conversation_id']
    asst_reply = data['assistant_message']['content']
    print(f"Conversation created: {conv_id}")
    print(f"Luna reply snippet: {asst_reply[:120]}...")

    print("5. Testing Fetching Messages for Conversation...")
    r = session.get(f"{BASE_URL}/api/conversations/{conv_id}")
    assert r.status_code == 200
    msgs = r.json().get('messages', [])
    print(f"Messages count in conversation: {len(msgs)}")
    assert len(msgs) == 2

    print("6. Testing Conversation Rename...")
    r = session.patch(f"{BASE_URL}/api/conversations/{conv_id}", json={'title': 'My Intro with Luna ✨'})
    assert r.status_code == 200
    print("Rename successful!")

    print("7. Testing Settings & Key Storage...")
    keys_payload = {
        'groq': 'gsk_mocktestkey1234567890',
        'gemini': 'AIzaSyMockGeminiKey1234567'
    }
    r = session.post(f"{BASE_URL}/api/settings/keys", json=keys_payload)
    assert r.status_code == 200
    
    r = session.get(f"{BASE_URL}/api/settings")
    assert r.status_code == 200
    settings = r.json()
    print("Configured keys in DB:", list(settings['keys'].keys()))
    assert 'groq' in settings['keys']
    assert 'gemini' in settings['keys']

    print("8. Testing Profile/Persona Update...")
    r = session.post(f"{BASE_URL}/api/settings/profile", json={
        'preferred_name': 'Queen Pari 👑',
        'persona_tone': 'sassy_bestie'
    })
    assert r.status_code == 200
    print("Profile update successful!")

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Luna is fully working.")

if __name__ == '__main__':
    test_endpoints()
