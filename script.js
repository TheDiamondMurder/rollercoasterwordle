const form = document.querySelector("#guess-form");
const input = document.querySelector("#guess-input");
const suggestions = document.querySelector("#suggestions");
const guessBody = document.querySelector("#guess-body");
const statusText = document.querySelector("#status");
const newGameButton = document.querySelector("#new-game");

let coasters = [];
let target = null;
let guesses = [];
let activeSuggestion = -1;
const maxGuesses = 6;

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function daySeed() {
  const now = new Date();
  return Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`);
}

function seededIndex(seed, length) {
  const x = Math.sin(seed) * 10000;
  return Math.floor((x - Math.floor(x)) * length);
}

function renderEmptyBoard() {
  guessBody.replaceChildren(
    ...Array.from({ length: maxGuesses }, () => {
      const row = document.createElement("tr");
      for (let index = 0; index < 6; index += 1) {
        const td = document.createElement("td");
        td.className = "cell empty";
        row.appendChild(td);
      }
      return row;
    }),
  );
}

function hideSuggestions() {
  suggestions.hidden = true;
  suggestions.replaceChildren();
  activeSuggestion = -1;
}

function pickTarget(random = false) {
  const seed = random ? Date.now() : daySeed();
  target = coasters[seededIndex(seed, coasters.length)];
  guesses = [];
  renderEmptyBoard();
  statusText.textContent = "6 guesses. No tiny kiddie coasters. No mercy.";
  input.disabled = false;
  input.value = "";
  form.querySelector("button").disabled = false;
  hideSuggestions();
}

function findCoaster(name) {
  const needle = normalize(name);
  return coasters.find((coaster) => normalize(coaster.name) === needle);
}

function numericClass(value, answer) {
  if (value === answer) return "correct";
  return value < answer ? "low" : "high";
}

function numericHint(value, answer) {
  if (value === answer) return "correct";
  return value < answer ? "too low" : "too high";
}

function cell(value, className, hint = "") {
  const td = document.createElement("td");
  td.className = `cell ${className}`;
  td.textContent = value;
  if (hint) {
    const small = document.createElement("span");
    small.className = "hint";
    small.textContent = hint;
    td.appendChild(small);
  }
  return td;
}

function renderGuess(coaster) {
  const row = guessBody.children[guesses.length - 1] || document.createElement("tr");
  const name = document.createElement("td");
  name.textContent = coaster.name;
  row.replaceChildren(
    name,
    cell(coaster.park, coaster.park === target.park ? "correct" : "wrong"),
    cell(`${coaster.speed} mph`, numericClass(coaster.speed, target.speed), numericHint(coaster.speed, target.speed)),
    cell(coaster.inversions, numericClass(coaster.inversions, target.inversions), numericHint(coaster.inversions, target.inversions)),
    cell(`${coaster.height} ft`, numericClass(coaster.height, target.height), numericHint(coaster.height, target.height)),
    cell(coaster.year, numericClass(coaster.year, target.year), numericHint(coaster.year, target.year)),
  );
}

function getMatches(query) {
  const needle = normalize(query);
  if (!needle) return [];
  return coasters
    .filter((coaster) => normalize(coaster.name).includes(needle))
    .filter((coaster) => !guesses.some((guess) => guess.name === coaster.name))
    .slice(0, 8);
}

function selectSuggestion(name) {
  input.value = name;
  hideSuggestions();
  input.focus();
}

function renderSuggestions() {
  const matches = getMatches(input.value);
  activeSuggestion = -1;
  if (!matches.length) {
    hideSuggestions();
    return;
  }

  suggestions.replaceChildren(
    ...matches.map((coaster) => {
      const button = document.createElement("button");
      const park = document.createElement("span");
      button.className = "suggestion";
      button.type = "button";
      button.append(coaster.name);
      park.textContent = coaster.park;
      button.appendChild(park);
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        selectSuggestion(coaster.name);
      });
      return button;
    }),
  );
  suggestions.hidden = false;
}

function moveSuggestion(direction) {
  const buttons = [...suggestions.querySelectorAll(".suggestion")];
  if (!buttons.length) return;
  activeSuggestion = (activeSuggestion + direction + buttons.length) % buttons.length;
  buttons.forEach((button, index) => button.classList.toggle("active", index === activeSuggestion));
  input.value = buttons[activeSuggestion].childNodes[0].textContent;
}

function endGame(won) {
  input.disabled = true;
  form.querySelector("button").disabled = true;
  hideSuggestions();
  statusText.textContent = won
    ? `Correct. It was ${target.name}.`
    : `Finished. It was ${target.name} at ${target.park}.`;
}

function submitGuess(event) {
  event.preventDefault();
  const coaster = findCoaster(input.value.trim());

  if (!coaster) {
    statusText.textContent = "That coaster is not in the major UK coaster list.";
    renderSuggestions();
    return;
  }

  if (guesses.some((guess) => guess.name === coaster.name)) {
    statusText.textContent = "You already guessed that one.";
    input.value = "";
    hideSuggestions();
    return;
  }

  guesses.push(coaster);
  renderGuess(coaster);
  input.value = "";
  hideSuggestions();

  if (coaster.name === target.name) {
    endGame(true);
    return;
  }

  if (guesses.length >= maxGuesses) {
    endGame(false);
    return;
  }

  statusText.textContent = `${maxGuesses - guesses.length} guesses left.`;
}

async function init() {
  const response = await fetch("data/coasters.json?v=1");
  const data = await response.json();
  coasters = data.coasters.sort((a, b) => a.name.localeCompare(b.name));
  pickTarget();
}

form.addEventListener("submit", submitGuess);
newGameButton.addEventListener("click", () => pickTarget(true));
input.addEventListener("input", renderSuggestions);
input.addEventListener("focus", renderSuggestions);
input.addEventListener("blur", () => setTimeout(hideSuggestions, 100));
input.addEventListener("keydown", (event) => {
  if (suggestions.hidden) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSuggestion(1);
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSuggestion(-1);
  }
  if (event.key === "Escape") hideSuggestions();
});

init().catch((error) => {
  statusText.textContent = `Could not load coaster data: ${error.message}`;
});
