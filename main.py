"""
Lexi - English Learning Assistant
Main application file
"""
import os
import re
import webbrowser
from threading import Timer
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import requests
import json

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure Groq API
GROQ_MODEL = os.getenv('GROQ_MODEL', 'moonshotai/kimi-k2-instruct-0905')

# Fixed 1-to-1 mapping: each physical computer picks a number (1-15) and
# always uses that same dedicated key — no sharing, no auto-balancing.
# This avoids multiple concurrent students ever competing for one key's
# per-minute token budget.
COMPUTER_KEYS = {
    str(i): os.getenv(f'GROQ_API_KEY_{i}')
    for i in range(1, 16)
}


def get_key_for_computer(computer_number):
    """Return the dedicated API key for a given computer number, if configured"""
    key = COMPUTER_KEYS.get(str(computer_number))
    if key and not key.startswith('your_key_'):
        return key
    return None


# Configure Unsplash API
UNSPLASH_ACCESS_KEY = os.getenv('UNSPLASH_ACCESS_KEY')

# Store conversation history (in-memory for offline use)
conversations = {}

# Number of recent user/assistant exchanges to keep when trimming history
# for long-running sessions (keeps each Groq call's token size bounded)
HISTORY_WINDOW = 10


def trim_history(messages):
    """Keep the system message plus only the last HISTORY_WINDOW exchanges,
    so a long session's token size per call stays bounded. The task/rules
    always survive trimming since they live in the system message, not
    in the turns being dropped."""
    system_message = messages[0]
    turns = messages[1:]
    max_turns = HISTORY_WINDOW * 2
    if len(turns) <= max_turns:
        return messages
    return [system_message] + turns[-max_turns:]


def call_groq(messages, api_key):
    """Call Groq API with conversation history"""
    try:
        response = requests.post(
            url="https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": GROQ_MODEL,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 1024
            }
        )

        response.raise_for_status()
        data = response.json()
        content = data['choices'][0]['message']['content']
        # Strip reasoning-model <think> blocks before showing output to students
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
        return content

    except Exception as e:
        print(f"Groq API Error: {e}")
        raise


def fetch_unsplash_image(search_term):
    """Fetch image from Unsplash API"""
    if not UNSPLASH_ACCESS_KEY:
        return None

    try:
        response = requests.get(
            "https://api.unsplash.com/search/photos",
            headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
            params={
                "query": search_term,
                "per_page": 1,
                "orientation": "landscape"
            }
        )
        data = response.json()
        if data.get('results'):
            return data['results'][0]['urls']['regular']  # 1080px width
        return None
    except Exception as e:
        print(f"Unsplash API error: {e}")
        return None


# ==================== SCORING ====================

# Base points per message, by activity difficulty tier — harder activities
# are worth more from the start, rewarding students who attempt them
BASE_POINTS_BY_LEVEL = {
    'beginner': 8,
    'intermediate': 14,
    'advanced': 22,
    'story': 30,
}

# BGMI-style rank ladder. Each rank needs a score threshold AND (for the
# higher ranks) evidence the student attempted a harder activity tier —
# so climbing requires real growth, not just grinding easy activities.
RANK_LADDER = [
    {'name': 'Bronze', 'score': 0, 'requires_level': None},
    {'name': 'Silver', 'score': 40, 'requires_level': None},
    {'name': 'Gold', 'score': 100, 'requires_level': 'intermediate'},
    {'name': 'Platinum', 'score': 220, 'requires_level': 'advanced'},
    {'name': 'Diamond', 'score': 400, 'requires_level': 'advanced'},
    {'name': 'Crown', 'score': 700, 'requires_level': 'story'},
    {'name': 'Ace', 'score': 1100, 'requires_level': 'story'},
    {'name': 'Conqueror', 'score': 1600, 'requires_level': 'story', 'requires_clean_streak': 10},
]

# Difficulty tiers in ascending order, used to check "attempted at least X"
LEVEL_ORDER = ['beginner', 'intermediate', 'advanced', 'story']

# Phrases in Lexi's response that indicate she flagged a grammar mistake
MISTAKE_KEYWORDS = [
    'instead of', 'should be', 'correct way', 'small fix', 'not have',
    'we use', 'the correct sentence', 'a small mistake', 'let\'s fix',
]


def level_at_least(level, minimum):
    """True if `level` is at or beyond `minimum` in difficulty order"""
    if not level or minimum not in LEVEL_ORDER:
        return False
    try:
        return LEVEL_ORDER.index(level) >= LEVEL_ORDER.index(minimum)
    except ValueError:
        return False


def compute_rank(conversation):
    """Determine the current rank from score, difficulty attempted, and streak"""
    score = conversation.get('score', 0)
    highest_level = conversation.get('highest_level_attempted')
    streak = conversation.get('accuracy_streak', 0)

    current = RANK_LADDER[0]
    for rank in RANK_LADDER:
        if score < rank['score']:
            break
        if rank.get('requires_level') and not level_at_least(highest_level, rank['requires_level']):
            break
        if rank.get('requires_clean_streak') and streak < rank['requires_clean_streak']:
            break
        current = rank

    return current['name']


def detect_mistake_flagged(ai_response):
    """Lightweight heuristic: did Lexi's reply flag a grammar mistake?"""
    lower = ai_response.lower()
    return any(phrase in lower for phrase in MISTAKE_KEYWORDS)


def calculate_points(conversation, user_message, ai_response, activity_level):
    """Score one exchange and update the conversation's running score/streak.

    Rewards: difficulty attempted (base points scale with tier), sustained
    accuracy (streak bonus), self-correction after a flagged mistake
    (bonus next turn), and vocabulary variety (small bonus for new words).
    """
    base = BASE_POINTS_BY_LEVEL.get(activity_level, 8)
    had_mistake = detect_mistake_flagged(ai_response)

    points = base
    breakdown = {'base': base}

    # Self-correction bonus: last turn Lexi flagged a mistake, this turn
    # is clean — the student actually applied the feedback
    if conversation.get('last_message_had_mistake') and not had_mistake:
        points += 6
        breakdown['self_correction'] = 6

    # Accuracy streak: consecutive clean messages build a growing bonus
    if had_mistake:
        conversation['accuracy_streak'] = 0
        conversation['total_mistakes'] = conversation.get('total_mistakes', 0) + 1
    else:
        conversation['accuracy_streak'] = conversation.get('accuracy_streak', 0) + 1
        conversation['total_correct_messages'] = conversation.get('total_correct_messages', 0) + 1
        streak = conversation['accuracy_streak']
        if streak >= 3:
            streak_bonus = min(int(base * 0.5), streak * 2)
            points += streak_bonus
            breakdown['streak_bonus'] = streak_bonus

    conversation['best_streak'] = max(conversation.get('best_streak', 0), conversation['accuracy_streak'])

    # Vocabulary variety: small bonus for words not used earlier this session
    used_vocab = conversation.setdefault('used_vocab', set())
    new_words = {
        w for w in re.findall(r"[a-zA-Z']+", user_message.lower())
        if len(w) >= 4 and w not in used_vocab
    }
    if new_words:
        vocab_bonus = min(len(new_words) * 2, 8)
        points += vocab_bonus
        breakdown['vocab_bonus'] = vocab_bonus
    used_vocab.update(new_words)

    conversation['last_message_had_mistake'] = had_mistake
    conversation['score'] = conversation.get('score', 0) + points

    if not conversation.get('highest_level_attempted') or level_at_least(activity_level, conversation['highest_level_attempted']):
        conversation['highest_level_attempted'] = activity_level

    return {
        'points_earned': points,
        'breakdown': breakdown,
        'had_mistake': had_mistake,
        'total_score': conversation['score'],
        'streak': conversation['accuracy_streak'],
        'rank': compute_rank(conversation)
    }


# Writing Activities Database
ACTIVITIES = {
    'beginner': [
        {
            'id': 'complete_sentence',
            'title': 'Complete the Sentence',
            'description': 'I will start a sentence. You add ONE word to finish it!',
            'level': 'beginner',
            'scaffold': 'Give 5-6 sentence starters each session, and rotate the starters AND the word banks every session — starters to rotate: "I want ___", "She has ___", "We play ___", "He eats ___", "I see ___", "They like ___", "My friend is ___". Word banks should draw from unpredictable categories: nature (river, cloud, stone, wind), animals (parrot, goat, elephant), food from different cultures (dal, noodles, bread, samosa), sports and hobbies, household items. NEVER default to pizza/books/cricket every time.'
        },
        {
            'id': 'build_three_words',
            'title': 'Build 3-Word Sentences',
            'description': 'Make sentences with 3 words: Who + Does + What. Example: "I eat food"',
            'level': 'beginner',
            'scaffold': 'Template: [subject] + [verb] + [object]. Each session, use FRESH word banks for each slot — subjects: I/You/He/She/My friend/The cat/My mother; verbs rotate each session (eat, like, play, read, kick, carry, find, open, catch, hold, wash, draw); objects drawn from varied categories (ball, bag, mango, umbrella, pencil, flower, fish, stone, leaf, kite). Build 5 sentences. Make combinations surprising and fun — "My friend catches a butterfly" not just "I eat food" every time.'
        },
        {
            'id': 'fix_sentence',
            'title': 'Fix the Sentence',
            'description': 'Words are mixed up! Put them in correct order.',
            'level': 'beginner',
            'scaffold': 'Give 4-5 jumbled sentences each session, rotating the topics widely — use school, home, nature, sports, animals, shopping, cooking. Examples to rotate: "runs dog the fast", "door open she the", "eats bird small worm a", "plays he park the in". After fixing, teach ONE grammar point relevant to the sentences — articles (a/an/the), prepositions (in/on/at/to), or word order. Keep examples fresh and varied every session.'
        }
    ],
    'intermediate': [
        {
            'id': 'add_details',
            'title': 'Add More Details',
            'description': 'Take a simple sentence and make it better by adding describing words!',
            'level': 'intermediate',
            'scaffold': 'Each session, start with a DIFFERENT base sentence — rotate between: "I see a bird", "She has a bag", "He drinks water", "The dog runs", "We play outside", "My friend reads a book". Expand with adjectives from a VARIED bank each time: tall/short, loud/quiet, sweet/sour, heavy/light, fast/slow, clean/dirty, bright/dark, smooth/rough, shiny/dusty. Combine unpredictably — "She has a heavy, dusty bag." Keep the combinations surprising!'
        },
        {
            'id': 'past_tense',
            'title': 'Past Tense Practice',
            'description': 'Change sentences from today to yesterday! Learn past tense.',
            'level': 'intermediate',
            'scaffold': 'Each session, choose a DIFFERENT set of 6-8 verbs to practice — rotate across: regular verbs (walk→walked, wash→washed, climb→climbed, drop→dropped, jump→jumped, call→called, open→opened, watch→watched) and irregular verbs (go→went, eat→ate, see→saw, run→ran, drink→drank, fall→fell, find→found, break→broke, take→took, sleep→slept). Build present→past sentences around varied everyday events: morning routines, sports, market trips, family moments, school experiences. Keep topics fresh each session.'
        },
        {
            'id': 'sentence_combining',
            'title': 'Sentence Combining',
            'description': 'Join two simple sentences into one better sentence! Learn to use connecting words.',
            'level': 'intermediate',
            'scaffold': 'Each session, create 4-5 FRESH sentence pairs from different life topics — nature, sports, food, family, school, animals, weather, transport. Rotate the topics widely: ("The dog barked" + "I was scared"), ("She studied hard" + "She passed the test"), ("It was raining" + "We stayed inside"), ("He was tired" + "He slept early"), ("The mango was ripe" + "I ate it"). Student combines with: and, but, because, so, when. Start with **and**, progress to **because** and **but**. Accept multiple correct answers!'
        }
    ],
    'advanced': [
        {
            'id': 'three_sentences',
            'title': 'Write 3 Sentences',
            'description': 'Write 3 sentences about a topic. I will give you sentence starters!',
            'level': 'advanced',
            'scaffold': 'Each session, choose a DIFFERENT topic from a wide range — My Morning Routine, My Favourite Season, A Time I Was Scared, My Neighbourhood, An Animal I Find Interesting, A Food I Love, Something I Want to Learn, A Person I Admire, A Place I Want to Visit, My Favourite Sport, A Strange Dream, The Best Day This Week. Give 3 FRESH sentence starters that match the chosen topic. Help the student expand each sentence with details. Rotate topics — never use the same topic twice in a row.'
        },
        {
            'id': 'tell_story',
            'title': 'Tell a Short Story',
            'description': 'Tell a story in 4-5 sentences. I will help you!',
            'level': 'advanced',
            'scaffold': 'Each session, offer 2-3 VARIED story prompts and let students pick one — rotate through: "A time I helped someone", "The strangest thing I ever saw", "My favourite memory with my family", "If I had a superpower for one day", "A day everything went wrong", "I found something unexpected", "My first time trying something new", "A very hot/rainy/cold day", "When I was very proud of myself", "If I could talk to an animal". Provide fresh story starters that fit the chosen prompt. Build the story together using their real or imagined experiences.'
        },
        {
            'id': 'describe_free',
            'title': 'Describe Something',
            'description': 'Choose something you like and describe it freely. I will help with words!',
            'level': 'advanced',
            'scaffold': 'Offer a WIDE range of description topics — rotate each session: favourite animal, a place in their town, someone they admire, their school bag and what is inside, the view from their window, a fruit or vegetable, the weather today, a sport or game, an object at home, their shoes, the sky at different times, a sound they love or hate, a smell that reminds them of something. Ask varied follow-up questions tailored to the chosen topic. Provide relevant vocabulary. Keep topics fresh and connected to real, personal experience.'
        }
    ],
    'story_mode': [
        {
            'id': 'story_adventure',
            'title': '📖 Mysteries of Lexi Town',
            'description': 'YOU are the hero! Explore a magical world and practice English through adventure.',
            'level': 'story',
            'scaffold': '''You guide English learners through story adventures in Lexi Town (a magical place with mysteries).

RULES:
1. Use ONLY simple 8-year-old vocabulary
2. Write 3-4 short sentences per story part
3. Students write full sentences: "I will [action]" for actions, or dialogue/questions when talking
4. If student types 1-2 words, ask for full sentence
5. Create quest with choices, character conversations, and mysteries

VOCABULARY TEACHING:
- If you use a DIFFICULT word in the STORY, explain it in LEXI section
- Only explain NEW or HARD words (not basic words like "go", "see", "take")
- Format: "word = meaning"
- Example: If STORY says "lantern", LEXI says: "lantern = a light you can carry"
- Don't explain grammar or basic verbs - only difficult vocabulary

OUTPUT FORMAT - NO EXTRA TEXT ALLOWED:

📖 STORY: [3-4 simple sentences describing the scene]

🦊 LEXI: [ALWAYS give feedback! If student wrote correctly: praise them and explain why it's good. If student made mistakes: correct them kindly. If you used difficult words in STORY: explain using "word = meaning". NEVER skip this section - ALWAYS teach something!]

❓ NEXT: [One simple question]

DO NOT write anything else. DO NOT add "**" marks. DO NOT give examples. DO NOT repeat sections. Just write those 3 parts.

IMAGES: Add [IMAGE:simple scene description] for each new location.

FIRST MESSAGE: Start the adventure in Lexi Town square. Describe the scene in 3-4 simple sentences. Give them their first quest. Ask what they will do.
'''
        },
        {
            'id': 'detective_classroom',
            'title': '🔍 The Case of the Silent Classroom',
            'description': 'Be a detective! Solve a calm school mystery using your observation and logic skills.',
            'level': 'story',
            'scaffold': '''You are running a TEXT-ONLY detective story for English learners. The story MUST end in EXACTLY 10 student messages.

CRITICAL: Count every student message. When student sends message #10, the story MUST end with the solution.

TURN STRUCTURE (FOLLOW EXACTLY):
- Turn 1 (START): Tell the mystery story. Give clues in your text.
- Turns 2-4: Student writes what they think about the clues. You give new clues in response.
- Turns 5-7: Student explains their theory. You confirm or guide with more clues.
- Turns 8-9: Student connects the clues. You help them get closer.
- Turn 10 (END): Student writes their conclusion. You reveal the full solution and END THE STORY.

MYSTERY: Something is wrong in the classroom (missing object, switched items, hidden message, etc.)

IMPORTANT - TEXT ONLY:
- There are NO images. Everything happens through text.
- YOU tell the clues in the STORY section.
- Student CANNOT see anything. They only have what YOU wrote.
- Student writes what they THINK based on your text clues.
- Example:
  * YOU write: "The teacher's desk is empty. But there are pencil marks on the wood."
  * STUDENT writes: "I think someone wrote on the desk."
  * YOU respond: "Good thinking! The marks say 'Look under...' but the rest is erased."

HOW IT WORKS:
- Student practices DESCRIPTIVE WRITING of their thoughts and theories
- YOU provide ALL clues in your story text
- Student reads your clues and writes what they think
- This is a THINKING exercise, not a looking exercise

RULES:
1. Use ONLY simple 8-year-old vocabulary
2. Write 3-4 short sentences per story part
3. Student writes full sentences about their thoughts and theories
4. If student types 1-2 words, ask for full sentence
5. Focus on DESCRIPTIVE WRITING of ideas (not actions)
6. Tone: smart, calm, curious (like detective movie)
7. Track turn count - on turn 10, END the story with solution
8. Give ALL clues in your STORY section - student has no other way to get information

VOCABULARY TEACHING:
- If you use a DIFFICULT word in the STORY, explain it in LEXI section
- Only explain NEW or HARD words (not basic words like "color", "take", "book")
- Format: "word = meaning"
- Example: If STORY says "messy", LEXI says: "messy = not clean, things everywhere"
- Don't explain grammar or basic verbs - only difficult vocabulary

WHAT TO ASK:
- "What do you think about this?"
- "What is your theory?"
- "How do the clues connect?"
- "What do you think happened?"
NOT "What do you notice?" (they can't notice - you must TELL them the clues)

OUTPUT FORMAT - NO EXTRA TEXT ALLOWED:

📖 STORY: [3-4 simple sentences. Include clues based on their thinking. Tell them everything - they can't see anything themselves.]

🦊 LEXI: [ALWAYS give feedback! If student wrote correctly: praise them and explain why their writing is good. If student made grammar mistakes: correct them kindly. If you used difficult words in STORY: explain using "word = meaning". NEVER skip this section - ALWAYS teach something!]

❓ NEXT: [One simple question asking them to write their thoughts or theory]

DO NOT write anything else. DO NOT add "**" marks. DO NOT give examples. DO NOT repeat sections. Just write those 3 parts.

NO IMAGES. This is text-only.

FIRST MESSAGE: Tell the classroom mystery story. Give the first clues in your story text. Ask "What do you think is wrong?"
'''
        }
    ]
}


def create_activity_prompt(student_name, student_class, activity_title, activity_description, activity_scaffold=""):
    """Create a personalized prompt for absolute beginner students"""
    return f"""You are Lexi 🦊, a patient and fun English tutor for {student_name} (Class {student_class}).

CRITICAL CONTEXT:
- Students are ABSOLUTE BEGINNERS - many CANNOT form basic sentences
- English is 2nd or 3rd language with VERY LIMITED vocabulary
- Problems: word order, verb tenses, articles, vocabulary
- BIGGEST ISSUE: They translate from native language instead of thinking in English

COMMON GRAMMAR MISTAKES TO ACTIVELY WATCH FOR AND CORRECT (in every activity, not just grammar-specific ones):
- **have/has confusion**: "He have a bag" → should be "He has a bag". Rule: I/you/we/they + have; he/she/it + has. Correct this EVERY time it appears, gently and clearly.
- **is/are/am confusion**: "They is happy" → "They are happy". "I is" → "I am".
- **do/does confusion**: "She do like it" → "She does like it".
- **Subject-verb agreement in general**: "The dogs runs" → "The dogs run"; "He go" → "He goes".
- **Missing/wrong articles**: "I have bag" → "I have a bag"; "I go school" → "I go to school".
- **Wrong or missing verb tense**: mixing present and past in the same sentence.
Whenever a student makes ANY of these mistakes, use your "Fix ONE Thing Only" rule below — pick the most important error, show the corrected sentence, explain the have/has (or relevant) rule in ONE simple sentence, then move on. Do this consistently across every session so these patterns actually improve over time.

ACTIVITY: "{activity_title}"
What to do: {activity_description}
Teaching hints: {activity_scaffold}

YOUR TEACHING METHOD:

1. **For "Think in English" activities - Use SPEED**:
   - Say: "Quick! Answer FAST! Don't think!"
   - Rapid questions across MANY topics — colors, numbers, animals, food, sports, nature, body parts, weather, feelings. Examples: "What color is fire?" → "red" → "YES! Next!" or "How many legs does a spider have?" → "8" → "Amazing! Next!"
   - NEVER ask the same questions across sessions. Rotate widely — use surprising, varied prompts every time
   - Accept ANY English word - don't correct during speed rounds
   - Goal: SPEED = direct English thinking
   - After 10-15 fast questions, THEN teach slowly

2. **Always Give Examples FIRST**:
   - NEVER ask without showing example
   - Show → Student copies → Student tries own
   - Use 5-year-old English only

3. **Always Provide Word Banks**:
   - Never ask them to think of words
   - Give 3-5 choices in **bold** — draw from a WIDE range: nature, animals, sports, food from different cultures, jobs, feelings, places, household objects, weather
   - NEVER default to the same words every session (do NOT always use pizza, apple, books, cricket, sky as your go-to examples)
   - Each session should feel different — surprise the students with fresh, interesting words

4. **Use Simple Templates**:
   - Pattern: "I ___ ___"
   - Example: "I like pizza"
   - Student tries with different words

5. **Celebrate EVERYTHING**:
   - One correct word = BIG praise!
   - "YES! Perfect!"
   - Make every tiny step feel like winning

6. **Fix ONE Thing Only**:
   - Don't list all errors
   - Pick most important one
   - Fix, explain in ONE sentence, move on

7. **Repeat 3-5 Times**:
   - Same pattern, different words
   - Build brain patterns

8. **Format with Bold/Italic**:
   - **Bold** for target words
   - *Italic* for explanations

RESPONSE FORMAT (Every time):
1. Celebrate (even if wrong!)
2. Show correct version
3. Explain in ONE simple sentence
4. Give next easy step (with word bank)
5. End with encouragement

RULES:
- Simple 5-year-old English
- Examples before practice
- Word banks always
- One step at a time
- VARIETY IS ESSENTIAL: Every session must feel different. Draw examples from the full range of human life — nature, food from different cultures, animals, sports, family, weather, jobs, travel, feelings, school, home, market, festivals. Do NOT recycle the same examples (no "I like pizza", "sky is blue", "apple is red" every single time). Surprise and delight the students with fresh, unpredictable content every chat.

Start by greeting {student_name} and showing a clear EXAMPLE — make it something unexpected and interesting, not the same old example!"""


@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')


@app.route('/get_activities', methods=['GET'])
def get_activities():
    """Return all available activities"""
    return jsonify({'activities': ACTIVITIES})


@app.route('/start_session', methods=['POST'])
def start_session():
    """Initialize a new learning session with student info"""
    data = request.json
    student_name = data.get('name', '').strip()
    student_class = data.get('class', '').strip()
    computer_number = data.get('computer_number', '').strip()

    if not student_name or not student_class:
        return jsonify({'error': 'Name and class are required'}), 400

    if not computer_number:
        return jsonify({'error': 'Please select your computer number'}), 400

    api_key = get_key_for_computer(computer_number)
    if not api_key:
        return jsonify({'error': f'No API key configured for computer {computer_number}. Please contact your teacher.'}), 503

    # Create a session ID
    session_id = f"{student_name}_{student_class}_{len(conversations)}"

    # Store session info (activity will be selected later)
    conversations[session_id] = {
        'name': student_name,
        'class': student_class,
        'api_key': api_key,
        'activity': None,
        'messages': None,
        'message_count': 0,
        'score': 0,
        'accuracy_streak': 0,
        'best_streak': 0,
        'total_correct_messages': 0,
        'total_mistakes': 0,
        'used_vocab': set(),
        'activities_tried': set(),
        'highest_level_attempted': None,
        'last_message_had_mistake': False
    }

    return jsonify({
        'session_id': session_id,
        'name': student_name,
        'class': student_class
    })


@app.route('/start_activity', methods=['POST'])
def start_activity():
    """Start a specific writing activity"""
    data = request.json
    session_id = data.get('session_id')
    activity_id = data.get('activity_id')

    if not session_id or session_id not in conversations:
        return jsonify({'error': 'Invalid session'}), 400

    # Find the activity
    activity = None
    for level_activities in ACTIVITIES.values():
        for act in level_activities:
            if act['id'] == activity_id:
                activity = act
                break

    if not activity:
        return jsonify({'error': 'Activity not found'}), 400

    conversation = conversations[session_id]
    student_name = conversation['name']
    student_class = conversation['class']

    # Create activity prompt with scaffold
    activity_prompt = create_activity_prompt(
        student_name,
        student_class,
        activity['title'],
        activity['description'],
        activity.get('scaffold', '')
    )

    # Initialize message history for Groq
    messages = [{"role": "system", "content": activity_prompt}]

    try:
        # Get initial greeting from Groq using session API key
        api_key = conversation.get('api_key')
        response_text = call_groq(messages, api_key)

        # Parse for image markers
        image_url = None
        if '[IMAGE:' in response_text:
            match = re.search(r'\[IMAGE:([^\]]+)\]', response_text)
            if match:
                search_term = match.group(1).strip()
                image_url = fetch_unsplash_image(search_term)
                # Remove marker from text
                response_text = re.sub(r'\[IMAGE:[^\]]+\]', '', response_text).strip()

        # Update conversation
        conversation['activity'] = activity
        conversation['activity_id'] = activity_id
        conversation['messages'] = messages
        conversation['messages'].append({"role": "assistant", "content": response_text})
        conversation.setdefault('activities_tried', set()).add(activity['title'])

        # Increment message count (informational, no longer a hard limit)
        conversation['message_count'] += 1

        return jsonify({
            'message': response_text,
            'image_url': image_url,
            'message_count': conversation['message_count'],
            'total_score': conversation.get('score', 0),
            'rank': compute_rank(conversation)
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Failed to start activity. Please try again.'}), 500


def parse_story_response(response_text):
    """Parse and clean story mode response to enforce exact 3-section format"""
    # Extract IMAGE marker if present
    image_url = None
    if '[IMAGE:' in response_text:
        match = re.search(r'\[IMAGE:([^\]]+)\]', response_text)
        if match:
            search_term = match.group(1).strip()
            image_url = fetch_unsplash_image(search_term)
        # Remove all IMAGE markers
        response_text = re.sub(r'\[IMAGE:[^\]]+\]', '', response_text)

    # Extract the 3 sections using regex
    story_match = re.search(r'📖\s*STORY:?\s*(.+?)(?=🦊|$)', response_text, re.DOTALL | re.IGNORECASE)
    lexi_match = re.search(r'🦊\s*LEXI:?\s*(.+?)(?=❓|$)', response_text, re.DOTALL | re.IGNORECASE)
    next_match = re.search(r'❓\s*(?:NEXT|WHAT\'?S?\s*NEXT):?\s*(.+?)$', response_text, re.DOTALL | re.IGNORECASE)

    # Clean and extract content
    story_content = story_match.group(1).strip() if story_match else "You are in Lexi Town."
    lexi_content = lexi_match.group(1).strip() if lexi_match else "Great job!"
    next_content = next_match.group(1).strip() if next_match else "What will you do?"

    # Remove any extra ** marks or formatting
    story_content = re.sub(r'\*\*+', '', story_content).strip()
    lexi_content = re.sub(r'\*\*+', '', lexi_content).strip()
    next_content = re.sub(r'\*\*+', '', next_content).strip()

    # Remove any bullet points or dashes at the start
    story_content = re.sub(r'^[\-\*•]\s*', '', story_content, flags=re.MULTILINE).strip()
    lexi_content = re.sub(r'^[\-\*•]\s*', '', lexi_content, flags=re.MULTILINE).strip()
    next_content = re.sub(r'^[\-\*•]\s*', '', next_content, flags=re.MULTILINE).strip()

    # Reconstruct the clean response with ONLY the 3 sections
    clean_response = f"📖 STORY: {story_content}\n\n🦊 LEXI: {lexi_content}\n\n❓ NEXT: {next_content}"

    return clean_response, image_url


@app.route('/send_message', methods=['POST'])
def send_message():
    """Handle student messages"""
    data = request.json
    session_id = data.get('session_id')
    user_message = data.get('message', '').strip()

    if not session_id or session_id not in conversations:
        return jsonify({'error': 'Invalid session'}), 400

    if not user_message:
        return jsonify({'error': 'Message cannot be empty'}), 400

    conversation = conversations[session_id]
    messages = conversation.get('messages')

    if not messages:
        return jsonify({'error': 'No activity started'}), 400

    try:
        # Add user message to history
        messages.append({"role": "user", "content": user_message})

        # Get response from Groq using session API key
        api_key = conversation.get('api_key')
        # story_adventure needs full plot memory; trim history for everything
        # else so a single call never grows unbounded over a long session
        activity_id = conversation.get('activity_id')
        groq_messages = messages if activity_id == 'story_adventure' else trim_history(messages)
        response_text = call_groq(groq_messages, api_key)

        # Check if this is story mode activity (any story-based activity)
        is_story_mode = conversation.get('activity_id') in ['story_adventure', 'detective_classroom']

        if is_story_mode:
            # Parse and clean story response
            response_text, image_url = parse_story_response(response_text)
        else:
            # Regular activity - just parse for images
            image_url = None
            if '[IMAGE:' in response_text:
                match = re.search(r'\[IMAGE:([^\]]+)\]', response_text)
                if match:
                    search_term = match.group(1).strip()
                    image_url = fetch_unsplash_image(search_term)
                    # Remove marker from text
                    response_text = re.sub(r'\[IMAGE:[^\]]+\]', '', response_text).strip()

        # Add assistant response to history
        messages.append({"role": "assistant", "content": response_text})

        # Increment message count (1 API call = user sends + AI responds)
        conversation['message_count'] += 1

        # Score this exchange
        activity_level = conversation.get('activity', {}).get('level', 'beginner')
        score_result = calculate_points(conversation, user_message, response_text, activity_level)

        return jsonify({
            'message': response_text,
            'image_url': image_url,
            'message_count': conversation['message_count'],
            'points_earned': score_result['points_earned'],
            'total_score': score_result['total_score'],
            'streak': score_result['streak'],
            'rank': score_result['rank']
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': 'Failed to get response. Please try again.'}), 500


@app.route('/end_session', methods=['POST'])
def end_session():
    """Return a stats recap for the session, without ending anything server-side"""
    data = request.json
    session_id = data.get('session_id')

    if not session_id or session_id not in conversations:
        return jsonify({'error': 'Invalid session'}), 400

    conversation = conversations[session_id]

    total_correct = conversation.get('total_correct_messages', 0)
    total_mistakes = conversation.get('total_mistakes', 0)
    total_scored_messages = total_correct + total_mistakes
    accuracy = round((total_correct / total_scored_messages) * 100) if total_scored_messages else 0

    return jsonify({
        'name': conversation.get('name'),
        'total_score': conversation.get('score', 0),
        'rank': compute_rank(conversation),
        'best_streak': conversation.get('best_streak', 0),
        'accuracy': accuracy,
        'total_messages': conversation.get('message_count', 0),
        'words_learned': len(conversation.get('used_vocab', set())),
        'activities_tried': sorted(conversation.get('activities_tried', set())),
        'highest_level_attempted': conversation.get('highest_level_attempted')
    })


def open_browser():
    """Open browser after a short delay"""
    webbrowser.open('http://127.0.0.1:5000')


if __name__ == '__main__':
    # Check if running in production (Railway sets PORT env var)
    port = int(os.environ.get('PORT', 5000))
    is_production = os.environ.get('RAILWAY_ENVIRONMENT') or os.environ.get('PORT')

    if is_production:
        print("🦊 Starting Lexi - English Learning Assistant (Production)")
        app.run(host='0.0.0.0', port=port, debug=False)
    else:
        print("🦊 Starting Lexi - English Learning Assistant...")
        print("📚 Opening browser at http://127.0.0.1:5000")
        Timer(1.5, open_browser).start()
        app.run(debug=True, use_reloader=False, port=5000)
