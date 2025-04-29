const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const API_KEY = 'API_KEY';

const chatContainer = document.querySelector('.chat-container');
const prompt = document.querySelector('#prompt');
const submitBtn = document.querySelector('#submit');
const voiceInputBtn = document.querySelector('#voiceInput');
const imageBtn = document.querySelector('#image');
const pdfBtn = document.querySelector('#pdf');
const voiceToggleBtn = document.querySelector('#voiceToggle');
const btn = document.querySelector('#btn');
const content = document.querySelector('#content');
const voice = document.querySelector('#voice');
const chatbot = document.querySelector('.chatbot');

let user = {
    message: null,
    file: { mime_type: null, data: null },
    context: null,
    voiceEnabled: false
};

function adjustChatContainerHeight() {
    if (window.innerWidth <= 767) {
        chatContainer.style.height = '40vh';
    } else if (window.innerWidth <= 1023) {
        chatContainer.style.height = '45vh';
    } else {
        chatContainer.style.height = '50vh';
    }
}

window.addEventListener('resize', adjustChatContainerHeight);
window.addEventListener('load', () => {
    adjustChatContainerHeight();
    wishMe();
});

function speak(text, lang = 'en-US', speed = 1) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = parseFloat(speed);
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.lang = lang;
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang === lang) || voices.find(v => v.lang.startsWith(lang.split('-')[0]));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
}

function wishMe() {
    let day = new Date();
    let hours = day.getHours();
    let greeting;
    if (hours >= 0 && hours < 12) {
        greeting = "Good Morning Sir";
    } else if (hours >= 12 && hours < 16) {
        greeting = "Good Afternoon Sir";
    } else {
        greeting = "Good Evening Sir";
    }
    speak(greeting, 'hi-GB');
}

function setupRecognition(lang) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang;
    return recognition;
}

function startVoiceInput(event) {
    event.preventDefault();
    voiceInputRecognition.start();
    voiceInputBtn.classList.add('recording');
}

const voiceInputRecognition = setupRecognition('en-US');
if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    voiceInputBtn.style.display = 'none';
}

voiceInputRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    prompt.value = transcript;
    voiceInputBtn.classList.remove('recording');
    handleChatResponse(transcript);
};

voiceInputRecognition.onerror = () => {
    voiceInputBtn.classList.remove('recording');
    const errorMessage = navigator.mediaDevices ?
        'Sorry, I couldn’t understand your voice input. Please try again.' :
        'Microphone access is not available on this device.';
    speak(errorMessage);
    prompt.value = '';
};

async function extractPdfText(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = async (e) => {
            const typedArray = new Uint8Array(e.target.result);
            const pdf = await pdfjsLib.getDocument(typedArray).promise;
            let text = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(item => item.str).join(' ') + '\n';
            }
            resolve(text.trim());
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function createChatBox(html, classes) {
    const div = document.createElement('div');
    div.innerHTML = html;
    div.classList.add(classes);
    return div;
}

async function generateResponse(aiChatBox) {
    const text = aiChatBox.querySelector('.ai-chat-area');
    let messageContent;
    if (user.file.data && user.file.mime_type === 'application/pdf') {
        const pdfFile = await fetch(`data:application/pdf;base64,${user.file.data}`).then(res => res.blob());
        const pdfText = await extractPdfText(pdfFile);
        const summaryPrompt = user.message ?
            `${user.message}\n\nPDF Content: ${pdfText.substring(0, 4000)}` :
            `Summarize the following PDF content and provide key points for reading practice:\n\n${pdfText.substring(0, 4000)}`;
        messageContent = [{ text: summaryPrompt }];
        user.context = { pdfText: pdfText.substring(0, 4000), summary: null };
    } else if (user.file.data) {
        messageContent = [{ text: user.message }, { inline_data: user.file }];
    } else if (user.context && user.message) {
        messageContent = [{ text: `Based on the PDF content: ${user.context.pdfText.substring(0, 2000)}\n\nUser question: ${user.message}` }];
    } else {
        messageContent = [{ text: user.message }];
    }
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: messageContent }] }),
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        const responseText = data.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, '$1').trim();
        text.innerHTML = responseText;
        if (user.file.data && user.file.mime_type === 'application/pdf') {
            user.context.summary = responseText;
        }
        if (user.voiceEnabled) {
            speak(responseText);
        }
    } catch (error) {
        console.error('API Error:', error);
        text.innerHTML = 'Sorry, I couldn’t process that. Try again!';
        if (user.voiceEnabled) {
            speak('Sorry, I couldn’t process that. Try again!');
        }
    } finally {
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        user.file = { mime_type: null, data: null };
    }
}

function handleChatResponse(userMessage) {
    user.message = userMessage;
    const html = `
        <img src="user.png" alt="User" id="userImage">
        <div class="user-chat-area">
            ${user.message}
            ${user.file.data && user.file.mime_type.startsWith('image/') ? `<img src="data:${user.file.mime_type};base64,${user.file.data}" class="chooseimg" />` : ''}
        </div>`;
    prompt.value = '';
    const userChatBox = createChatBox(html, 'user-chat-box');
    chatContainer.appendChild(userChatBox);
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    setTimeout(() => {
        const html = `
            <img src="1.png" alt="AI" id="aiImage">
            <div class="ai-chat-area">
                <img src="loading.webp" alt="Loading" class="load">
            </div>`;
        const aiChatBox = createChatBox(html, 'ai-chat-box');
        chatContainer.appendChild(aiChatBox);
        generateResponse(aiChatBox);
    }, 600);
}

function takeCommand(message) {
    voice.style.display = 'none';
    btn.style.display = 'none';
    chatbot.style.display = 'block';
    if (message.includes("hello") || message.includes("hey")) {
        speak("Hello sir, what can I help you?");
    } else if (message.includes("who are you")) {
        speak("I am Shifra, your virtual assistant, created by Ayush Sir");
    } else if (message.includes("open youtube")) {
        speak("Opening YouTube...");
        window.open("https://youtube.com/", "_blank");
    } else if (message.includes("open google")) {
        speak("Opening Google...");
        window.open("https://google.com/", "_blank");
    } else if (message.includes("open facebook")) {
        speak("Opening Facebook...");
        window.open("https://facebook.com/", "_blank");
    } else if (message.includes("open instagram")) {
        speak("Opening Instagram...");
        window.open("https://instagram.com/", "_blank");
    } else if (message.includes("open calculator")) {
        speak("Opening Calculator...");
        window.open("calculator://");
    } else if (message.includes("open whatsapp")) {
        speak("Opening WhatsApp...");
        window.open("whatsapp://");
    } else if (message.includes("time")) {
        let time = new Date().toLocaleString(undefined, { hour: "numeric", minute: "numeric" });
        speak(time);
    } else if (message.includes("date")) {
        let date = new Date().toLocaleString(undefined, { day: "numeric", month: "short" });
        speak(date);
    } else {
        handleChatResponse(message);
    }
}

voiceInputBtn.addEventListener('click', startVoiceInput);
voiceInputBtn.addEventListener('touchstart', startVoiceInput);

submitBtn.addEventListener('click', () => {
    if (prompt.value.trim()) {
        handleChatResponse(prompt.value);
    }
});
submitBtn.addEventListener('touchstart', (event) => {
    event.preventDefault();
    if (prompt.value.trim()) {
        handleChatResponse(prompt.value);
    }
});

prompt.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && prompt.value.trim()) {
        handleChatResponse(prompt.value);
    }
});

imageBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                user.file = { mime_type: file.type, data: reader.result.split(',')[1] };
                handleChatResponse(prompt.value || 'Analyze this image');
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
});
imageBtn.addEventListener('touchstart', (event) => {
    event.preventDefault();
    imageBtn.click();
});

pdfBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                user.file = { mime_type: file.type, data: reader.result.split(',')[1] };
                handleChatResponse(prompt.value || 'Summarize this PDF');
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
});
pdfBtn.addEventListener('touchstart', (event) => {
    event.preventDefault();
    pdfBtn.click();
});

voiceToggleBtn.addEventListener('click', () => {
    user.voiceEnabled = !user.voiceEnabled;
    voiceToggleBtn.classList.toggle('active');
});
voiceToggleBtn.addEventListener('touchstart', (event) => {
    event.preventDefault();
    user.voiceEnabled = !user.voiceEnabled;
    voiceToggleBtn.classList.toggle('active');
});

btn.addEventListener('click', () => {
    recognition.start();
    voice.style.display = 'block';
    btn.style.display = 'none';
});

let speechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = new speechRecognition();
recognition.onresult = (event) => {
    let currentIndex = event.resultIndex;
    let transcript = event.results[currentIndex][0].transcript;
    content.innerText = transcript;
    takeCommand(transcript.toLowerCase());
};
