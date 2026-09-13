import { useEffect, useRef } from "react";
import { useLiveMatch } from "../hooks/useLiveMatch.js";
import { useNow, remainingMs } from "../hooks/useNow.js";
import { displayedSides, formatClock } from "../helpers/match.js";
import "../styles/display.css";

const RING_RADIUS = 42;
const OVERLAY_RADIUS = 46;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
const OVERLAY_CIRC = 2 * Math.PI * OVERLAY_RADIUS;

function raidToneClass(seconds) {
  if (seconds <= 10) return "red";
  if (seconds <= 20) return "yellow";
  return "";
}

export default function DisplayPage({ id }) {
  const { match, connected } = useLiveMatch(id);
  const now = useNow(200);
  const audioRef = useRef({
    context: null,
    activeCount: null,
    trackedRaidEndAt: null,
    lastRaidSecond: null,
    raidBuzzerPlayed: false,
    sirenRunning: false,
    sirenTimer: null,
    sirenNodes: [],
  });

  function ensureAudio() {
    const store = audioRef.current;
    if (!store.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      store.context = new AudioContext();
    }
    if (store.context.state === "suspended") store.context.resume().catch(() => {});
    return store.context;
  }

  function speak(text, rate = 1, pitch = 1) {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      /* audio is best-effort on display browsers */
    }
  }

  function playCountSound(number) {
    const store = audioRef.current;
    const audio = new Audio(`/assets/audio/${number}-kabaddi.mp3`);
    audio.preload = "auto";
    try {
      if (store.activeCount) {
        store.activeCount.pause();
        store.activeCount.currentTime = 0;
      }
      store.activeCount = audio;
      audio.play().catch(() => speak(String(number), number <= 3 ? 1.35 : 1.12, number <= 3 ? 1.4 : 1.2));
    } catch {
      speak(String(number), number <= 3 ? 1.35 : 1.12, number <= 3 ? 1.4 : 1.2);
    }
  }

  function playRaidBuzzer() {
    const context = ensureAudio();
    if (!context) return;
    const start = context.currentTime;
    [0, 0.22].forEach((offset) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(190, start + offset);
      gain.gain.setValueAtTime(0.001, start + offset);
      gain.gain.linearRampToValueAtTime(0.3, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.2);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.22);
    });
  }

  function scheduleSirenSweep() {
    const store = audioRef.current;
    const context = store.context;
    if (!context || !store.sirenRunning) return;
    const start = context.currentTime;
    store.sirenNodes.forEach((node, index) => {
      const high = index === 0 ? 1220 : 610;
      const low = index === 0 ? 430 : 215;
      const mid = index === 0 ? 800 : 400;
      node.frequency.cancelScheduledValues(start);
      node.frequency.setValueAtTime(low, start);
      node.frequency.linearRampToValueAtTime(high, start + 0.3);
      node.frequency.linearRampToValueAtTime(mid, start + 0.52);
      node.frequency.linearRampToValueAtTime(low, start + 0.78);
    });
  }

  function startSiren() {
    const store = audioRef.current;
    if (store.sirenRunning) return;
    const context = ensureAudio();
    if (!context) return;
    const start = context.currentTime;
    const gain = context.createGain();
    const highOsc = context.createOscillator();
    const lowOsc = context.createOscillator();

    store.sirenRunning = true;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.42, start + 0.08);
    gain.connect(context.destination);
    highOsc.type = "sawtooth";
    lowOsc.type = "square";
    highOsc.connect(gain);
    lowOsc.connect(gain);
    highOsc.start(start);
    lowOsc.start(start);
    store.sirenNodes = [highOsc, lowOsc];
    store.sirenNodes.masterGain = gain;
    scheduleSirenSweep();
    store.sirenTimer = window.setInterval(scheduleSirenSweep, 760);
  }

  function stopSiren() {
    const store = audioRef.current;
    if (store.sirenTimer) window.clearInterval(store.sirenTimer);
    store.sirenTimer = null;
    if (!store.sirenRunning && !store.sirenNodes.length) return;
    const context = store.context;
    const start = context ? context.currentTime : 0;
    const gain = store.sirenNodes.masterGain;
    store.sirenRunning = false;
    if (gain?.gain) {
      gain.gain.cancelScheduledValues(start);
      gain.gain.setValueAtTime(0.42, start);
      gain.gain.linearRampToValueAtTime(0.001, start + 0.06);
    }
    store.sirenNodes.forEach((node) => {
      try {
        node.stop(start + 0.08);
      } catch {
        /* already stopped */
      }
    });
    store.sirenNodes = [];
  }

  useEffect(() => {
    const unlock = () => {
      ensureAudio();
      if (window.speechSynthesis?.paused) window.speechSynthesis.resume();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      stopSiren();
    };
  }, []);

  useEffect(() => {
    if (match?.sirenActive) startSiren();
    else stopSiren();
  }, [match?.sirenActive]);

  useEffect(() => {
    const store = audioRef.current;
    if (!match?.raidRunning) {
      if (store.trackedRaidEndAt !== null) {
        if (store.activeCount) {
          store.activeCount.pause();
          store.activeCount.currentTime = 0;
        }
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        store.trackedRaidEndAt = null;
        store.lastRaidSecond = null;
        store.raidBuzzerPlayed = false;
      }
      return;
    }

    const raidMs = remainingMs(match.raidRunning, match.raidEndAt, match.raidRemainingMs, Date.now());
    const raidSec = Math.ceil(raidMs / 1000);
    if (store.trackedRaidEndAt !== match.raidEndAt) {
      store.trackedRaidEndAt = match.raidEndAt;
      store.lastRaidSecond = null;
      store.raidBuzzerPlayed = false;
    }
    if (raidSec >= 1 && raidSec <= 10 && raidSec !== store.lastRaidSecond) {
      store.lastRaidSecond = raidSec;
      playCountSound(raidSec);
    }
    if (raidSec <= 0 && !store.raidBuzzerPlayed) {
      store.raidBuzzerPlayed = true;
      playRaidBuzzer();
      speak("Time up", 1.1, 0.8);
    }
  }, [match?.raidRunning, match?.raidEndAt, match?.raidRemainingMs, match?.raidDurationMs, now]);

  if (!match) return <div className="led-loading">Waiting for match...</div>;

  const { left, right } = displayedSides(match);
  const matchRemaining = remainingMs(match.matchRunning, match.matchEndAt, match.matchRemainingMs, now);
  const raidVisible = match.raidRunning || (match.timeoutActive && match.timeoutRaidWasRunning);
  const raidRemaining = remainingMs(match.raidRunning, match.raidEndAt, match.raidRemainingMs, now);
  const raidSeconds = Math.ceil(raidRemaining / 1000);
  const raidClass = raidToneClass(raidSeconds);
  const isCritical = match.raidRunning && !match.timeoutActive && raidSeconds <= 10 && raidSeconds > 0;
  const isCompleted = match.status === "completed";
  const winner =
    Number(match.scoreA) === Number(match.scoreB)
      ? "Match Draw"
      : Number(match.scoreA) > Number(match.scoreB)
        ? match.nameA
        : match.nameB;
  const winnerLabel = Number(match.scoreA) === Number(match.scoreB) ? "Result" : "Winning Team";
  const ringOffset = RING_CIRC * (1 - raidRemaining / (match.raidDurationMs || 30000));
  const overlayOffset = OVERLAY_CIRC * (1 - raidRemaining / (match.raidDurationMs || 30000));
  const displayClasses = [
    "led-display",
    raidVisible ? "raid-active" : "",
    match.timeoutActive ? "timeout-active" : "",
    isCritical ? "raid-critical" : "",
    isCompleted ? "completed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={displayClasses}>
      <div className="led-board-wrap">
        <div className="led-team-panel team-orange">
          <div className="led-team-name outline-text">{match[`name${left}`]}</div>
          <div className="led-team-score outline-text">{match[`score${left}`]}</div>
        </div>

        <div className="led-center-panel">
          <div className="led-half-label">{match.half === 1 ? "1ST HALF" : "2ND HALF"}</div>
          <div className={match.matchRunning && !match.timeoutActive ? "led-match-clock outline-text" : "led-match-clock outline-text paused"}>
            {formatClock(matchRemaining)}
          </div>
          <div className="led-raid-ring">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle className="led-raid-ring-bg" cx="50" cy="50" r={RING_RADIUS}></circle>
              <circle
                className={`led-raid-ring-fg ${raidClass}`}
                cx="50"
                cy="50"
                r={RING_RADIUS}
                strokeDasharray={RING_CIRC}
                strokeDashoffset={ringOffset}
              ></circle>
            </svg>
            <div className={`led-raid-time outline-text ${raidClass}`}>{raidSeconds}</div>
          </div>
          <div className="led-raid-label">Raid Clock</div>

          {isCompleted && (
            <div className="led-completion show">
              <div className="led-completion-title">Match Complete</div>
              <div className="led-winner-label">{winnerLabel}</div>
              <div className="led-winner-name">{winner}</div>
            </div>
          )}
        </div>

        <div className="led-team-panel team-cyan">
          <div className="led-team-name outline-text">{match[`name${right}`]}</div>
          <div className="led-team-score outline-text">{match[`score${right}`]}</div>
        </div>
      </div>

      <div className={raidVisible ? "led-raid-top-clock show" : "led-raid-top-clock"}>
        <div className="led-raid-top-half">{match.half === 1 ? "1ST HALF" : "2ND HALF"}</div>
        <div className="led-raid-top-time">{formatClock(matchRemaining)}</div>
      </div>

      <div className={raidVisible ? "led-raid-overlay show" : "led-raid-overlay"}>
        <div className="led-raid-overlay-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="led-raid-overlay-bg" cx="50" cy="50" r={OVERLAY_RADIUS}></circle>
            <circle
              className={`led-raid-overlay-fg ${raidClass}`}
              cx="50"
              cy="50"
              r={OVERLAY_RADIUS}
              strokeDasharray={OVERLAY_CIRC}
              strokeDashoffset={overlayOffset}
            ></circle>
          </svg>
          <div className={`led-raid-overlay-time outline-text ${raidClass}`}>{raidSeconds}</div>
        </div>
        <div className="led-raid-overlay-label">Raid Clock</div>
      </div>

      <div className={match.timeoutActive ? "led-timeout-banner show" : "led-timeout-banner"}>
        <div className="led-timeout-title">Time Out</div>
        <div className="led-timeout-subtitle">Clock Paused</div>
      </div>

      <div className={isCritical ? "led-raid-alert show" : "led-raid-alert"}></div>
      <div className={connected ? "led-conn-status live" : "led-conn-status"}>
        {connected ? "Live sync" : "Showing last known state"}
      </div>

      {isCompleted && (
        <div className="led-flowers show" aria-hidden="true">
          {Array.from({ length: 20 }, (_, index) => (
            <span
              className="led-flower"
              key={index}
              style={{
                left: `${index * 5 + 1}%`,
                "--drift": `${index % 2 === 0 ? 70 : -70}px`,
                "--fall-time": `${5 + (index % 5)}s`,
                "--delay": `${-(index % 8)}s`,
              }}
            >
              *
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
