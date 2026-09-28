import os
import sys
import uuid
import sqlite3
from functools import wraps
from datetime import datetime

# Load .env file if python-dotenv is installed
try:
    from dotenv import load_dotenv
    _env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    load_dotenv(dotenv_path=_env_path, override=True)
except ImportError:
    pass

# Windows terminal UTF-8 safety
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
from flask import (
    Flask, render_template, request, redirect, url_for,
    session, jsonify, flash
)
from werkzeug.security import generate_password_hash, check_password_hash

from database import init_db, get_db
from ai_providers import (
    AVAILABLE_MODELS, PERSONA_PROMPTS,
    generate_chat_response
)

app = Flask(__name__)
app.secret_key = os.environ.get('LUNA_SECRET_KEY', 'luna_celestial_secret_sparkle_2026_!@#')

# Ensure DB is created on startup
init_db()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized. Please log in.'}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def get_current_user():
    if 'user_id' not in session:
        return None
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, preferred_name, persona_tone, created_at FROM users WHERE id = ?", (session['user_id'],))
        row = cursor.fetchone()
        return dict(row) if row else None

# ----------------- AUTH ROUTES ----------------- #

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('index'))
        
    if request.method == 'POST':
        login_input = request.form.get('username_or_email', '').strip()
        password = request.form.get('password', '').strip()
        
        if not login_input or not password:
            flash('Please enter your username/email and password', 'error')
            return render_template('login.html', username_or_email=login_input)
            
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?",
                (login_input, login_input)
            )
            user = cursor.fetchone()
            
            if user and check_password_hash(user['password_hash'], password):
                session['user_id'] = user['id']
                session['username'] = user['username']
                flash(f"Welcome back, {user['username']}! 🌙", 'success')
                return redirect(url_for('index'))
            else:
                flash('Invalid credentials. Please double-check and try again', 'error')
                return render_template('login.html', username_or_email=login_input)
                
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(url_for('index'))
        
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '').strip()
        preferred_name = request.form.get('preferred_name', '').strip()
        
        if not username or not email or not password:
            flash('All required fields must be filled out', 'error')
            return render_template('register.html', username=username, email=email, preferred_name=preferred_name)
            
        if len(password) < 6:
            flash('Password must be at least 6 characters long', 'error')
            return render_template('register.html', username=username, email=email, preferred_name=preferred_name)
            
        password_hash = generate_password_hash(password)
        
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO users (username, email, password_hash, preferred_name) VALUES (?, ?, ?, ?)",
                    (username, email, password_hash, preferred_name or username)
                )
                user_id = cursor.lastrowid
                
            session['user_id'] = user_id
            session['username'] = username
            flash('Account created! Welcome to Luna 🌙', 'success')
            return redirect(url_for('index'))
        except sqlite3.IntegrityError:
            flash('That username or email is already registered!', 'error')
            return render_template('register.html', username=username, email=email, preferred_name=preferred_name)
            
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out. See you soon! 🌙', 'info')
    return redirect(url_for('login'))

# ----------------- MAIN APP ----------------- #

@app.route('/')
@login_required
def index():
    user = get_current_user()
    if not user:
        session.clear()
        return redirect(url_for('login'))
        
    # Get user's configured keys info
    keys_status = {}
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT provider, api_key FROM user_keys WHERE user_id = ?", (user['id'],))
        for row in cursor.fetchall():
            k = row['api_key']
            masked = f"...{k[-4:]}" if len(k) > 4 else "***"
            keys_status[row['provider']] = {
                'configured': True,
                'masked': masked
            }
            
    return render_template(
        'index.html',
        user=user,
        models=AVAILABLE_MODELS,
        personas=PERSONA_PROMPTS,
        keys_status=keys_status
    )

# ----------------- API ROUTES ----------------- #

@app.route('/api/conversations', methods=['GET'])
@login_required
def list_conversations():
    user_id = session['user_id']
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, title, model_provider, model_name, created_at, updated_at
            FROM conversations
            WHERE user_id = ?
            ORDER BY updated_at DESC
            """,
            (user_id,)
        )
        convs = [dict(row) for row in cursor.fetchall()]
    return jsonify({'conversations': convs})

@app.route('/api/conversations', methods=['POST'])
@login_required
def create_conversation():
    user_id = session['user_id']
    data = request.get_json() or {}
    conv_id = str(uuid.uuid4())
    title = data.get('title', 'New Chat')
    model_provider = data.get('model_provider', 'groq')
    model_name = data.get('model_name', 'llama-3.3-70b-versatile')
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO conversations (id, user_id, title, model_provider, model_name)
            VALUES (?, ?, ?, ?, ?)
            """,
            (conv_id, user_id, title, model_provider, model_name)
        )
    return jsonify({
        'id': conv_id,
        'title': title,
        'model_provider': model_provider,
        'model_name': model_name
    }), 201

@app.route('/api/conversations/<conv_id>', methods=['GET'])
@login_required
def get_conversation(conv_id):
    user_id = session['user_id']
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, title, model_provider, model_name, created_at, updated_at FROM conversations WHERE id = ? AND user_id = ?",
            (conv_id, user_id)
        )
        conv = cursor.fetchone()
        if not conv:
            return jsonify({'error': 'Conversation not found'}), 404
            
        cursor.execute(
            "SELECT id, role, content, model, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC",
            (conv_id,)
        )
        messages = [dict(row) for row in cursor.fetchall()]
        
    return jsonify({
        'conversation': dict(conv),
        'messages': messages
    })

@app.route('/api/conversations/<conv_id>', methods=['PATCH'])
@login_required
def update_conversation(conv_id):
    user_id = session['user_id']
    data = request.get_json() or {}
    new_title = data.get('title', '').strip()
    
    if not new_title:
        return jsonify({'error': 'Title cannot be empty'}), 400
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            (new_title, conv_id, user_id)
        )
        if cursor.rowcount == 0:
            return jsonify({'error': 'Conversation not found'}), 404
            
    return jsonify({'success': True, 'title': new_title})

@app.route('/api/conversations/<conv_id>', methods=['DELETE'])
@login_required
def delete_conversation(conv_id):
    user_id = session['user_id']
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM conversations WHERE id = ? AND user_id = ?", (conv_id, user_id))
        if cursor.rowcount == 0:
            return jsonify({'error': 'Conversation not found'}), 404
            
    return jsonify({'success': True})

@app.route('/api/chat', methods=['POST'])
@login_required
def chat():
    user_id = session['user_id']
    data = request.get_json() or {}
    
    message_text = data.get('message', '').strip()
    conv_id = data.get('conversation_id')
    model_name = data.get('model_name', 'gemini-3.8-flash')
    provider = data.get('provider', 'gemini')
    
    if not message_text:
        return jsonify({'error': 'Message content is required'}), 400
        
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Fetch user data (preferred name, persona)
        cursor.execute("SELECT preferred_name, persona_tone FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        preferred_name = user_row['preferred_name'] if user_row else None
        persona_tone = user_row['persona_tone'] if user_row else 'girly_sweet'
        
        # 2. Check or create conversation
        is_new_conv = False
        if not conv_id:
            conv_id = str(uuid.uuid4())
            # Generate short title from first prompt
            first_title = message_text[:28] + ('...' if len(message_text) > 28 else '')
            cursor.execute(
                """
                INSERT INTO conversations (id, user_id, title, model_provider, model_name)
                VALUES (?, ?, ?, ?, ?)
                """,
                (conv_id, user_id, first_title, provider, model_name)
            )
            is_new_conv = True
        else:
            cursor.execute("SELECT id, title FROM conversations WHERE id = ? AND user_id = ?", (conv_id, user_id))
            conv_row = cursor.fetchone()
            if not conv_row:
                return jsonify({'error': 'Conversation not found'}), 404
                
        # 3. Insert user message
        cursor.execute(
            "INSERT INTO messages (conversation_id, role, content, model) VALUES (?, 'user', ?, ?)",
            (conv_id, message_text, model_name)
        )
        user_msg_id = cursor.lastrowid
        
        # 4. Fetch past messages for context (up to last 15 messages)
        cursor.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 20",
            (conv_id,)
        )
        context_messages = [dict(row) for row in cursor.fetchall()]
        
        # 5. Fetch API key for this provider
        api_key = None
        if provider != 'builtin':
            cursor.execute(
                "SELECT api_key FROM user_keys WHERE user_id = ? AND provider = ?",
                (user_id, provider)
            )
            key_row = cursor.fetchone()
            if key_row:
                api_key = key_row['api_key']
            else:
                # Check environment variables fallback
                env_var_map = {
                    'groq': 'GROQ_API_KEY',
                    'gemini': 'GEMINI_API_KEY',
                    'openrouter': 'OPENROUTER_API_KEY'
                }
                api_key = os.environ.get(env_var_map.get(provider, ''))

    # Call AI Provider
    try:
        reply_text = generate_chat_response(
            provider=provider,
            model_name=model_name,
            messages=context_messages,
            api_key=api_key,
            persona=persona_tone,
            user_name=preferred_name
        )
    except Exception as e:
        reply_text = f"**Luna encountered an issue**: {str(e)}\n\n*Check your API key in settings or try another model in the dropdown.*"

    # Save assistant reply and update conversation timestamp
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO messages (conversation_id, role, content, model) VALUES (?, 'assistant', ?, ?)",
            (conv_id, reply_text, model_name)
        )
        asst_msg_id = cursor.lastrowid
        
        cursor.execute(
            "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP, model_provider = ?, model_name = ? WHERE id = ?",
            (provider, model_name, conv_id)
        )
        
        cursor.execute("SELECT title FROM conversations WHERE id = ?", (conv_id,))
        current_title = cursor.fetchone()['title']

    return jsonify({
        'conversation_id': conv_id,
        'title': current_title,
        'is_new': is_new_conv,
        'user_message': {
            'id': user_msg_id,
            'role': 'user',
            'content': message_text
        },
        'assistant_message': {
            'id': asst_msg_id,
            'role': 'assistant',
            'content': reply_text,
            'model': model_name
        }
    })

# ----------------- SETTINGS & KEYS API ----------------- #

@app.route('/api/settings', methods=['GET'])
@login_required
def get_settings():
    user = get_current_user()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT provider, api_key, updated_at FROM user_keys WHERE user_id = ?", (user['id'],))
        keys_data = {}
        for row in cursor.fetchall():
            k = row['api_key']
            masked = f"...{k[-4:]}" if len(k) > 4 else "***"
            keys_data[row['provider']] = {
                'configured': True,
                'masked': masked,
                'updated_at': row['updated_at']
            }
            
    return jsonify({
        'user': user,
        'keys': keys_data,
        'models': AVAILABLE_MODELS
    })

@app.route('/api/settings/keys', methods=['POST'])
@login_required
def save_keys():
    user_id = session['user_id']
    data = request.get_json() or {}
    
    # data format: { "gemini": "AIza...", "groq": "gsk_...", "openrouter": "sk-or-..." }
    with get_db() as conn:
        cursor = conn.cursor()
        for provider in ['groq', 'gemini', 'openrouter']:
            if provider in data:
                key_value = data[provider].strip()
                if key_value:
                    cursor.execute(
                        """
                        INSERT INTO user_keys (user_id, provider, api_key, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(user_id, provider) DO UPDATE SET
                            api_key = excluded.api_key,
                            updated_at = CURRENT_TIMESTAMP
                        """,
                        (user_id, provider, key_value)
                    )
                else:
                    # Clear key if empty string passed
                    cursor.execute("DELETE FROM user_keys WHERE user_id = ? AND provider = ?", (user_id, provider))
                    
    return jsonify({'success': True, 'message': 'API keys updated successfully!'})

@app.route('/api/settings/profile', methods=['POST'])
@login_required
def update_profile():
    user_id = session['user_id']
    data = request.get_json() or {}
    preferred_name = data.get('preferred_name', '').strip()
    persona_tone = data.get('persona_tone', 'girly_sweet').strip()
    
    if persona_tone not in PERSONA_PROMPTS:
        persona_tone = 'girly_sweet'
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET preferred_name = ?, persona_tone = ? WHERE id = ?",
            (preferred_name, persona_tone, user_id)
        )
        
    return jsonify({'success': True, 'message': 'Preferences saved!'})

if __name__ == '__main__':
    print("[*] Luna AI is starting on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
