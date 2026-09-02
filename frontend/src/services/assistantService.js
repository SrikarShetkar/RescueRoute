/**
 * AI Assistant Service for RescueRoute
 * Ported and adapted from Sandeeprdy1729/Chatbot
 */

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

// Emergency Categories & Rules (Ported from emergency-classifier.js)
export const EMERGENCY_TYPES = {
    HEART_ATTACK: 'HEART_ATTACK',
    STROKE: 'STROKE',
    SEVERE_BLEEDING: 'SEVERE_BLEEDING',
    ASTHMA: 'ASTHMA',
    SNAKE_BITE: 'SNAKE_BITE',
    SEIZURE: 'SEIZURE',
    UNCONSCIOUS: 'UNCONSCIOUS',
    ALLERGIC_REACTION: 'ALLERGIC_REACTION',
    OTHER: 'OTHER'
};

const SYMPTOMS = {
    CHEST_PAIN: ['chest pain', 'pressure in chest', 'heart pain', 'chest tightness'],
    BREATHING_DIFFICULTY: ['difficulty breathing', 'shortness of breath', 'gasping', 'cant breathe'],
    UNCONSCIOUS: ['unconscious', 'passed out', 'not waking up', 'fainted'],
    BLEEDING: ['bleeding', 'blood', 'cut', 'wound', 'hemorrhage'],
    NUMBNESS: ['numbness', 'cant move', 'weakness on one side', 'slurred speech'],
    GREETINGS: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'help', 'is anyone there']
};

/**
 * Classify emergency based on keywords/symptoms
 */
export const classifyEmergency = (text) => {
    const lowerText = text.toLowerCase();

    if (SYMPTOMS.CHEST_PAIN.some(s => lowerText.includes(s))) {
        return EMERGENCY_TYPES.HEART_ATTACK;
    }

    if (SYMPTOMS.BREATHING_DIFFICULTY.some(s => lowerText.includes(s))) {
        return EMERGENCY_TYPES.HEART_ATTACK; // Grouping breathing with heart/asthma for now
    }

    if (SYMPTOMS.NUMBNESS.some(s => lowerText.includes(s))) {
        return EMERGENCY_TYPES.STROKE;
    }

    if (SYMPTOMS.UNCONSCIOUS.some(s => lowerText.includes(s))) {
        return EMERGENCY_TYPES.UNCONSCIOUS;
    }

    if (SYMPTOMS.BLEEDING.some(s => lowerText.includes(s))) {
        return EMERGENCY_TYPES.SEVERE_BLEEDING;
    }

    if (SYMPTOMS.GREETINGS.some(s => lowerText.includes(s))) {
        return 'GREETING';
    }

    return EMERGENCY_TYPES.OTHER;
};

/**
 * Get First Aid Protocols (Ported from emergency-protocols.js)
 */
export const getProtocol = (type) => {
    const protocols = {
        [EMERGENCY_TYPES.HEART_ATTACK]: [
            "Keep the patient sitting upright and calm.",
            "Loosen any tight clothing.",
            "If they have prescribed nitroglycerin, help them take it.",
            "Do not allow them to walk or exert themselves."
        ],
        [EMERGENCY_TYPES.STROKE]: [
            "Note the exact time symptoms started.",
            "Do not give the patient anything to eat or drink.",
            "Keep the patient lying on their side if they are vomiting.",
            "Prepare to communicate the 'FAST' symptoms to medics."
        ],
        [EMERGENCY_TYPES.SEVERE_BLEEDING]: [
            "Apply direct pressure to the wound with a clean cloth.",
            "If blood soaks through, add more cloth on top; do not remove the first layer.",
            "Elevate the injured part above the level of the heart if possible.",
            "Keep the patient lying down and warm."
        ],
        [EMERGENCY_TYPES.UNCONSCIOUS]: [
            "Check for breathing.",
            "If breathing, turn them onto their side (recovery position).",
            "Do not leave the patient alone.",
            "Do not try to give them water or food."
        ],
        [EMERGENCY_TYPES.OTHER]: [
            "Stay with the patient and keep them calm.",
            "Monitor their breathing and consciousness.",
            "Be ready to describe symptoms to emergency responders.",
            "Do not move them unless they are in immediate danger."
        ]
    };

    return protocols[type] || protocols[EMERGENCY_TYPES.OTHER];
};

/**
 * Gemini AI Chat Integration
 */
export const getGeminiResponse = async (userMessage, history = []) => {
    const type = classifyEmergency(userMessage);

    if (!API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY') {
        let text = "I'm currently in safety-offline mode.";

        if (type === 'GREETING') {
            text = "Hello! I am your RescueRoute Emergency Assistant. I am currently in offline triage mode. How can I assist you with a medical emergency?";
        } else if (type !== EMERGENCY_TYPES.OTHER) {
            text = `I've detected a possible ${type.replace('_', ' ')}. Please stay calm. I'm providing immediate first-aid steps below. Is the patient conscious?`;
        } else {
            text = "I'm here to help with medical emergencies. Please describe the situation or symptoms so I can provide the correct first-aid guidance.";
        }

        return { text, type: type === 'GREETING' ? EMERGENCY_TYPES.OTHER : type };
    }

    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemPrompt = `You are RescueRoute Emergency Assistant. 
        - Role: Safety-first medical triage AI. 
        - Constraint: NOT a doctor, NO diagnosis, NO medicine recommendations.
        - Style: Calm, short sentences, reassure the user.
        - Goal: Extract symptoms and provide immediate safety guidance.
        - Max 3 questions.
        If user mentions chest pain, bleeding, or unconsciousness, prioritize emergency classification.`;

        const chat = model.startChat({
            history: history
                .filter(h => !h.isProtocol) // Don't include protocol messages in AI context to avoid recursion
                .map(h => ({
                    role: h.role === 'bot' ? 'model' : 'user',
                    parts: [{ text: h.content }]
                })),
            generationConfig: {
                maxOutputTokens: 200,
            },
        });

        const result = await chat.sendMessage(`${systemPrompt}\n\nUser: ${userMessage}`);
        const response = await result.response;
        const text = response.text();

        return {
            text,
            type: classifyEmergency(userMessage + " " + text)
        };
    } catch (error) {
        console.error('Gemini API Error:', error);
        return {
            text: "I'm having trouble connecting to my AI brain, but my safety protocols are still active. Please stay calm. Is the patient breathing?",
            type: type
        };
    }
};
