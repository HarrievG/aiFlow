// WorkFlowEdit/microphoneView.js
import * as dom from './dom.js';

export function init() {
    const micBtn = document.getElementById('mic-btn');
    const speakerBtn = document.getElementById('speaker-btn');

    let isRecording = false;
    let isMuted = true;

    micBtn.addEventListener('click', () => {
        isRecording = !isRecording;
        micBtn.classList.toggle('recording', isRecording);
    });

    speakerBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        speakerBtn.textContent = isMuted ? '🔇' : '🔈';
    });
}
