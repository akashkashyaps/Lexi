# Lexi 🦊 - English Learning Assistant

A sleek, offline educational tool that helps school students improve their English writing skills through interactive conversations with an AI tutor powered by Groq's ultra-fast LLMs.

## Features

- **Interactive Learning**: Students engage in conversations with Lexi, a friendly AI tutor
- **Personalized Experience**: Each session is tailored to the student's name and class level
- **Activity Suggestions**: Get fun writing activities and exercises
- **Gentle Corrections**: Lexi provides helpful feedback and explanations
- **Dark Mode UI**: Modern, sleek interface inspired by corca.app
- **Offline-First**: No database required, runs locally on your machine
- **Ultra-Fast Responses**: Powered by Groq's lightning-fast inference
- **Generous Free Tier**: 30 requests/minute, 14,400 requests/day

## Project Structure

```
Lexi/
├── main.py                 # Main application file (run this!)
├── requirements.txt        # Python dependencies
├── .env                    # Your API key (create this!)
├── .env.example           # Example environment file
├── templates/
│   └── index.html         # HTML template
├── static/
│   ├── style.css          # Dark mode styling
│   └── script.js          # Frontend JavaScript
└── README.md              # This file
```

## Setup Instructions

### 1. Install Python Dependencies

Make sure you have Python 3.8 or higher installed. Then run:

```bash
pip install -r requirements.txt
```

### 2. Get a Groq API Key (FREE!)

1. Go to [Groq Console](https://console.groq.com/)
2. Sign up or log in
3. Go to [API Keys](https://console.groq.com/keys)
4. Create a new API key
5. Copy your API key

### 3. Configure Your API Key

Create a `.env` file in the project root and add your API key:

```
GROQ_API_KEY=your_actual_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

**Important**:
- Replace `your_actual_groq_api_key_here` with your actual Groq API key
- You can change the model to any model available on Groq
- All models are FREE with generous rate limits (30 req/min, 14,400 req/day)
- Available models: `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`, `gemma2-9b-it`

### 4. Run the Application

Simply run:

```bash
python main.py
```

The application will:
- Start the Flask server
- Automatically open your browser at `http://127.0.0.1:5000`
- Display the welcome screen where students can enter their details

## How to Use

### For Students:

1. **Start the App**: Your teacher will run `python main.py`
2. **Enter Details**: Type your name and class
3. **Start Learning**: Click "Start Learning" to begin
4. **Chat with Lexi**: Type messages and practice your English
5. **Get Activities**: Click "Suggest Activity" for fun writing exercises

### For Teachers:

- Run the app with `python main.py`
- Students can use it on the same computer
- No internet required after initial API setup
- Monitor student progress through conversations
- Restart the app for a new session

## Educational Approach

Lexi is specifically designed for ESL (English as Second/Third Language) students:

### Interactive Learning Features:

- **Activity-Based Learning**: 10 structured writing exercises across 3 difficulty levels
- **Contextual Feedback**: Clear explanations of WHY something is wrong, not just WHAT
- **Vocabulary Building**: Suggests better words with explanations and example sentences
- **Interactive Grammar Exercises**: Fill-in-the-blanks and grammar challenges during conversations
- **Encouraging Tone**: Celebrates progress and makes mistakes feel okay
- **Patient Corrections**: Simple, clear explanations suitable for non-native speakers

### How Lexi Teaches:

1. **Acknowledges** what the student wrote
2. **Provides specific feedback** - corrections with explanations + praise
3. **Suggests improvements** OR gives a quick grammar exercise OR asks follow-up questions
4. **Ends with encouragement** to keep them motivated

### Example Teaching Style:

**Student writes:** "I go to market yesterday"

**Lexi responds:** "Good effort! I can see you're talking about the past. When we talk about yesterday, we use past tense. So instead of 'go', we use 'went'. The correct sentence is: 'I went to the market yesterday.' Also, we usually say 'the market' in English. Try writing another sentence about what you saw at the market!"

## Why Groq?

The app uses **Groq** for ultra-fast, free AI inference:

### Benefits of Groq:
- **Completely FREE**: Generous free tier with no credit card required
- **Ultra-Fast**: Fastest LLM inference in the industry (500+ tokens/second)
- **High Rate Limits**: 30 requests/minute, 14,400 requests/day
- **Perfect for Classrooms**: Multiple students can use it without hitting limits
- **Latest Models**: Llama 3.3 70B, Mixtral, Gemma 2

### Default Model: Llama 3.3 70B Versatile
- State-of-the-art performance
- Excellent for educational conversations
- Perfect English teaching capabilities
- Fast and responsive

### Other Available Models:
You can change the model in your `.env` file:
- `llama-3.3-70b-versatile` - Recommended (best balance)
- `llama-3.1-70b-versatile` - Alternative large model
- `mixtral-8x7b-32768` - Great for longer contexts
- `gemma2-9b-it` - Smaller, faster model
- See all models at [Groq Models](https://console.groq.com/docs/models)

## Technical Details

- **Backend**: Python with Flask
- **AI Provider**: Groq API
- **Default Model**: Llama 3.3 70B Versatile (Free)
- **Frontend**: Vanilla JavaScript, HTML, CSS with markdown support
- **Storage**: In-memory (no database)
- **UI Design**: Dark mode with gradient accents
- **Rate Limits**: 30 requests/minute, 14,400 requests/day

## Troubleshooting

### "GROQ_API_KEY not found" error
- Make sure you created the `.env` file in the project root
- Check that the API key is correctly copied from Groq Console
- Ensure there are no extra spaces or quotes
- File should look like: `GROQ_API_KEY=gsk_xxxxx`

### Browser doesn't open automatically
- Manually go to `http://127.0.0.1:5000` in your browser

### Connection errors
- Check your internet connection (needed for API calls)
- Verify your API key is valid
- Ensure port 5000 is not being used by another application

## Safety & Privacy

- No student data is stored permanently
- Conversations are only kept in memory during the session
- No personal information is sent to external services (except to Gemini API for responses)
- Restart the app to clear all conversation history

## Future Enhancements

Potential features to add:
- Progress tracking
- Writing skill assessments
- Vocabulary lists
- Multiple language support
- Teacher dashboard
- Export conversation logs

## License

This project is created for educational purposes.

## Support

For issues or questions, please check:
1. Your `.env` file is configured correctly
2. All dependencies are installed
3. You have an active internet connection
4. Your Groq API key is valid

---

**Made with ❤️ for students learning English**
