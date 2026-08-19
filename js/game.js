/* ============================================================
   Memory Match - Game Logic
   Pure front-end implementation, no external dependencies.
   ============================================================ */

(function () {
    "use strict";

    // ---------- Game configuration ----------
    var PAIRS = 8;                 // 8 pairs => 16 cards in a 4x4 grid
    var CARD_EMOJIS = [
        "🍎", "🍌", "🍇", "🍓",
        "🍒", "🥝", "🍍", "🍉"
    ];

    // ---------- State ----------
    var state = {
        cards: [],
        flipped: [],
        matchedCount: 0,
        moves: 0,
        score: 0,
        timer: null,
        seconds: 0,
        lockBoard: false,
        hintUsed: false
    };

    // ---------- DOM references ----------
    var el = {
        screenStart: document.getElementById("screen-start"),
        screenGame: document.getElementById("screen-game"),
        screenOver: document.getElementById("screen-over"),
        board: document.getElementById("board"),
        hudMoves: document.getElementById("hud-moves"),
        hudTime: document.getElementById("hud-time"),
        hudScore: document.getElementById("hud-score"),
        hudPairs: document.getElementById("hud-pairs"),
        finalMoves: document.getElementById("final-moves"),
        finalTime: document.getElementById("final-time"),
        finalScore: document.getElementById("final-score")
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

    // Interstitial ad: call this when the game ends, before showing
    // the "You Win!" screen, or right after it is shown.
    function showInterstitialAd(onClosed) {
        // TODO: e.g. AdMob: interstitial.load().then(() => interstitial.show())
        //       then call onClosed() when the ad is dismissed.
        console.log("[ADS] Interstitial ad would be shown here (game over).");
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

    // Score formula: base 1000 - moves penalty - time penalty.
    // Fewer moves & faster completion => higher score.
    function computeScore() {
        var movePenalty = state.moves * 10;
        var timePenalty = state.seconds * 2;
        return Math.max(100, 1000 - movePenalty - timePenalty);
    }

    // ============================================================
    // Screen switching
    // ============================================================

    function showScreen(name) {
        el.screenStart.classList.remove("active");
        el.screenGame.classList.remove("active");
        el.screenOver.classList.remove("active");
        if (name === "start") {
            el.screenStart.classList.add("active");
        } else if (name === "game") {
            el.screenGame.classList.add("active");
        } else if (name === "over") {
            el.screenOver.classList.add("active");
        }
    }

    // ============================================================
    // Game setup
    // ============================================================

    function buildDeck() {
        var deck = [];
        for (var i = 0; i < PAIRS; i++) {
            deck.push({ id: i, emoji: CARD_EMOJIS[i] });
            deck.push({ id: i, emoji: CARD_EMOJIS[i] });
        }
        return shuffle(deck);
    }

    function renderBoard() {
        el.board.innerHTML = "";
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

    function resetState() {
        stopTimer();
        state.cards = buildDeck();
        state.flipped = [];
        state.matchedCount = 0;
        state.moves = 0;
        state.score = 0;
        state.seconds = 0;
        state.lockBoard = false;
        state.hintUsed = false;
        updateHud();
    }

    function startGame() {
        resetState();
        renderBoard();
        showScreen("game");
        startTimer();
    }

    // ============================================================
    // Timer
    // ============================================================

    function startTimer() {
        stopTimer();
        state.timer = setInterval(function () {
            state.seconds++;
            el.hudTime.textContent = formatTime(state.seconds);
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
        el.hudMoves.textContent = state.moves;
        el.hudTime.textContent = formatTime(state.seconds);
        el.hudScore.textContent = state.score;
        el.hudPairs.textContent = state.matchedCount + "/" + PAIRS;
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

        if (card1.id === card2.id) {
            // Match found
            setTimeout(function () {
                getCardEl(i1).classList.add("matched");
                getCardEl(i2).classList.add("matched");
                state.matchedCount++;
                state.flipped = [];
                state.lockBoard = false;
                updateHud();

                if (state.matchedCount === PAIRS) {
                    onGameComplete();
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
        if (state.matchedCount === PAIRS) return;
        // Rewarded ad integration point: only grant the hint after
        // the user finished watching the ad.
        showRewardedAd(function () {
            state.hintUsed = true;
            grantHint();
        });
    }

    // ============================================================
    // Game complete
    // ============================================================

    function onGameComplete() {
        stopTimer();
        state.score = computeScore();
        updateHud();

        // Interstitial ad integration point: show an interstitial
        // when the game ends, then reveal the result screen.
        showInterstitialAd(function () {
            el.finalMoves.textContent = state.moves;
            el.finalTime.textContent = formatTime(state.seconds);
            el.finalScore.textContent = state.score;
            showScreen("over");
        });
    }

    // ============================================================
    // Event bindings
    // ============================================================

    document.getElementById("btn-start").addEventListener("click", startGame);
    document.getElementById("btn-restart").addEventListener("click", startGame);
    document.getElementById("btn-replay").addEventListener("click", startGame);
    document.getElementById("btn-menu").addEventListener("click", function () {
        showScreen("start");
    });
    document.getElementById("btn-over-menu").addEventListener("click", function () {
        showScreen("start");
    });
    document.getElementById("btn-hint").addEventListener("click", onHintClick);

    // ---------- Init ----------
    initBannerAds();
    showScreen("start");
})();
