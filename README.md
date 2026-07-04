# Lexi 🦊 - English Learning Assistant

An educational web app that helps school students improve their English writing skills through interactive conversations with an AI tutor, powered by Groq's ultra-fast LLMs.

## Features

- **Interactive Learning**: Students engage in conversations with Lexi, a friendly AI tutor
- **Personalized Experience**: Each session is tailored to the student's name and class level
- **Activity-Based Learning**: 12 structured writing exercises across think-in-English, foundation, beginner, intermediate, advanced, and story-mode levels
- **Clear Task Intros**: Each activity opens with its title and description shown up front, before the AI's first message
- **Varied, Non-Repetitive Examples**: Activity scaffolds rotate topics/word banks every session instead of recycling the same examples
- **Active Grammar Correction**: Lexi is primed to catch and explain common mistakes (have/has, is/are/am, subject-verb agreement, articles, tense) across every activity
- **Gentle Corrections**: Feedback is patient, simple, and encouraging — one issue at a time
- **Pooled API Keys**: Supports a pool of up to 10 Groq API keys shared across all students/classes, with automatic load balancing and daily rate-limit protection
- **Dark Mode UI**: Modern, sleek interface
- **Ultra-Fast Responses**: Powered by Groq's lightning-fast inference

## Project Structure

```
Lexi/
├── main.py                 # Main application file (run this!)
├── requirements.txt        # Python dependencies
├── Procfile                # Deployment start command (gunicorn)
├── .env                    # Your API keys (create this, never commit it!)
├── templates/
│   └── index.html          # HTML template
├── static/
│   ├── style.css           # Dark mode styling
│   └── script.js           # Frontend JavaScript
└── README.md               # This file
```

## Setup Instructions

### 1. Install Python Dependencies

Make sure you have Python 3.8 or higher installed. Then run:

```bash
pip install -r requirements.txt
```

### 2. Get Groq API Keys (FREE!)

1. Go to [Groq Console](https://console.groq.com/)
2. Sign up or log in
3. Go to [API Keys](https://console.groq.com/keys)
4. Create as many keys as you need (up to 10 are supported) — one key per Google/Groq account you have access to

Using multiple keys spreads load across each key's daily request quota, which matters if many students/systems are active at once (see [Why a Key Pool?](#why-a-key-pool) below).

### 3. Configure Your API Keys

Create a `.env` file in the project root:

```
GROQ_API_KEY_1=your_first_groq_api_key_here
GROQ_API_KEY_2=your_second_groq_api_key_here
GROQ_API_KEY_3=...
# ...up to GROQ_API_KEY_10

GROQ_MODEL=openai/gpt-oss-120b

# Optional — enables activity images in Story Mode
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
```

**Notes**:
- You don't need all 10 keys — the app only pools whichever `GROQ_API_KEY_N` variables are actually set.
- `.env` is gitignored — never commit real API keys.
- `GROQ_DAILY_KEY_LIMIT` (optional, default `950`) controls the safety buffer under Groq's daily cap per key.

### 4. Run the Application

Locally:

```bash
python main.py
```

This starts the Flask dev server and opens your browser at `http://127.0.0.1:5000`.

In production (e.g. Render, Railway), the `Procfile` runs:

```bash
gunicorn main:app
```

Set the same `GROQ_API_KEY_1..10` and `GROQ_MODEL` variables in your host's environment settings — `.env` is not read in most PaaS deployments unless you upload it, so these must be added directly in the dashboard.

## How to Use

### For Students:

1. Open the app in your browser
2. Enter your name and class
3. Pick an activity — you'll see its title and description before the chat starts
4. Chat with Lexi and practice your English
5. Each session has a limit of 80 messages (shown as a counter)

### For Teachers:

- Deploy once; students connect via the shared URL (or run locally on a shared computer)
- No student data is stored permanently — conversations live in memory only, per session
- API keys are managed centrally; students never see or enter one

## Why a Key Pool?

Groq's free tier caps each API key at roughly 1,000 requests/day. A classroom with many students/systems active at once can exceed a single key's daily quota. Instead of assigning one fixed key per class, Lexi pools all configured keys:

- When a student starts a session, the app assigns them the **least-used key so far today** (tracked in memory, resetting automatically at midnight).
- The assigned key sticks with that student for their whole session.
- If a key nears its daily limit, it's skipped in favor of a fresher one.
- If every pooled key is exhausted for the day, new sessions get a clear error instead of a silent failure.

This means total daily capacity scales directly with how many keys you add (e.g. 10 keys ≈ ~9,500 requests/day of safe headroom), without any class-specific configuration.

## Model Notes

The app currently defaults to **`openai/gpt-oss-120b`**. This was chosen deliberately: some Groq models (e.g. `qwen/qwen3-32b`) are reasoning models that return their internal "thinking" mixed into the same response field, which can leak raw reasoning text into the chat if a reply gets cut off mid-thought. `openai/gpt-oss-120b` returns reasoning in a separate field from the actual reply, so students only ever see the clean final answer.

If you change `GROQ_MODEL`, check the raw API response for a `reasoning` field vs. inline `<think>` tags in `content` before assuming it's safe for a student-facing chat.

## Educational Approach

Lexi is specifically designed for ESL (English as Second/Third Language) students:

### Interactive Learning Features:

- **Activity-Based Learning**: 12 structured writing exercises across 6 levels (think-in-English, foundation, beginner, intermediate, advanced, story mode)
- **Contextual Feedback**: Clear explanations of WHY something is wrong, not just WHAT
- **Active Grammar Focus**: Explicitly watches for have/has, is/are/am, do/does, subject-verb agreement, article, and tense mistakes — correcting one issue at a time with a simple explanation
- **Vocabulary Building**: Suggests better words with explanations and example sentences, rotating word banks so sessions don't feel repetitive
- **Encouraging Tone**: Celebrates progress and makes mistakes feel okay
- **Patient Corrections**: Simple, clear explanations suitable for non-native speakers

### How Lexi Teaches:

1. **Acknowledges** what the student wrote
2. **Provides specific feedback** — corrections with explanations + praise
3. **Suggests improvements** OR gives a quick grammar exercise OR asks follow-up questions
4. **Ends with encouragement** to keep them motivated

### Example Teaching Style:

**Student writes:** "He have a bag"

**Lexi responds:** "Good try! Just one small fix: for *he/she/it*, we use **has**, not have. So it's: 'He **has** a bag.' Want to try another sentence with 'has'?"

## Technical Details

- **Backend**: Python with Flask
- **AI Provider**: Groq API (pooled keys, see above)
- **Default Model**: `openai/gpt-oss-120b`
- **Frontend**: Vanilla JavaScript, HTML, CSS with markdown-style formatting
- **Storage**: In-memory only — no database, no persistence across restarts
- **Deployment**: Render/Railway via `Procfile` (`gunicorn main:app`)

## Troubleshooting

### "No API keys available right now" error
- Check that at least one `GROQ_API_KEY_N` env var is set and doesn't still contain a placeholder value
- On a hosted deployment, confirm the env vars are set in the host's dashboard, not just your local `.env`
- If all keys have hit their daily limit, wait until the next day or add more keys

### Browser doesn't open automatically (local run)
- Manually go to `http://127.0.0.1:5000` in your browser

### Connection errors
- Check your internet connection (needed for API calls)
- Verify your API keys are valid at [Groq Console](https://console.groq.com/keys)
- Ensure port 5000 (local) isn't being used by another application

### Model responses look like raw internal reasoning or are cut off
- The configured model is likely a reasoning model returning its thoughts inline. Switch `GROQ_MODEL` to one that separates reasoning from the final answer (see [Model Notes](#model-notes)).

## Safety & Privacy

- No student data is stored permanently
- Conversations are only kept in memory during the session
- No personal information is sent to external services other than Groq (for AI responses) and, optionally, Unsplash (for Story Mode images)
- Restarting the app clears all conversation history and daily key-usage counters

## Future Enhancements

Potential features to add:
- Persistent progress tracking (would need a real database — dropped for now to keep things simple/free)
- Writing skill assessments
- Vocabulary lists
- Teacher dashboard
- Export conversation logs

## License

This project is created for educational purposes.

---

**Made with ❤️ for students learning English**
