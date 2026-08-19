/* ============================================================
   Memory Match - Game Logic (20 Levels)
   Pure front-end implementation, no external dependencies.
   ============================================================ */

(function () {
    "use strict";

    // ---------- Game configuration ----------
    var TOTAL_LEVELS = 20;
    var STORAGE_KEY = "memory-match-progress";
    var CARD_EMOJIS = [
        "🍎", "🍌", "🍇", "🍓", "🍒", "🥝",
        "🍍", "🍉", "🍑", "🥥", "🍋", "🍊",
        "🫐", "🍈", "🍐", "🍅", "🥕", "🌽"
    ];

    // ---------- Level config: grid rows x cols / pairs / time limit / score multiplier ----------
    var LEVELS = [
        { rows: 2, cols: 2, time: 60, mult: 1.0 },  //  1
        { rows: 2, cols: 3, time: 55, mult: 1.0 },  //  2
        { rows: 2, cols: 4, time: 55, mult: 1.1 },  //  3
        { rows: 3, cols: 4, time: 60, mult: 1.1 },  //  4
        { rows: 3, cols: 4, time: 55, mult: 1.2 },  //  5
        { rows: 4, cols: 4, time: 60, mult: 1.2 },  //  6
        { rows: 4, cols: 4, time: 55, mult: 1.3 },  //  7
        { rows: 4, cols: 5, time: 65, mult: 1.3 },  //  8
        { rows: 4, cols: 5, time: 60, mult: 1.4 },  //  9
        { rows: 4, cols: 6, time: 70, mult: 1.4 },  // 10
        { rows: 4, cols: 6, time: 65, mult: 1.5 },  // 11
        { rows: 5, cols: 6, time: 75, mult: 1.5 },  // 12
        { rows: 5, cols: 6, time: 70, mult: 1.6 },  // 13
        { rows: 6, cols: 6, time: 80, mult: 1.6 },  // 14
        { rows: 6, cols: 6, time: 75, mult: 1.7 },  // 15
        { rows: 6, cols: 6, time: 70, mult: 1.8 },  // 16
        { rows: 6, cols: 6, time: 65, mult: 1.9 },  // 17
        { rows: 6, cols: 6, time: 60, mult: 2.0 },  // 18
        { rows: 6, cols: 6, time: 55, mult: 2.2 },  // 19
        { rows: 6, cols: 6, time: 50, mult: 2.5 }   // 20
    ];

    // ---------- Progress persistence (localStorage with in-memory fallback) ----------
    var memoryProgress = null;
    function loadProgress() {
        if (memoryProgress !== null) return memoryProgress;
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            var data = raw ? JSON.parse(raw) : null;
            memoryProgress = {
                unlocked: data && data.unlocked ? data.unlocked : 1,
                totalScore: data && typeof data.totalScore === "number" ? data.totalScore : 0,
                completed: data && typeof data.completed === "number" ? data.completed : 0
            };
        } catch (e) {
            memoryProgress = { unlocked: 1, totalScore: 0, completed: 0 };
        }
        return memoryProgress;
    }
    function saveProgress() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryProgress));
        } catch (e) {
            // In-memory fallback already holds the value; nothing else to do.
        }
    }

    // ---------- State ----------
    var state = {
        cfg: LEVELS[0],
        cards: [],
        flipped: [],
        matchedCount: 0,
        moves: 0,
        score: 0,
        timeLeft: 0,
        timeUsed: 0,
        timer: null,
        lockBoard: false,
        hintUsed: false
    };

    // ---------- DOM references ----------
    var el = {
        screenStart: document.getElementById("screen-start"),
        screenLevels: document.getElementById("screen-levels"),
        screenGame: document.getElementById("screen-game"),
        screenOver: document.getElementById("screen-over"),
        screenVictory: document.getElementById("screen-victory"),
        levelGrid: document.getElementById("level-grid"),
        board: document.getElementById("board"),
        hudLevel: document.getElementById("hud-level"),
        hudMoves: document.getElementById("hud-moves"),
        hudTime: document.getElementById("hud-time"),
        hudScore: document.getElementById("hud-score"),
        hudPairs: document.getElementById("hud-pairs"),
        overTitle: document.getElementById("over-title"),
        finalMoves: document.getElementById("final-moves"),
        finalTime: document.getElementById("final-time"),
        finalBase: document.getElementById("final-base"),
        finalMultLabel: document.getElementById("final-mult-label"),
        finalScore: document.getElementById("final-score"),
        btnNextLevel: document.getElementById("btn-next-level"),
        btnRetry: document.getElementById("btn-retry"),
        victoryLevels: document.getElementById("victory-levels"),
        victoryScore: document.getElementById("victory-score")
    };

    // ============================================================
    // AD SDK INTEGRATION POINTS
    // ------------------------------------------------------------
    // The four functions below are stubs. When you integrate an ad
    // SDK (AdSense / AdMob / Pangle / Unity Ads ...), replace the
    // bodies with your SDK calls. The game only calls these stubs,
    // so you never need to touch the game loop for ads.
    // ============================================================

    // Banner ads: usually auto-render once the SDK is initialized.
    // Keep the placeholder divs in index.html and let the SDK inject
    // into them, or remove the divs and let the SDK manage placement.
    function initBannerAds() {
        // TODO: e.g. AdSense: (adsbygoogle = window.adsbygoogle || []).push({});
        // TODO: e.g. AdMob: banner.load(); banner.show();
        console.log("[ADS] Banner slots ready (top / bottom).");
    }

    // Interstitial ad: call this on level switching (a level is
    // completed and the player moves on to the next level).
    function showInterstitialAd(onClosed) {
        // TODO: e.g. AdMob: interstitial.load().then(() => interstitial.show())
        //       then call onClosed() when the ad is dismissed.
        console.log("[ADS] Interstitial ad would be shown here (level complete).");
        if (typeof onClosed === "function") {
            onClosed();
        }
    }

    // Rewarded video ad: grants the player a hint after watching.
    function showRewardedAd(onRewarded) {
        // TODO: e.g. AdMob Rewarded: rewarded.show() -> onUserEarnedReward
        //       then call onRewarded() only if the reward was granted.
        console.log("[ADS] Rewarded video ad would be shown here (hint reward).");
        if (typeof onRewarded === "function") {
            onRewarded();
        }
    }

    // ============================================================
    // Utilities
    // ============================================================

    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }

    function formatTime(sec) {
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        return m + ":" + (s < 10 ? "0" : "") + s;
    }

    function round1(v) {
        return Math.round(v * 10) / 10;
    }

    // Score formula: (1000 - moves penalty - time penalty) x level multiplier.
    // Fewer moves & faster completion => higher base score.
    function computeScore() {
        var movePenalty = state.moves * 10;
        var timePenalty = state.timeUsed * 2;
        var base = Math.max(100, 1000 - movePenalty - timePenalty);
        return { base: base, final: Math.round(base * state.cfg.mult) };
    }

    // ============================================================
    // Screen switching
    // ============================================================

    function showScreen(name) {
        el.screenStart.classList.remove("active");
        el.screenLevels.classList.remove("active");
        el.screenGame.classList.remove("active");
        el.screenOver.classList.remove("active");
        el.screenVictory.classList.remove("active");
        if (name === "start") {
            el.screenStart.classList.add("active");
        } else if (name === "levels") {
            el.screenLevels.classList.add("active");
        } else if (name === "game") {
            el.screenGame.classList.add("active");
        } else if (name === "over") {
            el.screenOver.classList.add("active");
        } else if (name === "victory") {
            el.screenVictory.classList.add("active");
        }
    }

    // ============================================================
    // Level select
    // ============================================================

    function renderLevelSelect() {
        var progress = loadProgress();
        el.levelGrid.innerHTML = "";
        for (var i = 1; i <= TOTAL_LEVELS; i++) {
            var btn = document.createElement("button");
            btn.className = "level-btn" + (i <= progress.unlocked ? "" : " locked");
            btn.dataset.level = i;

            var num = document.createElement("span");
            num.className = "level-num";
            num.textContent = (i <= progress.unlocked) ? i : "🔒";

            var mult = document.createElement("span");
            mult.className = "level-mult";
            mult.textContent = "x" + round1(LEVELS[i - 1].mult);

            btn.appendChild(num);
            btn.appendChild(mult);

            if (i <= progress.unlocked) {
                btn.addEventListener("click", function () {
                    startLevel(parseInt(this.dataset.level, 10));
                });
            }
            el.levelGrid.appendChild(btn);
        }
    }

    // ============================================================
    // Game setup
    // ============================================================

    function buildDeck(pairs) {
        var deck = [];
        for (var i = 0; i < pairs; i++) {
            deck.push({ id: i, emoji: CARD_EMOJIS[i] });
            deck.push({ id: i, emoji: CARD_EMOJIS[i] });
        }
        return shuffle(deck);
    }

    function renderBoard() {
        el.board.innerHTML = "";
        el.board.dataset.cols = state.cfg.cols;
        el.board.style.gridTemplateColumns = "repeat(" + state.cfg.cols + ", 1fr)";

        state.cards.forEach(function (card, index) {
            var cardEl = document.createElement("div");
            cardEl.className = "card";
            cardEl.dataset.index = index;

            var back = document.createElement("div");
            back.className = "card-face card-back";

            var front = document.createElement("div");
            front.className = "card-face card-front";
            front.textContent = card.emoji;

            cardEl.appendChild(back);
            cardEl.appendChild(front);
            cardEl.addEventListener("click", function () {
                onCardClick(index);
            });
            el.board.appendChild(cardEl);
        });
    }

    function startLevel(level) {
        stopTimer();
        state.cfg = LEVELS[level - 1];
        state.cards = buildDeck(state.cfg.rows * state.cfg.cols / 2);
        state.flipped = [];
        state.matchedCount = 0;
        state.moves = 0;
        state.score = 0;
        state.timeLeft = state.cfg.time;
        state.timeUsed = 0;
        state.lockBoard = false;
        state.hintUsed = false;

        renderBoard();
        updateHud();
        showScreen("game");
        startTimer();
    }

    // ============================================================
    // Timer
    // ============================================================

    function startTimer() {
        stopTimer();
        state.timer = setInterval(function () {
            state.timeLeft--;
            state.timeUsed++;
            updateHud();
            if (state.timeLeft <= 0) {
                onTimeUp();
            }
        }, 1000);
    }

    function stopTimer() {
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
    }

    // ============================================================
    // HUD
    // ============================================================

    function updateHud() {
        el.hudLevel.textContent = state.cfg.rows + "x" + state.cfg.cols + " (Lv" + (LEVELS.indexOf(state.cfg) + 1) + ")";
        el.hudMoves.textContent = state.moves;
        el.hudTime.textContent = formatTime(Math.max(0, state.timeLeft));
        el.hudTime.classList.toggle("low", state.timeLeft <= 10);
        el.hudScore.textContent = state.score;
        el.hudPairs.textContent = state.matchedCount + "/" + (state.cfg.rows * state.cfg.cols / 2);
    }

    // ============================================================
    // Card interaction
    // ============================================================

    function getCardEl(index) {
        return el.board.children[index];
    }

    function flipCard(index) {
        var cardEl = getCardEl(index);
        if (cardEl) {
            cardEl.classList.add("flipped");
        }
    }

    function onCardClick(index) {
        if (state.lockBoard) return;

        var cardEl = getCardEl(index);
        // Ignore already flipped / matched cards
        if (!cardEl || cardEl.classList.contains("flipped")) return;

        flipCard(index);
        state.flipped.push(index);

        if (state.flipped.length === 2) {
            state.moves++;
            state.lockBoard = true;
            checkMatch();
        }
    }

    function checkMatch() {
        var i1 = state.flipped[0];
        var i2 = state.flipped[1];
        var card1 = state.cards[i1];
        var card2 = state.cards[i2];
        var totalPairs = state.cfg.rows * state.cfg.cols / 2;

        if (card1.id === card2.id) {
            // Match found
            setTimeout(function () {
                getCardEl(i1).classList.add("matched");
                getCardEl(i2).classList.add("matched");
                state.matchedCount++;
                state.flipped = [];
                state.lockBoard = false;
                updateHud();

                if (state.matchedCount === totalPairs) {
                    onLevelComplete();
                }
            }, 350);
        } else {
            // No match: flip back after a short delay
            setTimeout(function () {
                getCardEl(i1).classList.remove("flipped");
                getCardEl(i2).classList.remove("flipped");
                state.flipped = [];
                state.lockBoard = false;
            }, 800);
        }
        updateHud();
    }

    // ============================================================
    // Hint (Rewarded video reward)
    // ============================================================

    function grantHint() {
        // Briefly reveal all unmatched cards
        state.cards.forEach(function (card, index) {
            var cardEl = getCardEl(index);
            if (cardEl && !cardEl.classList.contains("matched") && !cardEl.classList.contains("flipped")) {
                cardEl.classList.add("flipped");
            }
        });

        setTimeout(function () {
            state.cards.forEach(function (card, index) {
                var cardEl = getCardEl(index);
                if (cardEl && !cardEl.classList.contains("matched")) {
                    cardEl.classList.remove("flipped");
                }
            });
        }, 1000);
    }

    function onHintClick() {
        var totalPairs = state.cfg.rows * state.cfg.cols / 2;
        if (state.matchedCount === totalPairs) return;
        // Rewarded ad integration point: only grant the hint after
        // the user finished watching the ad.
        showRewardedAd(function () {
            state.hintUsed = true;
            grantHint();
        });
    }

    // ============================================================
    // Level complete / time up
    // ============================================================

    function onLevelComplete() {
        stopTimer();
        var s = computeScore();
        state.score = s.final;
        updateHud();

        // Progress: unlock next level, accumulate total score
        var progress = loadProgress();
        var currentLevel = LEVELS.indexOf(state.cfg) + 1;
        progress.totalScore += s.final;
        progress.completed = Math.max(progress.completed, currentLevel);
        if (currentLevel < TOTAL_LEVELS) {
            progress.unlocked = Math.max(progress.unlocked, currentLevel + 1);
        } else {
            progress.unlocked = TOTAL_LEVELS;
        }
        saveProgress();

        // Interstitial ad integration point: show an interstitial on
        // level transition, then reveal the result screen.
        showInterstitialAd(function () {
            showOver("win", s);
        });
    }

    function onTimeUp() {
        stopTimer();
        state.lockBoard = true;
        showOver("fail", null);
    }

    function showOver(mode, scoreInfo) {
        if (mode === "win") {
            el.overTitle.textContent = "Level Complete!";
            el.finalMoves.textContent = state.moves;
            el.finalTime.textContent = formatTime(state.timeUsed);
            el.finalBase.textContent = scoreInfo.base;
            el.finalMultLabel.textContent = "x" + round1(state.cfg.mult);
            el.finalScore.textContent = scoreInfo.final;
            el.btnNextLevel.style.display = (LEVELS.indexOf(state.cfg) + 1 < TOTAL_LEVELS) ? "" : "none";
            el.btnRetry.style.display = "none";
        } else {
            el.overTitle.textContent = "Time's Up!";
            el.finalMoves.textContent = state.moves;
            el.finalTime.textContent = formatTime(state.timeUsed);
            el.finalBase.textContent = "-";
            el.finalMultLabel.textContent = "";
            el.finalScore.textContent = state.matchedCount + " / " + (state.cfg.rows * state.cfg.cols / 2) + " pairs";
            el.btnNextLevel.style.display = "none";
            el.btnRetry.style.display = "";
        }
        showScreen("over");
    }

    function showVictory() {
        var progress = loadProgress();
        el.victoryLevels.textContent = progress.completed;
        el.victoryScore.textContent = progress.totalScore;
        showScreen("victory");
    }

    // ============================================================
    // Event bindings
    // ============================================================

    document.getElementById("btn-start").addEventListener("click", function () {
        renderLevelSelect();
        showScreen("levels");
    });
    document.getElementById("btn-levels-back").addEventListener("click", function () {
        showScreen("start");
    });
    document.getElementById("btn-restart").addEventListener("click", function () {
        startLevel(LEVELS.indexOf(state.cfg) + 1);
    });
    document.getElementById("btn-menu").addEventListener("click", function () {
        stopTimer();
        renderLevelSelect();
        showScreen("levels");
    });
    document.getElementById("btn-over-levels").addEventListener("click", function () {
        renderLevelSelect();
        showScreen("levels");
    });
    document.getElementById("btn-next-level").addEventListener("click", function () {
        var next = LEVELS.indexOf(state.cfg) + 2;
        if (next > TOTAL_LEVELS) {
            showVictory();
        } else {
            startLevel(next);
        }
    });
    document.getElementById("btn-retry").addEventListener("click", function () {
        startLevel(LEVELS.indexOf(state.cfg) + 1);
    });
    document.getElementById("btn-victory-replay").addEventListener("click", function () {
        renderLevelSelect();
        showScreen("levels");
    });
    document.getElementById("btn-victory-menu").addEventListener("click", function () {
        showScreen("start");
    });
    document.getElementById("btn-hint").addEventListener("click", onHintClick);

    // ---------- Init ----------
    initBannerAds();
    loadProgress();
    showScreen("start");
})();
