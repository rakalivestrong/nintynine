import { LYRICS } from './lyrics.js';

export class MusicPlayer {
  constructor() {
    this.audio = new Audio('/song.mp3');
    this.audio.preload = 'metadata';

    this.playBtn = document.getElementById('music-play-btn');
    this.playIcon = document.getElementById('music-play-icon');
    this.prevBtn = document.getElementById('music-prev-btn');
    this.nextBtn = document.getElementById('music-next-btn');
    this.progressBar = /** @type {HTMLInputElement | null} */ (document.getElementById('music-progress'));
    this.timeCurrent = document.getElementById('music-time-current');
    this.timeDuration = document.getElementById('music-time-duration');
    this.volumeBar = /** @type {HTMLInputElement | null} */ (document.getElementById('music-volume'));
    this.lyricsEl = document.getElementById('music-lyrics');

    this.isSeeking = false;
    this.currentLyricIdx = -1;
    this.typewriterTimer = 0;

    this._bindEvents();
  }

  _formatTime(sec) {
    if (isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  _bindEvents() {
    this.playBtn?.addEventListener('click', () => this.togglePlay());

    this.prevBtn?.addEventListener('click', () => {
      this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
    });

    this.nextBtn?.addEventListener('click', () => {
      this.audio.currentTime = Math.min(this.audio.duration || 0, this.audio.currentTime + 10);
    });

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.progressBar && this.audio.duration) {
        this.progressBar.max = String(Math.floor(this.audio.duration));
      }
      if (this.timeDuration) {
        this.timeDuration.textContent = this._formatTime(this.audio.duration);
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.isSeeking && this.progressBar) {
        this.progressBar.value = String(Math.floor(this.audio.currentTime));
      }
      if (this.timeCurrent) {
        this.timeCurrent.textContent = this._formatTime(this.audio.currentTime);
      }
      this._updateLyrics();
    });

    this.progressBar?.addEventListener('input', () => {
      this.isSeeking = true;
      if (this.timeCurrent && this.progressBar) {
        this.timeCurrent.textContent = this._formatTime(Number(this.progressBar.value));
      }
    });

    this.progressBar?.addEventListener('change', () => {
      if (this.progressBar) {
        this.audio.currentTime = Number(this.progressBar.value);
        this.currentLyricIdx = -1; // reset lyric state on seek
      }
      this.isSeeking = false;
    });

    this.volumeBar?.addEventListener('input', () => {
      if (this.volumeBar) {
        this.audio.volume = Number(this.volumeBar.value);
      }
    });

    this.audio.addEventListener('play', () => {
      if (this.playIcon) this.playIcon.textContent = '❚❚';
    });

    this.audio.addEventListener('pause', () => {
      if (this.playIcon) this.playIcon.textContent = '▶';
    });
  }

  _updateLyrics() {
    if (!this.lyricsEl) return;
    const cur = this.audio.currentTime;
    let foundIdx = -1;
    for (let i = LYRICS.length - 1; i >= 0; i--) {
      if (cur >= LYRICS[i].time) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx !== this.currentLyricIdx) {
      this.currentLyricIdx = foundIdx;
      window.clearInterval(this.typewriterTimer);

      if (foundIdx >= 0) {
        const item = LYRICS[foundIdx];
        const fullText = item.text;
        const sideClass = item.side || 'pos-left-mid';

        // Update positioning class (removes previous pos-* classes)
        this.lyricsEl.className = `music-lyrics ${sideClass}`;

        // Fast responsive typewriter: finishes typing in ~40% of line duration so text is readable
        const typingDuration = Math.min(1.4, Math.max(0.5, item.duration * 0.45));
        const elapsedSinceStart = Math.max(0, cur - item.time);
        const charsLeft = fullText.length;
        const intervalMs = Math.max(16, Math.min(45, Math.floor((typingDuration * 1000) / charsLeft)));

        let charIdx = Math.min(fullText.length, Math.floor((elapsedSinceStart / typingDuration) * fullText.length));

        const renderText = (len) => {
          this.lyricsEl.innerHTML = `“${fullText.slice(0, len)}<span class="type-cursor">|</span>”`;
        };

        renderText(charIdx);

        if (charIdx < fullText.length) {
          this.typewriterTimer = window.setInterval(() => {
            charIdx++;
            renderText(charIdx);
            if (charIdx >= fullText.length) {
              window.clearInterval(this.typewriterTimer);
              this.lyricsEl.innerHTML = `“${fullText}”`;
            }
          }, intervalMs);
        } else {
          this.lyricsEl.innerHTML = `“${fullText}”`;
        }
      } else {
        this.lyricsEl.className = 'music-lyrics pos-top-center';
        this.lyricsEl.innerHTML = '';
      }
    }
  }

  play() {
    this.audio.play().catch(() => {});
  }

  pause() {
    this.audio.pause();
  }

  togglePlay() {
    if (this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }
}
