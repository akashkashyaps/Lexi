# Lexi 🦊 - English Learning Assistant

An educational web app that helps school students improve their English writing skills through interactive conversations with an AI tutor, powered by Groq and Azure AI.

## Features

- **Interactive Learning**: Students engage in conversations with Lexi, a friendly AI tutor
- **Personalized Experience**: Each session is tailored to the student's name and class level
- **Activity-Based Learning**: 12 structured writing exercises across think-in-English, foundation, beginner, intermediate, advanced, and story-mode levels
- **Clear Task Intros**: Each activity opens with its title and description shown up front, before the AI's first message
- **Varied, Non-Repetitive Examples**: Activity scaffolds rotate topics/word banks every session instead of recycling the same examples
- **Active Grammar Correction**: Lexi is primed to catch and explain common mistakes (have/has, is/are/am, subject-verb agreement, articles, tense) across every activity
- **Gentle Corrections**: Feedback is patient, simple, and encouraging — one issue at a time
- **AI Servers**: Up to 15 numbered servers (Groq or Azure AI keys). Each student picks one when they sign in and keeps it for the whole session
- **Dark Mode UI**: Modern, sleek interface

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

### 2. Get API Keys

Each **server** students can pick is one API key. You can mix providers:

- **Groq** (free): create keys at [console.groq.com/keys](https://console.groq.com/keys). Use one key per Groq account, since restrictions apply to the whole account.
- **Azure AI Foundry**: in your Azure AI resource, copy the key and the `…/openai/v1` endpoint, and note the deployment name (for example `gpt-5-mini`).

### 3. Configure the Servers

Create a `.env` file in the project root:

```
GROQ_MODEL=openai/gpt-oss-120b

# Server 1 and 2: Groq (type defaults to groq)
SERVER_1_KEY=your_groq_key_here
SERVER_2_KEY=your_other_groq_key_here

# Server 3: Azure AI Foundry
SERVER_3_TYPE=azure
SERVER_3_ENDPOINT=https://<your-resource>.services.ai.azure.com/openai/v1
SERVER_3_MODEL=gpt-5-mini
SERVER_3_KEY=your_azure_key_here

# Optional — enables activity images in Story Mode
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here
```

**Notes**:
- Use numbers 1 to 15. Only servers with a real key show up in the sign-in list.
- `SERVER_<n>_MODEL` is optional for Groq servers (defaults to `GROQ_MODEL`) and required for Azure.
- Older `GROQ_API_KEY_<n>` settings still work if no `SERVER_` settings are set.
- `.env` is gitignored — never commit real API keys.
- To see which servers work, open `/health/servers?live=1` while the app runs. It sends one tiny message to each server.

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

Set the same `SERVER_<n>_…` and `GROQ_MODEL` variables in your host's environment settings — `.env` is not read in most PaaS deployments unless you upload it, so these must be added directly in the dashboard.

## How to Use

### For Students:

1. Open the app in your browser
2. Enter your name and class, and pick the server your teacher gives you
3. Pick an activity — you'll see its title and description before the chat starts
4. Chat with Lexi and practice your English
5. Each session has a limit of 80 messages (shown as a counter)

### For Teachers:

- Deploy once; students connect via the shared URL (or run locally on a shared computer)
- No student data is stored permanently — conversations live in memory only, per session
- API keys are managed centrally; students never see or enter one

## Why Servers?

Free AI keys have per-minute and per-day limits. Each student picks a server number and keeps it for the whole session, so spreading a class across servers spreads the load. If a server stops answering (for example a restricted Groq account), students can pick another one, and `/health/servers?live=1` shows which servers are down.

## Model Notes

The app currently defaults to **`openai/gpt-oss-120b`**. This was chosen deliberately: some Groq models (e.g. `qwen/qwen3-32b`) are reasoning models that return their internal "thinking" mixed into the same response field, which can leak raw reasoning text into the chat if a reply gets cut off mid-thought. `openai/gpt-oss-120b` returns reasoning in a separate field from the actual reply, so students only ever see the clean final answer.

Azure `gpt-5` models are reasoning models too, but they keep their reasoning out of the reply. Lexi gives them a larger token limit and low reasoning effort so replies stay quick.

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

## Arcade Game Data

The two arcade games (Word Catcher and Grammar Runner) need no AI and no API keys. Their word lists and questions are built once, offline, by a script:

```bash
pip install -r tools/requirements-build.txt
python tools/build_game_data.py
```

The first run downloads the sources (about 30 MB) into `tools/.cache/`. The script then writes two files:

- `static/games/data/word-catcher.json`:
  - words sorted by part of speech, keeping only clear-cut words. A word is dropped if it is commonly used as more than one part of speech, like *run* or *light*. The checks use the Brown Corpus and WordNet.
  - word-form pairs: past tense, plural, and he/she/it + s.
- `static/games/data/grammar-runner.json`: fill-the-gap questions on the six topics, made by rule from short [Tatoeba](https://tatoeba.org) sentences.

Both are limited to kid-level vocabulary: words children learn by about age 7½ (Kuperman age-of-acquisition ratings) or very common English words. If either file is missing, its game falls back to the small built-in lists.

**Credits:**
- Sentences: Tatoeba, [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/).
- Age-of-acquisition ratings: Kuperman, Stadthagen-Gonzalez & Brysbaert (2012), via [NoRaRe](https://norare.clld.org), CC BY 4.0.
- Word classes: Brown Corpus (via NLTK) and WordNet (Princeton).

## Technical Details

- **Backend**: Python with Flask
- **AI Providers**: Groq and Azure AI Foundry, one key per numbered server (see above)
- **Default Model**: `openai/gpt-oss-120b`
- **Frontend**: Vanilla JavaScript, HTML, CSS with markdown-style formatting
- **Storage**: In-memory only — no database, no persistence across restarts
- **Deployment**: Render/Railway via `Procfile` (`gunicorn main:app`)

## Troubleshooting

### No servers in the list, or "Server N is not set up"
- Check that `SERVER_<n>_KEY` is set and doesn't still contain a placeholder value (Azure servers also need `SERVER_<n>_ENDPOINT` and `SERVER_<n>_MODEL`)
- On a hosted deployment, confirm the env vars are set in the host's dashboard, not just your local `.env`
- Open `/health/servers?live=1`: `organization_restricted` means that Groq account is blocked, so use a key from another account

### Browser doesn't open automatically (local run)
- Manually go to `http://127.0.0.1:5000` in your browser

### Connection errors
- Check your internet connection (needed for API calls)
- Open `/health/servers?live=1` to see which servers answer
- Ensure port 5000 (local) isn't being used by another application

### Model responses look like raw internal reasoning or are cut off
- The configured model is likely a reasoning model returning its thoughts inline. Switch `GROQ_MODEL` to one that separates reasoning from the final answer (see [Model Notes](#model-notes)).

## Safety & Privacy

- No student data is stored permanently
- Conversations are only kept in memory during the session
- No personal information is sent to external services other than the AI servers (Groq / Azure AI, for responses) and, optionally, Unsplash (for Story Mode images)
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
