let players = {
  1: { hp: 15, maxHp: 15, mp: 1, maxMp: 1, deck: [], hand: [], stage: {left: null, center: null, right: null}, leader: null, weapon: null, leaderAttackCount: 0, trash: [], lostZone: [], destroyedThisTurn: 0 },
  2: { hp: 15, maxHp: 15, mp: 1, maxMp: 1, deck: [], hand: [], stage: {left: null, center: null, right: null}, leader: null, weapon: null, leaderAttackCount: 0, trash: [], lostZone: [], destroyedThisTurn: 0 }
};
let currentTurn = 1; 
let isGameOver = false;
let isGameStarted = false;
let myPlayerId = null; 
let myRoomId = ""; 

let isSoloMode = false;

const DECK_LIMIT = 40;

// 画面サイズ自動調整
function resizeGame() {
  const container = document.getElementById('game-container');
  if(!container) return;
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  container.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener('resize', resizeGame);

let savedDecks = JSON.parse(localStorage.getItem("savedDecks"));
if (!savedDecks) {
  let oldDeck = JSON.parse(localStorage.getItem("myCustomDeck"));
  let oldLeader = JSON.parse(localStorage.getItem("myLeaderCard"));
  if (oldDeck && oldDeck.length > 0) {
    savedDecks = [{ name: "最初のデッキ", deck: oldDeck, leader: oldLeader }];
  } else {
    savedDecks = [{ name: "新規デッキ 1", deck: [], leader: null }];
  }
  localStorage.setItem("savedDecks", JSON.stringify(savedDecks));
} else {
  const allCards = getCardTypes();
  let updated = false;
  savedDecks.forEach(deckData => {
    if (deckData.deck) {
      deckData.deck = deckData.deck.map(savedCard => {
        let latestCard = allCards.find(c => c.name === savedCard.name);
        if (latestCard) { updated = true; return JSON.parse(JSON.stringify(latestCard)); }
        return savedCard;
      });
    }
    if (deckData.leader) {
      let latestLeader = allCards.find(c => c.name === deckData.leader.name);
      if (latestLeader) { updated = true; deckData.leader = JSON.parse(JSON.stringify(latestLeader)); }
    }
  });
  if (updated) {
    localStorage.setItem("savedDecks", JSON.stringify(savedDecks));
  }
}

let currentDeckIndex = parseInt(localStorage.getItem("currentDeckIndex")) || 0;
if (currentDeckIndex >= savedDecks.length) currentDeckIndex = 0;

let myCustomDeck = savedDecks[currentDeckIndex].deck || [];
let myLeaderCard = savedDecks[currentDeckIndex].leader || null; 
let opponentDeck = []; 
let opponentLeader = null;

let currentFilter = "all";
let isSelectingHand = false;
let selectionCallback = null;
let isSelectingStage = false;
let selectionStageCallback = null;
let pendingSelection = null; 

const infoPanel = document.getElementById("info-panel");
const deckInfoPanel = document.getElementById("deck-info-panel");
const endTurnBtn = document.getElementById("end-turn-btn");
const retryBtn = document.getElementById("retry-btn");
const surrenderBtn = document.getElementById("surrender-btn");

if (!myLeaderCard) { myLeaderCard = getCardTypes().find(c => c.type === "leader"); }

function resetCardState(card) {
  const template = getCardTypes().find(c => c.name === card.name);
  if (template) {
    if (template.attack !== undefined) card.attack = template.attack;
    if (template.hp !== undefined) card.hp = template.hp;
    if (template.effectValue !== undefined) card.effectValue = template.effectValue;
    card.cost = card.originalCost !== undefined ? card.originalCost : template.cost;
  }
  card.attackCount = 0;
  card.hasBarrier = false;
  card.infection = false;
  card.burnActive = false;
  card.turnAttackBoost = 0;
  card.soul = [];
  return card;
}

function getCardInfoText(card) {
  const attrMap = { 
    fire: "🔥炎", water: "💧水", wood: "🌿木", light: "✨光", dark: "🌙闇", neutral: "⚪無", god: "👁️神", sea_god: "🌊海神", human: "👤人", spirit: "👻霊", magic_attr: "🔮魔", fairy_attr: "🧚精霊", fire_magic: "🔥熱/魔", electric_magic: "⚡電気/魔",
    bice: "🏎️BICE", bice_epic: "👑BICE/EPIC", reliance: "🤝依存"
  };
  const attrName = attrMap[card.attribute] || "不明";
  
  let skillTags = [];
  if (card.evolution) skillTags.push("【進化】");
  if (card.transform) skillTags.push("【変身】");
  if (card.ward) skillTags.push("【守護】");
  if (card.pierce) skillTags.push("【貫通】");
  if (card.superPierce) skillTags.push("【超貫通】");
  if (card.doubleAttack) skillTags.push("【2回攻撃】");
  if (card.soulGuard) skillTags.push("【ソウルガード】");
  if (card.infection) skillTags.push("【感染症】");
  if (card.burn) skillTags.push("【燃焼】");
  if (card.drain) skillTags.push("【ドレイン】");
  if (card.connectSkill) skillTags.push("【コネクト】");
  if (card.connectOpposite) skillTags.push("【対面接続】");
  if (card.arts !== undefined) skillTags.push(`【アーツ${card.arts}】`);
  if (card.accel !== undefined) skillTags.push(`【アクセラ${card.accel}】`);
  
  let skillPrefix = skillTags.length > 0 ? skillTags.join(" ") + " " : "";
  let descText = card.desc ? card.desc : "特殊能力なし。";
  let statsText = "";
  
  let displayAttack = card.attack + (card.turnAttackBoost || 0);
  if (card.name === "海神 アオクジラ" && card.soul && card.soul.length > 0) {
    let ownerId = null;
    for (let i = 1; i <= 2; i++) {
      if (players[i] && players[i].hand) {
        if (players[i].hand.some(c => c.id === card.id)) ownerId = i;
        Object.values(players[i].stage).forEach(c => { if (c && c.id === card.id) ownerId = i; });
      }
    }
    if (ownerId && players[ownerId].lostZone.length > 0) { displayAttack += card.soul.length; }
  }

  if (card.type === "monster" || card.type === "leader") statsText = `(攻撃: ${displayAttack} / HP: ${card.hp})`;
  else if (card.type === "item") statsText = `(攻撃: +${card.effectValue})`;

  let soulText = (card.soul && card.soul.length > 0) ? `<br>🟣 <b>ソウル:</b> ${card.soul.length}枚` : "";
  if (card.burnActive) soulText += `<br><span style="color:#e74c3c; font-weight:bold;">🔥 燃焼スキル発動中！</span>`;

  return `🔍 <b>${card.name}</b> ${statsText} 【属性: ${attrName}】<br>${skillPrefix}効果: ${descText}${soulText}`;
}

function showCardEffect(card) {
  const overlay = document.getElementById("card-effect-overlay");
  const container = document.getElementById("card-effect-container");
  container.innerHTML = generateCardHtml(card, "", "box-shadow: 0 0 20px rgba(255,255,255,0.8); transform: scale(1.5);");
  overlay.style.opacity = "1"; container.style.transform = "scale(1.2)";
  setTimeout(() => { overlay.style.opacity = "0"; container.style.transform = "scale(0.5)"; }, 1500);
}
if (!isSoloMode) socket.on('show_card_effect', (card) => { showCardEffect(card); });

const homeScreen = document.getElementById("home-screen");
const deckEditScreen = document.getElementById("deck-edit-screen");
const joinRoomBtn = document.getElementById("join-room-btn");
const roomIdInput = document.getElementById("room-id-input");
const saveDeckBtn = document.getElementById("save-deck-btn");
const deckSelect = document.getElementById("deck-select");
const editDeckBtn = document.getElementById("edit-deck-btn");
const newDeckBtn = document.getElementById("new-deck-btn");
const copyDeckBtn = document.getElementById("copy-deck-btn");
const deckNameInput = document.getElementById("deck-name-input");
const deleteDeckBtn = document.getElementById("delete-deck-btn");
const soloModeBtn = document.getElementById("solo-mode-btn");

function updateDeckSelect() {
  deckSelect.innerHTML = "";
  savedDecks.forEach((d, index) => {
    const opt = document.createElement("option");
    opt.value = index;
    opt.innerText = d.name || `デッキ ${index + 1}`;
    if (index === currentDeckIndex) opt.selected = true;
    deckSelect.appendChild(opt);
  });
}
updateDeckSelect();

deckSelect.addEventListener("change", (e) => {
  currentDeckIndex = parseInt(e.target.value);
  localStorage.setItem("currentDeckIndex", currentDeckIndex);
  myCustomDeck = savedDecks[currentDeckIndex].deck || [];
  myLeaderCard = savedDecks[currentDeckIndex].leader || getCardTypes().find(c => c.type === "leader");
});

newDeckBtn.addEventListener("click", () => {
  savedDecks.push({ name: `新規デッキ ${savedDecks.length + 1}`, deck: [], leader: null });
  currentDeckIndex = savedDecks.length - 1;
  localStorage.setItem("savedDecks", JSON.stringify(savedDecks));
  localStorage.setItem("currentDeckIndex", currentDeckIndex);
  myCustomDeck = [];
  myLeaderCard = getCardTypes().find(c => c.type === "leader");
  updateDeckSelect();
  openDeckEditor();
});

copyDeckBtn.addEventListener("click", () => {
  let currentDeck = savedDecks[currentDeckIndex];
  let newDeck = JSON.parse(JSON.stringify(currentDeck));
  newDeck.name = currentDeck.name + " (コピー)";
  savedDecks.push(newDeck);
  currentDeckIndex = savedDecks.length - 1;
  localStorage.setItem("savedDecks", JSON.stringify(savedDecks));
  localStorage.setItem("currentDeckIndex", currentDeckIndex);
  myCustomDeck = newDeck.deck || [];
  myLeaderCard = newDeck.leader || getCardTypes().find(c => c.type === "leader");
  updateDeckSelect();
  alert(`「${newDeck.name}」を作成しました！`);
});

editDeckBtn.addEventListener("click", () => {
  if (!myLeaderCard) myLeaderCard = getCardTypes().find(c => c.type === "leader");
  openDeckEditor();
});

deleteDeckBtn.addEventListener("click", () => {
  if (confirm("本当にこのデッキを削除しますか？\n（この操作は取り消せません）")) {
    savedDecks.splice(currentDeckIndex, 1);
    if (savedDecks.length === 0) {
      savedDecks.push({ name: "新規デッキ 1", deck: [], leader: getCardTypes().find(c => c.type === "leader") });
    }
    currentDeckIndex = 0;
    localStorage.setItem("savedDecks", JSON.stringify(savedDecks));
    localStorage.setItem("currentDeckIndex", currentDeckIndex);
    
    myCustomDeck = savedDecks[currentDeckIndex].deck || [];
    myLeaderCard = savedDecks[currentDeckIndex].leader || getCardTypes().find(c => c.type === "leader");
    updateDeckSelect();
    
    deckEditScreen.style.display = "none";
    homeScreen.style.display = "flex";
  }
});

function openDeckEditor() {
  homeScreen.style.display = "none"; 
  deckEditScreen.style.display = "flex"; 
  deckNameInput.value = savedDecks[currentDeckIndex].name || `デッキ ${currentDeckIndex + 1}`;
  renderDeckEditor();
}

joinRoomBtn.addEventListener("click", () => {
  const val = roomIdInput.value.trim(); 
  if (val !== "") {
    if (myCustomDeck.length !== DECK_LIMIT) { alert(`デッキは必ず ${DECK_LIMIT}枚 にしてください！（現在 ${myCustomDeck.length}枚）`); return; }
    isSoloMode = false;
    myRoomId = val; 
    homeScreen.style.display = "none"; 
    document.getElementById('game-wrap').style.display = 'block';
    resizeGame();
    socket.emit("join_room", { roomId: myRoomId, deck: myCustomDeck, leader: myLeaderCard, playerId: myPlayerId }); 
  } else { alert("合言葉を入力してください！"); }
});

// ★ ボス選択の処理を追加
soloModeBtn.addEventListener("click", () => {
  if (myCustomDeck.length !== DECK_LIMIT) { alert(`デッキは必ず ${DECK_LIMIT}枚 にしてください！（現在 ${myCustomDeck.length}枚）`); return; }
  isSoloMode = true;
  myRoomId = "solo-room"; 
  myPlayerId = 1;
  applyBoardLayout(myPlayerId); 
  homeScreen.style.display = "none"; 
  document.getElementById('game-wrap').style.display = 'block';
  resizeGame();
  
  let bossType = document.getElementById("solo-boss-select").value;
  
  opponentDeck = [];
  let aiCardTypes = getCardTypes().filter(c => c.category === "test" && c.type === "monster");
  for(let i=0; i<DECK_LIMIT; i++) {
    opponentDeck.push(JSON.parse(JSON.stringify(aiCardTypes[Math.floor(Math.random() * aiCardTypes.length)])));
  }
  
  if (bossType === "dragon") {
      opponentLeader = { name: "ダークドラゴン", type: "leader", originalCost: 0, cost: 0, attack: 2, hp: 50, image: "🐉", attribute: "dark", desc: "【常時】相手のセンターにモンスターがいないなら、ターン終了時に相手のリーダーに2ダメージを与える。" };
  } else if (bossType === "satan") {
      // ★ 新ボス：大悪魔 サタン
      opponentLeader = { name: "大悪魔 サタン", type: "leader", originalCost: 0, cost: 0, attack: 3, hp: 66, image: "👿", attribute: "dark", desc: "【常時】ターン終了時、相手のランダムなモンスター1体に4ダメージを与える。モンスターがいない場合、相手リーダーに2ダメージを与える。" };
  } else if (bossType === "disaster") {
      // ★ 超高難易度ボス：ディザスター
      opponentLeader = { name: "絶望の魔神 ディザスター", type: "leader", originalCost: 0, cost: 0, attack: 4, hp: 80, image: "🌋", attribute: "dark", desc: "【常時】ターン終了時、相手の全モンスターに3ダメージ！相手の場にモンスターがいない場合、相手リーダーに5ダメージ！！" };
  }
  
  startGame();
});

saveDeckBtn.addEventListener("click", () => {
  if (myCustomDeck.length !== DECK_LIMIT && myCustomDeck.length > 0) {
    if(!confirm(`デッキが${DECK_LIMIT}枚ではありません（現在${myCustomDeck.length}枚）。\nこのまま保存して戻りますか？`)) return;
  }
  savedDecks[currentDeckIndex].name = deckNameInput.value.trim() || `デッキ ${currentDeckIndex + 1}`;
  savedDecks[currentDeckIndex].deck = myCustomDeck;
  savedDecks[currentDeckIndex].leader = myLeaderCard;
  localStorage.setItem("savedDecks", JSON.stringify(savedDecks));
  updateDeckSelect();

  deckEditScreen.style.display = "none"; homeScreen.style.display = "flex";
});

window.setFilter = function(filterStr) { currentFilter = filterStr; renderDeckEditor(); };

function renderDeckEditor() {
  document.getElementById("deck-count").innerText = myCustomDeck.length;
  document.getElementById("my-leader-board").innerHTML = generateCardHtml(myLeaderCard, `draggable="false"`, "deck-card");

  let catalogHtml = ""; 
  getCardTypes().forEach((card, index) => { 
    let isMatch = false;
    if (currentFilter === 'all') isMatch = true;
    else if (currentFilter === 'leader' && card.type === 'leader') isMatch = true;
    else if (currentFilter === 'monster' && card.type === 'monster') isMatch = true;
    else if (currentFilter === 'magic' && (card.type === 'magic' || card.type === 'set_magic' || card.type === 'item')) isMatch = true;
    else if (currentFilter === card.category) isMatch = true; 

    if (isMatch) { catalogHtml += generateCardHtml(card, `data-catalog-index="${index}" draggable="true"`, "catalog-card"); }
  });
  document.getElementById("catalog-board").innerHTML = catalogHtml;
  
  let deckCounts = {};
  myCustomDeck.forEach(card => {
    if (!deckCounts[card.name]) deckCounts[card.name] = { card: card, count: 0 };
    deckCounts[card.name].count++;
  });

  let myDeckHtml = ""; 
  Object.values(deckCounts).forEach(data => { 
    let safeName = data.card.name.replace(/"/g, '&quot;');
    myDeckHtml += generateCardHtml(data.card, `data-card-name="${safeName}" draggable="true"`, "deck-card", data.count); 
  });
  document.getElementById("my-deck-board").innerHTML = myDeckHtml;
  attachDeckEditorListeners(); 
}

function attachDeckEditorListeners() {
  document.querySelectorAll(".catalog-card").forEach(el => {
    el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ source: 'catalog', index: el.dataset.catalogIndex })); el.classList.add("dragging"); });
    el.addEventListener("dragend", () => el.classList.remove("dragging"));
    el.addEventListener("click", () => { deckInfoPanel.innerHTML = getCardInfoText(getCardTypes()[el.dataset.catalogIndex]); });
  });

  document.querySelectorAll("#my-deck-board .deck-card").forEach(el => {
    el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ source: 'deck', name: el.dataset.cardName })); el.classList.add("dragging"); });
    el.addEventListener("dragend", () => el.classList.remove("dragging"));
    el.addEventListener("click", () => { 
      let targetName = el.dataset.cardName.replace(/&quot;/g, '"');
      const card = myCustomDeck.find(c => c.name === targetName);
      if (card) deckInfoPanel.innerHTML = getCardInfoText(card); 
    });
  });

  document.querySelector("#my-leader-board .deck-card").addEventListener("click", () => {
    deckInfoPanel.innerHTML = getCardInfoText(myLeaderCard);
  });
}

const myDeckBoard = document.getElementById("my-deck-board");
const catalogBoard = document.getElementById("catalog-board");
const myLeaderBoard = document.getElementById("my-leader-board");

[myDeckBoard, catalogBoard, myLeaderBoard].forEach(zone => {
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.style.backgroundColor = "rgba(255,255,255,0.1)"; });
  zone.addEventListener("dragleave", e => { zone.style.backgroundColor = ""; });
});

myDeckBoard.addEventListener("drop", e => {
  e.preventDefault(); myDeckBoard.style.backgroundColor = "";
  try {
    const data = JSON.parse(e.dataTransfer.getData("text/plain"));
    if (data.source === 'catalog') {
      const card = getCardTypes()[data.index];
      if (card.type === "leader") { alert("リーダーカードはデッキに入れられません！\n上の『リーダー枠』に入れてください。"); return; }
      if (myCustomDeck.length >= DECK_LIMIT) { alert(`デッキは最大${DECK_LIMIT}枚までです！`); return; }

      if (card.name !== "アオノメ") {
        const sameCardCount = myCustomDeck.filter(c => c.name === card.name).length;
        if (sameCardCount >= 4) {
          alert(`「${card.name}」はデッキに4枚までしか入れられません！`);
          return;
        }
      }

      myCustomDeck.push(card); renderDeckEditor();
    }
  } catch(err) {}
});

myLeaderBoard.addEventListener("drop", e => {
  e.preventDefault(); myLeaderBoard.style.backgroundColor = "";
  try {
    const data = JSON.parse(e.dataTransfer.getData("text/plain"));
    if (data.source === 'catalog') {
      const card = getCardTypes()[data.index];
      if (card.type !== "leader") { alert("ここにはリーダーカードしか置けません！"); return; }
      myLeaderCard = card; renderDeckEditor();
    }
  } catch(err) {}
});

catalogBoard.addEventListener("drop", e => {
  e.preventDefault(); catalogBoard.style.backgroundColor = "";
  try {
    const data = JSON.parse(e.dataTransfer.getData("text/plain"));
    if (data.source === 'deck') { 
      let targetName = data.name.replace(/&quot;/g, '"');
      const index = myCustomDeck.findIndex(c => c.name === targetName);
      if (index !== -1) { myCustomDeck.splice(index, 1); renderDeckEditor(); }
    }
  } catch(err) {}
});

function generateCardHtml(card, extraAttrs = "", extraClass = "", badgeCount = 1) {
  let attrColor = "#1976d2"; 
  if (card.attribute === "fire" || card.attribute === "fire_magic") attrColor = "#e74c3c"; 
  else if (card.attribute === "water") attrColor = "#3498db"; 
  else if (card.attribute === "wood") attrColor = "#2ecc71"; 
  else if (card.attribute === "light") attrColor = "#f1c40f"; 
  else if (card.attribute === "dark" || card.attribute === "magic_attr") attrColor = "#9b59b6"; 
  else if (card.attribute === "neutral" || card.attribute === "human") attrColor = "#7f8c8d"; 
  else if (card.attribute === "god" || card.attribute === "spirit" || card.attribute === "fairy_attr") attrColor = "#d4af37"; 
  else if (card.attribute === "sea_god") attrColor = "#005f99"; 
  else if (card.attribute === "electric_magic") attrColor = "#f39c12"; 
  else if (card.attribute === "bice" || card.attribute === "bice_epic") attrColor = "#1abc9c"; 

  const isSetMagic = card.type === "set_magic";
  const isSkill = card.type === "monster" && card.skillType;
  const isItem = card.type === "item";
  const isLeader = card.type === "leader";

  let headerClass = isLeader ? "leader-header" : (isSetMagic ? "set-magic-header" : (isSkill ? "skill-monster-header" : (isItem ? "item-header" : (card.type === "magic" ? "magic-header" : ""))));
  let cardClass = isLeader ? "leader-card" : (isSetMagic ? "set-magic-card" : (isSkill ? "skill-monster-card" : (isItem ? "item-card" : (card.type === "magic" ? "magic-card" : ""))));
  let labelHtml = isLeader ? `<div class="card-label" style="background:#e67e22; color:white; font-size:10px; padding:2px 5px; border-radius:3px;">リーダー</div>` : (isSetMagic ? `<div class="card-label set-magic-label">設置</div>` : (isSkill ? `<div class="card-label skill-label">スキル</div>` : (isItem ? `<div class="card-label item-label">装備</div>` : "")));

  let displayAttack = card.attack + (card.turnAttackBoost || 0);
  if (card.name === "海神 アオクジラ" && card.soul && card.soul.length > 0) {
    let ownerId = null;
    for (let i = 1; i <= 2; i++) {
      if (players[i] && players[i].hand) {
        if (players[i].hand.some(c => c.id === card.id)) ownerId = i;
        Object.values(players[i].stage).forEach(c => {
          if (c && c.id === card.id) ownerId = i;
        });
      }
    }
    if (ownerId && players[ownerId].lostZone.length > 0) {
      displayAttack += card.soul.length;
    }
  }

  let statsHtml = ""; 
  // モンスターとリーダーは左右にバッジを表示
  if (card.type === "monster" || card.type === "leader") {
    statsHtml = `<div style="display:flex; justify-content:space-between; width:100%;"><span class="stat-attack">${displayAttack}</span><span class="stat-hp">${card.hp}</span></div>`;
  }
  // アイテムは左下に効果値（+〇〇）バッジだけ表示（スタイリッシュ！）
  else if (card.type === "item") {
    statsHtml = `<div style="display:flex; justify-content:center; width:100%;"><span class="stat-attack">+${card.effectValue}</span></div>`;
  }
  // 魔法カード（"magic"）は、statsHtml を空のままにする（左上のコストバッジのみ）

  let displayCost = card.cost;
  if (displayCost === undefined && card.originalCost !== undefined) displayCost = card.originalCost;
  
  let costHtml = isLeader ? "" : `<span class="card-cost" style="background-color: ${attrColor};">${displayCost}</span>`;
  
  let imageDisplay = "";
  if (card.image && (card.image.startsWith("http") || card.image.includes("."))) {
    imageDisplay = `<img src="${card.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px; display: block; pointer-events: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;">`;
  } else { imageDisplay = card.image; }

  let badgeHtml = "";
  if (badgeCount > 1) {
    badgeHtml = `<div style="position: absolute; top: -8px; right: -8px; background-color: #e74c3c; color: white; font-size: 14px; font-weight: bold; width: 28px; height: 28px; border-radius: 50%; display: flex; justify-content: center; align-items: center; border: 2px solid #2c3e50; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">×${badgeCount}</div>`;
  }

  let inlineStyle = extraClass.includes("box-shadow") ? extraClass : "";
  let cleanClass = extraClass.includes("box-shadow") ? "" : extraClass;

  let barrierHtml = "";
  if (card.hasBarrier) {
    barrierHtml = `<div style="position: absolute; top: -15px; left: -15px; font-size: 30px; z-index: 20; filter: drop-shadow(0 0 5px #3498db);" title="バリア展開中！">🛡️</div>`;
    inlineStyle += " box-shadow: 0 0 15px 5px #3498db; border: 2px solid #3498db;";
  }
  if (card.infection) {
    barrierHtml += `<div style="position: absolute; top: -15px; right: -15px; font-size: 30px; z-index: 20; filter: drop-shadow(0 0 5px #9b59b6);" title="感染症！">🦠</div>`;
  }
  if (card.burnActive) {
    barrierHtml += `<div style="position: absolute; bottom: -15px; left: -15px; font-size: 30px; z-index: 20; filter: drop-shadow(0 0 5px #e67e22);" title="燃焼中！">🔥</div>`;
    inlineStyle += " box-shadow: 0 0 15px 5px #e67e22; border: 2px solid #e67e22;";
  }
  if (card.isConnected) {
    barrierHtml += `<div style="position: absolute; top: -15px; left: 40%; font-size: 30px; z-index: 20; filter: drop-shadow(0 0 5px #00ffcc);" title="接続状態！">🔗</div>`;
    inlineStyle += " box-shadow: 0 0 15px 5px #00ffcc; border: 2px solid #00ffcc;";
  }

  if (card.soul && card.soul.length > 0) {
    statsHtml += `<div style="position: absolute; top: -10px; right: -10px; left: auto; background: #9b59b6; color: white; font-size: 12px; font-weight: bold; border-radius: 50%; width: 24px; height: 24px; display: flex; justify-content: center; align-items: center; border: 2px solid white; z-index: 10;" title="ソウル${card.soul.length}枚">${card.soul.length}</div>`;
  }

  return `<div class="card ${cardClass} ${cleanClass}" ${extraAttrs} style="position: relative; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; ${inlineStyle}">
            ${badgeHtml}
            ${barrierHtml}
            ${labelHtml}
            <div class="card-header ${headerClass}">
              <span class="card-name">${card.name}</span>
              ${costHtml}
            </div>
            <div class="card-image" style="font-size:40px; padding: 0; overflow: hidden; display: flex; justify-content: center; align-items: center; background-color: #ecf0f1;">
              ${imageDisplay}
            </div>
            <div class="card-stats" style="position: relative;">${statsHtml}</div>
          </div>`;
}

// =========================================================
// ★ 通信と対戦の処理
// =========================================================

socket.on('connect', () => {
  if (myRoomId !== "" && !isSoloMode) { 
    socket.emit("join_room", { roomId: myRoomId, deck: myCustomDeck, leader: myLeaderCard, playerId: myPlayerId }); 
    socket.emit("request_sync", myRoomId); 
  }
});

socket.on('disconnect', () => {
  if (isSoloMode) return;
  infoPanel.innerHTML = `⚠️ 通信が不安定です。自動で再接続しています...`; 
  infoPanel.style.backgroundColor = "rgba(231, 76, 60, 0.8)"; 
});

socket.on('p2_ready', (p2Data) => {
  if (isSoloMode) return;
  opponentDeck = p2Data.deck; opponentLeader = p2Data.leader; 
  if (!isGameStarted) { startGame(); sendGameState(); }
});

socket.on('assign_player', (num) => {
  if (isSoloMode) return;
  myPlayerId = num; infoPanel.style.backgroundColor = "#ecf0f1"; 
  applyBoardLayout(myPlayerId);
  if (isGameStarted) {
     sendGameState(); 
     infoPanel.innerHTML = `🟢 復帰しました！`;
  } else {
     if (myPlayerId === 1) { infoPanel.innerHTML = `🟢 [部屋: ${myRoomId}] 🔵プレイヤー1（先攻）<br>相手を待っています...`; }
     else if (myPlayerId === 2) { infoPanel.innerHTML = `⏳ [部屋: ${myRoomId}] 🔴プレイヤー2（後攻）<br>相手を待っています...`; }
     else { infoPanel.innerHTML = `[部屋: ${myRoomId}] 満員のため、観戦モードです。`; }
  }
  renderAll();
});

socket.on('game_updated', (gameState) => {
  if (isSoloMode) return;
  players = gameState.players; currentTurn = gameState.currentTurn; isGameOver = gameState.isGameOver; 
  isGameStarted = true;
  infoPanel.style.backgroundColor = "#ecf0f1"; 
  if (!isGameOver) {
     if (myPlayerId === currentTurn) { infoPanel.innerHTML = `🟢 あなたのターンです！`; } 
     else { infoPanel.innerHTML = `⏳ 相手のターンです...`; }
  }
  renderAll(); 
});

socket.on('game_retry', () => {
  if (isSoloMode) return;
  infoPanel.style.backgroundColor = "#ecf0f1";
  
  if (typeof hideResultScreen === 'function') hideResultScreen(); // 👈 この1行を追加！！

  if (myPlayerId === 1) { 
    isGameStarted = false; 
    startGame(); sendGameState();
  } else { infoPanel.innerHTML = `⏳ 相手の準備を待っています...`; }
});

function sendGameState() {
  if (isSoloMode) return;
  socket.emit('update_game', { roomId: myRoomId, gameState: { players: players, currentTurn: currentTurn, isGameOver: isGameOver } });
}

// =========================================================
// ★ ゲームロジック
// =========================================================

function getCardTypes() {
  return [
    { category: "pack_1", type: "leader", name: "蒼深の砂時計", originalCost: 0, cost: 0, attack: 0, hp: 20, image: "images/pack_1/sunadokei.jpg", attribute: "sea_god", desc: "【起動】未攻撃時のみ。このカードを攻撃済みにし、お互いのロストから1枚をランダムに手札に加える。自分のカードがドロップに置かれる時、代わりにロストに置く。" },
    { category: "pack_1", type: "monster", name: "海神 アオクジラ", originalCost: 6, cost: 6, attack: 1, hp: 6, image: "images/pack_1/aokujira.jpg", attribute: "sea_god", evolution: true, doubleAttack: true, pierce: true, ward: true, soulGuard: true, desc: "■【登場時】自分の手札1枚を選択してこのカードのソウルに入れる。<br>■自分のロストゾーンにカードがあるなら、このカードの攻撃力をこのカードのソウルの枚数分、+する。" },
    { category: "pack_1", type: "monster", name: "生春 アオハル", originalCost: 3, cost: 3, attack: 1, hp: 1, image: "images/pack_1/aoharu.jpg", attribute: "sea_god", desc: "ロストにカードがあるなら手札のコスト0。センターに出た時、レフトとライトに同名カードを出す。" },
    { category: "pack_1", type: "monster", name: "冬辞 アオトウ", originalCost: 4, cost: 4, attack: 1, hp: 2, image: "images/pack_1/aotou.jpg", attribute: "sea_god", ward: true, desc: "【登場時】相手のステージにいるモンスター1枚を選択し、ロストする。" },
    { category: "pack_1", type: "monster", name: "アオクラゲ", originalCost: 2, cost: 2, attack: 2, hp: 1, image: "images/pack_1/aokurage.jpg", attribute: "sea_god", soulGuard: true, desc: "場に出た時、自分の手札1枚を選択し、このカードのソウルに入れる。ソウルガード。" },
    { category: "pack_1", type: "monster", name: "アオノメ", originalCost: 1, cost: 1, attack: 1, hp: 1, image: "images/pack_1/aonome.jpg", attribute: "sea_god", desc: "自分の場にいる「アオノメ」の数だけ、手札の「アオノメ」のコスト-1。(※デッキ枚数制限なし)" },
    { category: "pack_1", type: "magic", name: "Erotion the future", originalCost: 7, cost: 7, image: "images/pack_1/erotionthefuture.jpg", attribute: "sea_god", desc: "自分の全モンスターをロストし、相手の場のHP6以下のモンスターを全てロストする。" },
    { category: "pack_1", type: "magic", name: "海神の権能", originalCost: 5, cost: 5, image: "images/pack_1/kaishinnnokennnou.jpg", attribute: "sea_god", desc: "相手のステージにいるモンスターからランダムに1枚をロストする。カード3枚を引く。" },
    { category: "pack_1", type: "magic", name: "侵界の跡", originalCost: 1, cost: 1, image: "images/pack_1/shinnkainoato.jpg", attribute: "sea_god", desc: "自分のリーダーにバリア付与。自分のロストが13枚以上なら、相手のHP3以下のモンスター全てロスト。" },
    { category: "pack_1", type: "magic", name: "侵界の雨", originalCost: 10, cost: 10, image: "images/pack_1/shinnkainoame.jpg", attribute: "sea_god", desc: "お互いのステージのモンスターと、手札のカード全てをロストする。" },
    { category: "pack_1", type: "magic", name: "侵界の光", originalCost: 4, cost: 4, image: "images/pack_1/shinnkainohikari.jpg", attribute: "sea_god", desc: "自分の手札1枚をクリックしてロストし、カードを2枚引く。" },
    { category: "pack_1", type: "monster", name: "蒼神", originalCost: 11, cost: 11, attack: 30, hp: 30, image: "images/pack_1/soushinn.jpg", attribute: "sea_god", desc: "お互いのロスト合計が10枚以上なら、手札のこのカードのコストは10になる。" },

    { category: "test", type: "leader", name: "王国の勇者", originalCost: 0, cost: 0, attack: 1, hp: 20, image: "👦", attribute: "human", doubleAttack: true, desc: "【リーダー】王国を守る勇ましい騎士。2回攻撃を持つ。※モンスターに攻撃したとき反撃を受ける。" },
    { category: "test", type: "leader", name: "森の長", originalCost: 0, cost: 0, attack: 0, hp: 15, image: "🧝", attribute: "spirit", desc: "【リーダー】ターン終了時、残りのPP全てを消費し、消費した分リーダーのHPを回復する。" },
    { category: "test", type: "leader", name: "狂気の大魔術師", originalCost: 0, cost: 0, attack: 0, hp: 20, image: "🧙‍♂️", attribute: "magic_attr", desc: "【リーダー】自分の魔法カードが与えるダメージを+1する。" },
    { category: "test", type: "monster", name: "フェアリー", originalCost: 1, cost: 1, attack: 1, hp: 1, image: "images/faily.jpg", attribute: "fairy_attr", desc: "破壊されたとき、ドロップゾーンに置く代わりにデッキの下に置く。" },
    { category: "test", type: "monster", name: "ファイター", originalCost: 2, cost: 2, attack: 2, hp: 2, image: "👦", attribute: "human", arts: 4, desc: "場に出た時、攻撃力とHP+3" },
    { category: "test", type: "monster", name: "ゾンビ", originalCost: 2, cost: 2, attack: 1, hp: 3, image: "🧟", attribute: "magic_attr", desc: "このカードがダメージを与えた時、その対象に【感染症】(ターン終了時1ダメージを受け治癒)を付与する。" },
    { category: "test", type: "monster", name: "ユニコ", originalCost: 3, cost: 3, attack: 2, hp: 3, image: "🦄", attribute: "fairy_attr", desc: "ターン終了時、自分のリーダーとこのカードのHPを1回復する。" },
    { category: "test", type: "monster", name: "ゴリアテ", originalCost: 5, cost: 5, attack: 6, hp: 7, image: "💪", attribute: "neutral", desc: "圧倒的な力を持つ巨人。" },
    { category: "test", type: "monster", name: "エルフ", originalCost: 3, cost: 3, attack: 1, hp: 2, image: "🌿", skillType: "draw", skillValue: 1, desc: "常時：ドロー＋1", attribute: "wood" },
    { category: "test", type: "monster", name: "重装歩兵", originalCost: 4, cost: 4, attack: 2, hp: 4, image: "🛡️", skillType: "guard", skillValue: 1, attribute: "human", desc: "このカードがセンターにいるとき、このカードが受けるダメージを1にする。" },
    { category: "test", type: "monster", name: "老練なる有段者", originalCost: 4, cost: 4, attack: 2, hp: 4, image: "🥋", attribute: "human", desc: "このカードが受けるダメージを2減らす。" },
    { category: "test", type: "monster", name: "ライトブラザーズ", originalCost: 3, cost: 3, attack: 2, hp: 2, image: "👨‍👦", attribute: "human", desc: "■このカードがレフトに登場したとき、自分のライトに同名のカードを出す。<br>■【登場時】自分のリーダーのHPを1回復する。" },
    { category: "test", type: "magic", name: "ファイアボール", originalCost: 2, cost: 2, effectValue: 4, image: "🔥", attribute: "fire_magic", desc: "自場に属性「魔」のカードがあり、自分のセンターにモンスターがいないなら使える。相手リーダーに4ダメ。" },
    { category: "test", type: "magic", name: "ヒール", originalCost: 1, cost: 1, effectValue: 2, image: "🧪", desc: "味方を2回復", attribute: "water" },
    { category: "test", type: "magic", name: "アイススピアー！", originalCost: 2, cost: 2, effectValue: 3, image: "🧊", attribute: "fire_magic", desc: "相手のモンスター1体に3ダメージを与える。" },
    { category: "test", type: "magic", name: "サンダーストーム！", originalCost: 3, cost: 3, effectValue: 2, image: "🌩️", attribute: "electric_magic", desc: "相手のステージのモンスター全てに2ダメージを与える。" },
    { category: "test", type: "set_magic", name: "豊穣の祭壇", originalCost: 3, cost: 3, image: "🌾", desc: "毎ターンPP＋1", attribute: "wood" },
    { category: "test", type: "set_magic", name: "戦神の旗", originalCost: 4, cost: 4, effectValue: 2, image: "🚩", desc: "味方攻撃＋2", attribute: "fire" },
    { category: "test", type: "item", name: "鉄の剣", originalCost: 2, cost: 2, effectValue: 2, image: "🗡️", desc: "プレイヤー攻撃＋2", attribute: "neutral" },
    { category: "test", type: "item", name: "魔法の杖", originalCost: 3, cost: 3, effectValue: 1, image: "🪄", attribute: "magic_attr", desc: "【起動】PPを4消費して相手に4ダメージを与える。" },
    
    { category: "pack_2", type: "leader", name: "\"Absolutely Main Gamer\" ONE", originalCost: 0, cost: 0, attack: 1, hp: 16, image: "images/pack_2/ONE.jpg", attribute: "bice_epic", desc: "■自分の場にカードが登場したとき、そのカードのソウルを+1する。<br>■【起動】PPを1消費して、このターン中攻撃力+1。" },
    { category: "pack_2", type: "monster", name: "\"Born from competition\" GR", originalCost: 1, cost: 1, attack: 1, hp: 2, image: "images/pack_2/GXPA.jpg", attribute: "bice_epic", soulGuard: true, desc: "■自分の場の「BICE」モンスターが破壊された時、自身とリーダーのHPを1回復。<br>■このカードは相手に攻撃されない。" },
    { category: "pack_2", type: "monster", name: "\"Get Ready Going To\" LFA", originalCost: 8, cost: 8, attack: 8, hp: 4, image: "images/pack_2/GRGT.jpg", attribute: "bice_epic", soulGuard: true, pierce: true, accel: 6, burn: true, desc: "■【アクセラ6】自分の「GR」の上に重ねて場に出る。<br>■【燃焼】このターン中、このカードは【超貫通】を持つ。" },
    { category: "pack_2", type: "monster", name: "\"Re Born in 2600\" BNR34", originalCost: 2, cost: 2, attack: 1, hp: 2, image: "images/pack_2/GTR.jpg", attribute: "bice", soulGuard: true, arts: 3, burn: true, desc: "■【燃焼】このターン中、リーダーへ与えるダメージ+2。<br>■【アーツ3】場に出た時、攻撃力とHP+2。" },
    { category: "pack_2", type: "monster", name: "\"To Just Zero\" A8000", originalCost: 3, cost: 3, attack: 3, hp: 3, image: "images/pack_2/supra.jpg", attribute: "bice", soulGuard: true, burn: true, desc: "■【燃焼】このターン中、モンスターに与えるダメージ+2。" },
    { category: "pack_2", type: "monster", name: "\"Comact OPElator of No.1\" LA4000", originalCost: 1, cost: 1, attack: 1, hp: 1, image: "images/pack_2/copen.jpg", attribute: "bice", burn: true, desc: "■【燃焼】自分のモンスター1枚を選択し、ソウルを+1する。" },
    { category: "pack_2", type: "monster", name: "\"Greater Than 2nd\" 911GT2RS", originalCost: 5, cost: 5, attack: 2, hp: 2, image: "images/pack_2/911.jpg", attribute: "bice", soulGuard: true, burn: true, desc: "■【登場時】カード2枚を引く。<br>■【燃焼】相手のレフトとライトのモンスター全てにダメージ4！" },
    { category: "pack_2", type: "monster", name: "\"Ultimate Buddy\" ヴァルキリー", originalCost: 4, cost: 4, attack: 1, hp: 3, image: "images/pack_2/valkily.jpg", attribute: "bice", soulGuard: true, burn: true, desc: "■【登場時】デッキからコスト3以下の「BICE」モンスター最大2枚を場に出す。<br>■【燃焼】自分のセンターのモンスターにバリアを付与する。" },
    { category: "pack_2", type: "magic", name: "RBA", originalCost: 1, cost: 1, image: "images/pack_2/RBA.jpg", attribute: "bice", desc: "自分のリーダーにバリア付与。自場に「GR」がいるなら、ドロップからランダムなモンスターを1枚手札に加える。" },
    { category: "pack_2", type: "magic", name: "Absolute enforcer", originalCost: 4, cost: 4, image: "images/pack_2/enforcer.jpg", attribute: "bice", desc: "相手の場のモンスター全てにダメージ1。カード2枚を引く。" },
    { category: "pack_2", type: "magic", name: "Exaust re boost", originalCost: 1, cost: 1, image: "images/pack_2/boost.jpg", attribute: "bice", desc: "このターン中、自分の場の属性「BICE」のモンスター全ての攻撃力+1。" },
    { category: "pack_2", type: "magic", name: "Absolute punisher！", originalCost: 11, cost: 11, image: "images/pack_2/punisher.jpg", attribute: "bice", desc: "■手札にある間、このターン破壊された枚数分コスト減少。<br>■リーダーが「ONE」でお互いセンターが空なら使える。相手リーダーに11ダメージ！" }, // 👈 最後にカンマ(,)を追加！！！

    { category: "pack_3", type: "leader", name: "≪Conecting other world≫ ヴァイス&シュヴァルツ", originalCost: 0, cost: 0, attack: 0, hp: 20, image: "images/pack_3/shirokuro.jpg", attribute: "reliance", connectSkill: true, desc: "■【コネクト】自分のステージのモンスター1枚を選択し、このカードと「接続」状態にする。<br>■自分の場のモンスターが「接続」状態になったとき、そのモンスターのHPを+2する。" },
    { category: "pack_3", type: "monster", name: "≪Overconfidence≫ スターレット", originalCost: 3, cost: 3, attack: 2, hp: 1, image: "images/pack_3/sutarlet.jpg", attribute: "reliance", connectSkill: true, desc: "■このカードは相手のカードの効果で選択されない。<br>■【登場時】自分のデッキからコスト2以下の属性「リライアンス」を持つモンスター1枚を自分のステージに出し、自分のステージのモンスター全てのHPを+1する。<br>■【起動】ステージのモンスター1枚を選択し、自身と「接続」する。" },
    { category: "pack_3", type: "monster", name: "≪Trust myself≫ ラパン", originalCost: 2, cost: 2, attack: 1, hp: 1, image: "images/pack_3/rapane.jpg", attribute: "reliance", desc: "■【登場時】このカードと同名のカード1枚を自分のレフトに出し、このカードと「接続」する。" },
    { category: "pack_3", type: "monster", name: "≪相死相愛≫ α&β", originalCost: 4, cost: 4, attack: 2, hp: 2, image: "images/pack_3/aruvel.jpg", attribute: "reliance", drain: true, connectSkill: true, desc: "■【登場時】自分のデッキから属性「リライアンス」を持つコスト3以下のモンスター2種類を1枚ずつ自分のステージに出す。<br>■【起動】ステージのモンスター1枚を選択し、自身と「接続」する。<br>【ドレイン】" },
    { category: "pack_3", type: "monster", name: "≪耽溺≫ セロ&ローブ", originalCost: 3, cost: 3, attack: 1, hp: 1, image: "images/pack_3/copen.jpg", attribute: "reliance", burn: true, desc: "■【燃焼】自分の場のモンスター全ての攻撃力を+1する。" },
    { category: "pack_3", type: "monster", name: "≪従属≫ オデッセイ", originalCost: 2, cost: 2, attack: 1, hp: 1, image: "images/pack_3/odyssey.jpg", attribute: "reliance", desc: "■【登場時】このカードと同名のカード2枚を自分のステージに出す。" },
    { category: "pack_3", type: "monster", name: "“絶対依存の情” マッハ", originalCost: 8, cost: 8, attack: 1, hp: 4, image: "images/pack_3/mahha.jpg", attribute: "reliance", transform: true, desc: "■自分のリーダーが「接続」状態なら、手札のこのカードのコストを-2する。<br>■【登場時】相手のモンスター1枚を選択し、相手のリーダーと「接続」状態にする。<br>■自分のターン終了時、自身の目の前のポジションにあるモンスターにダメージ11。<br>【変身】" },
    { category: "pack_3", type: "magic", name: "あなたをおしえて", originalCost: 1, cost: 1, image: "images/pack_3/teach.jpg", attribute: "reliance", desc: "■ステージからモンスターを2枚選択する。選択したカード同士を「接続」する。" },
    { category: "pack_3", type: "magic", name: "その身に過する保護り", originalCost: 1, cost: 1, image: "images/pack_3/hokori.jpg", attribute: "reliance", desc: "■自分のリーダーにバリアを付与し、自分の場の全モンスターのHPを+1する。" },
    { category: "pack_3", type: "magic", name: "狂依存", originalCost: 3, cost: 3, image: "images/pack_3/kyouizonn.jpg", attribute: "reliance", desc: "■自分のドロップゾーンからランダムなモンスターを1枚、センターに出す。" },
    { category: "pack_3", type: "magic", name: "信用", originalCost: 5, cost: 5, image: "images/pack_3/shinnyou.jpg", attribute: "reliance", desc: "■ステージのモンスター2枚を選択する。最初に選んだモンスターを破壊し、次に選んだモンスターのHPを最初に選んだモンスターのHP分+する。カードを3枚引く。" },
    { category: "pack_3", type: "magic", name: "Trust my future", originalCost: 4, cost: 4, image: "images/pack_3/future.jpg", attribute: "reliance", desc: "■自分の場のモンスター全ての攻撃力を+2する。" },
    { category: "pack_3", type: "item", name: "拠りどこ露", originalCost: 3, cost: 3, effectValue: 0, image: "images/pack_3/ro.jpg", attribute: "reliance", desc: "■自分の場のモンスターが破壊されたとき、ランダムな自分の場のモンスター1枚のHPを+1する。" },
  ]
}

function startGame() {
  isGameOver = false; 
  currentTurn = Math.random() < 0.5 ? 1 : 2; 
  isGameStarted = true;
  isSelectingHand = false; selectionCallback = null; 
  isSelectingStage = false; selectionStageCallback = null;
  pendingSelection = null; 
  
  [1, 2].forEach(pId => { 
    players[pId] = { hp: 15, maxHp: 15, mp: 1, maxMp: 1, deck: [], hand: [], stage: {left: null, center: null, right: null}, leader: null, weapon: null, leaderAttackCount: 0, trash: [], lostZone: [], destroyedThisTurn: 0 }; 
  });

  players[1].leader = JSON.parse(JSON.stringify(myLeaderCard));
  players[1].leader.id = "leader-1"; // 👈 リーダー1に専用IDを付与！
  players[1].leader.hasBarrier = false; players[1].leader.soul = []; players[1].leader.infection = false; players[1].leader.burnActive = false; players[1].leader.turnAttackBoost = 0;
  players[1].hp = players[1].leader.hp; players[1].maxHp = players[1].leader.hp; 

  if(opponentLeader) {
    players[2].leader = JSON.parse(JSON.stringify(opponentLeader));
    players[2].leader.id = "leader-2"; // 👈 リーダー2に専用IDを付与！
    players[2].leader.hasBarrier = false; players[2].leader.soul = []; players[2].leader.infection = false; players[2].leader.burnActive = false; players[2].leader.turnAttackBoost = 0;
    players[2].hp = players[2].leader.hp; players[2].maxHp = players[2].leader.hp;
  }

  let p1DeckSource = JSON.parse(JSON.stringify(myCustomDeck));
  p1DeckSource.forEach((card, i) => { 
    if (card.originalCost === undefined) card.originalCost = card.cost;
    card.id = `1-${i+1}`; card.attackCount = 0; card.hasBarrier = false; card.soul = []; card.infection = false; card.burnActive = false; card.turnAttackBoost = 0;
    players[1].deck.push(card); 
  });

  let p2DeckSource = JSON.parse(JSON.stringify(opponentDeck));
  p2DeckSource.forEach((card, i) => { 
    if (card.originalCost === undefined) card.originalCost = card.cost;
    card.id = `2-${i+1}`; card.attackCount = 0; card.hasBarrier = false; card.soul = []; card.infection = false; card.burnActive = false; card.turnAttackBoost = 0;
    players[2].deck.push(card); 
  });

  players[1].deck.sort(() => Math.random() - 0.5); players[2].deck.sort(() => Math.random() - 0.5);
  
  drawCard(1); drawCard(1); drawCard(1); 
  drawCard(2); drawCard(2); drawCard(2);
  drawCard(currentTurn); 
  
  renderAll();
  
  if (isSoloMode && currentTurn === 2) {
    setTimeout(playAITurn, 1500);
  }
}

function drawCard(pId) { if (players[pId].deck.length > 0) { players[pId].hand.push(players[pId].deck.pop()); } }

function sendToTrashOrLost(playerId, cardsArray) {
  let p = players[playerId];
  let isSandglass = p.leader && p.leader.name === "蒼深の砂時計";
  let dest = isSandglass ? p.lostZone : p.trash;
  cardsArray.forEach(c => dest.push(resetCardState(c)));
}

function destroyCard(playerId, zone, isLost = false) {
  let p = players[playerId];
  let targetCard = p.stage[zone];
  if (!targetCard) return { destroyed: true };

  // ▼ 追加: 接続先を道連れにするために相手のIDを記憶しておく ▼
  let linkedId = targetCard.isConnected;

  // 破壊されたカード自身を渡して、そのペアだけ接続を切る！
  if (targetCard.isConnected) breakConnection(targetCard);

  players[1].destroyedThisTurn++; players[2].destroyedThisTurn++;

// 👇 pack_3 破壊時効果 👇
  if (targetCard.type === "monster") {
      if (p.weapon && p.weapon.name === "拠りどこ露") {
          let ownMonsters = ['left', 'center', 'right'].filter(z => p.stage[z] !== null && p.stage[z] !== targetCard);
          if (ownMonsters.length > 0) {
              let randZone = ownMonsters[Math.floor(Math.random() * ownMonsters.length)];
              p.stage[randZone].hp += 1;
              triggerConnection(p.stage[randZone], 'heal', 1);
              showFloatingTextOnElement(`p${playerId}-stage-${randZone}`, 1, 'heal');
          }
      }
  }
  
  if (targetCard.attribute && targetCard.attribute.includes("bice")) {
      let hasGR = Object.values(p.stage).some(c => c && c.name === "\"Born from competition\" GR");
      if (hasGR) {
          p.hp += 1; if (p.hp > p.maxHp) p.hp = p.maxHp;
          triggerConnection(p.leader, 'heal', 1); 
          showFloatingTextOnElement(`p${playerId}-leader-zone`, 1, 'heal');
          Object.values(p.stage).forEach(c => {
             if (c && c.name === "\"Born from competition\" GR") {
                 c.hp += 1;
                 triggerConnection(c, 'heal', 1);
                 let zName = p.stage.left === c ? 'left' : p.stage.center === c ? 'center' : 'right';
                 const el = document.getElementById(`p${playerId}-stage-` + zName);
                 if(el){ el.classList.add("heal-anim"); setTimeout(() => el.classList.remove("heal-anim"), 300); }
                 showFloatingTextOnElement(`p${playerId}-stage-${zName}`, 1, 'heal'); // 👈 文字表示も追加
             }
          });
      }
  }

  if (targetCard.soulGuard && targetCard.soul && targetCard.soul.length > 0) {
    let sacrificedSoul = targetCard.soul.pop(); 
    sendToTrashOrLost(playerId, [sacrificedSoul]); 
    targetCard.hp = 1; 
    return { destroyed: true }; 
  }

  let isSandglass = p.leader && p.leader.name === "蒼深の砂時計";
  let actualLost = isLost || isSandglass; 

  let soulsToDrop = targetCard.soul ? [...targetCard.soul] : [];

  if (!isLost && targetCard.name === "フェアリー") {
    p.deck.unshift(resetCardState(targetCard)); 
    if (soulsToDrop.length > 0) { sendToTrashOrLost(playerId, soulsToDrop); }
    p.stage[zone] = null;
  } else {
    let destArray = actualLost ? p.lostZone : p.trash;
    destArray.push(resetCardState(targetCard));
    soulsToDrop.forEach(s => destArray.push(resetCardState(s)));
    p.stage[zone] = null;
  }
  
  return { destroyed: true };
}

window.useLeaderSkill = function() {
  let p = players[myPlayerId];
  if (isSelectingHand || isSelectingStage) return; 

  let maxAttacks = (p.leader.doubleAttack || (p.weapon && p.weapon.doubleAttack)) ? 2 : 1;

  if (p.leader.name === "蒼深の砂時計") {
      if (p.leaderAttackCount !== 0) return; 
      p.leaderAttackCount = maxAttacks; 
      let oppId = myPlayerId === 1 ? 2 : 1;
      let oppP = players[oppId];
      let combinedLost = [...p.lostZone, ...oppP.lostZone];
      if (combinedLost.length > 0) {
        let randIndex = Math.floor(Math.random() * combinedLost.length);
        let recoveredCard = combinedLost[randIndex];
        let myLostIndex = p.lostZone.findIndex(c => c.id === recoveredCard.id);
        if (myLostIndex !== -1) p.lostZone.splice(myLostIndex, 1);
        else {
          let oppLostIndex = oppP.lostZone.findIndex(c => c.id === recoveredCard.id);
          if (oppLostIndex !== -1) oppP.lostZone.splice(oppLostIndex, 1);
        }
        p.hand.push(resetCardState(recoveredCard));
      }
  } else if (p.leader.name === "狂気の大魔術師") {
      if (p.mp < 4 || p.leaderAttackCount >= maxAttacks) return;
      p.leaderAttackCount++;
      p.mp -= 4;
      let oppId = myPlayerId === 1 ? 2 : 1;
      let oppP = players[oppId];
      if (oppP.leader.hasBarrier) {
          oppP.leader.hasBarrier = false;
      } else {
          oppP.hp -= 4;
          const targetEl = document.getElementById(`p${oppId}-leader-zone`);
          if(targetEl){ targetEl.classList.add("damage-anim"); setTimeout(() => targetEl.classList.remove("damage-anim"), 300); }
      }
  } else if (p.leader.name === "\"Absolutely Main Gamer\" ONE") {
      if (p.mp < 1) return;
      p.mp -= 1;
      p.leader.turnAttackBoost = (p.leader.turnAttackBoost || 0) + 1;
      triggerConnection(p.leader, 'attack_boost', 1); 
      showFloatingTextOnElement(`p${myPlayerId}-leader-zone`, 1, 'attack_boost'); // 👈 'heal' から変更
  }
  
  if (!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: p.leader }); 
  renderAll(); sendGameState();
}

window.useWeaponSkill = function() {
  let p = players[myPlayerId];
  if (isSelectingHand || isSelectingStage) return; 
  let maxAttacks = (p.leader.doubleAttack || (p.weapon && p.weapon.doubleAttack)) ? 2 : 1;
  if (p.weapon && p.weapon.name === "魔法の杖") {
      if (p.mp < 4 || p.leaderAttackCount >= maxAttacks) return;
      p.leaderAttackCount++;
      p.mp -= 4;
      let oppId = myPlayerId === 1 ? 2 : 1;
      let oppP = players[oppId];
      if (oppP.leader.hasBarrier) {
          oppP.leader.hasBarrier = false;
      } else {
          oppP.hp -= 4;
          const targetEl = document.getElementById(`p${oppId}-leader-zone`);
          if(targetEl){ targetEl.classList.add("damage-anim"); setTimeout(() => targetEl.classList.remove("damage-anim"), 300); }
      }
      if (!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: p.weapon }); 
      renderAll(); sendGameState();
  }
}

window.useBurnSkill = function(zone) {
  let p = players[myPlayerId];
  if (isSelectingHand || isSelectingStage) return;
  let card = p.stage[zone];
  if (!card || !card.burn || card.burnActive) return;
  
  card.burnActive = true; 

  if (card.name === "\"Comact OPElator of No.1\" LA4000") {
      isSelectingStage = true;
      selectionStageCallback = function(targetPid, targetZone) {
        if (targetPid !== myPlayerId || targetZone === 'leader') return; 
        let targetCard = p.stage[targetZone];
        if (!targetCard) return; 
        
        targetCard.soul.push({name: "オーラ", type: "soul"});
        destroyCard(myPlayerId, zone, false);
        isSelectingStage = false; selectionStageCallback = null; pendingSelection = null;
        infoPanel.style.backgroundColor = "#ecf0f1"; 
        if (!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: card }); 
        renderAll(); sendGameState(); 
      };
      infoPanel.innerHTML = `🎯 ソウルを増やす自分のモンスターをクリック！`;
      infoPanel.style.backgroundColor = "rgba(241, 196, 15, 0.8)"; 
      renderAll();
      return;
  } else if (card.name === "\"Greater Than 2nd\" 911GT2RS") {
      let oppId = myPlayerId === 1 ? 2 : 1;
      ['left', 'right'].forEach(z => {
          let tCard = players[oppId].stage[z];
          if (tCard) {
              let dmg = 4;
              if (tCard.name === "老練なる有段者") { dmg -= 2; if(dmg<0)dmg=0; }
              if (dmg > 0) {
                  if (tCard.hasBarrier) tCard.hasBarrier = false;
                  else { tCard.hp -= dmg; if(tCard.hp<=0) destroyCard(oppId, z, false); }
              }
          }
      });
      destroyCard(myPlayerId, zone, false);
  } else if (card.name === "\"Ultimate Buddy\" ヴァルキリー") {
      if (p.stage['center']) p.stage['center'].hasBarrier = true;
      destroyCard(myPlayerId, zone, false);
  } else if (card.name === "≪耽溺≫ セロ&ローブ") {
      ['left', 'center', 'right'].forEach(z => {
          let targetCard = p.stage[z];
          if (targetCard) {
              targetCard.turnAttackBoost = (targetCard.turnAttackBoost || 0) + 1;
              triggerConnection(targetCard, 'attack_boost', 1);
              showFloatingTextOnElement(`p${myPlayerId}-stage-${z}`, 1, 'attack_boost'); // 👈 'heal' から変更
          }
      });
      destroyCard(myPlayerId, zone, false);
  } else {
      destroyCard(myPlayerId, zone, false); 
  }

  if (!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: card }); 
  renderAll(); sendGameState();
}

window.confirmSelection = function() {
    if (isSelectingStage && pendingSelection && pendingSelection.type === 'stage') {
        let pid = pendingSelection.pid;
        let zone = pendingSelection.zone;
        if (selectionStageCallback) selectionStageCallback(pid, zone);
    } else if (isSelectingHand && pendingSelection && pendingSelection.type === 'hand') {
        let index = pendingSelection.index;
        if (selectionCallback) selectionCallback(index);
    }
}

function renderAll() {
  if (!isGameOver) { 
    if (isGameStarted) surrenderBtn.style.display = "inline-block"; 
    if (myPlayerId === currentTurn && !isSelectingHand && !isSelectingStage && !(isSoloMode && currentTurn === 2)) { endTurnBtn.style.display = "inline-block"; } 
    else { endTurnBtn.style.display = "none"; } 
  } else { 
    endTurnBtn.style.display = "none";
    surrenderBtn.style.display = "none"; 
  }
  
  let oppId = myPlayerId === 1 ? 2 : 1;
  let totalLost = players[1].lostZone.length + players[2].lostZone.length;
  
  [1, 2].forEach(pId => {
    let aonomeCount = 0;
    ['left', 'center', 'right'].forEach(z => {
       if (players[pId].stage[z] && players[pId].stage[z].name === "アオノメ") aonomeCount++;
    });
    
    players[pId].hand.forEach(card => {
      if (card.originalCost === undefined) card.originalCost = card.cost;
      card.cost = card.originalCost; 
      
      if (card.name === "蒼神" && totalLost >= 10) card.cost = 10;
      if (card.name === "生春 アオハル" && totalLost >= 1) card.cost = 0;
      if (card.name === "アオノメ") {
        card.cost -= aonomeCount;
        if (card.cost < 0) card.cost = 0;
      }
      
      if (card.name === "Absolute punisher！") {
        card.cost -= players[pId].destroyedThisTurn;
        if (card.cost < 0) card.cost = 0;
      }

      if (card.name === "“絶対依存の情” マッハ" && players[pId].leader && players[pId].leader.isConnected) {
        card.cost -= 2;
        if (card.cost < 0) card.cost = 0;
      }
      
      if (card.arts !== undefined && players[pId].mp >= card.arts) {
          card.cost = card.arts;
      }
      if (card.accel !== undefined && players[pId].mp < card.originalCost) {
          card.cost = card.accel;
      }
    });
  });

  [1, 2].forEach(pId => {
    const p = players[pId]; const isMyTurn = currentTurn === pId; const isMe = myPlayerId === pId;

    document.getElementById(`p${pId}-hp-text`).innerText = `${p.hp} / ${p.maxHp}`;
    document.getElementById(`p${pId}-mp-text`).innerText = `${p.mp} / ${p.maxMp}`;
    document.getElementById(`p${pId}-deck-text`).innerText = p.deck.length;
    document.getElementById(`p${pId}-trash-text`).innerText = p.trash.length;
    document.getElementById(`p${pId}-lost-text`).innerText = p.lostZone.length;

    let handHtml = ""; const isStageFull = p.stage.left && p.stage.center && p.stage.right;
    p.hand.forEach(card => {
      const canAfford = p.mp >= card.cost && !isSelectingHand && !isSelectingStage;
      const canEvolve = card.evolution && (p.stage.left || p.stage.center || p.stage.right); 
      
      let accelTriggered = (card.accel !== undefined && card.cost === card.accel);
      let canPlayLFA_Accel = (card.name === "\"Get Ready Going To\" LFA" && accelTriggered && ['left', 'center', 'right'].some(z => p.stage[z] && p.stage[z].name === "\"Born from competition\" GR"));

      let canPlay = isMyTurn && isMe && canAfford && (canEvolve || canPlayLFA_Accel || card.transform || (!(card.type === "monster" || card.type === "set_magic") || !isStageFull)) && !isGameOver;

      if (card.name === "\"Get Ready Going To\" LFA" && accelTriggered && canPlay) {
          if (!canPlayLFA_Accel) canPlay = false;
      }

      if (card.name === "ファイアボール" && canPlay) {
          let hasMagicAttr = false;
          if (p.leader && (p.leader.attribute === "magic_attr" || p.leader.attribute === "fire_magic")) hasMagicAttr = true;
          if (p.weapon && (p.weapon.attribute === "magic_attr" || p.weapon.attribute === "fire_magic")) hasMagicAttr = true;
          ['left', 'center', 'right'].forEach(z => {
              if (p.stage[z] && (p.stage[z].attribute === "magic_attr" || p.stage[z].attribute === "fire_magic")) hasMagicAttr = true;
          });
          let isCenterEmpty = p.stage.center === null;
          if (!hasMagicAttr || !isCenterEmpty) canPlay = false;
      }
      
      if (card.name === "アイススピアー！" && canPlay) {
          let hasTarget = ['left', 'center', 'right'].some(z => players[oppId].stage[z] !== null);
          if (!hasTarget) canPlay = false;
      }
      
      if (card.name === "Absolute punisher！" && canPlay) {
          let isOne = p.leader && p.leader.name === "\"Absolutely Main Gamer\" ONE";
          let bothCenterEmpty = p.stage.center === null && players[oppId].stage.center === null;
          if (!isOne || !bothCenterEmpty) canPlay = false;
      }

      if (card.name === "狂依存" && canPlay) {
          let hasMonsterInTrash = p.trash.some(c => c.type === 'monster');
          let isCenterEmpty = p.stage.center === null;
          if (!hasMonsterInTrash || !isCenterEmpty) canPlay = false; // ゴミ箱にモンスターがいない、またはセンターが埋まってるなら不可
      }
      if ((card.name === "あなたをおしえて" || card.name === "信用") && canPlay) {
          let totalMonsters = 0;
          ['left', 'center', 'right'].forEach(z => { if(p.stage[z]) totalMonsters++; if(players[oppId].stage[z]) totalMonsters++; });
          if (totalMonsters < 2) canPlay = false; // 場にモンスターが2体以上いないと不可
      }

      const disabledClass = canPlay ? "" : "disabled"; 
      const draggableAttr = canPlay ? 'draggable="true"' : 'draggable="false"';

      let extraHandClass = "";
      if (isSelectingHand && isMe) {
         if (pendingSelection && pendingSelection.type === 'hand' && pendingSelection.index === p.hand.indexOf(card)) {
             extraHandClass = "box-shadow: 0 0 20px 10px #e74c3c; cursor: pointer; transform: translateY(-10px);";
         } else {
             extraHandClass = "box-shadow: 0 0 15px 5px #f1c40f; cursor: pointer;";
         }
      } else {
         extraHandClass = disabledClass;
      }

      if (!isMe && !(isSoloMode && pId === 2)) { 
        handHtml += `<div class="card" style="background-color: #34495e; border: 2px solid #2c3e50; justify-content: center; align-items: center; color: white;"><div style="font-size: 30px;">🎴</div></div>`;
      } else if (isSoloMode && pId === 2 && !isMe) {
        handHtml += `<div class="card" style="background-color: #34495e; border: 2px solid #2c3e50; justify-content: center; align-items: center; color: white;"><div style="font-size: 30px;">🐉</div></div>`;
      } else { 
        handHtml += generateCardHtml(card, `data-id="${card.id}" data-pid="${pId}" ${draggableAttr}`, extraHandClass); 
      }
    });
    // ★ 箱が存在する時だけ表示するように if文 を追加！
    if (document.getElementById(`p${pId}-hand`)) {
      document.getElementById(`p${pId}-hand`).innerHTML = handHtml;
    }

    let leaderCard = p.leader;
    if (leaderCard) {
      let baseAttack = leaderCard.attack + (p.weapon ? p.weapon.effectValue : 0);
      let displayLeader = { ...leaderCard, attack: baseAttack, hp: p.hp, hasBarrier: leaderCard.hasBarrier, soul: leaderCard.soul, infection: leaderCard.infection, burnActive: leaderCard.burnActive, turnAttackBoost: leaderCard.turnAttackBoost }; 
      
      let realAtk = baseAttack + (leaderCard.turnAttackBoost || 0);
      const maxLeaderAttacks = (leaderCard.doubleAttack || (p.weapon && p.weapon.doubleAttack)) ? 2 : 1;
      const leaderActionDone = p.leaderAttackCount >= maxLeaderAttacks ? "action-done" : "";
      const canLeaderAttack = isMyTurn && isMe && realAtk > 0 && p.leaderAttackCount < maxLeaderAttacks && !isGameOver && !isSelectingHand && !isSelectingStage;
      
      const leaderDraggable = canLeaderAttack ? 'draggable="true"' : 'draggable="false"';
      const leaderBox = document.getElementById(`p${pId}-leader-zone`);

      let extraStyle = "margin:0;";
      leaderBox.innerHTML = `<div class="zone-label" style="top:-25px;">` + generateCardHtml(displayLeader, `data-pid="${pId}" data-zone="leader" ${leaderDraggable} style="${extraStyle}"`, leaderActionDone);
    }

    // ★ アイテム枠の描画処理
    const itemBox = document.getElementById(`p${pId}-item-zone`);
    if (itemBox) {
      let itemCard = p.weapon;
      if (!itemCard) {
        itemBox.innerHTML = `<div class="zone-label" style="top:-25px;"><div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; border: 3px dashed rgba(255,255,255,0.3); border-radius: 8px; color: rgba(255,255,255,0.4); font-size: 24px; font-weight: bold; margin:0;">ITEM</div>`;
      } else {
        itemBox.innerHTML = `<div class="zone-label" style="top:-25px;">` + generateCardHtml(itemCard, `data-pid="${pId}" data-zone="item" draggable="false"`, "");
      }
    }

    ['left', 'center', 'right'].forEach(zone => {
      const zoneEl = document.getElementById(`p${pId}-stage-${zone}`); const card = p.stage[zone];
      if(!card){ 
          zoneEl.innerHTML = `<div style="width: 100%; height: 100%; min-height: 120px; display: flex; justify-content: center; align-items: center; border: 3px dashed rgba(255,255,255,0.3); border-radius: 8px; color: rgba(255,255,255,0.4); font-size: 28px; font-weight: bold; margin:0;">${zone.toUpperCase()}</div>`;
      } else {
        const maxAttacks = card.doubleAttack ? 2 : 1;
        let actionDoneClass = (card.type === "monster" && (card.attackCount || 0) >= maxAttacks) ? "action-done" : "";
        const canMonsterAttack = isMyTurn && isMe && card.type === "monster" && (card.attackCount || 0) < maxAttacks && !isGameOver && !isSelectingHand && !isSelectingStage;
        const stageDraggable = canMonsterAttack ? 'draggable="true"' : 'draggable="false"';
        
        let extraStageClass = actionDoneClass;
        if (isSelectingStage) {
            if (pendingSelection && pendingSelection.type === 'stage' && pendingSelection.pid === pId && pendingSelection.zone === zone) {
                extraStageClass += " box-shadow: 0 0 20px 10px #e74c3c; cursor: pointer; transform: scale(1.05);";
            } else {
                extraStageClass += " box-shadow: 0 0 15px 5px #f1c40f; cursor: pointer;";
            }
        }
        
        zoneEl.innerHTML = `<div class="zone-label" style="top:-25px;">${zone.toUpperCase()}</div>` + generateCardHtml(card, `data-pid="${pId}" data-zone="${zone}" ${stageDraggable}`, extraStageClass);
      }
    });
  });

  attachHandListeners(); attachStageListeners(); checkGameOver(); 
}

function attachHandListeners() {
  document.querySelectorAll(".hand-board .card").forEach(el => {
    el.addEventListener("dragstart", (e) => { 
      if(isSelectingHand || isSelectingStage) { e.preventDefault(); return; } 
      if(el.dataset.id) { e.dataTransfer.setData("text/plain", JSON.stringify({ type: 'hand', id: el.dataset.id })); el.classList.add("dragging"); } 
    });
    el.addEventListener("dragend", () => el.classList.remove("dragging"));
    el.addEventListener("click", () => {
      if(!el.dataset.pid) return; const pid = Number(el.dataset.pid); if(pid !== myPlayerId) return; 
      if (isSelectingStage) return;

      const cardId = el.dataset.id;
      if (isSelectingHand) {
        const cardIndex = players[pid].hand.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) { 
            pendingSelection = { type: 'hand', index: cardIndex };
            let card = players[pid].hand[cardIndex];
            infoPanel.innerHTML = `🎯 「${card.name}」を選択中... <button onclick="confirmSelection()" style="padding:5px 20px; background:#e74c3c; color:white; border:none; border-radius:5px; font-weight:bold; font-size:16px; cursor:pointer; margin-left:10px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">確定</button>`;
            renderAll();
        }
        return;
      }

      const card = players[pid].hand.find(c => c.id === cardId);
      if(card) infoPanel.innerHTML = getCardInfoText(card);
    });
  });
  if (isSelectingHand && pendingSelection && pendingSelection.type === 'hand') {
    let handCards = document.querySelectorAll(`#p${myPlayerId}-hand .card`);
    let selectedEl = handCards[pendingSelection.index];
    if (selectedEl) {
      let overlay = document.createElement("div");
      overlay.className = "card-action-overlay";
      overlay.innerHTML = `<button class="card-center-btn" style="background:#e74c3c; color:white;" onclick="event.stopPropagation(); confirmSelection();">🎯 確定</button>`;
      selectedEl.appendChild(overlay);
    }
  }
}

function attachStageListeners() {
  document.querySelectorAll(".stage-zone .card").forEach(el => {
    el.addEventListener("dragstart", (e) => {
      if (isSelectingHand || isSelectingStage) { e.preventDefault(); return; } 
      const pid = Number(el.dataset.pid); const zone = el.dataset.zone;
      e.dataTransfer.setData("text/plain", JSON.stringify({ type: 'attack', pid: pid, zone: zone }));
      el.classList.add("dragging"); document.body.classList.add("attack-dragging"); 
    });
    el.addEventListener("dragend", () => { el.classList.remove("dragging"); document.body.classList.remove("attack-dragging"); });
    el.addEventListener("click", () => {
      const pid = Number(el.dataset.pid); const zone = el.dataset.zone; const p = players[pid];
      
      if (isSelectingStage) {
        pendingSelection = { type: 'stage', pid: pid, zone: zone };
        
        // 👇👇 ここを修正！リーダーやアイテムが選ばれた時にも正しく読み取るようにする
        let card = zone === 'leader' ? p.leader : (zone === 'item' ? p.weapon : p.stage[zone]);
        if (!card) return; // 空っぽの場所をクリックした場合は無視する
        
        infoPanel.innerHTML = `🎯 「${card.name}」を選択中... <button onclick="confirmSelection()" style="padding:5px 20px; background:#e74c3c; color:white; border:none; border-radius:5px; font-weight:bold; font-size:16px; cursor:pointer; margin-left:10px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">確定</button>`;
        renderAll();
        return;
      }

      let card = zone === 'leader' ? p.leader : (zone === 'item' ? p.weapon : p.stage[zone]);
      if (!card) return;
      let text = getCardInfoText(card);
      if (zone === 'leader' && p.weapon) text += `<br><b>※装備中:</b> ${p.weapon.name} (攻撃+${p.weapon.effectValue})`; 
      
      let maxAttacks = (p.leader.doubleAttack || (p.weapon && p.weapon.doubleAttack)) ? 2 : 1;
      let overlayBtnHtml = ""; // 👈 カード上に出すボタンを貯める箱を用意！

      if (zone === 'leader' && card.name === "蒼深の砂時計" && pid === myPlayerId && currentTurn === myPlayerId && p.leaderAttackCount === 0 && !isGameOver && !isSelectingHand) {
        text += `<br><button onclick="useLeaderSkill()" style="margin-top:8px; padding:8px 16px; background:#f1c40f; color:#2c3e50; border:none; border-radius:5px; cursor:pointer; font-weight:bold; width:100%; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">⏳ スキル発動（ロスト回収）</button>`;
        overlayBtnHtml += `<button class="card-center-btn" style="background:#f1c40f; color:#2c3e50;" onclick="event.stopPropagation(); useLeaderSkill();">⏳ 起動</button>`; // 👈 追加
      }
      if (zone === 'leader' && card.name === "\"Absolutely Main Gamer\" ONE" && pid === myPlayerId && currentTurn === myPlayerId && p.mp >= 1 && !isGameOver && !isSelectingHand) {
        text += `<br><button onclick="useLeaderSkill()" style="margin-top:8px; padding:8px 16px; background:#1abc9c; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; width:100%; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">👑 スキル発動（PP1消費: 攻撃力+1）</button>`;
        overlayBtnHtml += `<button class="card-center-btn" style="background:#1abc9c; color:white;" onclick="event.stopPropagation(); useLeaderSkill();">👑 起動</button>`; // 👈 追加
      }
      if (zone === 'item' && card.name === "魔法の杖" && pid === myPlayerId && currentTurn === myPlayerId && p.leaderAttackCount < maxAttacks && p.mp >= 4 && !isGameOver && !isSelectingHand) {
        text += `<br><button onclick="useWeaponSkill()" style="margin-top:8px; padding:8px 16px; background:#e74c3c; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; width:100%; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">🔥 杖スキル発動（PP4消費: 4ダメージ）</button>`;
        overlayBtnHtml += `<button class="card-center-btn" style="background:#e74c3c; color:white;" onclick="event.stopPropagation(); useWeaponSkill();">🔥 起動</button>`; // 👈 追加
      }
      
      if (zone !== 'leader' && zone !== 'item' && card.burn && !card.burnActive && pid === myPlayerId && currentTurn === myPlayerId && !isGameOver && !isSelectingHand) {
        text += `<br><button onclick="useBurnSkill('${zone}')" style="margin-top:8px; padding:8px 16px; background:#e67e22; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; width:100%; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">🔥 燃焼発動</button>`;
        overlayBtnHtml += `<button class="card-center-btn" style="background:#e67e22; color:white;" onclick="event.stopPropagation(); useBurnSkill('${zone}');">🔥 燃焼</button>`; // 👈 追加
      }

// 👇👇ここから「接続スキル」の追加👇👇
      window.useConnectSkill = function(sourceZone) { // 👈 引数を追加！
        isSelectingStage = true;
        selectionStageCallback = function(targetPid, targetZone) {
          if (targetZone === 'leader') return; // モンスターのみ対象
          connectCards(myPlayerId, sourceZone, targetPid, targetZone); // 👈 自身のゾーンと接続！
          isSelectingStage = false; selectionStageCallback = null; pendingSelection = null;
          infoPanel.style.backgroundColor = "#ecf0f1"; 
          renderAll(); sendGameState();
        };
        infoPanel.innerHTML = `🎯 接続する対象のモンスターをクリックしてください！`;
        infoPanel.style.backgroundColor = "#00bcd4"; 
        renderAll();
      }

      // ボタンを表示する条件（リーダー縛りをなくしました！）
      if (card.connectSkill && pid === myPlayerId && currentTurn === myPlayerId && !isGameOver && !isSelectingHand) {
        text += `<br><button onclick="useConnectSkill('${zone}')" style="margin-top:8px; padding:8px 16px; background:#00bcd4; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; width:100%;">🔗 接続スキル発動</button>`;
        overlayBtnHtml += `<button class="card-center-btn" style="background:#00bcd4; color:white;" onclick="event.stopPropagation(); useConnectSkill('${zone}');">🔗 接続</button>`;
      }
      // 👆👆ここまで「接続スキル」の追加👆👆

      infoPanel.innerHTML = text; // 元からある処理

      // 👇👇 ここから下を追加！クリックしたカードの真ん中にボタンを貼り付ける処理 👇👇

      // 👇👇 ここから下を追加！クリックしたカードの真ん中にボタンを貼り付ける処理 👇👇
      document.querySelectorAll('.card-action-overlay').forEach(o => o.remove()); // 前に出たボタンを消す
      if (overlayBtnHtml !== "") {
        let overlay = document.createElement("div");
        overlay.className = "card-action-overlay";
        overlay.innerHTML = overlayBtnHtml;
        el.appendChild(overlay);
      }
    });
  });
  if (isSelectingStage && pendingSelection && pendingSelection.type === 'stage') {
    let zoneId = pendingSelection.zone === 'leader' ? `p${pendingSelection.pid}-leader-zone` : (pendingSelection.zone === 'item' ? `p${pendingSelection.pid}-item-zone` : `p${pendingSelection.pid}-stage-${pendingSelection.zone}`);
    let zoneEl = document.getElementById(zoneId);
    if (zoneEl) {
      let cardEl = zoneEl.querySelector('.card');
      if (cardEl) {
        let overlay = document.createElement("div");
        overlay.className = "card-action-overlay";
        overlay.innerHTML = `<button class="card-center-btn" style="background:#e74c3c; color:white;" onclick="event.stopPropagation(); confirmSelection();">🎯 確定</button>`;
        cardEl.appendChild(overlay);
      }
    }
  }
}

['left', 'center', 'right', 'leader', 'item'].forEach(zone => {
  [1, 2].forEach(pId => {
    const zoneId = zone === 'leader' ? `p${pId}-leader-zone` : (zone === 'item' ? `p${pId}-item-zone` : `p${pId}-stage-${zone}`); const zoneEl = document.getElementById(zoneId); if(!zoneEl) return;
    zoneEl.addEventListener("dragover", (e) => { e.preventDefault(); zoneEl.classList.add("drag-over"); });
    zoneEl.addEventListener("dragleave", () => { zoneEl.classList.remove("drag-over"); });
    zoneEl.addEventListener("drop", (e) => {
      e.preventDefault(); zoneEl.classList.remove("drag-over");
      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (data.type === 'hand') {
          if(pId !== currentTurn || myPlayerId !== pId || isGameOver || isSelectingHand || isSelectingStage) { return; }
          playCard(data.id, zone, pId);
        } else if (data.type === 'attack') {
          if(pId === myPlayerId || isGameOver || isSelectingHand || isSelectingStage) { return; }
          executeAttack(data.pid, data.zone, pId, zone);
        }
      } catch(err) { console.error("Drop Error:", err); }
    });
  });
});

// 👇👇ここから追加👇👇
function showFloatingTextOnElement(elementId, value, type) {
  if (!value || value <= 0) return; 
  const el = document.getElementById(elementId);
  if (!el) return;
  const container = document.getElementById("floating-text-container");
  if (!container) return;
  const rect = el.getBoundingClientRect();
  const textEl = document.createElement("div");
  textEl.className = `floating-text ${type}`;
  textEl.innerText = (type === 'heal' || type === 'attack_boost' ? '+' : '-') + value;
  container.appendChild(textEl);
  const textWidth = textEl.offsetWidth;
  const textHeight = textEl.offsetHeight;
  textEl.style.left = `${rect.left + rect.width / 2 - textWidth / 2}px`;
  textEl.style.top = `${rect.top + rect.height / 2 - textHeight / 2}px`;
  setTimeout(() => { textEl.remove(); }, 1200); 
}
// 👆👆ここまで追加👆👆

function executeAttack(attackerPid, attackerZone, targetPid, targetZone) {
  const attackerPlayer = players[attackerPid]; const targetPlayer = players[targetPid];
  const attackerLeader = attackerPlayer.leader; const targetLeader = targetPlayer.leader;
  let drainAmount = 0;

  const attackerCard = attackerZone === 'leader' ? attackerLeader : attackerPlayer.stage[attackerZone];
  if (!attackerCard) return;
  const targetCard = targetZone === 'leader' ? null : targetPlayer.stage[targetZone];

  const attackerLinkedId = attackerCard.isConnected;
  const targetLinkedId = targetCard ? targetCard.isConnected : null;

  if (targetZone === 'leader') {
    const hasWard = Object.values(targetPlayer.stage).some(c => c && c.ward);
    let centerCard = targetPlayer.stage.center;
    let centerBlocks = centerCard && centerCard.type === "monster" && centerCard.name !== "\"Born from competition\" GR";
    
    if (hasWard || centerBlocks) { return; }
  }

  if (attackerZone === 'leader' && attackerPlayer.stage.center && attackerPlayer.stage.center.type === "monster") { return; }
  else if (targetZone !== 'leader' && (!targetCard || targetCard.type !== "monster")) { return; }

  if (targetCard && targetCard.name === "\"Born from competition\" GR") { return; }

  let bonusAttack = 0; Object.values(attackerPlayer.stage).forEach(c => { if(c && c.name === "戦神の旗") bonusAttack += c.effectValue; });
  let finalAtk = 0;
  
  if (attackerZone === 'leader') {
    finalAtk = attackerLeader.attack + (attackerLeader.turnAttackBoost || 0) + (attackerPlayer.weapon ? attackerPlayer.weapon.effectValue : 0) + bonusAttack;
  } else { 
    finalAtk = attackerCard.attack + (attackerCard.turnAttackBoost || 0) + bonusAttack; 
    if (attackerCard.name === "海神 アオクジラ" && attackerPlayer.lostZone.length > 0 && attackerCard.soul) {
        finalAtk += attackerCard.soul.length;
    }
  }

  let damageToDeal = finalAtk; 
  if (targetZone === 'center' && targetCard.skillType === "guard") damageToDeal = targetCard.skillValue; 
  
  if (targetZone !== 'leader' && targetCard && targetCard.name === "老練なる有段者") {
      damageToDeal -= 2;
      if (damageToDeal < 0) damageToDeal = 0;
  }
  
  if (attackerCard.burnActive && attackerCard.name === "\"Re Born in 2600\" BNR34" && targetZone === 'leader') {
      damageToDeal += 2;
  }
  if (attackerCard.burnActive && attackerCard.name === "\"To Just Zero\" A8000" && targetZone !== 'leader') {
      damageToDeal += 2;
  }

  let oppCounterAtk = 0; 
  let actualDamageDealt = 0;
  
  if (targetZone === 'leader') { 
    if (targetLeader.hasBarrier) {
      targetLeader.hasBarrier = false; damageToDeal = 0; 
    } else {
      targetPlayer.hp -= damageToDeal; 
      actualDamageDealt = damageToDeal;
      drainAmount += actualDamageDealt;
      triggerConnection(targetLeader, 'damage', actualDamageDealt, targetLinkedId); 
      showFloatingTextOnElement(`p${targetPid}-leader-zone`, actualDamageDealt, 'damage'); 
    }
    oppCounterAtk = 0; 
  } else { 
    if (targetCard.hasBarrier) {
      targetCard.hasBarrier = false; damageToDeal = 0; 
    } else {
      targetCard.hp -= damageToDeal; 
      actualDamageDealt = damageToDeal;
      drainAmount += actualDamageDealt;
      triggerConnection(targetCard, 'damage', actualDamageDealt, targetLinkedId); 
      showFloatingTextOnElement(`p${targetPid}-stage-${targetZone}`, actualDamageDealt, 'damage'); 
    }
    
    oppCounterAtk = targetCard.attack + (targetCard.turnAttackBoost || 0); 
    if (targetCard.name === "海神 アオクジラ" && targetPlayer.lostZone.length > 0 && targetCard.soul) {
        oppCounterAtk += targetCard.soul.length;
    }

    if(targetCard.hp <= 0) { 
      let destroyResult = destroyCard(targetPid, targetZone, false); 

      let isSuperPierce = attackerCard.superPierce || (attackerCard.burnActive && attackerCard.name === "\"Get Ready Going To\" LFA");

      if (destroyResult.destroyed && (attackerCard.pierce || isSuperPierce) && targetZone === 'center' && damageToDeal > 0) {
        let pierceDamage = isSuperPierce ? finalAtk * 2 : finalAtk;
        if (targetLeader.hasBarrier) {
          targetLeader.hasBarrier = false; 
        } else {
          targetPlayer.hp -= pierceDamage;
          drainAmount += pierceDamage; 
          showFloatingTextOnElement(`p${targetPid}-leader-zone`, pierceDamage, 'damage'); // 👈 追加！貫通ダメージを表示
        }
      }
    } 
  }

  if (actualDamageDealt > 0 && attackerCard.name === "ゾンビ") {
      if (targetZone === 'leader') targetLeader.infection = true;
      else if (targetCard) targetCard.infection = true;
  }

  let actualCounterDealt = 0;
  if(attackerZone !== 'leader' && oppCounterAtk > 0) {
    let counterDmg = oppCounterAtk;
    if (attackerCard.name === "老練なる有段者") {
        counterDmg -= 2;
        if (counterDmg < 0) counterDmg = 0;
    }

    if (counterDmg > 0) {
      if (attackerCard.hasBarrier) {
        attackerCard.hasBarrier = false; 
      } else {
        attackerCard.hp -= counterDmg; 
        actualCounterDealt = counterDmg;
        
        triggerConnection(attackerCard, 'damage', actualCounterDealt, attackerLinkedId); 

        showFloatingTextOnElement(`p${attackerPid}-stage-${attackerZone}`, actualCounterDealt, 'damage'); 
        if(attackerCard.hp <= 0) { 
          destroyCard(attackerPid, attackerZone, false); 
        }
      }
    }
  } else if (attackerZone === 'leader') {
    if (attackerLeader.name === "王国の勇者" && targetCard && targetCard.type === "monster" && oppCounterAtk > 0) {
        if (attackerLeader.hasBarrier) {
            attackerLeader.hasBarrier = false;
        } else {
            attackerPlayer.hp -= oppCounterAtk;
            actualCounterDealt = oppCounterAtk;

            triggerConnection(attackerLeader, 'damage', actualCounterDealt, attackerLinkedId); 

            showFloatingTextOnElement(`p${attackerPid}-leader-zone`, actualCounterDealt, 'damage'); 
        }
    }
  }

  if (actualCounterDealt > 0 && targetCard && targetCard.name === "ゾンビ") {
      if (attackerZone === 'leader') attackerLeader.infection = true;
      else if (attackerCard) attackerCard.infection = true;
  }

  if (attackerZone === 'leader') attackerPlayer.leaderAttackCount++; 
  else attackerCard.attackCount = (attackerCard.attackCount || 0) + 1;

  if (attackerCard && attackerCard.drain && drainAmount > 0) {
    if (attackerZone === 'leader') {
      attackerPlayer.hp += drainAmount;
      if (attackerPlayer.hp > attackerPlayer.maxHp) attackerPlayer.hp = attackerPlayer.maxHp;
    } else {
      attackerCard.hp += drainAmount;
    }
    triggerConnection(attackerCard, 'heal', drainAmount, attackerLinkedId); 
    const healEl = document.getElementById(attackerZone === 'leader' ? `p${attackerPid}-leader-zone` : `p${attackerPid}-stage-${attackerZone}`);
    if(healEl) { healEl.classList.add("heal-anim"); setTimeout(() => healEl.classList.remove("heal-anim"), 300); }
    
    // 👇 追加！ドレインの回復数値を表示
    showFloatingTextOnElement(attackerZone === 'leader' ? `p${attackerPid}-leader-zone` : `p${attackerPid}-stage-${attackerZone}`, drainAmount, 'heal');
  }

  // （中略：ダメージアニメーションの処理など）
  const targetElId = targetZone === 'leader' ? `p${targetPid}-leader-zone` : `p${targetPid}-stage-${targetZone}`;
  const el = document.getElementById(targetElId);
  if(el) { el.classList.add("damage-anim"); setTimeout(() => el.classList.remove("damage-anim"), 300); }

  renderAll(); sendGameState(); 
}

function playCard(cardId, targetZone, pId) {
  const p = players[pId]; const cardIndex = p.hand.findIndex(c => c.id === cardId); if(cardIndex === -1) return; const card = p.hand[cardIndex];
  if(p.mp < card.cost) { return; }

  let isSuccess = false;
  const oppId = pId === 1 ? 2 : 1;
  let artsTriggered = (card.arts !== undefined && card.cost === card.arts);
  let accelTriggered = (card.accel !== undefined && card.cost === card.accel);

  // 👇 追加：登場時効果を処理する専用の内部関数 👇
  const executeEnterEffects = (playedCard, tZone) => {
      if (p.leader && p.leader.name === "\"Absolutely Main Gamer\" ONE") {
          if (tZone !== 'leader' && p.stage[tZone]) p.stage[tZone].soul.push({name: "オーラ", type: "soul"});
      }

      if (playedCard.connectOpposite) {
          let oppZone = getOppositeZone(tZone);
          let oppCard = players[oppId].stage[oppZone];
          if (oppZone && oppCard) {
              connectCards(pId, tZone, oppId, oppZone);
              showFloatingTextOnElement(`p${pId}-stage-${tZone}`, "LINK!", "heal");
          }
      }
      
      if (playedCard.name === "≪Trust myself≫ ラパン") {
          if (!p.stage['left']) {
              let clone = JSON.parse(JSON.stringify(playedCard));
              clone.id = playedCard.id + "-left";
              if (p.leader && p.leader.name === "\"Absolutely Main Gamer\" ONE") { clone.soul.push({name: "オーラ", type: "soul"}); }
              p.stage['left'] = clone;
              connectCards(pId, tZone, pId, 'left');
              showFloatingTextOnElement(`p${pId}-stage-left`, "LINK!", "heal");
          }
      }
      else if (playedCard.name === "≪Overconfidence≫ スターレット") {
          let deckIndex = p.deck.findIndex(c => c.type === "monster" && c.attribute === "reliance" && (c.originalCost || c.cost) <= 2);
          if (deckIndex !== -1) {
              let emptyZone = ['left', 'center', 'right'].find(z => p.stage[z] === null);
              if (emptyZone) {
                  let pulledCard = p.deck.splice(deckIndex, 1)[0];
                  pulledCard.attackCount = 0; pulledCard.hasBarrier = false; pulledCard.soul = []; pulledCard.infection = false; pulledCard.turnAttackBoost = 0; pulledCard.burnActive = false;
                  if (p.leader && p.leader.name === "\"Absolutely Main Gamer\" ONE") { pulledCard.soul.push({name: "オーラ", type: "soul"}); }
                  p.stage[emptyZone] = pulledCard;
              }
          }
          ['left', 'center', 'right'].forEach(z => {
              let tCard = p.stage[z];
              if (tCard) {
                  tCard.hp += 1;
                  triggerConnection(tCard, 'heal', 1);
                  showFloatingTextOnElement(`p${pId}-stage-${z}`, 1, 'heal');
              }
          });
      }

      else if (playedCard.name === "≪相死相愛≫ α&β") {
          let pulledCount = 0;
          let usedNames = [];
          for (let i = p.deck.length - 1; i >= 0; i--) {
              let c = p.deck[i];
              if (c.type === "monster" && c.attribute === "reliance" && (c.originalCost || c.cost) <= 3 && !usedNames.includes(c.name)) {
                  let emptyZone = ['left', 'center', 'right'].find(z => p.stage[z] === null);
                  if (emptyZone) {
                      let pulledCard = p.deck.splice(i, 1)[0];
                      pulledCard.attackCount = 0; pulledCard.hasBarrier = false; pulledCard.soul = []; pulledCard.infection = false; pulledCard.turnAttackBoost = 0; pulledCard.burnActive = false;
                      if (p.leader && p.leader.name === "\"Absolutely Main Gamer\" ONE") { pulledCard.soul.push({name: "オーラ", type: "soul"}); }
                      p.stage[emptyZone] = pulledCard;
                      usedNames.push(pulledCard.name);
                      pulledCount++;
                      if (pulledCount >= 2) break; // 2種類出したら終了
                  }
              }
          }
      }
      else if (playedCard.name === "≪従属≫ オデッセイ") {
          let emptyZones = ['left', 'center', 'right'].filter(z => p.stage[z] === null);
          let cloneCount = 0;
          for (let z of emptyZones) {
              if (cloneCount >= 2) break; // 最大2枚まで出す
              let clone = JSON.parse(JSON.stringify(playedCard));
              clone.id = playedCard.id + "-clone-" + cloneCount;
              if (p.leader && p.leader.name === "\"Absolutely Main Gamer\" ONE") { clone.soul.push({name: "オーラ", type: "soul"}); }
              p.stage[z] = clone;
              cloneCount++;
          }
      }
      else if (playedCard.name === "“絶対依存の情” マッハ") {
          let targets = ['left', 'center', 'right'].filter(z => players[oppId].stage[z] !== null);
          if (targets.length > 0 && !(isSoloMode && pId === 2)) {
              isSelectingStage = true;
              selectionStageCallback = function(tPid, selZone) {
                  if (tPid !== oppId || selZone === 'leader') return;
                  connectCards(oppId, 'leader', tPid, selZone); 
                  isSelectingStage = false; selectionStageCallback = null; pendingSelection = null;
                  infoPanel.style.backgroundColor = "#ecf0f1"; renderAll(); sendGameState();
              };
              infoPanel.innerHTML = `🎯 相手のリーダーと接続させる相手モンスターをクリック！`;
              infoPanel.style.backgroundColor = "#00bcd4"; renderAll(); 
              return true; // 選択モード待機
          }
      }

      if (playedCard.name === "\"Ultimate Buddy\" ヴァルキリー") {
          let biceCount = 0;
          let usedNames = [];
          for (let i = p.deck.length - 1; i >= 0; i--) {
              let c = p.deck[i];
              if (c.type === "monster" && c.attribute && c.attribute.includes("bice") && (c.originalCost || c.cost) <= 3 && !usedNames.includes(c.name)) {
                  let emptyZone = ['left', 'center', 'right'].find(z => p.stage[z] === null);
                  if (emptyZone) {
                      let pulledCard = p.deck.splice(i, 1)[0];
                      pulledCard.attackCount = 0; pulledCard.hasBarrier = false; pulledCard.soul = []; pulledCard.infection = false; pulledCard.turnAttackBoost = 0; pulledCard.burnActive = false;
                      if (p.leader && p.leader.name === "\"Absolutely Main Gamer\" ONE") { pulledCard.soul.push({name: "オーラ", type: "soul"}); }
                      p.stage[emptyZone] = pulledCard;
                      usedNames.push(pulledCard.name);
                      biceCount++;
                      if (biceCount >= 2) break;
                  }
              }
          }
      }
      if (playedCard.name === "\"Greater Than 2nd\" 911GT2RS") { drawCard(pId); drawCard(pId); }
      
      if (playedCard.name === "ライトブラザーズ") {
          p.hp += 1; if (p.hp > p.maxHp) p.hp = p.maxHp;
          triggerConnection(p.leader, 'heal', 1); 
          showFloatingTextOnElement(`p${pId}-leader-zone`, 1, 'heal');
          if (tZone === 'left' && !p.stage['right']) {
            let clone = JSON.parse(JSON.stringify(playedCard));
            clone.id = playedCard.id + "-right"; 
            if (p.leader && p.leader.name === "\"Absolutely Main Gamer\" ONE") { clone.soul.push({name: "オーラ", type: "soul"}); }
            p.stage['right'] = clone;
            p.hp += 1; if (p.hp > p.maxHp) p.hp = p.maxHp;
            triggerConnection(p.leader, 'heal', 1); 
            showFloatingTextOnElement(`p${pId}-leader-zone`, 1, 'heal');
          }
      }

      if ((playedCard.name === "アオクラゲ" || playedCard.name === "海神 アオクジラ") && p.hand.length > 0) {
        if (isSoloMode && pId === 2) {
            let randIndex = Math.floor(Math.random() * p.hand.length);
            let targetHandCard = p.hand[randIndex];
            if (tZone !== 'leader' && p.stage[tZone]) p.stage[tZone].soul.push(targetHandCard);
            p.hand.splice(randIndex, 1);
        } else {
            isSelectingHand = true;
            selectionCallback = function(selectedIndex) {
              let targetHandCard = p.hand[selectedIndex];
              if (tZone !== 'leader' && p.stage[tZone]) p.stage[tZone].soul.push(targetHandCard);
              p.hand.splice(selectedIndex, 1);
              isSelectingHand = false; selectionCallback = null; pendingSelection = null;
              showCardEffect(playedCard); if(!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: playedCard });
              renderAll(); sendGameState(); 
            };
            infoPanel.innerHTML = `🎯 ソウルに入れる手札をクリックしてください！`;
            infoPanel.style.backgroundColor = "#f1c40f"; 
            showCardEffect(playedCard); if(!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: playedCard });
            renderAll(); return true; 
        }
      }
      else if (playedCard.name === "冬辞 アオトウ") {
          let targets = ['left', 'center', 'right'].filter(z => players[oppId].stage[z] !== null);
          if (targets.length > 0) {
              if (isSoloMode && pId === 2) {
                  let randZone = targets[Math.floor(Math.random() * targets.length)];
                  destroyCard(oppId, randZone, true); 
              } else {
                  isSelectingStage = true;
                  selectionStageCallback = function(targetPid, selZone) {
                    if (targetPid !== oppId || selZone === 'leader') return; 
                    destroyCard(oppId, selZone, true);
                    isSelectingStage = false; selectionStageCallback = null; pendingSelection = null; 
                    infoPanel.style.backgroundColor = "rgba(236, 240, 241, 0.8)"; 
                    showCardEffect(playedCard); if(!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: playedCard });
                    renderAll(); sendGameState(); 
                  };
                  infoPanel.innerHTML = `🎯 ロストする相手のモンスターをクリック！`;
                  infoPanel.style.backgroundColor = "#f1c40f"; 
                  showCardEffect(playedCard); if(!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: playedCard });
                  renderAll(); return true;
              }
          }
      }
      else if (playedCard.name === "生春 アオハル" && tZone === 'center') {
        ['left', 'right'].forEach(z => {
          if (!p.stage[z]) {
            let clone = JSON.parse(JSON.stringify(playedCard));
            clone.id = playedCard.id + "-" + z; 
            if (p.leader && p.leader.name === "\"Absolutely Main Gamer\" ONE") { clone.soul.push({name: "オーラ", type: "soul"}); }
            p.stage[z] = clone;
          }
        });
      }
      return false; // 特に待機状態がなければ終了
  };
  // 👆 内部関数ここまで 👆

  if(card.type === "monster" || card.type === "set_magic") {
    if (card.transform) {
        isSelectingStage = true;
        selectionStageCallback = function(targetPid, tZone) {
            if (targetPid !== pId) return; 
            let targetCard = tZone === 'leader' ? p.leader : p.stage[tZone];
            if (!targetCard) return; 

            p.mp -= card.cost;
            p.hand.splice(cardIndex, 1);
            
            card.id = targetCard.id;
            card.isConnected = targetCard.isConnected;
            card.soul = targetCard.soul ? [...targetCard.soul] : [];
            card.hasBarrier = targetCard.hasBarrier;
            card.infection = targetCard.infection;
            card.turnAttackBoost = targetCard.turnAttackBoost || 0;
            card.burnActive = targetCard.burnActive;
            card.attackCount = 0; 

            if (tZone === 'leader') {
                p.leader = card;
                p.hp = card.hp; p.maxHp = card.hp;
            } else { p.stage[tZone] = card; }
            
            const el = document.getElementById(tZone === 'leader' ? `p${pId}-leader-zone` : `p${pId}-stage-${tZone}`);
            if(el) { el.classList.add("heal-anim"); setTimeout(() => el.classList.remove("heal-anim"), 300); }

            isSelectingStage = false; selectionStageCallback = null; pendingSelection = null;
            infoPanel.style.backgroundColor = "#ecf0f1";

            // 👇 追加：変身後、登場時効果を発動！
            if (executeEnterEffects(card, tZone)) return; 

            showCardEffect(card); if(!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: card });
            renderAll(); sendGameState();
        };
        infoPanel.innerHTML = `🎯 変身する自分のモンスターかリーダーをクリックしてください！`;
        infoPanel.style.backgroundColor = "#9b59b6";
        renderAll();
        return; 
    }
    
    if(targetZone === 'leader') { return; }
    
    const existingCard = p.stage[targetZone];
    
    if (card.name === "\"Get Ready Going To\" LFA" && accelTriggered) {
        if (!existingCard || existingCard.name !== "\"Born from competition\" GR") return; 
        p.mp -= card.cost; card.attackCount = 0; card.hasBarrier = false; card.infection = false; card.turnAttackBoost = 0; card.burnActive = false;
        card.soul = existingCard.soul ? [...existingCard.soul, existingCard] : [existingCard];
        p.stage[targetZone] = card; p.hand.splice(cardIndex, 1); isSuccess = true;
    }
    else if (existingCard !== null) {
      if (card.evolution && card.type === existingCard.type) {
        p.mp -= card.cost; card.attackCount = 0; card.hasBarrier = false; card.infection = false; card.turnAttackBoost = 0; card.burnActive = false;
        card.soul = existingCard.soul ? [...existingCard.soul, existingCard] : [existingCard];
        if (card.name === "ファイター" && artsTriggered) { card.attack += 3; card.hp += 3; }
        if (card.name === "\"Re Born in 2600\" BNR34" && artsTriggered) { card.attack += 2; card.hp += 2; }
        p.stage[targetZone] = card; p.hand.splice(cardIndex, 1); isSuccess = true;
      } else { return; }
    } else {
      p.mp -= card.cost; card.attackCount = 0; card.hasBarrier = false; card.soul = []; card.infection = false; card.turnAttackBoost = 0; card.burnActive = false;
      if (card.name === "ファイター" && artsTriggered) { card.attack += 3; card.hp += 3; }
      if (card.name === "\"Re Born in 2600\" BNR34" && artsTriggered) { card.attack += 2; card.hp += 2; }
      p.stage[targetZone] = card; p.hand.splice(cardIndex, 1); isSuccess = true;
    }

    if (isSuccess) {
        // 👇 共通化した登場時効果をここで発動！
        if (executeEnterEffects(card, targetZone)) return; 
    }

  // ▼▼ アイテムカードの処理 ▼▼

  } else if(card.type === "item") {
    if(targetZone !== 'item') { return; }
    if (p.weapon !== null && card.evolution) {
      p.mp -= card.cost; card.soul = p.weapon.soul ? [...p.weapon.soul, p.weapon] : [p.weapon];
      p.weapon = card; p.hand.splice(cardIndex, 1); isSuccess = true;
    } else {
      p.mp -= card.cost; 
      if (p.weapon) sendToTrashOrLost(pId, [p.weapon]);
      card.soul = []; p.weapon = card; p.hand.splice(cardIndex, 1); isSuccess = true;
    }
    if (isSuccess && p.leader && p.leader.name === "\"Absolutely Main Gamer\" ONE" && p.weapon) {
        p.weapon.soul.push({name: "オーラ", type: "soul"});
    }

  } else if(card.type === "magic") {
    let extraMagicDmg = 0;
    if (p.leader && p.leader.name === "狂気の大魔術師") extraMagicDmg += 1;

    if (card.name === "アイススピアー！") {
      isSelectingStage = true;
      selectionStageCallback = function(targetPid, targetZone) {
        if (targetPid !== oppId || targetZone === 'leader') return; 
        let targetCard = players[oppId].stage[targetZone];
        if (!targetCard) return;
        if (targetCard.name === "≪Overconfidence≫ スターレット") {
            alert("「スターレット」は選択できません");
            return;
        } 

        p.mp -= card.cost;
        p.hand.splice(cardIndex, 1);
        sendToTrashOrLost(pId, [card]);

        let dmg = card.effectValue + extraMagicDmg; 
        if (p.weapon && p.weapon.name === "魔法の杖") dmg += 1;
        
        if (targetCard.name === "老練なる有段者") {
            dmg -= 2;
            if (dmg < 0) dmg = 0;
        }
        if (targetCard.name === "重装歩兵" && targetZone === 'center') { dmg = 1; }

        if (targetCard.hasBarrier) {
            targetCard.hasBarrier = false;
        } else {
            targetCard.hp -= dmg;
            if (targetCard.hp <= 0) destroyCard(oppId, targetZone, false);
        }
        
        const targetEl = document.getElementById(`p${oppId}-stage-${targetZone}`);
        if(targetEl){ targetEl.classList.add("damage-anim"); setTimeout(() => targetEl.classList.remove("damage-anim"), 300); }

        isSelectingStage = false;
        selectionStageCallback = null; pendingSelection = null; 
        infoPanel.style.backgroundColor = "#ecf0f1"; 
        
        showCardEffect(card); 
        if(!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: card });
        renderAll(); sendGameState(); 
      };
      
      infoPanel.innerHTML = `🎯 対象にする相手のモンスターをクリックしてください！`;
      infoPanel.style.backgroundColor = "#f1c40f"; 
      renderAll();
      return; 
    }

    p.mp -= card.cost; p.hand.splice(cardIndex, 1); 
    sendToTrashOrLost(pId, [card]); 
    
    if (card.name === "RBA") {
        p.leader.hasBarrier = true;
        let hasGR = Object.values(p.stage).some(c => c && c.name === "\"Born from competition\" GR");
        if (hasGR) {
            let monstersInTrash = p.trash.filter(c => c.type === "monster");
            if (monstersInTrash.length > 0) {
                let randIndex = Math.floor(Math.random() * monstersInTrash.length);
                let recoveredCard = monstersInTrash[randIndex];
                let trashIndex = p.trash.findIndex(c => c.id === recoveredCard.id);
                if (trashIndex !== -1) {
                    p.trash.splice(trashIndex, 1);
                    p.hand.push(resetCardState(recoveredCard));
                }
            }
        }
    }
    else if (card.name === "Absolute enforcer") {
      ['left', 'center', 'right'].forEach(z => {
        let tCard = players[oppId].stage[z];
        if (tCard) {
            let dmg = 1 + extraMagicDmg;
            if (p.weapon && p.weapon.name === "魔法の杖") dmg += 1;
            if (tCard.name === "老練なる有段者") { dmg -= 2; if(dmg<0)dmg=0; }
            if (dmg > 0) {
                if (tCard.hasBarrier) tCard.hasBarrier = false;
                else { 
                    tCard.hp -= dmg; 
                    triggerConnection(tCard, 'damage', dmg);
                    if(tCard.hp<=0) destroyCard(oppId, z, false); 
                }
            }
        }
      });
      drawCard(pId); drawCard(pId);
    }
    else if (card.name === "Exaust re boost") {
      Object.values(p.stage).forEach(c => {
         if (c && c.attribute && c.attribute.includes("bice")) {
             c.turnAttackBoost = (c.turnAttackBoost || 0) + 1;
         }
      });
    }
    else if (card.name === "Absolute punisher！") {
        let dmg = 11 + extraMagicDmg;
        if (p.weapon && p.weapon.name === "魔法の杖") dmg += 1;
        if (players[oppId].leader.hasBarrier) {
            players[oppId].leader.hasBarrier = false;
        } else {
            players[oppId].hp -= dmg;
            triggerConnection(players[oppId].leader, 'damage', dmg);
            const targetEl = document.getElementById(`p${oppId}-leader-zone`);
            if(targetEl){ targetEl.classList.add("damage-anim"); setTimeout(() => targetEl.classList.remove("damage-anim"), 300); }
        }
    }
    else if (card.name === "サンダーストーム！") {
      let dmg = card.effectValue + extraMagicDmg; 
      if (p.weapon && p.weapon.name === "魔法の杖") dmg += 1;
      
      ['left', 'center', 'right'].forEach(z => {
        let targetCard = players[oppId].stage[z];
        if (targetCard) {
            let currentDmg = dmg;
            if (targetCard.name === "老練なる有段者") { currentDmg -= 2; if (currentDmg < 0) currentDmg = 0; }
            if (currentDmg > 0) {
                if (targetCard.hasBarrier) { targetCard.hasBarrier = false; } 
                else { 
                    targetCard.hp -= currentDmg; 
                    triggerConnection(targetCard, 'damage', currentDmg);
                    if (targetCard.hp <= 0) destroyCard(oppId, z, false); 
                }
                const targetEl = document.getElementById(`p${oppId}-stage-${z}`);
                if(targetEl){ targetEl.classList.add("damage-anim"); setTimeout(() => targetEl.classList.remove("damage-anim"), 300); }
            }
        }
      });
    }
    else if (card.name === "海神の権能") {
      let targets = [];
      ['left', 'center', 'right'].forEach(z => { if (players[oppId].stage[z] && players[oppId].stage[z].type === "monster") targets.push(z); });
      if (targets.length > 0) {
        let randZone = targets[Math.floor(Math.random() * targets.length)];
        destroyCard(oppId, randZone, true);
      }
      drawCard(pId); drawCard(pId); drawCard(pId);
    }
    else if (card.name === "侵界の光") {
      if (p.hand.length === 0) {
        drawCard(pId); drawCard(pId);
        isSuccess = true;
      } else if (!(isSoloMode && pId === 2)) {
        isSelectingHand = true;
        selectionCallback = function(selectedIndex) {
          let targetCard = p.hand[selectedIndex];
          p.lostZone.push(resetCardState(targetCard)); 
          p.hand.splice(selectedIndex, 1); 
          drawCard(pId); drawCard(pId); 
          
          isSelectingHand = false;
          selectionCallback = null; pendingSelection = null;
          
          showCardEffect(card); 
          if(!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: card });
          renderAll(); sendGameState(); 
        };
        infoPanel.innerHTML = `🎯 ロストする手札をクリックしてください！`;
        infoPanel.style.backgroundColor = "#f1c40f"; 
        showCardEffect(card); 
        if(!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: card });
        renderAll();
        return; 
      }
    }
    else if (card.name === "Erotion the future") {
      ['left', 'center', 'right'].forEach(z => { if (p.stage[z] && p.stage[z].type === "monster") destroyCard(pId, z, true); });
      ['left', 'center', 'right'].forEach(z => {
         let c = players[oppId].stage[z];
         if (c && c.hp <= 6) destroyCard(oppId, z, true);
      });
    }
    else if (card.name === "侵界の跡") {
      p.leader.hasBarrier = true;
      if (p.lostZone.length >= 13) {
        ['left', 'center', 'right'].forEach(z => {
           let c = players[oppId].stage[z];
           if (c && c.type === "monster" && c.hp <= 3) destroyCard(oppId, z, true);
        });
      }
    }
    else if (card.name === "侵界の雨") {
      ['left', 'center', 'right'].forEach(z => { destroyCard(pId, z, true); destroyCard(oppId, z, true); });
      if (p.weapon) { p.lostZone.push(resetCardState(p.weapon)); p.weapon = null; }
      if (players[oppId].weapon) { players[oppId].lostZone.push(resetCardState(players[oppId].weapon)); players[oppId].weapon = null; }
      p.hand.forEach(c => p.lostZone.push(resetCardState(c))); p.hand = [];
      players[oppId].hand.forEach(c => players[oppId].lostZone.push(resetCardState(c))); players[oppId].hand = [];
    }
    else if(card.name === "ファイアボール") {
      let dmg = card.effectValue + extraMagicDmg;
      if (p.weapon && p.weapon.name === "魔法の杖") dmg += 1;

      if (players[oppId].leader.hasBarrier) {
        players[oppId].leader.hasBarrier = false; 
      } else {
        players[oppId].hp -= dmg;
        triggerConnection(players[oppId].leader, 'damage', dmg);
        const targetEl = document.getElementById(`p${oppId}-leader-zone`);
        if(targetEl){ targetEl.classList.add("damage-anim"); setTimeout(() => targetEl.classList.remove("damage-anim"), 300); }
        showFloatingTextOnElement(`p${oppId}-leader-zone`, dmg, 'damage');
      }
    } else if(card.name === "ヒール") {
      ['left', 'center', 'right'].forEach(z => {
        let c = p.stage[z];
        if(c && c.type === "monster") {
          c.hp += card.effectValue;
          triggerConnection(c, 'heal', card.effectValue);
          showFloatingTextOnElement(`p${pId}-stage-${z}`, card.effectValue, 'heal');
        }
      });
      p.hp += card.effectValue; if(p.hp > p.maxHp) p.hp = p.maxHp; 
      triggerConnection(p.leader, 'heal', card.effectValue);
      showFloatingTextOnElement(`p${pId}-leader-zone`, card.effectValue, 'heal');
    }
    else if (card.name === "あなたをおしえて") {
        let firstTarget = null;
        isSelectingStage = true;
        selectionStageCallback = function(tPid, tZone) {
            if (tZone === 'leader') return;
            if (!firstTarget) {
                firstTarget = { pid: tPid, zone: tZone };
                infoPanel.innerHTML = `🎯 2枚目のモンスターをクリックしてください！`;
                renderAll(); return;
            }
            connectCards(firstTarget.pid, firstTarget.zone, tPid, tZone);
            isSelectingStage = false; selectionStageCallback = null; pendingSelection = null;
            infoPanel.style.backgroundColor = "#ecf0f1";
            showCardEffect(card); if(!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: card });
            renderAll(); sendGameState();
        };
        infoPanel.innerHTML = `🎯 接続する1枚目のモンスターをクリックしてください！`;
        infoPanel.style.backgroundColor = "#00bcd4";
        renderAll(); return; 
    }
    else if (card.name === "その身に過する保護り") {
        p.leader.hasBarrier = true;
        ['left', 'center', 'right'].forEach(z => {
            if (p.stage[z]) { 
                p.stage[z].hp += 1; 
                triggerConnection(p.stage[z], 'heal', 1);
                showFloatingTextOnElement(`p${pId}-stage-${z}`, 1, 'heal'); 
            }
        });
    }
    else if (card.name === "狂依存") {
        let monsters = p.trash.filter(c => c.type === 'monster');
        if (monsters.length > 0 && p.stage.center === null) {
            let randIndex = Math.floor(Math.random() * monsters.length);
            let recoveredCard = monsters[randIndex];
            p.trash.splice(p.trash.indexOf(recoveredCard), 1);
            recoveredCard.attackCount = 0; recoveredCard.hasBarrier = false; recoveredCard.soul = []; recoveredCard.infection = false; recoveredCard.turnAttackBoost = 0; recoveredCard.burnActive = false;
            p.stage.center = recoveredCard;
        }
    }
    // 👇 変更：信用を「1体目を破壊し、2体目のHPに加算、3ドロー」に
    else if (card.name === "信用") {
        let firstTarget = null;
        isSelectingStage = true;
        selectionStageCallback = function(tPid, tZone) {
            if (tZone === 'leader') return;
            let tCard = players[tPid].stage[tZone];
            if (!tCard) return;
            
            // 相手のスターレットは選べない
            if (tPid !== pId && tCard.name === "≪Overconfidence≫ スターレット") {
                alert("「スターレット」は選択できません");
                return;
            }

            if (!firstTarget) {
                // 1枚目（破壊する対象）を記憶
                firstTarget = { pid: tPid, zone: tZone, card: tCard };
                infoPanel.innerHTML = `🎯 2枚目のモンスター（HPを吸収する対象）をクリックしてください！`;
                renderAll(); return;
            }
            
            // 2枚目が選ばれたら処理を実行
            let hpGain = firstTarget.card.hp;
            tCard.hp += hpGain;
            
            triggerConnection(tCard, 'heal', hpGain);
            showFloatingTextOnElement(`p${tPid}-stage-${tZone}`, hpGain, 'heal');
            
            // 1枚目を破壊
            destroyCard(firstTarget.pid, firstTarget.zone, false);
            
            drawCard(pId); drawCard(pId); drawCard(pId);

            isSelectingStage = false; selectionStageCallback = null; pendingSelection = null;
            infoPanel.style.backgroundColor = "#ecf0f1";
            showCardEffect(card); if(!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: card });
            renderAll(); sendGameState();
        };
        infoPanel.innerHTML = `🎯 破壊する1枚目のモンスターをクリックしてください！`;
        infoPanel.style.backgroundColor = "#00bcd4";
        renderAll(); return; 
    }
    // 👇 変更：Trust my futureを「味方全体攻撃力+2」に
    else if (card.name === "Trust my future") {
        ['left', 'center', 'right'].forEach(z => {
            let targetCard = p.stage[z];
            if (targetCard) {
                targetCard.turnAttackBoost = (targetCard.turnAttackBoost || 0) + 2;
                triggerConnection(targetCard, 'attack_boost', 2);
                showFloatingTextOnElement(`p${pId}-stage-${z}`, 2, 'attack_boost'); // 👈 'heal' から変更
            }
        });
    }

    isSuccess = true;
  }

  if (isSuccess) { 
      showCardEffect(card); 
      if(!isSoloMode) socket.emit('show_card_effect', { roomId: myRoomId, card: card }); 
  }
  renderAll(); sendGameState(); 
} // 👈👈👈 【超重要！】ここで playCard の箱を完全に閉じる！！

function endTurnProcess(pId) {
  if (isGameOver) return;
  const nextPId = pId === 1 ? 2 : 1; 
  const nextP = players[nextPId];
  let p = players[pId];

  p.hand.forEach(c => {
      if (c.name === "Absolute punisher！") {
          c.originalCost -= p.destroyedThisTurn;
          if (c.originalCost < 0) c.originalCost = 0;
          c.cost = c.originalCost; 
      }
  });

  [1, 2].forEach(targetPId => {
    let tp = players[targetPId];
    
    if (tp.leader && tp.leader.infection) {
        if (tp.leader.hasBarrier) tp.leader.hasBarrier = false;
        else {
          tp.hp -= 1;
          triggerConnection(tp.leader, 'damage', 1);
          const el = document.getElementById(`p${targetPId}-leader-zone`);
          if(el) { el.classList.add("damage-anim"); setTimeout(() => el.classList.remove("damage-anim"), 300); }
          showFloatingTextOnElement(`p${targetPId}-leader-zone`, 1, 'damage');
        }
        tp.leader.infection = false; 
    }
    ['left', 'center', 'right'].forEach(z => {
      let c = tp.stage[z];
      if (c && c.infection) {
        if (c.hasBarrier) {
          c.hasBarrier = false; 
        } else {
          c.hp -= 1;
          triggerConnection(c, 'damage', 1);
          if (c.hp <= 0) destroyCard(targetPId, z, false);
        }
        if (tp.stage[z]) tp.stage[z].infection = false;
        const el = document.getElementById(`p${targetPId}-stage-${z}`);
        if(el) { el.classList.add("damage-anim"); setTimeout(() => el.classList.remove("damage-anim"), 300); }
        showFloatingTextOnElement(`p${targetPId}-stage-${z}`, 1, 'damage');
      }
    });
  });

  if (p.leader && p.leader.name === "森の長") {
      let consumedMp = p.mp;
      p.mp = 0;
      p.hp += consumedMp;
      if (p.hp > p.maxHp) p.hp = p.maxHp;
      if (consumedMp > 0) {
          triggerConnection(p.leader, 'heal', consumedMp);
          showFloatingTextOnElement(`p${pId}-leader-zone`, consumedMp, 'heal');
      }
  }
  ['left', 'center', 'right'].forEach(z => {
      let c = p.stage[z];
      if (c && c.name === "ユニコ") {
          c.hp += 1;
          p.hp += 1;
          triggerConnection(c, 'heal', 1);
          triggerConnection(p.leader, 'heal', 1);
          if (p.hp > p.maxHp) p.hp = p.maxHp;
          showFloatingTextOnElement(`p${pId}-stage-${z}`, 1, 'heal');
          showFloatingTextOnElement(`p${pId}-leader-zone`, 1, 'heal');
      }

      if (c && c.name === "“絶対依存の情” マッハ") {
          let oppZone = getOppositeZone(z);
          let oppCard = players[nextPId].stage[oppZone];
          if (oppCard) {
              let dmg = 11;
              if (oppCard.name === "老練なる有段者") { dmg -= 2; if (dmg < 0) dmg = 0; }
              if (oppCard.name === "重装歩兵" && oppZone === 'center') { dmg = 1; }
              
              if (dmg > 0) {
                  if (oppCard.hasBarrier) {
                      oppCard.hasBarrier = false;
                  } else {
                      oppCard.hp -= dmg;
                      triggerConnection(oppCard, 'damage', dmg);
                      showFloatingTextOnElement(`p${nextPId}-stage-${oppZone}`, dmg, 'damage');
                      if (oppCard.hp <= 0) destroyCard(nextPId, oppZone, false);
                  }
              }
          }
      }
  });

  if (p.leader) {
      p.leader.turnAttackBoost = 0;
      p.leader.burnActive = false;
  }
  ['left', 'center', 'right'].forEach(z => {
      if (p.stage[z]) {
          p.stage[z].turnAttackBoost = 0;
          p.stage[z].burnActive = false;
      }
  });

  let altarPP = 0; let extraDraw = 0;
  Object.values(nextP.stage).forEach(c => { if(c && c.name === "豊穣の祭壇") altarPP++; if(c && c.skillType === "draw") extraDraw += c.skillValue; });

  if(nextP.maxMp < 10) nextP.maxMp++; nextP.maxMp += altarPP; if(nextP.maxMp > 10) nextP.maxMp = 10; nextP.mp = nextP.maxMp;
  nextP.leaderAttackCount = 0; Object.values(nextP.stage).forEach(c => { if(c) c.attackCount = 0; }); 

  players[1].destroyedThisTurn = 0; 
  players[2].destroyedThisTurn = 0;

  drawCard(nextPId); for(let i=0; i<extraDraw; i++) drawCard(nextPId);
  currentTurn = nextPId; 
  
  renderAll(); sendGameState(); 
  
  if (isSoloMode && currentTurn === 2 && !isGameOver) {
      setTimeout(playAITurn, 1500);
  }
}

endTurnBtn.addEventListener("click", () => {
  if(isGameOver || myPlayerId !== currentTurn || isSelectingHand || isSelectingStage) return; 
  endTurnProcess(myPlayerId);
});

async function playAITurn() {
  if (isGameOver || currentTurn !== 2) return;
  
  let bossName = players[2].leader.name;
  infoPanel.innerHTML = `🤖 ${bossName}のターン...`;
  renderAll();

  let p2 = players[2];
  let p1 = players[1];

  let playableCards = p2.hand.filter(c => c.cost <= p2.mp && (c.type === "monster" || c.type === "set_magic"));
  for (let card of playableCards) {
    if (isGameOver) break;
    let emptyZones = ['center', 'left', 'right'].filter(z => p2.stage[z] === null);
    if (emptyZones.length > 0) {
      let targetZone = emptyZones[0]; 
      playCard(card.id, targetZone, 2);
      await new Promise(r => setTimeout(r, 800)); 
    }
  }

  let attackers = ['center', 'left', 'right', 'leader'].filter(z => {
    let c = z === 'leader' ? p2.leader : p2.stage[z];
    return c && c.attackCount < (c.doubleAttack ? 2 : 1) && c.attack > 0;
  });

  for (let z of attackers) {
    if (isGameOver) break;

    // 👇 追加：攻撃の順番が回ってきた時点で、まだ生きているか確認
    let currentAttacker = z === 'leader' ? p2.leader : p2.stage[z];
    if (!currentAttacker) continue; 

    let targetZone = 'leader';
    
    let centerCard = p1.stage['center'];
    if (centerCard && centerCard.type === "monster" && centerCard.name !== "\"Born from competition\" GR") {
      targetZone = 'center';
    } else {
      let wZone = ['center', 'left', 'right'].find(wz => p1.stage[wz] && p1.stage[wz].ward);
      if (wZone) targetZone = wZone;
    }
    
    executeAttack(2, z, 1, targetZone);
    await new Promise(r => setTimeout(r, 800));
  }

  if (isGameOver) return;

  // ★ 新ボス：サタンの処理を追加
  if (p2.leader.name === "ダークドラゴン") {
      if (p1.stage.center === null) {
        infoPanel.innerHTML = `🐉 ダークドラゴンの強烈な一撃！！`;
        if (p1.leader.hasBarrier) { 
            p1.leader.hasBarrier = false; 
        } else {
          p1.hp -= 2;
          const el = document.getElementById(`p1-leader-zone`);
          if(el) { el.classList.add("damage-anim"); setTimeout(() => el.classList.remove("damage-anim"), 300); }
        }
        renderAll();
        await new Promise(r => setTimeout(r, 1000));
        checkGameOver();
        if (isGameOver) return;
      }
  } else if (p2.leader.name === "大悪魔 サタン") {
      infoPanel.innerHTML = `👿 サタンの破滅の炎！！`;
      let targets = ['left', 'center', 'right'].filter(z => p1.stage[z] !== null);
      if (targets.length > 0) {
          let randZone = targets[Math.floor(Math.random() * targets.length)];
          let tCard = p1.stage[randZone];
          let dmg = 4;
          if (tCard.name === "老練なる有段者") { dmg -= 2; if(dmg<0)dmg=0; }
          
          if (dmg > 0) {
              if (tCard.hasBarrier) tCard.hasBarrier = false;
              else { tCard.hp -= dmg; if(tCard.hp<=0) destroyCard(1, randZone, false); }
              const el = document.getElementById(`p1-stage-${randZone}`);
              if(el) { el.classList.add("damage-anim"); setTimeout(() => el.classList.remove("damage-anim"), 300); }
          }
      } else {
          if (p1.leader.hasBarrier) p1.leader.hasBarrier = false;
          else {
              p1.hp -= 2;
              const el = document.getElementById(`p1-leader-zone`);
              if(el) { el.classList.add("damage-anim"); setTimeout(() => el.classList.remove("damage-anim"), 300); }
              showFloatingTextOnElement(`p1-leader-zone`, 2, 'damage'); // ついでにサタンのダメージも表示
          }
      }
      renderAll();
      await new Promise(r => setTimeout(r, 1000));
      checkGameOver();
      if (isGameOver) return;
      
  // 👇👇 ここからディザスターの攻撃処理を追加 👇👇
  } else if (p2.leader.name === "絶望の魔神 ディザスター") {
      infoPanel.innerHTML = `🌋 ディザスターの絶望の波動！！すべてを焼き尽くす！`;

      // ★★★ ここから専用エフェクトを追加 ★★★
      // 1. 画面フラッシュ用の要素を作成して追加
      const flashEl = document.createElement("div");
      flashEl.className = "disaster-attack-anim";
      document.body.appendChild(flashEl);
      
      // 2. ゲーム画面全体に揺れアニメーションを適用
      const gameContainer = document.getElementById("game-wrap"); // 👈 ここを変更！
      gameContainer.classList.add("screen-shake-anim");
      
      // 3. アニメーション終了後にエフェクトを削除 (1.5秒 = 1500ms)
      setTimeout(() => {
          flashEl.remove();
          gameContainer.classList.remove("screen-shake-anim"); // 揺れを止める
      }, 1500);
      
      // 既存のダメージ処理の開始を少し遅らせてフラッシュと同期させる
      await new Promise(r => setTimeout(r, 600)); 
      // ★★★ ここまで専用エフェクトを追加 ★★★
      
      let targets = ['left', 'center', 'right'].filter(z => p1.stage[z] !== null);

      if (targets.length > 0) {
          // モンスターがいる場合：全員に3ダメージ
          targets.forEach(z => {
              let tCard = p1.stage[z];
              let dmg = 3;
              if (tCard.name === "老練なる有段者") { dmg -= 2; if(dmg<0)dmg=0; } // 有段者の軽減を適用
              
              if (dmg > 0) {
                  if (tCard.hasBarrier) tCard.hasBarrier = false;
                  else { tCard.hp -= dmg; if(tCard.hp<=0) destroyCard(1, z, false); }
                  const el = document.getElementById(`p1-stage-${z}`);
                  if(el) { el.classList.add("damage-anim"); setTimeout(() => el.classList.remove("damage-anim"), 300); }
                  showFloatingTextOnElement(`p1-stage-${z}`, dmg, 'damage'); // フローティング表示
              }
          });
      } else {
          // モンスターがいない場合：リーダーに5ダメージ！！
          if (p1.leader.hasBarrier) p1.leader.hasBarrier = false;
          else {
              p1.hp -= 5;
              const el = document.getElementById(`p1-leader-zone`);
              if(el) { el.classList.add("damage-anim"); setTimeout(() => el.classList.remove("damage-anim"), 300); }
              showFloatingTextOnElement(`p1-leader-zone`, 5, 'damage'); // フローティング表示
          }
      }
      renderAll();
      await new Promise(r => setTimeout(r, 1000));
      checkGameOver();
      if (isGameOver) return;
  }
  // 👆👆 ここまで追加 👆👆

  endTurnProcess(2);
}

// =========================================================
// ★ 勝敗判定とリザルト画面
// =========================================================
function checkGameOver() {
  if(players[1].hp <= 0 || players[2].hp <= 0) {
    if (isGameOver) return; // 既に終わってたら何もしない
    isGameOver = true; 
    
    let isWin = false;
    let winnerName = "";
    
    if (players[1].hp <= 0 && players[2].hp <= 0) {
      isWin = false; winnerName = "DRAW";
    } else if (players[1].hp <= 0) {
      isWin = false; winnerName = isSoloMode ? players[2].leader.name : "プレイヤー2";
    } else {
      isWin = true; winnerName = isSoloMode ? "あなた" : "プレイヤー1";
    }
    
    infoPanel.innerHTML = `🏆 ゲーム終了！`; 
    infoPanel.style.backgroundColor = "rgba(243, 156, 18, 0.5)";
    endTurnBtn.style.display = "none"; 
    
    // 👇 勝負がついた1秒後に、ド派手なリザルトを出す！
    setTimeout(() => { showResultScreen(isWin, winnerName); }, 1000);
  }
}

function showResultScreen(isWin, winnerName) {
  const overlay = document.getElementById("result-overlay");
  const title = document.getElementById("result-title");
  const message = document.getElementById("result-message");
  const buttons = document.getElementById("result-buttons");
  
  if (isWin) {
    title.innerText = "YOU WIN!";
    title.style.color = "#f1c40f";
    title.style.textShadow = "0 0 40px rgba(241, 196, 15, 0.8)";
    message.innerText = `勝者: ${winnerName} 🎉`;
  } else {
    title.innerText = "YOU LOSE...";
    title.style.color = "#3498db";
    title.style.textShadow = "0 0 40px rgba(52, 152, 219, 0.8)";
    message.innerText = `勝者: ${winnerName}`;
  }
  
  overlay.style.display = "flex";
  
  // アニメーション発動！
  setTimeout(() => {
    title.style.transform = "scale(1) rotate(-5deg)"; // ちょっと斜めにしてカッコよく！
    message.style.opacity = "1";
    buttons.style.opacity = "1";
  }, 100);
}

document.getElementById("new-retry-btn").addEventListener("click", () => {
  if (isSoloMode) {
      hideResultScreen();
      startGame();
      return;
  }
  document.getElementById("new-retry-btn").style.display = "none";
  document.getElementById("result-message").innerText = `相手の承認を待っています...`;
  socket.emit('request_retry', myRoomId); 
});

document.getElementById("back-home-btn").addEventListener("click", () => {
  location.reload(); // ホーム画面に戻る一番安全な方法
});

function hideResultScreen() {
  const overlay = document.getElementById("result-overlay");
  overlay.style.display = "none";
  document.getElementById("result-title").style.transform = "scale(0)";
  document.getElementById("result-message").style.opacity = "0";
  document.getElementById("result-buttons").style.opacity = "0";
  document.getElementById("new-retry-btn").style.display = "inline-block";
}

retryBtn.addEventListener("click", () => {
  if (isSoloMode) {
      startGame();
      return;
  }
  retryBtn.style.display = "none"; infoPanel.innerHTML = `相手の承認を待っています...`;
  socket.emit('request_retry', myRoomId); 
});

surrenderBtn.addEventListener("click", () => {
  if (isGameOver || !isGameStarted) return;
  if (confirm("本当に降参しますか？")) {
    players[myPlayerId].hp = 0;
    checkGameOver();
    sendGameState();
  }
});

// =========================================================
// ★ 画面の適当な場所をクリックした時のキャンセル処理
// =========================================================
document.addEventListener("click", (e) => {
  // ゲームが始まっていない場合は何もしない
  if (!isGameStarted) return;

  // クリックした場所が「カード」「ボタン」「情報パネル」「ゾーン確認画面」の場合はキャンセルしない
  if (e.target.closest('.card') || 
      e.target.closest('.card-action-overlay') || 
      e.target.closest('#info-panel') ||
      e.target.closest('button') ||
      e.target.closest('#zone-view-modal')) { // 👈 この1行が追加されました！
    return;
  }

  // 👇 ここからキャンセル処理（適当な背景をクリックした時）

  // 1. カード上の【起動】【燃焼】ボタンをすべて消す
  document.querySelectorAll('.card-action-overlay').forEach(o => o.remove());

  // 2. 「対象を選択してください」などの選択モードをすべて強制解除
  isSelectingHand = false;
  isSelectingStage = false;
  selectionCallback = null;
  selectionStageCallback = null;
  pendingSelection = null;

  // 3. テキストボックス（情報パネル）の色と文字を通常に戻す
  infoPanel.style.backgroundColor = "rgba(236, 240, 241, 0.8)";
  
  if (!isGameOver) {
     if (myPlayerId === currentTurn) { 
         infoPanel.innerHTML = `🟢 あなたのターンです！`; 
     } else { 
         infoPanel.innerHTML = `⏳ 相手のターンです...`; 
     }
  }

  // 4. 画面を再描画して、カードの選択枠（赤枠や黄色枠）を消す
  renderAll();
});

// =========================================================
// ★ ドロップ・ロストゾーンの中身確認機能
// =========================================================
window.openZoneView = function(playerId, zoneType) {
  const modal = document.getElementById('zone-view-modal');
  const title = document.getElementById('zone-view-title');
  const content = document.getElementById('zone-view-content');
  
  if (!modal || !players[playerId]) return;

  const p = players[playerId];
  let cards = [];
  let zoneName = "";

  if (zoneType === 'trash') {
    cards = p.trash;
    zoneName = `🪦 ドロップ (プレイヤー${playerId})`;
  } else if (zoneType === 'lost') {
    cards = p.lostZone;
    zoneName = `🌌 ロストゾーン (プレイヤー${playerId})`;
  }

  title.innerText = `${zoneName} - ${cards.length}枚`;
  
  let html = "";
  if (cards.length === 0) {
    html = `<div style="color: white; font-size: 20px; width: 100%; text-align: center; margin-top: 50px;">カードがありません</div>`;
  } else {
    // 落ちた順番がわかりやすいように逆順（最新が先頭）で表示
    [...cards].reverse().forEach(card => {
      html += generateCardHtml(card, `draggable="false"`, "deck-card");
    });
  }
  
  content.innerHTML = html;
  modal.style.display = "flex";
}

window.closeZoneView = function() {
  const modal = document.getElementById('zone-view-modal');
  if (modal) modal.style.display = "none";
}

// =========================================================
// ★ 視点反転機能 (P2の画面ではP2を手前にする！)
// =========================================================
function applyBoardLayout(myId) {
    const setClasses = (id, baseClass, isBottom) => {
        let el = document.getElementById(id);
        if (el) {
            el.classList.remove(`pos-p1-${baseClass}`);
            el.classList.remove(`pos-p2-${baseClass}`);
            el.classList.add(isBottom ? `pos-p1-${baseClass}` : `pos-p2-${baseClass}`);
        }
    };
    
    // myIdが2の時だけ、P1が奥(Top)になり、P2が手前(Bottom)に大反転します！
    let isP1Bottom = (myId !== 2); 
    
    setClasses("p1-leader-zone", "leader", isP1Bottom);
    setClasses("p2-leader-zone", "leader", !isP1Bottom);
    setClasses("p1-item-zone", "item", isP1Bottom);
    setClasses("p2-item-zone", "item", !isP1Bottom);
    setClasses("p1-stage-left", "left", isP1Bottom);
    setClasses("p2-stage-left", "left", !isP1Bottom);
    setClasses("p1-stage-center", "center", isP1Bottom);
    setClasses("p2-stage-center", "center", !isP1Bottom);
    setClasses("p1-stage-right", "right", isP1Bottom);
    setClasses("p2-stage-right", "right", !isP1Bottom);
    setClasses("p1-status-area", "status", isP1Bottom);
    setClasses("p2-status-area", "status", !isP1Bottom);
    setClasses("p1-hand", "hand", isP1Bottom);
    setClasses("p2-hand", "hand", !isP1Bottom);
}

// =========================================================
// ★ 接続（リンク）システム
// =========================================================

// 👇 追加：目の前のポジション（対面）を取得する魔法の関数
window.getOppositeZone = function(zone) {
    if (zone === 'left') return 'right';
    if (zone === 'center') return 'center';
    if (zone === 'right') return 'left';
    return null; // リーダーやアイテム枠には対面がない
}

let isProcessingConnection = false; // 無限ループ防止用のバリア！

// 指定したカードの接続ペアだけを解除する仕様に変更
window.breakConnection = function(targetCard) {
    if (!targetCard || !targetCard.isConnected) return;
    let linkedId = targetCard.isConnected;
    [1, 2].forEach(p => {
      ['leader', 'left', 'center', 'right'].forEach(z => {
         let c = z === 'leader' ? players[p].leader : players[p].stage[z];
         if (c && c.id === linkedId) c.isConnected = false;
      });
    });
    targetCard.isConnected = false;
}

window.connectCards = function(pid1, zone1, pid2, zone2) {
    let c1 = zone1 === 'leader' ? players[pid1].leader : players[pid1].stage[zone1];
    let c2 = zone2 === 'leader' ? players[pid2].leader : players[pid2].stage[zone2];
    // 既にどちらかが接続済みの場合は新しいペアを作れない
    if (c1 && c2 && !c1.isConnected && !c2.isConnected) {
       c1.isConnected = c2.id; // 相手のカードIDを記憶してペアを作る！
       c2.isConnected = c1.id;
       let targets = [ {pid: pid1, zone: zone1, card: c1}, {pid: pid2, zone: zone2, card: c2} ];
       targets.forEach(t => {
           let leader = players[t.pid].leader;
           // 「自分のリーダー」がヴァイス＆シュヴァルツで、「自分のモンスター」が接続された場合
           if (leader && leader.name === "≪Conecting other world≫ ヴァイス&シュヴァルツ" && t.zone !== 'leader') {
               t.card.hp += 2;
               
               // HP上昇をリンク先に伝播させ、画面に数値を出す
               triggerConnection(t.card, 'heal', 2);
               showFloatingTextOnElement(`p${t.pid}-stage-${t.zone}`, 2, 'heal');
           }
       });
    }
}
// ダメージや回復をもう片方に伝染させる関数
window.triggerConnection = function(sourceCard, type, value, forceLinkedId = null) {
    // 記憶したID（forceLinkedId）があればそれを優先する！
    let linkedId = forceLinkedId || (sourceCard ? sourceCard.isConnected : null);
    if (isProcessingConnection || !sourceCard || !linkedId) return;
    
    let otherCardInfo = null;
    [1, 2].forEach(p => {
      ['leader', 'left', 'center', 'right'].forEach(z => {
         let c = z === 'leader' ? players[p].leader : players[p].stage[z];
         // 接続相手のIDと一致するカードだけを探す！
         if (c && c.id === linkedId) {
             otherCardInfo = { pid: p, zone: z, card: c };
         }
      });
    });
    
    if (!otherCardInfo) return; // 相手が見つからなければ何もしない

    isProcessingConnection = true; // 伝染処理中！無限ループバリアを展開！
    
    let tp = players[otherCardInfo.pid];
    let tc = otherCardInfo.card;
    let tz = otherCardInfo.zone;

    if (type === 'damage') {
        if (tz === 'leader') { tp.hp -= value; } 
        else {
            tc.hp -= value;
            if (tc.hp <= 0) destroyCard(otherCardInfo.pid, tz, false);
        }
        let targetElId = tz === 'leader' ? `p${otherCardInfo.pid}-leader-zone` : `p${otherCardInfo.pid}-stage-${tz}`;
        const el = document.getElementById(targetElId);
        if(el) { el.classList.add("damage-anim"); setTimeout(() => el.classList.remove("damage-anim"), 300); }
        showFloatingTextOnElement(targetElId, value, 'damage'); 
    } else if (type === 'heal') {
        if (tz === 'leader') {
            tp.hp += value; if (tp.hp > tp.maxHp) tp.hp = tp.maxHp;
        } else { tc.hp += value;
        }
        let targetElId = tz === 'leader' ? `p${otherCardInfo.pid}-leader-zone` : `p${otherCardInfo.pid}-stage-${tz}`;
        const el = document.getElementById(targetElId);
        if(el) { el.classList.add("heal-anim"); setTimeout(() => el.classList.remove("heal-anim"), 300); }
        showFloatingTextOnElement(targetElId, value, 'heal'); 
    }else if (type === 'attack_boost') { // 👇 追加：攻撃力の増減も共有する！
        if (tz === 'leader') {
            tp.leader.turnAttackBoost = (tp.leader.turnAttackBoost || 0) + value;
        } else { 
            tc.turnAttackBoost = (tc.turnAttackBoost || 0) + value; 
        }
        let targetElId = tz === 'leader' ? `p${otherCardInfo.pid}-leader-zone` : `p${otherCardInfo.pid}-stage-${tz}`;
        const el = document.getElementById(targetElId);
        if(el) { el.classList.add("attack-anim"); setTimeout(() => el.classList.remove("attack-anim"), 300); }
        showFloatingTextOnElement(targetElId, value, 'attack_boost'); 
    }

    isProcessingConnection = false; // 処理完了。バリア解除！
}